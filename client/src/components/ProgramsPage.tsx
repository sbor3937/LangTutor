import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { z } from "zod";

const catalogSchema = z.object({ courses: z.array(z.object({ key: z.string(), name: z.string(), program_name: z.string(), language_key: z.string(), language_name: z.string(), lesson_count: z.number(), metadata: z.object({ cefr: z.array(z.string()).optional() }) })) });
type Course = z.infer<typeof catalogSchema>["courses"][number];
export function ProgramsPage({ embedded = false, enrolledKeys = [] }: { embedded?: boolean; enrolledKeys?: string[] }) {
  const catalog = useQuery({ queryKey: ["internet-programs"], queryFn: async () => {
    const response = await fetch("/api/v1/learning/catalog", { credentials: "include" });
    if (!response.ok) throw new Error("Не удалось загрузить программы");
    return catalogSchema.parse(await response.json());
  } });
  const Heading = embedded ? "h2" : "h1", LanguageHeading = embedded ? "h3" : "h2", CourseHeading = embedded ? "h4" : "h3";
  const grouped = (catalog.data?.courses ?? []).reduce<Map<string, Course[]>>((result, course) => {
    result.set(course.language_name, [...(result.get(course.language_name) ?? []), course]); return result;
  }, new Map());
  return <section id="learning-programs" className={embedded ? "home-block home-catalog programs-page" : "page programs-page"} aria-labelledby="programs-heading">
    <p className="eyebrow">ВЫБОР КУРСА</p><Heading id="programs-heading">Программы обучения</Heading>
    <p className="lead">Выберите язык и подходящий курс. Начатые программы можно открыть без повторной настройки.</p>
    {catalog.isLoading && <p role="status">Загружаем каталог…</p>}
    {catalog.error && <div role="alert"><p>Не удалось загрузить программы. Попробуйте ещё раз.</p><button onClick={() => void catalog.refetch()}>Повторить</button></div>}
    {!catalog.isLoading && !catalog.error && !grouped.size && <p>Новые программы скоро появятся.</p>}
    {[...grouped].map(([language, courses]) => <section key={language} aria-labelledby={`language-${courses[0].language_key}`}>
      <LanguageHeading id={`language-${courses[0].language_key}`}>{language}</LanguageHeading>
      <div className="program-grid">{courses.map(course => {
        const enrolled = enrolledKeys.includes(course.key);
        return <article key={course.key}><CourseHeading>{course.name}</CourseHeading><p>{course.program_name}</p>
          <p>Уроков: {course.lesson_count}{course.metadata.cefr?.length ? ` · ${course.metadata.cefr.join("–")}` : ""}</p>
          {enrolled && <p className="lesson-status">Уже в моём обучении</p>}
          <Link className="button secondary" to={enrolled ? `/programs/${course.key}` : `/onboarding/${course.key}`}>{enrolled ? "Открыть курс" : "Выбрать программу"}</Link>
        </article>;
      })}</div>
    </section>)}
  </section>;
}
