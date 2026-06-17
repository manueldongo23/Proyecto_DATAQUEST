import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  DatabaseZap,
  Flame,
  FolderKanban,
  GraduationCap,
  MoreVertical,
  Plus,
  ShieldCheck,
  Star,
  Target,
} from 'lucide-react';
import type { ViewType } from '../types';
import { useAuthStore } from '../store/authStore';
import { useSchemaStore } from '../store/schemaStore';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import {
  buildLearningPath,
  calculateStreak,
  classifySchema,
  fetchActiveQuests,
  fetchUserInsights,
  formatRelativeTime,
  latestValidationLevel,
  nfCompletion,
  NF_LABELS,
} from '../services/insights';
import { LoadingSpinner } from './LoadingSpinner';
import { toast } from './Toast';

interface Props {
  onNavigate: (view: ViewType) => void;
  searchQuery: string;
}

const actionCards = [
  {
    title: 'Normalizer Engine',
    description: 'Normaliza tablas y obtén descomposiciones óptimas paso a paso.',
    color: 'from-blue-600 to-indigo-600',
    accent: 'blue',
    buttonText: 'text-blue-700',
    action: 'Nuevo proyecto',
    view: 'validator' as ViewType,
    icon: DatabaseZap,
  },
  {
    title: 'Academy',
    description: 'Aprende teoría, práctica ejercicios y evalúa tu conocimiento.',
    color: 'from-emerald-500 to-teal-500',
    accent: 'emerald',
    buttonText: 'text-emerald-700',
    action: 'Continuar aprendizaje',
    view: 'academy' as ViewType,
    icon: GraduationCap,
  },
  {
    title: 'Validador',
    description: 'Valida esquemas relacionales y verifica formas normales al instante.',
    color: 'from-violet-600 to-indigo-500',
    accent: 'violet',
    buttonText: 'text-violet-700',
    action: 'Nueva validación',
    view: 'validator' as ViewType,
    icon: ShieldCheck,
  },
];

interface DashboardItem {
  id: number;
  name: string;
  latestLevel: string | null;
  progress: number;
  status: 'completed' | 'in_progress' | 'blocked' | 'draft';
  lastUpdated: string;
  validations: number;
}

function progressRingStyle(percent: number): React.CSSProperties {
  return {
    background: `conic-gradient(#14b8a6 ${percent * 3.6}deg, rgba(226,232,240,0.8) 0deg)`,
  };
}

function statusTone(status: DashboardItem['status']): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-700';
    case 'blocked':
      return 'bg-rose-100 text-rose-700';
    case 'in_progress':
      return 'bg-blue-100 text-blue-700';
    default:
      return 'bg-slate-100 text-slate-500';
  }
}

