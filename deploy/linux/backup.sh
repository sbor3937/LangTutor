#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; set -a; source "$ROOT/.env"; set +a
DB="${DATABASE_PATH:-$ROOT/data/italian-tutor.sqlite}"; BACKUPS="$ROOT/backups"; mkdir -p "$BACKUPS"; chmod 700 "$BACKUPS"
[[ -f "$DB" ]] || { echo "База не найдена: $DB"; exit 1; }; OUT="$BACKUPS/italian-tutor-$(date +%Y%m%d-%H%M%S).sqlite"
if command -v sqlite3 >/dev/null; then sqlite3 "$DB" ".backup '$OUT'"; else cp -- "$DB" "$OUT"; fi
chmod 600 "$OUT"; echo "Backup: $OUT (секреты не включены)"
