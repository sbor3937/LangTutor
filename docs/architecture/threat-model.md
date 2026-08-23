# Threat model

## Защищаемые активы

Учётные записи, сессии, прогресс, семейные membership, AI-ключи и proxy credentials, бюджеты, audit trail и административные полномочия.

## Основные угрозы и меры

| Угроза | Обязательная мера |
| --- | --- |
| Подмена `user_id`/`family_id` | Серверная session identity, capability check, FORCE RLS |
| Кража сессии | HttpOnly/Secure/SameSite cookie, rotation, revoke, короткий TTL |
| Credential stuffing | Argon2id, rate limits, унифицированные ошибки, security events |
| Утечка секретов | Envelope encryption, redaction, запрет plaintext readback и логирования |
| Cross-family переход | Одноразовое hashed invitation, re-auth, одна транзакция, audit |
| Повтор offline/import операции | Idempotency key и уникальные ограничения |
| Злоупотребление AI | User/family budgets, concurrency limits, immutable usage ledger |
| Компрометация Super Admin | MFA, короткая отдельная сессия, re-auth, reason и audit |
| Supply-chain атака | Lockfile, CI checks, dependency/container scanning |

Полные AI prompt/response не входят в технические логи. IP и время последнего доступа являются диагностикой, а не доказательством владения.
