import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  BookOpen,
  ChevronRight,
  Code2,
  Database,
  Download,
  FileText,
  Filter,
  Layers3,
  Search,
  Sparkles,
  Star,
  Video,
} from 'lucide-react';
import axiosInstance from '../services/api';
import { useLocaleStore } from '../store/localeStore';
import { buildLearningPath, calculateStreak, formatLongDateTime } from '../services/insights';
import { RingChart } from './ChartWidgets';
import { LoadingSpinner } from './LoadingSpinner';
import { toast } from './Toast';
import type { ProgressSnapshot, ViewType } from '../types';

interface GlossaryTerm {
  name: string;
  short: string;
  definition: string;
  example: string;
  analogy: string;
  symbol: string;
  related_terms: string[];
  difficulty: string;
}

interface GlossaryPanelProps {
  onNavigate?: (view: ViewType) => void;
}

type CategoryFilter = 'all' | 'guides' | 'sql' | 'cases' | 'videos' | 'glossary' | 'docs';
type DifficultyFilter = 'all' | 'basic' | 'intermediate' | 'advanced';

interface SavedEntry {
  key: string;
  savedAt: string;
}

interface DownloadEntry {
  key: string;
  downloadedAt: string;
  fileName: string;
}

const difficultyLabels: Record<string, Record<DifficultyFilter, string>> = {
  es: { basic: 'Básico', intermediate: 'Intermedio', advanced: 'Avanzado', all: 'Todos' },
  en: { basic: 'Basic', intermediate: 'Intermediate', advanced: 'Advanced', all: 'All' },
  'pt-BR': { basic: 'Básico', intermediate: 'Intermediário', advanced: 'Avançado', all: 'Todos' },
};

const STORAGE_FAVORITES = 'dataquest:library_favorites';
const STORAGE_DOWNLOADS = 'dataquest:library_downloads';
const STORAGE_SELECTED = 'dataquest:library_selected_term';

function readList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveList<T>(key: string, value: T[]) {
  localStorage.setItem(key, JSON.stringify(value));
}

