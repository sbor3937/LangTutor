const enNumbers = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen","twenty"];
const itNumbers = ["zero","uno","due","tre","quattro","cinque","sei","sette","otto","nove","dieci","undici","dodici","tredici","quattordici","quindici","sedici","diciassette","diciotto","diciannove","venti"];
export function normalizeAnswer(value: string, language: string) {
  let text = value.normalize("NFKC").toLowerCase().replace(/[’‘`]/g, "'");
  if (language.startsWith("en")) {
    const contractions: Record<string,string> = { "i'm":"i am", "you're":"you are", "we're":"we are", "they're":"they are", "he's":"he is", "she's":"she is", "it's":"it is", "isn't":"is not", "aren't":"are not", "wasn't":"was not", "weren't":"were not", "don't":"do not", "doesn't":"does not", "didn't":"did not", "can't":"cannot", "won't":"will not", "couldn't":"could not", "wouldn't":"would not", "shouldn't":"should not", "i've":"i have", "we've":"we have", "you've":"you have", "they've":"they have", "i'll":"i will", "we'll":"we will", "you'll":"you will", "they'll":"they will", "let's":"let us" };
    text = text.replace(/\b[a-z]+'[a-z]+\b/g, token => contractions[token] ?? token)
      .replace(/\bcan not\b/g, "cannot").replace(/\bfavorite\b/g, "favourite")
      .replace(/\bcolor\b/g, "colour").replace(/\bhave got\b(?!\s+to\b)/g, "have");
  }
  const numbers = language.startsWith("en") ? enNumbers : language.startsWith("it") ? itNumbers : [];
  return text.replace(/\b\d+\b/g, token => numbers[Number(token)] ?? token)
    .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/** Deterministic translation matching, not a pronunciation or free-answer AI grade. */
export function scoreAnswer(expected: string, answer: string, language: string, alternatives: string[] = []) {
  const actual = normalizeAnswer(answer, language);
  const accepted = [expected, ...alternatives].map(value => normalizeAnswer(value, language));
  if (actual && accepted.includes(actual)) return { score: 100, correct: true, feedback: "Верно" };
  let similarity = 0;
  for (const candidate of accepted) {
    const a = candidate.split(" "), b = actual.split(" ").filter(Boolean);
    const row = Array<number>(b.length + 1).fill(0);
    for (const word of a) { let previous = 0; for (let j=1;j<=b.length;j++) { const saved=row[j]; row[j]=word===b[j-1]?previous+1:Math.max(row[j],row[j-1]); previous=saved; } }
    similarity = Math.max(similarity, Math.round(100 * row[b.length] / Math.max(a.length, b.length, 1)));
  }
  // Partial credit must not turn a meaning-changing error into a pass.
  const score = Math.min(79, similarity);
  return { score, correct: false, feedback: `Есть отличия. Образец: ${expected} Сравните слова, артикли и порядок слов; можно исправить ответ и повторить.` };
}
