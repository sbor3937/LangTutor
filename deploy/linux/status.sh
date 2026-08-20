#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; PID="$ROOT/data/italian-tutor.pid"
if [[ -f "$PID" ]] && kill -0 "$(cat "$PID")" 2>/dev/null; then echo "Работает, PID $(cat "$PID")"; curl -fsS "http://127.0.0.1:${PORT:-3000}/api/health"; echo; else echo "Не запущено напрямую"; exit 1; fi
