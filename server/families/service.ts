import crypto from "node:crypto";
import argon2 from "argon2";
import type pg from "pg";
import { hashOpaqueToken, IdentityService } from "../identity/service.js";
import { can, type FamilyCapability, type FamilyRole } from "./capabilities.js";
import type { z } from "zod";
import type { createInvitationSchema, familySettingsSchema } from "../../shared/family-schemas.js";

type InvitationInput = z.infer<typeof createInvitationSchema>;
type SettingsInput = z.infer<typeof familySettingsSchema>;

export class FamilyService {
  private readonly identity: IdentityService;
  constructor(private readonly pool: pg.Pool) { this.identity = new IdentityService(pool); }

  async auth(token: string) {
    const session = await this.identity.authenticate(token);
    if (!session) return null;
    const context = await this.pool.query<{ family_id: string; role: FamilyRole }>("SELECT * FROM families.active_context($1)", [session.user_id]);
    return { userId: session.user_id, sessionId: session.session_id, familyId: context.rows[0]?.family_id ?? null, role: context.rows[0]?.role ?? null };
  }

  async createFamily(userId: string, name: string, requestId: string) {
    const existing = await this.pool.query("SELECT * FROM families.active_context($1)", [userId]);
    if (existing.rowCount) throw new Error("ALREADY_IN_FAMILY");
    const familyId = crypto.randomUUID();
    return this.transaction(userId, familyId, async (client) => {
      await client.query("INSERT INTO families.families(id,name,created_by) VALUES($1,$2,$3)", [familyId, name, userId]);
      await client.query("INSERT INTO families.memberships(id,family_id,user_id,role) VALUES($1,$2,$3,'owner')", [crypto.randomUUID(), familyId, userId]);
      await client.query("INSERT INTO families.settings(family_id,updated_by) VALUES($1,$2)", [familyId, userId]);
      await client.query("INSERT INTO audit.events(id,family_id,actor_user_id,action,object_type,object_id,result,request_id) VALUES($1,$2,$3,'family.created','family',$2,'success',$4)", [crypto.randomUUID(), familyId, userId, requestId]);
      return { familyId, name, role: "owner" as const };
    });
  }

  async current(auth: NonNullable<Awaited<ReturnType<FamilyService["auth"]>>>) {
    if (!auth.familyId) return null;
    return this.transaction(auth.userId, auth.familyId, async (client) => {
      const family = await client.query("SELECT id,name,version,created_at FROM families.families WHERE id=$1", [auth.familyId]);
      const members = await client.query("SELECT user_id,role,joined_at FROM families.memberships WHERE family_id=$1 AND status='active' ORDER BY joined_at", [auth.familyId]);
      const settings = await client.query("SELECT values,version,updated_at FROM families.settings WHERE family_id=$1", [auth.familyId]);
      return { ...family.rows[0], role: auth.role, members: members.rows, settings: settings.rows[0] };
    });
  }

  async invite(auth: NonNullable<Awaited<ReturnType<FamilyService["auth"]>>>, input: InvitationInput, requestId: string) {
    this.require(auth, "family.invitation.create");
    const token = crypto.randomBytes(32).toString("base64url"), invitationId = crypto.randomUUID();
    await this.transaction(auth.userId, auth.familyId!, async (client) => {
      await client.query("INSERT INTO families.invitations(id,family_id,email_normalized,invited_user_id,role,token_hash,invited_by,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '7 days')", [invitationId, auth.familyId, input.email?.toLowerCase() ?? null, input.userId ?? null, input.role, hashOpaqueToken(token), auth.userId]);
      await client.query("INSERT INTO audit.events(id,family_id,actor_user_id,action,object_type,object_id,result,request_id,safe_diff) VALUES($1,$2,$3,'family.invitation_created','invitation',$4,'success',$5,$6::jsonb)", [crypto.randomUUID(), auth.familyId, auth.userId, invitationId, requestId, JSON.stringify({ role: input.role })]);
    });
    return { invitationId, token };
  }

