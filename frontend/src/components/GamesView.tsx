import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Crown,
  FileJson,
  Flame,
  Gift,
  Layers3,
  Loader2,
  Lock,
  Play,
  RefreshCcw,
  Rocket,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
} from 'lucide-react';
import axiosInstance from '../services/api';
import { useAuthStore } from '../store/authStore';
import { calculateStreak, fetchActiveQuests, fetchLeaderboard, fetchUserInsights, normalizeNf, NF_LABELS } from '../services/insights';
import { RingChart } from './ChartWidgets';
import type { LeaderboardEntry, QuestSummary, ViewType } from '../types';
import { LoadingSpinner } from './LoadingSpinner';
import { toast } from './Toast';

interface GamesViewProps {
  onNavigate?: (view: ViewType) => void;
  searchQuery?: string;
}

type QuestMode = 'basic' | 'intermediate' | 'advanced' | 'expert';
type QuestStage = 'overview' | 'workspace' | 'result';
type QuestStatus = 'available' | 'started' | 'blocked' | 'completed';

type StartedRecord = {
  startedAt: string;
};

type StartedMap = Record<number, StartedRecord>;
type DraftMap = Record<number, QuestDraft>;
type ResultMap = Record<number, QuestSubmission>;
type AttemptCountMap = Record<number, number>;

interface QuestDraft {
  answer: string;
  notes: string;
  hintsUsed: number;
}

interface QuestSubmission {
  status: 'completed' | 'failed';
  score: number;
  xp_earned: number;
  message: string;
  submittedAt: string;
  hintsUsed: number;
}

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

interface QuestLockState {
  locked: boolean;
  reason: string;
  checklist: Array<{ label: string; fulfilled: boolean }>;
  progress: number;
}

interface LocalValidationSummary {
  valid: boolean;
  tables: number;
  dependencies: number;
  notes: string[];
}

type QuestVisualVariant = {
  accent: string;
  icon: string;
  surface: string;
  halo: string;
  pill: string;
};

const STARTED_KEY = 'dataquest:started_games';
const DRAFT_KEY = 'dataquest:challenge_drafts';
const RESULT_KEY = 'dataquest:challenge_results';
const ATTEMPTS_KEY = 'dataquest:challenge_attempts';
const SELECTED_QUEST_KEY = 'dataquest:selected_quest_id';
const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2500, 4000];

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJsonStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore restrictive browsers.
  }
}

