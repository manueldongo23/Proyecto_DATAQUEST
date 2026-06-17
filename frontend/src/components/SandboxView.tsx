import React, { useState } from 'react';
import { ArrowRight, BookOpen, Code, FlaskConical, Plus, Trash2, Upload } from 'lucide-react';
import axiosInstance from '../services/api';
import { useSchemaStore } from '../store/schemaStore';
import type { RelationSchema, ViewType } from '../types';
import { LoadingSpinner } from './LoadingSpinner';
import { toast } from './Toast';
import { DiagnosisPanel } from './DiagnosisPanel';

type SandboxMode = 'manual' | 'ddl' | 'csv' | 'exercise';

interface DependencyInput {
  det: string[];
  dep: string[];
}

interface SandboxViewProps {
  onNavigate?: (view: ViewType) => void;
}

function persistSchemaFromPayload(schema: RelationSchema, name?: string) {
  return {
    schema,
    meta: { name: name ?? schema.table_name },
  };
}

export const SandboxView: React.FC<SandboxViewProps> = ({ onNavigate }) => {
  const { setCurrentSchema } = useSchemaStore();
  const [mode, setMode] = useState<SandboxMode>('manual');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [tableName, setTableName] = useState('');
  const [attributes, setAttributes] = useState<string[]>(['']);
  const [dependencies, setDependencies] = useState<DependencyInput[]>([
    { det: [''], dep: [''] },
  ]);

  const [sql, setSql] = useState('');

  const [csv, setCsv] = useState('');

  const [exerciseNf, setExerciseNf] = useState('1FN');

  const saveSchemaToStore = (schema: RelationSchema, name?: string) => {
    const payload = persistSchemaFromPayload(schema, name);
    setCurrentSchema(payload.schema, payload.meta);
  };

  const handleAddAttribute = () => setAttributes([...attributes, '']);
  const handleRemoveAttribute = (i: number) => {
    if (attributes.length > 1) setAttributes(attributes.filter((_, idx) => idx !== i));
  };
  const handleAttributeChange = (i: number, v: string) => {
    const next = [...attributes];
    next[i] = v;
    setAttributes(next);
  };

  const handleAddDependency = () =>
    setDependencies([...dependencies, { det: [''], dep: [''] }]);
  const handleRemoveDependency = (i: number) => {
    if (dependencies.length > 1) setDependencies(dependencies.filter((_, idx) => idx !== i));
  };
  const handleDetChange = (i: number, v: string) => {
    const next = [...dependencies];
    next[i] = { ...next[i], det: [v] };
    setDependencies(next);
  };
  const handleDepChange = (i: number, v: string) => {
    const next = [...dependencies];
    next[i] = { ...next[i], dep: [v] };
    setDependencies(next);
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setResult(null);
    try {
      const payload = {
        table_name: tableName,
        attributes: attributes.filter(Boolean),
        dependencies: dependencies.map((d) => ({
          determinant: d.det.filter(Boolean),
          dependent: d.dep.filter(Boolean),
        })),
      };
      const res = await axiosInstance.post('/sandbox/analyze', payload);
      if (res.data.success) setResult(res.data.data);
      if (res.data.success && res.data.data?.attributes && res.data.data?.functional_dependencies) {
        saveSchemaToStore(
          {
            table_name: res.data.data.schema_name || tableName,
            attributes: res.data.data.attributes ?? [],
            dependencies: res.data.data.functional_dependencies ?? [],
          },
          res.data.data.schema_name || tableName,
        );
      }
      else toast.error(res.data.message || 'Error al analizar');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al analizar');
    } finally {
      setLoading(false);
    }
  };

  const handleParseDdl = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await axiosInstance.post('/sandbox/parse-ddl', { sql });
      if (res.data.success) setResult(res.data.data);
      if (res.data.success && res.data.data?.table_name && Array.isArray(res.data.data?.columns)) {
        const attributes = res.data.data.columns
          .map((column: any) => String(column.name ?? column.column_name ?? column.field ?? '').trim())
          .filter(Boolean);
        const dependencies = [
          ...(res.data.data.functional_dependencies?.from_pk ?? []),
          ...(res.data.data.functional_dependencies?.from_unique ?? []),
        ].map((dep: any) => ({
          determinant: Array.isArray(dep.determinant) ? dep.determinant.map((value: string) => String(value).trim()).filter(Boolean) : [],
          dependent: Array.isArray(dep.dependent) ? dep.dependent.map((value: string) => String(value).trim()).filter(Boolean) : [],
        }));
        saveSchemaToStore(
          {
            table_name: res.data.data.table_name,
            attributes,
            dependencies,
          },
          res.data.data.table_name,
        );
      }
      else toast.error(res.data.message || 'Error al analizar DDL');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al analizar DDL');
    } finally {
      setLoading(false);
    }
  };

  const handleImportCsv = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await axiosInstance.post('/sandbox/import-csv', { csv });
      if (res.data.success) setResult(res.data.data);
      if (res.data.success && res.data.data?.table_name && Array.isArray(res.data.data?.columns)) {
        const attributes = res.data.data.columns
          .map((column: any) => String(column.name ?? column.column_name ?? column.field ?? '').trim())
          .filter(Boolean);
        const dependencies = Array.isArray(res.data.data.discovered_fds)
          ? res.data.data.discovered_fds.map((dep: any) => ({
              determinant: Array.isArray(dep.determinant) ? dep.determinant.map((value: string) => String(value).trim()).filter(Boolean) : [],
              dependent: Array.isArray(dep.dependent) ? dep.dependent.map((value: string) => String(value).trim()).filter(Boolean) : [],
            }))
          : [];
        saveSchemaToStore(
          {
            table_name: res.data.data.table_name,
            attributes,
            dependencies,
          },
          res.data.data.table_name,
        );
      }
      else toast.error(res.data.message || 'Error al importar CSV');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al importar CSV');
    } finally {
      setLoading(false);
    }
  };

  const handleExercise = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await axiosInstance.get('/sandbox/exercise', {
        params: { nf: exerciseNf },
      });
      if (res.data.success) setResult(res.data.data);
      if (res.data.success && res.data.data?.schema) {
        saveSchemaToStore(res.data.data.schema as RelationSchema, res.data.data.schema.table_name);
      }
      else toast.error(res.data.message || 'Error al obtener ejercicio');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al obtener ejercicio');
    } finally {
      setLoading(false);
    }
  };

  const modes: { id: SandboxMode; icon: React.ReactNode; label: string }[] = [
    { id: 'manual', icon: <FlaskConical className="w-4 h-4" />, label: 'Manual' },
    { id: 'ddl', icon: <Code className="w-4 h-4" />, label: 'SQL DDL' },
    { id: 'csv', icon: <Upload className="w-4 h-4" />, label: 'CSV' },
    { id: 'exercise', icon: <BookOpen className="w-4 h-4" />, label: 'Ejercicios' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-4 text-sm text-indigo-200">
        <strong className="text-indigo-100">Modo Sandbox</strong> — Totalmente offline, sin base de datos ni
        autenticación requerida. Ideal para practicar y experimentar con normalización.
      </div>

      <div className="flex gap-2 flex-wrap">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setMode(m.id);
              setResult(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === m.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      {result && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-500/20 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500" />
            <span>El esquema ya quedó listo para enviarse al normalizador.</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate?.('normalization')}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
          >
            Abrir normalizador
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {mode === 'manual' && (
        <div className="space-y-4 bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-white">Constructor Manual de Esquemas</h3>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Nombre de tabla</label>
            <input
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Ej: Estudiante"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-slate-400">Atributos</label>
              <button
                onClick={handleAddAttribute}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Agregar
              </button>
            </div>
            <div className="space-y-2">
              {attributes.map((attr, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={attr}
                    onChange={(e) => handleAttributeChange(i, e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="nombre_atributo"
                  />
                  {attributes.length > 1 && (
                    <button
                      onClick={() => handleRemoveAttribute(i)}
                      className="text-red-400 hover:text-red-300 p-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-slate-400">Dependencias Funcionales</label>
              <button
                onClick={handleAddDependency}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Agregar
              </button>
            </div>
            <div className="space-y-2">
              {dependencies.map((dep, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={dep.det[0] || ''}
                    onChange={(e) => handleDetChange(i, e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="determinante"
                  />
                  <span className="text-slate-500 text-sm font-mono">&rarr;</span>
                  <input
                    type="text"
                    value={dep.dep[0] || ''}
                    onChange={(e) => handleDepChange(i, e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="dependiente"
                  />
                  {dependencies.length > 1 && (
                    <button
                      onClick={() => handleRemoveDependency(i)}
                      className="text-red-400 hover:text-red-300 p-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? <LoadingSpinner size={16} /> : 'Analizar Esquema'}
          </button>
        </div>
      )}

      {mode === 'ddl' && (
        <div className="space-y-4 bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-white">Parser SQL DDL</h3>
          <p className="text-sm text-slate-400">
            Escribe una sentencia CREATE TABLE para extraer el esquema y las dependencias funcionales.
          </p>
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            rows={6}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="CREATE TABLE Estudiante (&#10;  id INTEGER PRIMARY KEY,&#10;  nombre TEXT,&#10;  email TEXT UNIQUE&#10;);"
          />
          <button
            onClick={handleParseDdl}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? <LoadingSpinner size={16} /> : 'Parsear DDL'}
          </button>
        </div>
      )}

      {mode === 'csv' && (
        <div className="space-y-4 bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-white">Importar CSV</h3>
          <p className="text-sm text-slate-400">
            Pega contenido CSV para descubrir automáticamente atributos y dependencias funcionales.
          </p>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={6}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="id,nombre,email&#10;1,Ana,ana@example.com&#10;2,Luis,luis@example.com"
          />
          <button
            onClick={handleImportCsv}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? <LoadingSpinner size={16} /> : 'Importar CSV'}
          </button>
        </div>
      )}

      {mode === 'exercise' && (
        <div className="space-y-4 bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-white">Ejercicios de Normalización</h3>
          <p className="text-sm text-slate-400">
            Selecciona una forma normal y genera un ejercicio para practicar.
          </p>
          <div className="flex gap-2 flex-wrap">
            {['1FN', '2FN', '3FN', 'BCNF', '4FN', '5FN'].map((nf) => (
              <button
                key={nf}
                onClick={() => setExerciseNf(nf)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  exerciseNf === nf
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {nf}
              </button>
            ))}
          </div>
          <button
            onClick={handleExercise}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? <LoadingSpinner size={16} /> : 'Generar Ejercicio'}
          </button>
        </div>
      )}

      {result && mode === 'exercise' && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-4">
          <h3 className="text-lg font-semibold text-white">{result.title}</h3>
          {result.schema && (
            <div className="bg-slate-900 rounded-lg p-4 text-sm font-mono text-slate-300 space-y-2">
              <p>
                <span className="text-indigo-400">Tabla:</span> {result.schema.table_name}(
                {result.schema.attributes.join(', ')})
              </p>
              <p className="text-indigo-400">DFs:</p>
              <ul className="list-disc list-inside text-slate-400 pl-2 space-y-1">
                {result.schema.dependencies.map((dep: any, i: number) => (
                  <li key={i}>
                    {'{'}{dep.determinant.join(', ')}{'}'} &rarr; {'{'}
                    {dep.dependent.join(', ')}{'}'}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-white text-base font-medium">{result.question}</p>
          <details className="bg-slate-900 rounded-lg p-4">
            <summary className="text-indigo-400 cursor-pointer text-sm font-medium">
              Ver respuesta
            </summary>
            <p className="mt-2 text-slate-300 text-sm">
              {result.answer ? 'Verdadero' : 'Falso'} — {result.explanation}
            </p>
          </details>
        </div>
      )}

      {result && mode !== 'exercise' && result.diagnosis && (
        <DiagnosisPanel diagnosis={result.diagnosis} />
      )}

      {result && mode !== 'exercise' && !result.diagnosis && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <pre className="text-sm text-slate-300 overflow-auto max-h-96">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
