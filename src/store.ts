import { create } from 'zustand';

function normalizeApiOrigin(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';

  // Common misconfig: ":3000" (missing hostname). Treat as localhost.
  if (/^:\d+$/.test(s)) return `http://localhost${s}`;

  // Allow "localhost:3001" without scheme.
  if (/^[^/]+:\d+$/.test(s) && !/^https?:\/\//i.test(s)) return `http://${s}`;

  return s;
}

const RAW_API_ORIGIN = (import.meta as any).env?.VITE_API_ORIGIN as string | undefined;
const API_ORIGIN = normalizeApiOrigin(RAW_API_ORIGIN || '').replace(/\/+$/, ''); // trim trailing slashes
// VITE_API_ORIGIN may already include "/api" depending on deployment/proxy setup.
const API_BASE = API_ORIGIN ? (API_ORIGIN.endsWith('/api') ? API_ORIGIN : `${API_ORIGIN}/api`) : '/api';

export interface KOL {
  id: number;
  name: string;
  channel_url: string;
  platform: string;
  tags: string[];
  fetch_policy: {
    cron?: string;
    max_videos?: number;
  };
  active: number; // 0 or 1
  last_run?: string;
  nextRun?: string;
  created_at: string;
}

export interface CreateKOLPayload {
  name?: string;
  channel_url: string;
  platform?: string;
  tags?: string[];
  fetch_policy?: {
    cron?: string;
    max_videos?: number;
  };
  active?: number;
}

export interface Job {
  id: number;
  kol_id: number;
  video_id?: string;
  kolName: string;
  videoTitle: string;
  stage: 'crawl' | 'process' | 'clip' | 'index';
  status: 'running' | 'success' | 'failed' | 'pending';
  progress?: number;
  duration?: string;
  time?: string;
  started_at?: string;
  completed_at?: string;
}

export interface Clip {
  id: number;
  video_id: string;
  videoTitle: string;
  kolName: string;
  kolAvatar?: string;
  thumbnail: string;
  title: string;
  summary: string;
  keywords: string[];
  startSec: number;
  endSec: number;
  topicCategory: string;
  createdAt: string;
  relevance?: number;
}

export type PageType = 'kol' | 'task' | 'clip' | 'search' | 'combine';

interface AppState {
  kols: KOL[];
  jobs: Job[];
  clips: Clip[];
  theme: 'dark' | 'light';
  activePage: PageType;
  isLoading: boolean;
  error: string | null;
  setTheme: (theme: 'dark' | 'light') => void;
  setActivePage: (page: PageType) => void;
  fetchKOLs: () => Promise<void>;
  fetchJobs: () => Promise<void>;
  fetchClips: () => Promise<void>;
  addKOL: (kol: CreateKOLPayload) => Promise<void>;
  updateKOL: (id: number, kol: Partial<KOL>) => Promise<void>;
  triggerJob: (kolId: number) => Promise<void>;
  searchClips: (query: string) => Promise<Clip[]>;
  luckyCombo: (prompt: string) => Promise<Clip[]>;
}

// Helper function to fetch with error handling
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint})`, { API_BASE }, error);
    throw error;
  }
}

function parseKeywords(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((k): k is string => typeof k === 'string').map((k) => k.trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.filter((k): k is string => typeof k === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapApiClip(clip: Record<string, unknown>): Clip {
  const th = clip.thumbnail;
  const thumbnail =
    typeof th === 'string' && th.length > 0
      ? th.startsWith('http') || th.startsWith('/')
        ? th
        : `/${th}`
      : '';
  return {
    id: clip.id as number,
    video_id: clip.video_id as string,
    videoTitle: (clip.video_title as string) || (clip.videoTitle as string) || '未知视频',
    kolName: (clip.kol_name as string) || (clip.kolName as string) || '',
    thumbnail,
    title: (clip.title as string) || '',
    summary: (clip.summary as string) || '',
    keywords: parseKeywords(clip.keywords),
    startSec: Number(clip.start_sec ?? clip.startSec ?? 0),
    endSec: Number(clip.end_sec ?? clip.endSec ?? 0),
    topicCategory: (clip.topic_category as string) || (clip.topicCategory as string) || 'other',
    createdAt: (clip.created_at as string) || (clip.createdAt as string) || '',
    relevance: clip.relevance as number | undefined,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  activePage: 'search',
  theme: 'dark',
  kols: [],
  jobs: [],
  clips: [],
  isLoading: false,
  error: null,

  setActivePage: (page) => set({ activePage: page }),
  setTheme: (theme) => set({ theme }),

  fetchKOLs: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await fetchAPI<{ kols: any[] }>('/kols');
      const kols: KOL[] = data.kols.map(kol => ({
        ...kol,
        nextRun: kol.next_run,
      }));
      set({ kols, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch KOLs', isLoading: false });
    }
  },

  fetchJobs: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await fetchAPI<{ jobs: Job[] }>('/jobs');
      set({ jobs: data.jobs, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch jobs', isLoading: false });
    }
  },

  fetchClips: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await fetchAPI<{ clips: any[] }>('/clips');
      const clips: Clip[] = data.clips.map((c) => mapApiClip(c));
      set({ clips, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch clips', isLoading: false });
    }
  },

  addKOL: async (kol) => {
    set({ isLoading: true, error: null });
    try {
      await fetchAPI('/kols', {
        method: 'POST',
        body: JSON.stringify(kol),
      });
      await get().fetchKOLs();
    } catch (error) {
      set({ error: 'Failed to add KOL', isLoading: false });
      throw error;
    }
  },

  updateKOL: async (id, kol) => {
    set({ isLoading: true, error: null });
    try {
      await fetchAPI(`/kols/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(kol),
      });
      await get().fetchKOLs();
    } catch (error) {
      set({ error: 'Failed to update KOL', isLoading: false });
      throw error;
    }
  },

  triggerJob: async (kolId) => {
    set({ isLoading: true, error: null });
    try {
      await fetchAPI(`/kols/${kolId}/trigger`, {
        method: 'POST',
      });
      await get().fetchJobs();
    } catch (error) {
      set({ error: 'Failed to trigger job', isLoading: false });
      throw error;
    }
  },

  searchClips: async (query) => {
    set({ isLoading: true, error: null });
    try {
      const data = await fetchAPI<{ results: Array<{ clip: any; relevance: number }> }>('/clips/search', {
        method: 'POST',
        body: JSON.stringify({ query }),
      });
      const clips: Clip[] = data.results.map((r) => ({
        ...mapApiClip(r.clip),
        relevance: r.relevance,
      }));
      set({ isLoading: false });
      return clips;
    } catch (error) {
      set({ error: 'Failed to search clips', isLoading: false });
      throw error;
    }
  },

  luckyCombo: async (prompt) => {
    set({ isLoading: true, error: null });
    try {
      const data = await fetchAPI<{ selectedClips: any[]; reasoning: string }>('/lucky-combo', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      });
      const clips: Clip[] = data.selectedClips.map((c) => mapApiClip(c));
      set({ isLoading: false });
      return clips;
    } catch (error) {
      set({ error: 'Failed to select clips', isLoading: false });
      throw error;
    }
  },
}));

// Initialize data on mount
if (typeof window !== 'undefined') {
  useAppStore.getState().fetchKOLs();
  useAppStore.getState().fetchJobs();
  useAppStore.getState().fetchClips();
}
