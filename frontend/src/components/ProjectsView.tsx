import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FolderKanban,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  PencilLine,
  Search,
  Upload,
  Trash2,
  X,
  WandSparkles,
} from 'lucide-react';
import axiosInstance from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useSchemaStore } from '../store/schemaStore';
import type { SchemaSummary, ViewType } from '../types';
import {
  fetchSchemas,
  formatLongDateTime,
  formatRelativeTime,
  nfCompletion,
  NF_LABELS,
  NF_ORDER,
  nfIndex,
  normalizeNf,
} from '../services/insights';
import { toast } from './Toast';

interface ProjectsViewProps {
  onNavigate: (view: ViewType) => void;
  searchQuery: string;
}

type SortMode = 'recent' | 'oldest' | 'level';
type ComposerMode = 'template' | 'manual' | 'sql';
type ProjectStatus = 'completed' | 'in_progress' | 'blocked' | 'draft' | 'archived';

interface ProjectRow extends SchemaSummary {
  status: ProjectStatus;
  latestLevel: string | null;
  progress: number;
  lastUpdated: string;
  description: string | null;
  archivedAt: string | null;
  validationsCount: number;
  latestVersion: string | null;
}

function statusStyles(status: ProjectRow['status']): string {
  switch (status) {
    case 'archived':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'completed':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'blocked':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'in_progress':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    default:
      return 'bg-slate-100 text-slate-500 border-slate-200';
  }
}

function statusLabel(status: ProjectRow['status']): string {
  switch (status) {
    case 'archived':
      return 'Archivado';
    case 'completed':
      return 'Completado';
    case 'blocked':
      return 'Bloqueado';
    case 'in_progress':
      return 'En progreso';
    default:
      return 'Sin validar';
  }
}

function nfLabel(value: string | null): string {
  if (!value) return '—';
  if (value === '1FN' || value === '2FN' || value === '3FN' || value === 'BCNF' || value === '4FN' || value === '5FN') {
    return value;
  }
  return value;
}

function splitAttributeInput(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function splitDependencyInput(raw: string): { determinant: string[]; dependent: string[] }[] {
  return raw
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [left, right] = line.split(/->|→|⇒/);
      if (!left || !right) return null;
      const determinant = splitAttributeInput(left);
      const dependent = splitAttributeInput(right);
      if (!determinant.length || !dependent.length) return null;
      return { determinant, dependent };
    })
    .filter((item): item is { determinant: string[]; dependent: string[] } => item !== null);
}

function latestSchemaLevel(entry: SchemaSummary): string | null {
  return entry.ultima_validacion ? normalizeNf(entry.ultima_validacion) : null;
}

function classifyProjectStatus(entry: SchemaSummary): ProjectStatus {
  if (entry.archived_at) return 'archived';

  const latest = latestSchemaLevel(entry);
  const attempts = entry.validaciones_count ?? 0;
  const levelIndex = nfIndex(latest);

  if (!attempts) return 'draft';
  if (latest === '5FN') return 'completed';
  if (levelIndex <= 0 && attempts >= 3) return 'blocked';
  if (levelIndex <= 1 && attempts >= 2) return 'blocked';
  return 'in_progress';
}

function mapSchemaToProjectRow(entry: SchemaSummary): ProjectRow {
  const latestLevel = latestSchemaLevel(entry);

  return {
    ...entry,
    status: classifyProjectStatus(entry),
    latestLevel,
    progress: nfCompletion(latestLevel),
    lastUpdated: entry.last_activity_at ?? entry.fecha_creacion,
    description: entry.descripcion ?? null,
    archivedAt: entry.archived_at ?? null,
    validationsCount: entry.validaciones_count ?? 0,
    latestVersion: entry.ultima_version ?? null,
  };
}

