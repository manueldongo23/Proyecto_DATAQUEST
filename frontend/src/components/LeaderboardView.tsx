import React, { useEffect, useMemo, useState } from 'react';
import { Award, Crown, Medal as MedalIcon, Trophy, Users } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import type { LeaderboardEntry } from '../types';
import { fetchLeaderboard } from '../services/insights';
import { toast } from './Toast';

type BoardMode = 'global' | 'nearby';

function rankTone(rank: number): string {
  if (rank === 1) return 'bg-amber-100 text-amber-700';
  if (rank === 2) return 'bg-slate-100 text-slate-700';
  if (rank === 3) return 'bg-orange-100 text-orange-700';
  return 'bg-indigo-50 text-indigo-700';
}

function medalLabel(rank: number): string {
  if (rank === 1) return 'Campeón';
  if (rank === 2) return 'Elite';
  if (rank === 3) return 'Top 3';
  return 'Activo';
}

function rowAccent(rank: number): string {
  if (rank === 1) return 'ring-2 ring-amber-200 bg-amber-50/70';
  if (rank === 2) return 'ring-2 ring-slate-200 bg-slate-50/70';
  if (rank === 3) return 'ring-2 ring-orange-200 bg-orange-50/70';
  return 'bg-white';
}

export const LeaderboardView: React.FC = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [mode, setMode] = useState<BoardMode>('global');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!user) {
        setLoading(false);
        setRows([]);
        return;
      }

      setLoading(true);
      try {
        const board = await fetchLeaderboard();
        if (!mounted) return;
        setRows(board);
      } catch {
        if (mounted) {
          setRows([]);
          toast.error('No se pudo cargar el ranking real.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [user]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.rank - b.rank),
    [rows],
  );

  const currentUserRow = useMemo(
    () => (user ? sortedRows.find((row) => row.user_id === user.id) ?? null : null),
    [sortedRows, user],
  );

  const displayRows = useMemo(() => {
    if (mode === 'global') {
      return sortedRows;
    }

    if (!currentUserRow) {
      return sortedRows.slice(0, 10);
    }

    const index = sortedRows.findIndex((row) => row.user_id === user?.id);
    if (index === -1) {
      return sortedRows.slice(0, 10);
    }

    const start = Math.max(0, index - 3);
    const end = Math.min(sortedRows.length, index + 4);
    return sortedRows.slice(start, end);
  }, [currentUserRow, mode, sortedRows, user?.id]);

  const topThree = sortedRows.slice(0, 3);
  const nextRank = currentUserRow ? sortedRows.find((row) => row.rank === currentUserRow.rank - 1) : null;

  const summary = [
    { label: 'Participantes', value: sortedRows.length, icon: Users },
    { label: 'Mi posición', value: currentUserRow ? `#${currentUserRow.rank}` : '—', icon: Crown },
    { label: 'Mi XP', value: currentUserRow ? `${currentUserRow.xp} XP` : '—', icon: Award },
    { label: 'Meta cercana', value: nextRank ? `${Math.max(0, nextRank.xp - (currentUserRow?.xp ?? 0))} XP` : '—', icon: Trophy },
  ] as const;

  if (!user) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <Trophy className="mx-auto h-14 w-14 text-slate-300" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Salón de la fama</h1>
        <p className="mt-2 text-sm text-slate-500">Inicia sesión para ver el ranking real de la plataforma.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">Ranking</p>
          <h1 className="text-3xl font-bold text-slate-900">Salón de la fama alimentado por XP real</h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Este panel se arma con el ranking del backend y cambia según el progreso de cada sesión.
          </p>
        </div>

        <div className="flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setMode('global')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              mode === 'global' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Global
          </button>
          <button
            type="button"
            onClick={() => setMode('nearby')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              mode === 'nearby' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Cerca de mí
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summary.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">DataQuest</span>
              </div>
              <div className="mt-4 text-2xl font-bold text-slate-900">{card.value}</div>
              <div className="mt-1 text-sm font-semibold text-slate-700">{card.label}</div>
            </article>
          );
        })}
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Top 3 de la sesión</h2>
            <p className="mt-1 text-sm text-slate-500">Los primeros lugares se actualizan desde el backend.</p>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
            {mode === 'global' ? 'Vista global' : 'Vista cercana'}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {topThree.map((entry) => (
            <article
              key={entry.user_id ?? entry.rank}
              className={`rounded-3xl border border-slate-200 p-5 shadow-sm ${rowAccent(entry.rank)}`}
            >
              <div className="flex items-center justify-between">
                <div className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${rankTone(entry.rank)}`}>
                  #{entry.rank}
                </div>
                <MedalIcon className="h-5 w-5 text-slate-400" />
              </div>
              <div className="mt-4 text-lg font-bold text-slate-900">{entry.apodo}</div>
              <div className="mt-1 text-sm text-slate-500">{entry.rango || 'Estudiante'}</div>
              <div className="mt-4 text-3xl font-black text-slate-900">{entry.xp}</div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">XP acumulado</div>
              <div className="mt-4 rounded-2xl border border-white/70 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600">
                {medalLabel(entry.rank)}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Tabla general</h2>
            <p className="mt-1 text-sm text-slate-500">
              {mode === 'global' ? 'Ordenada por XP acumulado.' : 'Centrada en tu posición actual.'}
            </p>
          </div>
          {loading ? (
            <div className="text-sm text-slate-500">Cargando ranking...</div>
          ) : (
            <div className="text-sm text-slate-500">
              {displayRows.length} registros
            </div>
          )}
        </div>

        {loading ? (
          <div className="mt-5 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : displayRows.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
            <div className="grid grid-cols-[90px_minmax(0,1.5fr)_120px_140px] bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              <div>Rank</div>
              <div>Usuario</div>
              <div>XP</div>
              <div>Rango</div>
            </div>
            <div className="divide-y divide-slate-100">
              {displayRows.map((entry) => {
                const isCurrent = entry.user_id === user.id;
                return (
                  <div
                    key={entry.user_id ?? entry.rank}
                    className={`grid grid-cols-[90px_minmax(0,1.5fr)_120px_140px] items-center px-4 py-4 transition ${
                      isCurrent ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-slate-500">#{entry.rank}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-semibold text-slate-900">{entry.apodo}</div>
                        {isCurrent && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">Tú</span>}
                      </div>
                      <div className="text-xs text-slate-500">Usuario activo</div>
                    </div>
                    <div className="text-sm font-bold text-slate-900">{entry.xp} XP</div>
                    <div className="text-sm text-slate-600">{entry.rango || 'Estudiante'}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Aún no hay usuarios activos para mostrar.
          </div>
        )}
      </section>
    </div>
  );
};
