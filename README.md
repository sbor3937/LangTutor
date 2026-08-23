# LangTutor

LangTutor — security-first многопользовательская платформа изучения языков. Первый совместимый учебный контур — итальянский A0–A1 из ItalianLearent. Целевая архитектура: React 19, Express 5, TypeScript strict, PostgreSQL 17 с FORCE RLS, Redis и отдельный worker.

## Текущее состояние

Репозиторий находится в миграции от локального ItalianLearent к интернет-сервису. На этапе 0 сохранён работающий SQLite-контур для проверки функциональной совместимости. Он не считается production identity или tenant boundary. Решения и границы модулей находятся в [`docs/architecture`](docs/architecture).

## Локальный запуск совместимого контура

Нужен Node.js 22–24.

```bash
npm install
copy .env.example .env
npm run db:migrate
npm run dev
```

UI: `http://127.0.0.1:5173`. Production server:

```bash
npm run build
npm start
```

## Проверки

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

После запуска production server readiness совместимого контура проверяется через `GET /api/health`.

## Безопасность

- Секреты доступны только серверу и не попадают в клиент, экспорт и логи.
- Demo AI работает без внешних ключей.
- `anonymousId`, семейный код, IP и `last_seen_at` не являются интернет-аутентификацией.
- Пользовательское аудио, Blob и MediaStream не сохраняются.
- Целевые tenant-таблицы используют PostgreSQL RLS и отдельную runtime-role без `BYPASSRLS`.
- Не добавляйте реальные секреты в `.env.example`, issues, CI output или диагностические команды.

## Контейнер

```bash
docker compose up -d --build
docker compose ps
```

[`compose.coolify.yml`](deploy/coolify/compose.coolify.yml) — deploy-ready каркас с PostgreSQL 17, Redis и readiness. Он не подключает GitHub, DNS или production автоматически.

## PostgreSQL identity

PostgreSQL использует разделённые роли `langtutor_owner`, `langtutor_migrator`, узкую `langtutor_authenticator` для SECURITY DEFINER lookup-функций и `langtutor_runtime` с `NOBYPASSRLS`. Bootstrap ролей выполняется администратором из `deploy/postgres/bootstrap-roles.sql`; пароли назначаются только через secret manager.

```bash
# web process
DATABASE_URL=postgresql://langtutor_runtime:...@postgres:5432/langtutor
# release migration job; не передавать web process
MIGRATION_DATABASE_URL=postgresql://... npm run pg:migrate
```

Регистрация создаёт безопасное outbox-событие без plaintext-токена. Email worker выпускает одноразовый токен непосредственно перед отправкой. До подключения транспорта токены не выводятся в API или логи.

## Семейные пространства

Семья хранит общие настройки и права, но не владеет учебным прогрессом. Роли `owner`, `admin`, `guardian`, `member`, `child` преобразуются в централизованные capabilities. Приглашение одноразовое и действует 7 дней; принятие требует повторного ввода пароля. Переход закрывает старую membership и создаёт новую в одной транзакции, сохраняя `user_id`. Единственный owner сначала передаёт владение другому участнику. Все изменения пишутся в безопасный tenant-scoped audit без токенов и секретов.

## Учебные данные и импорт

Итальянский курс расположен в `content/italian/a0-a1/v1` и регистрируется командой `npm run content:seed`. Progress, attempts, skill scores, vocabulary и review schedule принадлежат `user_id`, поэтому смена семьи их не перемещает и не переписывает.

Импорт старого SQLite запускается только после создания аккаунта и явного сопоставления legacy UUID:

```bash
DATABASE_URL=postgresql://langtutor_runtime:... npm run legacy:import -- source.sqlite LEGACY_UUID USER_UUID ./backups/legacy-import
```

Импортер проверяет SQLite, создаёт и повторно проверяет backup, использует стабильные IDs, фиксирует SHA-256 fingerprint и parity counts. Повторный запуск с тем же источником является no-op. Исходный SQLite не изменяется и не удаляется.

## Репозитории

- `origin`: `https://github.com/sbor3937/LangTutor.git`
- `upstream`: `https://github.com/sbor3937/ItalianLearent.git`

Legacy systemd-скрипты в `deploy/linux` сохраняются только для сверки и миграции исходного приложения.
