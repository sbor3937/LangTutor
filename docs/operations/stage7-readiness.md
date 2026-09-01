# Stage 7 readiness evidence — 2026-08-28

## Пройдено локально

- Privileged PostgreSQL custom-format backup создан, `pg_restore --list` прочитал 447 объектов.
- Restore в отдельную БД завершился с `--exit-on-error`; migration runner повторно прошёл без checksum drift.
- Source/restore parity: 16 migrations, 107 users, 39 families, 3 courses, 25 lessons, 7 AI ledger rows, 17 admin access events.
- Отрицательный runtime probe под FORCE RLS вернул 0 строк другого пользователя.
- AES-256-GCM encrypt/decrypt round-trip сохранил SHA-256 dump.
- Load smoke по восстановленной БД: 500 запросов, concurrency 20, 0 ошибок, p50 57 ms, p95 218 ms, p99 250 ms.
- Production dependencies: `npm audit --omit=dev` — 0 vulnerabilities.
- Runtime image запускается как `node`, Docker healthcheck — `healthy`, readiness видит PostgreSQL.
- Trivy HIGH/CRITICAL gate сначала обнаружил уязвимости во встроенном runtime npm toolchain. npm/npx удалены из runtime layer; повторный scan: Debian 0, application Node packages 0 HIGH/CRITICAL.
- CSP, frame-ancestors, nosniff, referrer и cross-origin headers проверены автоматическим тестом.

## Coolify staging — 2026-09-01

- Создан отдельный Coolify project `LangTutor` и environment `staging`.
- Публичный адрес: `https://langtutor-staging.185.207.1.58.sslip.io` с доверенной TLS-цепочкой.
- Root, `/programs` и `/api/health/ready` возвращают HTTP 200; CSP и HSTS присутствуют.
- PostgreSQL, web и worker работают раздельно; web/PostgreSQL healthy, worker не наследует неприменимый HTTP healthcheck.
- Release job применил 16 migrations и content seed до запуска web/worker.
- Runtime role: `NOBYPASSRLS`; NOLOGIN owner: `BYPASSRLS`; временный `CREATE` authenticator после migrations отозван на всех прикладных schemas.
- Публичный load smoke: 500 запросов, concurrency 20, 0 ошибок, p50 39 ms, p95 830 ms, p99 2310 ms. Gate p95 ≤2000 ms пройден.

## Coolify production — 2026-09-01

- SMTP transport и UTF-8 доставка проверены реальным письмом; verification/reset worker использует server-only credentials из Coolify.
- Production развернут на `https://langmind.sbortech.ru` из коммита `17b50d7`: root, auth, programs, email lifecycle routes, liveness и readiness возвращают HTTP 200 через доверенный TLS; CSP и HSTS присутствуют.
- Production использует отдельные PostgreSQL/Redis volumes и новый комплект DB/session/MFA secrets. Runtime web healthy, PostgreSQL healthy, worker запущен.
- Production E2E: token verification 200, login 200, Italian enrollment 201, каталог содержит 15 уроков, deterministic scoring 100, progress persisted. Отрицательный FORCE RLS probe другого пользователя вернул 0 строк; технические E2E-пользователи затем удалены.
- Production load smoke: 500 запросов к readiness, concurrency 20, 0 ошибок, p50 28 мс, p95 203 мс, p99 277 мс.
- После очистки E2E-данных создан AES-256-GCM backup `production-initial-2026-09-01.ltbk`; `pg_restore --list` прочитал 448 объектов, plaintext удалён.