function flattenValidations(items: { id: number; nombre: string; fecha: string; validaciones: { nivel: string; fecha: string }[] }[]) {
  return items
    .flatMap((schema) =>
      schema.validaciones.map((validation, index) => ({
        id: `${schema.id}-${index}`,
        schemaId: schema.id,
        schemaName: schema.nombre,
        level: validation.nivel,
        date: validation.fecha,
      })),
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export const DashboardHome: React.FC<Props> = ({ onNavigate, searchQuery }) => {
  const { user, isGuest } = useAuthStore();
  const { currentSchema, currentSchemaName, currentSchemaId } = useSchemaStore();
  const [loading, setLoading] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [progressData, setProgressData] = useState<Awaited<ReturnType<typeof fetchUserInsights>> | null>(null);
  const [questCount, setQuestCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [insights, quests] = await Promise.all([
          fetchUserInsights(user.id),
          fetchActiveQuests(),
        ]);

        if (!mounted) return;

        setProgressData(insights);
        setQuestCount(quests.length);
      } catch {
        if (mounted) {
          setProgressData(null);
          setQuestCount(0);
          toast.error('No se pudieron cargar tus datos de inicio.');
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

  const dashboardItems = useMemo(() => {
    if (!progressData) return [];

    return progressData.history.map((schema) => {
      const latestLevel = latestValidationLevel(schema);
      const status = classifySchema(schema);
      const updatedAt = schema.validaciones.length > 0 ? schema.validaciones[schema.validaciones.length - 1].fecha : schema.fecha;

      return {
        id: schema.id,
        name: schema.nombre,
        latestLevel,
        progress: nfCompletion(latestLevel),
        status,
        lastUpdated: updatedAt,
        validations: schema.validaciones.length,
      } satisfies DashboardItem;
    });
  }, [progressData]);

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return dashboardItems;
    return dashboardItems.filter((item) => {
      const level = item.latestLevel ?? '';
      return (
        item.name.toLowerCase().includes(query) ||
        level.toLowerCase().includes(query) ||
        NF_LABELS[level]?.toLowerCase().includes(query)
      );
    });
  }, [dashboardItems, searchQuery]);

  const metrics = useMemo(() => {
    const validations = progressData?.history.reduce((acc, item) => acc + item.validaciones.length, 0) ?? 0;
    const streak = calculateStreak(progressData?.sessionAnalytics?.daily_activity ?? []);
    const mastered = progressData?.progress?.mastered_count ?? 0;
    const totalNf = progressData?.progress?.total_nf ?? 5;
    const averageMastery =
      progressData?.progress?.nf_progress?.length
        ? Math.round(progressData.progress.nf_progress.reduce((sum, item) => sum + item.percentage, 0) / progressData.progress.nf_progress.length)
        : 0;

    return {
      projects: dashboardItems.length,
      validations,
      exercises: progressData?.peerComparison?.your_quests_completed ?? 0,
      streak,
      averageMastery,
      mastered,
      totalNf,
    };
  }, [dashboardItems.length, progressData]);

  const currentLearningPath = useMemo(() => buildLearningPath(progressData?.progress ?? null), [progressData?.progress]);
  const latestProject = filteredProjects[0];
  const recentValidations = useMemo(() => {
    const flattened = flattenValidations(progressData?.history ?? []);
    return flattened.filter((item) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;
      return item.schemaName.toLowerCase().includes(query) || item.level.toLowerCase().includes(query);
    });
  }, [progressData?.history, searchQuery]);

  const activeQuest = useMemo(() => {
    if (!progressData?.recommendations?.length) return null;
    return progressData.recommendations[0];
  }, [progressData?.recommendations]);

  if (showAnalytics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setShowAnalytics(false)}
            className="rounded-t-xl border-b-2 border-blue-500 bg-white px-4 py-2 text-sm font-semibold text-blue-600"
          >
            Inicio
          </button>
          <button
            type="button"
            className="rounded-t-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
            aria-selected="true"
          >
            Analítica
          </button>
        </div>
        {user ? <AnalyticsDashboard userId={user.id} /> : <div className="text-sm text-slate-500">Inicia sesión para ver analítica.</div>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            ¡Bienvenido de vuelta, {user?.apodo || 'Explorador'}! <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-2 text-slate-500">Gestiona tus bases de datos, aprende normalización y valida con precisión.</p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-slate-50"
        >
          <MoreVertical className="h-4 w-4" />
          Personalizar dashboard
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {actionCards.map((card) => {
          const Icon = card.icon;
          return (
            <section key={card.title} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className={`flex h-full min-h-[200px] flex-col justify-between bg-gradient-to-br ${card.color} p-5 text-white`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="max-w-[70%]">
                    <div className="text-xl font-bold">{card.title}</div>
                    <p className="mt-3 max-w-xs text-sm text-white/85">{card.description}</p>
                  </div>
                  <div className="rounded-2xl bg-white/15 p-3">
                    <Icon className="h-6 w-6" />
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => onNavigate(card.view)}
                    className={`inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold shadow-lg shadow-black/10 transition hover:brightness-95 ${card.buttonText}`}
                  >
                    {card.action}
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate(card.view)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white transition hover:bg-white/15"
                    aria-label={`Abrir ${card.title}`}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { icon: FolderKanban, label: 'Proyectos', value: metrics.projects, accent: 'bg-blue-100 text-blue-700', note: 'Reales desde tu historial' },
          { icon: BadgeCheck, label: 'Validaciones', value: metrics.validations, accent: 'bg-emerald-100 text-emerald-700', note: 'Historial de esquemas' },
          { icon: BookOpen, label: 'Ejercicios completados', value: metrics.exercises, accent: 'bg-teal-100 text-teal-700', note: 'Quests terminadas' },
          { icon: Flame, label: 'Racha de aprendizaje', value: `${metrics.streak} días`, accent: 'bg-orange-100 text-orange-700', note: 'Basada en actividad real' },
          { icon: Star, label: 'Puntuación promedio', value: `${metrics.averageMastery} /100`, accent: 'bg-violet-100 text-violet-700', note: 'Promedio de dominio' },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Icon className="h-5 w-5" />
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${metric.accent}`}>{user ? 'Actualizado' : '—'}</span>
              </div>
              <div className="mt-4 text-2xl font-bold text-slate-900">{metric.value}</div>
              <div className="mt-1 text-sm font-semibold text-slate-700">{metric.label}</div>
              <div className="mt-2 text-xs text-slate-500">{metric.note}</div>
            </article>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.15fr_0.95fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Proyectos recientes</h2>
            <button type="button" onClick={() => onNavigate('projects')} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
              Ver todos
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="py-10">
                <LoadingSpinner text="Cargando proyectos..." />
              </div>
            ) : filteredProjects.length > 0 ? (
              filteredProjects.slice(0, 5).map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => onNavigate('projects')}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:border-blue-200 hover:bg-slate-50"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <FolderKanban className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate text-sm font-semibold text-slate-900">{project.name}</div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusTone(project.status)}`}>
                        {project.status === 'completed' ? 'Completado' : project.status === 'blocked' ? 'Bloqueado' : project.status === 'in_progress' ? 'En progreso' : 'Sin validar'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">Actualizado {formatRelativeTime(project.lastUpdated)}</div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600" style={{ width: `${project.progress || 12}%` }} />
                    </div>
                  </div>
                  <MoreVertical className="h-4 w-4 text-slate-400" />
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Todavía no hay proyectos guardados.
              </div>
            )}

            <button
              type="button"
              onClick={() => onNavigate('validator')}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Nuevo proyecto
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Progreso académico</h2>
            <button type="button" onClick={() => onNavigate('academy')} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
              Ver ruta de aprendizaje
            </button>
          </div>

          <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="text-sm font-semibold text-slate-500">Ruta actual</div>
                <div className="mt-1 text-lg font-bold text-slate-900">Normalización Avanzada</div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-700">{metrics.mastered}/{metrics.totalNf} dominadas</div>
                  <div className="text-sm font-bold text-blue-600">{metrics.averageMastery}%</div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" style={{ width: `${metrics.averageMastery}%` }} />
                </div>

                <div className="mt-4 space-y-2">
                  {currentLearningPath.slice(0, 5).map((step) => (
                    <div key={step.nf} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{step.nf} - {step.name}</div>
                        <div className="text-xs text-slate-500">{step.description}</div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${step.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : step.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : step.status === 'available' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                        {step.status === 'completed' ? 'Completada' : step.status === 'in_progress' ? 'En progreso' : step.status === 'available' ? 'Disponible' : 'Bloqueada'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="mb-4 text-sm font-semibold text-slate-500">Dominio general</div>
                <div className="flex items-center justify-center">
                  <div className="relative flex h-40 w-40 items-center justify-center rounded-full" style={progressRingStyle(metrics.averageMastery)}>
                    <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-sm">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-slate-900">{metrics.averageMastery}%</div>
                        <div className="text-xs text-slate-500">Progreso general</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-500">Siguiente logro</div>
                <div className="mt-1 text-lg font-bold text-slate-900">
                  {progressData?.recommendations?.[0]?.concept || 'Explorar'}
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {progressData?.recommendations?.[0]?.reason || 'Continúa practicando para desbloquear nuevas recomendaciones.'}
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('academy')}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  <ArrowRight className="h-4 w-4" />
                  Continuar aprendizaje
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Validaciones recientes</h2>
            <button type="button" onClick={() => onNavigate('reports')} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
              Ver todas
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {recentValidations.length > 0 ? (
              recentValidations.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-500">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900">{item.schemaName}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatRelativeTime(item.date)}</div>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                      {item.level}
                    </span>
                    <div className="mt-1 text-[11px] text-slate-500">{NF_LABELS[item.level] ?? item.level}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Todavía no has hecho validaciones.
              </div>
            )}
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-500">Reto activo</div>
                <div className="mt-1 text-base font-bold text-slate-900">{activeQuest?.concept || 'Sin reto activo'}</div>
              </div>
              <div className="rounded-2xl bg-violet-100 px-3 py-2 text-sm font-bold text-violet-700">
                {questCount > 0 ? `${progressData?.peerComparison?.your_quests_completed ?? 0} / ${questCount}` : '0 / 0'}
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-600"
                style={{
                  width: `${questCount > 0 ? Math.min(((progressData?.peerComparison?.your_quests_completed ?? 0) / questCount) * 100, 100) : 0}%`,
                }}
              />
            </div>
            <p className="mt-3 text-sm text-slate-500">
              {activeQuest?.reason || 'Activa una quest para continuar tu progreso gamificado.'}
            </p>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Progresión de formas normales</h2>
            <button
              type="button"
              onClick={() => onNavigate('academy')}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Ver ruta
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {currentLearningPath.slice(0, 5).map((step, index) => {
              const isLast = index === currentLearningPath.slice(0, 5).length - 1;
              return (
                <div key={step.nf} className="relative">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center">
                    <div className="text-sm font-bold text-slate-900">{step.nf}</div>
                    <div className="mt-2 flex justify-center">
                      {step.status === 'completed' ? (
                        <BadgeCheck className="h-6 w-6 text-emerald-500" />
                      ) : step.status === 'in_progress' ? (
                        <Target className="h-6 w-6 text-blue-500" />
                      ) : step.status === 'available' ? (
                        <Star className="h-6 w-6 text-amber-500" />
                      ) : (
                        <BookOpen className="h-6 w-6 text-slate-400" />
                      )}
                    </div>
                    <div className="mt-3 text-xs font-semibold text-slate-500">
                      {step.status === 'completed' ? 'Dominada' : step.status === 'in_progress' ? 'En progreso' : step.status === 'available' ? 'Disponible' : 'Bloqueada'}
                    </div>
                  </div>
                  {!isLast && <div className="absolute -right-2 top-1/2 hidden h-px w-4 bg-slate-300 xl:block" />}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Actividad reciente</h2>
            <button
              type="button"
              onClick={() => setShowAnalytics(true)}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Ver analítica
            </button>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-500">Racha actual</div>
                <div className="mt-1 text-3xl font-bold text-slate-900">{metrics.streak} días</div>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                <Flame className="h-7 w-7" />
              </div>
            </div>

            <div className="mt-4 text-sm text-slate-500">
              {isGuest
                ? 'El progreso de sesión se guardará cuando inicies sesión.'
                : 'Tus métricas se alimentan del historial real de validaciones, quests y dominio por concepto.'}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {[
                ['Último proyecto', latestProject?.name ?? currentSchemaName ?? currentSchema?.table_name ?? 'Sin proyecto'],
                ['Último NF', latestProject?.latestLevel ?? '—'],
                ['Sesión', progressData?.progress?.rango ?? 'Aprendiz'],
                ['Vistas', currentSchemaId ? `Proyecto #${currentSchemaId}` : 'Sesión actual'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white bg-white px-3 py-3 shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
