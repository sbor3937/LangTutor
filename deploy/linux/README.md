# Установка на Linux 192.168.50.204

Ориентир: Ubuntu/Debian с systemd, Node.js 22 LTS и npm. Скопируйте проект в `/opt/italian-tutor`, назначьте владельцем отдельного пользователя и запускайте установку от него, не от root.

```bash
sudo useradd --system --create-home --shell /bin/bash italian-tutor
sudo mkdir -p /opt/italian-tutor
sudo chown -R italian-tutor:italian-tutor /opt/italian-tutor
# скопируйте файлы проекта, затем:
sudo -u italian-tutor bash
cd /opt/italian-tutor
chmod +x deploy/linux/*.sh
./deploy/linux/install.sh
```

В `/opt/italian-tutor/.env` оставьте `HOST=0.0.0.0`, чтобы сервис открывался по `http://192.168.50.204:3000`. Это делает его видимым в LAN: не используйте режим в недоверенной сети. Узнать IP: `hostname -I`. Firewall скрипты не меняют; если UFW включён, разрешение порта из доверенной подсети выполняется администратором отдельно.

## systemd

После проверки прямого запуска:

```bash
sudo cp deploy/linux/italian-tutor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable italian-tutor
sudo systemctl start italian-tutor
sudo systemctl status italian-tutor
journalctl -u italian-tutor -f
```

Команды управления без systemd: `start.sh`, `stop.sh`, `status.sh`. Обновление: `update.sh`. Backup: `backup.sh`. Восстановление: `restore.sh backups/имя.sqlite`. Скрипт восстановления принимает файлы только из `backups/`, предварительно сохраняет текущую базу и просит явное подтверждение. `uninstall.sh` отдельно подтверждает удаление данных.

Проверка: `curl -fsS http://127.0.0.1:3000/api/health`. База: `/opt/italian-tutor/data/italian-tutor.sqlite`, права каталогов должны принадлежать `italian-tutor`.