function downloadText(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function categoryForTerm(term: GlossaryTerm, index: number): CategoryFilter {
  if (term.difficulty === 'basic') return 'guides';
  if (term.difficulty === 'intermediate') return 'sql';
  if (term.difficulty === 'advanced') return index % 2 === 0 ? 'cases' : 'videos';
  return 'glossary';
}

function categoryLabel(category: CategoryFilter): string {
  switch (category) {
    case 'guides':
      return 'Guía';
    case 'sql':
      return 'Plantilla SQL';
    case 'cases':
      return 'Caso de estudio';
    case 'videos':
      return 'Video';
    case 'docs':
      return 'Documentación';
    case 'glossary':
      return 'Glosario';
    default:
      return 'Todo';
  }
}

function categoryTone(category: CategoryFilter) {
  switch (category) {
    case 'guides':
      return 'bg-blue-100 text-blue-700';
    case 'sql':
      return 'bg-emerald-100 text-emerald-700';
    case 'cases':
      return 'bg-amber-100 text-amber-700';
    case 'videos':
      return 'bg-violet-100 text-violet-700';
    case 'docs':
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function accentColor(category: CategoryFilter) {
  switch (category) {
    case 'guides':
      return 'from-blue-600 to-cyan-500';
    case 'sql':
      return 'from-emerald-600 to-teal-500';
    case 'cases':
      return 'from-amber-500 to-orange-500';
    case 'videos':
      return 'from-violet-600 to-fuchsia-500';
    case 'docs':
      return 'from-slate-600 to-slate-400';
    default:
      return 'from-slate-600 to-slate-400';
  }
}

function iconForCategory(category: CategoryFilter) {
  switch (category) {
    case 'guides':
      return BookOpen;
    case 'sql':
      return Code2;
    case 'cases':
      return Database;
    case 'videos':
      return Video;
    case 'docs':
      return FileText;
    default:
      return Layers3;
  }
}

function formatBadgeList(items: string[]) {
  return items.slice(0, 3).map((item) => item.trim()).filter(Boolean);
}

function saveSelectedTerm(key: string) {
  localStorage.setItem(STORAGE_SELECTED, key);
}

function readSelectedTerm() {
  try {
    return localStorage.getItem(STORAGE_SELECTED);
  } catch {
    return null;
  }
}

export const GlossaryPanel: React.FC<GlossaryPanelProps> = ({ onNavigate }) => {
  const { locale } = useLocaleStore();
  const [loading, setLoading] = useState(true);
  const [terms, setTerms] = useState<Record<string, GlossaryTerm>>({});
  const [progress, setProgress] = useState<ProgressSnapshot | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [favorites, setFavorites] = useState<SavedEntry[]>(() => readList<SavedEntry>(STORAGE_FAVORITES));
  const [downloads, setDownloads] = useState<DownloadEntry[]>(() => readList<DownloadEntry>(STORAGE_DOWNLOADS));
  const [selectedTermKey, setSelectedTermKey] = useState<string | null>(readSelectedTerm());

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);

      try {
        const [termsResponse, progressResponse] = await Promise.all([
          axiosInstance.get('/glossary', { headers: { 'X-Locale': locale } }),
          axiosInstance.get('/progress'),
        ]);

        if (!mounted) return;

        setTerms((termsResponse.data?.data ?? {}) as Record<string, GlossaryTerm>);
        setProgress(progressResponse.data?.data ?? null);
      } catch {
        if (mounted) {
          toast.error('No se pudo cargar la biblioteca.');
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
  }, [locale]);

  const termEntries = useMemo(() => Object.entries(terms), [terms]);
  const learningPath = useMemo(() => buildLearningPath(progress), [progress]);
  const currentRoute = learningPath.find((step) => step.status === 'in_progress')
    ?? learningPath.find((step) => step.status === 'available')
    ?? learningPath[0];

  const selectedTermEntry = useMemo(() => {
    if (selectedTermKey && terms[selectedTermKey]) {
      return [selectedTermKey, terms[selectedTermKey]] as const;
    }
    const firstKey = termEntries[0]?.[0] ?? null;
    if (firstKey && terms[firstKey]) {
      return [firstKey, terms[firstKey]] as const;
    }
    return null;
  }, [selectedTermKey, termEntries, terms]);

  useEffect(() => {
    if (!selectedTermEntry) return;
    saveSelectedTerm(selectedTermEntry[0]);
    setSelectedTermKey(selectedTermEntry[0]);
  }, [selectedTermEntry]);

  const allTerms = useMemo(() => {
    return termEntries.map(([key, term], index) => ({
      key,
      term,
      category: categoryForTerm(term, index),
    }));
  }, [termEntries]);

  const filteredTerms = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allTerms.filter((entry) => {
      if (categoryFilter !== 'all' && entry.category !== categoryFilter) return false;
      if (difficultyFilter !== 'all' && entry.term.difficulty !== difficultyFilter) return false;

      if (!query) return true;

      return (
        entry.term.name.toLowerCase().includes(query) ||
        entry.term.short.toLowerCase().includes(query) ||
        entry.term.definition.toLowerCase().includes(query) ||
        entry.term.example.toLowerCase().includes(query)
      );
    });
  }, [allTerms, categoryFilter, difficultyFilter, search]);

  const featuredEntry = selectedTermEntry
    ? {
        key: selectedTermEntry[0],
        term: selectedTermEntry[1],
        category: categoryForTerm(selectedTermEntry[1], 0),
      }
    : filteredTerms[0] ?? allTerms[0] ?? null;

  const recommendationEntries = useMemo(() => {
    const related = featuredEntry?.term.related_terms ?? [];
    const byRelation = allTerms.filter((entry) => related.some((item) => entry.term.name === item || entry.term.short === item));
    const routeSuggested = learningPath
      .slice(0, 3)
      .map((step) => allTerms.find((entry) => entry.term.short === step.nf || entry.term.name.toLowerCase().includes(step.nf.toLowerCase())))
      .filter((entry): entry is { key: string; term: GlossaryTerm; category: CategoryFilter } => !!entry);

    return [...byRelation, ...routeSuggested].slice(0, 4);
  }, [allTerms, featuredEntry?.term.related_terms, learningPath]);

  const nfChips = progress?.nf_progress ?? [];
  const routeProgress = progress?.mastered_count && progress.total_nf
    ? Math.round((progress.mastered_count / progress.total_nf) * 100)
    : currentRoute?.progress ?? 0;

  const toggleFavorite = (key: string) => {
    const exists = favorites.some((item) => item.key === key);
    const next = exists
      ? favorites.filter((item) => item.key !== key)
      : [...favorites, { key, savedAt: new Date().toISOString() }];

    setFavorites(next);
    saveList(STORAGE_FAVORITES, next);
    toast.success(exists ? 'Favorito eliminado.' : 'Favorito guardado.');
  };

  const handleDownload = (key: string, term: GlossaryTerm) => {
    const fileName = `${key}.json`;
    downloadText(JSON.stringify({ key, ...term }, null, 2), fileName, 'application/json;charset=utf-8');

    const next = [
      { key, downloadedAt: new Date().toISOString(), fileName },
      ...downloads.filter((item) => item.key !== key),
    ].slice(0, 6);

    setDownloads(next);
    saveList(STORAGE_DOWNLOADS, next);
    toast.success(`Descarga creada para ${term.name}.`);
  };

  const showEmpty = !loading && filteredTerms.length === 0;

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <LoadingSpinner text="Cargando biblioteca..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Biblioteca</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Explora guías, plantillas, casos de estudio y términos de normalización con contenido real adaptado a tu progreso.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate?.('academy')}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-slate-50"
        >
          <Sparkles className="h-4 w-4" />
          Ver guía completa
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-[#0b1d4c] to-[#102d7f] p-6 text-white shadow-lg">
          <div className="flex h-full flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white/80">
                Recurso destacado
              </span>
              <h2 className="mt-4 text-3xl font-bold leading-tight">
                {featuredEntry?.term.name ?? 'Glosario de Base de Datos'}
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/80">
                {featuredEntry?.term.definition ?? 'Consulta términos, analogías y ejemplos concretos para avanzar en normalización relacional.'}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                  {featuredEntry?.term.short ?? 'GL'}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${categoryTone(featuredEntry?.category ?? 'glossary')}`}>
                  {categoryLabel(featuredEntry?.category ?? 'glossary')}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                  {difficultyLabels[locale]?.[featuredEntry?.term.difficulty as DifficultyFilter] ?? featuredEntry?.term.difficulty}
                </span>
              </div>
              <button
                type="button"
                onClick={() => featuredEntry && handleDownload(featuredEntry.key, featuredEntry.term)}
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:brightness-105"
              >
                <Download className="h-4 w-4" />
                Descargar recurso
              </button>
            </div>

            <div className="relative flex min-h-[220px] min-w-[320px] items-center justify-center">
              <div className="absolute -left-4 top-8 h-20 w-20 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute right-6 top-0 h-28 w-28 rounded-full bg-cyan-400/20 blur-2xl" />
              <div className="relative flex h-44 w-44 items-center justify-center rounded-[32px] border border-white/10 bg-white/10 shadow-2xl backdrop-blur">
                <BookOpen className="h-20 w-20 text-white/90" />
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Ruta actual</h3>
              <p className="mt-1 text-sm text-slate-500">Tu progreso se actualiza con el avance real de la cuenta.</p>
            </div>
            <button type="button" onClick={() => onNavigate?.('reports')} className="text-sm font-semibold text-blue-600 transition hover:text-blue-700">
              Ver ruta
            </button>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <RingChart value={routeProgress} label="Progreso general" sublabel={`${routeProgress}%`} size={128} stroke={11} color="#14b8a6" />
            <div className="flex-1 space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Lección actual</div>
                <div className="mt-1 text-base font-bold text-slate-900">
                  {currentRoute?.nf ?? '—'} - {currentRoute?.name ?? 'Ruta de aprendizaje'}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {currentRoute?.description ?? 'Explora el siguiente paso de tu ruta.'}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Siguiente</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {buildLearningPath(progress).find((step) => step.status !== 'completed' && step.nf !== currentRoute?.nf)?.name ?? 'Continúa tu progreso'}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Lecturas recomendadas</div>
            <p className="mt-1 text-sm text-slate-500">
              Selecciona un término, guarda favoritos o descarga contenido para seguir aprendiendo fuera de la sesión.
            </p>
          </div>
        </article>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
          <Layers3 className="h-4 w-4 text-blue-600" />
          Formas normales
        </div>
        {nfChips.map((item) => (
          <button
            type="button"
            key={item.concept}
            onClick={() => setCategoryFilter('glossary')}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-white"
          >
            {item.concept}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar recursos por título, tema, etiqueta..."
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            ['all', 'Todos'],
            ['guides', 'Guías'],
            ['sql', 'Plantillas SQL'],
            ['cases', 'Casos de estudio'],
            ['videos', 'Videos'],
            ['docs', 'Documentación'],
          ] as Array<[CategoryFilter, string]>).map(([category, label]) => (
            <button
              key={category}
              type="button"
              onClick={() => setCategoryFilter(category)}
              className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                categoryFilter === category
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-200 hover:bg-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'basic', 'intermediate', 'advanced'] as DifficultyFilter[]).map((difficulty) => (
            <button
              key={difficulty}
              type="button"
              onClick={() => setDifficultyFilter(difficulty)}
              className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
                difficultyFilter === difficulty
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-200 hover:bg-white'
              }`}
            >
              {difficultyLabels[locale]?.[difficulty] ?? difficulty}
            </button>
          ))}
        </div>
        <button type="button" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-white">
          <Filter className="h-4 w-4" />
          Más filtros
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900">Recursos disponibles</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                {filteredTerms.length} resultados
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
            >
              Limpiar filtros
            </button>
          </div>

          {showEmpty ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
              <BookOpen className="mx-auto h-16 w-16 text-slate-300" />
              <h3 className="mt-4 text-xl font-semibold text-slate-700">Sin resultados</h3>
              <p className="mt-2 text-sm text-slate-500">
                No se encontraron términos que coincidan con tu búsqueda o filtros actuales.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
              {filteredTerms.slice(0, 6).map((entry) => {
                const Icon = iconForCategory(entry.category);
                const isFavorite = favorites.some((item) => item.key === entry.key);
                return (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => {
                      setSelectedTermKey(entry.key);
                      saveSelectedTerm(entry.key);
                    }}
                    className={`rounded-[28px] border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                      featuredEntry?.key === entry.key ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accentColor(entry.category)} text-white shadow-lg`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleFavorite(entry.key);
                        }}
                        className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-400 transition hover:border-blue-200 hover:text-blue-700"
                        aria-label={isFavorite ? `Quitar favorito ${entry.term.name}` : `Guardar favorito ${entry.term.name}`}
                      >
                        <Bookmark className={`h-4 w-4 ${isFavorite ? 'fill-current text-blue-600' : ''}`} />
                      </button>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${categoryTone(entry.category)}`}>
                        {categoryLabel(entry.category)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                        {entry.term.short}
                      </span>
                    </div>

                    <h3 className="mt-3 text-base font-bold text-slate-900">{entry.term.name}</h3>
                    <p className="mt-2 line-clamp-3 text-sm text-slate-500">{entry.term.definition}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {formatBadgeList(entry.term.related_terms).map((related) => (
                        <span key={related} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          {related}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                      <span>{difficultyLabels[locale]?.[entry.term.difficulty as DifficultyFilter] ?? entry.term.difficulty}</span>
                      <span className="inline-flex items-center gap-1">
                        <Download className="h-3.5 w-3.5" />
                        Descargar
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDownload(entry.key, entry.term);
                      }}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                      <FileText className="h-4 w-4" />
                      Ver y descargar
                    </button>
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => onNavigate?.('academy')}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-slate-50"
          >
            <ChevronRight className="h-4 w-4" />
            Ver todos los recursos
          </button>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-900">Guardados / Favoritos</h3>
                <button type="button" className="text-sm font-semibold text-blue-600 transition hover:text-blue-700">
                  Ver todos
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {favorites.length > 0 ? favorites.slice(0, 3).map((favorite) => {
                  const entry = allTerms.find((item) => item.key === favorite.key);
                  if (!entry) return null;
                  return (
                    <div key={favorite.key} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${accentColor(entry.category)} text-white`}>
                        <Star className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">{entry.term.name}</div>
                        <div className="text-xs text-slate-500">
                          Guardado {formatLongDateTime(favorite.savedAt)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(favorite.key)}
                        className="text-slate-400 transition hover:text-rose-500"
                        aria-label={`Eliminar favorito ${entry.term.name}`}
                      >
                        <Bookmark className="h-4 w-4 fill-current" />
                      </button>
                    </div>
                  );
                }) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    Guarda términos para que aparezcan aquí.
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-900">Descargas recientes</h3>
                <button type="button" className="text-sm font-semibold text-blue-600 transition hover:text-blue-700">
                  Ver todo
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {downloads.length > 0 ? downloads.slice(0, 3).map((download) => {
                  const entry = allTerms.find((item) => item.key === download.key);
                  if (!entry) return null;
                  return (
                    <div key={download.key} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${accentColor(entry.category)} text-white`}>
                        <Download className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">{entry.term.name}</div>
                        <div className="text-xs text-slate-500">
                          Descargado {formatLongDateTime(download.downloadedAt)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownload(download.key, entry.term)}
                        className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-blue-200 hover:text-blue-700"
                        aria-label={`Descargar nuevamente ${entry.term.name}`}
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  );
                }) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    Tus descargas recientes aparecerán aquí.
                  </div>
                )}
              </div>
            </article>
          </div>
        </section>

        <aside className="space-y-4">
          <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-900">Ruta actual</h2>
              <button type="button" onClick={() => onNavigate?.('academy')} className="text-sm font-semibold text-blue-600 transition hover:text-blue-700">
                Ver ruta
              </button>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <RingChart value={routeProgress} label="Progreso" sublabel={`${routeProgress}%`} size={112} stroke={10} color="#14b8a6" />
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Lección actual</div>
                  <div className="mt-1 text-sm font-bold text-slate-900">
                    {currentRoute?.nf ?? '—'} - {currentRoute?.name ?? 'Ruta de aprendizaje'}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{currentRoute?.description ?? 'Selecciona una forma normal para continuar.'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Siguiente</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {buildLearningPath(progress).find((step) => step.status !== 'completed' && step.nf !== currentRoute?.nf)?.name ?? 'Sigue explorando'}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Resumen rápido</div>
              <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-white px-3 py-2">
                  <div className="text-xs text-slate-400">Lecciones</div>
                  <div className="font-bold text-slate-900">{progress?.mastered_count ?? 0} / {progress?.total_nf ?? 0}</div>
                </div>
                <div className="rounded-2xl bg-white px-3 py-2">
                  <div className="text-xs text-slate-400">Racha</div>
                  <div className="font-bold text-slate-900">{calculateStreak(progress ? [{ date: new Date().toISOString(), schemas_validated: progress.mastered_count }] : [])} días</div>
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-900">Recursos recomendados</h2>
              <button type="button" className="text-sm font-semibold text-blue-600 transition hover:text-blue-700">
                Ver todos
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {recommendationEntries.length > 0 ? recommendationEntries.map((entry) => {
                const Icon = iconForCategory(entry.category);
                return (
                  <div key={entry.key} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${accentColor(entry.category)} text-white`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">{entry.term.name}</div>
                      <div className="text-xs text-slate-500">{entry.term.definition}</div>
                    </div>
                    <div className="text-xs font-semibold text-slate-500">
                      {entry.category === 'videos' ? 'Video' : entry.category === 'sql' ? 'SQL' : 'PDF'}
                    </div>
                  </div>
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  Explora el glosario para que aparezcan sugerencias.
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('academy')}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              <ChevronRight className="h-4 w-4" />
              Explorar más recursos
            </button>
          </article>
        </aside>
      </div>
    </div>
  );
};
