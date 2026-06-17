import React, { useState } from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  DatabaseZap,
  GraduationCap,
  ShieldCheck,
  Swords,
  BookOpen,
  BarChart3,
  History,
  Settings2,
  LogOut,
  UserPlus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { ViewType } from '../types';
import { useAuthStore } from '../store/authStore';
import { LocaleSwitcher } from './LocaleSwitcher';

interface SidebarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  onOpenAuthModal: () => void;
}

const navItems: { id: ViewType; icon: React.ReactNode; label: string; requiresAuth?: boolean; ariaLabel?: string }[] = [
  { id: 'dashboard', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Inicio' },
  { id: 'projects', icon: <FolderKanban className="w-5 h-5" />, label: 'Proyectos', requiresAuth: true },
  { id: 'normalization', icon: <DatabaseZap className="w-5 h-5" />, label: 'Normalizer Engine', requiresAuth: true, ariaLabel: 'Normalización y laboratorio' },
  { id: 'academy', icon: <GraduationCap className="w-5 h-5" />, label: 'Academy', requiresAuth: true },
  { id: 'validator', icon: <ShieldCheck className="w-5 h-5" />, label: 'Validador', requiresAuth: true },
  { id: 'dataquest', icon: <Swords className="w-5 h-5" />, label: 'Retos', requiresAuth: true, ariaLabel: 'Retos y DataQuest' },
  { id: 'glossary', icon: <BookOpen className="w-5 h-5" />, label: 'Biblioteca' },
  { id: 'reports', icon: <BarChart3 className="w-5 h-5" />, label: 'Reportes', requiresAuth: true },
  { id: 'history', icon: <History className="w-5 h-5" />, label: 'Historial', requiresAuth: true },
  { id: 'settings', icon: <Settings2 className="w-5 h-5" />, label: 'Ajustes', requiresAuth: true },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, onOpenAuthModal }) => {
  const { user, isGuest, getDisplayName, logout } = useAuthStore();
  const isAuthenticated = !!user;
  const [collapsed, setCollapsed] = useState(false);

  const handleNavClick = (viewId: ViewType) => {
    if (navItems.find(item => item.id === viewId)?.requiresAuth && isGuest) {
      return;
    }
    onNavigate(viewId);
  };

  return (
    <aside
      className="sidebar"
      style={{ width: collapsed ? '72px' : 'var(--sidebar-w)' }}
    >
      {/* Logo */}
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xl shadow-lg shadow-indigo-500/30 flex-shrink-0">
              🎓
            </div>
            <div>
              <h1 className="text-white font-bold text-lg tracking-tight leading-tight">DataQuest</h1>
              <p className="text-xs text-slate-500 font-medium">Normalization Lab</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xl shadow-lg mx-auto">
            🎓
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
          title={collapsed ? 'Expandir' : 'Colapsar'}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" aria-hidden="true" /> : <ChevronLeft className="w-4 h-4" aria-hidden="true" />}
        </button>
      </div>

      {/* Divider */}
      <div className="mx-4 mb-3 border-t border-slate-700/50" />

      {/* Nav Items */}
      <nav className="flex-1 px-3 space-y-1 stagger" role="navigation" aria-label="Navegación principal">
        {!collapsed && (
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            Panel Principal
          </p>
        )}
        {navItems.map((item) => {
          const isProtected = item.requiresAuth && isGuest;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              disabled={isProtected}
              title={isProtected ? 'Solo para usuarios registrados' : item.label}
              aria-label={item.ariaLabel || item.label}
              aria-current={currentView === item.id ? 'page' : undefined}
              className={`sidebar-link relative w-full text-left animate-slide-left transition-all ${
                currentView === item.id ? 'active' : ''
              } ${isProtected ? 'opacity-50 cursor-not-allowed' : ''} ${
                collapsed ? 'justify-center px-2' : ''
              }`}
            >
              <span className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-indigo-400" aria-hidden="true">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && isProtected && <span className="ml-auto text-xs text-cyan-400">🔒</span>}
              {!collapsed && currentView === item.id && !isProtected && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse-glow" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 my-3 border-t border-slate-700/50" />

      {/* Locale Switcher */}
      {!collapsed && (
        <div className="px-4 mb-3">
          <div className="flex items-center justify-center">
            <LocaleSwitcher />
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="mx-4 my-3 border-t border-slate-700/50" />

      {/* User Info */}
      <div className="px-4 pb-5">
        <div className={`flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors group ${collapsed ? 'justify-center' : ''}`}>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md flex-shrink-0 ${
            isAuthenticated
              ? 'bg-gradient-to-br from-emerald-400 to-cyan-500'
              : 'bg-gradient-to-br from-yellow-400 to-orange-500'
          }`}>
            {isGuest ? '👤' : user?.apodo.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 font-medium truncate">{getDisplayName()}</p>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  {isAuthenticated ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      {user?.rango} ({user?.xp} XP)
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
                      Invitado
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={logout}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        {/* Guest banner */}
        {isGuest && !collapsed && (
          <div className="mt-3 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-center">
            <p className="text-xs text-cyan-300 font-medium mb-2">
              Modo Invitado: acceso limitado
            </p>
            <button
              className="text-xs text-indigo-300 hover:text-indigo-200 font-semibold flex items-center gap-1 mx-auto transition-colors"
              onClick={onOpenAuthModal}
              aria-label="Registrarse para desbloquear todo el contenido"
            >
              <UserPlus className="w-3 h-3" aria-hidden="true" />
              Registrate para desbloquear todo
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
