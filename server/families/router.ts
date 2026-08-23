import crypto from "node:crypto";
import express from "express";
import type pg from "pg";
import { acceptInvitationSchema, createFamilySchema, createInvitationSchema, familySettingsSchema, transferOwnershipSchema } from "../../shared/family-schemas.js";
import { config } from "../config.js";
import { FamilyService } from "./service.js";

export function createFamilyRouter(pool: pg.Pool) {
  const router = express.Router(), service = new FamilyService(pool);
  router.use((req, res, next) => {
    if (!config.secureCookies || req.method === "GET" || req.get("origin") === new URL(config.appUrl).origin) return next();
    res.status(403).json({ error: { code: "INVALID_ORIGIN", message: "Источник запроса не разрешён" } });
  });
  router.use(async (req, res, next) => {
    const token = req.cookies?.lt_session as string | undefined;
    const auth = token ? await service.auth(token) : null;
    if (!auth) return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Требуется вход" } });
    res.locals.auth = auth;
    next();
  });
  router.post("/", async (req, res) => {
    const input = createFamilySchema.parse(req.body), requestId = crypto.randomUUID();
    const result = await service.createFamily(res.locals.auth.userId, input.name, requestId);
    res.status(201).setHeader("X-Request-Id", requestId).json(result);
  });
  router.get("/current", async (_req, res) => {
    const result = await service.current(res.locals.auth);
    res.status(result ? 200 : 404).json(result ?? { error: { code: "NO_FAMILY", message: "Семья ещё не создана" } });
  });
  router.post("/current/invitations", async (req, res) => {
    const requestId = crypto.randomUUID(), result = await service.invite(res.locals.auth, createInvitationSchema.parse(req.body), requestId);
    const inviteUrl = new URL("/join-family", config.appUrl); inviteUrl.searchParams.set("token", result.token);
    res.status(201).setHeader("X-Request-Id", requestId).json({ invitationId: result.invitationId, inviteUrl: inviteUrl.toString(), expiresInDays: 7 });
  });
  router.post("/invitations/accept", async (req, res) => {
    const input = acceptInvitationSchema.parse(req.body), requestId = crypto.randomUUID();
    const result = await service.accept(res.locals.auth.userId, input.token, input.password, requestId);
    res.setHeader("X-Request-Id", requestId).json(result);
  });
  router.put("/current/settings", async (req, res) => {
    const requestId = crypto.randomUUID(), result = await service.updateSettings(res.locals.auth, familySettingsSchema.parse(req.body), requestId);
    res.setHeader("X-Request-Id", requestId).json(result);
  });
  router.post("/current/ownership/transfer", async (req, res) => {
    const requestId = crypto.randomUUID(), input = transferOwnershipSchema.parse(req.body);
    res.setHeader("X-Request-Id", requestId).json(await service.transferOwnership(res.locals.auth, input.targetUserId, requestId));
  });
  router.get("/current/audit", async (_req, res) => res.json({ events: await service.audit(res.locals.auth) }));
  return router;
}
