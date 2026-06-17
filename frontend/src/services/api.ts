import axios from 'axios';
import type { RelationSchema, ValidationResponse, MasteryConcept } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
export const QUEST_SESSION_STORAGE_KEY = 'dataquest:quest_session_seed';
let questSessionSeedFallback: string | null = null;

function createQuestSessionSeed(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getQuestSessionSeed(): string {
  try {
    const existing = sessionStorage.getItem(QUEST_SESSION_STORAGE_KEY);
    if (existing) return existing;

    const seed = createQuestSessionSeed();
    sessionStorage.setItem(QUEST_SESSION_STORAGE_KEY, seed);
    return seed;
  } catch {
    if (!questSessionSeedFallback) {
      questSessionSeedFallback = createQuestSessionSeed();
    }

    return questSessionSeedFallback;
  }
}

export function resetQuestSessionSeed(): void {
  try {
    sessionStorage.removeItem(QUEST_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage errors in restrictive browsers.
  }

  questSessionSeedFallback = null;
}

const axiosInstance = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
});

axiosInstance.interceptors.request.use((config) => {
  config.headers = config.headers ?? {};
  const token = localStorage.getItem('access_token');
  if (token) {
    (config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  (config.headers as Record<string, string>)['X-DataQuest-Session'] = getQuestSessionSeed();
  return config;
});

export const fetchCsrfCookie = async (): Promise<void> => {
  await axios.get('/sanctum/csrf-cookie', {
    baseURL: 'http://localhost:8000',
    withCredentials: true,
  });
};

export const validateSchema = async (schema: RelationSchema): Promise<ValidationResponse> => {
  const response = await axiosInstance.post('/validate-schema', schema);
  return response.data;
};

export const getUserMastery = async (userId: number): Promise<MasteryConcept[]> => {
  const response = await axiosInstance.get(`/analytics/mastery/${userId}`);
  return response.data;
};

export default axiosInstance;
