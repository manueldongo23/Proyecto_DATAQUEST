import axiosInstance from './api';
import type {
  ProgressLearningStep,
  ProgressSnapshot,
  LeaderboardEntry,
  ActivityFeed,
  QuestSummary,
  SchemaSummary,
  ValidationHistoryEntry,
} from '../types';

export const NF_ORDER = ['1FN', '2FN', '3FN', 'BCNF', '4FN', '5FN'] as const;

export const NF_PROGRESS: Record<string, number> = {
  DF: 10,
  '1FN': 24,
  '2FN': 48,
  '3FN': 72,
  BCNF: 86,
  '4FN': 93,
  '5FN': 100,
};

export const NF_LABELS: Record<string, string> = {
  DF: 'Dependencias Funcionales',
  '1FN': 'Primera Forma Normal',
  '2FN': 'Segunda Forma Normal',
  '3FN': 'Tercera Forma Normal',
  BCNF: 'Boyce-Codd Normal Form',
  '4FN': 'Cuarta Forma Normal',
  '5FN': 'Quinta Forma Normal',
};

export const LEVEL_COLORS: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  blocked: 'bg-rose-100 text-rose-700 border-rose-200',
  available: 'bg-amber-100 text-amber-700 border-amber-200',
  locked: 'bg-slate-100 text-slate-500 border-slate-200',
};

export function normalizeNf(value?: string | null): string {
  if (!value) return '—';
  const cleaned = value.toUpperCase().replace(/^([0-9])NF$/, '$1FN');
  if (cleaned === '1NF') return '1FN';
  if (cleaned === '2NF') return '2FN';
  if (cleaned === '3NF') return '3FN';
  if (cleaned === '4NF') return '4FN';
  if (cleaned === '5NF') return '5FN';
  return cleaned;
}

export function nfIndex(value?: string | null): number {
  const normalized = normalizeNf(value);
  return NF_ORDER.indexOf(normalized as (typeof NF_ORDER)[number]);
}

export function nfCompletion(value?: string | null): number {
  return NF_PROGRESS[normalizeNf(value)] ?? 0;
}

