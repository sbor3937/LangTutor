import {describe,expect,it} from "vitest";
import {base32Decode,base32Encode,totp,verifyTotp} from "../server/admin/totp";

describe("TOTP",()=>{it("implements RFC 6238 compatible six-digit codes",()=>{const secret="GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";expect(totp(secret,59_000)).toBe("287082");expect(verifyTotp(secret,"287082",59_000)).toBe(1);});it("round-trips base32 secrets",()=>{const source=Buffer.from("secure random secret");expect(base32Decode(base32Encode(source))).toEqual(source);});});
