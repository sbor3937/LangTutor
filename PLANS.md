# План реализации LangTutor

## Канонические решения

- Модульный монолит: единый web/API и отдельный worker.
- Drizzle и явные PostgreSQL SQL-миграции; без Prisma.
- Пользователь владеет учебными данными; семья владеет общими настройками, лимитами и секретами.
- Серверная capability-авторизация дополняется PostgreSQL FORCE RLS.
- Demo AI Provider обязателен.
- Импорт ItalianLearent сохраняет UUID и является идемпотентным.

## Этапы

0. [done] Fork, branding, CI, container/Coolify scaffold, ADR.
1. [done] PostgreSQL identity, sessions, email lifecycle, RLS, security tests.
2. [done] Families, capabilities, invitations, migrations between families, audit.
3. [done] Versioned Italian content pack, enrolments, progress, scoring, SQLite import.
4. [done] AI Gateway, Demo/OpenRouter, routing, budgets and usage ledger.
5. [done] MFA-protected Super Admin boundary.
6. English core and Phrasal Verbs; extensibility validation.
7. Backup/restore, load and security review, staging and gated production release.

Каждый этап завершается проверками и отдельным коммитом. Production activation допускается только после backup/restore и security gates этапа 7.
