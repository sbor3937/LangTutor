import express from "express";
import rateLimit from "express-rate-limit";
import type pg from "pg";
import { loginSchema, registerSchema, requestResetSchema, resetPasswordSchema, tokenSchema } from "../../shared/identity-schemas.js";
import { config } from "../config.js";
import { IdentityService } from "./service.js";

const COOKIE = "lt_session";
const REFRESH_COOKIE = "lt_refresh";
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
const cookieOptions = { httpOnly: true, secure: config.secureCookies, sameSite: "lax" as const, path: "/", maxAge: 15 * 60_000 };
const refreshCookieOptions = { ...cookieOptions, path: "/api/v1/auth", maxAge: 30 * 24 * 60 * 60_000 };

function ipPrefix(ip?: string) {
  if (!ip) return null;
  const normalized = ip.replace(/^::ffff:/, "");
  return normalized.includes(":") ? normalized.split(":").slice(0, 4).join(":") : normalized.split(".").slice(0, 3).join(".");
}

export function createIdentityRouter(pool: pg.Pool) {
  const router = express.Router();
  const service = new IdentityService(pool);
  router.use((req, res, next) => {
    if (!config.secureCookies || req.method === "GET") return next();
    const origin = req.get("origin");
    const expected = new URL(config.appUrl).origin;
    if (origin === expected) return next();
    res.status(403).json({ error: { code: "INVALID_ORIGIN", message: "Источник запроса не разрешён" } });
  });

  router.post("/register", authLimiter, async (req, res) => {
    await service.register(registerSchema.parse(req.body));
    res.status(202).json({ status: "verification_required" });
  });
  router.post("/verify-email", authLimiter, async (req, res) => {
    const ok = await service.verifyEmail(tokenSchema.parse(req.body).token);
    res.status(ok ? 200 : 400).json(ok ? { status: "verified" } : { error: { code: "INVALID_OR_EXPIRED_TOKEN", message: "Ссылка недействительна или устарела" } });
  });
  router.post("/login", authLimiter, async (req, res) => {
    const session = await service.login(loginSchema.parse(req.body), req.get("user-agent") ?? null, ipPrefix(req.ip));
    if (!session) return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Неверные данные для входа" } });
    res.cookie(COOKIE, session.token, cookieOptions).cookie(REFRESH_COOKIE, session.refreshToken, refreshCookieOptions).json({ userId: session.userId, expiresAt: session.expiresAt.toISOString() });
  });
  router.post("/refresh", authLimiter, async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    const session = token ? await service.refresh(token, req.get("user-agent") ?? null, ipPrefix(req.ip)) : null;
    if (!session) return res.status(401).json({ error: { code: "INVALID_REFRESH_TOKEN", message: "Требуется повторный вход" } });
    res.cookie(COOKIE, session.token, cookieOptions).cookie(REFRESH_COOKIE, session.refreshToken, refreshCookieOptions).json({ userId: session.userId, expiresAt: session.expiresAt.toISOString() });
  });
  router.post("/request-password-reset", authLimiter, async (req, res) => {
    await service.requestPasswordReset(requestResetSchema.parse(req.body).email);
    res.status(202).json({ status: "accepted" });
  });
  router.post("/reset-password", authLimiter, async (req, res) => {
    const input = resetPasswordSchema.parse(req.body);
    const ok = await service.resetPassword(input.token, input.password);
    res.status(ok ? 200 : 400).json(ok ? { status: "password_changed" } : { error: { code: "INVALID_OR_EXPIRED_TOKEN", message: "Ссылка недействительна или устарела" } });
  });
  router.get("/sessions/current", async (req, res) => {
    const token = req.cookies?.[COOKIE] as string | undefined;
    const session = token ? await service.authenticate(token) : null;
    res.status(session ? 200 : 401).json(session ? { userId: session.user_id, sessionId: session.session_id } : { error: { code: "UNAUTHENTICATED", message: "Требуется вход" } });
  });
  router.post("/logout-all", async (req, res) => {
    const token = req.cookies?.[COOKIE] as string | undefined;
    const session = token ? await service.authenticate(token) : null;
    if (!session) return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Требуется вход" } });
    await service.revokeAll(session.user_id);
    res.clearCookie(COOKIE, cookieOptions).clearCookie(REFRESH_COOKIE, refreshCookieOptions).status(204).end();
  });
  return router;
}
