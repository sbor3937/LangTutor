import crypto from "node:crypto";
import pg from "pg";
import request from "supertest";
import { afterAll,beforeAll,describe,expect,it } from "vitest";
import { app } from "../server/app";
import { FamilyService } from "../server/families/service";
import { IdentityService } from "../server/identity/service";

const databaseUrl=process.env.TEST_DATABASE_URL;const suite=databaseUrl?describe:describe.skip;
suite("authenticated AI API",()=>{const pool=new pg.Pool({connectionString:databaseUrl,max:3}),identity=new IdentityService(pool),families=new FamilyService(pool),agent=request.agent(app),runId=crypto.randomUUID(),password="correct horse ai api password";const account={email:`ai-api-${runId}@example.test`,password,displayName:"AI learner"};
  beforeAll(async()=>{const userId=(await identity.register(account)).userId!;await identity.verifyEmail(await identity.issueOneTimeToken(userId,"verify_email"));await families.createFamily(userId,"Demo family",crypto.randomUUID());expect((await agent.post("/api/v1/auth/login").send(account)).status).toBe(200);});afterAll(()=>pool.end());
  it("uses Demo Provider without a key and derives tenant from session",async()=>{const response=await agent.post("/api/v1/tutor").send({message:"Ciao",scenario:"intro",history:[]});expect(response.status).toBe(200);expect(response.body).toMatchObject({mode:"demo",scenario:"intro"});expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);});
  it("rejects client supplied identity and family fields",async()=>{const response=await agent.post("/api/v1/tutor").send({message:"Ciao",scenario:"intro",history:[],userId:crypto.randomUUID(),familyId:crypto.randomUUID()});expect(response.status).toBe(400);});
});
