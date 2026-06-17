import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  Copy,
  Database,
  Download,
  Edit3,
  FileJson,
  FileText,
  Layers3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react';
import axiosInstance from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useSchemaStore } from '../store/schemaStore';
import { RingChart, RadarChart } from './ChartWidgets';
import { toast } from './Toast';
import { useConfetti } from '../hooks/useConfetti';
import {
  NF_ORDER,
  formatLongDateTime,
  normalizeNf,
  nfCompletion,
} from '../services/insights';
import type { FunctionalDependency, RelationSchema, ValidationResponse } from '../types';
import type { ViewType } from '../types';

interface ValidationRecord {
  id?: number;
  nivel_normalizacion: string;
  fecha: string;
  violaciones_json?: unknown[] | null;
}

interface SchemaDetail {
  id: number;
  nombre: string;
  estructura_json: string[] | null;
  dependencias_json: FunctionalDependency[] | null;
  fecha_creacion: string;
  validaciones: ValidationRecord[];
}

interface ReportData {
  generated_at: string;
  sql_engine?: string;
  schema: {
    name: string;
    attributes: string[];
    dependencies_count: number;
  };
  diagnosis: {
    current_nf: string;
    violations: string[];
    candidate_keys: string[][];
  };
  decomposition: {
    resulting_tables: Array<{
      name: string;
      attributes: string[];
      primary_key?: string[];
    }>;
    foreign_keys: Array<Record<string, unknown>>;
  };
  sql: string;
  recommendations: string[];
}

interface NormalizationLabProps {
  onNavigate?: (view: ViewType) => void;
}

const SQL_DIALECT_KEY = 'dataquest:last_sql_dialect';

type SqlDialect = 'postgresql' | 'mysql' | 'sqlite' | 'sqlserver';

const SQL_DIALECT_OPTIONS: Array<{ value: SqlDialect; label: string }> = [
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'sqlserver', label: 'SQL Server' },
];

function readStoredSqlDialect(): SqlDialect {
  try {
    const raw = localStorage.getItem(SQL_DIALECT_KEY);
    if (raw && SQL_DIALECT_OPTIONS.some((item) => item.value === raw)) {
      return raw as SqlDialect;
    }
  } catch {
    // Ignore storage errors.
  }

  return 'postgresql';
}

function saveStoredSqlDialect(dialect: SqlDialect) {
  localStorage.setItem(SQL_DIALECT_KEY, dialect);
}

