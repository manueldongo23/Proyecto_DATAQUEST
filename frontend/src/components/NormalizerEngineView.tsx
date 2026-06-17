import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Code2,
  Copy,
  Download,
  Database,
  FileJson,
  FileText,
  Layers3,
  Lightbulb,
  Loader2,
  Play,
  PencilLine,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  TerminalSquare,
  ExternalLink,
} from 'lucide-react';
import axiosInstance from '../services/api';
import { useSchemaStore } from '../store/schemaStore';
import type { ViewType } from '../types';
import {
  fetchSchemas,
  formatLongDateTime,
  formatRelativeTime,
  nfIndex,
  normalizeNf,
  NF_ORDER,
} from '../services/insights';
import { toast } from './Toast';

interface NormalizerEngineViewProps {
  onNavigate: (view: ViewType) => void;
  searchQuery: string;
}

interface ValidationSnapshot {
  schema?: {
    id?: number;
    table_name: string;
    description?: string | null;
    attributes: string[];
    dependencies: { determinant: string[]; dependent: string[] }[];
  };
  analysis?: SandboxAnalysis;
  validation?: {
    schema_name: string;
    candidate_keys: string[][];
    current_nf?: string;
    diagnosis?: SandboxAnalysis['diagnosis'];
    message?: string | null;
    is_fully_normalized?: boolean;
  };
  version?: {
    number: number;
    label: string;
    estado: string;
    target_nf: string;
    engine: string;
    mode: string;
    created_at: string;
  };
  changes?: Record<string, unknown>;
}

interface SchemaValidationVersion {
  id: number;
  esquema_id: number;
  version_number: number;
  version_label: string;
  estado?: string | null;
  target_nf?: string | null;
  engine?: string | null;
  mode?: string | null;
  nivel_normalizacion: string;
  violaciones_json: string[];
  analysis_json?: SandboxAnalysis | null;
  decomposition_json?: SandboxAnalysis['decomposition'] | null;
  snapshot_json?: ValidationSnapshot | null;
  changes_json?: Record<string, unknown> | null;
  sql_generado?: string | null;
  fecha: string;
}

interface ValidationPreview {
  target_nf: string;
  current_nf: string;
  compliant: boolean;
  violations: string[];
  message: string;
}

interface SqlValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface SchemaDetailResponse {
  id: number;
  nombre: string;
  descripcion?: string | null;
  estructura_json: string[];
  dependencias_json: { determinant: string[]; dependent: string[] }[];
  fecha_creacion: string;
  archived_at?: string | null;
  validaciones: SchemaValidationVersion[];
}

interface SandboxAnalysis {
  schema_name: string;
  attributes: string[];
  functional_dependencies: { determinant: string[]; dependent: string[] }[];
  candidate_keys: string[][];
  prime_attributes: string[];
  canonical_cover: { determinant: string[]; dependent: string[] }[];
  diagnosis: {
    current_nf: string;
    violations: string[];
    didactic_steps: {
      step: string;
      explanation: string;
      violation_detail?: string;
      rule_codd?: string;
      suggestions?: string[];
    }[];
    suggestions: string[];
  };
  decomposition: {
    steps?: {
      step: number;
      action: string;
      detail?: string;
      tables?: unknown[];
      foreign_keys?: unknown[];
    }[];
    resulting_tables: {
      name: string;
      attributes: string[];
      primary_key: string[];
      is_main?: boolean;
      reason?: string;
    }[];
    foreign_keys?: {
      from_table: string;
      from_column: string;
      references: string;
      reason?: string;
    }[];
    is_lossless?: boolean;
    dependency_preservation?: {
      is_fully_preserved?: boolean;
      preserved?: { determinant: string[]; dependent: string[] }[];
      not_preserved?: { determinant: string[]; dependent: string[] }[];
    };
    sql: string;
  };
  sql: string;
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
    resulting_tables: {
      name: string;
      attributes: string[];
      primary_key?: string[];
    }[];
    foreign_keys: unknown[];
  };
  sql: string;
  recommendations: string[];
}

type SqlDialect = 'postgresql' | 'mysql' | 'sqlite' | 'sqlserver';

const SQL_DIALECT_KEY = 'dataquest:last_sql_dialect';
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
    // ignore storage errors
  }

  return 'postgresql';
}

function saveStoredSqlDialect(dialect: SqlDialect) {
  try {
    localStorage.setItem(SQL_DIALECT_KEY, dialect);
  } catch {
    // ignore storage errors
  }
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

function schemaToPayload(schema: { table_name: string; attributes: string[]; dependencies: { determinant: string[]; dependent: string[] }[] }) {
  return {
    table_name: schema.table_name,
    attributes: schema.attributes,
    dependencies: schema.dependencies,
  };
}

function normalizeDependencyList(
  dependencies: { determinant?: string[]; dependent?: string[] }[] | null | undefined,
): { determinant: string[]; dependent: string[] }[] {
  return (dependencies ?? []).map((dependency) => ({
    determinant: Array.isArray(dependency.determinant) ? dependency.determinant.filter(Boolean) : [],
    dependent: Array.isArray(dependency.dependent) ? dependency.dependent.filter(Boolean) : [],
  }));
}

function parseAttributeList(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function parseDependencyList(raw: string): { determinant: string[]; dependent: string[] }[] {
  return raw
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [left, right] = line.split(/->|→|⇒/);
      if (!left || !right) return null;
      const determinant = parseAttributeList(left);
      const dependent = parseAttributeList(right);
      if (!determinant.length || !dependent.length) return null;
      return { determinant, dependent };
    })
    .filter((item): item is { determinant: string[]; dependent: string[] } => item !== null);
}

