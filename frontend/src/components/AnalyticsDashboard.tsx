import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../services/api';
import { LoadingSpinner } from './LoadingSpinner';
import { toast } from './Toast';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Target, GitBranch, Users, Clock, Award, BarChart3 } from 'lucide-react';

interface ConceptBreakdown {
  concept: string;
  mastery_percentage: number;
  total_attempts: number;
  correct_attempts: number;
  accuracy_rate: number;
  last_practiced: string | null;
  trend: string;
  tag: string;
}

interface VelocityEntry {
  from: string | null;
  to: string;
  days: number | null;
  first_achieved: string | null;
}

interface LearningVelocity {
  velocity: VelocityEntry[];
  average_days_per_level: number;
  total_days_active: number;
}

interface ErrorPattern {
  error_type: string;
  count: number;
  frequency_percent: number;
}

interface Recommendation {
  concept: string;
  current_percentage: number;
  priority: string;
  reason: string;
}

interface SessionAnalytics {
  total_schemas: number;
  average_schemas_per_day: number;
  daily_activity: { date: string; schemas_validated: number }[];
  weekly_activity: { week: string; schemas_validated: number }[];
}

interface PeerComparison {
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
}

interface Props {
  userId: number;
}

const errorTypeLabels: Record<string, string> = {
  partial_dependency: 'Dependencia Parcial',
  transitive_dependency: 'Dependencia Transitiva',
  bcnf_violation: 'Violación BCNF',
  multivalued_dependency: 'Dependencia Multivaluada',
  join_dependency: 'Dependencia de Unión',
  unknown: 'Desconocido',
};

const conceptColors: Record<string, string> = {
  DF: 'from-cyan-400 to-blue-500',
  '1FN': 'from-emerald-400 to-teal-500',
  '2FN': 'from-indigo-400 to-blue-500',
  '3FN': 'from-violet-400 to-purple-500',
  BCNF: 'from-amber-400 to-orange-500',
  '4FN': 'from-rose-400 to-pink-500',
  '5FN': 'from-fuchsia-400 to-purple-600',
};

