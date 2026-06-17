import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock3,
  FolderKanban,
  History as HistoryIcon,
  Search,
  Trophy,
  User2,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import type { ActivityFeed, ActivityTimelineEntry, ViewType } from '../types';
import { fetchActivityFeed, formatLongDateTime, formatRelativeTime } from '../services/insights';
import { LoadingSpinner } from './LoadingSpinner';
import { toast } from './Toast';

interface HistoryViewProps {
  onNavigate: (view: ViewType) => void;
  searchQuery: string;
}

function activityTone(type: string): { box: string; icon: string; label: string } {
  switch (type) {
    case 'validation':
    case 'validacion':
      return {
        box: 'bg-emerald-50 text-emerald-600 border-emerald-200',
        icon: 'text-emerald-600',
        label: 'Validación',
      };
    case 'proyecto':
      return {
        box: 'bg-blue-50 text-blue-600 border-blue-200',
        icon: 'text-blue-600',
        label: 'Proyecto',
      };
    case 'reto':
      return {
        box: 'bg-violet-50 text-violet-600 border-violet-200',
        icon: 'text-violet-600',
        label: 'Reto',
      };
    case 'reporte':
      return {
        box: 'bg-orange-50 text-orange-600 border-orange-200',
        icon: 'text-orange-600',
        label: 'Reporte',
      };
    case 'perfil':
      return {
        box: 'bg-sky-50 text-sky-600 border-sky-200',
        icon: 'text-sky-600',
        label: 'Perfil',
      };
    case 'academia':
      return {
        box: 'bg-teal-50 text-teal-600 border-teal-200',
        icon: 'text-teal-600',
        label: 'Academia',
      };
    default:
      return {
        box: 'bg-slate-50 text-slate-600 border-slate-200',
        icon: 'text-slate-600',
        label: type || 'Actividad',
      };
  }
}

function activityIcon(type: string) {
  switch (type) {
    case 'validation':
    case 'validacion':
      return CheckCircle2;
    case 'proyecto':
      return FolderKanban;
    case 'reto':
      return Trophy;
    case 'reporte':
      return BarChart3;
    case 'perfil':
      return User2;
    case 'academia':
      return BookOpen;
    default:
      return Activity;
  }
}

function activityMetaSummary(item: ActivityTimelineEntry): string[] {
  const meta = item.meta ?? {};
  const parts: string[] = [];

  if (typeof meta.level === 'string' && meta.level.trim()) {
    parts.push(meta.level);
  }

  if (typeof meta.schema_id === 'number') {
    parts.push(`Proyecto #${meta.schema_id}`);
  }

  if (typeof meta.module === 'string' && meta.module.trim()) {
    parts.push(meta.module);
  }

  if (typeof meta.destination === 'string' && meta.destination.trim()) {
    parts.push(meta.destination);
  }

  if (typeof meta.violations === 'number') {
    parts.push(`${meta.violations} hallazgos`);
  }

  if (typeof meta.log_type === 'string' && meta.log_type.trim()) {
    parts.push(meta.log_type);
  }

  return parts;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onNavigate, searchQuery }) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState<ActivityFeed>({
    summary: {
      total_events: 0,
      validation_events: 0,
      log_events: 0,
      latest_activity_at: null,
    },
    timeline: [],
  });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!user) {
        setLoading(false);
        setFeed({
          summary: {
            total_events: 0,
            validation_events: 0,
            log_events: 0,
            latest_activity_at: null,
          },
          timeline: [],
        });
        return;
      }

      setLoading(true);
      try {
        const data = await fetchActivityFeed();
        if (!mounted) return;
        setFeed(data);
      } catch {
        if (mounted) toast.error('No se pudo cargar el historial.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [user]);

  const rows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const flattened = [...feed.timeline].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (!query) return flattened;

    return flattened.filter((item) => {
      const metaText = JSON.stringify(item.meta ?? {}).toLowerCase();
      return (
        item.title.toLowerCase().includes(query) ||
        item.detail.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query) ||
        metaText.includes(query)
      );
    });
  }, [feed.timeline, searchQuery]);

  const latestActivity = feed.summary.latest_activity_at ?? rows[0]?.date ?? null;

  if (!user) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <HistoryIcon className="mx-auto h-14 w-14 text-slate-300" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Historial</h1>
        <p className="mt-2 text-sm text-slate-500">Inicia sesión para ver tu actividad y tus validaciones.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">Historial</p>
          <h1 className="text-3xl font-bold text-slate-900">Registro cronológico de tu actividad</h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Aquí se reúnen validaciones, proyectos, reportes y acciones de tu sesión real. No hay datos ficticios: todo sale del backend.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('projects')}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-slate-50"
        >
          <ArrowRight className="h-4 w-4" />
          Ir a proyectos
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Eventos totales', value: feed.summary.total_events, icon: Activity },
          { label: 'Validaciones', value: feed.summary.validation_events, icon: CheckCircle2 },
          { label: 'Registros de sistema', value: feed.summary.log_events, icon: Clock3 },
          { label: 'Última actividad', value: latestActivity ? formatRelativeTime(latestActivity) : '—', icon: HistoryIcon },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-sm font-semibold text-slate-500">{card.label}</div>
              <div className="mt-1 text-lg font-bold text-slate-900">{card.value}</div>
            </article>
          );
        })}
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Actividad reciente</h2>
            <p className="mt-1 text-sm text-slate-500">Filtra con la búsqueda global del header o revisa la línea de tiempo completa.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
            <Search className="h-3.5 w-3.5" />
            {rows.length} resultados
          </div>
        </div>

        {loading ? (
          <div className="py-12">
            <LoadingSpinner text="Cargando historial..." />
          </div>
        ) : rows.length > 0 ? (
          <div className="mt-5 space-y-3">
            {rows.slice(0, 20).map((item) => {
              const tone = activityTone(item.type);
              const Icon = activityIcon(item.type);
              const tags = activityMetaSummary(item);

              return (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${tone.box}`}>
                      <Icon className={`h-5 w-5 ${tone.icon}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-slate-900">{item.title}</div>
                          <div className="mt-1 text-sm text-slate-500">{item.detail}</div>
                        </div>
                        <div className="text-right text-xs text-slate-400">
                          <div className="font-semibold text-slate-500">{formatRelativeTime(item.date)}</div>
                          <div className="mt-1">{formatLongDateTime(item.date)}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone.box}`}>
                          {tone.label}
                        </span>
                        {tags.map((tag) => (
                          <span key={tag} className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No hay actividad registrada todavía. Cuando valides, edites o exportes algo, aparecerá aquí.
          </div>
        )}
      </section>
    </div>
  );
};
