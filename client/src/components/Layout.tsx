import {
  BookOpen,
  ChartNoAxesColumnIncreasing,
  Dumbbell,
  GraduationCap,
  House,
  MessageCircle,
  Settings,
  UserRound,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { anonymousId, api } from "../lib/api";
import { upsertProfile } from "../lib/profiles";
const links = [
  ["/", "Главная", House],
  ["/lessons", "Уроки", BookOpen],
  ["/training", "Тренировка", Dumbbell],
  ["/tutor", "Репетитор", MessageCircle],
  ["/words", "Мои слова", GraduationCap],
  ["/progress", "Прогресс", ChartNoAxesColumnIncreasing],
] as const;
export function Layout() {
  const activeId = anonymousId();
  const { data: profile } = useQuery({
    queryKey: ["layout-profile", activeId],
    queryFn: () => api<any>(`/api/profile/${activeId}`),
  });
  useEffect(() => {
    if (profile?.name)
      upsertProfile(activeId, { name: profile.name, onboarded: true });
  }, [activeId, profile?.name]);
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Итальянский с нуля">
          <span>IT</span>
          <strong>
            Итальянский
            <br />
            <small>с нуля</small>
          </strong>
        </a>
        <NavLink className="profile-switcher" to="/profiles">
          <UserRound />
          <span>
            <small>Текущий профиль</small>
            <b>{profile?.name || "Выбрать пользователя"}</b>
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
        <NavLink className="settings-link" to="/settings">
          <Settings /> Настройки
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
