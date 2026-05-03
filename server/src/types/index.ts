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
  active: number;
  last_run?: string;
  next_run?: string;
  created_at: string;
}

export interface Video {
  id: string;
  kol_id: number;
  title: string;
  duration?: number;
  thumbnail?: string;
  published_at?: string;
  subtitles: SubtitleSegment[];
  created_at: string;
}

export interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
}

export interface Clip {
  id: number;
  video_id: string;
  kol_name: string;
  start_sec: number;
  end_sec: number;
  title: string;
  summary?: string;
  keywords: string[];
  topic_category?: string;
  thumbnail?: string;
  embedding_vector?: Buffer;
  created_at: string;
}

export interface Job {
  id: number;
  kol_id: number;
  video_id?: string;
  stage: 'crawl' | 'process' | 'clip' | 'index';
  status: 'pending' | 'running' | 'success' | 'failed';
  progress: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
}

export interface CreateKOLRequest {
  name?: string;
  channel_url: string;
  tags?: string[];
  fetch_policy?: {
    cron?: string;
    max_videos?: number;
  };
  active?: number;
}

export interface UpdateKOLRequest {
  name?: string;
  channel_url?: string;
  tags?: string[];
  fetch_policy?: {
    cron?: string;
    max_videos?: number;
  };
  active?: number;
}

export interface SearchRequest {
  query: string;
  limit?: number;
}

export interface SearchResponse {
  results: Array<{
    clip: Clip;
    relevance: number;
  }>;
}

export interface CombineRequest {
  clipIds: number[];
  outputFormat?: string;
  resolution?: string;
}

export interface LuckyComboRequest {
  prompt: string;
}
