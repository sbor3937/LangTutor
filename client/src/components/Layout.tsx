import {
  BookOpen,
  ChartNoAxesColumnIncreasing,
  Dumbbell,
  GraduationCap,
  House,
  MessageCircle,
  Settings,
  UserRound,
  UsersRound,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useInternetAccount } from "./InternetApp";
export function Layout() {
  const { me, activeCourse } = useInternetAccount();
  const coursePath = activeCourse ? `/programs/${activeCourse.course_key}` : "/programs";
  const links = [
    ["/", "Главная", House],
    [coursePath, "Уроки", BookOpen],
    ["/programs", "Программы", GraduationCap],
    ["/training", "Тренировка", Dumbbell],
    ["/tutor", "Репетитор", MessageCircle],
    ["/words", "Мои слова", GraduationCap],
    ["/progress", "Прогресс", ChartNoAxesColumnIncreasing],
  ] as const;
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="LangTutor — языковая платформа">
          <span>LT</span>
          <strong>
            LangTutor
            <br />
            <small>учим языки</small>
          </strong>
        </a>
        <NavLink className="profile-switcher" to="/account">
          <UserRound />
          <span>
            <small>{me.email}</small>
            <b>{me.display_name}</b>
          </span>
        </NavLink>
        <nav aria-label="Основная навигация">
          {links.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <NavLink className="settings-link" to="/account">
          <Settings /> Аккаунт
        </NavLink>
        <NavLink className="settings-link" to="/family">
          <UsersRound /> Семья
        </NavLink>
      </aside>
      <main id="content">
        <Outlet />
      </main>
      <nav className="bottom" aria-label="Мобильная навигация">
        {links.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} end={to === "/"}>
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
