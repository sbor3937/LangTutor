# Расширяемые content packs

Опубликованный pack реализует единый контракт `ContentPack`: стабильные ключи language/program/course/lesson, локали, шкала уровня, prerequisites, навыки, версию scoring policy, unlock rules, AI scenarios и generic `target/source` для учебных единиц. Seeder не содержит названий или ветвлений конкретного языка и создаёт детерминированные UUID.

На этапе 6 опубликованы три независимых курса:

- `italian-a0-a1` в программе `italian-general`;
- `english-core-a0-a1` в программе `english-general`;
- `english-phrasal-verbs-a2-b1` в отдельной программе `english-phrasal-verbs`.

Phrasal Verbs не является условием внутри English UI: программа регистрируется и проходит enroll/progress/attempt/scoring теми же API. Каталог `/api/v1/learning/catalog` и страница `/programs` группируют курсы по данным реестра.

Китайский представлен только `planned` manifest со стабильными ключами. Seeder его не публикует, поэтому пользователь не видит пустой курс. Контент, TTS и языковые правила остаются отложенными согласно DEFER.
