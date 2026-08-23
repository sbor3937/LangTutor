import fs from "node:fs";
import path from "node:path";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { ZodError, z } from "zod";
import { db, ensureProfile, profileId } from "./db/database.js";
import { config } from "./config.js";
import { analyzePronunciation, nextReview } from "../shared/learning.js";
import {
  attemptSchema,
  examSubmissionSchema,
  familyAttachSchema,
  familyConnectSchema,
  importSchema,
  profilePinSchema,
  profileSchema,
  profileUnlockSchema,
  progressSchema,
  tutorRequestSchema,
  wordInputSchema,
} from "../shared/schemas.js";
import { liveTutor } from "./services/tutor.js";
import { transcribeItalian } from "./services/stt.js";
import {
  attachProfiles,
  connectFamily,
  familyProfiles,
  issueFamilyCode,
  setProfilePin,
  touchProfile,
  verifyProfilePin,
} from "./services/family.js";
import { postgresPool } from "./platform/postgres/client.js";
import { createIdentityRouter } from "./identity/router.js";
import { createFamilyRouter } from "./families/router.js";
import { createLearningRouter } from "./learning/router.js";
export const app = express();
if (config.trustProxyHops > 0) app.set("trust proxy", config.trustProxyHops);
const thirdBlockLessonIds = new Set(["home", "routine", "weather", "health", "plans"]);
const thirdBlockScenarioIds = new Set(["home", "routine", "weather", "health", "plans"]);
const firstTwoBlockLessonIds = ["greetings", "reading", "numbers", "cafe", "city", "hotel", "time", "food", "shopping", "help"];
const examExpected = ["Grazie", "chi", "dodici", "il conto", "Dov'è la stazione?", "Ho una prenotazione", "A che ora?", "Vorrei una pizza senza formaggio", "Posso pagare con la carta?", "Mi scusi, ho bisogno di aiuto"];
const hasPassedSecondBlockExam = (profile: string) => Boolean(db.prepare("SELECT 1 FROM skill_attempts WHERE profile_id=? AND exercise_id='mini-exam-blocks-1-2' AND score>=80 LIMIT 1").get(profile));
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "256kb" }));
if (postgresPool) app.use("/api/v1/auth", createIdentityRouter(postgresPool));
if (postgresPool) app.use("/api/v1/families", createFamilyRouter(postgresPool));
if (postgresPool) app.use("/api/v1/learning", createLearningRouter(postgresPool));
const wrap =
  (fn: express.RequestHandler): express.RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
