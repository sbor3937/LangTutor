#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; cd "$ROOT"
if [[ -d .git ]]; then [[ -z "$(git status --porcelain)" ]] || { echo "Есть локальные изменения; update остановлен."; exit 1; }; git pull --ff-only; fi
"$ROOT/deploy/linux/backup.sh"; npm ci; npm run db:migrate; npm run build
if command -v systemctl >/dev/null && systemctl is-active --quiet italian-tutor; then sudo systemctl restart italian-tutor; else "$ROOT/deploy/linux/stop.sh" || true; "$ROOT/deploy/linux/start.sh"; fi
echo "Обновление завершено."
