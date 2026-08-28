import request from "supertest";
import {describe,expect,it} from "vitest";
import {app} from "../server/app";

describe("HTTP security boundary",()=>{it("sets CSP and defensive browser headers without exposing Express",async()=>{const response=await request(app).get("/");expect(response.headers["content-security-policy"]).toContain("default-src 'self'");expect(response.headers["content-security-policy"]).toContain("frame-ancestors 'none'");expect(response.headers["x-content-type-options"]).toBe("nosniff");expect(response.headers["x-powered-by"]).toBeUndefined();});});
