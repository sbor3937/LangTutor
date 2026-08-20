#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; PID="$ROOT/data/italian-tutor.pid"
[[ -f "$PID" ]] || { echo "PID-файл отсутствует"; exit 0; }; process="$(cat "$PID")"; kill "$process" 2>/dev/null || true; rm -f "$PID"; echo "Остановлено"
