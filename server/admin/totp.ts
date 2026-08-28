import crypto from "node:crypto";

const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Encode(input:Buffer){let bits=0,value=0,output="";for(const byte of input){value=(value<<8)|byte;bits+=8;while(bits>=5){output+=alphabet[(value>>>(bits-5))&31];bits-=5;}}if(bits>0)output+=alphabet[(value<<(5-bits))&31];return output;}
export function base32Decode(input:string){let bits=0,value=0;const bytes:number[]=[];for(const char of input.replace(/=+$/,"")){const index=alphabet.indexOf(char.toUpperCase());if(index<0)throw new Error("INVALID_BASE32");value=(value<<5)|index;bits+=5;if(bits>=8){bytes.push((value>>>(bits-8))&255);bits-=8;}}return Buffer.from(bytes);}
export function totp(secret:string,time=Date.now(),stepSeconds=30){const counter=Math.floor(time/1000/stepSeconds),buffer=Buffer.alloc(8);buffer.writeBigUInt64BE(BigInt(counter));const digest=crypto.createHmac("sha1",base32Decode(secret)).update(buffer).digest(),offset=digest[digest.length-1]&15,value=((digest[offset]&127)<<24)|((digest[offset+1]&255)<<16)|((digest[offset+2]&255)<<8)|(digest[offset+3]&255);return String(value%1_000_000).padStart(6,"0");}
export function verifyTotp(secret:string,code:string,now=Date.now()){for(let offset=-1;offset<=1;offset++){const time=now+offset*30_000;if(crypto.timingSafeEqual(Buffer.from(totp(secret,time)),Buffer.from(code)))return Math.floor(time/30_000);}return null;}
