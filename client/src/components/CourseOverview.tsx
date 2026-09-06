import { ArrowRight, CheckCircle2, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";

type OverviewLesson = { lesson_key: string; title: string; position: number; content: { minutes: number; goal: string; practices: string[]; words: unknown[] } };
type OverviewProgress = { lesson_key: string; completed: boolean; completion_percent: number };

export function CourseOverview({ courseKey, name, language, lessons, progress }: {
  courseKey: string; name: string; language: string; lessons: OverviewLesson[]; progress: OverviewProgress[];
}) {
  const byLesson = new Map(progress.map(item => [item.lesson_key, item]));
  const completed = lessons.filter(item => byLesson.get(item.lesson_key)?.completed).length;
  const next = lessons.find(item => !byLesson.get(item.lesson_key)?.completed);
  const percent = lessons.length ? Math.round(completed / lessons.length * 100) : 0;
  return <section className="page course-overview">
    <p className="eyebrow">{language} · ВАШ УЧЕБНЫЙ ПЛАН</p>
    <h1>{name}</h1>
    <p className="lead">Каждый урок: карточки и объяснение, аудирование, произношение и итоговая проверка.</p>
    <div className="course-summary">
      <div><span className="summary-label">{next ? "Следующий шаг" : "Курс пройден"}</span><h2>{next?.title ?? "Закрепим изученное"}</h2><p>{next?.content.goal ?? "Повторите сложные темы или потренируйтесь с репетитором."}</p>
        <Link className="button primary" to={next ? `/programs/${courseKey}/lessons/${next.lesson_key}` : "/training"}>{next ? "Продолжить обучение" : "К тренировке"}<ArrowRight aria-hidden="true" /></Link>
      </div>
      <div className="course-completion"><CheckCircle2 aria-hidden="true"/><strong>{completed}<small> / {lessons.length}</small></strong><span>уроков завершено</span><progress value={completed} max={Math.max(lessons.length, 1)} aria-label="Завершённые уроки"/><span>{percent}% программы</span></div>
    </div>
    <div className="course-list-heading"><h2>Все уроки</h2><span>Учитесь в своём темпе</span></div>
    <div className="lesson-list">{lessons.map(lesson => {
      const saved = byLesson.get(lesson.lesson_key);
      const status = saved?.completed ? "Завершён" : saved ? "В процессе" : "Не начат";
      return <article className={`lesson-card ${saved?.completed ? "is-complete" : ""}`} key={lesson.lesson_key}>
        <span className="lesson-number">{lesson.position}</span><div><p className="meta"><Clock3 size={14} aria-hidden="true"/> {lesson.content.minutes} МИН · {lesson.content.words.length} СЛОВ</p><h2>{lesson.title}</h2><p>{lesson.content.goal}</p><div className="tags">{(lesson.content.practices ?? []).map(practice => <span key={practice}>{practice}</span>)}</div><span className="lesson-status">{status} · {saved?.completion_percent ?? 0}%</span></div>
        <Link className="button secondary" aria-label={`${saved?.completed ? "Повторить" : saved ? "Продолжить" : "Начать"}: ${lesson.title}`} to={`/programs/${courseKey}/lessons/${lesson.lesson_key}`}>{saved?.completed ? "Повторить" : saved ? "Продолжить" : "Начать"}<ArrowRight aria-hidden="true"/></Link>
      </article>;
    })}</div>
  </section>;
}
