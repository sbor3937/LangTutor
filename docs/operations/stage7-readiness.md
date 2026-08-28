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

## Внешний gate

`langmind.sbortech.ru` резолвится в `185.207.1.58`, но проверенный TLS-клиент не доверяет текущей цепочке. Диагностический запрос без проверки сертификата получает `503 no available server`; `/api/health/ready` недоступен. В локальном environment нет Coolify API credential и нет SSH alias для этого VPS, поэтому staging migration, secret provisioning, TLS issuance и production deploy не выполнялись.

До получения доступа нельзя считать этап 7 или production acceptance завершёнными. Для продолжения нужен Coolify API URL/token либо SSH-доступ, переданный через защищённый secret mechanism, а также выбранный staging hostname. Секрет нельзя присылать в чат или коммитить.
