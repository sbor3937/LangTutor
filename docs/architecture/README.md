# Архитектура LangTutor

Архитектурные решения фиксируются ADR и меняются новым ADR, а не молчаливым редактированием истории.

- [ADR-0001: модульный монолит](ADR-0001-modular-monolith.md)
- [ADR-0002: identity и tenant isolation](ADR-0002-identity-and-tenant-isolation.md)
- [ADR-0003: совместимая миграция ItalianLearent](ADR-0003-italianlearent-migration.md)
- [Threat model](threat-model.md)

Целевые серверные модули: `identity`, `families`, `learning`, `ai`, `audit`, `admin`, `platform`. Модули взаимодействуют через явные application services и события outbox; прямой доступ к чужим таблицам запрещён на уровне code review и тестов.
