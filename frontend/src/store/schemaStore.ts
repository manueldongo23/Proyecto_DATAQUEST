// schemaStore.ts
import { create } from 'zustand';
import { RelationSchema } from '../types';

interface SchemaStore {
  currentSchema: RelationSchema | null;
  currentSchemaName: string | null;
  currentSchemaId: number | null;
  setCurrentSchema: (schema: RelationSchema, meta?: { name?: string; id?: number }) => void;
  selectSchemaTarget: (meta: { id: number; name?: string | null }) => void;
  clearSchema: () => void;
}

function readStoredSchema(): {
  schema: RelationSchema | null;
  name: string | null;
  id: number | null;
} {
  try {
    const raw = localStorage.getItem('dataquest:last_schema');
    if (!raw) return { schema: null, name: null, id: null };
    const parsed = JSON.parse(raw) as { schema?: RelationSchema; name?: string; id?: number };
    return {
      schema: parsed.schema ?? null,
      name: parsed.name ?? null,
      id: typeof parsed.id === 'number' ? parsed.id : null,
    };
  } catch {
    return { schema: null, name: null, id: null };
  }
}

const storedSchema = readStoredSchema();

export const useSchemaStore = create<SchemaStore>((set) => ({
  currentSchema: storedSchema.schema,
  currentSchemaName: storedSchema.name,
  currentSchemaId: storedSchema.id,
  setCurrentSchema: (schema, meta) => {
    const next = {
      schema,
      name: meta?.name ?? schema.table_name,
      id: typeof meta?.id === 'number' ? meta.id : null,
    };

    localStorage.setItem('dataquest:last_schema', JSON.stringify(next));

    set({
      currentSchema: schema,
      currentSchemaName: next.name,
      currentSchemaId: next.id,
    });
  },
  selectSchemaTarget: (meta) => {
    const next = {
      schema: null,
      name: meta.name ?? null,
      id: meta.id,
    };

    localStorage.setItem('dataquest:last_schema', JSON.stringify(next));

    set({
      currentSchema: null,
      currentSchemaName: next.name,
      currentSchemaId: next.id,
    });
  },
  clearSchema: () => {
    localStorage.removeItem('dataquest:last_schema');
    set({ currentSchema: null, currentSchemaName: null, currentSchemaId: null });
  }
}));
