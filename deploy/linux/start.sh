#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; cd "$ROOT"; set -a; source .env; set +a
if [[ -f "$ROOT/data/italian-tutor.pid" ]] && kill -0 "$(cat "$ROOT/data/italian-tutor.pid")" 2>/dev/null; then echo "Уже запущено"; exit 0; fi
nohup npm start >>"$ROOT/data/italian-tutor.log" 2>&1 & echo $! >"$ROOT/data/italian-tutor.pid"; echo "Запущено, PID $!"
