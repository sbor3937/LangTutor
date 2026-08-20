#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; echo "Сначала вручную отключите systemd unit."
read -r -p "Удалить build и node_modules? [y/N] " app; [[ "$app" =~ ^[Yy]$ ]] && rm -rf -- "$ROOT/dist" "$ROOT/dist-server" "$ROOT/node_modules"
read -r -p "ОТДЕЛЬНО удалить data и backups? Введите DELETE-DATA: " data; [[ "$data" == DELETE-DATA ]] && rm -rf -- "$ROOT/data" "$ROOT/backups" || echo "Данные сохранены."
