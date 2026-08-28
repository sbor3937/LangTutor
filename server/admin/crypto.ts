import crypto from "node:crypto";
import { config } from "../config.js";

type Encrypted={ciphertext:Buffer;nonce:Buffer;tag:Buffer;keyVersion:number};
function key(){const decoded=Buffer.from(config.adminMfaEncryptionKey,"base64");if(decoded.length!==32)throw new Error("ADMIN_MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key");return decoded;}
export function encryptMfaSecret(secret:string):Encrypted{const nonce=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",key(),nonce);cipher.setAAD(Buffer.from("LangTutor/admin-mfa/v1"));const ciphertext=Buffer.concat([cipher.update(secret,"utf8"),cipher.final()]);return{ciphertext,nonce,tag:cipher.getAuthTag(),keyVersion:1};}
export function decryptMfaSecret(input:{secret_ciphertext:Buffer;secret_nonce:Buffer;secret_tag:Buffer;key_version:number}){if(input.key_version!==1)throw new Error("MFA_KEY_VERSION_UNSUPPORTED");const decipher=crypto.createDecipheriv("aes-256-gcm",key(),input.secret_nonce);decipher.setAAD(Buffer.from("LangTutor/admin-mfa/v1"));decipher.setAuthTag(input.secret_tag);return Buffer.concat([decipher.update(input.secret_ciphertext),decipher.final()]).toString("utf8");}
