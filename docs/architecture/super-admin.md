# Super Admin security boundary

`/control` не публикуется в обычной навигации. API расположен в `/api/v1/admin`, имеет отдельный rate limit и не подтверждает наличие панели вошедшему обычному пользователю: проверка admin principal возвращает нейтральный `404`.

Super Admin использует два связанных уровня сессии:

1. Обычная подтверждённая сессия LangTutor.
2. Отдельная `HttpOnly; Secure; SameSite=Strict` cookie после TOTP. Она связана с родительской сессией и живёт не более 15 минут.

TOTP-секрет генерируется сервером, показывается только при enrollment и хранится в PostgreSQL только как AES-256-GCM ciphertext/nonce/tag. Master key `ADMIN_MFA_ENCRYPTION_KEY` находится только в environment и должен быть base64-представлением 32 случайных байтов. Повторное использование TOTP time-step блокируется. Блокировка пользователей, отзыв сессий, изменение AI и feature flags требуют password + новый TOTP; step-up действует две минуты. Причина обязательна и попадает в безопасный audit.

Прямого web-способа назначить Super Admin нет. После регистрации и верификации первый оператор назначается кластерным администратором по проверенному email:

```sql
UPDATE identity.users u
SET is_super_admin=true, updated_at=now()
FROM identity.user_emails e
WHERE e.user_id=u.id AND e.email_normalized=lower('operator@example.com') AND e.verified_at IS NOT NULL;
```

Операцию выполняют через контролируемый release/runbook-сеанс и затем проверяют, что изменена ровно одна строка. Секрет MFA не вводится в SQL и не появляется в audit/application logs.

Admin runtime не получает `BYPASSRLS` или прямое чтение всех tenant-таблиц. Агрегаты пользователей, семей, usage, моделей и событий возвращают узкие `SECURITY DEFINER`-функции, которые внутри повторно проверяют хеш короткой admin-сессии. Plaintext-ключи, prompt/response и credential-bearing proxy URL административный API не возвращает.
