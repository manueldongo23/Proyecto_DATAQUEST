import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Crown,
  Flame,
  Gift,
  Leaf,
  Link2,
  Medal,
  Mountain,
  Play,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
} from 'lucide-react';
import axiosInstance, { getQuestSessionSeed } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { calculateStreak, fetchActiveQuests, fetchLeaderboard, fetchUserInsights, normalizeNf } from '../services/insights';
import { RingChart } from './ChartWidgets';
import type { ViewType, QuestSummary, LeaderboardEntry } from '../types';
import { LoadingSpinner } from './LoadingSpinner';
import { toast } from './Toast';

interface DataQuestViewProps {
  onNavigate?: (view: ViewType) => void;
  searchQuery?: string;
}

type StartedRecord = {
  startedAt: string;
};

type StartedMap = Record<number, StartedRecord>;

interface AchievementItem {
  id: number;
  name: string;
  description: string;
  icon: string;
  xp_reward: number;
  criteria_type: string;
  criteria_value: number;
  unlocked: boolean;
}

interface WeeklyDay {
  key: string;
  label: string;
  checked: boolean;
}

interface ConceptProgressMap {
  get(concept: string): number | undefined;
}

const STORAGE_KEY = 'dataquest:started_quests';
const SELECTED_QUEST_KEY = 'dataquest:selected_quest_id';
const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2500, 4000];

function readStartedQuests(): StartedMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, StartedRecord | boolean>;
    return Object.entries(parsed).reduce<StartedMap>((acc, [key, value]) => {
      const id = Number(key);
      if (Number.isNaN(id)) return acc;

      if (value && typeof value === 'object' && 'startedAt' in value) {
        acc[id] = { startedAt: String((value as StartedRecord).startedAt) };
        return acc;
      }

      if (value === true) {
        acc[id] = { startedAt: new Date().toISOString() };
      }

      return acc;
    }, {});
  } catch {
    return {};
  }
}

function saveStartedQuests(map: StartedMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function saveSelectedQuestId(questId: number | null) {
  try {
    if (questId === null) {
      localStorage.removeItem(SELECTED_QUEST_KEY);
      return;
    }

    localStorage.setItem(SELECTED_QUEST_KEY, String(questId));
  } catch {
    // Ignore storage issues in restricted browsers.
  }
}

function difficultyLabel(difficulty: number): string {
  if (difficulty <= 1) return 'Básico';
  if (difficulty === 2) return 'Intermedio';
  if (difficulty === 3) return 'Avanzado';
  return 'Experto';
}

function difficultyTone(difficulty: number): string {
  if (difficulty <= 1) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (difficulty === 2) return 'bg-orange-50 text-orange-700 border-orange-200';
  if (difficulty === 3) return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-violet-50 text-violet-700 border-violet-200';
}

function questGradient(difficulty: number): string {
  if (difficulty <= 1) return 'from-emerald-500 to-teal-500';
  if (difficulty === 2) return 'from-orange-500 to-amber-500';
  if (difficulty === 3) return 'from-violet-500 to-fuchsia-500';
  return 'from-rose-500 to-pink-500';
}

function questDurationHours(difficulty: number): number {
  if (difficulty <= 1) return 48;
  if (difficulty === 2) return 72;
  if (difficulty === 3) return 96;
  return 120;
}

function questDurationLabel(difficulty: number): string {
  return `${questDurationHours(difficulty)} h`;
}

function formatCountdown(timestamp: string | null) {
  if (!timestamp) return 'Disponible';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Disponible';

  const diff = Math.max(0, date.getTime() - Date.now());
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  if (days > 0) {
    return `Expira en ${days} d ${hours} h`;
  }

  if (hours > 0) {
    return `Expira en ${hours} h`;
  }

  return `Expira en ${minutes} m`;
}

function getStartProgress(startedAt?: string | null) {
  if (!startedAt) return { value: 0, label: '0 / 3' };
  const elapsed = Math.max(0, Date.now() - new Date(startedAt).getTime());
  const duration = 6 * 24 * 60 * 60 * 1000;
  const ratio = Math.min(1, elapsed / duration);
  const stage = Math.max(1, Math.min(3, Math.ceil(ratio * 3)));
  return { value: Math.round(ratio * 100), label: `${stage} / 3` };
}

function getQuestStageCount(difficulty: number): number {
  if (difficulty <= 1) return 3;
  if (difficulty === 2) return 5;
  if (difficulty === 3) return 4;
  return 3;
}

function getQuestReadiness(quest: QuestSummary, conceptProgress: ConceptProgressMap): number {
  const normalized = normalizeNf(quest.nf_requirement);
  const base = normalized && normalized !== '—' ? conceptProgress.get(normalized) ?? 0 : 0;

  if (base > 0) {
    return base;
  }

  return quest.difficulty <= 1 ? 28 : quest.difficulty === 2 ? 18 : 8;
}

function getWeekdays(activity: { date: string; schemas_validated: number }[]): WeeklyDay[] {
  const labels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const today = new Date();
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(today.getDate() - (6 - index));
    date.setHours(0, 0, 0, 0);
    const key = date.toISOString().slice(0, 10);
    const found = activity.find((entry) => entry.date === key);

    return {
      key,
      label: labels[index],
      checked: (found?.schemas_validated ?? 0) > 0,
    };
  });
}

