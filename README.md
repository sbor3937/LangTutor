# Итальянский с нуля

Локальное адаптивное веб-приложение для русскоязычных учеников A0–A1: onboarding, пять содержательных уроков, карточки, аудирование, произношение с текстовым fallback, итоговая проверка, словарь с интервальным повторением, прогресс и AI-репетитор.

## Быстрый запуск

Нужен Node.js 22–24 (рекомендуется 22 LTS со встроенным `node:sqlite`) и npm.

```bash
npm install
copy .env.example .env    # Windows; Linux: cp .env.example .env
npm run db:migrate
npm run dev
```

Dev UI: `http://127.0.0.1:5173`. Production работает через один порт:

```bash
npm run build
npm start
# http://127.0.0.1:3000
```

Данные находятся в `./data/italian-tutor.sqlite`, SQLite использует foreign keys, WAL и busy timeout. Обновление сборки не удаляет `data/`.

## OpenRouter и ключи

Приложение полностью работает без ключа (`ENABLE_LIVE_AI=false`). Для live AI откройте серверный `.env` и задайте:

```env
ENABLE_LIVE_AI=true
OPENROUTER_API_KEY=ваш_ключ_openrouter
OPENROUTER_MODEL=openai/gpt-4.1-mini
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_PROXY_URL=
```

Ключ вводится только в `.env` на Linux-ПК, не в браузере. После изменения перезапустите сервис. Если провайдер или прокси недоступен, чат автоматически отвечает через Демо AI. В стиле интеграции MeetingMind прокси задаётся отдельно для исходящего OpenRouter-вызова; формат: `http://user:password@host:port`. Используйте ASCII-логин/пароль и ограничьте права файла: `chmod 600 .env`. Ключ не попадает в клиент, экспорт и логи.

## Linux и Docker

Пошаговая установка на `192.168.50.204`, systemd, обновление и восстановление описаны в [deploy/linux/README.md](deploy/linux/README.md). Для LAN: `HOST=0.0.0.0`, открыть с другого устройства `http://192.168.50.204:3000`. По умолчанию `HOST=127.0.0.1`. Публикация в интернет потребует TLS, аутентификации и отдельного reverse proxy.

Docker — дополнительный вариант:

```bash
cp .env.example .env
# в .env: HOST=0.0.0.0, DATABASE_PATH=/app/data/italian-tutor.sqlite
docker compose up -d --build
docker compose ps
```

Именованный volume `italian_data` сохраняет базу после пересборки.

## Резервное копирование и перенос

На Linux используйте `deploy/linux/backup.sh`; скрипт вызывает SQLite online backup, если установлен CLI, и не включает `.env`. Восстановление: `deploy/linux/restore.sh backups/файл.sqlite`. JSON-экспорт/импорт пользовательского прогресса доступен в настройках и также исключает ключи, env и логи.

## Переменные окружения

- `HOST=127.0.0.1`, `PORT=3000` — адрес сервера.
- `DATA_DIR=./data`, `DATABASE_PATH=./data/italian-tutor.sqlite` — хранилище.
- `ENABLE_LIVE_AI=false` — жёсткое отключение внешнего AI.
- `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL` — OpenRouter.
- `OPENROUTER_PROXY_URL` — необязательный HTTP(S)-прокси.
- `APP_URL` — адрес приложения для идентификации OpenRouter.
- `LOG_LEVEL=info` — уровень логирования.

## Рекомендуемый браузер

Chromium/Chrome обычно предоставляет наиболее полный Web Speech API. TTS, итальянские голоса, микрофон и Speech Recognition различаются между браузерами Linux и не гарантируются. На каждом голосовом экране есть текстовый fallback; TTS показывает понятную ошибку. Микрофон применяется только для текущего распознавания, MediaStream и аудиофайлы не сохраняются. Browser Speech Recognition может использовать сервис производителя браузера — для полностью локального сценария используйте текстовый режим.

Сравнение распознанного текста — предварительная учебная подсказка, не профессиональный фонетический анализ.

## Проверка и проблемы

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
curl http://127.0.0.1:3000/api/health
```

- `node:sqlite` не найден: установите Node 22 LTS или новее.
- Нет голоса: установите итальянский голос в ОС/браузере либо продолжайте текстом.
- Микрофон не работает по LAN HTTP: многие браузеры разрешают его только в secure context; используйте localhost на самом ПК или настройте локальный HTTPS reverse proxy.
- `EADDRINUSE`: измените `PORT` или остановите процесс на порту 3000.
- OpenRouter не отвечает: проверьте ключ, баланс, модель и `OPENROUTER_PROXY_URL`; Демо AI останется доступным.
