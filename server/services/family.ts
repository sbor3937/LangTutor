import crypto from "node:crypto";
import { db, ensureProfile, profileId } from "../db/database.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function normalizeCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z2-9]/g, "");
}

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function newCode() {
  const bytes = crypto.randomBytes(16);
  const raw = [...bytes]
    .map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length])
    .join("");
  return `ITAL-${raw.match(/.{1,4}/g)?.join("-")}`;
}

export function ensureFamily(anonymousId: string) {
  const id = ensureProfile(anonymousId);
  const existing = db
    .prepare(
      "SELECT household_id householdId FROM household_profiles WHERE profile_id=?",
    )
    .get(id) as { householdId: string } | undefined;
  if (existing) return existing.householdId;
  const householdId = crypto.randomUUID(),
    now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("INSERT INTO households VALUES(?,?,?,?)").run(
      householdId,
      null,
      now,
      now,
    );
    db.prepare("INSERT INTO household_profiles VALUES(?,?,?)").run(
      householdId,
      id,
      now,
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return householdId;
}

export function issueFamilyCode(anonymousId: string) {
  const householdId = ensureFamily(anonymousId),
    code = newCode();
  db.prepare(
    "UPDATE households SET recovery_code_hash=?,updated_at=? WHERE id=?",
  ).run(hash(normalizeCode(code)), new Date().toISOString(), householdId);
  return code;
}

export function familyProfiles(anonymousId: string) {
  const householdId = ensureFamily(anonymousId);
  return db
    .prepare(
      `SELECT p.anonymous_id anonymousId,p.name,pa.last_seen_at lastSeenAt,pa.last_seen_ip lastSeenIp,
      CASE WHEN pa.pin_hash IS NULL THEN 0 ELSE 1 END pinConfigured
      FROM household_profiles hp JOIN profiles p ON p.id=hp.profile_id
      LEFT JOIN profile_access pa ON pa.profile_id=p.id
      WHERE hp.household_id=? ORDER BY p.created_at`,
    )
    .all(householdId);
}

export function attachProfiles(
  ownerAnonymousId: string,
  anonymousIds: string[],
) {
  const householdId = ensureFamily(ownerAnonymousId),
    now = new Date().toISOString();
  const insert = db.prepare(
    "INSERT OR IGNORE INTO household_profiles VALUES(?,?,?)",
  );
  for (const anonymousId of anonymousIds) {
    const id = ensureProfile(anonymousId);
    const membership = db
      .prepare(
        "SELECT household_id householdId FROM household_profiles WHERE profile_id=?",
      )
      .get(id) as { householdId: string } | undefined;
    if (!membership) insert.run(householdId, id, now);
  }
  return familyProfiles(ownerAnonymousId);
}

export function connectFamily(code: string) {
  const household = db
    .prepare("SELECT id FROM households WHERE recovery_code_hash=?")
    .get(hash(normalizeCode(code))) as { id: string } | undefined;
  if (!household) return null;
  return db
    .prepare(
      `SELECT p.anonymous_id anonymousId,p.name,pa.last_seen_at lastSeenAt,
      CASE WHEN pa.pin_hash IS NULL THEN 0 ELSE 1 END pinConfigured
      FROM household_profiles hp JOIN profiles p ON p.id=hp.profile_id
      LEFT JOIN profile_access pa ON pa.profile_id=p.id WHERE hp.household_id=? ORDER BY p.created_at`,
    )
    .all(household.id);
}

export function touchProfile(anonymousId: string, ip: string) {
  const id = profileId(anonymousId);
  if (!id) return;
  db.prepare(
    `INSERT INTO profile_access(profile_id,last_seen_at,last_seen_ip) VALUES(?,?,?)
     ON CONFLICT(profile_id) DO UPDATE SET last_seen_at=excluded.last_seen_at,last_seen_ip=excluded.last_seen_ip`,
  ).run(id, new Date().toISOString(), ip.replace(/^::ffff:/, "").slice(0, 64));
}

function pinDigest(pin: string, salt: string) {
  return crypto.scryptSync(pin, salt, 32).toString("hex");
}

export function setProfilePin(anonymousId: string, pin: string | null) {
  const id = ensureProfile(anonymousId);
  if (!pin) {
    db.prepare(
      `INSERT INTO profile_access(profile_id,pin_salt,pin_hash) VALUES(?,?,?)
       ON CONFLICT(profile_id) DO UPDATE SET pin_salt=NULL,pin_hash=NULL`,
    ).run(id, null, null);
    return;
  }
  const salt = crypto.randomBytes(16).toString("hex");
  db.prepare(
    `INSERT INTO profile_access(profile_id,pin_salt,pin_hash) VALUES(?,?,?)
     ON CONFLICT(profile_id) DO UPDATE SET pin_salt=excluded.pin_salt,pin_hash=excluded.pin_hash`,
  ).run(id, salt, pinDigest(pin, salt));
}

export function verifyProfilePin(anonymousId: string, pin: string) {
  const id = profileId(anonymousId);
  if (!id) return false;
  const row = db
    .prepare(
      "SELECT pin_salt salt,pin_hash pinHash FROM profile_access WHERE profile_id=?",
    )
    .get(id) as { salt: string | null; pinHash: string | null } | undefined;
  if (!row?.pinHash || !row.salt) return true;
  const actual = Buffer.from(pinDigest(pin, row.salt), "hex"),
    expected = Buffer.from(row.pinHash, "hex");
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}
