// DiagnosisPanel.tsx — Tarjetas didácticas mejoradas con tooltips y micro-animaciones
import React, { useState } from 'react';
import {
  AlertCircle, BookOpen, Lightbulb, ChevronDown, ChevronUp,
  ArrowRight, Info, CheckCircle2, XCircle
} from 'lucide-react';
import type { DidacticDiagnosis } from '../types';

// Mapa de íconos y colores por tipo de violación
const violationMeta: Record<string, { color: string; bg: string; border: string; label: string }> = {
  '1FN': { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300', label: '1ª Forma Normal' },
  '2FN': { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300', label: '2ª Forma Normal' },
  '3FN': { color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-300', label: '3ª Forma Normal' },
  'BCNF': { color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-300', label: 'BCNF' },
};

// Tooltip component
const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative inline-block" tabIndex={0}
      onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)} onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-slate-900 text-slate-100 text-[11px] rounded-lg px-3 py-2 shadow-xl pointer-events-none animate-fade-in leading-relaxed text-center" role="tooltip">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </span>
      )}
    </span>
  );
};

// Collapsible step card
const StepCard: React.FC<{ step: { step: string; explanation: string; violation_detail: string; rule_codd: string }; idx: number }> = ({ step, idx }) => {
  const [expanded, setExpanded] = useState(false);
  const contentId = `step-content-${idx}`;
  return (
    <div className="rounded-xl border border-amber-200 overflow-hidden animate-fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={contentId}
        className="w-full flex items-center gap-3 p-4 bg-amber-50 hover:bg-amber-100/70 text-left transition-colors"
      >
        <div className="w-7 h-7 rounded-lg bg-amber-200 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-4 h-4 text-amber-700" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 leading-tight">{step.step}</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-amber-500" aria-hidden="true" /> : <ChevronDown className="w-4 h-4 text-amber-500" aria-hidden="true" />}
      </button>

      {expanded && (
        <div id={contentId} className="p-4 space-y-4 bg-white border-t border-amber-100 animate-fade-in">
          {/* Explanation */}
          <div className="flex gap-3">
            <BookOpen className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Explicación</p>
              <p className="text-sm text-slate-700 leading-relaxed">{step.explanation}</p>
            </div>
          </div>

          {/* Regla de Codd — con tooltip */}
          <div className="flex gap-3 p-3 rounded-lg bg-indigo-50 border border-indigo-100">
            <Info className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Regla de Codd</p>
                <Tooltip text="Edgar F. Codd definió estas reglas para garantizar la integridad y eficiencia de las bases de datos relacionales.">
                  <Info className="w-3 h-3 text-indigo-400 cursor-help" aria-hidden="true" />
                </Tooltip>
              </div>
              <p className="text-xs text-indigo-700 italic leading-relaxed">"{step.rule_codd}"</p>
            </div>
          </div>

          {/* Technical Detail */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ArrowRight className="w-3 h-3 text-slate-400" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Detalle Técnico</p>
            </div>
            <pre className="text-[11px] whitespace-pre-wrap bg-slate-900 text-emerald-300 p-3 rounded-lg font-mono leading-relaxed overflow-x-auto">
              {step.violation_detail}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

const nfBadge = (nf: string) => {
  const colors: Record<string, string> = {
    '1NF': 'badge-error',
    '1FN': 'badge-error',
    '2NF': 'badge-warning',
    '2FN': 'badge-warning',
    '3NF': 'badge-info',
    '3FN': 'badge-info',
    'BCNF': 'badge-success',
  };
  return colors[nf] || 'badge-info';
};

interface DiagnosisPanelProps {
  diagnosis: DidacticDiagnosis;
}

export const DiagnosisPanel: React.FC<DiagnosisPanelProps> = ({ diagnosis }) => {
  if (!diagnosis) return null;

  const hasViolations = diagnosis.violations?.length > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-500" aria-hidden="true" />
          Diagnóstico Detallado
        </h3>
        <span className={`px-3 py-1 rounded-full border text-xs font-bold ${nfBadge(diagnosis.current_nf)}`}>
          {diagnosis.current_nf}
        </span>
      </div>

      <div className="p-5 space-y-4 max-h-[40rem] overflow-y-auto">
        {/* Violation badges */}
        {hasViolations && (
          <div className="flex flex-wrap gap-2">
            {diagnosis.violations.map((v, i) => {
              const meta = violationMeta[v] || { color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200', label: v };
              return (
                <span key={i} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${meta.bg} ${meta.color} ${meta.border}`}>
                  <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  Viola {meta.label}
                </span>
              );
            })}
          </div>
        )}

        {!hasViolations && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            <p className="text-sm text-emerald-700 font-medium">¡Sin violaciones detectadas!</p>
          </div>
        )}

        {/* Didactic Steps */}
        {diagnosis.didactic_steps?.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Pasos de Diagnóstico
            </p>
            {diagnosis.didactic_steps.map((step, idx) => (
              <StepCard key={idx} step={step} idx={idx} />
            ))}
          </div>
        )}

        {/* Suggestions */}
        {diagnosis.suggestions?.length > 0 && (
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <Lightbulb className="w-3.5 h-3.5" aria-hidden="true" /> Sugerencias para Normalizar
            </p>
            <ul className="space-y-2">
              {diagnosis.suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