function getNextWeeklyResetLabel() {
  const now = new Date();
  const reset = new Date(now);
  reset.setHours(0, 0, 0, 0);
  const day = reset.getDay();
  const daysUntilMonday = ((8 - day) % 7) || 7;
  reset.setDate(reset.getDate() + daysUntilMonday);
  const diff = Math.max(0, reset.getTime() - now.getTime());
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  if (days > 0) return `Se reinicia en ${days} d ${hours} h ${minutes} m`;
  if (hours > 0) return `Se reinicia en ${hours} h ${minutes} m`;
  return `Se reinicia en ${minutes} m`;
}

function getLevelSnapshot(xp: number) {
  let levelIndex = 0;
  for (let index = 0; index < LEVEL_THRESHOLDS.length; index += 1) {
    if (xp >= LEVEL_THRESHOLDS[index]) {
      levelIndex = index;
    }
  }

  const currentMin = LEVEL_THRESHOLDS[levelIndex] ?? 0;
  const nextMin = LEVEL_THRESHOLDS[levelIndex + 1] ?? currentMin + 1000;
  const currentXP = Math.max(0, xp - currentMin);
  const totalToNext = Math.max(1, nextMin - currentMin);
  const progress = Math.min(100, (currentXP / totalToNext) * 100);

  return {
    level: levelIndex + 1,
    progress,
    currentXP: xp,
    nextXP: nextMin,
    rankName:
      xp >= 4000
        ? 'Legendario del Diseño'
        : xp >= 2500
          ? 'Doctor en Normalización'
          : xp >= 1500
            ? 'Guardián de la 3FN'
            : xp >= 1000
              ? 'Arquitecto Supremo'
              : xp >= 600
                ? 'Maestro de Esquemas'
                : xp >= 300
                  ? 'Especialista de Datos'
                  : xp >= 100
                    ? 'Normalizador Junior'
                    : 'Aprendiz',
  };
}

function getQuestIcon(quest: QuestSummary) {
  const text = `${quest.title} ${quest.quest_type}`.toLowerCase();
  if (text.includes('bcnf')) return ShieldCheck;
  if (text.includes('dependencia') || text.includes('3fn')) return Search;
  if (text.includes('2fn')) return Link2;
  if (text.includes('5fn')) return Crown;
  if (quest.difficulty <= 1) return Rocket;
  return Trophy;
}

function getBadgeIcon(name: string, icon: string, index: number) {
  const text = `${name} ${icon}`.toLowerCase();
  if (text.includes('bcnf')) return ShieldCheck;
  if (text.includes('leyenda')) return Crown;
  if (text.includes('velocista') || text.includes('zap')) return Flame;
  if (text.includes('perfección') || text.includes('perfect')) return Sparkles;
  if (text.includes('3fn')) return Trophy;
  if (text.includes('dependencia') || text.includes('link')) return Link2;
  if (text.includes('coleccionista') || text.includes('award')) return Award;
  if (index === 0) return Star;
  if (index === 1) return Trophy;
  if (index === 2) return Medal;
  return Award;
}

function getAchievementState(
  achievement: AchievementItem,
  stats: {
    xp: number;
    questsCompleted: number;
    masteredCount: number;
    perfectScores: number;
  },
) {
  let progress = achievement.unlocked ? 1 : 0;

  if (achievement.criteria_type === 'quests_completed') {
    progress = achievement.criteria_value > 0 ? stats.questsCompleted / achievement.criteria_value : 0;
  }

  if (achievement.criteria_type === 'nf_mastery') {
    progress = achievement.criteria_value > 0 ? stats.masteredCount / achievement.criteria_value : 0;
  }

  if (achievement.criteria_type === 'total_xp') {
    progress = achievement.criteria_value > 0 ? stats.xp / achievement.criteria_value : 0;
  }

  if (achievement.criteria_type === 'perfect_score') {
    progress = achievement.criteria_value > 0 ? stats.perfectScores / achievement.criteria_value : 0;
  }

  return {
    earned: achievement.unlocked || progress >= 1,
    progress: Math.max(0, Math.min(1, progress)),
  };
}