function schemaFromValidation(
  validation: SchemaValidationVersion | null | undefined,
  fallback?: { table_name: string; attributes: string[]; dependencies: { determinant: string[]; dependent: string[] }[] },
) {
  if (!validation) {
    return fallback ?? null;
  }

  const snapshot = validation.snapshot_json?.schema;
  if (snapshot) {
    return {
      table_name: snapshot.table_name,
      attributes: snapshot.attributes ?? [],
      dependencies: normalizeDependencyList(snapshot.dependencies ?? []),
    };
  }

  const analysis = validation.analysis_json ?? validation.snapshot_json?.analysis;
  if (analysis) {
    return {
      table_name: analysis.schema_name,
      attributes: analysis.attributes ?? [],
      dependencies: normalizeDependencyList(analysis.functional_dependencies ?? []),
    };
  }

  return fallback ?? null;
}

function analysisFromValidation(validation: SchemaValidationVersion | null | undefined): SandboxAnalysis | null {
  if (!validation) return null;
  if (validation.analysis_json) return validation.analysis_json;
  if (validation.snapshot_json?.analysis) return validation.snapshot_json.analysis;
  return null;
}

function keyToString(key: string[]): string {
  return `{${key.join(', ')}}`;
}

function classifyDependency(
  fd: { determinant: string[]; dependent: string[] },
  candidateKeys: string[][],
  primeAttributes: string[],
): 'Total' | 'Parcial' | 'Transitiva' | 'Derivada' {
  const determinant = fd.determinant;
  const dependent = fd.dependent;
  const isSuperKey = candidateKeys.some((ck) => ck.every((attr) => determinant.includes(attr)));
  const isPartial = candidateKeys.some((ck) => ck.length > 1 && determinant.length < ck.length && determinant.every((attr) => ck.includes(attr)));
  const dependentAllPrime = dependent.every((attr) => primeAttributes.includes(attr));

  if (isPartial) return 'Parcial';
  if (!isSuperKey && !dependentAllPrime) return 'Transitiva';
  if (isSuperKey) return 'Total';
  return 'Derivada';
}