  async accept(userId: string, token: string, password: string, requestId: string) {
    const credential = await this.pool.query<{ password_hash: string }>("SELECT * FROM identity.lookup_password_for_reauth($1)", [userId]);
    if (!credential.rows[0] || !await argon2.verify(credential.rows[0].password_hash, password).catch(() => false)) throw new Error("REAUTH_FAILED");
    const result = await this.pool.query<{ from_family_id: string | null; to_family_id: string }>("SELECT * FROM families.accept_invitation($1,$2,$3)", [hashOpaqueToken(token), userId, requestId]);
    return result.rows[0];
  }

  async updateSettings(auth: NonNullable<Awaited<ReturnType<FamilyService["auth"]>>>, input: SettingsInput, requestId: string) {
    this.require(auth, "family.settings.write");
    return this.transaction(auth.userId, auth.familyId!, async (client) => {
      const changed = await client.query("UPDATE families.settings SET values=$3::jsonb,version=version+1,updated_by=$2,updated_at=now() WHERE family_id=$1 AND version=$4 RETURNING values,version,updated_at", [auth.familyId, auth.userId, JSON.stringify(input.values), input.version]);
      if (!changed.rows[0]) throw new Error("VERSION_CONFLICT");
      await client.query("INSERT INTO audit.events(id,family_id,actor_user_id,action,object_type,object_id,result,request_id) VALUES($1,$2,$3,'family.settings_updated','family',$2,'success',$4)", [crypto.randomUUID(), auth.familyId, auth.userId, requestId]);
      return changed.rows[0];
    });
  }

  async transferOwnership(auth: NonNullable<Awaited<ReturnType<FamilyService["auth"]>>>, targetUserId: string, requestId: string) {
    this.require(auth, "family.owner.transfer");
    if (targetUserId === auth.userId) throw new Error("INVALID_OWNER_TARGET");
    return this.transaction(auth.userId, auth.familyId!, async (client) => {
      const target = await client.query("UPDATE families.memberships SET role='owner' WHERE family_id=$1 AND user_id=$2 AND status='active' RETURNING id", [auth.familyId, targetUserId]);
      if (!target.rows[0]) throw new Error("MEMBER_NOT_FOUND");
      await client.query("UPDATE families.memberships SET role='admin' WHERE family_id=$1 AND user_id=$2 AND status='active'", [auth.familyId, auth.userId]);
      await client.query("INSERT INTO audit.events(id,family_id,actor_user_id,action,object_type,object_id,result,request_id,safe_diff) VALUES($1,$2,$3,'family.ownership_transferred','membership',$4,'success',$5,$6::jsonb)", [crypto.randomUUID(), auth.familyId, auth.userId, target.rows[0].id, requestId, JSON.stringify({ targetUserId })]);
      return { ownerUserId: targetUserId, previousOwnerRole: "admin" };
    });
  }

  async audit(auth: NonNullable<Awaited<ReturnType<FamilyService["auth"]>>>) {
    this.require(auth, "family.audit.read");
    return this.transaction(auth.userId, auth.familyId!, async (client) => (await client.query("SELECT id,actor_user_id,action,object_type,object_id,result,safe_diff,request_id,created_at FROM audit.events WHERE family_id=$1 ORDER BY created_at DESC LIMIT 100", [auth.familyId])).rows);
  }

  private require(auth: { familyId: string | null; role: FamilyRole | null }, capability: FamilyCapability) {
    if (!auth.familyId || !auth.role || !can(auth.role, capability)) throw new Error("FORBIDDEN");
  }

  private async transaction<T>(userId: string, familyId: string, action: (client: pg.PoolClient) => Promise<T>) {
    const client = await this.pool.connect();
    try { await client.query("BEGIN"); await client.query("SELECT set_config('app.user_id',$1,true),set_config('app.family_id',$2,true)", [userId, familyId]); const result = await action(client); await client.query("COMMIT"); return result; }
    catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
}
