import { create } from 'zustand';

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
  nextRun?: string;
}

export interface Job {
  id: number;
  kolName: string;
  videoTitle: string;
  stage: 'crawl' | 'process' | 'clip' | 'index';
  status: 'running' | 'success' | 'failed' | 'pending';
  progress?: number;
  duration?: string;
  time?: string;
}

export interface Clip {
  id: number;
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
  setTheme: (theme: 'dark' | 'light') => void;
  setActivePage: (page: PageType) => void;
  addKOL: (kol: Omit<KOL, 'id'>) => void;
  updateKOL: (id: number, kol: Partial<KOL>) => void;
  triggerJob: (kolId: number) => void;
}

const DUMMY_KOLS: KOL[] = [
  {
    id: 1,
    name: '李自然',
    channel_url: 'youtube.com/@liziran',
    platform: 'youtube',
    tags: ['AI', '科技', '评测'],
    fetch_policy: { cron: '0 3 * * *', max_videos: 20 },
    active: 1,
    nextRun: '今日 03:00'
  },
  {
    id: 2,
    name: '硅谷徐',
    channel_url: 'youtube.com/@guiguxu',
    platform: 'youtube',
    tags: ['创业', '硅谷', '大模型'],
    fetch_policy: { cron: '0 4 * * *', max_videos: 10 },
    active: 1,
    nextRun: '明日 03:00'
  },
  {
    id: 3,
    name: 'TESTV',
    channel_url: 'youtube.com/@testv',
    platform: 'youtube',
    tags: ['数码', '开箱'],
    fetch_policy: {},
    active: 0,
  }
];

const DUMMY_JOBS: Job[] = [
  { id: 101, kolName: '李自然', videoTitle: 'AI的未来', stage: 'clip', status: 'running', progress: 62 },
  { id: 102, kolName: '李自然', videoTitle: 'AI的未来', stage: 'index', status: 'success', duration: '4m 32s', time: '03:12' },
  { id: 103, kolName: '李自然', videoTitle: 'AI的未来', stage: 'clip', status: 'success', duration: '1m 18s', time: '03:08' },
  { id: 104, kolName: '李自然', videoTitle: 'AI的未来', stage: 'process', status: 'success', duration: '2m 44s', time: '03:05' },
  { id: 105, kolName: '硅谷徐', videoTitle: 'GPT评测', stage: 'crawl', status: 'failed', duration: '0m 12s', time: '02:58' },
];

const DUMMY_CLIPS: Clip[] = [
  { 
    id: 1, 
    videoTitle: '2025年AI预测', 
    kolName: '李自然', 
    thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=600&h=400',
    title: 'AI 取代哪些职业', 
    summary: '探讨了 AI 在未来5年内最可能替代的职业类型，包括数据标注、基础文案等，同时指出创意类工作短期仍有优势。',
    keywords: ['AI', '职业替代', '未来'],
    startSec: 192,
    endSec: 300,
    topicCategory: '观点',
    createdAt: '2024-05-20',
    relevance: 82
  },
  { 
    id: 2, 
    videoTitle: '深入解析 GPT-5', 
    kolName: '硅谷徐', 
    thumbnail: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=600&h=400',
    title: 'GPT-5 核心突破点', 
    summary: '从技术和商业化角度深度剖析了 GPT-5 可能带来的改变，特别是其在多模态理解和长上下文方面的跃升。',
    keywords: ['GPT', '大模型', '技术'],
    startSec: 344,
    endSec: 420,
    topicCategory: '分析',
    createdAt: '2024-05-19',
    relevance: 71
  },
  { 
    id: 3, 
    videoTitle: '自媒体实战分享', 
    kolName: '李自然', 
    thumbnail: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&q=80&w=600&h=400',
    title: '如何做播客选题', 
    summary: '分享了自己做播客的选题思路，如何抓住热点同时保持长期内容价值，以及一套行之有效的爆款选题模板。',
    keywords: ['播客', '内容', '运营'],
    startSec: 483,
    endSec: 612,
    topicCategory: '教程',
    createdAt: '2024-05-18'
  },
];

export const useAppStore = create<AppState>((set) => ({
  activePage: 'search',
  setActivePage: (page) => set({ activePage: page }),
  kols: DUMMY_KOLS,
  jobs: DUMMY_JOBS,
  clips: DUMMY_CLIPS,
  theme: 'dark',
  setTheme: (theme) => set({ theme }),
  addKOL: (kol) => set((state) => ({ kols: [...state.kols, { ...kol, id: Date.now() }] })),
  updateKOL: (id, kol) => set((state) => ({
    kols: state.kols.map(k => k.id === id ? { ...k, ...kol } : k)
  })),
  triggerJob: (kolId) => set((state) => {
    const kol = state.kols.find(k => k.id === kolId);
    if (!kol) return state;
    const newJob: Job = {
      id: Date.now(),
      kolName: kol.name,
      videoTitle: '调度任务...',
      stage: 'crawl',
      status: 'running',
      progress: 0,
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute:'2-digit' })
    };
    return { jobs: [newJob, ...state.jobs] };
  })
}));
