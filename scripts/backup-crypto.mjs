import crypto from "node:crypto";
import fs from "node:fs";

const [mode,inputPath,outputPath]=process.argv.slice(2),key=Buffer.from(process.env.BACKUP_ENCRYPTION_KEY??"","base64");
if(!["encrypt","decrypt"].includes(mode)||!inputPath||!outputPath||key.length!==32)throw new Error("Usage: BACKUP_ENCRYPTION_KEY=<32-byte-base64> node scripts/backup-crypto.mjs encrypt|decrypt input output");
if(mode==="encrypt"){const nonce=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",key,nonce);cipher.setAAD(Buffer.from("LangTutor/PostgreSQL-backup/v1"));const ciphertext=Buffer.concat([cipher.update(fs.readFileSync(inputPath)),cipher.final()]);fs.writeFileSync(outputPath,Buffer.concat([Buffer.from("LTBK1"),nonce,cipher.getAuthTag(),ciphertext]),{mode:0o600});}
else{const source=fs.readFileSync(inputPath);if(source.subarray(0,5).toString()!=="LTBK1")throw new Error("Unsupported backup format");const decipher=crypto.createDecipheriv("aes-256-gcm",key,source.subarray(5,17));decipher.setAAD(Buffer.from("LangTutor/PostgreSQL-backup/v1"));decipher.setAuthTag(source.subarray(17,33));fs.writeFileSync(outputPath,Buffer.concat([decipher.update(source.subarray(33)),decipher.final()]),{mode:0o600});}
