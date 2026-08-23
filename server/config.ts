import "dotenv/config";
import path from "node:path";
export const config = {
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 3000),
  dataDir: path.resolve(process.env.DATA_DIR || "./data"),
  databasePath: path.resolve(
    process.env.DATABASE_PATH ||
      path.join(process.env.DATA_DIR || "./data", "langtutor.sqlite"),
  ),
  liveAI: process.env.ENABLE_LIVE_AI === "true",
  openrouterKey: process.env.OPENROUTER_API_KEY || "",
  openrouterModel: process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini",
  openrouterBase:
    process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  proxyUrl: process.env.OPENROUTER_PROXY_URL || "",
  groqKey: process.env.GROQ_API_KEY || "",
  groqModel: process.env.GROQ_WHISPER_MODEL || "whisper-large-v3-turbo",
  groqProxyUrl:
    process.env.GROQ_PROXY_URL || process.env.OPENROUTER_PROXY_URL || "",
  httpsPort: Number(process.env.HTTPS_PORT || 0),
  tlsKeyPath: process.env.TLS_KEY_PATH || "",
  tlsCertPath: process.env.TLS_CERT_PATH || "",
  appUrl: process.env.APP_URL || "http://localhost:3000",
  databaseUrl: process.env.DATABASE_URL || "",
  sessionPepper: process.env.SESSION_PEPPER || "",
  secureCookies: process.env.SECURE_COOKIES !== "false",
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS || 0),
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER || "",
  smtpPassword: process.env.SMTP_PASSWORD || "",
  emailFrom: process.env.EMAIL_FROM || "",
};
