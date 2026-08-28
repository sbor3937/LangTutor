import crypto from "node:crypto";
import pg from "pg";
import request from "supertest";
import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {app} from "../server/app";
import {totp} from "../server/admin/totp";
import {IdentityService} from "../server/identity/service";

const databaseUrl=process.env.TEST_DATABASE_URL,adminUrl=process.env.TEST_ADMIN_DATABASE_URL;const suite=databaseUrl&&adminUrl?describe:describe.skip;
suite("Super Admin API",()=>{const pool=new pg.Pool({connectionString:databaseUrl,max:3}),owner=new pg.Pool({connectionString:adminUrl,max:1}),identity=new IdentityService(pool),agent=request.agent(app),password="correct horse admin api password",email=`control-${crypto.randomUUID()}@example.test`;let secret="";
  beforeAll(async()=>{const id=(await identity.register({email,password,displayName:"Control"})).userId!;await identity.verifyEmail(await identity.issueOneTimeToken(id,"verify_email"));await owner.query("UPDATE identity.users SET is_super_admin=true WHERE id=$1",[id]);expect((await agent.post("/api/v1/auth/login").send({email,password})).status).toBe(200);});afterAll(async()=>{await pool.end();await owner.end();});
  it("does not disclose the control boundary to normal users",async()=>{const normal=request.agent(app),normalEmail=`normal-${crypto.randomUUID()}@example.test`,id=(await identity.register({email:normalEmail,password,displayName:"Normal"})).userId!;await identity.verifyEmail(await identity.issueOneTimeToken(id,"verify_email"));await normal.post("/api/v1/auth/login").send({email:normalEmail,password});expect((await normal.get("/api/v1/admin/mfa/status")).status).toBe(404);});
  it("enrolls MFA once and opens a separate short admin session",async()=>{const enrollment=await agent.post("/api/v1/admin/mfa/enroll").send({password});expect(enrollment.status).toBe(200);secret=enrollment.body.secret;expect(secret).toMatch(/^[A-Z2-7]+$/);expect((await agent.post("/api/v1/admin/mfa/activate").send({code:totp(secret)})).status).toBe(200);expect((await agent.post("/api/v1/admin/session").send({code:totp(secret)})).status).toBe(200);const overview=await agent.get("/api/v1/admin/overview");expect(overview.status).toBe(200);expect(overview.body.users).toBeGreaterThan(0);});
  it("uses strict schemas on dangerous actions",async()=>{const response=await agent.post("/api/v1/admin/reauth").send({password,code:totp(secret,Date.now()+30_000),userId:crypto.randomUUID()});expect(response.status).toBe(400);});
});