function readStartedGames(): StartedMap {
  try {
    const raw = localStorage.getItem(STARTED_KEY);
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

function saveStartedGames(map: StartedMap) {
  saveJsonStorage(STARTED_KEY, map);
}

function readDrafts(): DraftMap {
  return readJsonStorage<DraftMap>(DRAFT_KEY, {});
}

function saveDrafts(map: DraftMap) {
  saveJsonStorage(DRAFT_KEY, map);
}

function readResults(): ResultMap {
  return readJsonStorage<ResultMap>(RESULT_KEY, {});
}

function saveResults(map: ResultMap) {
  saveJsonStorage(RESULT_KEY, map);
}

function readAttemptCounts(): AttemptCountMap {
  return readJsonStorage<AttemptCountMap>(ATTEMPTS_KEY, {});
}

function saveAttemptCounts(map: AttemptCountMap) {
  saveJsonStorage(ATTEMPTS_KEY, map);
}

function difficultyMode(difficulty: number): QuestMode {
  if (difficulty <= 1) return 'basic';
  if (difficulty === 2) return 'intermediate';
  if (difficulty === 3) return 'advanced';
  return 'expert';
}

function difficultyLabel(difficulty: number): string {
  if (difficulty <= 1) return 'Básico';
  if (difficulty === 2) return 'Intermedio';
  if (difficulty === 3) return 'Avanzado';
  return 'Experto';
}

function questTypeLabel(type: string): string {
  if (type === 'puzzle') return 'Pr?ctica guiada';
  if (type === 'reto') return 'Desaf?o aplicado';
  if (type === 'examen') return 'Evaluaci?n final';
  if (type === 'diagnostico') return 'Diagn?stico guiado';
  if (type === 'repaso') return 'Repaso';
  if (type === 'evento') return 'Evento especial';
  if (type === 'maraton') return 'Marat?n';
  if (type === 'recuperacion') return 'Recuperaci?n';
  return type;
}

function questModeTone(mode: QuestMode): string {
  if (mode === 'basic') return 'from-emerald-500 via-teal-500 to-cyan-500';
  if (mode === 'intermediate') return 'from-blue-500 via-indigo-500 to-violet-500';
  if (mode === 'advanced') return 'from-orange-500 via-amber-500 to-rose-500';
  return 'from-violet-700 via-fuchsia-600 to-pink-600';
}

function questModeSurface(mode: QuestMode): string {
  if (mode === 'basic') return 'from-emerald-50 via-white to-cyan-50';
  if (mode === 'intermediate') return 'from-blue-50 via-white to-indigo-50';
  if (mode === 'advanced') return 'from-orange-50 via-white to-rose-50';
  return 'from-violet-50 via-white to-fuchsia-50';
}

function questTypeTone(type: string): string {
  if (type === 'puzzle') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (type === 'reto') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (type === 'examen') return 'bg-violet-100 text-violet-700 border-violet-200';
  if (type === 'diagnostico') return 'bg-sky-100 text-sky-700 border-sky-200';
  if (type === 'repaso') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (type === 'evento') return 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200';
  if (type === 'maraton') return 'bg-pink-100 text-pink-700 border-pink-200';
  if (type === 'recuperacion') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

type RewardTier = 'all' | 'basic' | 'standard' | 'epic' | 'legendary';

function rewardTierForXp(xp: number): Exclude<RewardTier, 'all'> {
  if (xp < 140) return 'basic';
  if (xp < 220) return 'standard';
  if (xp < 320) return 'epic';
  return 'legendary';
}

function rewardTierLabel(tier: RewardTier): string {
  if (tier === 'basic') return 'Cofre b?sico';
  if (tier === 'standard') return 'Cofre plata';
  if (tier === 'epic') return 'Cofre ?pico';
  if (tier === 'legendary') return 'Cofre legendario';
  return 'Todas las recompensas';
}

function questStateTone(state: QuestStatus): string {
  if (state === 'available') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (state === 'started') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (state === 'completed') return 'bg-violet-100 text-violet-700 border-violet-200';
  return 'bg-amber-100 text-amber-700 border-amber-200';
}

function questStateLabel(state: QuestStatus): string {
  if (state === 'available') return 'Disponible';
  if (state === 'started') return 'En progreso';
  if (state === 'completed') return 'Completado';
  return 'Bloqueado';
}

function questIcon(mode: QuestMode) {
  if (mode === 'basic') return Search;
  if (mode === 'intermediate') return Rocket;
  if (mode === 'advanced') return ShieldCheck;
  return Crown;
}

function questTimeHours(difficulty: number): number {
  if (difficulty <= 1) return 48;
  if (difficulty === 2) return 72;
  if (difficulty === 3) return 96;
  return 120;
}

function questTimeLabel(difficulty: number): string {
  return `${questTimeHours(difficulty)} h`;
}

function formatCountdown(timestamp: string | null) {
  if (!timestamp) return 'Disponible';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Disponible';

  const diff = Math.max(0, date.getTime() - Date.now());
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  if (days > 0) return `Expira en ${days} d ${hours} h`;
  if (hours > 0) return `Expira en ${hours} h`;
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

  if (base > 0) return base;
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
    if (xp >= LEVEL_THRESHOLDS[index]) levelIndex = index;
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

function hashSeed(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 31) + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

const QUEST_VISUAL_VARIANTS: QuestVisualVariant[] = [
  {
    accent: 'from-blue-500 via-indigo-500 to-violet-500',
    icon: 'from-blue-500 via-indigo-500 to-violet-500',
    surface: 'from-blue-50 via-white to-indigo-50',
    halo: 'from-blue-200/70 via-transparent to-transparent',
    pill: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    accent: 'from-emerald-500 via-teal-500 to-cyan-500',
    icon: 'from-emerald-500 via-teal-500 to-cyan-500',
    surface: 'from-emerald-50 via-white to-cyan-50',
    halo: 'from-emerald-200/70 via-transparent to-transparent',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    accent: 'from-orange-500 via-amber-500 to-rose-500',
    icon: 'from-orange-500 via-amber-500 to-rose-500',
    surface: 'from-orange-50 via-white to-rose-50',
    halo: 'from-orange-200/70 via-transparent to-transparent',
    pill: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  {
    accent: 'from-violet-600 via-fuchsia-600 to-pink-500',
    icon: 'from-violet-600 via-fuchsia-600 to-pink-500',
    surface: 'from-violet-50 via-white to-fuchsia-50',
    halo: 'from-violet-200/70 via-transparent to-transparent',
    pill: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  {
    accent: 'from-sky-500 via-cyan-500 to-blue-500',
    icon: 'from-sky-500 via-cyan-500 to-blue-500',
    surface: 'from-sky-50 via-white to-cyan-50',
    halo: 'from-sky-200/70 via-transparent to-transparent',
    pill: 'bg-sky-50 text-sky-700 border-sky-200',
  },
];

function getQuestVisualVariant(quest: QuestSummary): QuestVisualVariant {
  const seed = hashSeed(`${quest.id}:${quest.title}:${quest.quest_type}:${quest.nf_requirement ?? ''}`);
  return QUEST_VISUAL_VARIANTS[seed % QUEST_VISUAL_VARIANTS.length];
}

function nfLabel(value?: string | null): string {
  const normalized = normalizeNf(value);
  return NF_LABELS[normalized as keyof typeof NF_LABELS] ?? normalized;
}

function questThemeLabel(quest: QuestSummary): string {
  const context = quest.generation_context ?? {};
  const theme = typeof context.theme === 'string' ? context.theme : '';
  if (theme) {
    return theme.charAt(0).toUpperCase() + theme.slice(1);
  }
  const nf = normalizeNf(quest.nf_requirement);
  return nf !== '—' ? nfLabel(nf) : 'Tema adaptado';
}

function buildQuestDraft(quest: QuestSummary): QuestDraft {
  const schema = (quest.initial_schema_json ?? {}) as Record<string, unknown>;
  const tables = Array.isArray(schema.tablas)
    ? (schema.tablas as Array<Record<string, unknown>>).map((table) => ({
        nombre: String(table.nombre ?? 'tabla'),
        atributos: Array.isArray(table.atributos) ? table.atributos : [],
      }))
    : [];
  const dependencies = Array.isArray(schema.dependencias)
    ? schema.dependencias.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    answer: JSON.stringify(
      {
        tablas_normalizadas: tables.length
          ? tables.map((table) => ({
              nombre: table.nombre,
              atributos: table.atributos,
            }))
          : [
              {
                nombre: String(schema.tema ?? 'tabla_normalizada'),
                atributos: [],
              },
            ],
        dependencias: dependencies,
        observaciones: `Resuelve ${quest.title} con la forma normal ${normalizeNf(quest.nf_requirement)}`,
      },
      null,
      2,
    ),
    notes: '',
    hintsUsed: 0,
  };
}

function buildQuestMissions(mode: QuestMode, quest: QuestSummary): string[] {
  const theme = questThemeLabel(quest);
  const nf = normalizeNf(quest.nf_requirement);

  if (mode === 'basic') {
    return [
      `Detecta atributos no atómicos en ${theme}.`,
      `Separa los grupos repetidos para cumplir 1FN.`,
      `Deja la solución lista para validación rápida.`,
    ];
  }

  if (mode === 'intermediate') {
    return [
      `Identifica dependencias funcionales en ${theme}.`,
      `Elimina dependencias parciales antes de validar 3FN.`,
      `Compara el modelo antes y después de la descomposición.`,
      `Entrega un esquema coherente con ${nf}.`,
    ];
  }

  if (mode === 'advanced') {
    return [
      `Evalúa claves candidatas y determinantes de ${theme}.`,
      `Comprueba BCNF y evita determinantes que no sean superclave.`,
      `Asegura descomposición sin pérdida.`,
      `Documenta la justificación técnica.`,
    ];
  }

  return [
    `Detecta dependencias multivaluadas y de unión en ${theme}.`,
    `Reduce la relación hasta 4FN y 5FN.`,
    `Verifica que los joins reconstruyan el modelo sin pérdida.`,
    `Explica por qué la solución final es estable.`,
  ];
}

function buildQuestHints(mode: QuestMode, quest: QuestSummary): string[] {
  const nf = normalizeNf(quest.nf_requirement);
  const theme = questThemeLabel(quest);

  if (mode === 'basic') {
    return [
      `Revisa si ${theme} tiene listas dentro de una misma celda.`,
      `Cada celda debe contener un solo valor.`,
      `Piensa en una tabla separada por cada grupo repetido.`,
    ];
  }

  if (mode === 'intermediate') {
    return [
      `Observa qué atributos dependen solo de una parte de la clave.`,
      `Si ${nf} aparece poco consolidado, revisa dependencias parciales.`,
      `Elimina primero lo obvio y luego valida la descomposición.`,
    ];
  }

  if (mode === 'advanced') {
    return [
      `Verifica si el determinante es realmente una superclave.`,
      `BCNF exige más que una 3FN “aparente”.`,
      `No olvides preservar dependencias importantes.`,
    ];
  }

  return [
    `Busca relaciones independientes que generan combinaciones artificiales.`,
    `Si puedes reconstruir el modelo con joins limpios, vas por buen camino.`,
    `Justifica cada separación con reglas de negocio.`,
  ];
}

function buildQuestRubric(mode: QuestMode) {
  if (mode === 'basic') {
    return [
      { label: 'Atomicidad', value: 40 },
      { label: 'Claridad', value: 30 },
      { label: 'Estructura', value: 20 },
      { label: 'Entrega', value: 10 },
    ];
  }

  if (mode === 'intermediate') {
    return [
      { label: 'Corrección', value: 40 },
      { label: 'Preservación', value: 30 },
      { label: 'Análisis', value: 20 },
      { label: 'Tiempo', value: 10 },
    ];
  }

  if (mode === 'advanced') {
    return [
      { label: 'Corrección', value: 35 },
      { label: 'Sin pérdida', value: 25 },
      { label: 'Dependencias', value: 20 },
      { label: 'Justificación', value: 20 },
    ];
  }

  return [
    { label: 'Corrección', value: 30 },
    { label: '4FN / 5FN', value: 25 },
    { label: 'Justificación', value: 25 },
    { label: 'Rigor', value: 20 },
  ];
}

function buildQuestRequirements(quest: QuestSummary, mode: QuestMode, progress: Map<string, number> | null, completedCount: number, xp: number): QuestLockState {
  const nf = normalizeNf(quest.nf_requirement);
  const nfProgress = progress?.get(nf) ?? 0;

  const requirements: Array<{ label: string; fulfilled: boolean }> = [];
  const completedTarget = mode === 'basic' ? 0 : mode === 'intermediate' ? 1 : mode === 'advanced' ? 3 : 5;
  const xpTarget = mode === 'basic' ? 0 : mode === 'intermediate' ? 100 : mode === 'advanced' ? 300 : 500;
  const nfTarget = mode === 'basic' ? 0 : mode === 'intermediate' ? 20 : mode === 'advanced' ? 35 : 50;

  if (nf !== '—') {
    requirements.push({ label: `Dominar ${nf}`, fulfilled: nfProgress >= nfTarget });
  }

  if (mode !== 'basic') {
    requirements.push({ label: `${completedTarget} retos completados`, fulfilled: completedCount >= completedTarget });
    requirements.push({ label: `${xpTarget} XP acumulado`, fulfilled: xp >= xpTarget });
  }

  const locked = mode === 'expert'
    ? !(completedCount >= completedTarget && xp >= xpTarget && (nf === '—' || nfProgress >= nfTarget))
    : mode === 'advanced'
      ? !(completedCount >= completedTarget && (nf === '—' || nfProgress >= nfTarget))
      : mode === 'intermediate'
        ? !(completedCount >= completedTarget && (nf === '—' || nfProgress >= nfTarget))
        : false;

  const firstMissing = requirements.find((item) => !item.fulfilled)?.label ?? 'Sigue practicando para desbloquearlo.';

  return {
    locked,
    reason: locked ? firstMissing : 'Disponible para iniciar ahora mismo.',
    checklist: requirements.length
      ? requirements
      : [
          { label: 'Reto listo para comenzar', fulfilled: true },
        ],
    progress: requirements.length
      ? Math.round((requirements.filter((item) => item.fulfilled).length / requirements.length) * 100)
      : 100,
  };
}

function buildLocalValidationSummary(raw: string): LocalValidationSummary {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const tables = Array.isArray(parsed.tablas_normalizadas)
      ? (parsed.tablas_normalizadas as unknown[]).length
      : Array.isArray(parsed.tablas)
        ? (parsed.tablas as unknown[]).length
        : 0;
    const dependencies = Array.isArray(parsed.dependencias)
      ? (parsed.dependencias as unknown[]).length
      : 0;

    const notes = [
      tables > 0 ? `Tablas detectadas: ${tables}` : 'Agrega al menos una tabla normalizada.',
      dependencies > 0 ? `Dependencias detectadas: ${dependencies}` : 'Incluye dependencias o relaciones.',
      'La estructura JSON es válida.',
    ];

    return {
      valid: tables > 0,
      tables,
      dependencies,
      notes,
    };
  } catch {
    return {
      valid: false,
      tables: 0,
      dependencies: 0,
      notes: ['El JSON contiene errores de sintaxis.'],
    };
  }
}

function getQuestState(quest: QuestSummary, started: StartedMap, results: ResultMap, lockState: QuestLockState): QuestStatus {
  if (results[quest.id]?.status === 'completed') return 'completed';
  if (started[quest.id]) return 'started';
  if (lockState.locked) return 'blocked';
  return 'available';
}

function getQuestPriority(quest: QuestSummary, conceptProgress: ConceptProgressMap, recommendations: { concept: string; current_percentage: number; priority: string; reason: string }[] | undefined, started: StartedMap, results: ResultMap): number {
  const readiness = quest.readiness ?? getQuestReadiness(quest, conceptProgress);
  const normalized = normalizeNf(quest.nf_requirement);
  const recommendationIndex = recommendations?.findIndex((item) => normalizeNf(item.concept) === normalized) ?? -1;
  const recommendationBonus = recommendationIndex >= 0 ? Math.max(0, 42 - recommendationIndex * 8) : 0;
  const sessionBonus = started[quest.id] ? 16 : 0;
  const completedPenalty = results[quest.id]?.status === 'completed' ? 80 : 0;
  return readiness * 3 + recommendationBonus + sessionBonus + (quest.score ?? 0) - completedPenalty - quest.difficulty * 10;
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

function getBadgeIcon(name: string, icon: string, index: number) {
  const text = `${name} ${icon}`.toLowerCase();
  if (text.includes('bcnf')) return ShieldCheck;
  if (text.includes('leyenda')) return Crown;
  if (text.includes('perfección') || text.includes('perfect')) return Sparkles;
  if (text.includes('3fn')) return Trophy;
  if (text.includes('dependencia') || text.includes('link')) return Layers3;
  if (index === 0) return Star;
  if (index === 1) return Trophy;
  if (index === 2) return Award;
  return BadgeCheck;
}

function questComparisonCopy(mode: QuestMode) {
  if (mode === 'basic') {
    return {
      before: 'Una tabla con varios valores en la misma celda y columnas repetidas.',
      after: 'Valores atómicos y una fila por cada hecho independiente.',
    };
  }

  if (mode === 'intermediate') {
    return {
      before: 'Una clave compuesta con atributos que dependen solo de una parte.',
      after: 'Tablas separadas con dependencias completas y sin redundancia.',
    };
  }

  if (mode === 'advanced') {
    return {
      before: 'Un determinante que no es superclave y aún parece “correcto”.',
      after: 'Una descomposición BCNF con integridad y reglas bien separadas.',
    };
  }

  return {
    before: 'Relaciones que generan combinaciones artificiales o dependencias de unión.',
    after: 'Descomposición final 4FN/5FN con joins seguros y sin pérdida.',
  };
}

function getCurrentQuestStatus(quest: QuestSummary, started: StartedMap, results: ResultMap, lockState: QuestLockState): QuestStatus {
  return getQuestState(quest, started, results, lockState);
}

export const GamesView: React.FC<GamesViewProps> = ({ onNavigate, searchQuery = '' }) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [quests, setQuests] = useState<QuestSummary[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [insights, setInsights] = useState<Awaited<ReturnType<typeof fetchUserInsights>> | null>(null);
  const [selectedQuest, setSelectedQuest] = useState<QuestSummary | null>(null);
  const [selectedStage, setSelectedStage] = useState<QuestStage>('overview');
  const [started, setStarted] = useState<StartedMap>(() => readStartedGames());
  const [drafts, setDrafts] = useState<DraftMap>(() => readDrafts());
  const [results, setResults] = useState<ResultMap>(() => readResults());
  const [attemptCounts, setAttemptCounts] = useState<AttemptCountMap>(() => readAttemptCounts());
  const [localSearch, setLocalSearch] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | QuestMode>('all');
  const [nfFilter, setNfFilter] = useState<'all' | '1FN' | '2FN' | '3FN' | 'BCNF' | '4FN' | '5FN'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | QuestStatus>('all');
  const [rewardFilter, setRewardFilter] = useState<RewardTier>('all');
  const [startingId, setStartingId] = useState<number | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [workspace, setWorkspace] = useState<QuestDraft>({ answer: '', notes: '', hintsUsed: 0 });
  const [validation, setValidation] = useState<LocalValidationSummary | null>(null);

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

        const ordered = [...questList].sort((a, b) => {
          const scoreDelta = (b.score ?? 0) - (a.score ?? 0);
          if (scoreDelta !== 0) return scoreDelta;

          const readinessDelta = (b.readiness ?? 0) - (a.readiness ?? 0);
          if (readinessDelta !== 0) return readinessDelta;

          return a.difficulty - b.difficulty || b.xp_reward - a.xp_reward;
        });

        setQuests(ordered);
        setLeaderboard(ranking);
        setInsights(userInsights);
        setAchievements((achievementResponse.data?.data ?? []) as AchievementItem[]);

        const storedSelectedQuestId = (() => {
          try {
            const raw = localStorage.getItem(SELECTED_QUEST_KEY);
            if (!raw) return null;
            const parsed = Number(raw);
            return Number.isNaN(parsed) ? null : parsed;
          } catch {
            return null;
          }
        })();

        const initial =
          (storedSelectedQuestId ? ordered.find((quest) => quest.id === storedSelectedQuestId) ?? null : null) ??
          ordered.find((quest) => started[quest.id]) ??
          ordered[0] ??
          null;
        setSelectedQuest(initial);
        if (initial) {
          const saved = drafts[initial.id];
          setWorkspace(saved ?? buildQuestDraft(initial));
          const initialMode = difficultyMode(initial.difficulty);
          const lockState = buildQuestRequirements(initial, initialMode, userInsights?.progress?.nf_progress?.reduce((map, item) => {
            map.set(normalizeNf(item.concept), item.percentage);
            return map;
          }, new Map<string, number>()) ?? null, userInsights?.peerComparison?.your_quests_completed ?? 0, userInsights?.peerComparison?.your_xp ?? user.xp);
          setSelectedStage(getCurrentQuestStatus(initial, readStartedGames(), readResults(), lockState) === 'completed' ? 'result' : lockState.locked ? 'overview' : 'overview');
        }
      } catch {
        if (mounted) {
          setQuests([]);
          setLeaderboard([]);
          setAchievements([]);
          setInsights(null);
          setSelectedQuest(null);
          toast.error('No se pudieron cargar los retos reales.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [user]); // drafts and selected quest are intentionally not dependencies here.

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
    const completedFromResults = Object.values(results).filter((item) => item.status === 'completed').length;
    const questsCompleted = completedFromResults || (insights?.peerComparison?.your_quests_completed ?? 0);
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
  }, [achievements, insights?.peerComparison?.your_quests_completed, insights?.progress?.nf_progress, insights?.sessionAnalytics?.daily_activity, results, user?.xp]);

  const searchText = `${searchQuery} ${localSearch}`.trim().toLowerCase();

  const lockStateForQuest = (quest: QuestSummary) => {
    const completedCount = stats.questsCompleted;
    const xp = stats.xp;
    const progress = conceptProgress;
    const mode = difficultyMode(quest.difficulty);
    return buildQuestRequirements(quest, mode, progress, completedCount, xp);
  };

  const visibleQuests = useMemo(() => {
    return quests.filter((quest) => {
      const questState = getCurrentQuestStatus(quest, started, results, lockStateForQuest(quest));
      const nf = normalizeNf(quest.nf_requirement);
      const mode = difficultyMode(quest.difficulty);
      const matchesSearch =
        !searchText ||
        quest.title.toLowerCase().includes(searchText) ||
        quest.description.toLowerCase().includes(searchText) ||
        quest.quest_type.toLowerCase().includes(searchText) ||
        nf.toLowerCase().includes(searchText) ||
        questThemeLabel(quest).toLowerCase().includes(searchText);

      const matchesDifficulty = difficultyFilter === 'all' || difficultyMode(quest.difficulty) === difficultyFilter;
      const matchesNf = nfFilter === 'all' || nf === nfFilter;
      const matchesStatus = statusFilter === 'all' || questState === statusFilter;
      const matchesReward = rewardFilter === 'all' || rewardTierForXp(quest.xp_reward) === rewardFilter;

      return matchesSearch && matchesDifficulty && matchesNf && matchesStatus && matchesReward && mode;
    });
  }, [difficultyFilter, nfFilter, quests, results, searchText, started, statusFilter, conceptProgress, stats.questsCompleted, stats.xp]);

  const recommendedQuests = useMemo(() => {
    return [...visibleQuests].sort((a, b) => {
      const scoreDelta = getQuestPriority(b, conceptProgress, insights?.recommendations, started, results) - getQuestPriority(a, conceptProgress, insights?.recommendations, started, results);
      if (scoreDelta !== 0) return scoreDelta;
      return a.difficulty - b.difficulty || b.xp_reward - a.xp_reward;
    });
  }, [conceptProgress, insights?.recommendations, results, started, visibleQuests]);

  const dailyQuest = recommendedQuests[0] ?? visibleQuests[0] ?? quests[0] ?? null;
  const weeklyQuest = recommendedQuests[1] ?? recommendedQuests[0] ?? visibleQuests[1] ?? quests[1] ?? null;
  const nextQuest = recommendedQuests.find((quest) => quest.id !== selectedQuest?.id) ?? visibleQuests.find((quest) => quest.id !== selectedQuest?.id) ?? quests.find((quest) => quest.id !== selectedQuest?.id) ?? null;

  const activeQuest = selectedQuest ?? dailyQuest;
  const activeQuestMode = activeQuest ? difficultyMode(activeQuest.difficulty) : 'basic';
  const activeLockState = activeQuest ? lockStateForQuest(activeQuest) : { locked: false, reason: '', checklist: [], progress: 0 };
  const activeStatus = activeQuest ? getCurrentQuestStatus(activeQuest, started, results, activeLockState) : 'available';
  const activeStartedAt = activeQuest ? started[activeQuest.id]?.startedAt ?? null : null;
  const activeProgress = activeQuest ? getStartProgress(activeStartedAt) : { value: 0, label: '0 / 3' };
  const activeQuestReadiness = activeQuest ? getQuestReadiness(activeQuest, conceptProgress) : 0;
  const activeProgressValue = activeStatus === 'completed' ? 100 : activeStatus === 'started' ? activeProgress.value : activeQuestReadiness;
  const activeProgressLabel = activeQuest
    ? activeStatus === 'started'
      ? `En curso ${activeProgress.label}`
      : activeStatus === 'completed'
        ? '100%'
        : `${Math.round(activeQuestReadiness)}%`
    : '0 / 3';
  const activeExpires = activeQuest
    ? new Date((activeStartedAt ? new Date(activeStartedAt).getTime() : Date.now()) + questTimeHours(activeQuest.difficulty) * 60 * 60 * 1000).toISOString()
    : null;
  const activeTimeLabel = activeQuest ? questTimeLabel(activeQuest.difficulty) : '—';
  const activeAttemptLimit = activeQuest ? (activeQuestMode === 'expert' ? 1 : activeQuestMode === 'advanced' ? 2 : 3) : 0;
  const activeAttemptsUsed = activeQuest ? attemptCounts[activeQuest.id] ?? 0 : 0;
  const activeAttemptsLeft = activeQuest ? Math.max(0, activeAttemptLimit - activeAttemptsUsed) : 0;
  const activeDraft = activeQuest ? drafts[activeQuest.id] ?? buildQuestDraft(activeQuest) : workspace;
  const activeResult = activeQuest ? results[activeQuest.id] ?? null : null;
  const activeHints = activeDraft.hintsUsed;
  const comparisonCopy = activeQuest ? questComparisonCopy(activeQuestMode) : questComparisonCopy('basic');
  const missions = activeQuest ? buildQuestMissions(activeQuestMode, activeQuest) : [];
  const hints = activeQuest ? buildQuestHints(activeQuestMode, activeQuest) : [];
  const rubric = activeQuest ? buildQuestRubric(activeQuestMode) : [];
  const currentValidation = validation;

  useEffect(() => {
    if (!selectedQuest) return;
    const saved = drafts[selectedQuest.id];
    setWorkspace(saved ?? buildQuestDraft(selectedQuest));
    setValidation(null);
    if (results[selectedQuest.id]?.status === 'completed') {
      setSelectedStage('result');
      return;
    }
    if (started[selectedQuest.id]) {
      setSelectedStage('workspace');
      return;
    }
    setSelectedStage('overview');
  }, [drafts, results, selectedQuest?.id, started]);

  const groupedByDifficulty = useMemo(() => {
    return {
      basic: quests.filter((quest) => difficultyMode(quest.difficulty) === 'basic'),
      intermediate: quests.filter((quest) => difficultyMode(quest.difficulty) === 'intermediate'),
      advanced: quests.filter((quest) => difficultyMode(quest.difficulty) === 'advanced'),
      expert: quests.filter((quest) => difficultyMode(quest.difficulty) === 'expert'),
    };
  }, [quests]);

  const difficultyCards = useMemo(() => {
    return [
      {
        label: 'Básico',
        icon: Search,
        color: 'from-emerald-500 to-teal-500',
        tone: 'bg-emerald-50 border-emerald-200',
        description: 'Domina dependencias simples y 1FN.',
        quests: groupedByDifficulty.basic,
      },
      {
        label: 'Intermedio',
        icon: Rocket,
        color: 'from-blue-500 to-indigo-500',
        tone: 'bg-blue-50 border-blue-200',
        description: 'Elimina parciales y transitivas para llegar a 3FN.',
        quests: groupedByDifficulty.intermediate,
      },
      {
        label: 'Avanzado',
        icon: ShieldCheck,
        color: 'from-orange-500 to-rose-500',
        tone: 'bg-orange-50 border-orange-200',
        description: 'BCNF, requisitos y reglas más estrictas.',
        quests: groupedByDifficulty.advanced,
      },
      {
        label: 'Experto',
        icon: Crown,
        color: 'from-violet-600 to-fuchsia-600',
        tone: 'bg-violet-50 border-violet-200',
        description: '4FN y 5FN con justificación técnica completa.',
        quests: groupedByDifficulty.expert,
      },
    ];
  }, [groupedByDifficulty.advanced, groupedByDifficulty.basic, groupedByDifficulty.expert, groupedByDifficulty.intermediate]);

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

  const questActionLabel = (status: QuestStatus) => {
    if (status === 'completed') return 'Ver resultado';
    if (status === 'started') return 'Continuar reto';
    if (status === 'blocked') return 'Bloqueado';
    return 'Comenzar reto';
  };

  const handleSelectQuest = (quest: QuestSummary) => {
    setSelectedQuest(quest);
    setSelectedStage(results[quest.id]?.status === 'completed' ? 'result' : started[quest.id] ? 'workspace' : 'overview');
    setWorkspace(drafts[quest.id] ?? buildQuestDraft(quest));
    setValidation(null);
  };

  const handleStartQuest = async (quest: QuestSummary) => {
    if (lockStateForQuest(quest).locked && !started[quest.id]) {
      toast.info('Este reto todavía está bloqueado.');
      return;
    }

    setStartingId(quest.id);
    try {
      const response = await axiosInstance.post(`/quests/${quest.id}/start`);
      if (response.data?.success || response.status === 201) {
        const next = {
          ...started,
          [quest.id]: { startedAt: new Date().toISOString() },
        };
        setStarted(next);
        saveStartedGames(next);
        setSelectedQuest(quest);
        setWorkspace(drafts[quest.id] ?? buildQuestDraft(quest));
        setSelectedStage('workspace');
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
        saveStartedGames(next);
        setSelectedQuest(quest);
        setWorkspace(drafts[quest.id] ?? buildQuestDraft(quest));
        setSelectedStage('workspace');
        toast.info('Este reto ya está en curso.');
        return;
      }
      toast.error(message);
    } finally {
      setStartingId(null);
    }
  };

  const updateWorkspace = (patch: Partial<QuestDraft>) => {
    if (!selectedQuest) return;

    setWorkspace((current) => {
      const next = { ...current, ...patch };
      setDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts, [selectedQuest.id]: next };
        saveDrafts(nextDrafts);
        return nextDrafts;
      });
      return next;
    });
  };

  const handleUseHint = () => {
    if (!selectedQuest) return;
    updateWorkspace({ hintsUsed: Math.min(workspace.hintsUsed + 1, hints.length || workspace.hintsUsed + 1) });
    toast.info('Pista desbloqueada.');
  };

  const handleValidateDraft = () => {
    const summary = buildLocalValidationSummary(workspace.answer);
    setValidation(summary);
    if (summary.valid) {
      toast.success('Validación parcial lista.');
    } else {
      toast.info('Revisa la estructura del JSON antes de enviar.');
    }
  };

  const handleSaveDraft = () => {
    if (!selectedQuest) return;
    setDrafts((current) => {
      const next = { ...current, [selectedQuest.id]: workspace };
      saveDrafts(next);
      return next;
    });
    toast.success('Intento guardado.');
  };

  const handleResetQuest = () => {
    if (!selectedQuest) return;
    const fresh = buildQuestDraft(selectedQuest);
    setWorkspace(fresh);
    setValidation(null);
    setDrafts((current) => {
      const next = { ...current, [selectedQuest.id]: fresh };
      saveDrafts(next);
      return next;
    });
    setSelectedStage('workspace');
    toast.info('Se reinició el espacio de trabajo.');
  };

  const handleSubmitSolution = async () => {
    if (!selectedQuest) return;

    const validationResult = buildLocalValidationSummary(workspace.answer);
    if (!validationResult.valid) {
      setValidation(validationResult);
      toast.error('Primero corrige el JSON del intento.');
      return;
    }

    let parsedAnswer: unknown;
    try {
      parsedAnswer = JSON.parse(workspace.answer);
    } catch {
      toast.error('No se pudo leer el JSON del intento.');
      return;
    }

    setSubmittingId(selectedQuest.id);
    try {
      const response = await axiosInstance.post(`/quests/${selectedQuest.id}/submit`, {
        answer: parsedAnswer,
        hints_used: workspace.hintsUsed,
      });

      const responseData = response.data?.data ?? {};
      const submission: QuestSubmission = {
        status: responseData.status === 'completed' ? 'completed' : 'failed',
        score: Number(responseData.score ?? 0),
        xp_earned: Number(responseData.xp_earned ?? 0),
        message: response.data?.message ?? 'Respuesta enviada.',
        submittedAt: new Date().toISOString(),
        hintsUsed: workspace.hintsUsed,
      };

      setResults((current) => {
        const next = { ...current, [selectedQuest.id]: submission };
        saveResults(next);
        return next;
      });
      setAttemptCounts((current) => {
        const next = { ...current, [selectedQuest.id]: (current[selectedQuest.id] ?? 0) + 1 };
        saveAttemptCounts(next);
        return next;
      });

      setSelectedStage('result');
      toast.success(submission.status === 'completed' ? 'Solución aceptada.' : 'Solución enviada.');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'No se pudo enviar la solución.';
      toast.error(message);
    } finally {
      setSubmittingId(null);
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
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Centro de Retos</h1>
        <p className="mt-2 text-sm text-slate-500">Inicia sesión para ver retos reales y continuar tu progreso.</p>
      </div>
    );
  }

  const completedCount = stats.questsCompleted;
  const rewardProgress = Math.min(100, (completedCount / stats.weeklyGoal) * 100);
  const sessionWeeklyResetLabel = getNextWeeklyResetLabel();
  const levelSnapshot = getLevelSnapshot(stats.xp);
  const weeklyDays = getWeekdays(insights?.sessionAnalytics?.daily_activity ?? []);
  const activeQuestIcon = activeQuest ? questIcon(activeQuestMode) : Trophy;
  const ActiveQuestIcon = activeQuestIcon;
  const activeVisual = activeQuest ? getQuestVisualVariant(activeQuest) : QUEST_VISUAL_VARIANTS[0];

  const renderOverview = () => {
    if (!activeQuest) return null;
    const comparison = comparisonCopy;
    const questSteps = getQuestStageCount(activeQuest.difficulty);
    const timeLeft = activeStatus === 'started' ? formatCountdown(activeExpires) : activeTimeLabel;
    const missionsHere = missions;
    const requirements = activeLockState.checklist;

    return (
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Forma objetivo</div>
              <div className="mt-2 text-lg font-black text-slate-900">{nfLabel(activeQuest.nf_requirement)}</div>
              <div className="mt-1 text-sm text-slate-500">{questSteps} etapas guiadas</div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Estado</div>
              <div className="mt-2 text-lg font-black text-slate-900">{questStateLabel(activeStatus)}</div>
              <div className="mt-1 text-sm text-slate-500">{activeProgressLabel}</div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Tiempo</div>
              <div className="mt-2 text-lg font-black text-slate-900">{timeLeft}</div>
              <div className="mt-1 text-sm text-slate-500">{activeAttemptsLeft} intentos restantes</div>
            </div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <BookOpen className="h-4 w-4" />
              Qué aprenderás
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {[
                activeQuestMode === 'basic' ? 'Detectar valores no atómicos' : activeQuestMode === 'intermediate' ? 'Eliminar dependencias parciales' : activeQuestMode === 'advanced' ? 'Verificar BCNF' : 'Resolver 4FN y 5FN',
                activeQuestMode === 'basic' ? 'Separar tablas simples' : activeQuestMode === 'intermediate' ? 'Comparar antes y después' : activeQuestMode === 'advanced' ? 'Preservar dependencias importantes' : 'Justificar la descomposición final',
                activeQuestMode === 'basic' ? 'Pensar en filas y celdas atómicas' : activeQuestMode === 'intermediate' ? 'Reorganizar claves compuestas' : activeQuestMode === 'advanced' ? 'Evaluar determinantes' : 'Explicar joins sin pérdida',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Layers3 className="h-4 w-4" />
              Antes / Después
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Antes</div>
                <p className="mt-2 text-sm text-slate-700">{comparison.before}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-500">Después</div>
                <p className="mt-2 text-sm text-slate-700">{comparison.after}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-500">Misiones</div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{missionsHere.length} pasos</span>
            </div>
            <div className="mt-3 space-y-2">
              {missionsHere.map((mission, index) => (
                <div key={mission} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-700 shadow-sm">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">{mission}</div>
                    <div className="mt-1 text-xs text-slate-500">Paso guiado para resolver el reto.</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-500">Requisitos</div>
                <div className="mt-1 text-base font-bold text-slate-900">{activeLockState.locked ? 'Bloqueado' : 'Listo para iniciar'}</div>
              </div>
              {activeLockState.locked ? <Lock className="h-5 w-5 text-amber-500" /> : <BadgeCheck className="h-5 w-5 text-emerald-500" />}
            </div>
            <div className="mt-3 space-y-2">
              {requirements.map((item) => (
                <div key={item.label} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  {item.fulfilled ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                  <span className="text-slate-700">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              {activeLockState.reason}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-500">Rúbrica</div>
                <div className="mt-1 text-base font-bold text-slate-900">Cómo se evalúa</div>
              </div>
              <Award className="h-5 w-5 text-violet-500" />
            </div>
            <div className="mt-3 space-y-2">
                {rubric.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-700">{item.label}</span>
                  <span className="font-bold text-slate-900">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-500">Recompensa</div>
                <div className="mt-1 text-base font-bold text-slate-900">Cofre y XP</div>
              </div>
              <Gift className="h-5 w-5 text-violet-500" />
            </div>
            <div className="mt-3 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-500 text-white shadow-lg">
                <Trophy className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-500">Cofre potencial</div>
                <div className="text-lg font-bold text-slate-900">
                  {activeQuestMode === 'basic' ? 'Cofre básico' : activeQuestMode === 'intermediate' ? 'Cofre plata' : activeQuestMode === 'advanced' ? 'Cofre épico' : 'Cofre legendario'}
                </div>
                <div className="text-sm text-slate-500">+{activeQuest.xp_reward} XP base · {activeTimeLabel}</div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-500">Retos relacionados</div>
                <div className="mt-1 text-base font-bold text-slate-900">Ruta sugerida</div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-3 space-y-2">
              {(nextQuest ? [nextQuest] : []).slice(0, 2).map((quest) => {
                const mode = difficultyMode(quest.difficulty);
                return (
                  <button
                    type="button"
                    key={quest.id}
                    onClick={() => handleSelectQuest(quest)}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:bg-slate-100"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{quest.title}</div>
                      <div className="text-xs text-slate-500">{difficultyLabel(quest.difficulty)} · {questTypeLabel(quest.quest_type)}</div>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${questTypeTone(quest.quest_type)}`}>
                      {mode.toUpperCase()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderWorkspace = () => {
    if (!activeQuest) return null;
    const validationSummary = currentValidation;
    const hintsRemaining = hints.length - workspace.hintsUsed;

    return (
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-500">Área de trabajo</div>
                <div className="mt-1 text-base font-bold text-slate-900">Construye tu solución</div>
              </div>
              <FileJson className="h-5 w-5 text-blue-500" />
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Respuesta JSON</label>
                <textarea
                  value={workspace.answer}
                  onChange={(event) => updateWorkspace({ answer: event.target.value })}
                  rows={14}
                  className="w-full rounded-[22px] border border-slate-200 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  placeholder='{"tablas_normalizadas":[...],"dependencias":[...]}'
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Notas / criterios</label>
                <textarea
                  value={workspace.notes}
                  onChange={(event) => updateWorkspace({ notes: event.target.value })}
                  rows={14}
                  className="w-full rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  placeholder="Anota aquí por qué hiciste cada descomposición."
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-500">Validación parcial</div>
                  <div className="mt-1 text-base font-bold text-slate-900">Chequeo local</div>
                </div>
                <BadgeCheck className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {validationSummary ? (
                  <>
                    <div>Tablas creadas: {validationSummary.tables}</div>
                    <div>Dependencias declaradas: {validationSummary.dependencies}</div>
                    <div>{validationSummary.valid ? 'La estructura JSON es válida.' : 'Corrige el JSON antes de enviar.'}</div>
                  </>
                ) : (
                  <div>Presiona “Validar respuesta” para obtener feedback inmediato.</div>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-500">Intentos y pistas</div>
                  <div className="mt-1 text-base font-bold text-slate-900">Ritmo del reto</div>
                </div>
                <Clock3 className="h-5 w-5 text-violet-500" />
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div>Intentos sugeridos restantes: {activeAttemptsLeft}</div>
                <div>Pistas usadas: {activeHints} / {Math.max(hints.length, 1)}</div>
                <div>{activeStatus === 'blocked' ? activeLockState.reason : 'Puedes guardar y continuar cuando quieras.'}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-slate-50"
            >
              <Save className="h-4 w-4" />
              Guardar intento
            </button>
            <button
              type="button"
              onClick={handleValidateDraft}
              className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              <BadgeCheck className="h-4 w-4" />
              Validar respuesta
            </button>
            <button
              type="button"
              onClick={() => void handleSubmitSolution()}
              disabled={submittingId === activeQuest.id}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:brightness-105 disabled:cursor-wait disabled:opacity-70"
            >
              {submittingId === activeQuest.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar solución
            </button>
            <button
              type="button"
              onClick={handleResetQuest}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Reiniciar reto
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-500">Pistas progresivas</div>
                <div className="mt-1 text-base font-bold text-slate-900">Ayuda guiada</div>
              </div>
              <Sparkles className="h-5 w-5 text-amber-500" />
            </div>
            <div className="mt-3 space-y-2">
              {hints.slice(0, Math.max(workspace.hintsUsed, 1)).map((hint, index) => (
                <div key={hint} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Pista {index + 1}</div>
                  {hint}
                </div>
              ))}
              <button
                type="button"
                onClick={handleUseHint}
                disabled={hintsRemaining <= 0}
                className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Search className="h-4 w-4" />
                {hintsRemaining > 0 ? `Pedir pista (${hintsRemaining} restantes)` : 'Sin pistas restantes'}
              </button>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-500">Consejos técnicos</div>
                <div className="mt-1 text-base font-bold text-slate-900">Checklist rápido</div>
              </div>
              <Target className="h-5 w-5 text-blue-500" />
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">1. Verifica que el JSON esté completo.</div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">2. Revisa si el número de tablas tiene sentido.</div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">3. No olvides dependencias y relaciones.</div>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-500">Tabla original</div>
                <div className="mt-1 text-base font-bold text-slate-900">Base del caso</div>
              </div>
              <BookOpen className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(activeQuest.initial_schema_json ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderResult = () => {
    if (!activeQuest) return null;
    const result = activeResult ?? {
      status: 'failed' as const,
      score: 0,
      xp_earned: 0,
      message: 'Todavía no has enviado una solución.',
      submittedAt: new Date().toISOString(),
      hintsUsed: workspace.hintsUsed,
    };
    const resultTips = activeQuestMode === 'basic'
      ? ['Revisa atomicidad y valores repetidos.', 'Vuelve a probar con una estructura más simple.']
      : activeQuestMode === 'intermediate'
        ? ['Prioriza dependencias parciales y transitivas.', 'Busca tablas separadas por entidad y relación.']
        : activeQuestMode === 'advanced'
          ? ['Verifica superclaves y BCNF.', 'Justifica por qué la descomposición preserva integridad.']
          : ['Comprueba multivalores y dependencias de unión.', 'Explica por qué la solución no pierde información.'];

    return (
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-500">Resultado del reto</div>
                <div className="mt-1 text-base font-bold text-slate-900">
                  {result.status === 'completed' ? 'Solución validada' : 'Aún puedes mejorar'}
                </div>
              </div>
              <RingChart
                value={Math.max(0, Math.min(100, result.score))}
                label={result.status === 'completed' ? 'Correcto' : 'Puntaje'}
                sublabel={result.status === 'completed' ? 'Excelente' : 'Mejorable'}
                size={120}
                stroke={10}
                color={result.status === 'completed' ? '#10b981' : '#2563eb'}
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">XP ganado</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">{result.xp_earned}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Puntaje</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">{result.score}%</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Pistas</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">{result.hintsUsed}</div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-500">Recomendaciones</div>
                <div className="mt-1 text-base font-bold text-slate-900">Siguiente paso</div>
              </div>
              <Layers3 className="h-5 w-5 text-violet-500" />
            </div>
            <div className="mt-3 space-y-2">
              {resultTips.map((tip) => (
                <div key={tip} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  {tip}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-500">Comparación final</div>
                <div className="mt-1 text-base font-bold text-slate-900">Antes vs después</div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-slate-700">
                {comparisonCopy.before}
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-slate-700">
                {comparisonCopy.after}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-500">Cofre desbloqueado</div>
                <div className="mt-1 text-base font-bold text-slate-900">
                  {result.status === 'completed' ? 'Cofre ganador' : 'Cofre pendiente'}
                </div>
              </div>
              <Gift className="h-5 w-5 text-violet-500" />
            </div>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-500 text-white shadow-lg">
                <Trophy className="h-9 w-9" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-500">Estado final</div>
                <div className="text-xl font-bold text-slate-900">
                  {result.status === 'completed' ? '¡Reto superado!' : 'Sigue practicando'}
                </div>
                <div className="text-sm text-slate-500">{result.message}</div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-500">Siguientes acciones</div>
                <div className="mt-1 text-base font-bold text-slate-900">Mantén el progreso</div>
              </div>
              <Star className="h-5 w-5 text-amber-500" />
            </div>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => setSelectedStage('overview')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                <BookOpen className="h-4 w-4" />
                Ver guía de corrección
              </button>
              <button
                type="button"
                onClick={() => {
                  if (nextQuest) handleSelectQuest(nextQuest);
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:brightness-105"
              >
                <ArrowRight className="h-4 w-4" />
                Ir al siguiente reto
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.('leaderboard')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Users className="h-4 w-4" />
                Ver ranking
              </button>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-500">Resumen técnico</div>
                <div className="mt-1 text-base font-bold text-slate-900">Datos del envío</div>
              </div>
              <FileJson className="h-5 w-5 text-slate-500" />
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <div>Forma normal objetivo: {nfLabel(activeQuest.nf_requirement)}</div>
              <div>Tiempo estimado: {activeTimeLabel}</div>
              <div>Intentos usados: {activeAttemptsUsed}</div>
              <div>Fecha de envío: {new Date(result.submittedAt).toLocaleString('es-PE')}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderQuestDetail = () => {
    if (!activeQuest) {
      return (
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
          Selecciona un reto para ver su detalle, resolverlo o revisar el resultado.
        </div>
      );
    }

    const currentStatus = activeStatus;
    const heroVariant = activeVisual;

    return (
      <div className={`overflow-hidden rounded-[30px] border border-slate-200 bg-gradient-to-br ${questModeSurface(activeQuestMode)} shadow-[0_1px_0_rgba(15,23,42,0.02),0_18px_42px_rgba(15,23,42,0.06)]`}>
        <div className={`bg-gradient-to-r ${questModeTone(activeQuestMode)} p-5 text-white`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={`flex h-16 w-16 items-center justify-center rounded-[24px] bg-gradient-to-br ${heroVariant.icon} text-white shadow-lg backdrop-blur`}>
                <ActiveQuestIcon className="h-8 w-8" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white/90">
                    {questTypeLabel(activeQuest.quest_type)}
                  </span>
                  <span className="rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white/90">
                    {difficultyLabel(activeQuest.difficulty)}
                  </span>
                  <span className="rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white/90">
                    {questStateLabel(currentStatus)}
                  </span>
                </div>
                <h2 className="mt-3 text-3xl font-black leading-tight">{activeQuest.title}</h2>
                <p className="mt-2 max-w-2xl text-sm text-white/85">{activeQuest.description}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-white/80">
                  <span>{activeProgressLabel}</span>
                  <span>·</span>
                  <span>{formatCountdown(activeExpires)}</span>
                  <span>·</span>
                  <span>{getQuestStageCount(activeQuest.difficulty)} pasos</span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/15 bg-white/10 p-3 backdrop-blur">
              <RingChart
                value={activeProgressValue}
                label={currentStatus === 'completed' ? 'Completado' : currentStatus === 'started' ? 'En curso' : 'Progreso'}
                sublabel={questThemeLabel(activeQuest)}
                size={122}
                stroke={10}
                color="#ffffff"
                trackColor="rgba(255,255,255,0.18)"
                valueClassName="text-white"
              />
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200/80 bg-white px-5 py-3">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'overview', label: 'Detalle' },
              { key: 'workspace', label: 'Resolver' },
              { key: 'result', label: 'Resultado' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSelectedStage(tab.key as QuestStage)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  selectedStage === tab.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5 p-5">
          {currentStatus === 'blocked' && selectedStage !== 'result' ? (
            <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                  <Lock className="h-4 w-4" />
                  Vista de reto bloqueado
                </div>
                <div className="mt-3 text-2xl font-black text-slate-900">{activeQuest.title}</div>
                <p className="mt-2 text-sm text-slate-600">{activeLockState.reason}</p>
                <div className="mt-4 space-y-2">
                  {activeLockState.checklist.map((item) => (
                    <div key={item.label} className="flex items-center gap-2 rounded-2xl border border-amber-100 bg-white px-3 py-2 text-sm">
                      {item.fulfilled ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-500">Qué desbloquear primero</div>
                <div className="mt-3 space-y-2">
                  {recommendedQuests
                    .filter((quest) => quest.id !== activeQuest.id)
                    .slice(0, 3)
                    .map((quest) => (
                      <button
                        key={quest.id}
                        type="button"
                        onClick={() => handleSelectQuest(quest)}
                        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:bg-slate-100"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{quest.title}</div>
                          <div className="text-xs text-slate-500">{nfLabel(quest.nf_requirement)} · {difficultyLabel(quest.difficulty)}</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </button>
                    ))}
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate?.('academy')}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  <BookOpen className="h-4 w-4" />
                  Ver teoría previa
                </button>
              </div>
            </div>
          ) : selectedStage === 'workspace' ? (
            renderWorkspace()
          ) : selectedStage === 'result' && (activeResult || results[activeQuest.id]) ? (
            renderResult()
          ) : (
            renderOverview()
          )}

          {selectedStage !== 'workspace' && selectedStage !== 'result' && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm text-slate-600">
                {currentStatus === 'completed'
                  ? 'Este reto ya está resuelto. Puedes revisar el resultado o reintentar.'
                  : currentStatus === 'started'
                    ? 'El reto ya está en curso. Continúa al espacio de trabajo cuando quieras.'
                    : 'El reto está listo para iniciar cuando termines de revisar el detalle.'}
              </div>
              <div className="flex flex-wrap gap-2">
                {currentStatus === 'completed' ? (
                  <button
                    type="button"
                    onClick={() => setSelectedStage('result')}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:brightness-105"
                  >
                    <BadgeCheck className="h-4 w-4" />
                    Ver resultado
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleStartQuest(activeQuest)}
                    disabled={startingId === activeQuest.id || activeLockState.locked}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {startingId === activeQuest.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    {questActionLabel(currentStatus)}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStatsCard = (label: string, value: string | number, icon: React.ElementType, tone: string, note?: string) => {
    const Icon = icon;
    return (
      <article key={label} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02),0_12px_32px_rgba(15,23,42,0.04)]">
        <div className="flex items-start justify-between gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}>
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">DataQuest</span>
        </div>
        <div className="mt-4 text-2xl font-black text-slate-900">{value}</div>
        <div className="mt-1 text-sm font-semibold text-slate-700">{label}</div>
        {note ? <div className="mt-1 text-xs text-slate-500">{note}</div> : null}
      </article>
    );
  };

  const renderQuestCard = (quest: QuestSummary) => {
    const mode = difficultyMode(quest.difficulty);
    const state = getCurrentQuestStatus(quest, started, results, lockStateForQuest(quest));
    const isSelected = selectedQuest?.id === quest.id;
    const QuestCardIcon = questIcon(mode);
    const visual = getQuestVisualVariant(quest);
    const startProgress = getStartProgress(started[quest.id]?.startedAt ?? null);
    const readiness = quest.readiness ?? getQuestReadiness(quest, conceptProgress);
    const progressValue = state === 'completed' ? 100 : state === 'started' ? startProgress.value : readiness;
    const progressLabel = state === 'completed' ? '100%' : state === 'started' ? startProgress.label : `${Math.round(readiness)}%`;

    return (
      <button
        key={quest.id}
        type="button"
        onClick={() => handleSelectQuest(quest)}
      className={`group relative flex h-full flex-col overflow-hidden rounded-[26px] border p-4 text-left shadow-[0_1px_0_rgba(15,23,42,0.02),0_12px_32px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_1px_0_rgba(15,23,42,0.02),0_16px_40px_rgba(15,23,42,0.09)] ${
          isSelected ? 'border-blue-200 bg-blue-50/60' : 'border-slate-200 bg-white'
        }`}
      >
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${visual.accent} opacity-90`} />
        <div className="flex items-start justify-between gap-3">
          <div className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${visual.icon} text-white shadow-[0_10px_22px_rgba(37,99,235,0.18)]`}>
            <div className="absolute inset-0 bg-white/10" />
            <QuestCardIcon className="relative h-5 w-5 drop-shadow" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${questTypeTone(quest.quest_type)}`}>
              {difficultyLabel(quest.difficulty)}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${questStateTone(state)}`}>
              {questStateLabel(state)}
            </span>
          </div>
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
            {questTimeLabel(quest.difficulty)}
          </span>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${questModeTone(mode)}`}
            style={{ width: `${progressValue}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>{progressLabel}</span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{nfLabel(quest.nf_requirement)}</span>
        </div>

        <div
          className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
            state === 'started' || state === 'completed'
              ? 'border border-blue-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.22)]'
              : state === 'blocked'
                ? 'border border-amber-200 bg-amber-50 text-amber-700'
                : 'border border-blue-200 bg-blue-50 text-blue-700'
          }`}
        >
          {state === 'started' ? <ArrowRight className="h-4 w-4" /> : state === 'completed' ? <BadgeCheck className="h-4 w-4" /> : state === 'blocked' ? <Lock className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {questActionLabel(state)}
        </div>
      </button>
    );
  };

  const renderDifficultyCard = (item: { label: string; icon: React.ElementType; color: string; tone: string; description: string; quests: QuestSummary[] }) => {
    const Icon = item.icon;
    const startedCount = item.quests.filter((quest) => started[quest.id]).length;
    const masteredCount = item.quests.filter((quest) => (quest.readiness ?? getQuestReadiness(quest, conceptProgress)) >= 80 || results[quest.id]?.status === 'completed').length;
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
              if (firstQuest) handleSelectQuest(firstQuest);
            }}
            className="inline-flex items-center gap-1 rounded-2xl border border-current/20 bg-white/70 px-3 py-1.5"
          >
            Explorar retos
          </button>
        </div>

        <div className="mt-2 text-[11px] text-slate-500">{startedCount} en curso</div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">Centro de Retos</p>
          <h1 className="text-3xl font-black text-slate-900">Acepta desafíos, domina la normalización y gana recompensas</h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Cada reto cambia según tu progreso, tu dificultad y la forma normal que necesitas entrenar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate?.('leaderboard')}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-slate-50"
        >
          <Users className="h-4 w-4" />
          Ver ranking
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Retos activos', value: quests.length, icon: Sparkles, tone: 'bg-emerald-100 text-emerald-700' },
          { label: 'Completados', value: stats.questsCompleted, icon: BadgeCheck, tone: 'bg-blue-100 text-blue-700' },
          { label: 'XP acumulado', value: `${stats.xp} XP`, icon: Trophy, tone: 'bg-violet-100 text-violet-700' },
          { label: 'Racha actual', value: `${stats.streak} días`, icon: Flame, tone: 'bg-orange-100 text-orange-700' },
        ].map((card) => (
          <React.Fragment key={card.label}>
            {renderStatsCard(card.label, card.value, card.icon, card.tone, card.label === 'Retos activos' ? 'Catálogo dinámico' : undefined)}
          </React.Fragment>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02),0_12px_32px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Nivel y progreso</h2>
              <p className="mt-1 text-sm text-slate-500">{levelSnapshot.rankName}</p>
            </div>
            <RingChart
              value={levelSnapshot.progress}
              label={`Nivel ${levelSnapshot.level}`}
              sublabel="XP al siguiente nivel"
              size={110}
              stroke={10}
              color="#2563eb"
              trackColor="#e2e8f0"
            />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">XP total</div>
              <div className="mt-2 text-2xl font-black text-slate-900">{levelSnapshot.currentXP.toLocaleString('es-PE')}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Siguiente nivel</div>
              <div className="mt-2 text-2xl font-black text-slate-900">{levelSnapshot.nextXP.toLocaleString('es-PE')}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Consistencia</div>
              <div className="mt-2 text-2xl font-black text-slate-900">{stats.streak} días</div>
            </div>
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_1px_0_rgba(15,23,42,0.02),0_12px_32px_rgba(15,23,42,0.12)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Racha de estudio</h2>
              <p className="mt-1 text-sm text-white/70">Una chispa por cada día activo.</p>
            </div>
            <Flame className="h-5 w-5 text-orange-300" />
          </div>
          <div className="mt-4 flex items-center gap-2">
            {weeklyDays.map((day) => (
              <div
                key={day.key}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                  day.checked ? 'bg-emerald-400 text-slate-950 shadow-[0_8px_18px_rgba(16,185,129,0.2)]' : 'border border-white/15 bg-white/5 text-white/55'
                }`}
              >
                {day.label}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            Sostener la racha mantiene tus retos recomendados alineados con tu nivel y acelera la próxima recompensa.
          </div>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02),0_12px_32px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Reto diario</h2>
              <p className="mt-1 text-sm text-slate-500">Tu recomendación más inmediata.</p>
            </div>
            <CalendarDays className="h-5 w-5 text-blue-500" />
          </div>
          {dailyQuest ? (
            <button type="button" onClick={() => handleSelectQuest(dailyQuest)} className="mt-4 w-full text-left">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-500">{questTypeLabel(dailyQuest.quest_type)}</div>
                    <div className="mt-1 text-lg font-bold text-slate-900">{dailyQuest.title}</div>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${questTypeTone(dailyQuest.quest_type)}`}>
                    {difficultyLabel(dailyQuest.difficulty)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-500">{dailyQuest.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>+{dailyQuest.xp_reward} XP</span>
                  <span>{nfLabel(dailyQuest.nf_requirement)}</span>
                </div>
              </div>
            </button>
          ) : (
            <div className="mt-4 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No hay reto diario disponible.</div>
          )}
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02),0_12px_32px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Reto semanal</h2>
              <p className="mt-1 text-sm text-slate-500">{sessionWeeklyResetLabel}</p>
            </div>
            <Target className="h-5 w-5 text-violet-500" />
          </div>
          {weeklyQuest ? (
            <button type="button" onClick={() => handleSelectQuest(weeklyQuest)} className="mt-4 w-full text-left">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-500">{questThemeLabel(weeklyQuest)}</div>
                    <div className="mt-1 text-lg font-bold text-slate-900">{weeklyQuest.title}</div>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${questTypeTone(weeklyQuest.quest_type)}`}>
                    {difficultyLabel(weeklyQuest.difficulty)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-500">{weeklyQuest.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>+{weeklyQuest.xp_reward} XP</span>
                  <span>{questTimeLabel(weeklyQuest.difficulty)}</span>
                </div>
              </div>
            </button>
          ) : (
            <div className="mt-4 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No hay reto semanal disponible.</div>
          )}
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02),0_12px_32px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Próxima recompensa</h2>
              <p className="mt-1 text-sm text-slate-500">Completa 5 retos esta semana.</p>
            </div>
            <Gift className="h-5 w-5 text-violet-500" />
          </div>
          <div className="mt-4 flex items-center gap-4">
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
                <span>{completedCount} / {stats.weeklyGoal}</span>
                <span>{Math.round(rewardProgress)}%</span>
              </div>
              <div className="mt-3 text-xs text-slate-500">Meta semanal alcanzada por progreso real.</div>
            </div>
          </div>
        </article>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <section className="space-y-5 rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02),0_12px_32px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">Retos recomendados</h2>
              <p className="mt-1 text-sm text-slate-500">Ordenados por tu progreso actual y tus elecciones recientes.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <div className="relative w-full sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={localSearch}
                  onChange={(event) => setLocalSearch(event.target.value)}
                  placeholder="Buscar retos, temas o formas normales..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(['all', 'basic', 'intermediate', 'advanced', 'expert'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDifficultyFilter(mode)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    difficultyFilter === mode ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {mode === 'all' ? 'Todas' : difficultyLabel(mode === 'basic' ? 1 : mode === 'intermediate' ? 2 : mode === 'advanced' ? 3 : 4)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(['all', '1FN', '2FN', '3FN', 'BCNF', '4FN', '5FN'] as const).map((nf) => (
                <button
                  key={nf}
                  type="button"
                  onClick={() => setNfFilter(nf)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    nfFilter === nf ? 'bg-indigo-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {nf === 'all' ? 'Todas las formas' : nf}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(['all', 'available', 'started', 'completed', 'blocked'] as const).map((state) => (
                <button
                  key={state}
                  type="button"
                  onClick={() => setStatusFilter(state)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    statusFilter === state ? 'bg-slate-900 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {state === 'all' ? 'Todos los estados' : questStateLabel(state as QuestStatus)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(['all', 'basic', 'standard', 'epic', 'legendary'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setRewardFilter(tier)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    rewardFilter === tier ? 'bg-amber-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {rewardTierLabel(tier)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(recommendedQuests.length > 0 ? recommendedQuests : quests).slice(0, 4).map((quest) => renderQuestCard(quest))}
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            {difficultyCards.map((item) => renderDifficultyCard(item))}
          </div>
        </section>

        <section className="space-y-5">
          {renderQuestDetail()}
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02),0_12px_32px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Clasificación semanal</h3>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                    <Clock3 className="h-4 w-4" />
                    {getNextWeeklyResetLabel()}
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
                      {entry.rank === 1 ? <Trophy className="h-4 w-4" /> : entry.rank <= 3 ? <Award className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />}
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
                  <h3 className="text-lg font-bold text-slate-900">Insignias recientes</h3>
                  <p className="mt-1 text-sm text-slate-500">Logros desbloqueados por tu progreso.</p>
                </div>
                <button type="button" className="text-sm font-semibold text-blue-600 transition hover:text-blue-700">
                  Ver todas
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {badgeCards.length > 0 ? badgeCards.map((badge, index) => {
                  const BadgeIcon = getBadgeIcon(badge.name, badge.icon, index);
                  return (
                    <div key={badge.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className={`flex h-14 w-14 items-center justify-center rounded-[20px] ${badge.state.earned ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'} shadow-sm`}>
                          <BadgeIcon className="h-7 w-7" />
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.state.earned ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
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
        </section>
      </div>
    </div>
  );
};
