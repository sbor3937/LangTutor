import type { ContentLesson } from "../types.js";

type Unit = { id: string; title: string; rule: string; question: string; items: [string, string][] };
const units: Unit[] = [
  { id: "my-world", title: "О себе — уже целыми предложениями", rule: "Повторим am/is/are, have got и can. I am ten. She is ten. После can глагол без to: I can swim. Расскажи о себе или о придуманном герое; настоящее имя и адрес не нужны.", question: "What can you tell me about your favourite character?", items: [
    ["I am ten years old.", "Мне десять лет."], ["My favourite subject is English.", "Мой любимый предмет — английский."], ["I have got a younger sister.", "У меня есть младшая сестра."], ["I can ride a bike.", "Я умею кататься на велосипеде."], ["We are good friends.", "Мы хорошие друзья."],
  ] },
  { id: "school-day", title: "Школьный день и расписание", rule: "Present Simple — привычки. I start, но she starts. Время: at half past eight — в половине девятого. Сначала расскажи свой день, затем день друга с he или she.", question: "What do you do on a school day?", items: [
    ["I get up at seven.", "Я встаю в семь."], ["Lessons start at half past eight.", "Уроки начинаются в половине девятого."], ["She walks to school.", "Она ходит в школу пешком."], ["We have lunch at school.", "Мы обедаем в школе."], ["I do my homework after school.", "Я делаю домашнюю работу после школы."],
  ] },
  { id: "ask-a-friend", title: "Интервью с другом", rule: "Вопрос: Do you like…? / Does she like…? После does окончание -s у смыслового глагола исчезает. Отрицание: don't / doesn't. Задай вопрос и уточни Why? — Почему?", question: "What questions can you ask a new classmate?", items: [
    ["Do you like board games?", "Ты любишь настольные игры?"], ["What does she do after school?", "Что она делает после школы?"], ["He doesn't play tennis.", "Он не играет в теннис."], ["I don't like getting up early.", "Я не люблю рано вставать."], ["Why do you like this book?", "Почему тебе нравится эта книга?"],
  ] },
  { id: "happening-now", title: "Что происходит на картинке?", rule: "Сейчас: am/is/are + глагол с -ing. Обычно: Present Simple. Сравни I read every day и I am reading now. Нарисуй парк и расскажи о трёх героях.", question: "Imagine a busy park. What are the people doing?", items: [
    ["I am reading a comic now.", "Я сейчас читаю комикс."], ["She is playing with her dog.", "Она играет со своей собакой."], ["They are riding their bikes.", "Они катаются на велосипедах."], ["He isn't watching TV.", "Он не смотрит телевизор."], ["What are you doing?", "Что ты делаешь сейчас?"],
  ] },
  { id: "room-detective", title: "Детектив в комнате", rule: "There is — один предмет, there are — несколько. Используй behind, between, next to. Спрячь воображаемую игрушку и дай репетитору три подсказки.", question: "Where is the missing toy in your imaginary room?", items: [
    ["There is a lamp on the desk.", "На письменном столе есть лампа."], ["There are two books under the chair.", "Под стулом две книги."], ["The toy is behind the door.", "Игрушка за дверью."], ["The desk is next to the window.", "Письменный стол рядом с окном."], ["Is there a ball in the box?", "В коробке есть мяч?"],
  ] },
  { id: "picnic-shop", title: "Покупки для пикника", rule: "Some — немного/несколько в утверждении, any — обычно в вопросе или отрицании. Apples можно посчитать, water — нет. Вежливая просьба: I'd like… Разыграйте магазин.", question: "What would you buy for a picnic with friends?", items: [
    ["I'd like some apples, please.", "Я хотел бы несколько яблок, пожалуйста."], ["Have we got any water?", "У нас есть вода?"], ["There isn't any milk.", "Молока нет."], ["How much is this sandwich?", "Сколько стоит этот сэндвич?"], ["We need three bottles of water.", "Нам нужны три бутылки воды."],
  ] },
  { id: "animal-experts", title: "Сравниваем животных", rule: "Короткое прилагательное + -er + than: faster than. Длинное: more interesting. Особые формы: good — better, bad — worse. Сравни двух животных и объясни свой выбор.", question: "Which two animals would you compare, and why?", items: [
    ["An elephant is bigger than a horse.", "Слон больше лошади."], ["A cheetah is faster than a lion.", "Гепард быстрее льва."], ["This story is more interesting.", "Эта история интереснее."], ["My drawing is better today.", "Сегодня мой рисунок лучше."], ["Which animal is the tallest?", "Какое животное самое высокое?"],
  ] },
  { id: "yesterday-story", title: "История о вчерашнем дне", rule: "Past Simple: yesterday, last weekend. Обычный глагол + -ed: played; особые формы: go — went, see — saw. После did/didn't возвращается начальная форма: Did you go? Расскажи три события по порядку.", question: "What happened on an imaginary weekend adventure?", items: [
    ["I was at the park yesterday.", "Вчера я был в парке."], ["We played a board game.", "Мы играли в настольную игру."], ["She went to the zoo.", "Она ходила в зоопарк."], ["I didn't watch TV yesterday.", "Вчера я не смотрел телевизор."], ["Did you see a tiger?", "Ты видел тигра?"],
  ] },
  { id: "weekend-planners", title: "Планируем выходные", rule: "План: am/is/are going to + глагол. Предложение: Let's + глагол. Добавь when, where и with whom. Время и место можно выдумать.", question: "What are you going to do on your perfect weekend?", items: [
    ["I am going to visit my cousin.", "Я собираюсь навестить двоюродного брата."], ["We are going to make a cake.", "Мы собираемся приготовить торт."], ["What are you going to do tomorrow?", "Что ты собираешься делать завтра?"], ["Let's meet at the playground.", "Давай встретимся на детской площадке."], ["That sounds like a good idea.", "Это звучит как хорошая идея."],
  ] },
  { id: "kind-team", title: "Команда друзей и первые phrasal verbs", rule: "Учим выражение целиком: help out, cheer up, put away, look after, give up. У разделяемого put away местоимение внутри: put it away. Попроси о помощи и предложи помощь в ответ.", question: "How can your team help a new pupil feel welcome?", items: [
    ["I can help out after class.", "Я могу помочь после урока."], ["Let's cheer him up.", "Давай его подбодрим."], ["Please put your books away.", "Пожалуйста, убери свои книги."], ["We look after our class pet.", "Мы заботимся о питомце нашего класса."], ["Don't give up!", "Не сдавайся!"],
  ] },
  { id: "story-club", title: "Клуб историй: сначала, потом, потому что", rule: "Свяжи предложения: first, then, after that, finally. Because объясняет причину, but — противопоставление. Придумай короткую историю из пяти предложений; ошибки — повод для подсказки, не для остановки.", question: "Can you tell a five-sentence story about finding a lost toy?", items: [
    ["First, we looked in the garden.", "Сначала мы посмотрели в саду."], ["Then we asked our friend.", "Потом мы спросили нашего друга."], ["I was happy because we found it.", "Я был счастлив, потому что мы это нашли."], ["It was small but very special.", "Это было маленькое, но очень особенное."], ["Finally, we went home together.", "Наконец мы вместе пошли домой."],
  ] },
  { id: "junior-mission", title: "Финальная миссия: экскурсия для друга", rule: "Соедини знакомые времена: привычка, сейчас, вчера и план. Объясни маршрут и правила безопасности. Репетитор задаёт по одному вопросу и помогает исправить одну ошибку за раз.", question: "Show an imaginary friend around your town and plan a day together.", items: [
    ["Turn left at the library.", "Поверни налево у библиотеки."], ["You must wait for the green light.", "Ты должен дождаться зелёного света."], ["We usually come here on Sundays.", "Обычно мы приходим сюда по воскресеньям."], ["Yesterday we visited the museum.", "Вчера мы посетили музей."], ["Tomorrow we are going to play outside.", "Завтра мы собираемся играть на улице."],
  ] },
];
export const juniorLessons: ContentLesson[] = units.map((unit, index) => ({
  id: unit.id, number: index + 1, title: unit.title, minutes: 15, goal: unit.question,
  explanation: unit.rule, practices: ["Карточки", "Аудирование", "Произношение", "Проверка", "Разговорная миссия"],
  words: unit.items.map(([target, source]) => ({ target, source, example: target, hint: unit.rule })),
  conversation: [{ question: unit.question, modelAnswer: unit.items[0][0], tip: "Составь 2–4 предложения. Образец — только начало: добавь свои детали. Можно отвечать о вымышленном герое. Затем попроси взрослого задать уточняющий вопрос." }],
}));
