import type { ContentPack, ContentWord, ConversationPrompt } from "./types.js";
import { exampleTranslations } from "./example-translations.js";

const italianExamples: Record<string, [string, string]> = {
  "Vorrei…": ["Vorrei un caffè, per favore.", "Я хотел бы кофе, пожалуйста."],
  "un caffè": ["Un caffè, per favore.", "Кофе, пожалуйста."],
  "un’acqua": ["Vorrei un’acqua, per favore.", "Я хотел бы воды, пожалуйста."],
  "per favore": ["Un tè, per favore.", "Чай, пожалуйста."],
  "il conto": ["Il conto, per favore.", "Счёт, пожалуйста."],
  "Quanto costa?": ["Quanto costa questo libro?", "Сколько стоит эта книга?"],
  "Grazie": ["Grazie per l’aiuto!", "Спасибо за помощь!"],
  "Prego": ["Prego, si accomodi.", "Пожалуйста, присаживайтесь."],
  "Dov’è…?": ["Dov’è la stazione?", "Где находится вокзал?"],
  "la stazione": ["La stazione è qui vicino.", "Вокзал здесь рядом."],
  "il biglietto": ["Vorrei un biglietto per Roma.", "Я хотел бы билет до Рима."],
  "l’autobus": ["Dov’è l’autobus?", "Где автобус?"],
  "a destra": ["Giri a destra.", "Поверните направо."],
  "a sinistra": ["Giri a sinistra.", "Поверните налево."],
  "vicino": ["Il museo è vicino.", "Музей близко."],
  "lontano": ["Il museo è lontano.", "Музей далеко."],
  "Che ore sono?": ["Scusi, che ore sono?", "Извините, который час?"],
  "È l’una": ["È l’una.", "Сейчас час."],
  "Sono le due": ["Sono le due.", "Сейчас два часа."],
  "A che ora?": ["A che ora ci vediamo?", "Во сколько мы встречаемся?"],
  "alle tre": ["Ci vediamo alle tre.", "Увидимся в три часа."],
  "oggi": ["Ci vediamo oggi.", "Увидимся сегодня."],
  "domani": ["Ci vediamo domani.", "Увидимся завтра."],
  "la sera": ["Studio italiano la sera.", "По вечерам я учу итальянский."],
  "Mi piace…": ["Mi piace la pizza.", "Мне нравится пицца."],
  "Non mi piace…": ["Non mi piace il formaggio.", "Мне не нравится сыр."],
  "Vorrei mangiare…": ["Vorrei mangiare una pizza.", "Я хотел бы съесть пиццу."],
  "Abito a…": ["Abito a Roma.", "Я живу в Риме."],
  "la camera numero…": ["La camera numero cinque è qui.", "Номер пять находится здесь."],
};
const pointOut: ConversationPrompt[] = [
  { question: "You notice a mistake in a friend's homework. How can you point it out politely?", modelAnswer: "Can I point out a small mistake in this sentence?", tip: "Вежливо укажите на небольшую ошибку. Используйте point out." },
  { question: "How would you ask a guide to point out the station on a map?", modelAnswer: "Could you point out the station on this map, please?", tip: "Попросите показать вокзал на карте с помощью point out." },
  { question: "Your friend missed an important detail. How would you point it out?", modelAnswer: "I'd like to point out that the museum closes at five.", tip: "Обратите внимание друга на время закрытия. После point out that можно поставить целое предложение." },
  { question: "Your teacher notices a mistake. Use point out to tell a friend what happened.", modelAnswer: "My teacher pointed out a mistake in my homework.", tip: "Расскажите о прошлом: point → pointed. Не нужно повторять образец дословно." },
];
const plain = (s: string) => s.replace(/[.!?…]/g, "").trim();

export function enrichPack(pack: ContentPack): ContentPack {
  return { ...pack, lessons: pack.lessons.map(lesson => ({ ...lesson, words: lesson.words.map(original => {
    const word: ContentWord = { ...original };
    if (pack.languageKey === "it" && italianExamples[word.target]) {
      [word.example, word.exampleTranslation] = italianExamples[word.target];
    } else if (pack.languageKey === "it" && lesson.id === "reading") {
      word.exampleTranslation = `Слово «${word.source}».`;
    } else if (pack.languageKey === "it" && lesson.id === "numbers") {
      const number = Number(word.source);
      if (number === 1) word.example = "Ho un libro.";
      word.exampleTranslation = `У меня ${number} ${number === 1 ? "книга" : number >= 2 && number <= 4 ? "книги" : "книг"}.`;
    } else {
      word.exampleTranslation = exampleTranslations[word.example] ?? (plain(word.example) === plain(word.target) ? word.source : undefined);
    }
    if (!word.exampleTranslation) throw new Error(`Missing example translation: ${pack.courseKey}/${lesson.id}/${word.target}`);
    const en = pack.languageKey === "en";
    const existing = (lesson.conversation ?? []).filter(prompt => prompt.modelAnswer === word.example);
    const gap = word.example.replace(/[\p{L}\p{N}]+(?=[^\p{L}\p{N}]*$)/u, "___");
    const practice: ConversationPrompt[] = [
      { question: en ? "How would you say the sentence in the hint in English?" : "Come si dice in italiano?",
        modelAnswer: word.example, tip: `Переведите: «${word.exampleTranslation}» Используйте выражение карточки: ${word.target}.` },
      { question: en ? `Complete the sentence and say it in full: ${gap}` : `Completa la frase: ${gap}`,
        modelAnswer: word.example, tip: `Восстановите фразу целиком. Смысл: «${word.exampleTranslation}».` },
      { question: en ? `Can you give your own example with “${word.target}”?` : `Puoi fare un esempio con «${word.target}»?`,
        modelAnswer: word.example, tip: `Придумайте ситуацию с «${word.target}» (${word.source}). Можно говорить о вымышленном герое. Образец — лишь один из вариантов.` },
    ];
    word.conversation = en && word.target === "point out" ? pointOut : [...existing, ...practice];
    return word;
  }) })) };
}
