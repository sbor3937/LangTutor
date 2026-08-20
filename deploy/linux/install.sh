#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$(uname -s)" == Linux ]] || { echo "Этот установщик предназначен для Linux"; exit 1; }
[[ "${EUID}" -ne 0 ]] || { echo "Не запускайте проект от root."; exit 1; }
command -v node >/dev/null && command -v npm >/dev/null || { echo "Нужны Node.js 20/22 LTS и npm."; exit 1; }
major="$(node -p 'process.versions.node.split(`.`)[0]')"; (( major >= 20 && major < 26 )) || { echo "Нужен Node.js 20–24; найден $(node -v)"; exit 1; }
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; cd "$ROOT"
npm ci; mkdir -p "$ROOT/data"; chmod 700 "$ROOT/data"
[[ -f "$ROOT/.env" ]] || { cp "$ROOT/deploy/linux/italian-tutor.env.example" "$ROOT/.env"; chmod 600 "$ROOT/.env"; echo "Создан $ROOT/.env"; }
npm run db:migrate; npm run db:seed; npm run build
echo "Готово. Запуск: $ROOT/deploy/linux/start.sh"
echo "Для автозапуска установите unit вручную по deploy/linux/README.md."