export function formatRelativeTime(value?: string | null): string {
  if (!value) return 'Hace un momento';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `Hace ${diffMinutes} min`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `Hace ${diffHours} h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `Hace ${diffDays} d`;
  }

  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: diffDays > 365 ? 'numeric' : undefined,
  });
}

export function formatLongDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function calculateStreak(activity: { date: string; schemas_validated: number }[]): number {
  if (!activity.length) return 0;

  const activeDays = activity
    .filter((item) => item.schemas_validated > 0)
    .map((item) => new Date(item.date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  if (!activeDays.length) return 0;

  let streak = 1;
  let current = activeDays[0];

  for (let i = 1; i < activeDays.length; i += 1) {
    const previous = activeDays[i];
    const diffDays = Math.round((current.getTime() - previous.getTime()) / 86400000);
    if (diffDays === 1) {
      streak += 1;
      current = previous;
      continue;
    }
    if (diffDays > 1) break;
  }

  return streak;
}

export function latestValidationLevel(schema: ValidationHistoryEntry): string | null {
  const last = schema.validaciones[schema.validaciones.length - 1];
  return last?.nivel ? normalizeNf(last.nivel) : null;
}

export function classifySchema(schema: ValidationHistoryEntry): 'completed' | 'in_progress' | 'blocked' | 'draft' {
  const level = latestValidationLevel(schema);
  const attempts = schema.validaciones.length;
  const levelIndex = nfIndex(level);

  if (level === '5FN') return 'completed';
  if (attempts === 0) return 'draft';
  if (levelIndex <= 0 && attempts >= 3) return 'blocked';
  if (levelIndex <= 1 && attempts >= 2) return 'blocked';
  return 'in_progress';
}

export function schemaProgressPercent(schema: ValidationHistoryEntry): number {
  return nfCompletion(latestValidationLevel(schema));
}

export function buildLearningPath(progress: ProgressSnapshot | null): ProgressLearningStep[] {
  const completed = progress?.nf_progress ?? [];
  const byConcept = new Map(completed.map((item) => [item.concept, item.percentage]));

  return [
    { nf: '1FN', name: 'Primera Forma Normal', description: 'Elimina grupos repetitivos y asegura atomicidad.', progress: byConcept.get('1FN') ?? 0, status: (byConcept.get('1FN') ?? 0) >= 80 ? 'completed' : (byConcept.get('1FN') ?? 0) > 0 ? 'in_progress' : 'available' },
    { nf: '2FN', name: 'Segunda Forma Normal', description: 'Elimina dependencias parciales en claves compuestas.', progress: byConcept.get('2FN') ?? 0, status: (byConcept.get('2FN') ?? 0) >= 80 ? 'completed' : (byConcept.get('2FN') ?? 0) > 0 ? 'in_progress' : 'locked' },
    { nf: '3FN', name: 'Tercera Forma Normal', description: 'Elimina dependencias transitivas y reduce redundancia.', progress: byConcept.get('3FN') ?? 0, status: (byConcept.get('3FN') ?? 0) >= 80 ? 'completed' : (byConcept.get('3FN') ?? 0) > 0 ? 'in_progress' : 'locked' },
    { nf: 'BCNF', name: 'Boyce-Codd Normal Form', description: 'Refuerza la 3FN con determinantes que sean superclave.', progress: byConcept.get('BCNF') ?? 0, status: (byConcept.get('BCNF') ?? 0) >= 80 ? 'completed' : (byConcept.get('BCNF') ?? 0) > 0 ? 'in_progress' : 'locked' },
    { nf: '4FN', name: 'Cuarta Forma Normal', description: 'Separa dependencias multivaluadas independientes.', progress: byConcept.get('4FN') ?? 0, status: (byConcept.get('4FN') ?? 0) >= 80 ? 'completed' : (byConcept.get('4FN') ?? 0) > 0 ? 'in_progress' : 'locked' },
    { nf: '5FN', name: 'Quinta Forma Normal', description: 'Descompone relaciones sin pérdida de información.', progress: byConcept.get('5FN') ?? 0, status: (byConcept.get('5FN') ?? 0) >= 80 ? 'completed' : (byConcept.get('5FN') ?? 0) > 0 ? 'in_progress' : 'locked' },
  ];
}

type FetchResult<T> = Promise<T>;

async function safeGet<T>(url: string, fallback: T): FetchResult<T> {
  try {
    const response = await axiosInstance.get(url);
    return (response.data?.data ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export async function fetchUserInsights(userId: number): Promise<{
  progress: ProgressSnapshot | null;
  history: ValidationHistoryEntry[];
  sessionAnalytics: {
    total_schemas: number;
    average_schemas_per_day: number;
    daily_activity: { date: string; schemas_validated: number }[];
    weekly_activity: { week: string; schemas_validated: number }[];
  } | null;
  peerComparison: {
    total_peers: number;
    your_xp: number;
    average_xp: number;
    your_rank: string;
    xp_percentile: number;
    xp_rank_position: number;
    your_accuracy: number;
    average_accuracy: number;
    your_quests_completed: number;
    average_quests_completed: number;
    concept_comparison: {
      concept: string;
      your_percentage: number;
      average_percentage: number;
      percentile: number;
    }[];
  } | null;
  recommendations: {
    concept: string;
    current_percentage: number;
    priority: string;
    reason: string;
  }[];
}> {
  const [progress, history, sessionAnalytics, peerComparison, recommendations] = await Promise.all([
    safeGet<ProgressSnapshot | null>('/progress', null),
    safeGet<ValidationHistoryEntry[]>(`/analytics/history/${userId}?limit=100`, []),
    safeGet<{
      total_schemas: number;
      average_schemas_per_day: number;
      daily_activity: { date: string; schemas_validated: number }[];
      weekly_activity: { week: string; schemas_validated: number }[];
    } | null>(`/analytics/session-analytics/${userId}`, null),
    safeGet<{
      total_peers: number;
      your_xp: number;
      average_xp: number;
      your_rank: string;
      xp_percentile: number;
      xp_rank_position: number;
      your_accuracy: number;
      average_accuracy: number;
      your_quests_completed: number;
      average_quests_completed: number;
      concept_comparison: {
        concept: string;
        your_percentage: number;
        average_percentage: number;
        percentile: number;
      }[];
    } | null>(`/analytics/peer-comparison/${userId}`, null),
    safeGet<{
      concept: string;
      current_percentage: number;
      priority: string;
      reason: string;
    }[]>(`/analytics/recommendations/${userId}`, []),
  ]);

  return {
    progress,
    history,
    sessionAnalytics,
    peerComparison,
    recommendations,
  };
}

export async function fetchActiveQuests(): Promise<QuestSummary[]> {
  const response = await safeGet<{
    current_page: number;
    data: QuestSummary[];
    total: number;
  } | QuestSummary[]>('/quests?limit=100', []);

  if (Array.isArray(response)) {
    return response;
  }

  return response.data ?? [];
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const response = await safeGet<LeaderboardEntry[] | { data: LeaderboardEntry[] }>('/leaderboard', []);
  if (Array.isArray(response)) {
    return response;
  }

  return response.data ?? [];
}

export async function fetchSchemas(): Promise<SchemaSummary[]> {
  return safeGet<SchemaSummary[]>('/schemas', []);
}

export async function fetchActivityFeed(): Promise<ActivityFeed> {
  return safeGet<ActivityFeed>('/activity?limit=100', {
    summary: {
      total_events: 0,
      validation_events: 0,
      log_events: 0,
      latest_activity_at: null,
    },
    timeline: [],
  });
}
