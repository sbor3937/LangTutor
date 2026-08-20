# План реализации

## Состояние и решения

Исходный репозиторий пуст. Выбран React 19 + Vite, Express 5, Zod и SQLite (`better-sqlite3`). Production сервер раздаёт SPA и API на одном порту. Анонимный ID хранится в браузере, основные данные — в SQLite, очередь несохранённых изменений — в localStorage.

Live AI использует OpenAI-совместимый API OpenRouter только с backend. По образцу MeetingMind поддерживается отдельный outbound proxy URL, timeout, тест соединения, маскирование секретов и безопасный fallback. TTS/STT — браузерные адаптеры с полноценным текстовым режимом.

## Этапы и критерии

1. Основа, модели и миграции; health и persistence.
2. Адаптивный UI, onboarding, dashboard, 5 содержательных уроков.
3. Аудирование, произношение, shadowing и анализ текста.
4. Demo/live tutor, словарь, интервалы, прогресс, import/export.
5. Native Linux/systemd, Docker, backup/restore/update.
6. `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`, production healthcheck.

Риски: Web Speech API и итальянские голоса зависят от браузера; текстовый fallback обязателен. systemd проверяется статически на Windows, фактическая установка выполняется на Linux 192.168.50.204. Firewall не меняется автоматически.
