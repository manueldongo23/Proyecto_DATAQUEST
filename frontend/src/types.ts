// types.ts — DataQuest type definitions

export interface User {
  id: number;
  correo: string;
  apodo: string;
  role: 'usuario' | 'administrador';
  xp: number;
  rango: string;
  medallas: string[];
  activo: boolean;
  fecha_registro: string;
}

export interface FunctionalDependency {
  determinant: string[];
  dependent: string[];
}

export interface RelationSchema {
  schema_id?: number;
  table_name: string;
  description?: string;
  attributes: string[];
  dependencies: FunctionalDependency[];
}

export interface DidacticStep {
  step: string;
  explanation: string;
  violation_detail: string;
  rule_codd: string;
}

export interface DidacticDiagnosis {
  current_nf: string;
  violations: string[];
  didactic_steps: DidacticStep[];
  suggestions: string[];
  candidate_keys?: string[][];
}

export interface ValidationResponse {
    success: boolean;
    data: {
        schema_name: string;
        candidate_keys: string[][];
    diagnosis: DidacticDiagnosis;
    is_fully_normalized: boolean;
    message: string;
  };
    gamification?: {
        xp_total: number;
        rango_actual: string;
    };
}

export interface SchemaSummary {
    id: number;
    nombre: string;
    descripcion?: string | null;
    fecha_creacion: string;
    ultima_validacion: string | null;
    ultima_version?: string | null;
    archived_at?: string | null;
    last_activity_at?: string | null;
    validaciones_count?: number;
}

export interface ValidationHistoryEntry {
    id: number;
    nombre: string;
    descripcion?: string | null;
    fecha: string;
    archived_at?: string | null;
    last_activity_at?: string | null;
    validaciones: {
        nivel: string;
        fecha: string;
    }[];
}

export interface ActivityTimelineEntry {
    id: string;
    type: string;
    title: string;
    detail: string;
    date: string;
    meta?: Record<string, unknown>;
}

export interface ActivityFeed {
    summary: {
        total_events: number;
        validation_events: number;
        log_events: number;
        latest_activity_at?: string | null;
    };
    timeline: ActivityTimelineEntry[];
}

export interface ProgressLearningStep {
    nf: string;
    name: string;
    description: string;
    progress: number;
    status: 'locked' | 'available' | 'in_progress' | 'completed';
}

export interface ProgressSnapshot {
    user_id: number;
    apodo: string;
    xp: number;
    rango: string;
    nf_progress: {
        concept: string;
        percentage: number;
        mastered: boolean;
        attempts: number;
    }[];
    mastered_count: number;
    total_nf: number;
    achievements: {
        name: string;
        unlocked_at: string;
    }[];
}

export interface MasterySummary {
    concept: string;
    percentage: number;
    mastered: boolean;
}

export interface QuestSummary {
    id: number;
    title: string;
    description: string;
    quest_type: string;
    difficulty: number;
    xp_reward: number;
    nf_requirement: string | null;
    initial_schema_json?: Record<string, unknown> | null;
    generation_context?: Record<string, unknown> | null;
    score?: number;
    readiness?: number;
    recommended_nf?: string | null;
}

export interface Puzzle {
  id: number;
  enunciado: string;
  tablas_inicial: Record<string, string[]>;
  df_inicial: FunctionalDependency[];
  solucion_esperada: Record<string, unknown>;
  nivel_dificultad: number;
  activo: boolean;
}

export interface IntentoPuzzle {
  id: number;
  user_id: number;
  puzzle_id: number;
  puntuacion: number;
  fecha: string;
}

export interface RetoSemanal {
  id: number;
  descripcion: string;
  tablas: Record<string, string[]>;
  df: FunctionalDependency[];
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  user_id?: number;
  apodo: string;
  xp: number;
  rango?: string;
  puntuacion_total?: number;
  puzzles_completados?: number;
  retos_completados?: number;
  medallas?: string[];
}

export interface MasteryConcept {
  concept: string;
  percentage: number;
  mastered: boolean;
}

export type ViewType =
    | 'dashboard'
    | 'projects'
    | 'normalization'
    | 'validator'
    | 'academy'
    | 'dataquest'
    | 'games'
    | 'leaderboard'
    | 'glossary'
    | 'reports'
    | 'history'
    | 'settings'
    | 'sandbox';