function normalizeDependencyList(raw: unknown): FunctionalDependency[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const determinant = Array.isArray((item as FunctionalDependency).determinant)
        ? (item as FunctionalDependency).determinant.map((value) => String(value).trim()).filter(Boolean)
        : [];
      const dependent = Array.isArray((item as FunctionalDependency).dependent)
        ? (item as FunctionalDependency).dependent.map((value) => String(value).trim()).filter(Boolean)
        : [];
      if (!determinant.length || !dependent.length) return null;
      return { determinant, dependent };
    })
    .filter((item): item is FunctionalDependency => item !== null);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function parseAttributeList(raw: string): string[] {
  return dedupe(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function getViolationCount(record?: ValidationRecord | null): number {
  if (!record?.violaciones_json || !Array.isArray(record.violaciones_json)) {
    return 0;
  }
  return record.violaciones_json.length;
}

function getLatestValidation(records: ValidationRecord[]): ValidationRecord | null {
  if (!records.length) return null;
  const sorted = [...records].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  return sorted[sorted.length - 1] ?? null;
}

function getPreviousValidation(records: ValidationRecord[]): ValidationRecord | null {
  if (records.length < 2) return null;
  const sorted = [...records].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  return sorted[sorted.length - 2] ?? null;
}

function statusTone(status: 'completed' | 'partial' | 'blocked' | 'pending') {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'partial':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'blocked':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-50 text-slate-500 border-slate-200';
  }
}

function statusLabel(status: 'completed' | 'partial' | 'blocked' | 'pending') {
  switch (status) {
    case 'completed':
      return 'Cumplida';
    case 'partial':
      return 'No cumplida';
    case 'blocked':
      return 'Bloqueada';
    default:
      return 'Pendiente';
  }
}

function labelForViolation(text: string): { label: string; tone: string } {
  const lower = text.toLowerCase();
  if (lower.includes('transitiva') || lower.includes('3fn') || lower.includes('3nf')) {
    return { label: 'Afecta 3FN+', tone: 'bg-rose-100 text-rose-700' };
  }
  if (lower.includes('parcial') || lower.includes('2fn') || lower.includes('2nf')) {
    return { label: 'Afecta 2FN', tone: 'bg-amber-100 text-amber-700' };
  }
  if (lower.includes('multival') || lower.includes('4fn') || lower.includes('4nf')) {
    return { label: 'Afecta 4FN+', tone: 'bg-violet-100 text-violet-700' };
  }
  if (lower.includes('join') || lower.includes('5fn') || lower.includes('5nf')) {
    return { label: 'Afecta 5FN', tone: 'bg-cyan-100 text-cyan-700' };
  }
  return { label: 'Hallazgo', tone: 'bg-slate-100 text-slate-600' };
}

function findingSeverity(text: string): 'critical' | 'high' | 'medium' | 'low' {
  const lower = text.toLowerCase();
  if (lower.includes('transitiva') || lower.includes('3fn') || lower.includes('3nf') || lower.includes('5fn') || lower.includes('5nf')) {
    return 'critical';
  }
  if (lower.includes('parcial') || lower.includes('2fn') || lower.includes('2nf') || lower.includes('boyce') || lower.includes('bcnf')) {
    return 'high';
  }
  if (lower.includes('multival') || lower.includes('4fn') || lower.includes('4nf') || lower.includes('redund')) {
    return 'medium';
  }
  return 'low';
}

function findingSeverityLabel(severity: 'critical' | 'high' | 'medium' | 'low') {
  switch (severity) {
    case 'critical':
      return { label: 'Crítico', tone: 'bg-rose-100 text-rose-700 border-rose-200' };
    case 'high':
      return { label: 'Alto', tone: 'bg-amber-100 text-amber-700 border-amber-200' };
    case 'medium':
      return { label: 'Medio', tone: 'bg-blue-100 text-blue-700 border-blue-200' };
    default:
      return { label: 'Bajo', tone: 'bg-slate-100 text-slate-600 border-slate-200' };
  }
}

function impactLabel(index: number) {
  if (index <= 1) return { label: 'Alto', tone: 'bg-rose-100 text-rose-700' };
  if (index === 2) return { label: 'Medio', tone: 'bg-amber-100 text-amber-700' };
  return { label: 'Bajo', tone: 'bg-emerald-100 text-emerald-700' };
}

function inferDependencyTone(dependency: FunctionalDependency, candidateKeys: string[][], currentNf: string) {
  const determinant = dependency.determinant.join(', ');
  const dependent = dependency.dependent.join(', ');
  const candidateSet = candidateKeys.map((key) => key.join(', '));

  if (candidateSet.includes(determinant)) return 'Total';
  if (dependency.determinant.length > 1) return 'Parcial';
  if (normalizeNf(currentNf) !== '5FN' && dependency.dependent.length > dependency.determinant.length) return 'Derivada';
  if (dependent.length > determinant.length) return 'Total';
  return 'Parcial';
}

function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatElapsedSince(timestamp: string | null | undefined) {
  if (!timestamp) return '00:00:00';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '00:00:00';
  const diff = Math.max(0, Date.now() - date.getTime());
  const totalSeconds = Math.max(0, Math.floor(diff / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function buildSchemaPayload(
  tableName: string,
  attributes: string[],
  dependencies: FunctionalDependency[],
  schemaId?: number | null,
): RelationSchema & { schema_id?: number } {
  return {
    table_name: tableName.trim(),
    attributes: dedupe(attributes),
    dependencies,
    ...(typeof schemaId === 'number' ? { schema_id: schemaId } : {}),
  };
}

function countBuckets(records: ValidationRecord[]) {
  const completed = records.filter((record) => getViolationCount(record) === 0).length;
  const partial = records.filter((record) => {
    const count = getViolationCount(record);
    return count > 0 && count <= 2;
  }).length;
  const blocked = records.filter((record) => getViolationCount(record) > 2).length;

  return { completed, partial, blocked, total: records.length };
}

function buildRadarValues(violations: string[], currentNf: string): number[] {
  const base = NF_ORDER.map((nf, index) => {
    const nfNormalized = normalizeNf(nf);
    const currentIndex = NF_ORDER.indexOf(normalizeNf(currentNf) as (typeof NF_ORDER)[number]);
    const violationWeight = violations.reduce((score, violation) => {
      const lower = violation.toLowerCase();
      if (nfNormalized === '2FN' && lower.includes('2')) return score + 15;
      if (nfNormalized === '3FN' && lower.includes('3')) return score + 15;
      if (nfNormalized === 'BCNF' && (lower.includes('bcnf') || lower.includes('boyce'))) return score + 15;
      if (nfNormalized === '4FN' && lower.includes('4')) return score + 15;
      if (nfNormalized === '5FN' && lower.includes('5')) return score + 15;
      return score;
    }, 0);

    const distancePenalty = currentIndex >= 0 ? Math.abs(currentIndex - index) * 8 : index * 8;
    const value = Math.max(12, 100 - distancePenalty - violationWeight);
    return Math.min(100, value);
  });

  return base;
}

export const NormalizationLab: React.FC<NormalizationLabProps> = ({ onNavigate }) => {
  const { user, token, setUser } = useAuthStore();
  const { currentSchema, currentSchemaId, currentSchemaName, setCurrentSchema } = useSchemaStore();
  const { fireConfetti, fireSuccess } = useConfetti();

  const [loading, setLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [schemaId, setSchemaId] = useState<number | null>(currentSchemaId);
  const [tableName, setTableName] = useState(currentSchema?.table_name ?? currentSchemaName ?? '');
  const [attributes, setAttributes] = useState<string[]>(currentSchema?.attributes ?? []);
  const [dependencies, setDependencies] = useState<FunctionalDependency[]>(currentSchema?.dependencies ?? []);
  const [report, setReport] = useState<ReportData | null>(null);
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [schemaDetail, setSchemaDetail] = useState<SchemaDetail | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [draftAttribute, setDraftAttribute] = useState('');
  const [draftDeterminant, setDraftDeterminant] = useState('');
  const [draftDependent, setDraftDependent] = useState('');
  const [exporting, setExporting] = useState<'pdf' | 'html' | 'json' | null>(null);
  const [sqlDialect, setSqlDialect] = useState<SqlDialect>(() => readStoredSqlDialect());

  const currentSchemaPayload = useMemo(
    () => buildSchemaPayload(tableName, attributes, dependencies),
    [attributes, dependencies, tableName],
  );

  const latestValidation = useMemo(
    () => getLatestValidation(schemaDetail?.validaciones ?? []),
    [schemaDetail],
  );
  const previousValidation = useMemo(
    () => getPreviousValidation(schemaDetail?.validaciones ?? []),
    [schemaDetail],
  );

  const activeReport = report;
  const currentNf = normalizeNf(validation?.data?.diagnosis?.current_nf ?? activeReport?.diagnosis.current_nf ?? latestValidation?.nivel_normalizacion ?? '1FN');
  const activeViolations = validation?.data?.diagnosis?.violations ?? activeReport?.diagnosis.violations ?? [];
  const candidateKeys = activeReport?.diagnosis.candidate_keys ?? validation?.data?.diagnosis?.candidate_keys ?? [];
  const validationBuckets = useMemo(
    () => countBuckets(schemaDetail?.validaciones ?? []),
    [schemaDetail],
  );
  const completionValue = validationBuckets.total > 0
    ? Math.round((validationBuckets.completed / validationBuckets.total) * 100)
    : nfCompletion(currentNf);
  const radarValues = useMemo(
    () => buildRadarValues(activeViolations, currentNf),
    [activeViolations, currentNf],
  );

  useEffect(() => {
    saveStoredSqlDialect(sqlDialect);
  }, [sqlDialect]);

  const loadReport = useCallback(async (schema: RelationSchema) => {
    const response = await axiosInstance.post('/report/generate', {
      ...schema,
      engine: sqlDialect,
    });
    if (response.data?.success) {
      setReport(response.data.data as ReportData);
    }
  }, [sqlDialect]);

  useEffect(() => {
    if (!schemaDetail) {
      return;
    }

    const payload: RelationSchema = {
      table_name: schemaDetail.nombre,
      attributes: Array.isArray(schemaDetail.estructura_json) ? schemaDetail.estructura_json : [],
      dependencies: normalizeDependencyList(schemaDetail.dependencias_json),
    };

    void loadReport(payload);
  }, [loadReport, schemaDetail, sqlDialect]);

  const hydrateSchema = useCallback(
    async (detail: SchemaDetail) => {
      const nextSchema: RelationSchema = {
        table_name: detail.nombre,
        attributes: Array.isArray(detail.estructura_json) ? detail.estructura_json : [],
        dependencies: normalizeDependencyList(detail.dependencias_json),
      };

      setSchemaId(detail.id);
      setTableName(nextSchema.table_name);
      setAttributes(nextSchema.attributes);
      setDependencies(nextSchema.dependencies);
      setSchemaDetail(detail);
      setCurrentSchema(nextSchema, { name: detail.nombre, id: detail.id });
    },
    [setCurrentSchema],
  );

  const loadLatestSchema = useCallback(async () => {
    if (!user) {
      return null;
    }

    const listResponse = await axiosInstance.get('/schemas');
    const list = (listResponse.data?.data ?? []) as Array<{ id: number }>;
    if (!list.length) {
      return null;
    }

    const latestResponse = await axiosInstance.get(`/schemas/${list[0].id}`);
    if (!latestResponse.data?.data) {
      return null;
    }

    return latestResponse.data.data as SchemaDetail;
  }, [user]);

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      setLoading(true);
      try {
        let detail: SchemaDetail | null = null;

        if (schemaId) {
          const response = await axiosInstance.get(`/schemas/${schemaId}`);
          detail = response.data?.data as SchemaDetail;
        } else if (user) {
          detail = await loadLatestSchema();
        }

        if (!detail && currentSchema) {
          detail = {
            id: currentSchemaId ?? 0,
            nombre: currentSchema.table_name,
            estructura_json: currentSchema.attributes,
            dependencias_json: currentSchema.dependencies,
            fecha_creacion: new Date().toISOString(),
            validaciones: [],
          };
        }

        if (detail && mounted) {
          await hydrateSchema(detail);
        }
      } catch {
        if (mounted) {
          toast.error('No se pudo cargar el esquema actual.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void hydrate();

    return () => {
      mounted = false;
    };
  }, [hydrateSchema, loadLatestSchema, user?.id]);

  const handleValidate = useCallback(async () => {
    const schema = buildSchemaPayload(tableName, attributes, dependencies, currentSchemaId);
    if (!schema.table_name || schema.attributes.length === 0) {
      toast.warning('Completa el esquema antes de validar.');
      return;
    }

    setIsValidating(true);
    setCurrentSchema(schema, { name: schema.table_name });

    try {
      const response = await axiosInstance.post('/validate-schema', schema);
      if (!response.data?.success) {
        throw new Error('invalid_response');
      }

      const nextValidation = response.data as ValidationResponse;
      setValidation(nextValidation);

      if (nextValidation.gamification && user && token) {
        setUser(
          {
            ...user,
            xp: nextValidation.gamification.xp_total,
            rango: nextValidation.gamification.rango_actual,
          },
          token,
        );
      }

      const nf = normalizeNf(nextValidation.data?.diagnosis?.current_nf ?? '');
      if (nf === '5FN') {
        fireConfetti();
      } else {
        fireSuccess();
      }

      toast.success(nextValidation.data?.message || 'Validación completada.');

      const latest = await loadLatestSchema();
      if (latest) {
        await hydrateSchema(latest);
      }
    } catch {
      toast.error('No se pudo validar el esquema. Revisa el backend y vuelve a intentar.');
    } finally {
      setIsValidating(false);
    }
  }, [
    attributes,
    dependencies,
    fireConfetti,
    fireSuccess,
    hydrateSchema,
    loadLatestSchema,
    setCurrentSchema,
    setUser,
    tableName,
    token,
    user,
  ]);

  const handleShare = async () => {
    try {
      const payload = {
        table_name: tableName,
        current_nf: currentNf,
        violations: activeViolations,
        candidate_keys: candidateKeys,
      };
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toast.success('Resumen copiado al portapapeles.');
    } catch {
      toast.error('No se pudo copiar el resumen.');
    }
  };

  const handleExport = async (format: 'pdf' | 'html' | 'json') => {
    try {
      setExporting(format);
      const payload = {
        ...currentSchemaPayload,
        engine: sqlDialect,
      };

      if (format === 'json') {
        const response = await axiosInstance.post('/report/generate', payload);
        const content = JSON.stringify(response.data?.data ?? {}, null, 2);
        downloadTextFile(content, `${currentSchemaPayload.table_name || 'reporte'}-normalizacion.json`, 'application/json;charset=utf-8');
        toast.success('Reporte JSON descargado.');
        return;
      }

      const response = await axiosInstance.post('/export/html', payload, { responseType: 'text' });
      const html = typeof response.data === 'string' ? response.data : String(response.data ?? '');

      if (format === 'html') {
        downloadTextFile(html, `${currentSchemaPayload.table_name || 'reporte'}-normalizacion.html`, 'text/html;charset=utf-8');
        toast.success('Reporte HTML descargado.');
        return;
      }

      const preview = window.open('', '_blank', 'noopener,noreferrer');
      if (preview) {
        preview.document.open();
        preview.document.write(html);
        preview.document.close();
        preview.focus();
      } else {
        downloadTextFile(html, `${currentSchemaPayload.table_name || 'reporte'}-normalizacion.html`, 'text/html;charset=utf-8');
      }
      toast.success('Vista lista para imprimir como PDF.');
    } catch {
      toast.error('No se pudo exportar el informe.');
    } finally {
      setExporting(null);
    }
  };

  const handleAddAttribute = () => {
    const value = draftAttribute.trim();
    if (!value) return;
    if (attributes.includes(value)) {
      toast.warning('Ese atributo ya existe.');
      return;
    }
    setAttributes((current) => [...current, value]);
    setDraftAttribute('');
  };

  const handleAddDependency = () => {
    const determinant = parseAttributeList(draftDeterminant);
    const dependent = parseAttributeList(draftDependent);

    if (!determinant.length || !dependent.length) {
      toast.warning('Completa determinante y dependiente.');
      return;
    }

    const nextDependency: FunctionalDependency = { determinant, dependent };
    const exists = dependencies.some(
      (item) =>
        item.determinant.join(',') === nextDependency.determinant.join(',') &&
        item.dependent.join(',') === nextDependency.dependent.join(','),
    );

    if (exists) {
      toast.warning('Esa dependencia ya existe.');
      return;
    }

    setDependencies((current) => [...current, nextDependency]);
    setDraftDeterminant('');
    setDraftDependent('');
  };

  const candidateKeyText = candidateKeys.length
    ? candidateKeys.map((key) => `{${key.join(', ')}}`).join(' • ')
    : 'Sin claves candidatas detectadas';

  const completionLabel = completionValue >= 90 ? 'Excelente' : completionValue >= 70 ? 'Sólido' : 'En progreso';

  const validationRows = (schemaDetail?.validaciones ?? []).slice().sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  const nfRows = NF_ORDER.map((nf, index) => {
    const currentIndex = NF_ORDER.indexOf(currentNf as (typeof NF_ORDER)[number]);
    let status: 'completed' | 'partial' | 'blocked' | 'pending' = 'pending';

    if (currentIndex === -1) {
      status = index === 0 ? 'partial' : 'pending';
    } else if (index < currentIndex) {
      status = 'completed';
    } else if (index === currentIndex) {
      status = activeViolations.length === 0 ? 'completed' : 'partial';
    } else if (index === currentIndex + 1) {
      status = 'blocked';
    }

    return {
      nf,
      status,
      title:
        nf === '1FN' ? 'Primera Forma Normal' :
        nf === '2FN' ? 'Segunda Forma Normal' :
        nf === '3FN' ? 'Tercera Forma Normal' :
        nf === 'BCNF' ? 'Boyce-Codd Normal Form' :
        nf === '4FN' ? 'Cuarta Forma Normal' : 'Quinta Forma Normal',
    };
  });

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-sm font-semibold text-slate-600">Cargando validación...</span>
        </div>
      </div>
    );
  }

  const schemaTitle = tableName || schemaDetail?.nombre || 'Esquema sin nombre';
  const ruleCount = Math.max(attributes.length + dependencies.length + candidateKeys.length, validationRows.length || 1);
  const matchedRules = Math.min(ruleCount, Math.max(1, Math.round(completionValue / 100 * ruleCount)));
  const partialRules = validationBuckets.partial || (activeViolations.length > 0 ? 1 : 0);
  const failedRules = Math.max(0, ruleCount - matchedRules - partialRules);
  const suggestions = activeReport?.recommendations ?? validation?.data?.diagnosis?.suggestions ?? [];
  const findingBuckets = activeViolations.reduce(
    (acc, violation) => {
      const severity = findingSeverity(violation);
      acc.total += 1;
      acc[severity] += 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
  );
  const validationIdentifier = latestValidation?.id
    ? `VAL-${latestValidation.id}`
    : schemaDetail?.id
      ? `VAL-${schemaDetail.id}`
      : 'LOCAL';
  const durationText = formatElapsedSince(activeReport?.generated_at ?? latestValidation?.fecha ?? schemaDetail?.fecha_creacion);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
            <button
              type="button"
              onClick={() => onNavigate?.('dashboard')}
              className="transition hover:text-blue-700"
            >
              Validador
            </button>
            <ChevronRight className="h-4 w-4" />
            <span>Validación: {schemaTitle}</span>
          </div>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Validación: {schemaTitle}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Revisa el nivel de normalización del esquema actual, inspecciona los hallazgos detectados y exporta un informe listo para compartir.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
              <Clock3 className="h-3.5 w-3.5" />
              {formatLongDateTime(latestValidation?.fecha ?? schemaDetail?.fecha_creacion)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              {completionLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
              <Database className="h-3.5 w-3.5" />
              {schemaDetail?.validaciones.length ?? 0} validaciones registradas
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleExport('pdf')}
            disabled={exporting !== null}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-slate-50 disabled:opacity-60"
          >
            <FileText className="h-4 w-4" />
            Exportar PDF
          </button>
          <button
            type="button"
            onClick={() => void handleExport('html')}
            disabled={exporting !== null}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-slate-50 disabled:opacity-60"
          >
            <Code2 className="h-4 w-4" />
            Exportar HTML
          </button>
          <button
            type="button"
            onClick={() => void handleExport('json')}
            disabled={exporting !== null}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-slate-50 disabled:opacity-60"
          >
            <FileJson className="h-4 w-4" />
            Exportar JSON
          </button>
          <button
            type="button"
            onClick={() => void handleValidate()}
            disabled={isValidating}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:brightness-105 disabled:opacity-60"
          >
            {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
            Volver a validar
          </button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-4">
        <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Cumplimiento general</h2>
              <p className="mt-1 text-sm text-slate-500">Se basa en el historial de validaciones del esquema.</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-2 text-blue-600">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <RingChart
              value={completionValue}
              label="Cumplimiento"
              sublabel={`${validationBuckets.completed} / ${validationBuckets.total || 1}`}
              size={104}
              stroke={9}
              color="#14b8a6"
            />
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-slate-500">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Cumple
                </span>
                <strong className="text-slate-900">{validationBuckets.completed}</strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-slate-500">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  Parcial
                </span>
                <strong className="text-slate-900">{validationBuckets.partial}</strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-slate-500">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  No cumple
                </span>
                <strong className="text-slate-900">{validationBuckets.blocked}</strong>
              </div>
            </div>
          </div>
          <div className="mt-3 text-sm font-semibold text-emerald-700">
            {completionValue}% cumplimiento
          </div>
          <div className="text-xs text-slate-500">
            {matchedRules} reglas cumplen, {partialRules} están en revisión y {failedRules} requieren corrección.
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">Máxima forma normal alcanzada</h2>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-lg font-bold text-amber-700">
              {currentNf}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {currentNf === '1FN' ? 'Primera Forma Normal' :
                 currentNf === '2FN' ? 'Segunda Forma Normal' :
                 currentNf === '3FN' ? 'Tercera Forma Normal' :
                 currentNf === 'BCNF' ? 'Boyce-Codd Normal Form' :
                 currentNf === '4FN' ? 'Cuarta Forma Normal' :
                 currentNf === '5FN' ? 'Quinta Forma Normal' : 'Forma normal detectada'}
              </p>
              <p className="text-sm text-slate-500">
                {activeViolations.length > 0
                  ? 'Aún existen violaciones activas en el esquema.'
                  : 'El esquema no presenta violaciones críticas en la última revisión.'}
              </p>
              <div className="mt-2.5 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                <Layers3 className="h-3.5 w-3.5" />
                {candidateKeys.length} claves candidatas
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">Estado de validación</h2>
          <div className="mt-3 flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${activeViolations.length === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              {activeViolations.length === 0 ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-base font-bold text-slate-900">
                {activeViolations.length === 0 ? 'Completada' : 'En progreso'}
              </p>
              <p className="text-sm text-slate-500">
                {activeViolations.length === 0
                  ? 'Sin errores críticos de integridad.'
                  : `${activeViolations.length} hallazgos pendientes de revisión.`}
              </p>
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            La validación se apoya en el motor de normalización y en el último historial persistido para este esquema.
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">Detalles del objeto</h2>
          <dl className="mt-3 space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Proyecto</dt>
              <dd className="font-semibold text-slate-900">{schemaDetail?.nombre || schemaTitle}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Esquema / Tabla</dt>
              <dd className="font-semibold text-slate-900">{schemaTitle}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Registros analizados</dt>
              <dd className="font-semibold text-slate-900">{ruleCount.toLocaleString('es-PE')}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Última actualización</dt>
              <dd className="font-semibold text-slate-900">
                {formatLongDateTime(latestValidation?.fecha ?? schemaDetail?.fecha_creacion)}
              </dd>
            </div>
          </dl>
        </article>
      </div>

      <div className="grid gap-3 xl:grid-cols-6">
        {nfRows.map((stage, index) => (
          <article
            key={stage.nf}
            className={`rounded-2xl border p-3.5 shadow-sm ${statusTone(stage.status)} ${index === 2 ? 'ring-2 ring-blue-200' : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-bold">{stage.nf}</h3>
                <p className="text-[10px] font-medium leading-tight">{stage.title}</p>
              </div>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/70">
                {stage.status === 'completed' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : stage.status === 'partial' ? (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                ) : stage.status === 'blocked' ? (
                  <X className="h-4 w-4 text-rose-600" />
                ) : (
                  <Clock3 className="h-4 w-4 text-slate-400" />
                )}
              </span>
            </div>
            <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
              {statusLabel(stage.status)}
            </div>
            {index === Math.min(NF_ORDER.indexOf(currentNf as (typeof NF_ORDER)[number]), NF_ORDER.length - 1) && activeViolations.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowEditor(true)}
                className="mt-2.5 inline-flex items-center gap-1 rounded-lg border border-current/20 bg-white/80 px-3 py-1.5 text-xs font-semibold"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                Revisar
              </button>
            ) : (
              <div className="mt-2.5 text-[11px] font-medium opacity-80">
                {stage.status === 'completed' ? 'Atributos verificados.' : stage.status === 'partial' ? 'Detectadas dependencias parciales.' : stage.status === 'blocked' ? 'Puedo sugerir la siguiente corrección.' : 'Pendiente de evaluar.'}
              </div>
            )}
          </article>
        ))}
      </div>

      {showEditor && (
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.15fr_0.95fr]">
        <section className="space-y-4">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Estructura original</h2>
                <p className="mt-1 text-sm text-slate-500">Atributos y dependencias del esquema actual.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditor((current) => !current)}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-white"
              >
                <Edit3 className="h-4 w-4" />
                Editar estructura
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Tabla</div>
              <div className="mt-1 text-lg font-bold text-slate-900">{schemaTitle}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  {attributes.length} atributos
                </span>
                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                  {dependencies.length} dependencias
                </span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {candidateKeys.length} claves candidatas
                </span>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1.4fr_0.6fr_0.6fr] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                <span>Atributo</span>
                <span>Rol</span>
                <span>Estado</span>
              </div>
              <div className="divide-y divide-slate-100">
                {attributes.map((attribute) => {
                  const isKey = candidateKeys.some((key) => key.includes(attribute));
                  return (
                    <div key={attribute} className="grid grid-cols-[1.4fr_0.6fr_0.6fr] px-4 py-3 text-sm">
                      <div className="font-medium text-slate-900">{attribute}</div>
                      <div className="text-slate-500">{isKey ? 'PK' : 'Atributo'}</div>
                      <div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${isKey ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {isKey ? 'Clave' : 'Normal'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              <div className="font-semibold text-slate-900">Claves candidatas</div>
              <p className="mt-1">{candidateKeyText}</p>
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">Estadísticas rápidas</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { label: 'Atributos', value: attributes.length, tone: 'bg-blue-50 text-blue-700' },
                { label: 'Claves candidatas', value: candidateKeys.length, tone: 'bg-emerald-50 text-emerald-700' },
                { label: 'Dependencias detectadas', value: dependencies.length, tone: 'bg-violet-50 text-violet-700' },
                { label: 'Problemas detectados', value: activeViolations.length, tone: 'bg-rose-50 text-rose-700' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${item.tone}`}>{item.label}</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{item.value}</div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowEditor(true)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              <BookOpen className="h-4 w-4" />
              Ver detalle de reglas evaluadas
            </button>
          </article>
        </section>

        <section className="space-y-4">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Diagnóstico de normalización</h2>
                <span className="mt-2 inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
                  {activeViolations.length || 0} problemas detectados
                </span>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${activeViolations.length === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                {currentNf}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {activeViolations.length > 0 ? (
                activeViolations.map((violation, index) => {
                  const hint = labelForViolation(violation);
                  return (
                    <div
                      key={`${violation}-${index}`}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1 h-2.5 w-2.5 rounded-full bg-rose-500" />
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900">{violation}</h3>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${hint.tone}`}>
                              {hint.label}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            Revisa la dependencia involucrada y aplica la siguiente corrección sugerida por el motor de normalización.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
                  No se detectaron violaciones activas. El esquema está listo para avanzar a la siguiente revisión.
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowEditor((current) => !current)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-slate-50"
            >
              <ArrowRight className="h-4 w-4" />
              Ver detalle de problemas
            </button>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-900">Dependencias funcionales detectadas</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                {dependencies.length}
              </span>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[0.6fr_1fr_1fr_0.7fr] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                <span>#</span>
                <span>Determinante</span>
                <span>Dependiente</span>
                <span>Tipo</span>
              </div>
              <div className="divide-y divide-slate-100">
                {dependencies.length > 0 ? (
                  dependencies.map((dependency, index) => {
                    const tone = inferDependencyTone(dependency, candidateKeys, currentNf);
                    return (
                      <div key={`${dependency.determinant.join(',')}-${dependency.dependent.join(',')}`} className="grid grid-cols-[0.6fr_1fr_1fr_0.7fr] items-center px-4 py-3 text-sm">
                        <div className="font-semibold text-slate-500">{index + 1}</div>
                        <div className="font-medium text-slate-900">{dependency.determinant.join(', ')}</div>
                        <div className="font-medium text-slate-900">{dependency.dependent.join(', ')}</div>
                        <div>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${tone === 'Total' ? 'bg-emerald-100 text-emerald-700' : tone === 'Parcial' ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'}`}>
                            {tone}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">
                    No hay dependencias cargadas para este esquema.
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowEditor(true)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              <Layers3 className="h-4 w-4" />
              Gestionar dependencias
            </button>
          </article>
        </section>

        <section className="space-y-4">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Progreso de normalización</h2>
                <p className="mt-1 text-sm text-slate-500">Ruta actual y siguiente paso recomendado.</p>
              </div>
              <button
                type="button"
                onClick={() => void handleValidate()}
                className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-white"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Ver reporte
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {nfRows.map((stage) => (
                <div key={stage.nf} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${stage.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : stage.status === 'partial' ? 'bg-amber-50 text-amber-600' : stage.status === 'blocked' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                    {stage.status === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : stage.status === 'partial' ? <AlertTriangle className="h-5 w-5" /> : stage.status === 'blocked' ? <X className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-slate-900">{stage.nf}</div>
                        <div className="text-xs text-slate-500">{stage.title}</div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${stage.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : stage.status === 'partial' ? 'bg-amber-100 text-amber-700' : stage.status === 'blocked' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
                        {statusLabel(stage.status)}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {stage.status === 'completed'
                        ? 'Atributos verificados.'
                        : stage.status === 'partial'
                          ? 'Dependencias parciales detectadas.'
                          : stage.status === 'blocked'
                            ? 'Listo para evaluar el siguiente nivel.'
                            : 'Pendiente de evaluación.'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-900">Vista ER (mini)</h3>
              <button
                type="button"
                onClick={() => setShowEditor((current) => !current)}
                className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
              >
                Expandir
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              {(activeReport?.decomposition.resulting_tables?.length
                ? activeReport.decomposition.resulting_tables
                : [
                    {
                      name: schemaTitle,
                      attributes,
                      primary_key: candidateKeys[0] ?? [],
                    },
                  ]
              ).slice(0, 3).map((table) => (
                <div key={table.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-bold text-slate-900">{table.name}</div>
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    {(table.attributes ?? []).slice(0, 4).map((attribute) => (
                      <div key={attribute} className="rounded-lg bg-white px-3 py-1.5">{attribute}</div>
                    ))}
                    {!(table.attributes ?? []).length && (
                      <div className="rounded-lg bg-white px-3 py-1.5 text-slate-400">Sin atributos</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {activeReport?.decomposition.resulting_tables?.length ? (
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <ArrowRight className="h-3.5 w-3.5" />
                <span>{activeReport.decomposition.resulting_tables.length} tablas propuestas en la descomposición.</span>
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-500">
                Sin descomposición adicional. Puedes usar el editor para ajustar el esquema.
              </div>
            )}
          </article>
        </section>
      </div>
      )}

      <div className="grid gap-3 xl:grid-cols-4">
        <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Resumen de validación</h2>
              <p className="mt-1 text-sm text-slate-500">Totales calculados a partir del historial actual.</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-2 text-blue-600">
              <BookOpen className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <RingChart
              value={completionValue}
              label="Cumplimiento"
              sublabel={`${matchedRules} / ${ruleCount} reglas`}
              size={104}
              stroke={9}
              color="#14b8a6"
            />
            <div className="flex-1 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-slate-500">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Cumple
                </span>
                <strong className="text-slate-900">{matchedRules}</strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-slate-500">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  Parcial
                </span>
                <strong className="text-slate-900">{partialRules}</strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-slate-500">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  No cumple
                </span>
                <strong className="text-slate-900">{failedRules}</strong>
              </div>
            </div>
          </div>
          <div className="mt-3 text-sm font-semibold text-emerald-700">
            {completionValue}% cumplimiento
          </div>
          <div className="text-xs text-slate-500">
            {matchedRules} reglas cumplen, {partialRules} están en revisión y {failedRules} requieren corrección.
          </div>
          <button
            type="button"
            onClick={() => setShowEditor(true)}
            className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            Ver detalle de reglas evaluadas
          </button>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Hallazgos principales</h2>
              <p className="mt-1 text-sm text-slate-500">Dependencias y anomalías detectadas por el motor.</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('reports')}
              className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
            >
              Ver todos los hallazgos
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {[
              { label: 'Críticos', value: findingBuckets.critical, tone: 'border-rose-200 bg-rose-50 text-rose-700' },
              { label: 'Altos', value: findingBuckets.high, tone: 'border-amber-200 bg-amber-50 text-amber-700' },
              { label: 'Medios', value: findingBuckets.medium, tone: 'border-blue-200 bg-blue-50 text-blue-700' },
              { label: 'Bajos', value: findingBuckets.low, tone: 'border-slate-200 bg-slate-50 text-slate-600' },
              { label: 'Todos', value: findingBuckets.total, tone: 'border-slate-200 bg-white text-slate-700' },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${chip.tone}`}
              >
                <span>{chip.label}</span>
                <span>{chip.value}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-3">
            {activeViolations.length > 0 ? (
              activeViolations.slice(0, 5).map((violation, index) => {
                const severity = findingSeverity(violation);
                const badge = findingSeverityLabel(severity);
                const hint = labelForViolation(violation);
                return (
                  <div key={`${violation}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 h-2.5 w-2.5 rounded-full ${severity === 'critical' ? 'bg-rose-500' : severity === 'high' ? 'bg-amber-500' : severity === 'medium' ? 'bg-blue-500' : 'bg-slate-400'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{violation}</h3>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${badge.tone}`}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {hint.label}. Revisa la siguiente corrección sugerida por el motor de normalización.
                        </p>
                      </div>
                      <div className="text-xs font-semibold text-slate-500">1 instancia</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                No hay hallazgos activos. El esquema está limpio en esta revisión.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Errores detectados por forma normal</h2>
              <p className="mt-1 text-sm text-slate-500">Distribución visual de los problemas actuales.</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('reports')}
              className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
            >
              Ver todos
            </button>
          </div>
          <div className="mt-2 flex justify-center">
            <RadarChart labels={[...NF_ORDER]} values={radarValues} color="#ef4444" trackColor="#e2e8f0" className="w-full max-w-[240px]" />
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-8 rounded-full bg-rose-500" />
              Errores detectados
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-8 rounded-full border border-dashed border-slate-400" />
              Máximo permitido
            </span>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Sugerencias de mejora</h2>
              <p className="mt-1 text-sm text-slate-500">Basado en el motor y el historial persistido.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowEditor(true)}
              className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
            >
              Ver plan de mejora sugerido
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {suggestions.slice(0, 5).length > 0 ? suggestions.slice(0, 5).map((suggestion, index) => {
              const impact = impactLabel(index);
              return (
                <div key={`${suggestion}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{suggestion}</div>
                    <div className="text-xs text-slate-500">Sugerencia #{index + 1}</div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${impact.tone}`}>
                    {impact.label}
                  </span>
                </div>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                No hay sugerencias pendientes para este esquema.
              </div>
            )}
          </div>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.25fr_0.9fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Comparación antes / después</h2>
              <p className="mt-1 text-sm text-slate-500">Tomando como referencia las dos últimas validaciones persistidas.</p>
            </div>
            <button
              type="button"
              onClick={() => void handleValidate()}
              className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
            >
              Ver detalle de la transformación
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Antes</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {normalizeNf(previousValidation?.nivel_normalizacion ?? '—')}
              </div>
              <div className="mt-2 text-sm text-slate-500">
                Cumplimiento {previousValidation ? `${nfCompletion(previousValidation.nivel_normalizacion)}%` : '0%'}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-gradient-to-r from-slate-500 to-slate-400" style={{ width: `${previousValidation ? nfCompletion(previousValidation.nivel_normalizacion) : 0}%` }} />
              </div>
              <div className="mt-3 text-xs text-slate-500">
                {previousValidation ? `${getViolationCount(previousValidation)} incidencias detectadas.` : 'Sin historial previo.'}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-500">Después</div>
              <div className="mt-2 text-2xl font-bold text-emerald-900">{currentNf}</div>
              <div className="mt-2 text-sm text-emerald-700">
                Cumplimiento {completionValue}%
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-200">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${completionValue}%` }} />
              </div>
              <div className="mt-3 text-xs text-emerald-700">
                {activeViolations.length === 0 ? 'Esquema estable y sin hallazgos críticos.' : `${activeViolations.length} incidencias activas.`}
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Recomendaciones detalladas</h2>
              <p className="mt-1 text-sm text-slate-500">Cada fila se basa en las sugerencias del reporte.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowEditor(true)}
              className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
            >
              Ver todas las recomendaciones
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[0.9fr_1.2fr_0.55fr_0.55fr_0.55fr] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              <span>Recomendación</span>
              <span>Descripción</span>
              <span>Impacto</span>
              <span>Prioridad</span>
              <span>Acción</span>
            </div>
            <div className="divide-y divide-slate-100">
              {(activeReport?.recommendations ?? []).length > 0 ? (
                activeReport!.recommendations.map((recommendation, index) => {
                  const impact = index <= 1 ? 'Alto' : index === 2 ? 'Medio' : 'Bajo';
                  const priority = index <= 1 ? 'Alta' : index === 2 ? 'Media' : 'Baja';
                  return (
                    <div key={`${recommendation}-${index}`} className="grid grid-cols-[0.9fr_1.2fr_0.55fr_0.55fr_0.55fr] items-start px-4 py-3 text-sm">
                      <div className="font-semibold text-slate-900">Paso {index + 1}</div>
                      <div className="text-slate-500">{recommendation}</div>
                      <div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${impact === 'Alto' ? 'bg-rose-100 text-rose-700' : impact === 'Medio' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {impact}
                        </span>
                      </div>
                      <div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${priority === 'Alta' ? 'bg-rose-100 text-rose-700' : priority === 'Media' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {priority}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(activeReport?.sql || '');
                            toast.success('SQL copiado.');
                          } catch {
                            toast.error('No se pudo copiar el SQL.');
                          }
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 transition hover:text-blue-700"
                      >
                        Ver SQL
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  No hay recomendaciones pendientes. El esquema ya está muy cerca del objetivo.
                </div>
              )}
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Reporte exportable</h2>
              <p className="mt-1 text-sm text-slate-500">Descarga el informe actual en el formato que necesites.</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {schemaDetail?.id ? `ID ${schemaDetail.id}` : 'Local'}
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Motor SQL</div>
              <p className="mt-1 text-sm text-slate-600">El SQL, el reporte y la descomposición usan este dialecto.</p>
            </div>
            <select
              value={sqlDialect}
              onChange={(event) => setSqlDialect(event.target.value as SqlDialect)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300"
            >
              {SQL_DIALECT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'PDF', desc: 'Documento', icon: FileText, format: 'pdf' as const },
              { label: 'HTML', desc: 'Informe web', icon: Code2, format: 'html' as const },
              { label: 'JSON', desc: 'Datos estructurados', icon: FileJson, format: 'json' as const },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => void handleExport(item.format)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-white"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="mt-3 text-sm font-bold text-slate-900">{item.label}</div>
                  <div className="text-xs text-slate-500">{item.desc}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Incluye métricas, hallazgos, recomendaciones y la descomposición propuesta para el esquema actual.
          </div>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.25fr_0.9fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Comparación antes / después</h2>
              <p className="mt-1 text-sm text-slate-500">Tomando como referencia las dos últimas validaciones persistidas.</p>
            </div>
            <button
              type="button"
              onClick={() => void handleValidate()}
              className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
            >
              Ver detalle de la transformación
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Antes</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {normalizeNf(previousValidation?.nivel_normalizacion ?? '—')}
              </div>
              <div className="mt-2 text-sm text-slate-500">
                Cumplimiento {previousValidation ? `${nfCompletion(previousValidation.nivel_normalizacion)}%` : '0%'}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-gradient-to-r from-slate-500 to-slate-400" style={{ width: `${previousValidation ? nfCompletion(previousValidation.nivel_normalizacion) : 0}%` }} />
              </div>
              <div className="mt-3 text-xs text-slate-500">
                {previousValidation ? `${getViolationCount(previousValidation)} incidencias detectadas.` : 'Sin historial previo.'}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-500">Después</div>
              <div className="mt-2 text-2xl font-bold text-emerald-900">{currentNf}</div>
              <div className="mt-2 text-sm text-emerald-700">
                Cumplimiento {completionValue}%
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-200">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${completionValue}%` }} />
              </div>
              <div className="mt-3 text-xs text-emerald-700">
                {activeViolations.length === 0 ? 'Esquema estable y sin hallazgos críticos.' : `${activeViolations.length} incidencias activas.`}
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Recomendaciones detalladas</h2>
              <p className="mt-1 text-sm text-slate-500">Cada fila se basa en las sugerencias del reporte.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowEditor(true)}
              className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
            >
              Ver todas las recomendaciones
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[0.9fr_1.2fr_0.55fr_0.55fr_0.55fr] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              <span>Recomendación</span>
              <span>Descripción</span>
              <span>Impacto</span>
              <span>Prioridad</span>
              <span>Acción</span>
            </div>
            <div className="divide-y divide-slate-100">
              {(activeReport?.recommendations ?? []).length > 0 ? (
                activeReport!.recommendations.map((recommendation, index) => {
                  const impact = index <= 1 ? 'Alto' : index === 2 ? 'Medio' : 'Bajo';
                  const priority = index <= 1 ? 'Alta' : index === 2 ? 'Media' : 'Baja';
                  return (
                    <div key={`${recommendation}-${index}`} className="grid grid-cols-[0.9fr_1.2fr_0.55fr_0.55fr_0.55fr] items-start px-4 py-3 text-sm">
                      <div className="font-semibold text-slate-900">Paso {index + 1}</div>
                      <div className="text-slate-500">{recommendation}</div>
                      <div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${impact === 'Alto' ? 'bg-rose-100 text-rose-700' : impact === 'Medio' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {impact}
                        </span>
                      </div>
                      <div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${priority === 'Alta' ? 'bg-rose-100 text-rose-700' : priority === 'Media' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {priority}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(activeReport?.sql || '');
                            toast.success('SQL copiado.');
                          } catch {
                            toast.error('No se pudo copiar el SQL.');
                          }
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 transition hover:text-blue-700"
                      >
                        Ver SQL
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  No hay recomendaciones pendientes. El esquema ya está muy cerca del objetivo.
                </div>
              )}
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Reporte exportable</h2>
              <p className="mt-1 text-sm text-slate-500">Descarga el informe actual en el formato que necesites.</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {schemaDetail?.id ? `ID ${schemaDetail.id}` : 'Local'}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'PDF', desc: 'Documento', icon: FileText, format: 'pdf' as const },
              { label: 'HTML', desc: 'Informe web', icon: Code2, format: 'html' as const },
              { label: 'JSON', desc: 'Datos estructurados', icon: FileJson, format: 'json' as const },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => void handleExport(item.format)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-white"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="mt-3 text-sm font-bold text-slate-900">{item.label}</div>
                  <div className="text-xs text-slate-500">{item.desc}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Incluye métricas, hallazgos, recomendaciones y la descomposición propuesta para el esquema actual.
          </div>
        </article>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Database className="h-4 w-4" />
          </div>
          <span>La validación se basa en las reglas de normalización relacional definidas en el estándar ANS/X3/SPARC.</span>
        </div>
        <div className="flex flex-wrap items-center gap-5 text-xs font-semibold text-slate-500">
          <span>ID de validación: {validationIdentifier}</span>
          <span>Duración: {durationText}</span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.25fr_0.9fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Resumen de validación</h2>
              <p className="mt-1 text-sm text-slate-500">Totales calculados a partir del historial actual.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowEditor(true)}
              className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-white"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Ver detalle de reglas
            </button>
          </div>

          <div className="mt-4 space-y-3 text-sm">
            {[
              { label: 'Reglas totales evaluadas', value: ruleCount },
              { label: 'Reglas cumplidas', value: matchedRules, tone: 'text-emerald-700' },
              { label: 'Reglas parcialmente cumplidas', value: partialRules, tone: 'text-amber-700' },
              { label: 'Reglas no cumplidas', value: failedRules, tone: 'text-rose-700' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-slate-500">{item.label}</span>
                <strong className={item.tone || 'text-slate-900'}>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Comparación antes / después</h2>
              <p className="mt-1 text-sm text-slate-500">Tomando como referencia las dos últimas validaciones persistidas.</p>
            </div>
            <button
              type="button"
              onClick={() => void handleValidate()}
              className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
            >
              Ver detalle de la transformación
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Antes</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {normalizeNf(previousValidation?.nivel_normalizacion ?? '—')}
              </div>
              <div className="mt-2 text-sm text-slate-500">
                Cumplimiento {previousValidation ? `${nfCompletion(previousValidation.nivel_normalizacion)}%` : '0%'}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-gradient-to-r from-slate-500 to-slate-400" style={{ width: `${previousValidation ? nfCompletion(previousValidation.nivel_normalizacion) : 0}%` }} />
              </div>
              <div className="mt-3 text-xs text-slate-500">
                {previousValidation ? `${getViolationCount(previousValidation)} incidencias detectadas.` : 'Sin historial previo.'}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-500">Después</div>
              <div className="mt-2 text-2xl font-bold text-emerald-900">{currentNf}</div>
              <div className="mt-2 text-sm text-emerald-700">
                Cumplimiento {completionValue}%
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-200">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${completionValue}%` }} />
              </div>
              <div className="mt-3 text-xs text-emerald-700">
                {activeViolations.length === 0 ? 'Esquema estable y sin hallazgos críticos.' : `${activeViolations.length} incidencias activas.`}
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Errores por forma normal</h2>
              <p className="mt-1 text-sm text-slate-500">Distribución visual de los problemas actuales.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
              Radar
            </span>
          </div>
              <RadarChart labels={[...NF_ORDER]} values={radarValues} color="#ef4444" trackColor="#e2e8f0" className="mt-2" />
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-8 rounded-full bg-rose-500" />
              Errores detectados
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-8 rounded-full border border-dashed border-slate-400" />
              Máximo permitido
            </span>
          </div>
        </article>
      </div>

      <div className="hidden">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Recomendaciones detalladas</h2>
              <p className="mt-1 text-sm text-slate-500">Cada fila se basa en las sugerencias del reporte.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowEditor(true)}
              className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
            >
              Ver todas las recomendaciones
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[0.9fr_1.2fr_0.55fr_0.55fr_0.55fr] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              <span>Recomendación</span>
              <span>Descripción</span>
              <span>Impacto</span>
              <span>Prioridad</span>
              <span>Acción</span>
            </div>
            <div className="divide-y divide-slate-100">
              {(activeReport?.recommendations ?? []).length > 0 ? (
                activeReport!.recommendations.map((recommendation, index) => {
                  const impact = index <= 1 ? 'Alto' : index === 2 ? 'Medio' : 'Bajo';
                  const priority = index <= 1 ? 'Alta' : index === 2 ? 'Media' : 'Baja';
                  return (
                    <div key={`${recommendation}-${index}`} className="grid grid-cols-[0.9fr_1.2fr_0.55fr_0.55fr_0.55fr] items-start px-4 py-3 text-sm">
                      <div className="font-semibold text-slate-900">Paso {index + 1}</div>
                      <div className="text-slate-500">{recommendation}</div>
                      <div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${impact === 'Alto' ? 'bg-rose-100 text-rose-700' : impact === 'Medio' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {impact}
                        </span>
                      </div>
                      <div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${priority === 'Alta' ? 'bg-rose-100 text-rose-700' : priority === 'Media' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {priority}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(activeReport?.sql || '');
                            toast.success('SQL copiado.');
                          } catch {
                            toast.error('No se pudo copiar el SQL.');
                          }
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 transition hover:text-blue-700"
                      >
                        Ver SQL
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  No hay recomendaciones pendientes. El esquema ya está muy cerca del objetivo.
                </div>
              )}
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Reporte exportable</h2>
              <p className="mt-1 text-sm text-slate-500">Descarga el informe actual en el formato que necesites.</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {schemaDetail?.id ? `ID ${schemaDetail.id}` : 'Local'}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'PDF', desc: 'Documento', icon: FileText, format: 'pdf' as const },
              { label: 'HTML', desc: 'Informe web', icon: Code2, format: 'html' as const },
              { label: 'JSON', desc: 'Datos estructurados', icon: FileJson, format: 'json' as const },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => void handleExport(item.format)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-white"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="mt-3 text-sm font-bold text-slate-900">{item.label}</div>
                  <div className="text-xs text-slate-500">{item.desc}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Incluye métricas, hallazgos, recomendaciones, SQL y la descomposición propuesta para el esquema actual.
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Herramientas rápidas</h2>
              <p className="mt-1 text-sm text-slate-500">Acciones que acompañan la validación actual.</p>
            </div>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-white"
            >
              <Copy className="h-4 w-4" />
              Compartir
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <button
              type="button"
              onClick={() => setShowEditor(true)}
              className="inline-flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-blue-200 hover:bg-white"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Edit3 className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Editar estructura</div>
                <div className="text-xs text-slate-500">Ajusta atributos y dependencias</div>
              </div>
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(activeReport?.sql || '');
                  toast.success('SQL copiado al portapapeles.');
                } catch {
                  toast.error('No se pudo copiar el SQL.');
                }
              }}
              className="inline-flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-blue-200 hover:bg-white"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Code2 className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Generar SQL</div>
                <div className="text-xs text-slate-500">Copia la consulta propuesta</div>
              </div>
            </button>
          </div>
        </article>
      </div>

      {showEditor && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Editor de esquema</h2>
              <p className="mt-1 text-sm text-slate-500">
                Modifica la estructura y vuelve a validar para guardar una nueva revisión.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowEditor(false)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-white"
            >
              <X className="h-4 w-4" />
              Cerrar editor
            </button>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label htmlFor="lab-table-name" className="block text-sm font-semibold text-slate-700">
                  Nombre de la tabla
                </label>
                <input
                  id="lab-table-name"
                  type="text"
                  value={tableName}
                  onChange={(event) => setTableName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                  placeholder="Ej. Estudiante"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-semibold text-slate-700">Atributos</label>
                  <span className="text-xs font-semibold text-slate-500">{attributes.length}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {attributes.map((attribute) => (
                    <span key={attribute} className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">
                      {attribute}
                      <button
                        type="button"
                        onClick={() => setAttributes((current) => current.filter((item) => item !== attribute))}
                        className="text-blue-300 transition hover:text-rose-500"
                        aria-label={`Eliminar atributo ${attribute}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                  {!attributes.length && <span className="text-sm text-slate-400">Sin atributos definidos.</span>}
                </div>
                <div className="mt-4 flex gap-2">
                  <input
                    type="text"
                    value={draftAttribute}
                    onChange={(event) => setDraftAttribute(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleAddAttribute();
                      }
                    }}
                    placeholder="Nuevo atributo"
                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddAttribute}
                    className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
                  >
                    + Agregar
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-semibold text-slate-700">Dependencias funcionales</label>
                  <span className="text-xs font-semibold text-slate-500">{dependencies.length}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {dependencies.map((dependency) => (
                    <div key={`${dependency.determinant.join(',')}-${dependency.dependent.join(',')}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                      <span className="font-medium text-slate-900">
                        <span className="text-violet-600">{`{${dependency.determinant.join(', ')}}`}</span>
                        <span className="mx-2 text-slate-400">→</span>
                        <span className="text-emerald-600">{`{${dependency.dependent.join(', ')}}`}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setDependencies((current) => current.filter((item) => item !== dependency))}
                        className="text-slate-400 transition hover:text-rose-500"
                        aria-label="Eliminar dependencia"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {!dependencies.length && <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">Sin dependencias definidas.</div>}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    type="text"
                    value={draftDeterminant}
                    onChange={(event) => setDraftDeterminant(event.target.value)}
                    placeholder="Determinante (ej. id, id_curso)"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-400"
                  />
                  <input
                    type="text"
                    value={draftDependent}
                    onChange={(event) => setDraftDependent(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleAddDependency();
                      }
                    }}
                    placeholder="Dependiente (ej. nombre, ciudad)"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddDependency}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
                >
                  <PlusIcon />
                  Agregar dependencia
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => void handleValidate()}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Guardar y validar
            </button>
            <button
              type="button"
              onClick={() => void handleExport('json')}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
            >
              <Download className="h-4 w-4" />
              Exportar JSON
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

function PlusIcon() {
  return <span className="text-base leading-none">+</span>;
}