function getQuestPriority(
  quest: QuestSummary,
  conceptProgress: ConceptProgressMap,
  recommendations: { concept: string; current_percentage: number; priority: string; reason: string }[] | undefined,
) {
  const readiness = getQuestReadiness(quest, conceptProgress);
  const normalized = normalizeNf(quest.nf_requirement);
  const recommendationIndex = recommendations?.findIndex((item) => normalizeNf(item.concept) === normalized) ?? -1;
  const recommendationBonus = recommendationIndex >= 0 ? Math.max(0, 42 - recommendationIndex * 8) : 0;
  return readiness * 3 + recommendationBonus + quest.xp_reward * 0.08 - quest.difficulty * 10;
}

function hashSeed(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 31) + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function questSegmentsLabel(quest: QuestSummary, readiness: number, startedAt?: string | null) {
  if (startedAt) {
    return getStartProgress(startedAt).label;
  }

  const totalSegments = getQuestStageCount(quest.difficulty);
  const filled = Math.max(0, Math.min(totalSegments, Math.round((readiness / 100) * totalSegments)));
  return `${filled} / ${totalSegments}`;
}

function questTypeLabel(type: string): string {
  if (type === 'puzzle') return 'Práctica guiada';
  if (type === 'reto') return 'Desafío aplicado';
  if (type === 'examen') return 'Evaluación final';
  return type;
}

function buildQuestFocusPoints(quest: QuestSummary): string[] {
  const nf = normalizeNf(quest.nf_requirement);

  if (quest.difficulty <= 1) {
    return [
      `Detecta valores no atómicos en ${quest.title}.`,
      `Separa grupos repetidos para llegar a ${nf}.`,
      'Deja una solución corta, clara y validable.',
    ];
  }

  if (quest.difficulty === 2) {
    return [
      `Identifica dependencias funcionales en ${quest.title}.`,
      `Elimina dependencias parciales antes de validar ${nf}.`,
      'Compara el antes y el después para ver la mejora real.',
    ];
  }

  if (quest.difficulty === 3) {
    return [
      `Evalúa superclaves y determinantes en ${quest.title}.`,
      `Comprueba BCNF sin perder integridad.`,
      'Justifica por qué la descomposición es correcta.',
    ];
  }

  return [
    `Busca dependencias multivaluadas en ${quest.title}.`,
    'Reduce el modelo hasta 4FN y 5FN.',
    'Explica por qué la solución no pierde información.',
  ];
}

