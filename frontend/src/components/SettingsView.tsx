import React, { useState } from 'react';
import { Check, LogOut, Settings2, UserCircle2 } from 'lucide-react';
import axiosInstance from '../services/api';
import { useAuthStore } from '../store/authStore';
import type { ViewType } from '../types';
import { toast } from './Toast';

interface SettingsViewProps {
  onNavigate: (view: ViewType) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onNavigate }) => {
  const { user, logout, setUser, token } = useAuthStore();
  const [nickname, setNickname] = useState(user?.apodo ?? '');
  const [saving, setSaving] = useState(false);

  if (!user) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <Settings2 className="mx-auto h-14 w-14 text-slate-300" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Ajustes</h1>
        <p className="mt-2 text-sm text-slate-500">Inicia sesión para administrar tu perfil y preferencias.</p>
      </div>
    );
  }

  const saveProfile = async () => {
    if (!nickname.trim()) {
      toast.error('El apodo no puede estar vacío.');
      return;
    }

    setSaving(true);
    try {
      const response = await axiosInstance.put('/auth/profile', { apodo: nickname.trim() });
      if (response.data?.success) {
        setUser(response.data.user, token ?? undefined);
        toast.success('Perfil actualizado correctamente.');
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || 'No se pudo guardar el perfil.';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">Ajustes</p>
          <h1 className="text-3xl font-bold text-slate-900">Preferencias y perfil</h1>
          <p className="mt-2 text-slate-500">Aquí puedes ajustar tu identidad visible y cerrar tu sesión de forma segura.</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-slate-50"
        >
          <UserCircle2 className="h-4 w-4" />
          Ir al inicio
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 text-xl font-bold text-white shadow-lg shadow-blue-500/25">
              {user.apodo.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900">{user.apodo}</div>
              <div className="mt-1 text-sm text-slate-500">{user.correo}</div>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {[
              ['Rango', user.rango],
              ['XP actual', `${user.xp} XP`],
              ['Rol', user.role],
              ['Estado', user.activo ? 'Activo' : 'Inactivo'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Actualizar perfil</h2>
          <p className="mt-2 text-sm text-slate-500">El cambio de apodo se guarda en el backend y se refleja en toda la plataforma.</p>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Apodo</span>
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white"
                placeholder="Nuevo apodo"
              />
            </label>

            <div className="rounded-3xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-900/80">
              <div className="font-semibold text-blue-700">Consejo</div>
              <p className="mt-1">Si cambias tu apodo, la sesión actual se actualizará sin perder tu progreso.</p>
            </div>

            <button
              type="button"
              onClick={() => void saveProfile()}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:brightness-105 disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>

            <button
              type="button"
              onClick={() => {
                logout();
                toast.success('Sesión cerrada.');
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