const TEMPLATE_PRESETS = [
  {
    id: 'ventas',
    name: 'Sistema de Ventas',
    description: 'Base de datos para la gestión integral de ventas y clientes.',
    targetNf: '3FN',
    accent: 'from-blue-600 to-indigo-600',
    attributes: ['idVenta', 'idProducto', 'idCliente', 'fechaVenta', 'cantidad', 'precioUnitario', 'descuento', 'totalLinea'],
    dependencies: [
      { determinant: ['idProducto'], dependent: ['precioUnitario'] },
      { determinant: ['idVenta', 'idProducto'], dependent: ['cantidad', 'descuento'] },
      { determinant: ['idVenta', 'idProducto'], dependent: ['totalLinea'] },
    ],
  },
  {
    id: 'academia',
    name: 'Universidad DB',
    description: 'Modelo académico para cursos, matrículas y calificaciones.',
    targetNf: '2FN',
    accent: 'from-violet-600 to-fuchsia-500',
    attributes: ['idEstudiante', 'nombreEstudiante', 'idCurso', 'nombreCurso', 'fechaMatricula', 'notaFinal'],
    dependencies: [
      { determinant: ['idEstudiante'], dependent: ['nombreEstudiante'] },
      { determinant: ['idCurso'], dependent: ['nombreCurso'] },
      { determinant: ['idEstudiante', 'idCurso'], dependent: ['fechaMatricula', 'notaFinal'] },
    ],
  },
  {
    id: 'biblioteca',
    name: 'Biblioteca Académica',
    description: 'Catálogo de libros, autores, préstamos y usuarios.',
    targetNf: 'BCNF',
    accent: 'from-emerald-600 to-teal-500',
    attributes: ['idLibro', 'titulo', 'idAutor', 'nombreAutor', 'idPrestamo', 'fechaPrestamo', 'fechaDevolucion'],
    dependencies: [
      { determinant: ['idLibro'], dependent: ['titulo', 'idAutor'] },
      { determinant: ['idAutor'], dependent: ['nombreAutor'] },
      { determinant: ['idPrestamo'], dependent: ['fechaPrestamo', 'fechaDevolucion'] },
    ],
  },
  {
    id: 'rrhh',
    name: 'Recursos Humanos',
    description: 'Gestión de empleados, departamentos y nómina.',
    targetNf: '3FN',
    accent: 'from-orange-500 to-amber-500',
    attributes: ['idEmpleado', 'nombreEmpleado', 'idDepartamento', 'nombreDepartamento', 'salario', 'fechaIngreso'],
    dependencies: [
      { determinant: ['idEmpleado'], dependent: ['nombreEmpleado', 'salario', 'fechaIngreso'] },
      { determinant: ['idDepartamento'], dependent: ['nombreDepartamento'] },
    ],
  },
  {
    id: 'inventario',
    name: 'Inventario Retail',
    description: 'Productos, proveedores y movimientos de stock.',
    targetNf: '4FN',
    accent: 'from-rose-500 to-red-500',
    attributes: ['idProducto', 'nombreProducto', 'idProveedor', 'nombreProveedor', 'cantidadStock', 'ubicacion'],
    dependencies: [
      { determinant: ['idProducto'], dependent: ['nombreProducto', 'cantidadStock', 'ubicacion'] },
      { determinant: ['idProveedor'], dependent: ['nombreProveedor'] },
    ],
  },
] as const;

