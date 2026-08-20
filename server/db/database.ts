import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "../config.js";
fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
export const db = new DatabaseSync(config.databasePath);
db.exec(
  "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;",
);
export function migrate() {
  db.exec(`
CREATE TABLE IF NOT EXISTS profiles(id TEXT PRIMARY KEY,anonymous_id TEXT UNIQUE NOT NULL,name TEXT,learning_goal TEXT NOT NULL,daily_minutes INTEGER NOT NULL,initial_level TEXT NOT NULL,weekly_goal INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS lesson_progress(profile_id TEXT NOT NULL,lesson_id TEXT NOT NULL,current_step INTEGER NOT NULL DEFAULT 0,completion_percent INTEGER NOT NULL DEFAULT 0,completed INTEGER NOT NULL DEFAULT 0,score REAL,last_opened_at TEXT NOT NULL,completed_at TEXT,PRIMARY KEY(profile_id,lesson_id),FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS user_words(id TEXT PRIMARY KEY,profile_id TEXT NOT NULL,italian TEXT NOT NULL,translation TEXT NOT NULL,example_italian TEXT,example_russian TEXT,lesson_id TEXT,status TEXT NOT NULL DEFAULT 'new',interval_days INTEGER NOT NULL DEFAULT 1,repetitions INTEGER NOT NULL DEFAULT 0,correct_count INTEGER NOT NULL DEFAULT 0,error_count INTEGER NOT NULL DEFAULT 0,next_review_at TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(profile_id,italian),FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS skill_attempts(id TEXT PRIMARY KEY,profile_id TEXT NOT NULL,lesson_id TEXT,exercise_id TEXT NOT NULL,skill_type TEXT NOT NULL,score REAL NOT NULL,target_text TEXT,recognized_text TEXT,feedback TEXT,created_at TEXT NOT NULL,FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS achievements(id TEXT PRIMARY KEY,profile_id TEXT NOT NULL,achievement_key TEXT NOT NULL,unlocked_at TEXT NOT NULL,UNIQUE(profile_id,achievement_key),FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS tutor_messages(id TEXT PRIMARY KEY,profile_id TEXT NOT NULL,scenario TEXT NOT NULL,role TEXT NOT NULL,text TEXT NOT NULL,correction_data TEXT,created_at TEXT NOT NULL,FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS households(id TEXT PRIMARY KEY,recovery_code_hash TEXT UNIQUE,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS household_profiles(household_id TEXT NOT NULL,profile_id TEXT UNIQUE NOT NULL,joined_at TEXT NOT NULL,PRIMARY KEY(household_id,profile_id),FOREIGN KEY(household_id) REFERENCES households(id) ON DELETE CASCADE,FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS profile_access(profile_id TEXT PRIMARY KEY,last_seen_at TEXT,last_seen_ip TEXT,pin_salt TEXT,pin_hash TEXT,FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE);`);
}
migrate();
export function profileId(anonymousId: string) {
  const row = db
    .prepare("SELECT id FROM profiles WHERE anonymous_id=?")
    .get(anonymousId) as { id: string } | undefined;
  return row?.id;
}
export function ensureProfile(anonymousId: string) {
  let id = profileId(anonymousId);
  if (!id) {
    id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare("INSERT INTO profiles VALUES(?,?,?,?,?,?,?,?,?)").run(
      id,
      anonymousId,
      "",
      "travel",
      15,
      "zero",
      5,
      now,
      now,
    );
  }
  return id;
}
