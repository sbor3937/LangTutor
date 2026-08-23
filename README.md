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

[`compose.coolify.yml`](deploy/coolify/compose.coolify.yml) — deploy-ready каркас. Он не подключает GitHub, DNS или production автоматически. PostgreSQL и Redis будут включены в этапе 1 вместе с проверяемыми миграциями и readiness.

## Репозитории

- `origin`: `https://github.com/sbor3937/LangTutor.git`
- `upstream`: `https://github.com/sbor3937/ItalianLearent.git`

Legacy systemd-скрипты в `deploy/linux` сохраняются только для сверки и миграции исходного приложения.
