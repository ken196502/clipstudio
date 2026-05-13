export interface KOL {
  id: number;
  name: string;
  channel_url: string;
  platform: string;
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

/**
 * Clip - 视频片段
 *
 * 【设计原则】
 * LLM只负责"切分视频+起标题"，返回 {title, start_sec, end_sec}
 * 程序按时间段从原始字幕中提取该片段的字幕，直接用于渲染
 * 不存储 summary/keywords/topic_category 等LLM生成的冗余字段
 */
export interface Clip {
  id: number;
  video_id: string;
  video_title?: string;
  kol_name: string;
  start_sec: number;
  end_sec: number;
  title: string;
  thumbnail?: string;
  vertical_cover?: string;
  subtitles?: SubtitleSegment[];
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
  fetch_policy?: {
    cron?: string;
    max_videos?: number;
  };
  active?: number;
}

export interface UpdateKOLRequest {
  name?: string;
  channel_url?: string;
  fetch_policy?: {
    cron?: string;
    max_videos?: number;
  };
  active?: number;
  last_run?: string | null;
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
  portrait?: boolean;
  textOverlays?: string[];
}