function statusForLevel(level: string, currentNf: string, violations: string[]): { label: string; tone: string } {
  const order = NF_ORDER.map((nf) => nf as string);
  const currentIndex = order.indexOf(normalizeNf(currentNf));
  const targetIndex = order.indexOf(level);

  if (targetIndex === -1) {
    return { label: 'Pendiente', tone: 'bg-slate-100 text-slate-500 border-slate-200' };
  }

  if (targetIndex <= currentIndex) {
    return { label: 'Cumplida', tone: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  }

  if (violations.includes(level)) {
    return { label: 'No cumplida', tone: 'bg-rose-100 text-rose-700 border-rose-200' };
  }

  return { label: 'Pendiente', tone: 'bg-slate-100 text-slate-500 border-slate-200' };
}

export const NormalizerEngineView: React.FC<NormalizerEngineViewProps> = ({ onNavigate, searchQuery }) => {
  const { currentSchema, currentSchemaId, currentSchemaName, setCurrentSchema } = useSchemaStore();
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [schemaDetail, setSchemaDetail] = useState<SchemaDetailResponse | null>(null);
  const [workingSchema, setWorkingSchema] = useState<{ table_name: string; attributes: string[]; dependencies: { determinant: string[]; dependent: string[] }[] } | null>(null);
  const [analysis, setAnalysis] = useState<SandboxAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState<'diagnosis' | 'fds' | 'decomposition' | 'er' | 'sql'>('diagnosis');
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [validationPreview, setValidationPreview] = useState<ValidationPreview | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [sqlValidation, setSqlValidation] = useState<SqlValidationResult | null>(null);
  const [sqlDialect, setSqlDialect] = useState<SqlDialect>(() => readStoredSqlDialect());
  const [targetNf, setTargetNf] = useState<'1FN' | '2FN' | '3FN' | 'BCNF' | '4FN' | '5FN'>('3FN');
  const [analysisMode, setAnalysisMode] = useState<'academico' | 'profesional' | 'estricto'>('profesional');
  const [exerciseLoading, setExerciseLoading] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorAttributes, setEditorAttributes] = useState('');
  const [editorDependencies, setEditorDependencies] = useState('');

  const activeSchema = useMemo(() => {
    if (workingSchema) {
      return workingSchema;
    }

    if (currentSchema) {
      return {
        table_name: currentSchema.table_name,
        attributes: currentSchema.attributes,
        dependencies: currentSchema.dependencies,
      };
    }

    if (schemaDetail) {
      return {
        table_name: schemaDetail.nombre,
        attributes: schemaDetail.estructura_json ?? [],
        dependencies: schemaDetail.dependencias_json ?? [],
      };
    }

    return null;
  }, [currentSchema, schemaDetail, workingSchema]);

  const versionOptions = useMemo(() => {
    const versions = schemaDetail?.validaciones ?? [];
    return versions.map((validation, index) => ({
      value: validation.version_number ?? index + 1,
      label: `${validation.version_label ?? `v${validation.version_number ?? index + 1}`} (${formatLongDateTime(validation.fecha)})`,
    }));
  }, [schemaDetail]);

  const currentVersionLabel = useMemo(() => {
    if (selectedVersionId && schemaDetail?.validaciones?.length) {
      const selected = schemaDetail.validaciones.find((validation) => (validation.version_number ?? validation.id) === selectedVersionId);
      if (selected) {
        return `${selected.version_label ?? `v${selected.version_number ?? selected.id}`} (${formatRelativeTime(selected.fecha)})`;
      }
    }
    if (schemaDetail?.validaciones?.length) {
      const last = schemaDetail.validaciones[schemaDetail.validaciones.length - 1];
      return `${last.version_label ?? last.nivel_normalizacion} (${formatRelativeTime(last.fecha)})`;
    }
    return 'Sesión actual';
  }, [schemaDetail, selectedVersionId]);

  const previewAnalysis = useCallback(async (schema: { table_name: string; attributes: string[]; dependencies: { determinant: string[]; dependent: string[] }[] }) => {
    setAnalysisLoading(true);
    try {
      const response = await axiosInstance.post('/sandbox/analyze', schemaToPayload(schema));
      if (response.data?.success) {
        setAnalysis(response.data.data as SandboxAnalysis);
        setSqlValidation(null);
        setReportData(null);
        setValidationPreview(null);
      }
    } catch {
      toast.error('No se pudo analizar el esquema.');
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

  const loadSchemaDetailById = useCallback(async (schemaId: number, previewIfMissing = false) => {
    const response = await axiosInstance.get(`/schemas/${schemaId}`);
    const detail = response.data?.data as SchemaDetailResponse | undefined;
    if (!detail) {
      return null;
    }

    const normalizedSchema = {
      table_name: detail.nombre,
      attributes: Array.isArray(detail.estructura_json) ? detail.estructura_json : [],
      dependencies: normalizeDependencyList(detail.dependencias_json),
    };

    setSchemaDetail(detail);
    setCurrentSchema(normalizedSchema, { id: detail.id, name: detail.nombre });
    setWorkingSchema(normalizedSchema);
    setSelectedVersionId(detail.validaciones.length ? (detail.validaciones[detail.validaciones.length - 1].version_number ?? detail.validaciones[detail.validaciones.length - 1].id) : null);

    const latestValidation = detail.validaciones[detail.validaciones.length - 1] ?? null;
    const restoredAnalysis = analysisFromValidation(latestValidation);
    if (restoredAnalysis) {
      setAnalysis(restoredAnalysis);
      setSqlValidation(null);
      setReportData(null);
      setValidationPreview(null);
    } else if (previewIfMissing) {
      await previewAnalysis(normalizedSchema);
    }

    return detail;
  }, [previewAnalysis, setCurrentSchema]);

  const saveCurrentAnalysis = useCallback(async () => {
    if (!activeSchema) return;

    setSavingVersion(true);
    try {
      setReportData(null);
      setValidationPreview(null);
      setSqlValidation(null);
      const payload = {
        ...activeSchema,
        schema_id: currentSchemaId && currentSchemaId > 0 ? currentSchemaId : schemaDetail?.id && schemaDetail.id > 0 ? schemaDetail.id : undefined,
        description: schemaDetail?.descripcion ?? undefined,
        engine: sqlDialect,
        mode: analysisMode,
      };

      const response = await axiosInstance.post('/validate-schema', payload);
      if (!response.data?.success) {
        throw new Error('save_failed');
      }

      const responseData = response.data.data as {
        analysis?: SandboxAnalysis;
        version?: { version_number?: number; version_label?: string; id?: number };
        schema_id?: number | null;
        schema?: { id?: number | null; nombre?: string; estructura_json?: string[]; dependencias_json?: { determinant?: string[]; dependent?: string[] }[] };
      };

      if (responseData.analysis) {
        setAnalysis(responseData.analysis);
      }

      const savedSchemaIdCandidate = responseData.schema_id ?? responseData.schema?.id ?? null;
      const savedSchemaId = typeof savedSchemaIdCandidate === 'number' && savedSchemaIdCandidate > 0
        ? savedSchemaIdCandidate
        : currentSchemaId && currentSchemaId > 0
          ? currentSchemaId
          : schemaDetail?.id && schemaDetail.id > 0
            ? schemaDetail.id
            : null;
      if (savedSchemaId) {
        await loadSchemaDetailById(savedSchemaId, false);
      }

      if (savedSchemaId) {
        setCurrentSchema(activeSchema, { id: savedSchemaId, name: activeSchema.table_name });
      } else {
        setCurrentSchema(activeSchema, { name: activeSchema.table_name });
      }

      setSelectedVersionId(responseData.version?.version_number ?? responseData.version?.id ?? null);
      toast.success(`Versión ${responseData.version?.version_label ?? 'guardada'} actualizada.`);
    } catch {
      toast.error('No se pudo guardar la versión actual.');
    } finally {
      setSavingVersion(false);
    }
  }, [activeSchema, analysisMode, currentSchemaId, loadSchemaDetailById, schemaDetail?.descripcion, schemaDetail?.id, setCurrentSchema, sqlDialect]);

  const restoreSelectedVersion = useCallback(async () => {
    if (!schemaDetail || !selectedVersionId) return;

    const selected = schemaDetail.validaciones.find((validation) => (validation.version_number ?? validation.id) === selectedVersionId);
    if (!selected) return;

    setRestoringVersion(true);
    try {
      setReportData(null);
      setValidationPreview(null);
      setSqlValidation(null);
      await axiosInstance.post(`/schemas/${schemaDetail.id}/versions/${selected.id}/restore`);
      const restoredSchema = schemaFromValidation(selected, activeSchema ?? undefined);
      if (restoredSchema) {
        setWorkingSchema(restoredSchema);
        const restoredAnalysis = analysisFromValidation(selected);
        if (restoredAnalysis) {
          setAnalysis(restoredAnalysis);
        } else {
          await previewAnalysis(restoredSchema);
        }
        setCurrentSchema(restoredSchema, { id: schemaDetail.id, name: restoredSchema.table_name });
        setActiveTab('diagnosis');
      }

      const refreshed = await axiosInstance.get(`/schemas/${schemaDetail.id}`);
      const detail = refreshed.data?.data as SchemaDetailResponse | undefined;
      if (detail) {
        setSchemaDetail(detail);
      }

      toast.success(`Versión ${selected.version_label} restaurada.`);
    } catch {
      toast.error('No se pudo restaurar la versión seleccionada.');
    } finally {
      setRestoringVersion(false);
    }
  }, [activeSchema, previewAnalysis, schemaDetail, selectedVersionId, setCurrentSchema]);

  const validateGeneratedSql = useCallback(async () => {
    const sql = analysis?.sql || analysis?.decomposition.sql;
    if (!sql) {
      toast.error('No hay SQL generado para validar.');
      return;
    }

    try {
      const response = await axiosInstance.post('/parse/ddl/advanced', { sql, mode: 'validate' });
      if (!response.data?.success) {
        throw new Error('invalid_sql');
      }

      setSqlValidation(response.data.data as SqlValidationResult);
      if (response.data.data?.valid) {
        toast.success('SQL válido.');
      } else {
        toast.warning('SQL con observaciones.');
      }
    } catch {
      setSqlValidation({ valid: false, errors: ['No se pudo validar el SQL.'], warnings: [] });
      toast.error('No se pudo validar el SQL.');
    }
  }, [analysis]);

  const openEditor = useCallback(() => {
    if (!activeSchema) return;
    setEditorAttributes(activeSchema.attributes.join(', '));
    setEditorDependencies(
      activeSchema.dependencies.map((fd) => `${fd.determinant.join(', ')} -> ${fd.dependent.join(', ')}`).join('\n'),
    );
    setEditorOpen(true);
  }, [activeSchema]);

  const saveEditorDraft = useCallback(async () => {
    if (!activeSchema) return;

    const updatedSchema = {
      table_name: activeSchema.table_name,
      attributes: parseAttributeList(editorAttributes),
      dependencies: parseDependencyList(editorDependencies),
    };

    setWorkingSchema(updatedSchema);
    setSelectedVersionId(null);
    setEditorOpen(false);
    setCurrentSchema(updatedSchema, {
      id: currentSchemaId && currentSchemaId > 0 ? currentSchemaId : schemaDetail?.id && schemaDetail.id > 0 ? schemaDetail.id : undefined,
      name: updatedSchema.table_name,
    });
    await previewAnalysis(updatedSchema);
    setActiveTab('diagnosis');
  }, [activeSchema, currentSchemaId, editorAttributes, editorDependencies, previewAnalysis, schemaDetail?.id, setCurrentSchema]);

  useEffect(() => {
    saveStoredSqlDialect(sqlDialect);
  }, [sqlDialect]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        if (currentSchema) {
          if (currentSchemaId) {
            const normalizedSchema = {
              table_name: currentSchema.table_name,
              attributes: [...currentSchema.attributes],
              dependencies: normalizeDependencyList(currentSchema.dependencies),
            };
            setWorkingSchema(normalizedSchema);
            void loadSchemaDetailById(currentSchemaId, false);
            await previewAnalysis(normalizedSchema);
          } else {
            const ephemeralSchema: SchemaDetailResponse = {
              id: 0,
              nombre: currentSchemaName ?? currentSchema.table_name,
              descripcion: null,
              estructura_json: currentSchema.attributes,
              dependencias_json: currentSchema.dependencies,
              fecha_creacion: new Date().toISOString(),
              archived_at: null,
              validaciones: [],
            };
            setSchemaDetail(ephemeralSchema);
            setWorkingSchema({
              table_name: currentSchema.table_name,
              attributes: currentSchema.attributes,
              dependencies: currentSchema.dependencies,
            });
            setSelectedVersionId(null);
            await previewAnalysis(currentSchema);
          }
          return;
        }

        if (currentSchemaId) {
          const detail = await loadSchemaDetailById(currentSchemaId, true);
          if (!mounted || !detail) return;
          return;
        }

        const schemas = await fetchSchemas();
        if (!schemas.length) {
          setSchemaDetail(null);
          setAnalysis(null);
          return;
        }

        const selected = schemas[0];
        const detail = await loadSchemaDetailById(selected.id, true);
        if (!mounted || !detail) return;
      } catch {
        toast.error('No se pudo cargar el motor de normalización.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [currentSchemaId, currentSchemaName, loadSchemaDetailById, previewAnalysis, setCurrentSchema]);

  const runAnalysis = async () => {
    await saveCurrentAnalysis();
    setActiveTab('diagnosis');
    return;
    setAnalysisLoading(true);
    try {
      const response = await axiosInstance.post('/sandbox/analyze', activeSchema);
      if (response.data?.success) {
        setAnalysis(response.data.data as SandboxAnalysis);
        setReportData(null);
        setValidationPreview(null);
        setActiveTab('diagnosis');
        toast.success('Análisis actualizado con datos reales.');
      }
    } catch {
      toast.error('No se pudo analizar el esquema.');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const copySummary = async () => {
    if (!analysis) return;
    const text = `${analysis.schema_name}\n${analysis.attributes.join(', ')}\n${analysis.diagnosis.current_nf}`;
    try {
      await navigator.clipboard.writeText(text);
      setShareCopied(true);
      toast.success('Resumen copiado al portapapeles.');
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch {
      toast.error('No se pudo copiar el resumen.');
    }
  };

  const loadExercise = async () => {
    setExerciseLoading(true);
    try {
      const response = await axiosInstance.get('/sandbox/exercise', {
        params: { nf: targetNf },
      });

      const exercise = response.data?.data;
      if (!exercise?.schema) {
        toast.error('No se pudo cargar el ejemplo.');
        return;
      }

      const schema = exercise.schema as { table_name: string; attributes: string[]; dependencies: { determinant: string[]; dependent: string[] }[] };
      setCurrentSchema(schema, { name: schema.table_name });
      setSchemaDetail({
        id: 0,
        nombre: schema.table_name,
        descripcion: null,
        estructura_json: schema.attributes,
        dependencias_json: schema.dependencies,
        fecha_creacion: new Date().toISOString(),
        archived_at: null,
        validaciones: [],
      });
      setWorkingSchema(schema);
      setSelectedVersionId(null);
      setActiveTab('diagnosis');
      setReportData(null);
      setValidationPreview(null);
      setSqlValidation(null);
      toast.success(exercise.question || 'Ejemplo cargado en el motor.');
      setAnalysisLoading(true);
      try {
        const analysisResponse = await axiosInstance.post('/sandbox/analyze', schema);
        if (analysisResponse.data?.success) {
          setAnalysis(analysisResponse.data.data as SandboxAnalysis);
        }
      } finally {
        setAnalysisLoading(false);
      }
    } catch {
      toast.error('No se pudo cargar el ejemplo del sandbox.');
    } finally {
      setExerciseLoading(false);
    }
  };

  const applyTargetNf = async (target_nf: string) => {
    if (!activeSchema) return;
    try {
      const response = await axiosInstance.post('/academy/validate-up-to', {
        ...activeSchema,
        target_nf,
      });
      if (response.data?.success) {
        setValidationPreview(response.data.data as {
          target_nf: string;
          current_nf: string;
          compliant: boolean;
          violations: string[];
          message: string;
        });
        toast.success(response.data.data.message || `Revisión de ${target_nf} completada.`);
      }
    } catch {
      toast.error(`No se pudo evaluar ${target_nf}.`);
    }
  };

  const generateReport = async () => {
    if (!activeSchema) return;
    try {
      const response = await axiosInstance.post('/report/generate', {
        ...activeSchema,
        engine: sqlDialect,
        mode: analysisMode,
      });
      if (response.data?.success) {
        setReportData(response.data.data as ReportData);
        toast.success('Reporte generado.');
      }
    } catch {
      toast.error('No se pudo generar el reporte.');
    }
  };

  const exportJson = async () => {
    if (!activeSchema) return;
    try {
      const response = await axiosInstance.post('/report/generate', {
        ...activeSchema,
        engine: sqlDialect,
      });
      if (response.data?.success) {
        const report = response.data.data as ReportData;
        downloadTextFile(JSON.stringify(report, null, 2), `${report.schema.name}-normalizacion.json`, 'application/json;charset=utf-8');
        setReportData(report);
        toast.success('Reporte JSON descargado.');
      }
    } catch {
      toast.error('No se pudo exportar el JSON.');
    }
  };

  const exportHtml = async () => {
    if (!activeSchema) return;
    try {
      const response = await axiosInstance.post('/export/html', {
        ...activeSchema,
        engine: sqlDialect,
      }, { responseType: 'text' });
      const html = typeof response.data === 'string' ? response.data : String(response.data ?? '');
      downloadTextFile(html, `${activeSchema.table_name}-normalizacion.html`, 'text/html;charset=utf-8');
      toast.success('Reporte HTML descargado.');
    } catch {
      toast.error('No se pudo exportar el HTML.');
    }
  };

  const openPdfPreview = async () => {
    if (!activeSchema) return;
    try {
      const response = await axiosInstance.post('/export/html', {
        ...activeSchema,
        engine: sqlDialect,
        mode: analysisMode,
      }, { responseType: 'text' });
      const html = typeof response.data === 'string' ? response.data : String(response.data ?? '');
      const preview = window.open('', '_blank', 'noopener,noreferrer');
      if (preview) {
        preview.document.open();
        preview.document.write(html);
        preview.document.close();
        preview.focus();
      } else {
        downloadTextFile(html, `${activeSchema.table_name}-normalizacion.html`, 'text/html;charset=utf-8');
      }
      toast.success('Vista lista para imprimir como PDF.');
    } catch {
      toast.error('No se pudo abrir la vista PDF.');
    }
  };

  const copySql = async () => {
    if (!analysis) return;
    try {
      await navigator.clipboard.writeText(analysis.sql || analysis.decomposition.sql || '');
      toast.success('SQL copiado.');
    } catch {
      toast.error('No se pudo copiar el SQL.');
    }
  };

  const downloadSql = () => {
    if (!analysis) return;
    downloadTextFile(analysis.sql || analysis.decomposition.sql || '', `${analysis.schema_name}-normalizado.sql`, 'text/sql;charset=utf-8');
    toast.success('SQL descargado.');
  };

  const filteredDependencies = useMemo(() => {
    if (!analysis) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return analysis.functional_dependencies;

    return analysis.functional_dependencies.filter((fd) => {
      const det = fd.determinant.join(', ').toLowerCase();
      const dep = fd.dependent.join(', ').toLowerCase();
      return det.includes(q) || dep.includes(q);
    });
  }, [analysis, searchQuery]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <div>
            <div className="text-sm font-semibold text-slate-900">Cargando Normalizer Engine</div>
            <div className="text-xs text-slate-500">Analizando el proyecto seleccionado con datos reales...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis || !activeSchema) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
        <Database className="mx-auto h-14 w-14 text-slate-300" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Aún no hay un proyecto seleccionado</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
          Abre un proyecto desde la lista de proyectos o crea uno nuevo en el validador para ver el diagnóstico completo, las dependencias y la descomposición.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('projects')}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a proyectos
          </button>
          <button
            type="button"
            onClick={() => onNavigate('validator')}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
          >
            <Sparkles className="h-4 w-4" />
            Crear proyecto
          </button>
        </div>
      </div>
    );
  }

  const candidateKey = analysis.candidate_keys[0] ?? [];
  const currentNf = normalizeNf(analysis.diagnosis.current_nf);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <button
            type="button"
            onClick={() => onNavigate('projects')}
            className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a proyectos
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{analysis.schema_name}</h1>
              <p className="mt-1 text-slate-500">Normaliza tus esquemas y obtén estructuras libres de redundancia.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Proyecto</div>
            <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
              {currentSchemaName ?? analysis.schema_name}
              {analysisLoading ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            </div>
            <div className="mt-1 text-xs text-slate-500">Última revisión: {currentVersionLabel}</div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('validator')}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <ShieldCheck className="h-4 w-4" />
            Configurar
          </button>
          <button
            type="button"
            onClick={openEditor}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <PencilLine className="h-4 w-4" />
            Editar estructura
          </button>
          <button
            type="button"
            onClick={copySummary}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Copy className="h-4 w-4" />
            {shareCopied ? 'Copiado' : 'Compartir'}
          </button>
          {selectedVersionId ? (
            <button
              type="button"
              onClick={() => void restoreSelectedVersion()}
              disabled={restoringVersion}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-70"
            >
              {restoringVersion ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Restaurar versión
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void runAnalysis()}
            disabled={savingVersion}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:brightness-105 disabled:cursor-wait disabled:opacity-80"
          >
            {savingVersion ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Analizar
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {validationPreview && (
        <div className={`rounded-3xl border px-5 py-4 shadow-sm ${validationPreview.compliant ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${validationPreview.compliant ? 'text-emerald-500' : 'text-amber-500'}`}>
                Validacion hasta {validationPreview.target_nf}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{validationPreview.message}</div>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700">
              {validationPreview.current_nf} {'->'} {validationPreview.target_nf}
            </div>
          </div>
        </div>
      )}

      {reportData && (
        <div className="rounded-3xl border border-blue-200 bg-blue-50 px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">Reporte generado</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {reportData.schema.name} - {reportData.sql_engine?.toUpperCase() ?? sqlDialect.toUpperCase()}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {reportData.recommendations.length} recomendaciones y {reportData.decomposition.resulting_tables.length} tablas propuestas
              </div>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-white px-4 py-2 text-xs font-semibold text-blue-700">
              {formatLongDateTime(reportData.generated_at)}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Entrada rapida</div>
              <p className="mt-1 text-sm text-slate-500">
                Carga un ejemplo real, abre el Sandbox para pegar SQL o cambia el objetivo de normalizacion.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigate('sandbox')}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir Sandbox
              </button>
              <button
                type="button"
                onClick={() => void loadExercise()}
                disabled={exerciseLoading}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:brightness-105 disabled:cursor-wait disabled:opacity-70"
              >
                {exerciseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Cargar ejemplo
              </button>
              <button
                type="button"
                onClick={() => void generateReport()}
                className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                <Download className="h-4 w-4" />
                Generar reporte
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3 xl:w-[560px]">
            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Objetivo</span>
              <select
                value={targetNf}
                onChange={(event) => setTargetNf(event.target.value as typeof targetNf)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white"
              >
                {NF_ORDER.map((nf) => (
                  <option key={nf} value={nf}>
                    {nf}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Modo</span>
              <select
                value={analysisMode}
                onChange={(event) => setAnalysisMode(event.target.value as typeof analysisMode)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white"
              >
                <option value="academico">Academico</option>
                <option value="profesional">Profesional</option>
                <option value="estricto">Estricto</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">SQL</span>
              <select
                value={sqlDialect}
                onChange={(event) => setSqlDialect(event.target.value as SqlDialect)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white"
              >
                {SQL_DIALECT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_420px]">
        <section className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Estructura original</h2>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                {analysis.attributes.length} atributos
              </span>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-500">Tabla</div>
              <div className="mt-1 text-lg font-bold text-slate-900">{analysis.schema_name}</div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1.3fr_0.8fr_0.4fr] bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                <div>Atributo</div>
                <div>Tipo</div>
                <div>Clave</div>
              </div>
              <div className="divide-y divide-slate-100">
                {analysis.attributes.map((attribute) => {
                  const isPk = candidateKey.includes(attribute);
                  return (
                    <div key={attribute} className="grid grid-cols-[1.3fr_0.8fr_0.4fr] items-center px-4 py-3 text-sm">
                      <div className="font-semibold text-slate-800">{attribute}</div>
                      <div className="text-slate-500">{isPk ? 'INT' : 'TEXT'}</div>
                      <div>
                        {isPk ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                            PK
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">Estadísticas rápidas</h3>
            <div className="mt-4 space-y-3 text-sm">
              {[
                ['Atributos', analysis.attributes.length],
                ['Claves candidatas', analysis.candidate_keys.length],
                ['Dependencias detectadas', analysis.functional_dependencies.length],
                ['Problemas detectados', analysis.diagnosis.violations.length],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-bold text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Diagnóstico de normalización</h2>
                <p className="text-sm text-slate-500">{analysis.diagnosis.suggestions.length} sugerencia{analysis.diagnosis.suggestions.length === 1 ? '' : 's'} disponibles</p>
              </div>
              <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                {analysis.diagnosis.violations.length} problemas detectados
              </span>
            </div>

            <div className="space-y-3 p-5">
              {analysis.diagnosis.didactic_steps.map((step, index) => (
                <div
                  key={`${step.step}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${index % 3 === 0 ? 'bg-rose-100 text-rose-600' : index % 3 === 1 ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                      <Lightbulb className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{step.step}</h3>
                        {analysis.diagnosis.violations.length > 0 && (
                          <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700">
                            Requiere atención
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{step.explanation}</p>
                      {step.violation_detail && <p className="mt-2 text-sm text-slate-500">{step.violation_detail}</p>}
                      {step.rule_codd && <p className="mt-2 text-xs font-semibold text-blue-600">{step.rule_codd}</p>}
                    </div>
                  </div>
                </div>
              ))}

              {analysis.diagnosis.suggestions.length > 0 && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-4">
                  <h4 className="text-sm font-bold text-blue-700">Sugerencias</h4>
                  <ul className="mt-2 space-y-1 text-sm text-blue-900/80">
                    {analysis.diagnosis.suggestions.map((suggestion, index) => (
                      <li key={`${suggestion}-${index}`}>• {suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Progreso de normalización</h3>
              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Ver reporte
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {NF_ORDER.map((nf) => {
                const currentIndex = nfIndex(currentNf);
                const targetIndex = nfIndex(nf);
                const isViolation = analysis.diagnosis.violations.includes(nf);
                const status = statusForLevel(nf, currentNf, analysis.diagnosis.violations);
                const description =
                  targetIndex <= currentIndex
                    ? 'Atributos y reglas verificados.'
                    : isViolation
                      ? 'Detectadas violaciones asociadas.'
                      : 'Pendiente de evaluar.';

                return (
                  <div key={nf} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="w-16 shrink-0 text-sm font-bold text-slate-900">{nf}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${status.tone}`}>{status.label}</span>
                        <span className="text-sm text-slate-500">{description}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void applyTargetNf(nf)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600"
                    >
                      {targetIndex <= currentIndex ? 'Revisar' : targetIndex === currentIndex + 1 ? `Aplicar ${nf}` : `Sugerir ${nf}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Vista ER (mini)</h3>
              <button
                type="button"
                onClick={() => setActiveTab('er')}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Expandir
              </button>
            </div>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <svg viewBox="0 0 420 280" className="h-[260px] w-full">
                <defs>
                  <marker id="engineArrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L9,3 z" fill="#64748b" />
                  </marker>
                </defs>

                <rect x="38" y="24" width="118" height="86" rx="16" fill="#ffffff" stroke="#cbd5e1" />
                <text x="54" y="52" fontSize="13" fontWeight="700" fill="#0f172a">{analysis.schema_name}</text>
                {analysis.attributes.slice(0, 3).map((attr, index) => (
                  <text key={attr} x="54" y={76 + index * 18} fontSize="11" fill="#475569">{attr}</text>
                ))}

                {analysis.decomposition.resulting_tables.slice(0, 3).map((table, index) => (
                  <g key={table.name}>
                    <rect x={190 + (index % 2) * 118} y={24 + Math.floor(index / 2) * 116} width="122" height="90" rx="16" fill="#ffffff" stroke={table.is_main ? '#2563eb' : '#cbd5e1'} />
                    <text x={206 + (index % 2) * 118} y={52 + Math.floor(index / 2) * 116} fontSize="12" fontWeight="700" fill="#0f172a">{table.name}</text>
                    {table.attributes.slice(0, 3).map((attr, attrIndex) => (
                      <text key={attr} x={206 + (index % 2) * 118} y={76 + Math.floor(index / 2) * 116 + attrIndex * 18} fontSize="10.5" fill="#475569">{attr}</text>
                    ))}
                    <path
                      d={`M 156 68 C ${170 + (index % 2) * 16} 68, ${170 + (index % 2) * 16} ${80 + Math.floor(index / 2) * 116}, ${190 + (index % 2) * 118} ${68 + Math.floor(index / 2) * 116}`}
                      stroke="#94a3b8"
                      strokeDasharray="4 4"
                      fill="none"
                      markerEnd="url(#engineArrow)"
                    />
                  </g>
                ))}
              </svg>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Vista SQL</h3>
              <button
                type="button"
                onClick={() => setActiveTab('sql')}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Abrir
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
              <div className="mb-3 flex items-center gap-2 text-slate-400">
                <TerminalSquare className="h-4 w-4" />
                SQL generado por la descomposición
              </div>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap font-mono leading-5">
                {analysis.sql || analysis.decomposition.sql}
              </pre>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copySql()}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar SQL
              </button>
              <button
                type="button"
                onClick={downloadSql}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar SQL
              </button>
              <button
                type="button"
                onClick={() => void generateReport()}
                className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                <FileText className="h-3.5 w-3.5" />
                Generar reporte
              </button>
              <button
                type="button"
                onClick={() => void validateGeneratedSql()}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Validar SQL
              </button>
            </div>

            {sqlValidation && (
              <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${sqlValidation.valid ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
                <div className="font-semibold">{sqlValidation.valid ? 'SQL válido' : 'SQL con observaciones'}</div>
                {!!sqlValidation.errors.length && <div className="mt-1 text-xs">{sqlValidation.errors.join(' • ')}</div>}
                {!!sqlValidation.warnings.length && <div className="mt-1 text-xs">{sqlValidation.warnings.join(' • ')}</div>}
              </div>
            )}

            {(reportData || analysisMode) && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Salida dinámica</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {reportData ? `${reportData.schema.name} · ${reportData.sql_engine?.toUpperCase() ?? sqlDialect.toUpperCase()}` : `Modo ${analysisMode}`}
                    </div>
                    {reportData && (
                      <div className="mt-1 text-xs text-slate-500">
                        {reportData.recommendations.length} recomendaciones y {reportData.decomposition.resulting_tables.length} tablas propuestas
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={openPdfPreview}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                    >
                      <Download className="h-3.5 w-3.5" />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={exportHtml}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      HTML
                    </button>
                    <button
                      type="button"
                      onClick={exportJson}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                    >
                      <FileJson className="h-3.5 w-3.5" />
                      JSON
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setActiveTab('decomposition')}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
        >
          <Lightbulb className="h-4 w-4" />
          Sugerir descomposición
        </button>
        <button
          type="button"
          onClick={() => void applyTargetNf('1FN')}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <Layers3 className="h-4 w-4" />
          Aplicar 1FN
        </button>
        <button
          type="button"
          onClick={() => void applyTargetNf('2FN')}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <Layers3 className="h-4 w-4" />
          Aplicar 2FN
        </button>
        <button
          type="button"
          onClick={() => {
            void generateReport();
            setActiveTab('sql');
          }}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:brightness-105"
        >
          <Code2 className="h-4 w-4" />
          Generar SQL
        </button>
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Editar estructura</div>
                <h3 className="mt-1 text-2xl font-bold text-slate-900">{activeSchema.table_name}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Separa atributos con comas y dependencias con una l&iacute;nea por relaci&oacute;n usando <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">A -&gt; B, C</code>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Atributos</span>
                <textarea
                  value={editorAttributes}
                  onChange={(event) => setEditorAttributes(event.target.value)}
                  rows={8}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white"
                  placeholder="idVenta, idProducto, cantidad, precio"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Dependencias funcionales</span>
                <textarea
                  value={editorDependencies}
                  onChange={(event) => setEditorDependencies(event.target.value)}
                  rows={8}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white"
                  placeholder="idVenta -> fechaVenta, idCliente&#10;idProducto -> precioUnitario"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveEditorDraft()}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:brightness-105"
              >
                <PencilLine className="h-4 w-4" />
                Aplicar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Versión actual</div>
            <select
              value={selectedVersionId ?? ''}
              onChange={(event) => setSelectedVersionId(event.target.value ? Number(event.target.value) : null)}
              className="mt-2 min-w-[260px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white"
            >
              {versionOptions.length > 0 ? (
                versionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))
              ) : (
                <option value="">Sesión actual</option>
              )}
            </select>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Última revisión: <span className="font-semibold text-slate-900">{currentVersionLabel}</span>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {[
            ['diagnosis', 'Diagnóstico'],
            ['fds', 'Dependencias funcionales'],
            ['decomposition', 'Descomposición'],
            ['er', 'ER final'],
            ['sql', 'SQL generado'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id as typeof activeTab)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === id ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'diagnosis' && (
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Resumen del diagnóstico</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {analysis.candidate_keys.map((key, index) => (
                  <div key={`${keyToString(key)}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Clave candidata</div>
                    <div className="mt-2 text-sm font-bold text-slate-900">{keyToString(key)}</div>
                  </div>
                ))}
                {analysis.canonical_cover.slice(0, 2).map((fd, index) => (
                  <div key={`${keyToString(fd.determinant)}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Cobertura canónica</div>
                    <div className="mt-2 text-sm font-bold text-slate-900">{keyToString(fd.determinant)} → {keyToString(fd.dependent)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-bold text-slate-900">Sugerencias</h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {analysis.diagnosis.suggestions.length > 0 ? (
                  analysis.diagnosis.suggestions.map((suggestion, index) => <li key={`${suggestion}-${index}`}>• {suggestion}</li>)
                ) : (
                  <li>Sin sugerencias adicionales.</li>
                )}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'fds' && (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[60px_1fr_1fr_120px] bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              <div>#</div>
              <div>Determinante</div>
              <div>Dependiente</div>
              <div>Tipo</div>
            </div>
            <div className="divide-y divide-slate-100">
              {filteredDependencies.map((fd, index) => {
                const type = classifyDependency(fd, analysis.candidate_keys, analysis.prime_attributes);
                const tone =
                  type === 'Parcial'
                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                    : type === 'Transitiva'
                      ? 'bg-rose-100 text-rose-700 border-rose-200'
                      : type === 'Total'
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200';

                return (
                  <div key={`${fd.determinant.join('-')}-${index}`} className="grid grid-cols-[60px_1fr_1fr_120px] items-center px-4 py-4">
                    <div className="text-sm font-semibold text-slate-500">{index + 1}</div>
                    <div className="font-semibold text-slate-900">{keyToString(fd.determinant)}</div>
                    <div className="text-slate-600">{keyToString(fd.dependent)}</div>
                    <div>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${tone}`}>{type}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'decomposition' && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Sin pérdida</div>
                <div className="mt-2 text-lg font-bold text-slate-900">
                  {analysis.decomposition.is_lossless === false ? 'No confirmada' : 'Confirmada'}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Preservación</div>
                <div className="mt-2 text-lg font-bold text-slate-900">
                  {analysis.decomposition.dependency_preservation?.is_fully_preserved ? 'Completa' : 'Parcial'}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Claves foráneas</div>
                <div className="mt-2 text-lg font-bold text-slate-900">{analysis.decomposition.foreign_keys?.length ?? 0}</div>
              </div>
            </div>

            {analysis.decomposition.steps?.length ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-bold text-slate-900">Pasos de la descomposición</div>
                <div className="mt-4 space-y-3">
                  {analysis.decomposition.steps.map((step) => (
                    <div key={`${step.step}-${step.action}`} className="rounded-2xl border border-white bg-white px-4 py-3 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">
                          Paso {step.step}: {step.action}
                        </div>
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                          Dinámico
                        </span>
                      </div>
                      {step.detail ? <p className="mt-1 text-sm text-slate-500">{step.detail}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              {analysis.decomposition.resulting_tables.map((table) => (
                <div key={table.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900">{table.name}</h3>
                    {table.is_main && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">Principal</span>}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{table.reason || 'Tabla resultante de la descomposición.'}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {table.attributes.map((attr) => (
                      <span key={`${table.name}-${attr}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {attr}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {analysis.decomposition.foreign_keys?.length ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-bold text-slate-900">Claves foráneas derivadas</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {analysis.decomposition.foreign_keys.map((fk, index) => (
                    <div key={`${fk.from_table}-${fk.from_column}-${index}`} className="rounded-2xl border border-white bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                      <div className="font-semibold text-slate-900">
                        {fk.from_table}.{fk.from_column} → {fk.references}
                      </div>
                      {fk.reason ? <div className="mt-1 text-xs text-slate-500">{fk.reason}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {analysis.decomposition.dependency_preservation?.preserved?.length ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="text-sm font-bold text-emerald-700">Dependencias preservadas</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {analysis.decomposition.dependency_preservation.preserved.map((fd, index) => (
                    <span key={`${keyToString(fd.determinant)}-${index}`} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
                      {keyToString(fd.determinant)} → {keyToString(fd.dependent)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {activeTab === 'er' && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-500">Vista ER derivada de la descomposición BCNF</div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {analysis.decomposition.resulting_tables.map((table) => (
                <div key={table.name} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-sm font-bold text-slate-900">{table.name}</div>
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    {table.attributes.slice(0, 5).map((attr) => (
                      <div key={`${table.name}-${attr}`} className="rounded-lg bg-slate-50 px-2 py-1">
                        {attr}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sql' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4">
              <div className="mb-3 flex items-center gap-2 text-slate-400">
                <TerminalSquare className="h-4 w-4" />
                SQL generado
              </div>
              <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap text-xs leading-6 text-slate-100">
                {analysis.sql || analysis.decomposition.sql}
              </pre>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">Reporte exportable</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Descarga la salida en PDF, HTML o JSON con un clic.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={openPdfPreview}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                  >
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={exportHtml}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    HTML
                  </button>
                  <button
                    type="button"
                    onClick={exportJson}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                  >
                    <FileJson className="h-3.5 w-3.5" />
                    JSON
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
