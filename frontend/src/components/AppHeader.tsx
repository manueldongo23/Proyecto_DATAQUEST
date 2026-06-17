import React from 'react';
import { Bell, HelpCircle, Search, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface AppHeaderProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  notificationCount?: number;
  onOpenHelp: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  notificationCount = 0,
  onOpenHelp,
  onOpenNotifications,
  onOpenProfile,
}) => {
  const { user, guestUser, isGuest, getDisplayName } = useAuthStore();

  const initials = (isGuest ? guestUser?.apodo : user?.apodo)?.slice(0, 2).toUpperCase() || 'DQ';
  const role = isGuest ? 'Invitado' : user?.rango || 'Estudiante';

  return (
    <header className="sticky top-0 z-30 mb-5">
      <div className="flex items-center gap-3 border-b border-white/10 bg-[#061a3b] px-4 py-3 text-white shadow-[0_10px_30px_rgba(2,8,23,0.28)] sm:px-5">
        <div className="flex w-full items-center gap-3 sm:gap-4">
          <form
            className="flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              onSearchSubmit();
            }}
          >
            <div className="relative max-w-2xl">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
              <input
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder="Buscar proyectos, lecciones, validaciones..."
                aria-label="Buscar proyectos, lecciones, validaciones"
                className="h-12 w-full rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.08)] pl-11 pr-20 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-cyan-400/50 focus:bg-[rgba(255,255,255,0.12)]"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                <span>⌘</span>
                <span>K</span>
              </div>
            </div>
          </form>

          <div className="hidden lg:flex items-center gap-1 border-l border-white/10 pl-4">
            <button
              type="button"
              onClick={onOpenHelp}
              className="w-11 h-11 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition"
              aria-label="Ayuda"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onOpenNotifications}
              className="relative w-11 h-11 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition"
              aria-label="Notificaciones"
            >
              <Bell className="w-5 h-5" />
              {notificationCount > 0 && (
                <span className="absolute right-1 top-1 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold text-white shadow">
                  {notificationCount}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenProfile}
            className="ml-auto flex items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition hover:bg-white/10"
            aria-label="Abrir perfil"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-sm font-bold shadow-lg shadow-blue-500/20">
              {initials}
            </span>
            <span className="hidden sm:block">
              <span className="block text-sm font-semibold leading-tight text-white">
                {getDisplayName()}
              </span>
              <span className="block text-xs text-slate-300">{role}</span>
            </span>
            <ChevronDown className="hidden sm:block w-4 h-4 text-slate-300" />
          </button>
        </div>
      </div>
    </header>
  );
};
