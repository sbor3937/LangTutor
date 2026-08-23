import nodemailer from "nodemailer";
import { config } from "./config.js";
import { IdentityService } from "./identity/service.js";
import { postgresPool } from "./platform/postgres/client.js";

type ClaimedEvent = { event_id: string; user_id: string; event_type: "identity.verification.requested" | "identity.password_reset.requested" };
type EmailMessage = { to: string; subject: string; text: string };

async function updateOutboxEvent(event: ClaimedEvent, sql: string, values: unknown[]) {
  const client = await postgresPool!.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.user_id',$1,true),set_config('app.family_id','',true)", [event.user_id]);
    await client.query(sql, values);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

export async function runEmailOutboxOnce(sender?: (message: EmailMessage) => Promise<void>) {
  if (!postgresPool) throw new Error("DATABASE_URL is required for worker");
  if (!sender && (!config.smtpHost || !config.emailFrom)) throw new Error("SMTP_HOST and EMAIL_FROM are required for worker");
  const claim = await postgresPool.query<ClaimedEvent>("SELECT * FROM platform.claim_identity_email_event()");
  const event = claim.rows[0];
  if (!event) return false;
  const client = await postgresPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.user_id',$1,true),set_config('app.family_id','',true)", [event.user_id]);
    const email = await client.query<{ email_display: string }>("SELECT email_display FROM identity.user_emails WHERE user_id=$1 LIMIT 1", [event.user_id]);
    await client.query("COMMIT");
    if (!email.rows[0]) throw new Error("EMAIL_NOT_FOUND");
    const purpose = event.event_type === "identity.verification.requested" ? "verify_email" : "reset_password";
    const token = await new IdentityService(postgresPool).issueOneTimeToken(event.user_id, purpose);
    const url = new URL(purpose === "verify_email" ? "/verify-email" : "/reset-password", config.appUrl);
    url.searchParams.set("token", token);
    const message = { to: email.rows[0].email_display, subject: purpose === "verify_email" ? "Подтвердите email в LangTutor" : "Сброс пароля LangTutor", text: `${purpose === "verify_email" ? "Подтвердите email" : "Задайте новый пароль"}: ${url.toString()}` };
    if (sender) await sender(message);
    else {
      const transport = nodemailer.createTransport({ host: config.smtpHost, port: config.smtpPort, secure: config.smtpSecure, auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPassword } : undefined });
      await transport.sendMail({ from: config.emailFrom, ...message });
    }
    await updateOutboxEvent(event, "UPDATE platform.outbox_events SET processed_at=now(),locked_at=NULL,last_error_code=NULL WHERE id=$1", [event.event_id]);
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    const code = error instanceof Error ? error.name.slice(0, 80) : "UNKNOWN";
    await updateOutboxEvent(event, "UPDATE platform.outbox_events SET locked_at=NULL,last_error_code=$2 WHERE id=$1", [event.event_id, code]).catch(() => undefined);
    throw error;
  } finally { client.release(); }
}