function ProgressBar({ pct, color }: { pct: number; color?: string }) {
  const barColor = color || (pct >= 80 ? 'from-emerald-400 to-teal-500' : pct >= 40 ? 'from-amber-400 to-orange-500' : 'from-red-400 to-rose-500');
  return (
    <div className="progress-bar bg-slate-100" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${Math.round(pct)}% de dominio`}>
      <div
        className={`bg-gradient-to-r ${barColor} transition-all duration-500`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-emerald-500" aria-hidden="true" />;
  if (trend === 'declining') return <TrendingDown className="w-4 h-4 text-red-500" aria-hidden="true" />;
  return <Minus className="w-4 h-4 text-slate-400" aria-hidden="true" />;
}

function fetchJson(url: string) {
  return axiosInstance.get(url).then(r => r.data.data);
}

export const AnalyticsDashboard: React.FC<Props> = ({ userId }) => {
  const [loading, setLoading] = useState(true);
  const [conceptBreakdown, setConceptBreakdown] = useState<ConceptBreakdown[]>([]);
  const [learningVelocity, setLearningVelocity] = useState<LearningVelocity | null>(null);
  const [errorPatterns, setErrorPatterns] = useState<ErrorPattern[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [sessionAnalytics, setSessionAnalytics] = useState<SessionAnalytics | null>(null);
  const [peerComparison, setPeerComparison] = useState<PeerComparison | null>(null);
  const [activeSection, setActiveSection] = useState<string>('overview');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [breakdown, velocity, errors, recs, sessions, peer] = await Promise.all([
        fetchJson(`/analytics/concept-breakdown/${userId}`),
        fetchJson(`/analytics/learning-velocity/${userId}`),
        fetchJson(`/analytics/error-patterns/${userId}`),
        fetchJson(`/analytics/recommendations/${userId}`),
        fetchJson(`/analytics/session-analytics/${userId}`),
        fetchJson(`/analytics/peer-comparison/${userId}`),
      ]);
      setConceptBreakdown(breakdown);
      setLearningVelocity(velocity);
      setErrorPatterns(errors);
      setRecommendations(recs);
      setSessionAnalytics(sessions);
      setPeerComparison(peer);
    } catch {
      toast.error('Error al cargar los datos de analítica');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return <div role="status" aria-live="polite"><LoadingSpinner text="Cargando analítica..." className="py-20" /></div>;
  }

  const latestMastery = conceptBreakdown.map(c => ({
    concept: c.concept,
    percentage: c.mastery_percentage,
    attempts: c.total_attempts,
  }));

  const hasErrors = errorPatterns.length > 0;
  const hasRecs = recommendations.length > 0;

  return (
    <div className="space-y-6">
      {/* Section Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3" role="tablist" aria-label="Secciones de analítica">
        {[
          { id: 'overview', label: 'Resumen', icon: <BarChart3 className="w-4 h-4" /> },
          { id: 'concepts', label: 'Conceptos', icon: <GitBranch className="w-4 h-4" /> },
          { id: 'velocity', label: 'Velocidad', icon: <Clock className="w-4 h-4" /> },
          { id: 'errors', label: 'Errores', icon: <AlertTriangle className="w-4 h-4" /> },
          { id: 'recommendations', label: 'Recomendaciones', icon: <Target className="w-4 h-4" /> },
          { id: 'comparison', label: 'Comparación', icon: <Users className="w-4 h-4" /> },
        ].map(s => (
          <button
            key={s.id}
            role="tab"
            aria-selected={activeSection === s.id}
            aria-controls={`analytics-section-${s.id}`}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
              activeSection === s.id
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === 'overview' && (
        <div id="analytics-section-overview" role="tabpanel" className="space-y-6">
          {/* Mastery Bars */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-500" aria-hidden="true" /> Dominio Actual
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {latestMastery.map(m => (
                <div key={m.concept}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-slate-600">{m.concept}</span>
                    <span className="text-xs font-bold text-slate-800">{m.percentage}%</span>
                  </div>
                  <ProgressBar pct={m.percentage} color={conceptColors[m.concept]} />
                  <p className="text-[10px] text-slate-400 mt-0.5">{m.attempts} intentos</p>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-indigo-500 mb-2">
                <Award className="w-5 h-5" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Velocidad</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{learningVelocity?.average_days_per_level ?? '—'}</p>
              <p className="text-xs text-slate-500">días promedio por nivel</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-500 mb-2">
                <Target className="w-5 h-5" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recomendaciones</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{hasRecs ? recommendations.length : 0}</p>
              <p className="text-xs text-slate-500">conceptos sugeridos</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-amber-500 mb-2">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Errores</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{hasErrors ? errorPatterns.length : 0}</p>
              <p className="text-xs text-slate-500">patrones detectados</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-violet-500 mb-2">
                <Users className="w-5 h-5" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Posición</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{peerComparison?.xp_percentile ?? '—'}%</p>
              <p className="text-xs text-slate-500">percentil de XP</p>
            </div>
          </div>

          {/* Activity */}
          {sessionAnalytics && sessionAnalytics.daily_activity.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-500" /> Actividad Reciente
              </h3>
              <div className="flex items-end gap-1 h-24">
                {sessionAnalytics.daily_activity.slice(-14).map(d => {
                  const max = Math.max(...sessionAnalytics.daily_activity.map(a => a.schemas_validated), 1);
                  const height = (d.schemas_validated / max) * 100;
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-gradient-to-t from-indigo-400 to-violet-500 rounded-t transition-all"
                        style={{ height: `${Math.max(height, 4)}%` }}
                        title={`${d.date}: ${d.schemas_validated} esquemas`}
                      />
                      <span className="text-[8px] text-slate-400">{d.date.slice(-5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeSection === 'concepts' && (
        <div id="analytics-section-concepts" role="tabpanel" className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-500" /> Desglose por Concepto
          </h3>
          <div className="space-y-4">
            {conceptBreakdown.map(c => {
              const tagColors: Record<string, string> = {
                strength: 'bg-emerald-100 text-emerald-700',
                developing: 'bg-amber-100 text-amber-700',
                weakness: 'bg-red-100 text-red-700',
              };
              const tagLabels: Record<string, string> = {
                strength: 'Fortaleza',
                developing: 'En Desarrollo',
                weakness: 'Debilidad',
              };
              return (
                <div key={c.concept} className="border border-slate-100 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{c.concept}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tagColors[c.tag]}`}>
                        {tagLabels[c.tag]}
                      </span>
                      <TrendIcon trend={c.trend} />
                    </div>
                    <span className="text-sm font-bold text-slate-800">{c.mastery_percentage}%</span>
                  </div>
                  <ProgressBar pct={c.mastery_percentage} color={conceptColors[c.concept]} />
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-500">
                    <span>Precisión: {c.accuracy_rate}%</span>
                    <span>Intentos: {c.total_attempts}</span>
                    <span>Correctos: {c.correct_attempts}</span>
                    {c.last_practiced && (
                      <span>Última práctica: {new Date(c.last_practiced).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeSection === 'velocity' && (
        <div id="analytics-section-velocity" role="tabpanel" className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" /> Velocidad de Aprendizaje
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-indigo-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-indigo-600">{learningVelocity?.average_days_per_level ?? 0}</p>
              <p className="text-xs text-slate-500">Días promedio por nivel</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{learningVelocity?.total_days_active ?? 0}</p>
              <p className="text-xs text-slate-500">Días activo total</p>
            </div>
            <div className="bg-violet-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-violet-600">{conceptBreakdown.filter(c => c.mastery_percentage >= 80).length}</p>
              <p className="text-xs text-slate-500">Niveles dominados</p>
            </div>
          </div>
          <div className="space-y-2">
            {learningVelocity?.velocity.map((v, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white ${
                  v.first_achieved ? 'bg-gradient-to-br from-indigo-400 to-violet-500' : 'bg-slate-300'
                }`}>
                  {v.to}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">
                      {v.from ? `${v.from} → ${v.to}` : v.to}
                    </span>
                    {v.days !== null && (
                      <span className="text-xs text-slate-400">({v.days} días)</span>
                    )}
                    {!v.first_achieved && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-500">
                        No alcanzado
                      </span>
                    )}
                  </div>
                  {v.first_achieved && (
                    <p className="text-xs text-slate-400">Primer logro: {new Date(v.first_achieved).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSection === 'errors' && (
        <div id="analytics-section-errors" role="tabpanel" className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-indigo-500" /> Patrones de Error
          </h3>
          {hasErrors ? (
            <div className="space-y-3">
              {errorPatterns.map(e => {
                const maxFreq = Math.max(...errorPatterns.map(x => x.frequency_percent), 1);
                return (
                  <div key={e.error_type}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">
                        {errorTypeLabels[e.error_type] || e.error_type}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {e.count} ({e.frequency_percent}%)
                      </span>
                    </div>
                    <div className="progress-bar bg-slate-100">
                      <div
                        className="bg-gradient-to-r from-red-400 to-rose-500 transition-all"
                        style={{ width: `${(e.frequency_percent / maxFreq) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No se detectaron patrones de error todavía.</p>
            </div>
          )}
        </div>
      )}

      {activeSection === 'recommendations' && (
        <div id="analytics-section-recommendations" role="tabpanel" className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-500" /> Recomendaciones
          </h3>
          {hasRecs ? (
            <div className="space-y-3">
              {recommendations.map((r, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold text-white shrink-0 ${
                    r.priority === 'continue'
                      ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                      : 'bg-gradient-to-br from-indigo-400 to-violet-500'
                  }`}>
                    {r.concept.replace('FN', '').replace('BCN', 'B')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-800">{r.concept}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        r.priority === 'continue'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {r.priority === 'continue' ? 'En progreso' : 'Siguiente paso'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{r.reason}</p>
                    {r.current_percentage > 0 && (
                      <div className="mt-2">
                        <ProgressBar pct={r.current_percentage} color={conceptColors[r.concept]} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Target className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">¡Has dominado todos los conceptos disponibles!</p>
            </div>
          )}
        </div>
      )}

      {activeSection === 'comparison' && peerComparison && (
        <div id="analytics-section-comparison" role="tabpanel" className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" /> Comparación con Pares
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-3 rounded-lg bg-indigo-50">
                <p className="text-2xl font-bold text-indigo-600">{peerComparison.xp_percentile}%</p>
                <p className="text-xs text-slate-500">Percentil XP</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-emerald-50">
                <p className="text-2xl font-bold text-emerald-600">#{peerComparison.xp_rank_position}</p>
                <p className="text-xs text-slate-500">de {peerComparison.total_peers + 1}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-amber-50">
                <p className="text-2xl font-bold text-amber-600">{peerComparison.your_accuracy}%</p>
                <p className="text-xs text-slate-500">Precisión (prom: {peerComparison.average_accuracy}%)</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-violet-50">
                <p className="text-2xl font-bold text-violet-600">{peerComparison.your_quests_completed}</p>
                <p className="text-xs text-slate-500">Quests (prom: {peerComparison.average_quests_completed})</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Dominio por Concepto vs Promedio</h3>
            <div className="space-y-3">
              {peerComparison.concept_comparison.map(c => (
                <div key={c.concept}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{c.concept}</span>
                    <span className="text-xs text-slate-500">
                      Tú: {c.your_percentage}% | Promedio: {c.average_percentage}% | Percentil: {c.percentile}%
                    </span>
                  </div>
                  <div className="relative h-5">
                    <div className="progress-bar bg-slate-100 absolute inset-0">
                      <div className="bg-slate-300 transition-all" style={{ width: `${c.average_percentage}%` }} />
                    </div>
                    <div className="progress-bar bg-transparent absolute inset-0">
                      <div
                        className={`bg-gradient-to-r ${conceptColors[c.concept] || 'from-indigo-400 to-violet-500'} transition-all opacity-80`}
                        style={{ width: `${c.your_percentage}%` }}
                      />
                    </div>
                    <div
                      className="absolute top-0 w-0.5 h-full bg-white border border-slate-400 z-10"
                      style={{ left: `${c.your_percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