export const ProjectsView: React.FC<ProjectsViewProps> = ({ onNavigate, searchQuery }) => {
  const { user } = useAuthStore();
  const { selectSchemaTarget } = useSchemaStore();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [activeStatus, setActiveStatus] = useState<ProjectRow['status'] | 'all'>('all');
  const [activeLevel, setActiveLevel] = useState<string | 'all'>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [page, setPage] = useState(1);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<ComposerMode>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState<(typeof TEMPLATE_PRESETS)[number]['id']>('ventas');
  const [composerName, setComposerName] = useState('');
  const [composerDescription, setComposerDescription] = useState('');
  const [composerAttributes, setComposerAttributes] = useState('');
  const [composerDependencies, setComposerDependencies] = useState('');
  const [composerSql, setComposerSql] = useState('');
  const [composerSubmitting, setComposerSubmitting] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRow | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [editingSaving, setEditingSaving] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  const selectedTemplate = useMemo(
    () => TEMPLATE_PRESETS.find((template) => template.id === selectedTemplateId) ?? TEMPLATE_PRESETS[0],
    [selectedTemplateId],
  );

  const resetComposer = (mode: ComposerMode = 'template') => {
    const template = TEMPLATE_PRESETS.find((item) => item.id === selectedTemplateId) ?? TEMPLATE_PRESETS[0];
    setComposerMode(mode);
    setComposerName(template.name);
    setComposerDescription(template.description);
    setComposerAttributes(template.attributes.join(', '));
    setComposerDependencies(template.dependencies.map((fd) => `${fd.determinant.join(', ')} -> ${fd.dependent.join(', ')}`).join('\n'));
    setComposerSql(`CREATE TABLE ${template.name.replace(/\s+/g, '_').toLowerCase()} (\n  id INT PRIMARY KEY,\n  nombre VARCHAR(150) NOT NULL\n);`);
    setComposerOpen(true);
  };

  const reloadProjects = async () => {
    if (!user) return;

    try {
      const schemas = await fetchSchemas();
      setProjects(schemas.map(mapSchemaToProjectRow));
    } catch {
      toast.error('No se pudieron recargar tus proyectos.');
    }
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!user) {
        setLoading(false);
        setProjects([]);
        return;
      }

      setLoading(true);
      try {
        const schemas = await fetchSchemas();
        if (!mounted) return;

        setProjects(schemas.map(mapSchemaToProjectRow));
      } catch {
        if (mounted) {
          setProjects([]);
          toast.error('No se pudieron cargar tus proyectos.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [user]);

  const stats = useMemo(() => {
    const total = projects.length;
    const completed = projects.filter((p) => p.status === 'completed').length;
    const blocked = projects.filter((p) => p.status === 'blocked').length;
    const inProgress = projects.filter((p) => p.status === 'in_progress').length;
    const drafts = projects.filter((p) => p.status === 'draft').length;
    const archived = projects.filter((p) => p.status === 'archived').length;
    const validations = projects.reduce((sum, project) => sum + project.validationsCount, 0);

    return { total, completed, blocked, inProgress, drafts, archived, validations };
  }, [projects]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    let next = [...projects];

    if (query) {
      next = next.filter((project) => {
        const level = project.latestLevel ?? '';
        const description = project.description ?? '';
        return (
          project.nombre.toLowerCase().includes(query) ||
          description.toLowerCase().includes(query) ||
          level.toLowerCase().includes(query) ||
          NF_LABELS[level]?.toLowerCase().includes(query) ||
          formatRelativeTime(project.lastUpdated).toLowerCase().includes(query) ||
          project.status.toLowerCase().includes(query)
        );
      });
    }

    if (activeStatus !== 'all') {
      next = next.filter((project) => project.status === activeStatus);
    }

    if (activeLevel !== 'all') {
      next = next.filter((project) => project.latestLevel === activeLevel);
    }

    next.sort((a, b) => {
      if (sortMode === 'oldest') {
        return new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime();
      }

      if (sortMode === 'level') {
        return nfIndex(b.latestLevel) - nfIndex(a.latestLevel);
      }

      return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
    });

    return next;
  }, [activeLevel, activeStatus, projects, searchQuery, sortMode]);

  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, activeLevel, activeStatus, sortMode]);

  const openProject = async (project: ProjectRow) => {
    try {
      setMenuOpenId(null);
      await axiosInstance.post(`/schemas/${project.id}/open`);
      selectSchemaTarget({ id: project.id, name: project.nombre });
      onNavigate('normalization');
    } catch {
      toast.error('No se pudo abrir el proyecto.');
    }
  };

  useEffect(() => {
    if (!composerOpen || composerMode !== 'template') {
      return;
    }

    setComposerName(selectedTemplate.name);
    setComposerDescription(selectedTemplate.description);
    setComposerAttributes(selectedTemplate.attributes.join(', '));
    setComposerDependencies(
      selectedTemplate.dependencies
        .map((fd) => `${fd.determinant.join(', ')} -> ${fd.dependent.join(', ')}`)
        .join('\n'),
    );
  }, [composerMode, composerOpen, selectedTemplate]);

  const openComposer = (mode: ComposerMode = 'template') => {
    setMenuOpenId(null);
    setEditingProject(null);
    resetComposer(mode);
  };

  const handleCreateFromTemplate = async () => {
    const template = TEMPLATE_PRESETS.find((item) => item.id === selectedTemplateId) ?? TEMPLATE_PRESETS[0];
    const payload = {
      table_name: composerName.trim() || template.name,
      description: composerDescription.trim() || template.description,
      attributes: composerAttributes.trim() ? splitAttributeInput(composerAttributes) : [...template.attributes],
      dependencies: composerDependencies.trim() ? splitDependencyInput(composerDependencies) : [...template.dependencies],
    };

    if (!payload.attributes.length || !payload.dependencies.length) {
      toast.warning('Completa atributos y dependencias antes de crear el proyecto.');
      return;
    }

    setComposerSubmitting(true);
    try {
      const response = await axiosInstance.post('/validate-schema', payload);
      if (!response.data?.success) {
        throw new Error('invalid_response');
      }

      toast.success(`Proyecto creado: ${payload.table_name}`);
      setComposerOpen(false);
      await reloadProjects();
    } catch {
      toast.error('No se pudo crear el proyecto.');
    } finally {
      setComposerSubmitting(false);
    }
  };

  const handleImportSql = async () => {
    if (!composerSql.trim()) {
      toast.warning('Pega el SQL para importar.');
      return;
    }

    setComposerSubmitting(true);
    try {
      const response = await axiosInstance.post('/parse/ddl', { sql: composerSql });
      const parsed = response.data?.data;
      if (!parsed?.table_name || !Array.isArray(parsed?.columns)) {
        throw new Error('invalid_sql');
      }

      const dependencies = [
        ...(parsed.functional_dependencies?.from_pk ?? []),
        ...(parsed.functional_dependencies?.from_unique ?? []),
      ].map((fd: any) => ({
        determinant: Array.isArray(fd.determinant) ? fd.determinant : Array.isArray(fd.determinante) ? fd.determinante : [],
        dependent: Array.isArray(fd.dependent) ? fd.dependent : Array.isArray(fd.dependiente) ? fd.dependiente : [],
      })).filter((fd: { determinant: string[]; dependent: string[] }) => fd.determinant.length > 0 && fd.dependent.length > 0);

      const attributes = parsed.columns
        .map((column: any) => column?.name ?? column?.column_name ?? column)
        .map((value: string) => String(value).trim())
        .filter(Boolean);

      const payload = {
        table_name: parsed.table_name,
        description: composerDescription.trim() || `Importado desde SQL el ${new Date().toLocaleDateString('es-PE')}`,
        attributes,
        dependencies,
      };

      const validationResponse = await axiosInstance.post('/validate-schema', payload);
      if (!validationResponse.data?.success) {
        throw new Error('import_failed');
      }

      toast.success(`Proyecto importado: ${payload.table_name}`);
      setComposerOpen(false);
      await reloadProjects();
    } catch {
      toast.error('No se pudo importar el SQL.');
    } finally {
      setComposerSubmitting(false);
    }
  };

  const handleComposerSubmit = async () => {
    if (composerMode === 'sql') {
      await handleImportSql();
      return;
    }

    await handleCreateFromTemplate();
  };

  const openEditProject = (project: ProjectRow) => {
    setComposerOpen(false);
    setEditingProject(project);
    setEditingName(project.nombre);
    setEditingDescription(project.description ?? '');
    setMenuOpenId(null);
  };

  const saveEditProject = async () => {
    if (!editingProject) return;
    if (!editingName.trim()) {
      toast.warning('El nombre del proyecto no puede estar vacío.');
      return;
    }

    setEditingSaving(true);
    try {
      const response = await axiosInstance.patch(`/schemas/${editingProject.id}`, {
        nombre: editingName.trim(),
        descripcion: editingDescription.trim() || null,
      });

      if (!response.data?.success) {
        throw new Error('invalid_response');
      }

      toast.success('Proyecto actualizado.');
      setEditingProject(null);
      await reloadProjects();
    } catch {
      toast.error('No se pudo actualizar el proyecto.');
    } finally {
      setEditingSaving(false);
    }
  };

  const toggleArchive = async (project: ProjectRow) => {
    try {
      const confirmed = window.confirm(
        project.archivedAt ? `¿Restaurar "${project.nombre}"?` : `¿Archivar "${project.nombre}"?`,
      );
      if (!confirmed) return;

      const response = await axiosInstance.patch(`/schemas/${project.id}/${project.archivedAt ? 'restore' : 'archive'}`);
      if (!response.data?.success) {
        throw new Error('archive_failed');
      }

      toast.success(project.archivedAt ? 'Proyecto restaurado.' : 'Proyecto archivado.');
      setMenuOpenId(null);
      await reloadProjects();
    } catch {
      toast.error('No se pudo cambiar el estado del proyecto.');
    }
  };

  const deleteProject = async (project: ProjectRow) => {
    const confirmed = window.confirm(`¿Eliminar definitivamente "${project.nombre}"?`);
    if (!confirmed) return;

    try {
      const response = await axiosInstance.delete(`/schemas/${project.id}`);
      if (!response.data?.success) {
        throw new Error('delete_failed');
      }

      toast.success('Proyecto eliminado.');
      setMenuOpenId(null);
      await reloadProjects();
    } catch {
      toast.error('No se pudo eliminar el proyecto.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">Proyectos</p>
          <h1 className="text-3xl font-bold text-slate-900">Gestiona y organiza tus proyectos de normalización de bases de datos.</h1>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => openComposer('template')}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:brightness-105"
          >
            <Plus className="h-4 w-4" />
            Nuevo proyecto
          </button>
          <button
            type="button"
            onClick={() => openComposer('sql')}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" />
            Importar SQL
          </button>
          <button
            type="button"
            onClick={() => openComposer('template')}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <WandSparkles className="h-4 w-4" />
            Plantillas
          </button>
          <button
            type="button"
            onClick={() => onNavigate('normalization')}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            aria-label="Más opciones"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Filtros</h2>
              <button
                type="button"
                onClick={() => {
                  setActiveStatus('all');
                  setActiveLevel('all');
                  setSortMode('recent');
                }}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Limpiar filtros
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <div className="mb-3 text-sm font-semibold text-slate-800">Estado</div>
                <div className="space-y-2">
                  {([
                    ['all', 'Todos', stats.total],
                    ['in_progress', 'En progreso', stats.inProgress],
                    ['completed', 'Completados', stats.completed],
                    ['blocked', 'Bloqueados', stats.blocked],
                    ['draft', 'Borradores', stats.drafts],
                    ['archived', 'Archivados', stats.archived],
                  ] as const).map(([value, label, count]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setActiveStatus(value)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                        activeStatus === value ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-medium">{label}</span>
                      <span className="text-xs font-semibold">{count}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-3 text-sm font-semibold text-slate-800">Forma normal alcanzada</div>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setActiveLevel('all')}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                      activeLevel === 'all' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-medium">Todas</span>
                    <span className="text-xs font-semibold">{stats.total}</span>
                  </button>

                  {NF_ORDER.map((nf) => {
                    const count = projects.filter((project) => project.latestLevel === nf).length;
                    return (
                      <button
                        key={nf}
                        type="button"
                        onClick={() => setActiveLevel(nf)}
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                          activeLevel === nf ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className="font-medium">{nf} - {NF_LABELS[nf]}</span>
                        <span className="text-xs font-semibold">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">Estadísticas de proyectos</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
                <div className="text-sm font-semibold text-blue-600">{stats.total}</div>
                <div className="text-xs text-slate-500">Total</div>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
                <div className="text-sm font-semibold text-emerald-600">{stats.completed}</div>
                <div className="text-xs text-slate-500">Completados</div>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3">
                <div className="text-sm font-semibold text-indigo-600">{stats.inProgress}</div>
                <div className="text-xs text-slate-500">En progreso</div>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-3">
                <div className="text-sm font-semibold text-rose-600">{stats.blocked}</div>
                <div className="text-xs text-slate-500">Bloqueados</div>
              </div>
            </div>
          </section>
        </aside>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={searchQuery}
                readOnly
                placeholder="Buscar proyectos..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                aria-label="Buscar proyectos"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setSortMode('recent')}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  sortMode === 'recent' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                Ordenar: Más recientes
                <ChevronDown className="ml-2 inline h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setSortMode('level')}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  sortMode === 'level' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                Ver por nivel
                <LayoutGrid className="ml-2 inline h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="overflow-visible">
            <div className="grid grid-cols-[1.4fr_0.8fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr] border-b border-slate-200 px-3 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              <div>Proyecto</div>
              <div>Estado</div>
              <div>Progreso</div>
              <div>Forma normal</div>
              <div>Propietario</div>
              <div>Última actualización</div>
              <div>Acciones</div>
            </div>

            {loading ? (
              <div className="space-y-4 p-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="grid grid-cols-[1.4fr_0.8fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr] items-center gap-4 rounded-3xl border border-slate-100 p-4">
                    <div className="h-12 rounded-2xl bg-slate-100 animate-pulse" />
                    <div className="h-8 rounded-2xl bg-slate-100 animate-pulse" />
                    <div className="h-8 rounded-2xl bg-slate-100 animate-pulse" />
                    <div className="h-8 rounded-2xl bg-slate-100 animate-pulse" />
                    <div className="h-8 rounded-2xl bg-slate-100 animate-pulse" />
                    <div className="h-8 rounded-2xl bg-slate-100 animate-pulse" />
                    <div className="h-8 rounded-2xl bg-slate-100 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : pageItems.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {pageItems.map((project) => (
                  <div
                    key={project.id}
                    className="grid grid-cols-[1.4fr_0.8fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr] items-center gap-4 px-3 py-5 transition hover:bg-slate-50/80"
                  >
                    <button
                      type="button"
                      onClick={() => void openProject(project)}
                      className="flex items-center gap-4 text-left"
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-600">
                        <FolderKanban className="h-7 w-7" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-base font-bold text-slate-900">{project.nombre}</div>
                        <div className="mt-1 line-clamp-1 text-sm text-slate-500">
                          {project.description || 'Sin descripción registrada todavía'}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {project.validationsCount > 0
                            ? `${project.latestVersion ? `${project.latestVersion} · ` : ''}${project.validationsCount} validación${project.validationsCount === 1 ? '' : 'es'}`
                            : 'Sin validaciones registradas todavía'}
                        </div>
                      </div>
                    </button>

                    <div>
                      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles(project.status)}`}>
                        {statusLabel(project.status)}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-end gap-2">
                        <div className="text-xl font-bold text-slate-900">{project.progress}%</div>
                        <div className="pb-1 text-xs text-slate-500">{project.validationsCount} validación{project.validationsCount === 1 ? '' : 'es'}</div>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${
                            project.status === 'completed'
                              ? 'from-emerald-500 to-teal-500'
                              : project.status === 'blocked'
                                ? 'from-rose-500 to-orange-500'
                                : 'from-blue-500 to-indigo-500'
                          }`}
                          style={{ width: `${project.progress || 12}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        {nfLabel(project.latestLevel)}
                      </span>
                      <div className="mt-1 text-sm text-slate-500">
                        {project.latestLevel ? NF_LABELS[project.latestLevel] : 'Sin determinar'}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white">
                        {user?.apodo?.slice(0, 2).toUpperCase() || 'DA'}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{user?.apodo || 'Usuario'}</div>
                        <div className="text-xs text-slate-500">{user?.rango || 'Estudiante'}</div>
                      </div>
                    </div>

                    <div className="text-sm text-slate-500">
                      <div>{formatRelativeTime(project.lastUpdated)}</div>
                      <div className="mt-1 text-xs text-slate-400">{formatLongDateTime(project.lastUpdated)}</div>
                    </div>

                    <div className="relative flex items-center gap-2 justify-self-end">
                      <button
                        type="button"
                        onClick={() => void openProject(project)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:text-blue-600"
                        aria-label={`Abrir ${project.nombre}`}
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('reports')}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:text-blue-600"
                        aria-label={`Ver informe de ${project.nombre}`}
                      >
                        <BarChart3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setMenuOpenId((current) => (current === project.id ? null : project.id));
                        }}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:text-blue-600"
                        aria-label={`Más acciones de ${project.nombre}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menuOpenId === project.id && (
                        <div
                          className="absolute right-0 top-12 z-20 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
                          role="menu"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpenId(null);
                              void openProject(project);
                            }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            <ArrowUpRight className="h-4 w-4 text-blue-600" />
                            Abrir proyecto
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void openProject(project);
                            }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            <WandSparkles className="h-4 w-4 text-violet-600" />
                            Abrir en Normalizer Engine
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpenId(null);
                              onNavigate('reports');
                            }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            <BarChart3 className="h-4 w-4 text-indigo-600" />
                            Ver informe
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpenId(null);
                              onNavigate('history');
                            }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            <Clock3 className="h-4 w-4 text-sky-600" />
                            Ver historial
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditProject(project)}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            <PencilLine className="h-4 w-4 text-amber-600" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleArchive(project)}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            {project.archivedAt ? (
                              <ArchiveRestore className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Archive className="h-4 w-4 text-slate-500" />
                            )}
                            {project.archivedAt ? 'Restaurar' : 'Archivar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteProject(project)}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-16 text-center">
                <FolderKanban className="h-14 w-14 text-slate-300" />
                <h3 className="mt-4 text-xl font-bold text-slate-900">Todavía no hay proyectos que mostrar</h3>
                <p className="mt-2 max-w-xl text-sm text-slate-500">
                  Cuando valides esquemas o importes una estructura SQL, aparecerán aquí con su progreso real, su última forma normal y el historial de validaciones.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('validator')}
                  className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25"
                >
                  <Plus className="h-4 w-4" />
                  Crear primer proyecto
                </button>
              </div>
            )}
          </div>

          {filtered.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
              <p>
                Mostrando {Math.min((currentPage - 1) * pageSize + 1, filtered.length)} a {Math.min(currentPage * pageSize, filtered.length)} de {filtered.length} proyectos
              </p>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition disabled:opacity-40"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {Array.from({ length: totalPages }).slice(0, 4).map((_, index) => {
                  const pageNumber = index + 1;
                  return (
                    <button
                      type="button"
                      key={pageNumber}
                      onClick={() => setPage(pageNumber)}
                      className={`inline-flex h-10 min-w-10 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition ${
                        pageNumber === currentPage
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition disabled:opacity-40"
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {composerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-blue-600">
                  {composerMode === 'sql' ? 'Importar SQL' : composerMode === 'manual' ? 'Crear desde cero' : 'Nuevo proyecto'}
                </p>
                <h2 className="text-2xl font-bold text-slate-900">
                  {composerMode === 'sql' ? 'Importa una estructura existente' : 'Crea un proyecto real y guardado en tu cuenta'}
                </h2>
                <p className="max-w-2xl text-sm text-slate-500">
                  {composerMode === 'sql'
                    ? 'Pega el DDL o SQL generado por tu base de datos. Lo procesamos, lo validamos y lo guardamos como un proyecto vivo.'
                    : 'Usa una plantilla o parte desde cero. Lo que guardes aquí se sincroniza con el backend y luego aparece en tus vistas.'}
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'template', label: 'Plantilla' },
                    { id: 'manual', label: 'Manual' },
                    { id: 'sql', label: 'SQL' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setComposerMode(tab.id as ComposerMode)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        composerMode === tab.id
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
                  aria-label="Cerrar compositor"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-5">
                {composerMode !== 'sql' && (
                  <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">Plantillas disponibles</h3>
                        <p className="text-sm text-slate-500">Selecciona una base y ajusta el contenido antes de guardar.</p>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                        <BookOpen className="h-3.5 w-3.5" />
                        {selectedTemplate.name}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {TEMPLATE_PRESETS.map((template) => {
                        const active = template.id === selectedTemplateId;
                        return (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => {
                              setSelectedTemplateId(template.id);
                              setComposerMode('template');
                            }}
                            className={`rounded-2xl border p-4 text-left transition ${
                              active ? 'border-blue-300 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-bold text-slate-900">{template.name}</div>
                                <div className="mt-1 text-xs text-slate-500">{template.description}</div>
                              </div>
                              <div className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                                {template.targetNf}
                              </div>
                            </div>
                            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                              <span>{template.attributes.length} atributos</span>
                              <span>{template.dependencies.length} dependencias</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {composerMode === 'sql' ? (
                  <div className="space-y-4">
                    <label className="block text-sm font-semibold text-slate-700">
                      SQL / DDL a importar
                      <textarea
                        value={composerSql}
                        onChange={(event) => setComposerSql(event.target.value)}
                        rows={18}
                        className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                        placeholder="CREATE TABLE ...;"
                      />
                    </label>

                    <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
                      <div className="font-semibold">Importación real</div>
                      <p className="mt-1 text-amber-800">
                        El SQL se parsea desde el backend, extrae columnas y dependencias si las encuentra, y luego genera un proyecto nuevo para tu sesión.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block text-sm font-semibold text-slate-700">
                        Nombre del proyecto
                        <input
                          value={composerName}
                          onChange={(event) => setComposerName(event.target.value)}
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                          placeholder="Sistema de Ventas"
                        />
                      </label>
                      <label className="block text-sm font-semibold text-slate-700">
                        Descripción
                        <input
                          value={composerDescription}
                          onChange={(event) => setComposerDescription(event.target.value)}
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                          placeholder="Base de datos para ventas, clientes y productos"
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block text-sm font-semibold text-slate-700">
                        Atributos
                        <textarea
                          value={composerAttributes}
                          onChange={(event) => setComposerAttributes(event.target.value)}
                          rows={10}
                          className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                          placeholder="idVenta, idProducto, idCliente..."
                        />
                      </label>
                      <label className="block text-sm font-semibold text-slate-700">
                        Dependencias funcionales
                        <textarea
                          value={composerDependencies}
                          onChange={(event) => setComposerDependencies(event.target.value)}
                          rows={10}
                          className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                          placeholder="idProducto -> precioUnitario"
                        />
                      </label>
                    </div>
                  </>
                )}
              </div>

              <aside className="space-y-4">
                <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Resumen</h3>
                      <p className="text-sm text-slate-500">Lo que se enviará al backend.</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-500">
                      {composerMode === 'sql' ? 'Importación' : selectedTemplate.targetNf}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm">
                    <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                      <span className="text-slate-500">Nombre</span>
                      <span className="font-semibold text-slate-900">{composerMode === 'sql' ? 'Desde SQL' : composerName || selectedTemplate.name}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                      <span className="text-slate-500">Atributos</span>
                      <span className="font-semibold text-slate-900">{composerMode === 'sql' ? 'Auto detectados' : splitAttributeInput(composerAttributes).length}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                      <span className="text-slate-500">Dependencias</span>
                      <span className="font-semibold text-slate-900">{composerMode === 'sql' ? 'Auto detectadas' : splitDependencyInput(composerDependencies).length}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                      <span className="text-slate-500">Modo</span>
                      <span className="font-semibold text-slate-900">
                        {composerMode === 'sql' ? 'SQL' : composerMode === 'manual' ? 'Manual' : 'Plantilla'}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-blue-200 bg-blue-50/70 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Guardado real</h4>
                      <p className="text-sm text-slate-500">Se recarga desde backend después de crear o importar.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-blue-500" />
                      <span>No se inventan datos: se usan los que eliges o importas.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span>El proyecto queda listo para validación, reportes y academia.</span>
                    </div>
                  </div>
                </section>
              </aside>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => openComposer(composerMode)}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Restablecer
                </button>
                <button
                  type="button"
                  onClick={() => void handleComposerSubmit()}
                  disabled={composerSubmitting}
                  className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {composerSubmitting
                    ? 'Guardando...'
                    : composerMode === 'sql'
                      ? 'Importar SQL'
                      : 'Crear proyecto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-blue-600">Editar proyecto</p>
                <h2 className="text-2xl font-bold text-slate-900">{editingProject.nombre}</h2>
                <p className="text-sm text-slate-500">Cambia el nombre o la descripción del proyecto sin perder su historial.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProject(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
                aria-label="Cerrar edición"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <label className="block text-sm font-semibold text-slate-700">
                Nombre del proyecto
                <input
                  value={editingName}
                  onChange={(event) => setEditingName(event.target.value)}
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Descripción
                <textarea
                  value={editingDescription}
                  onChange={(event) => setEditingDescription(event.target.value)}
                  rows={5}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  placeholder="Describe el objetivo del proyecto"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Estado</div>
                  <div className="mt-2 text-sm font-bold text-slate-900">{statusLabel(editingProject.status)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Última forma</div>
                  <div className="mt-2 text-sm font-bold text-slate-900">{nfLabel(editingProject.latestLevel)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Validaciones</div>
                  <div className="mt-2 text-sm font-bold text-slate-900">{editingProject.validationsCount}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => setEditingProject(null)}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveEditProject()}
                disabled={editingSaving}
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editingSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
