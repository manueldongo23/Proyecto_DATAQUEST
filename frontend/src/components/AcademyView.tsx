import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Crown,
  Flame,
  Lightbulb,
  Medal,
  Play,
  Sparkles,
  Star,
  Trophy,
  Users,
} from 'lucide-react';
import axiosInstance from '../services/api';
import { useAuthStore } from '../store/authStore';
import type { ViewType } from '../types';
import {
  buildLearningPath,
  calculateStreak,
  fetchUserInsights,
  formatRelativeTime,
} from '../services/insights';
import { LoadingSpinner } from './LoadingSpinner';
import { toast } from './Toast';

interface NFStep {
  nf: string;
  title: string;
  description: string;
  rules_count: number;
  has_exercise: boolean;
}

interface AcademyViewProps {
  onNavigate?: (view: ViewType) => void;
  searchQuery?: string;
}

const LAST_NF_KEY = 'dataquest:last_academy_nf';

function readStoredNf(): string | null {
  try {
    return localStorage.getItem(LAST_NF_KEY);
  } catch {
    return null;
  }
}

function saveStoredNf(nf: string) {
  localStorage.setItem(LAST_NF_KEY, nf);
}

function ringStyle(percent: number): React.CSSProperties {
  return {
    background: `conic-gradient(#14b8a6 ${percent * 3.6}deg, rgba(226,232,240,0.85) 0deg)`,
  };
}

