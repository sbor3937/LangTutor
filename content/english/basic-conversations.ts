import type { ConversationPrompt } from "../types.js";

type Pair = [question: string, modelAnswer: string, tip: string];
const units: Record<string, Pair[]> = {
  "daily-routine": [
    ["What time do you wake up, and when do you get up?", "I wake up at seven and get up ten minutes later.", "Во сколько вы просыпаетесь и встаёте? Ответьте целым предложением с wake up и get up."],
    ["What do you put on before you go out on a cold day?", "I put on my coat and a warm hat before I go out.", "Что вы надеваете перед выходом в холодный день? Используйте put on и go out."],
  ],
  communication: [
    ["What do you say when you cannot hear someone clearly?", "Could you speak up, please?", "Попросите собеседника говорить громче. Используйте speak up."],
    ["When can you call your friend back?", "I can call you back after lunch.", "Назовите удобное время для звонка. Местоимение ставится внутри: call you back."],
  ],
  "work-study": [
    ["What do you do when you do not know an English word?", "I look up the word in a dictionary and write it down.", "Как вы узнаёте значение слова? Используйте look up и write down."],
    ["How do you prepare for a test?", "I go over my notes and work out the answers to practice questions.", "Расскажите о подготовке к проверке знаний. Используйте go over или work out."],
  ],
  "travel-movement": [
    ["What time would you set off for a school trip?", "I would set off at eight in the morning.", "Во сколько вы отправились бы на экскурсию? Используйте set off. Время можно придумать."],
    ["Where do you get on the bus, and where do you get off?", "I get on the bus near the park and get off near the museum.", "Опишите вымышленный маршрут. Используйте get on и get off; настоящий адрес не нужен."],
  ],
  "problems-progress": [
    ["What do you do when you cannot figure out an answer?", "I ask for a hint and carry on. I do not give up.", "Что вы делаете, если не можете разобраться? Используйте carry on или give up."],
    ["What can you do if you run out of paper during a project?", "I ask a friend for a sheet of paper to sort out the problem.", "Придумайте решение проблемы. Постарайтесь использовать sort out."],
  ],
  introductions: [
    ["Hello! What is your name?", "Hello! My name is Alex. Nice to meet you.", "Представьтесь по-английски. Можно использовать вымышленное имя."],
    ["How are you today?", "I am fine, thanks. How are you?", "Ответьте о своём настроении и задайте вопрос в ответ."],
  ],
  "daily-life": [
    ["What do you do in the morning?", "I wake up at seven and have breakfast at home.", "Назовите два утренних действия. Начните с I wake up…"],
    ["When do you study English?", "I study English after school.", "Когда вы занимаетесь английским? Ответьте одним предложением."],
  ],
  questions: [
    ["What do you do at weekends?", "I read books and play board games at weekends.", "Назовите два занятия на выходных."],
    ["You need help with an exercise. What can you ask your teacher?", "Can you help me, please?", "Представьте, что нужна помощь. Задайте вежливый вопрос по-английски."],
  ],
  travel: [
    ["How can I get to the station from here?", "Turn left at the bank. The station is on your right.", "Объясните вымышленный маршрут. Используйте turn left или turn right."],
    ["What can you say if someone speaks too fast?", "Could you repeat that more slowly, please?", "Попросите повторить медленнее."],
  ],
  plans: [
    ["What are you doing tomorrow?", "I am meeting a friend tomorrow afternoon.", "Расскажите о плане на завтра. Можно придумать ситуацию."],
    ["Would you like to meet at six?", "That sounds good. See you tomorrow!", "Согласитесь на встречу или вежливо откажитесь: Sorry, I can't."],
  ],
};
export const basicConversations: Record<string, ConversationPrompt[]> = Object.fromEntries(
  Object.entries(units).map(([key, prompts]) => [key, prompts.map(([question, modelAnswer, tip]) => ({ question, modelAnswer, tip }))]),
);
