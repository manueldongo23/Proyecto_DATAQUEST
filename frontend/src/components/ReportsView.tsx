import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  FileJson,
  FileText,
  Filter,
  LayoutDashboard,
  Medal,
  ShieldAlert,
  Trophy,
} from 'lucide-react';
import axiosInstance from '../services/api';
import { useAuthStore } from '../store/authStore';
import { fetchLeaderboard, fetchSchemas, fetchUserInsights, normalizeNf, buildLearningPath, formatLongDateTime, NF_ORDER } from '../services/insights';
import { RingChart, SimpleLineChart } from './ChartWidgets';
import { LoadingSpinner } from './LoadingSpinner';
import { toast } from './Toast';
import type { ViewType, LeaderboardEntry, SchemaSummary } from '../types';

interface ValidationRecord {
  id?: number;
  nivel_normalizacion: string;
  fecha: string;
  violaciones_json?: unknown[] | null;
}

interface DetailedSchema extends SchemaSummary {
  estructura_json: string[] | null;
  dependencias_json: { determinant: string[]; dependent: string[] }[] | null;
  validaciones: ValidationRecord[];
}

interface ErrorPattern {
  error_type: string;
  count: number;
  frequency_percent: number;
}

interface ReportsViewProps {
  onNavigate: (view: ViewType) => void;
}

type RangePreset = '7d' | '14d' | '30d';

function getViolationCount(record?: ValidationRecord | null) {
  return Array.isArray(record?.violaciones_json) ? record!.violaciones_json!.length : 0;
}

function getLatestValidation(schema: DetailedSchema) {
  if (!schema.validaciones.length) return null;
  const sorted = [...schema.validaciones].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  return sorted[sorted.length - 1] ?? null;
}

function classifySchema(schema: DetailedSchema): 'completed' | 'in_progress' | 'blocked' | 'draft' {
  const latest = getLatestValidation(schema);
  if (!latest) return 'draft';

  const nf = normalizeNf(latest.nivel_normalizacion);
  const attempts = schema.validaciones.length;
  const index = NF_ORDER.indexOf(nf as (typeof NF_ORDER)[number]);

  if (nf === '5FN') return 'completed';
  if (index <= 0 && attempts >= 3) return 'blocked';
  if (index <= 1 && attempts >= 2) return 'blocked';
  return 'in_progress';
}

function statusLabel(status: 'completed' | 'in_progress' | 'blocked' | 'draft') {
  switch (status) {
    case 'completed':
      return 'Completado';
    case 'in_progress':
      return 'En progreso';
    case 'blocked':
      return 'Bloqueado';
    default:
      return 'Sin validar';
  }
}

function getReportType(nf: string, violations: number) {
  const normalized = normalizeNf(nf);
  if (normalized === '5FN' || normalized === 'BCNF') return 'Resumen ejecutivo';
  if (normalized === '3FN' || normalized === '4FN') return violations > 0 ? 'Detalle' : 'Análisis';
  return 'Detalle';
}

function formatDurationFromHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return '0 h 00 m';
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${wholeHours} h ${String(minutes).padStart(2, '0')} m`;
}

function downloadText(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildDashboardHtml(snapshot: DashboardSnapshot) {
  return `<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Reportes y Analítica</title>
    <style>
      body{font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:24px}
      .card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:18px;margin-bottom:16px}
      .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
      table{width:100%;border-collapse:collapse}
      th,td{padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:left}
      .muted{color:#64748b;font-size:12px}
      .pill{display:inline-block;padding:5px 10px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:700}
    </style>
  </head>
  <body>
    <h1>Reportes y Analítica</h1>
    <p class="muted">Generado el ${new Date().toLocaleString('es-PE')}</p>
    <div class="grid">
      <div class="card"><div class="pill">Validaciones totales</div><h2>${snapshot.totalValidations}</h2></div>
      <div class="card"><div class="pill">Validaciones completadas</div><h2>${snapshot.completedValidations}</h2></div>
      <div class="card"><div class="pill">Errores detectados</div><h2>${snapshot.errorCount}</h2></div>
      <div class="card"><div class="pill">Tiempo promedio de estudio</div><h2>${snapshot.averageStudyTime}</h2></div>
    </div>
    <div class="card">
      <h2>Proyectos recientes</h2>
      <table>
        <thead><tr><th>Proyecto</th><th>Estado</th><th>Última validación</th></tr></thead>
        <tbody>
          ${snapshot.recentSchemas.map((schema) => `<tr><td>${schema.name}</td><td>${schema.statusLabel}</td><td>${schema.updatedAt}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  </body>
  </html>`;
}

function TinySparkline({ values, color }: { values: number[]; color: string }) {
  const points = values.length
    ? values.map((value, index) => {
        const width = 100;
        const height = 24;
        const max = Math.max(...values, 1);
        const x = values.length === 1 ? 50 : (index / (values.length - 1)) * width;
        const y = height - (value / max) * (height - 2) - 1;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ')
    : '';

  return (
    <svg viewBox="0 0 100 24" className="h-10 w-24 overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface DashboardSnapshot {
  totalValidations: number;
  completedValidations: number;
  errorCount: number;
  averageStudyTime: string;
  recentSchemas: Array<{
    name: string;
    statusLabel: string;
    updatedAt: string;
  }>;
}

function groupValidationsByDay(schemas: DetailedSchema[], rangeDays: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (rangeDays - 1));
  cutoff.setHours(0, 0, 0, 0);

  const map = new Map<string, { total: number; completed: number; failed: number }>();

  for (let i = rangeDays - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const key = date.toISOString().slice(0, 10);
    map.set(key, { total: 0, completed: 0, failed: 0 });
  }

  schemas.forEach((schema) => {
    schema.validaciones.forEach((validation) => {
      const date = new Date(validation.fecha);
      if (Number.isNaN(date.getTime()) || date < cutoff) return;
      date.setHours(0, 0, 0, 0);
      const key = date.toISOString().slice(0, 10);
      const bucket = map.get(key) ?? { total: 0, completed: 0, failed: 0 };
      bucket.total += 1;
      if (getViolationCount(validation) === 0) bucket.completed += 1;
      else bucket.failed += 1;
      map.set(key, bucket);
    });
  });

  return Array.from(map.entries()).map(([date, bucket]) => ({
    date,
    ...bucket,
  }));
}

export const ReportsView: React.FC<ReportsViewProps> = ({ onNavigate }) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Awaited<ReturnType<typeof fetchUserInsights>> | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [errorPatterns, setErrorPatterns] = useState<ErrorPattern[]>([]);
  const [schemas, setSchemas] = useState<DetailedSchema[]>([]);
  const [rangePreset, setRangePreset] = useState<RangePreset>('14d');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduledFor, setScheduledFor] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!user) return;
      setLoading(true);

      try {
        const [userInsights, ranking, schemasResponse, errorsResponse] = await Promise.all([
          fetchUserInsights(user.id),
          fetchLeaderboard(),
          fetchSchemas(),
          axiosInstance.get(`/analytics/error-patterns/${user.id}`),
        ]);

        const summaries = (schemasResponse ?? []).slice(0, 6);
        const details = await Promise.all(
          summaries.map(async (summary) => {
            try {
              const response = await axiosInstance.get(`/schemas/${summary.id}`);
              return response.data?.data as DetailedSchema;
            } catch {
              return null;
            }
          }),
        );

        if (!mounted) return;

        setInsights(userInsights);
        setLeaderboard(ranking);
        setSchemas(details.filter((schema): schema is DetailedSchema => schema !== null));
        setErrorPatterns((errorsResponse.data?.data ?? []) as ErrorPattern[]);
      } catch {
        if (mounted) {
          toast.error('No se pudieron cargar los reportes.');
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

  const progress = insights?.progress ?? null;
  const sessionAnalytics = insights?.sessionAnalytics ?? null;
  const peerComparison = insights?.peerComparison ?? null;
  const currentRoute = buildLearningPath(progress).find((step) => step.status === 'in_progress')
    ?? buildLearningPath(progress).find((step) => step.status === 'available')
    ?? buildLearningPath(progress)[0];

  const totalValidations = useMemo(
    () => schemas.reduce((sum, schema) => sum + schema.validaciones.length, 0),
    [schemas],
  );
  const completedValidations = useMemo(
    () => schemas.reduce((sum, schema) => sum + schema.validaciones.filter((validation) => getViolationCount(validation) === 0).length, 0),
    [schemas],
  );
  const errorCount = useMemo(
    () => schemas.reduce((sum, schema) => sum + schema.validaciones.reduce((inner, validation) => inner + getViolationCount(validation), 0), 0),
    [schemas],
  );
  const averageStudyTime = useMemo(() => {
    const averagePerDay = sessionAnalytics?.average_schemas_per_day ?? 0;
    if (!averagePerDay) return '0 h 00 m';
    return formatDurationFromHours(24 / averagePerDay);
  }, [sessionAnalytics]);

  const validationSeries = useMemo(() => groupValidationsByDay(schemas, rangePreset === '7d' ? 7 : rangePreset === '14d' ? 14 : 30), [rangePreset, schemas]);
  const lineLabels = validationSeries.map((entry) => new Date(entry.date).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }));
  const lineCompleted = validationSeries.map((entry) => entry.completed);
  const lineFailed = validationSeries.map((entry) => entry.failed);
  const lineTotal = validationSeries.map((entry) => entry.total);

  const projectStatusCounts = useMemo(() => {
    const counts = { completed: 0, in_progress: 0, blocked: 0, draft: 0 };
    schemas.forEach((schema) => {
      counts[classifySchema(schema)] += 1;
    });
    return counts;
  }, [schemas]);

  const totalProjects = Math.max(1, schemas.length);
  const averageMastery = progress?.nf_progress?.length
    ? Math.round(progress.nf_progress.reduce((sum, item) => sum + item.percentage, 0) / progress.nf_progress.length)
    : 0;
  const completionByNF = progress?.nf_progress ?? [];
  const topStudents = leaderboard.slice(0, 5);
  const recentSchemas = schemas.slice(0, 5);
  const exportSnapshot: DashboardSnapshot = useMemo(() => ({
    totalValidations,
    completedValidations,
    errorCount,
    averageStudyTime,
    recentSchemas: recentSchemas.map((schema) => {
      const latest = getLatestValidation(schema);
      return {
        name: schema.nombre,
        statusLabel: statusLabel(classifySchema(schema)),
        updatedAt: formatLongDateTime(latest?.fecha ?? schema.fecha_creacion),
      };
    }),
  }), [averageStudyTime, completedValidations, errorCount, recentSchemas, totalValidations]);

  const handleDashboardExport = async (format: 'json' | 'html' | 'pdf') => {
    try {
      if (format === 'json') {
        downloadText(JSON.stringify(exportSnapshot, null, 2), `reportes-analitica-${new Date().toISOString().slice(0, 10)}.json`, 'application/json;charset=utf-8');
        toast.success('Resumen JSON descargado.');
        return;
      }

      const html = buildDashboardHtml(exportSnapshot);
      if (format === 'html') {
        downloadText(html, `reportes-analitica-${new Date().toISOString().slice(0, 10)}.html`, 'text/html;charset=utf-8');
        toast.success('Resumen HTML descargado.');
        return;
      }

      const win = window.open('', '_blank', 'noopener,noreferrer');
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
        win.focus();
      } else {
        downloadText(html, `reportes-analitica-${new Date().toISOString().slice(0, 10)}.html`, 'text/html;charset=utf-8');
      }
      toast.success('Vista preparada para imprimir.');
    } catch {
      toast.error('No se pudo exportar el reporte.');
    }
  };

  const handleScheduleReport = () => {
    if (!scheduledFor) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      setScheduledFor(tomorrow.toISOString().slice(0, 16));
      setShowScheduler(true);
      return;
    }

    try {
      localStorage.setItem('dataquest:scheduled_report', scheduledFor);
      toast.success('Informe programado correctamente.');
      setShowScheduler(false);
    } catch {
      toast.error('No se pudo programar el informe.');
    }
  };

  const compareLabel = rangePreset === '7d' ? 'vs. 7 días previos' : rangePreset === '14d' ? 'vs. 14 días previos' : 'vs. 30 días previos';

  const periodRangeText = useMemo(() => {
    const days = rangePreset === '7d' ? 7 : rangePreset === '14d' ? 14 : 30;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    return `${start.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}`;
  }, [rangePreset]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <LoadingSpinner text="Cargando reportes..." />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reportes y Analítica</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Explora el rendimiento de tu aprendizaje, proyectos y validaciones.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap xl:gap-3">
          <button
            type="button"
            onClick={() => setRangePreset('14d')}
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-slate-50"
          >
            <CalendarDays className="h-4 w-4" />
            {periodRangeText}
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
          <button
            type="button"
            onClick={() => setRangePreset((current) => (current === '7d' ? '14d' : current === '14d' ? '30d' : '7d'))}
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-slate-50"
          >
            <Filter className="h-4 w-4" />
            {compareLabel}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setExportMenuOpen((current) => !current)}
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Exportar
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                {[
                  { label: 'JSON', icon: FileJson, format: 'json' as const },
                  { label: 'HTML', icon: FileText, format: 'html' as const },
                  { label: 'PDF', icon: FileText, format: 'pdf' as const },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setExportMenuOpen(false);
                        void handleDashboardExport(item.format);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <Icon className="h-4 w-4 text-slate-500" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleScheduleReport}
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-slate-50"
          >
            <Clock3 className="h-4 w-4" />
            Programar informe
          </button>
        </div>
      </div>

      {showScheduler && (
        <div className="rounded-3xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Programación del informe</h2>
              <p className="mt-1 text-sm text-slate-600">Guarda un recordatorio local para revisar tu analítica más tarde.</p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Fecha y hora</span>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(event) => setScheduledFor(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                />
              </label>
              <button
                type="button"
                onClick={handleScheduleReport}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
              >
                Guardar recordatorio
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-5">
        {[
          {
            label: 'Validaciones totales',
            value: totalValidations,
            icon: FileJson,
            color: 'text-violet-600',
            bg: 'bg-violet-50',
            stroke: '#7c3aed',
            series: lineTotal,
          },
          {
            label: 'Validaciones completadas',
            value: completedValidations,
            icon: CheckIcon,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            stroke: '#10b981',
            series: lineCompleted,
          },
          {
            label: 'Errores detectados',
            value: errorCount,
            icon: ShieldAlert,
            color: 'text-orange-600',
            bg: 'bg-orange-50',
            stroke: '#f97316',
            series: lineFailed,
          },
          {
            label: 'Tiempo promedio de estudio',
            value: averageStudyTime,
            icon: Clock3,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            stroke: '#2563eb',
            series: lineTotal,
          },
          {
            label: 'Retos completados',
            value: peerComparison?.your_quests_completed ?? 0,
            icon: Trophy,
            color: 'text-violet-600',
            bg: 'bg-violet-50',
            stroke: '#7c3aed',
            series: [peerComparison?.your_quests_completed ?? 0, peerComparison?.average_quests_completed ?? 0],
          },
        ].map((card) => {
          const Icon = card.icon;
          const deltaBase = totalValidations > 0 ? Math.round((completedValidations / Math.max(1, totalValidations)) * 100) : 0;
          return (
            <article key={card.label} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${card.bg} ${card.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <TinySparkline values={card.series as number[]} color={card.stroke} />
              </div>
              <div className="mt-3 text-sm text-slate-500">{card.label}</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{card.value}</div>
              <div className="mt-1 text-xs text-slate-500">
                {card.label === 'Tiempo promedio de estudio' ? 'vs. período anterior' : `${deltaBase}% vs. período anterior`}
              </div>
            </article>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.8fr_1.05fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Validaciones a lo largo del tiempo</h2>
              <p className="mt-1 text-sm text-slate-500">Completadas, no cumplidas y total del periodo seleccionado.</p>
            </div>
            <button
              type="button"
              onClick={() => setRangePreset((current) => (current === '7d' ? '14d' : current === '14d' ? '30d' : '7d'))}
              className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              Diario
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
          </div>
          <SimpleLineChart
            labels={lineLabels}
            series={[
              { name: 'Completadas', values: lineCompleted, color: '#10b981' },
              { name: 'No cumplidas', values: lineFailed, color: '#ef4444' },
              { name: 'Total', values: lineTotal, color: '#2563eb' },
            ]}
            className="mt-2"
            height={240}
          />
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Errores de normalización más comunes</h2>
              <p className="mt-1 text-sm text-slate-500">Basado en el historial real de violaciones.</p>
            </div>
            <button type="button" className="text-sm font-semibold text-blue-600 transition hover:text-blue-700">
              Ver todos
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {errorPatterns.length > 0 ? errorPatterns.slice(0, 6).map((pattern) => {
              const max = Math.max(...errorPatterns.map((item) => item.count), 1);
              const width = `${Math.max(8, (pattern.count / max) * 100)}%`;
              return (
                <div key={pattern.error_type}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-700">
                      {pattern.error_type.split('_').join(' ')}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {pattern.count} ({pattern.frequency_percent}%)
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500" style={{ width }} />
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                No hay patrones de error registrados.
              </div>
            )}
          </div>
          <div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
            <span className="text-slate-500">Total de errores</span>
            <strong className="text-slate-900">{errorCount}</strong>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Progreso por ruta de aprendizaje</h2>
              <p className="mt-1 text-sm text-slate-500">Ruta activa y progreso por forma normal.</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('academy')}
              className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
            >
              Ver detalle de rutas
            </button>
          </div>

          <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Ruta actual</div>
                <div className="mt-1 text-base font-bold text-slate-900">{currentRoute?.name ?? 'Ruta de aprendizaje'}</div>
                <div className="mt-1 text-sm text-slate-500">{currentRoute?.description ?? 'Sin ruta disponible'}</div>
              </div>
              <RingChart value={progress?.mastered_count ? Math.round((progress.mastered_count / progress.total_nf) * 100) : 0} label="Progreso general" size={120} stroke={10} color="#14b8a6" />
            </div>

            <div className="mt-4 space-y-3">
              {completionByNF.map((item) => (
                <div key={item.concept}>
                  <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>{item.concept}</span>
                    <span>{item.percentage}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-blue-500" style={{ width: `${item.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.15fr_1fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Proyectos por estado</h2>
              <p className="mt-1 text-sm text-slate-500">Distribución del historial de esquemas del usuario.</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-5">
            <RingChart
              value={Math.round(((projectStatusCounts.completed + projectStatusCounts.in_progress) / totalProjects) * 100)}
              label="Total"
              sublabel={`${schemas.length} esquemas`}
              size={146}
              stroke={12}
              color="#2563eb"
            />
            <div className="space-y-3 text-sm">
              {[
                { label: 'En progreso', value: projectStatusCounts.in_progress, color: 'bg-blue-500' },
                { label: 'Completados', value: projectStatusCounts.completed, color: 'bg-emerald-500' },
                { label: 'En revisión', value: projectStatusCounts.blocked, color: 'bg-amber-500' },
                { label: 'No iniciados', value: projectStatusCounts.draft, color: 'bg-slate-400' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-slate-500">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                    {item.label}
                  </span>
                  <strong className="text-slate-900">{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('projects')}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            <LayoutDashboard className="h-4 w-4" />
            Ver todos los proyectos
          </button>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Estudiantes con mejor rendimiento</h2>
              <p className="mt-1 text-sm text-slate-500">Ranking actual de usuarios activos.</p>
            </div>
            <button type="button" className="text-sm font-semibold text-blue-600 transition hover:text-blue-700">
              Ver ranking completo
            </button>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[0.4fr_1fr_0.7fr_0.6fr] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              <span>#</span>
              <span>Estudiante</span>
              <span>XP</span>
              <span>Rango</span>
            </div>
            <div className="divide-y divide-slate-100">
              {topStudents.length > 0 ? topStudents.map((entry) => (
                <div
                  key={entry.user_id ?? entry.rank}
                  className={`grid grid-cols-[0.4fr_1fr_0.7fr_0.6fr] items-center px-4 py-3 text-sm ${user && entry.user_id === user.id ? 'bg-blue-50/60' : ''}`}
                >
                  <div className="font-bold text-slate-500">#{entry.rank}</div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900">{entry.apodo}</div>
                    <div className="text-xs text-slate-500">{entry.user_id === user?.id ? 'Tú' : 'Usuario activo'}</div>
                  </div>
                  <div className="font-semibold text-slate-900">{entry.xp.toLocaleString('es-PE')} XP</div>
                  <div className="text-xs font-semibold text-slate-500">{entry.rango ?? 'Estudiante'}</div>
                </div>
              )) : (
                <div className="px-4 py-8 text-center text-sm text-slate-500">Aún no hay ranking disponible.</div>
              )}
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Completitud por forma normal</h2>
              <p className="mt-1 text-sm text-slate-500">Dominio acumulado sobre cada forma normal.</p>
            </div>
            <button type="button" className="text-sm font-semibold text-blue-600 transition hover:text-blue-700">
              Ver detalle
            </button>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <RingChart value={averageMastery} label="Promedio general" size={136} stroke={12} color="#14b8a6" />
            <div className="flex-1 space-y-2">
              {completionByNF.map((item, index) => (
                <div key={item.concept} className="flex items-center gap-3 text-sm">
                  <span className="w-10 text-xs font-bold text-slate-500">{item.concept}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full ${index === 0 ? 'bg-emerald-500' : index === 1 ? 'bg-blue-500' : index === 2 ? 'bg-cyan-500' : index === 3 ? 'bg-violet-500' : index === 4 ? 'bg-orange-500' : 'bg-rose-500'}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs font-semibold text-slate-500">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>

      <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Reportes generados recientemente</h2>
            <p className="mt-1 text-sm text-slate-500">Cada fila se alimenta del historial real de esquemas.</p>
          </div>
          <button type="button" className="text-sm font-semibold text-blue-600 transition hover:text-blue-700">
            Ver todos los reportes
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <div className="grid grid-cols-[1.5fr_0.9fr_1fr_0.8fr_1fr_0.6fr] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            <span>Nombre del reporte</span>
            <span>Tipo</span>
            <span>Rango de fechas</span>
            <span>Generado por</span>
            <span>Generado el</span>
            <span>Acciones</span>
          </div>
          <div className="divide-y divide-slate-100">
            {recentSchemas.length > 0 ? recentSchemas.map((schema) => {
              const latest = getLatestValidation(schema);
              const currentNf = normalizeNf(latest?.nivel_normalizacion ?? '1FN');
              const reportType = getReportType(currentNf, getViolationCount(latest));
              const firstValidation = schema.validaciones[0];
              return (
                <div key={schema.id} className="grid grid-cols-[1.5fr_0.9fr_1fr_0.8fr_1fr_0.6fr] items-center px-4 py-3 text-sm">
                  <div className="font-semibold text-slate-900">{schema.nombre}</div>
                  <div className="text-slate-500">{reportType}</div>
                  <div className="text-slate-500">
                    {formatLongDateTime(firstValidation?.fecha ?? schema.fecha_creacion)} - {formatLongDateTime(latest?.fecha ?? schema.fecha_creacion)}
                  </div>
                  <div className="text-slate-500">{user?.apodo ?? 'Usuario'}</div>
                  <div className="text-slate-500">{formatLongDateTime(latest?.fecha ?? schema.fecha_creacion)}</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const response = await axiosInstance.post('/report/generate', {
                            table_name: schema.nombre,
                            attributes: schema.estructura_json ?? [],
                            dependencies: schema.dependencias_json ?? [],
                          });
                          downloadText(JSON.stringify(response.data?.data ?? {}, null, 2), `${schema.nombre}-reporte.json`, 'application/json;charset=utf-8');
                          toast.success(`Reporte JSON descargado para ${schema.nombre}.`);
                        } catch {
                          toast.error('No se pudo descargar el reporte.');
                        }
                      }}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:text-blue-700"
                      aria-label={`Descargar reporte ${schema.nombre}`}
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const response = await axiosInstance.post('/report/generate', {
                            table_name: schema.nombre,
                            attributes: schema.estructura_json ?? [],
                            dependencies: schema.dependencias_json ?? [],
                          });
                          downloadText(buildDashboardHtml({
                            totalValidations,
                            completedValidations,
                            errorCount,
                            averageStudyTime,
                            recentSchemas: [{
                              name: schema.nombre,
                              statusLabel: statusLabel(classifySchema(schema)),
                              updatedAt: formatLongDateTime(latest?.fecha ?? schema.fecha_creacion),
                            }],
                          }), `${schema.nombre}-reporte.html`, 'text/html;charset=utf-8');
                          void response;
                          toast.success(`Reporte HTML generado para ${schema.nombre}.`);
                        } catch {
                          toast.error('No se pudo abrir el informe HTML.');
                        }
                      }}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:text-blue-700"
                      aria-label={`Abrir reporte ${schema.nombre}`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            }) : (
              <div className="px-4 py-8 text-center text-sm text-slate-500">Todavía no existen reportes generados.</div>
            )}
          </div>
        </div>
      </article>
    </div>
  );
};

function CheckIcon(props: React.ComponentProps<typeof FileJson>) {
  return <Medal {...props} />;
}
