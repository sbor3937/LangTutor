import crypto from "node:crypto";
import pg from "pg";
import { contentPacks } from "../../content/registry.js";

const databaseUrl = process.env.MIGRATION_DATABASE_URL;
if (!databaseUrl) throw new Error("MIGRATION_DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
function stableUuid(value: string) { const hex = crypto.createHash("sha256").update(`langtutor:${value}`).digest("hex").slice(0, 32).split(""); hex[12] = "5"; hex[16] = "8"; const joined = hex.join(""); return `${joined.slice(0,8)}-${joined.slice(8,12)}-${joined.slice(12,16)}-${joined.slice(16,20)}-${joined.slice(20)}`; }

try {
  for (const pack of contentPacks) {
    const languageId=stableUuid(`language:${pack.languageKey}`),programId=stableUuid(`program:${pack.programKey}`),courseId=stableUuid(`course:${pack.courseKey}`),versionId=stableUuid(`course:${pack.courseKey}:v${pack.version}`);
    const client=await pool.connect(); await client.query("BEGIN");
    try {
      await client.query("INSERT INTO learning.languages(id,key,name) VALUES($1,$2,$3) ON CONFLICT(key) DO UPDATE SET name=excluded.name",[languageId,pack.languageKey,pack.languageName]);
      const programMetadata={targetLocale:pack.targetLocale,cefr:pack.cefr,prerequisites:pack.prerequisites,skills:pack.skills,scoringPolicy:pack.scoringPolicy,unlockRules:pack.unlockRules,aiScenarios:pack.aiScenarios};
      await client.query("INSERT INTO learning.programs(id,language_id,key,name,source_locale,metadata) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(key) DO UPDATE SET name=excluded.name,source_locale=excluded.source_locale,metadata=excluded.metadata",[programId,languageId,pack.programKey,pack.programName,pack.sourceLocale,JSON.stringify(programMetadata)]);
      await client.query("INSERT INTO learning.courses(id,program_id,key,name,metadata) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(key) DO UPDATE SET name=excluded.name,metadata=excluded.metadata",[courseId,programId,pack.courseKey,pack.courseName,JSON.stringify({targetLocale:pack.targetLocale,cefr:pack.cefr})]);
      await client.query("INSERT INTO learning.course_versions(id,course_id,version,status,published_at) VALUES($1,$2,$3,'published',now()) ON CONFLICT(course_id,version) DO NOTHING",[versionId,courseId,pack.version]);
      for (const lesson of pack.lessons) {
        const lessonId=stableUuid(`${pack.courseKey}:v${pack.version}:lesson:${lesson.id}`);
        await client.query("INSERT INTO learning.lessons(id,course_version_id,lesson_key,title,position,content) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(course_version_id,lesson_key) DO UPDATE SET title=excluded.title,position=excluded.position,content=excluded.content",[lessonId,versionId,lesson.id,lesson.title,lesson.number,JSON.stringify(lesson)]);
        for (const [position,practice] of lesson.practices.entries()) {
          const exerciseKey=`practice-${position+1}`,exerciseId=stableUuid(`${lessonId}:${exerciseKey}`);
          await client.query("INSERT INTO learning.exercises(id,lesson_id,exercise_key,type,position,content) VALUES($1,$2,$3,'practice',$4,$5::jsonb) ON CONFLICT(lesson_id,exercise_key) DO UPDATE SET position=excluded.position,content=excluded.content",[exerciseId,lessonId,exerciseKey,position+1,JSON.stringify({label:practice})]);
        }
        for (const [position,word] of lesson.words.entries()) {
          const exerciseKey=`word-${position+1}`,exerciseId=stableUuid(`${lessonId}:${exerciseKey}`);
          await client.query("INSERT INTO learning.exercises(id,lesson_id,exercise_key,type,position,content) VALUES($1,$2,$3,'translation',$4,$5::jsonb) ON CONFLICT(lesson_id,exercise_key) DO UPDATE SET position=excluded.position,content=excluded.content",[exerciseId,lessonId,exerciseKey,100+position,JSON.stringify({prompt:word.source,expectedAnswer:word.target,skillType:"vocabulary"})]);
        }
      }
      await client.query("COMMIT");
    } catch(error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  console.log("Content packs seeded");
} finally { await pool.end(); }