export const AcademyView: React.FC<AcademyViewProps> = ({ onNavigate, searchQuery: _searchQuery }) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [academySteps, setAcademySteps] = useState<NFStep[]>([]);
  const [selectedNF, setSelectedNF] = useState<string>(readStoredNf() || '3FN');
  const [progressData, setProgressData] = useState<Awaited<ReturnType<typeof fetchUserInsights>> | null>(null);
  const [learningPath, setLearningPath] = useState<ReturnType<typeof buildLearningPath>>([]);
  const [explanation, setExplanation] = useState<any>(null);
  const [exercise, setExercise] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'lessons' | 'support' | 'cases' | 'certification'>('lessons');
  const [exerciseLoading, setExerciseLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [academyRes, insights] = await Promise.all([
          axiosInstance.get('/academy'),
          user ? fetchUserInsights(user.id) : Promise.resolve(null),
        ]);

        if (!mounted) return;

        const academyData = academyRes.data?.data;
        setAcademySteps((academyData?.normal_forms ?? []).map((item: any) => ({
          nf: item.id,
          title: item.title,
          description: item.description,
          rules_count: item.rules_count,
          has_exercise: item.has_exercise,
        })));
        setProgressData(insights);

        const path = buildLearningPath(insights?.progress ?? null);
        setLearningPath(path);

        const currentStep = path.find((step) => step.status === 'in_progress')
          || path.find((step) => step.status === 'available')
          || path[0];

        if (currentStep) {
          setSelectedNF((stored) => stored || currentStep.nf);
        }
      } catch {
        toast.error('No se pudo cargar la academia.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    let mounted = true;

    const loadSelected = async () => {
      try {
        const [explainRes, exerciseRes] = await Promise.all([
          axiosInstance.get(`/academy/explain/${selectedNF}`),
          axiosInstance.get(`/academy/exercise?nf=${selectedNF}`),
        ]);

        if (!mounted) return;

        if (explainRes.data?.success) {
          setExplanation(explainRes.data.data);
        }

        if (exerciseRes.data?.success) {
          setExercise(exerciseRes.data.data);
        }
      } catch {
        if (mounted) {
          setExplanation(null);
          setExercise(null);
        }
      }
    };

    saveStoredNf(selectedNF);
    void loadSelected();

    return () => {
      mounted = false;
    };
  }, [selectedNF]);

  const summary = useMemo(() => {
    const completed = learningPath.filter((step) => step.status === 'completed').length;
    const streak = calculateStreak(progressData?.sessionAnalytics?.daily_activity ?? []);
    const mastered = progressData?.progress?.mastered_count ?? 0;
    const averageMastery =
      progressData?.progress?.nf_progress?.length
        ? Math.round(progressData.progress.nf_progress.reduce((sum, item) => sum + item.percentage, 0) / progressData.progress.nf_progress.length)
        : 0;

    return {
      completed,
      total: learningPath.length || 6,
      streak,
      mastered,
      averageMastery,
      nextGoal: progressData?.recommendations?.[0]?.concept ?? 'Avanzar al siguiente nivel',
    };
  }, [learningPath, progressData]);

  const selectedStep = academySteps.find((step) => step.nf === selectedNF);
  const progressRing = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : summary.averageMastery;
  const achievements = progressData?.progress?.achievements ?? [];

  const handlePractice = async () => {
    setExerciseLoading(true);
    try {
      const response = await axiosInstance.get(`/academy/exercise?nf=${selectedNF}`);
      if (response.data?.success) {
        setExercise(response.data.data);
        toast.success(`Ejercicio cargado para ${selectedNF}`);
      }
    } catch {
      toast.error('No se pudo cargar el ejercicio.');
    } finally {
      setExerciseLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <LoadingSpinner text="Cargando academia..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <button type="button" onClick={() => onNavigate?.('dashboard')} className="font-semibold text-blue-600 hover:text-blue-700">
          Academy
        </button>
        <ChevronRight className="h-4 w-4" />
        <span>Rutas de aprendizaje</span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Ruta: Normalización Relacional Avanzada</h1>
              <p className="mt-2 max-w-2xl text-slate-500">
                Domina las formas normales y diseña modelos de datos robustos, eficientes y libres de anomalías.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-28 w-28 items-center justify-center rounded-full" style={ringStyle(progressRing)}>
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-900">{progressRing}%</div>
                    <div className="text-[11px] text-slate-500">Progreso general</div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate?.('reports')}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-slate-50"
              >
                <Medal className="h-4 w-4" />
                Certificado
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Lecciones completadas', value: `${summary.completed} / ${summary.total}`, icon: CheckCircle2, tone: 'bg-emerald-100 text-emerald-700' },
              { label: 'Tiempo estimado de estudio', value: `${Math.max(1, summary.mastered * 18)} min`, icon: Clock3, tone: 'bg-blue-100 text-blue-700' },
              { label: 'Racha de estudio', value: `${summary.streak} días`, icon: Flame, tone: 'bg-orange-100 text-orange-700' },
              { label: 'Siguiente logro', value: summary.nextGoal, icon: Crown, tone: 'bg-violet-100 text-violet-700' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${item.tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="mt-3 text-sm font-semibold text-slate-500">{item.label}</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">{item.value}</div>
                </article>
              );
            })}
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-500">Mapa de la ruta</div>
            <div className="mt-4 flex flex-wrap gap-3">
              {learningPath.map((step, index) => (
                <button
                  key={step.nf}
                  type="button"
                  onClick={() => setSelectedNF(step.nf)}
                  className={`min-w-[150px] rounded-2xl border p-4 text-left transition ${
                    selectedNF === step.nf
                      ? 'border-blue-300 bg-white shadow-sm'
                      : 'border-slate-200 bg-white/80 hover:border-blue-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-slate-900">{step.nf}</div>
                    <div className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      step.status === 'completed' ? 'bg-emerald-100 text-emerald-700'
                        : step.status === 'in_progress' ? 'bg-blue-100 text-blue-700'
                        : step.status === 'available' ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {step.status === 'completed' ? 'Completada' : step.status === 'in_progress' ? 'En progreso' : step.status === 'available' ? 'Disponible' : 'Bloqueada'}
                    </div>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-700">{step.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{step.description}</div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" style={{ width: `${step.progress}%` }} />
                  </div>
                  {index < learningPath.length - 1 && (
                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Siguiente</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Lecciones</h2>
                <p className="mt-1 text-sm text-slate-500">Selecciona una forma normal para ver su explicación y prácticas.</p>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                {selectedNF}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {academySteps.map((step) => (
                <button
                  key={step.nf}
                  type="button"
                  onClick={() => setSelectedNF(step.nf)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    selectedNF === step.nf ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  {step.nf}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                  <BookOpen className="h-3.5 w-3.5" />
                  Teoría
                </div>
                <h3 className="mt-3 text-2xl font-bold text-slate-900">{explanation?.title || selectedStep?.title || selectedNF}</h3>
                <p className="mt-2 text-sm text-slate-600">{explanation?.description || selectedStep?.description}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                <Lightbulb className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-500">Reglas</div>
                <div className="mt-3 space-y-2">
                  {explanation?.rules?.map((rule: string, index: number) => (
                    <div key={`${rule}-${index}`} className="flex items-start gap-2 rounded-2xl bg-white px-3 py-2 text-sm text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                      <span>{rule}</span>
                    </div>
                  )) ?? <div className="text-sm text-slate-500">Sin reglas cargadas.</div>}
                </div>

                {explanation?.common_mistakes?.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Errores comunes</div>
                    <div className="mt-2 space-y-2 text-sm text-amber-900/80">
                      {explanation.common_mistakes.map((mistake: string, index: number) => (
                        <div key={`${mistake}-${index}`}>• {mistake}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-500">Ejemplo guiado</div>
                  <Sparkles className="h-4 w-4 text-blue-500" />
                </div>

                {explanation?.before_example || explanation?.after_example ? (
                  <div className="mt-4 grid gap-3">
                    {explanation.before_example && (
                      <pre className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs leading-5 text-rose-900/80 whitespace-pre-wrap">
                        {explanation.before_example}
                      </pre>
                    )}
                    {explanation.after_example && (
                      <pre className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs leading-5 text-emerald-900/80 whitespace-pre-wrap">
                        {explanation.after_example}
                      </pre>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                    Selecciona una forma normal para ver su ejemplo didáctico.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.8fr_1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Práctica guiada</h2>
            <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
              {exercise ? 'Disponible' : 'Cargando'}
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Play className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-500">Ejercicio</div>
                <div className="text-lg font-bold text-slate-900">{exercise?.title || 'Ejercicio guiado'}</div>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">{exercise?.description || 'Carga un ejercicio real para practicar el concepto seleccionado.'}</p>

            <button
              type="button"
              onClick={() => void handlePractice()}
              className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              {exerciseLoading ? <Clock3 className="h-4 w-4 animate-pulse" /> : <ArrowRight className="h-4 w-4" />}
              Continuar práctica
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Logros recientes</h2>
            <button type="button" onClick={() => onNavigate?.('reports')} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
              Ver todos
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {achievements.length > 0 ? (
              achievements.slice(0, 4).map((achievement) => (
                <div key={achievement.name} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                    <Trophy className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-900">{achievement.name}</div>
                    <div className="text-xs text-slate-500">{formatRelativeTime(achievement.unlocked_at)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Todavía no has desbloqueado logros.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Resumen de desempeño</h2>
            <button
              type="button"
              onClick={() => setActiveTab('certification')}
              className={`text-sm font-semibold transition ${
                activeTab === 'certification' ? 'text-blue-700' : 'text-blue-600 hover:text-blue-700'
              }`}
            >
              Ver detalle
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { label: 'Lecciones completadas', value: summary.completed, icon: Award, tone: 'bg-blue-100 text-blue-700' },
              { label: 'Prácticas realizadas', value: progressData?.peerComparison?.your_quests_completed ?? 0, icon: Users, tone: 'bg-emerald-100 text-emerald-700' },
              { label: 'Días estudiados', value: summary.streak, icon: Clock3, tone: 'bg-orange-100 text-orange-700' },
              { label: 'XP obtenidos', value: `${progressData?.peerComparison?.your_xp ?? 0} XP`, icon: Star, tone: 'bg-violet-100 text-violet-700' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${item.tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{item.label}</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">{item.value}</div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Certificación</h2>
          <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-500">Estado actual</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {progressData?.progress?.mastered_count ?? 0} / {progressData?.progress?.total_nf ?? 5}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500"
                style={{ width: `${progressData?.progress?.total_nf ? ((progressData.progress.mastered_count / progressData.progress.total_nf) * 100) : 0}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-slate-500">
              {progressData?.progress?.mastered_count === progressData?.progress?.total_nf
                ? '¡Ya puedes generar tu certificado!'
                : 'Sigue completando formas normales para desbloquear la certificación.'}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Material de apoyo</h2>
              <p className="mt-1 text-sm text-slate-500">Usa este material antes de volver al ejercicio práctico.</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('glossary')}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-slate-50"
            >
              <BookOpen className="h-4 w-4" />
              Biblioteca
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              'Repasa la definición antes de cada ejercicio.',
              'Revisa el motivo de cada violación en el diagnóstico.',
              'Compara tu progreso con la ruta de aprendizaje.',
              'Usa el glosario para consultar términos críticos.',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                • {item}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
