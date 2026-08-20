#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; BACKUPS="$(realpath "$ROOT/backups")"; INPUT="${1:-}"
[[ -n "$INPUT" && -f "$INPUT" ]] || { echo "Использование: $0 backups/файл.sqlite"; exit 1; }; SOURCE="$(realpath "$INPUT")"; [[ "$SOURCE" == "$BACKUPS"/* ]] || { echo "Разрешены только файлы из $BACKUPS"; exit 1; }
read -r -p "Остановить сервис и восстановить? Введите RESTORE: " answer; [[ "$answer" == RESTORE ]] || { echo "Отменено"; exit 1; }
set -a; source "$ROOT/.env"; set +a; DB="${DATABASE_PATH:-$ROOT/data/italian-tutor.sqlite}"; "$ROOT/deploy/linux/backup.sh" || true
if command -v systemctl >/dev/null && systemctl is-active --quiet italian-tutor; then sudo systemctl stop italian-tutor; else "$ROOT/deploy/linux/stop.sh" || true; fi
cp -- "$SOURCE" "$DB"; chmod 600 "$DB"; echo "Восстановлено. Запустите сервис."
