import pg from "pg";
import { importItalianLearent } from "./legacy-import.js";

const [sqlitePath,legacyAnonymousId,userId,backupDirectory="./backups/legacy-import"] = process.argv.slice(2),databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl||!sqlitePath||!legacyAnonymousId||!userId)throw new Error("Usage: DATABASE_URL=... npm run legacy:import -- <sqlite> <legacy-uuid> <user-id> [backup-dir]");
const pool=new pg.Pool({connectionString:databaseUrl,max:1});
try{const result=await importItalianLearent({sqlitePath,legacyAnonymousId,userId,backupDirectory,pool});console.log(JSON.stringify({status:result.status,counts:result.counts,backup:pathSafe(result.backup)}));}finally{await pool.end();}
function pathSafe(value:string){return value.replace(/^.*[\\/]/,"");}