export const DataQuestView: React.FC<DataQuestViewProps> = ({ onNavigate, searchQuery = '' }) => {
  const { user } = useAuthStore();
  const detailRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [quests, setQuests] = useState<QuestSummary[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [insights, setInsights] = useState<Awaited<ReturnType<typeof fetchUserInsights>> | null>(null);
  const [selectedQuest, setSelectedQuest] = useState<QuestSummary | null>(null);
  const [started, setStarted] = useState<StartedMap>(() => readStartedQuests());
  const [showHelp, setShowHelp] = useState(false);
  const [startingId, setStartingId] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedQuest) return;
    saveSelectedQuestId(selectedQuest.id);
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedQuest?.id]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!user) {
        setLoading(false);
        setQuests([]);
        setLeaderboard([]);
        setAchievements([]);
        setInsights(null);
        setSelectedQuest(null);
        return;
      }

      setLoading(true);

      try {
        const [questList, ranking, userInsights, achievementResponse] = await Promise.all([
          fetchActiveQuests(),
          fetchLeaderboard(),
          fetchUserInsights(user.id),
          axiosInstance.get('/achievements'),
        ]);

        if (!mounted) return;

        const ordered = [...questList].sort((a, b) => a.difficulty - b.difficulty || b.xp_reward - a.xp_reward);
        setQuests(ordered);
        setLeaderboard(ranking);
        setInsights(userInsights);
        setAchievements((achievementResponse.data?.data ?? []) as AchievementItem[]);
      } catch {
        if (mounted) {
          toast.error('No se pudieron cargar los retos.');
        }
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

  const conceptProgress = useMemo(() => {
    const map = new Map<string, number>();
    insights?.progress?.nf_progress?.forEach((item) => {
      map.set(normalizeNf(item.concept), item.percentage);
    });
    insights?.peerComparison?.concept_comparison?.forEach((item) => {
      map.set(normalizeNf(item.concept), item.your_percentage);
    });
    return map;
  }, [insights]);

  const stats = useMemo(() => {
    const xp = user?.xp ?? insights?.peerComparison?.your_xp ?? 0;
    const questsCompleted = insights?.peerComparison?.your_quests_completed ?? 0;
    const streak = calculateStreak(insights?.sessionAnalytics?.daily_activity ?? []);
    const masteredCount = insights?.progress?.nf_progress?.filter((item) => item.mastered).length ?? 0;

    return {
      xp,
      questsCompleted,
      streak,
      masteredCount,
      weeklyGoal: 5,
      perfectScores: achievements.filter((item) => item.unlocked && item.criteria_type === 'perfect_score').length,
    };
  }, [achievements, insights?.peerComparison?.your_quests_completed, insights?.progress?.nf_progress, insights?.sessionAnalytics?.daily_activity, user?.xp]);

  const visibleQuests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return quests;
    return quests.filter((quest) => {
      return (
        quest.title.toLowerCase().includes(query) ||
        quest.description.toLowerCase().includes(query) ||
        quest.quest_type.toLowerCase().includes(query) ||
        normalizeNf(quest.nf_requirement).toLowerCase().includes(query)
      );
    });
  }, [quests, searchQuery]);

  const recommendedQuests = useMemo(() => {
    return [...visibleQuests].sort((a, b) => {
      const scoreDelta =
        getQuestPriority(b, conceptProgress, insights?.recommendations) -
        getQuestPriority(a, conceptProgress, insights?.recommendations);
      if (scoreDelta !== 0) return scoreDelta;
      return a.difficulty - b.difficulty || b.xp_reward - a.xp_reward;
    });
  }, [conceptProgress, insights?.recommendations, visibleQuests]);

  const featuredQuest = useMemo(() => {
    if (selectedQuest) return selectedQuest;
    const startedQuest = recommendedQuests.find((quest) => started[quest.id]);
    if (startedQuest) return startedQuest;

    const featuredPool = recommendedQuests.slice(0, Math.min(4, recommendedQuests.length));
    if (!featuredPool.length) return quests[0] ?? null;

    const sessionSeed = getQuestSessionSeed();
    const offset = hashSeed(`${sessionSeed}|${user?.id ?? 'guest'}|${stats.xp}|${stats.questsCompleted}`) % featuredPool.length;

    return featuredPool[offset] ?? quests[0] ?? null;
  }, [quests, recommendedQuests, selectedQuest, started, stats.questsCompleted, stats.xp, user?.id]);

  const xpSnapshot = useMemo(() => getLevelSnapshot(stats.xp), [stats.xp]);
  const weeklyDays = useMemo(() => getWeekdays(insights?.sessionAnalytics?.daily_activity ?? []), [insights?.sessionAnalytics?.daily_activity]);
  const weeklyResetLabel = useMemo(() => getNextWeeklyResetLabel(), []);
  const rewardProgress = Math.min(100, (stats.questsCompleted / stats.weeklyGoal) * 100);
  const activeQuest = featuredQuest;
  const activeStartedAt = activeQuest ? started[activeQuest.id]?.startedAt ?? null : null;
  const activeProgress = activeQuest ? getStartProgress(activeStartedAt) : { value: 0, label: '0 / 3' };
  const activeQuestReadiness = activeQuest ? getQuestReadiness(activeQuest, conceptProgress) : 0;
  const activeProgressValue = activeStartedAt ? activeProgress.value : activeQuestReadiness;
  const activeProgressLabel = activeQuest ? questSegmentsLabel(activeQuest, activeQuestReadiness, activeStartedAt) : '0 / 3';
  const activeExpires = activeQuest
    ? new Date((activeStartedAt ? new Date(activeStartedAt).getTime() : Date.now()) + questDurationHours(activeQuest.difficulty) * 60 * 60 * 1000).toISOString()
    : null;
  const openQuestFromCard = (quest: QuestSummary) => {
    setSelectedQuest(quest);
    saveSelectedQuestId(quest.id);

    if (started[quest.id]) {
      onNavigate?.('games');
      return;
    }

    void handleStartQuest(quest, true);
  };

  const groupedByDifficulty = useMemo(() => {
    return {
      basic: quests.filter((quest) => quest.difficulty <= 1),
      intermediate: quests.filter((quest) => quest.difficulty === 2),
      advanced: quests.filter((quest) => quest.difficulty >= 3),
    };
  }, [quests]);

  const difficultyCards = useMemo(() => {
    return [
      {
        label: 'Básico',
        icon: Leaf,
        color: 'from-emerald-500 to-teal-500',
        tone: 'bg-emerald-50 border-emerald-200',
        description: 'Domina los fundamentos de la normalización.',
        quests: groupedByDifficulty.basic,
      },
      {
        label: 'Intermedio',
        icon: Mountain,
        color: 'from-orange-500 to-amber-500',
        tone: 'bg-orange-50 border-orange-200',
        description: 'Profundiza en dependencias y anomalías.',
        quests: groupedByDifficulty.intermediate,
      },
      {
        label: 'Avanzado',
        icon: Rocket,
        color: 'from-rose-500 to-fuchsia-500',
        tone: 'bg-rose-50 border-rose-200',
        description: 'Desafíos complejos para expertos en datos.',
        quests: groupedByDifficulty.advanced,
      },
    ];
  }, [groupedByDifficulty.advanced, groupedByDifficulty.basic, groupedByDifficulty.intermediate]);

  const badgeCards = useMemo(() => {
    const priority = ['Primer Reto', '3FN Master', 'Dependencia', 'BCNF Pro', 'Coleccionista', 'Velocista', 'Perfección Relacional', 'Leyenda Relacional'];
    return [...achievements]
      .sort((a, b) => {
        const ai = priority.indexOf(a.name);
        const bi = priority.indexOf(b.name);
        if (ai === -1 && bi === -1) return a.xp_reward - b.xp_reward;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      })
      .slice(0, 4)
      .map((achievement) => ({
        ...achievement,
        state: getAchievementState(achievement, stats),
      }));
  }, [achievements, stats]);

  const handleStartQuest = async (quest: QuestSummary, openQuestView = true) => {
    setStartingId(quest.id);
    try {
      const response = await axiosInstance.post(`/quests/${quest.id}/start`);
      if (response.data?.success || response.status === 201) {
        const next = {
          ...started,
          [quest.id]: { startedAt: new Date().toISOString() },
        };
        setStarted(next);
        saveStartedQuests(next);
        setSelectedQuest(quest);
        saveSelectedQuestId(quest.id);
        if (openQuestView) {
          onNavigate?.('games');
        }
        toast.success(`Reto iniciado: ${quest.title}`);
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || 'No se pudo iniciar el reto.';
      if (message.includes('Ya tienes un intento activo')) {
        const next = {
          ...started,
          [quest.id]: started[quest.id] ?? { startedAt: new Date().toISOString() },
        };
        setStarted(next);
        saveStartedQuests(next);
        setSelectedQuest(quest);
        saveSelectedQuestId(quest.id);
        if (openQuestView) {
          onNavigate?.('games');
        }
        toast.info('Este reto ya está en curso.');
        return;
      }
      toast.error(message);
    } finally {
      setStartingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <LoadingSpinner text="Cargando retos..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center shadow-sm">
        <Sparkles className="mx-auto h-14 w-14 text-slate-300" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Retos</h1>
        <p className="mt-2 text-sm text-slate-500">Inicia sesión para ver retos reales y progresar con tus propias decisiones.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {showHelp && (
        <div className="rounded-[28px] border border-cyan-200 bg-cyan-50/70 p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Guía rápida</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                El panel se adapta a tu progreso real: puedes iniciar un reto, volver a abrirlo, seguir tu racha y revisar qué estás listo para resolver ahora.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigate?.('academy')}
                className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100"
              >
                <BookOpen className="h-4 w-4" />
                Ir a Academy
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.('projects')}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
              >
                <Rocket className="h-4 w-4" />
                Ver proyectos
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
            <Trophy className="h-4 w-4" />
            Retos
          </div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Retos</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Acepta desafíos, demuestra tu dominio de la normalización y escala en la clasificación.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowHelp((current) => !current)}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-slate-50"
        >
          <Target className="h-4 w-4" />
          ¿Cómo funcionan los retos?
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02),0_12px_32px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-gradient-to-br ${questGradient(activeQuest?.difficulty ?? 1)} text-white shadow-lg`}>
                <Trophy className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-500">Reto activo</div>
                <div className="mt-1 text-lg font-bold leading-tight text-slate-900">{activeQuest?.title ?? 'Sin reto activo'}</div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                  {activeQuest?.description ?? 'Selecciona un reto recomendado para empezar a ganar XP.'}
                </p>
              </div>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${difficultyTone(activeQuest?.difficulty ?? 1)}`}>
              {difficultyLabel(activeQuest?.difficulty ?? 1)}
            </span>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>{activeProgressLabel}</span>
              <span>{activeQuest ? normalizeNf(activeQuest.nf_requirement) : 'Libre'}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${questGradient(activeQuest?.difficulty ?? 1)}`}
                style={{ width: `${activeProgressValue}%` }}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Clock3 className="h-3.5 w-3.5" />
            {formatCountdown(activeExpires)}
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02),0_12px_32px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-500">XP acumulado</div>
              <div className="mt-2 text-3xl font-bold text-slate-900">{stats.xp.toLocaleString('es-PE')} XP</div>
              <div className="mt-2 text-sm text-slate-500">Nivel {xpSnapshot.level}</div>
            </div>
            <RingChart
              value={xpSnapshot.progress}
              label="Progreso general"
              sublabel={`Nivel ${xpSnapshot.level}`}
              size={120}
              stroke={10}
              color="#14b8a6"
            />
          </div>

          <div className="mt-4 flex items-end justify-between rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Rango actual</div>
              <div className="mt-1 text-lg font-bold text-slate-900">{xpSnapshot.rankName}</div>
              <div className="text-sm text-slate-500">
                {xpSnapshot.currentXP.toLocaleString('es-PE')} / {xpSnapshot.nextXP.toLocaleString('es-PE')} XP
              </div>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-600 text-white shadow-lg">
              <Star className="h-7 w-7" />
            </div>
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02),0_12px_32px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-500">Racha actual</div>
              <div className="mt-1 text-3xl font-bold text-slate-900">{stats.streak} días</div>
              <div className="mt-2 text-sm text-slate-500">¡Sigue así!</div>
            </div>
            <div className="rounded-[20px] bg-orange-50 p-3 text-orange-500">
              <Flame className="h-6 w-6" />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-2">
            {weeklyDays.map((day) => (
              <div key={day.key} className="flex flex-col items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500">{day.label}</span>
                <span className={`flex h-8 w-8 items-center justify-center rounded-full border ${day.checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 bg-white text-slate-400'}`}>
                  {day.checked ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-slate-300" />}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02),0_12px_32px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-500">Próxima recompensa</div>
              <div className="mt-1 text-lg font-bold text-slate-900">Cofre Épico</div>
              <div className="mt-1 text-sm text-slate-500">Completa 5 retos esta semana</div>
            </div>
            <div className="rounded-[20px] bg-violet-50 p-3 text-violet-600">
              <Gift className="h-6 w-6" />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-4">
            <div className="relative flex h-24 w-28 items-center justify-center shrink-0">
              <div className="absolute inset-x-4 bottom-0 h-9 rounded-b-[18px] bg-gradient-to-b from-slate-700 to-slate-900 shadow-inner" />
              <div className="absolute inset-x-2 bottom-6 h-10 rounded-[18px] border border-white/30 bg-gradient-to-b from-violet-300 via-violet-500 to-indigo-600 shadow-xl" />
              <div className="absolute inset-x-9 bottom-4 h-14 w-8 rounded-full bg-white/45" />
              <div className="absolute left-1/2 top-6 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-white/70 text-violet-700 shadow-md">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-blue-500" style={{ width: `${rewardProgress}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>{stats.questsCompleted} / {stats.weeklyGoal}</span>
                <span>{Math.round(rewardProgress)}%</span>
              </div>
              <div className="mt-3 text-xs text-slate-500">Meta semanal alcanzada por progreso real.</div>
            </div>
          </div>
        </article>
      </div>

      <div ref={detailRef} className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <article className={`overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br ${questGradient(activeQuest?.difficulty ?? 1)} p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.12)]`}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-white/80">Reto seleccionado</div>
              <h2 className="mt-1 text-3xl font-black leading-tight">{activeQuest?.title ?? 'Selecciona un reto'}</h2>
              <p className="mt-3 max-w-2xl text-sm text-white/85">
                {activeQuest?.description ?? 'Elige un reto para ver su contexto, progreso y la mejor acción según tu sesión.'}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-bold text-white/90">
                  {questTypeLabel(activeQuest?.quest_type ?? 'reto')}
                </span>
                <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-bold text-white/90">
                  {difficultyLabel(activeQuest?.difficulty ?? 1)}
                </span>
                <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-bold text-white/90">
                  {activeQuest ? normalizeNf(activeQuest.nf_requirement) : 'Libre'}
                </span>
                <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-bold text-white/90">
                  {started[activeQuest?.id ?? -1] ? 'En curso' : 'Disponible'}
                </span>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/15 bg-white/10 p-3 backdrop-blur">
              <RingChart
                value={activeProgressValue}
                label={started[activeQuest?.id ?? -1] ? 'En curso' : 'Progreso'}
                sublabel={activeQuest ? `+${activeQuest.xp_reward} XP` : 'Selecciona un reto'}
                size={122}
                stroke={10}
                color="#ffffff"
                trackColor="rgba(255,255,255,0.18)"
                valueClassName="text-white"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {activeQuest ? buildQuestFocusPoints(activeQuest).map((point) => (
              <div key={point} className="rounded-[22px] border border-white/15 bg-white/10 p-4 text-sm text-white/88">
                {point}
              </div>
            )) : (
              <>
                <div className="rounded-[22px] border border-white/15 bg-white/10 p-4 text-sm text-white/88">Explora retos recomendados.</div>
                <div className="rounded-[22px] border border-white/15 bg-white/10 p-4 text-sm text-white/88">Abre un reto para verlo en detalle.</div>
                <div className="rounded-[22px] border border-white/15 bg-white/10 p-4 text-sm text-white/88">Tus elecciones cambian la prioridad.</div>
              </>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (!activeQuest) return;
                if (started[activeQuest.id]) {
                  saveSelectedQuestId(activeQuest.id);
                  onNavigate?.('games');
                  return;
                }
                void handleStartQuest(activeQuest, true);
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-black/10 transition hover:brightness-105"
            >
              {started[activeQuest?.id ?? -1] ? <ArrowRight className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {started[activeQuest?.id ?? -1] ? 'Continuar reto' : 'Iniciar reto'}
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('games')}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              <Rocket className="h-4 w-4" />
              Abrir reto completo
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('academy')}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              <BookOpen className="h-4 w-4" />
              Ver teoría
            </button>
          </div>
        </article>

        <article className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02),0_12px_32px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Ruta del reto</h3>
              <p className="mt-1 text-sm text-slate-500">Lo que cambia según tus elecciones y tu progreso.</p>
            </div>
            <BookOpen className="h-5 w-5 text-blue-500" />
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Progreso actual</div>
              <div className="mt-1 text-lg font-bold text-slate-900">{activeProgressLabel}</div>
              <div className="mt-1 text-sm text-slate-500">{formatCountdown(activeExpires)}</div>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Recompensa</div>
              <div className="mt-1 text-lg font-bold text-slate-900">+{activeQuest?.xp_reward ?? 0} XP</div>
              <div className="mt-1 text-sm text-slate-500">Se adapta al estado del reto y a tu sesión.</div>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Acción sugerida</div>
              <div className="mt-1 text-lg font-bold text-slate-900">{started[activeQuest?.id ?? -1] ? 'Continuar reto' : 'Iniciar reto'}</div>
              <div className="mt-1 text-sm text-slate-500">El botón te lleva a la vista completa del desafío.</div>
            </div>
          </div>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.15fr]">
        <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02),0_12px_32px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Clasificación semanal</h2>
              <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                <Clock3 className="h-4 w-4" />
                {weeklyResetLabel}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {leaderboard.length > 0 ? leaderboard.slice(0, 5).map((entry) => (
              <div
                key={entry.user_id ?? entry.rank}
                className={`flex items-center gap-3 rounded-[20px] border px-4 py-3 ${entry.user_id === user?.id ? 'border-blue-200 bg-blue-50/70' : 'border-slate-200 bg-slate-50'}`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-700 shadow-sm">
                  {entry.rank}
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-xs font-bold text-white shadow-sm">
                  {entry.apodo.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900">{entry.apodo}</div>
                  <div className="text-xs text-slate-500">{entry.user_id === user?.id ? 'Estudiante' : 'Normalizador avanzado'}</div>
                </div>
                <div className="text-sm font-semibold text-slate-900">{entry.xp.toLocaleString('es-PE')} XP</div>
                <div className="text-amber-500">
                  {entry.rank === 1 ? <Trophy className="h-4 w-4" /> : entry.rank <= 3 ? <Medal className="h-4 w-4" /> : <Award className="h-4 w-4" />}
                </div>
              </div>
            )) : (
              <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                No hay datos de ranking.
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigate?.('leaderboard')}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            <Users className="h-4 w-4" />
            Ver clasificación completa
          </button>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02),0_12px_32px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Retos recomendados</h2>
              <p className="mt-1 text-sm text-slate-500">Ordenados por tu progreso actual y tus elecciones recientes.</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('games')}
              className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
            >
              Ver todos los retos
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(recommendedQuests.length > 0 ? recommendedQuests : quests).slice(0, 4).map((quest) => {
              const isStarted = !!started[quest.id];
              const readiness = getQuestReadiness(quest, conceptProgress);
              const questProgress = getStartProgress(started[quest.id]?.startedAt ?? null);
              const readySegments = getQuestStageCount(quest.difficulty);
              const filledSegments = Math.max(0, Math.min(readySegments, Math.round((readiness / 100) * readySegments)));
              const QuestIcon = getQuestIcon(quest);
              const currentWidth = isStarted ? questProgress.value : readiness;
              const durationLabel = questDurationLabel(quest.difficulty);

              return (
                <article
                  key={quest.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openQuestFromCard(quest)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openQuestFromCard(quest);
                    }
                  }}
                  className={`group relative flex h-full flex-col overflow-hidden rounded-[26px] border p-4 text-left shadow-[0_1px_0_rgba(15,23,42,0.02),0_12px_32px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_1px_0_rgba(15,23,42,0.02),0_16px_40px_rgba(15,23,42,0.09)] ${
                    activeQuest?.id === quest.id ? 'border-blue-200 bg-blue-50/60' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${questGradient(quest.difficulty)} opacity-80`} />
                  <div className="flex items-start justify-between gap-3">
                    <div className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${questGradient(quest.difficulty)} text-white shadow-[0_10px_22px_rgba(37,99,235,0.18)]`}>
                      <div className="absolute inset-0 bg-white/10" />
                      <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-white/25 blur-sm" />
                      <QuestIcon className="relative h-5 w-5 drop-shadow" />
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${difficultyTone(quest.difficulty)}`}>
                      {difficultyLabel(quest.difficulty)}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="text-[15px] font-bold leading-snug text-slate-900">{quest.title}</div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{quest.description}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span className="inline-flex items-center gap-1.5 text-emerald-600">
                      <Sparkles className="h-3.5 w-3.5" />
                      +{quest.xp_reward} XP
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5" />
                      {durationLabel}
                    </span>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${questGradient(quest.difficulty)}`}
                      style={{ width: `${currentWidth}%` }}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>{isStarted ? `En curso ${questProgress.label}` : `${filledSegments} / ${readySegments}`}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{normalizeNf(quest.nf_requirement)}</span>
                  </div>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (isStarted) {
                        setSelectedQuest(quest);
                        saveSelectedQuestId(quest.id);
                        onNavigate?.('games');
                        return;
                      }
                      void handleStartQuest(quest, true);
                    }}
                    disabled={startingId === quest.id}
                    className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-70 ${
                      isStarted
                        ? 'border border-blue-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.22)] hover:brightness-105'
                        : 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    {isStarted ? <ArrowRight className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {startingId === quest.id ? 'Iniciando...' : isStarted ? 'Continuar reto' : 'Comenzar reto'}
                  </button>
                </article>
              );
            })}
          </div>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.95fr]">
        <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02),0_12px_32px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Retos por dificultad</h2>
              <p className="mt-1 text-sm text-slate-500">Disponibles y en curso según el nivel seleccionado.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {difficultyCards.map((item) => {
              const Icon = item.icon;
              const startedCount = item.quests.filter((quest) => started[quest.id]).length;
              const masteredCount = item.quests.filter((quest) => (getQuestReadiness(quest, conceptProgress) >= 80) || started[quest.id]).length;
              const progress = item.quests.length ? Math.round((masteredCount / item.quests.length) * 100) : 0;
              const firstQuest = item.quests[0];

              return (
                <div key={item.label} className={`rounded-[24px] border p-4 shadow-sm ${item.tone}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70 text-current shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                      {item.quests.length} retos
                    </span>
                  </div>

                  <div className="mt-4 text-lg font-bold text-slate-900">{item.label}</div>
                  <p className="mt-1 text-sm text-slate-600">{item.description}</p>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/70">
                    <div className={`h-full rounded-full bg-gradient-to-r ${item.color}`} style={{ width: `${progress}%` }} />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>Completados: {masteredCount}/{item.quests.length || 1}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (firstQuest) {
                          setSelectedQuest(firstQuest);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-2xl border border-current/20 bg-white/70 px-3 py-1.5"
                    >
                      Explorar retos
                    </button>
                  </div>

                  <div className="mt-2 text-[11px] text-slate-500">{startedCount} en curso</div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02),0_12px_32px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Mis insignias</h2>
              <p className="mt-1 text-sm text-slate-500">Logros reales desbloqueados por tu cuenta.</p>
            </div>
            <button type="button" className="text-sm font-semibold text-blue-600 transition hover:text-blue-700">
              Ver todas
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {badgeCards.length > 0 ? badgeCards.map((badge, index) => {
              const BadgeIcon = getBadgeIcon(badge.name, badge.icon, index);
              return (
                <div
                  key={badge.id}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-[20px] ${
                      badge.state.earned ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                    } shadow-sm`}>
                      <BadgeIcon className="h-7 w-7" />
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      badge.state.earned ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {badge.state.earned ? 'Completada' : 'En progreso'}
                    </span>
                  </div>
                  <div className="mt-3 text-sm font-bold text-slate-900">{badge.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{badge.description}</div>
                </div>
              );
            }) : (
              <div className="col-span-2 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                Todavía no hay insignias cargadas.
              </div>
            )}
          </div>
        </article>
      </div>

      <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-r from-violet-50 via-white to-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02),0_12px_32px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">¡Completa retos, gana XP y desbloquea recompensas exclusivas!</h2>
            <p className="mt-1 text-sm text-slate-600">
              Cada reto completado acerca tu perfil a niveles más avanzados, insignias nuevas y mejores oportunidades de práctica.
            </p>
          </div>

          <div className="relative hidden min-h-[120px] w-[240px] shrink-0 items-end justify-end md:flex">
            <div className="absolute bottom-0 right-2 h-28 w-28 rounded-full bg-violet-200/70 blur-2xl" />
            <div className="absolute right-8 top-4 flex h-24 w-24 items-center justify-center rounded-full bg-white/80 shadow-lg">
              <Trophy className="h-12 w-12 text-violet-600" />
            </div>
            <div className="absolute bottom-4 right-16 h-16 w-16 rounded-full bg-violet-600/10" />
          </div>
        </div>
      </article>
    </div>
  );
};
