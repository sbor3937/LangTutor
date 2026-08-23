import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { IdentityService } from "../server/identity/service";
import { importItalianLearent } from "../server/learning/legacy-import";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

suite("idempotent ItalianLearent import", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 3 });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "langtutor-import-"));
  const sqlitePath = path.join(directory, "source.sqlite");
  const backupDirectory = path.join(directory, "backups");
  const legacyId = crypto.randomUUID();

  afterAll(async () => {
    await pool.end();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("backs up, preserves the legacy UUID and imports each row once", async () => {
    const db = new DatabaseSync(sqlitePath), profileId = crypto.randomUUID();
    try {
      db.exec(`
        CREATE TABLE profiles(id TEXT PRIMARY KEY,anonymous_id TEXT);
        CREATE TABLE lesson_progress(profile_id TEXT,lesson_id TEXT,current_step INTEGER,completion_percent INTEGER,completed INTEGER,score REAL);
        CREATE TABLE skill_attempts(id TEXT,profile_id TEXT,lesson_id TEXT,exercise_id TEXT,skill_type TEXT,score REAL,feedback TEXT,created_at TEXT);
        CREATE TABLE user_words(id TEXT,profile_id TEXT,italian TEXT,translation TEXT,example_italian TEXT,example_russian TEXT,lesson_id TEXT,status TEXT,interval_days INTEGER,repetitions INTEGER,correct_count INTEGER,error_count INTEGER,next_review_at TEXT,created_at TEXT,updated_at TEXT);
      `);
      db.prepare("INSERT INTO profiles VALUES(?,?)").run(profileId, legacyId);
      db.prepare("INSERT INTO lesson_progress VALUES(?,?,?,?,?,?)").run(profileId, "greetings", 2, 25, 0, 70);
      db.prepare("INSERT INTO skill_attempts VALUES(?,?,?,?,?,?,?,?)").run(crypto.randomUUID(), profileId, "greetings", "word-1", "vocabulary", 100, "Верно", new Date().toISOString());
      db.prepare("INSERT INTO user_words VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(crypto.randomUUID(), profileId, "Ciao", "Привет", null, null, "greetings", "learning", 2, 1, 1, 0, new Date().toISOString(), new Date().toISOString(), new Date().toISOString());
    } finally { db.close(); }

    const userId = (await new IdentityService(pool).register({ email: `import-${crypto.randomUUID()}@example.test`, password: "correct horse import password", displayName: "Импорт" })).userId!;
    const first = await importItalianLearent({ sqlitePath, legacyAnonymousId: legacyId, userId, pool, backupDirectory });
    expect(first).toMatchObject({ status: "imported", sourceCounts: { progress: 1, attempts: 1, vocabulary: 1 }, counts: { progress: 1, attempts: 1, vocabulary: 1 } });
    expect(fs.existsSync(first.backup)).toBe(true);
    const second = await importItalianLearent({ sqlitePath, legacyAnonymousId: legacyId, userId, pool, backupDirectory });
    expect(second).toMatchObject({ status: "already_imported", counts: { progress: 1, attempts: 1, vocabulary: 1 } });
  });
});
