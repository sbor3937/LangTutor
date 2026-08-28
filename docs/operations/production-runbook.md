# Staging и production runbook

## Изоляция окружений

Один и тот же `deploy/coolify/compose.coolify.yml` подключается в двух разных Coolify projects. Staging и production обязаны иметь разные PostgreSQL/Redis volumes, домены и наборы secrets. Production-домен — `langmind.sbortech.ru`; staging-домен назначается оператором до deploy. Web использует только runtime DSN, release command — отдельный migration DSN.

## Backup

Backup выполняется ролью `postgres`/BYPASSRLS, потому что runtime dump под FORCE RLS неполон. Последовательность: `pg_dump -Fc` → `pg_restore --list` → AES-256-GCM encryption командой `scripts/backup-crypto.mjs` → отправка ciphertext в отдельное backup storage → удаление plaintext. `BACKUP_ENCRYPTION_KEY` хранится только в Coolify secret store. Retention: 7 daily / 4 weekly / 6 monthly.

Restore drill выполняется в новой БД: decrypt во временный файл с правами 0600, `pg_restore --exit-on-error`, сравнение количества migrations/users/families/courses/lessons/usage/audit и отрицательный RLS probe. Временная БД и plaintext удаляются после фиксации результата. `pg_restore --list` проверяется при каждом backup, полный restore — ежеквартально и перед опасными миграциями.

## Release gate

1. CI: lint, оба typecheck, unit/API/RLS tests, build и container build.
2. `npm audit --omit=dev`, image vulnerability scan без вывода environment.
3. Deploy immutable image в staging.
4. Отдельно запустить профиль `release`: он выполняет скомпилированные migration runner и content seed под `MIGRATION_DATABASE_URL`.
5. Проверить `/api/health/live`, `/api/health/ready`, auth, Demo AI, tenant isolation, `/programs` и `/control` MFA.
6. Выполнить `scripts/load-smoke.mjs`; gate: error rate ≤1%, p95 ≤2000 ms.
7. Создать и проверить pre-production backup.
8. Только после ручного подтверждения переключить production image. Rollback откатывает image, но не схему.
9. Проверить HTTPS, HSTS, static assets, auth и readiness с публичного адреса.

DNS, TLS, Coolify secrets и назначение первого Super Admin не автоматизируются из приложения. Plaintext secrets, полный `docker inspect` и дамп environment запрещены в диагностике.