app.get("/api/health", (_req, res) => {
  try {
    db.prepare("SELECT 1").get();
    fs.accessSync(config.dataDir, fs.constants.W_OK);
    res.json({
      status: "ok",
      database: "ok",
      dataDirectory: "writable",
      version: "0.1.0",
    });
  } catch {
    res.status(503).json({
      error: {
        code: "HEALTH_ERROR",
        message: "Локальное хранилище недоступно",
      },
    });
  }
});
app.get("/api/health/live", (_req, res) => res.json({ status: "ok", version: "0.1.0" }));
app.get("/api/health/ready", wrap(async (_req, res) => {
  db.prepare("SELECT 1").get();
  if (postgresPool) await postgresPool.query("SELECT 1");
  res.json({ status: "ok", database: postgresPool ? "postgresql" : "sqlite-compat", version: "0.1.0" });
}));
app.get("/api/system/status", (_req, res) =>
  res.json({
    mode: config.liveAI && config.openrouterKey ? "live" : "demo",
    provider: config.liveAI ? "OpenRouter" : "Демо AI",
    model: config.liveAI ? config.openrouterModel : null,
    proxyConfigured: Boolean(config.proxyUrl),
    sttProvider: config.groqKey ? "Groq Whisper" : "Браузер",
    sttModel: config.groqKey ? config.groqModel : null,
    sttProxyConfigured: Boolean(config.groqProxyUrl),
    database: "SQLite",
    dataLocation: "локальная папка data",
  }),
);
app.get("/api/system/ca-certificate", (_req, res) => {
  if (!config.tlsCertPath || !fs.existsSync(config.tlsCertPath))
    return res.status(404).json({
      error: { code: "TLS_NOT_CONFIGURED", message: "HTTPS не настроен" },
    });
  res.download(config.tlsCertPath, "langtutor-ca.crt");
});
app.get("/api/profile/:aid", (req, res) => {
  const anonymousId = z.string().uuid().parse(req.params.aid),
    id = ensureProfile(anonymousId);
  touchProfile(anonymousId, req.ip || req.socket.remoteAddress || "unknown");
  res.json(
    db
      .prepare(
        "SELECT id,anonymous_id anonymousId,name,learning_goal learningGoal,daily_minutes dailyMinutes,initial_level initialLevel,weekly_goal weeklyGoal,created_at createdAt,updated_at updatedAt FROM profiles WHERE id=?",
      )
      .get(id),
  );
});
app.get("/api/family/:aid", (req, res) => {
  const anonymousId = z.string().uuid().parse(req.params.aid);
  res.json({ profiles: familyProfiles(anonymousId) });
});
app.post("/api/family/:aid/code", (req, res) => {
  const anonymousId = z.string().uuid().parse(req.params.aid);
  res.json({ code: issueFamilyCode(anonymousId) });
});
app.post("/api/family/:aid/attach", (req, res) => {
  const anonymousId = z.string().uuid().parse(req.params.aid),
    input = familyAttachSchema.parse(req.body);
  res.json({ profiles: attachProfiles(anonymousId, input.anonymousIds) });
});
app.post(
  "/api/family/connect",
  rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  (req, res) => {
    const input = familyConnectSchema.parse(req.body),
      profiles = connectFamily(input.code);
    if (!profiles)
      return res.status(404).json({
        error: { code: "INVALID_FAMILY_CODE", message: "Код семьи не найден" },
      });
    res.json({ profiles });
  },
);
app.put("/api/profile/:aid/pin", (req, res) => {
  const anonymousId = z.string().uuid().parse(req.params.aid),
    input = profilePinSchema.parse(req.body);
  setProfilePin(anonymousId, input.pin || null);
  res.json({ ok: true, pinConfigured: Boolean(input.pin) });
});
app.post(
  "/api/profile/unlock",
  rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  (req, res) => {
    const input = profileUnlockSchema.parse(req.body);
    if (!verifyProfilePin(input.anonymousId, input.pin))
      return res.status(401).json({
        error: { code: "INVALID_PIN", message: "Неверный PIN" },
      });
    res.json({ ok: true });
  },
);
app.put("/api/profile/:aid", (req, res) => {
  const p = profileSchema.parse({ ...req.body, anonymousId: req.params.aid });
  const id = ensureProfile(p.anonymousId),
    now = new Date().toISOString();
  db.prepare(
    "UPDATE profiles SET name=?,learning_goal=?,daily_minutes=?,initial_level=?,weekly_goal=?,updated_at=? WHERE id=?",
  ).run(
    p.name,
    p.learningGoal,
    p.dailyMinutes,
    p.initialLevel,
    p.weeklyGoal,
    now,
    id,
  );
  res.json({ ok: true });
});
app.get("/api/progress/:aid", (req, res) => {
  const id = ensureProfile(req.params.aid);
  res.json({
    lessons: db
      .prepare(
        "SELECT lesson_id lessonId,current_step currentStep,completion_percent completionPercent,completed,score,last_opened_at lastOpenedAt FROM lesson_progress WHERE profile_id=?",
      )
      .all(id),
    attempts: db
      .prepare(
        "SELECT exercise_id exerciseId,skill_type skillType,score,created_at createdAt FROM skill_attempts WHERE profile_id=? ORDER BY created_at DESC",
      )
      .all(id),
  });
});
app.post("/api/lesson-progress", (req, res) => {
  const p = progressSchema.parse(req.body),
    id = ensureProfile(p.anonymousId),
    now = new Date().toISOString();
  if (thirdBlockLessonIds.has(p.lessonId) && !hasPassedSecondBlockExam(id))
    return res.status(403).json({ error: { code: "EXAM_REQUIRED", message: "Сначала сдайте мини-экзамен по урокам 1–10 минимум на 80%." } });
  db.prepare(
    `INSERT INTO lesson_progress(profile_id,lesson_id,current_step,completion_percent,completed,score,last_opened_at,completed_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(profile_id,lesson_id) DO UPDATE SET current_step=excluded.current_step,completion_percent=excluded.completion_percent,completed=excluded.completed,score=excluded.score,last_opened_at=excluded.last_opened_at,completed_at=excluded.completed_at`,
  ).run(
    id,
    p.lessonId,
    p.currentStep,
    p.completionPercent,
    Number(p.completed),
    p.score ?? null,
    now,
    p.completed ? now : null,
  );
  res.json({ ok: true });
});
app.post("/api/exam/blocks-1-2", (req, res) => {
  const submission = examSubmissionSchema.parse(req.body),
    id = ensureProfile(submission.anonymousId),
    completedLessons = db.prepare(`SELECT COUNT(*) count FROM lesson_progress WHERE profile_id=? AND completed=1 AND lesson_id IN (${firstTwoBlockLessonIds.map(() => "?").join(",")})`).get(id, ...firstTwoBlockLessonIds) as { count: number };
  if (completedLessons.count < firstTwoBlockLessonIds.length)
    return res.status(403).json({ error: { code: "LESSONS_REQUIRED", message: "Сначала завершите уроки 1–10." } });
  const
    details = examExpected.map((expected, index) => ({ score: analyzePronunciation(expected, submission.answers[index]).score, expected })),
    score = Math.round(details.reduce((sum, item) => sum + item.score, 0) / details.length);
  db.prepare("INSERT INTO skill_attempts VALUES(?,?,?,?,?,?,?,?,?,?)").run(crypto.randomUUID(), id, "help", "mini-exam-blocks-1-2", "quiz", score, "Уроки 1–10", submission.answers.join(" | "), score >= 80 ? "Мини-экзамен сдан" : "Нужно повторение", new Date().toISOString());
  res.status(201).json({ score, details, passed: score >= 80 });
});
app.post("/api/skill-attempt", (req, res) => {
  const a = attemptSchema.parse(req.body),
    id = ensureProfile(a.anonymousId);
  if (a.exerciseId === "mini-exam-blocks-1-2") return res.status(400).json({ error: { code: "USE_EXAM_ENDPOINT", message: "Результат экзамена рассчитывается сервером." } });
  db.prepare("INSERT INTO skill_attempts VALUES(?,?,?,?,?,?,?,?,?,?)").run(
    crypto.randomUUID(),
    id,
    a.lessonId,
    a.exerciseId,
    a.skillType,
    a.score,
    a.targetText || null,
    a.recognizedText || null,
    a.feedback || null,
    new Date().toISOString(),
  );
  res.status(201).json({ ok: true });
});
app.get("/api/words/:aid", (req, res) => {
  const id = ensureProfile(req.params.aid);
  res.json(
    db
      .prepare(
        "SELECT id,italian,translation,example_italian exampleItalian,example_russian exampleRussian,lesson_id lessonId,status,interval_days intervalDays,repetitions,correct_count correctCount,error_count errorCount,next_review_at nextReviewAt FROM user_words WHERE profile_id=? ORDER BY next_review_at",
      )
      .all(id),
  );
});
app.post("/api/words", (req, res) => {
  const w = wordInputSchema.parse(req.body),
    id = ensureProfile(w.anonymousId),
    now = new Date().toISOString(),
    wid = crypto.randomUUID();
  db.prepare(
    `INSERT INTO user_words VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(profile_id,italian) DO UPDATE SET translation=excluded.translation,example_italian=excluded.example_italian,updated_at=excluded.updated_at`,
  ).run(
    wid,
    id,
    w.italian,
    w.translation,
    w.exampleItalian || null,
    w.exampleRussian || null,
    w.lessonId || null,
    "new",
    1,
    0,
    0,
    0,
    new Date(Date.now() + 86400000).toISOString(),
    now,
    now,
  );
  res.status(201).json({ ok: true });
});
app.patch("/api/words/:id", (req, res) => {
  const body = z
    .object({
      status: z.enum(["new", "learning", "known", "review"]).optional(),
      translation: z.string().min(1).max(200).optional(),
    })
    .parse(req.body);
  const r = db
    .prepare(
      "UPDATE user_words SET status=COALESCE(?,status),translation=COALESCE(?,translation),updated_at=? WHERE id=?",
    )
    .run(
      body.status || null,
      body.translation || null,
      new Date().toISOString(),
      req.params.id,
    );
  res.status(r.changes ? 200 : 404).json({ ok: Boolean(r.changes) });
});
app.delete("/api/words/:id", (req, res) => {
  db.prepare("DELETE FROM user_words WHERE id=?").run(req.params.id);
  res.status(204).end();
});
app.post("/api/words/:id/review", (req, res) => {
  const action = z
    .object({ action: z.enum(["known", "review"]) })
    .parse(req.body);
  const row = db
    .prepare(
      "SELECT interval_days intervalDays,correct_count correctCount,error_count errorCount,repetitions FROM user_words WHERE id=?",
    )
    .get(req.params.id) as any;
  if (!row)
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Слово не найдено" } });
  const n = nextReview(row.intervalDays, action.action);
  db.prepare(
    "UPDATE user_words SET status=?,interval_days=?,next_review_at=?,repetitions=?,correct_count=?,error_count=?,updated_at=? WHERE id=?",
  ).run(
    action.action === "known" ? "known" : "review",
    n.intervalDays,
    n.nextReviewAt,
    row.repetitions + 1,
    row.correctCount + (action.action === "known" ? 1 : 0),
    row.errorCount + (action.action === "review" ? 1 : 0),
    new Date().toISOString(),
    req.params.id,
  );
  res.json(n);
});
app.post("/api/pronunciation/analyze", (req, res) => {
  const x = z
    .object({
      target: z.string().min(1).max(500),
      recognized: z.string().max(500),
    })
    .parse(req.body);
  res.json(analyzePronunciation(x.target, x.recognized));
});
app.post(
  "/api/stt",
  rateLimit({
    windowMs: 60000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  express.raw({ type: ["audio/webm", "audio/ogg", "audio/mp4"], limit: "2mb" }),
  wrap(async (req, res) => {
    if (!config.groqKey)
      return res.status(503).json({
        error: {
          code: "STT_NOT_CONFIGURED",
          message: "Серверное распознавание не настроено",
        },
      });
    if (!Buffer.isBuffer(req.body) || req.body.length < 100)
      return res
        .status(400)
        .json({ error: { code: "EMPTY_AUDIO", message: "Аудио не получено" } });
    const transcript = await transcribeItalian(
      req.body,
      req.headers["content-type"] || "audio/webm",
    );
    res.json({ transcript });
  }),
);
app.post(
  "/api/tutor",
  rateLimit({
    windowMs: 60000,
    limit: 15,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  wrap(async (req, res) => {
    const p = tutorRequestSchema.parse(req.body),
      id = ensureProfile(p.anonymousId),
      unlockedLessonIds = db.prepare("SELECT lesson_id lessonId FROM lesson_progress WHERE profile_id=? AND (completion_percent>0 OR completed=1)").all(id).map((row: any) => row.lessonId as string),
      now = new Date().toISOString();
    if (thirdBlockScenarioIds.has(p.scenario) && !hasPassedSecondBlockExam(id))
      return res.status(403).json({ error: { code: "EXAM_REQUIRED", message: "Сценарий откроется после мини-экзамена." } });
    const result = await liveTutor(p.message, p.scenario, p.history, unlockedLessonIds);
    db.prepare("INSERT INTO tutor_messages VALUES(?,?,?,?,?,?,?)").run(
      crypto.randomUUID(),
      id,
      p.scenario,
      "user",
      p.message,
      null,
      now,
    );
    db.prepare("INSERT INTO tutor_messages VALUES(?,?,?,?,?,?,?)").run(
      crypto.randomUUID(),
      id,
      p.scenario,
      "assistant",
      result.data.replyItalian,
      JSON.stringify(result.data),
      now,
    );
    res.json({ ...result.data, mode: result.mode });
  }),
);
app.get("/api/export/:aid", (req, res) => {
  const id = ensureProfile(req.params.aid);
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="italian-progress.json"',
  );
  res.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: db.prepare("SELECT * FROM profiles WHERE id=?").get(id),
    words: db.prepare("SELECT * FROM user_words WHERE profile_id=?").all(id),
    progress: db
      .prepare("SELECT * FROM lesson_progress WHERE profile_id=?")
      .all(id),
    attempts: db
      .prepare("SELECT * FROM skill_attempts WHERE profile_id=?")
      .all(id),
  });
});
app.post("/api/import/:aid", (req, res) => {
  const data = importSchema.parse(req.body),
    id = ensureProfile(req.params.aid);
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const w of data.words) {
      if (typeof w.italian === "string" && typeof w.translation === "string")
        db.prepare(
          `INSERT OR IGNORE INTO user_words(id,profile_id,italian,translation,status,interval_days,repetitions,correct_count,error_count,next_review_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
        ).run(
          crypto.randomUUID(),
          id,
          w.italian,
          w.translation,
          "new",
          1,
          0,
          0,
          0,
          new Date().toISOString(),
          new Date().toISOString(),
          new Date().toISOString(),
        );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  res.json({ ok: true, importedWords: data.words.length });
});
app.delete("/api/profile/:aid", (req, res) => {
  const id = profileId(req.params.aid);
  if (id) db.prepare("DELETE FROM profiles WHERE id=?").run(id);
  res.status(204).end();
});
const dist = path.resolve("dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: "1h" }));
  app.get("/{*splat}", (req, res, next) =>
    req.path.startsWith("/api/")
      ? next()
      : res.sendFile(path.join(dist, "index.html")),
  );
}
app.use((req, res) =>
  res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message: "Ресурс не найден" } }),
);
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    void next;
    if (err instanceof ZodError)
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Проверьте введённые данные",
        },
      });
    const domainCode = err instanceof Error ? err.message : "";
    const domainErrors: Record<string, { status: number; message: string }> = {
      ALREADY_IN_FAMILY: { status: 409, message: "Пользователь уже состоит в семье" },
      FORBIDDEN: { status: 403, message: "Недостаточно прав" },
      REAUTH_FAILED: { status: 401, message: "Повторная аутентификация не пройдена" },
      VERSION_CONFLICT: { status: 409, message: "Настройки уже изменены; обновите страницу" },
      INVALID_INVITATION: { status: 400, message: "Приглашение недействительно или устарело" },
      INVITATION_TARGET_MISMATCH: { status: 403, message: "Приглашение предназначено другому пользователю" },
      ALREADY_MEMBER: { status: 409, message: "Пользователь уже состоит в этой семье" },
      SOLE_OWNER: { status: 409, message: "Сначала передайте права владельца старой семьи" },
      INVALID_OWNER_TARGET: { status: 400, message: "Выберите другого участника семьи" },
      MEMBER_NOT_FOUND: { status: 404, message: "Участник семьи не найден" },
      COURSE_NOT_FOUND: { status: 404, message: "Курс не найден" },
      ENROLLMENT_REQUIRED: { status: 409, message: "Сначала запишитесь на курс" },
      EXERCISE_NOT_SCORABLE: { status: 422, message: "Это упражнение не поддерживает автоматическую оценку" },
    };
    const domain = domainErrors[domainCode];
    if (domain) return res.status(domain.status).json({ error: { code: domainCode, message: domain.message } });
    console.error(
      "Request failed:",
      err instanceof Error ? err.name : "Unknown",
    );
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Не удалось выполнить действие",
      },
    });
  },
);
