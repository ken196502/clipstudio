import { create } from 'zustand';

const API_BASE = 'http://localhost:3001/api';

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
  addKOL: (kol: Omit<KOL, 'id' | 'created_at'>) => Promise<void>;
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
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
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
      const data = await fetchAPI<{ jobs: any[] }>('/jobs');
      const jobs: Job[] = data.jobs.map(job => {
        // Get KOL name from kol_id
        const kol = get().kols.find(k => k.id === job.kol_id);
        return {
          ...job,
          kolName: kol?.name || 'Unknown',
          videoTitle: job.video_id || 'Processing...',
          time: job.started_at ? new Date(job.started_at).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : undefined,
          duration: job.started_at && job.completed_at
            ? `${Math.floor((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000 / 60)}m ${Math.floor((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000 % 60)}s`
            : undefined,
        };
      });
      set({ jobs, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch jobs', isLoading: false });
    }
  },

  fetchClips: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await fetchAPI<{ clips: any[] }>('/clips');
      const clips: Clip[] = data.clips.map(clip => ({
        ...clip,
        videoTitle: clip.video_id || 'Unknown Video',
        createdAt: clip.created_at,
      }));
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
      const clips: Clip[] = data.results.map(r => ({
        ...r.clip,
        videoTitle: r.clip.video_id || 'Unknown Video',
        createdAt: r.clip.created_at,
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
      const clips: Clip[] = data.selectedClips.map(clip => ({
        ...clip,
        videoTitle: clip.video_id || 'Unknown Video',
        createdAt: clip.created_at,
      }));
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
