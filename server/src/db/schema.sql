-- KOLs table
CREATE TABLE IF NOT EXISTS kols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  channel_url TEXT NOT NULL,
  platform TEXT DEFAULT 'youtube',
  tags TEXT,  -- JSON array string
  fetch_policy TEXT,  -- JSON object string: { "cron": "0 3 * * *", "max_videos": 20 }
  active INTEGER DEFAULT 1,
  last_run DATETIME,
  next_run TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,  -- YouTube video ID
  kol_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  duration INTEGER,
  thumbnail TEXT,
  published_at DATETIME,
  subtitles TEXT,  -- JSON array string
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (kol_id) REFERENCES kols(id)
);

-- Clips table
CREATE TABLE IF NOT EXISTS clips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  kol_name TEXT NOT NULL,
  start_sec INTEGER NOT NULL,
  end_sec INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  keywords TEXT,  -- JSON array string
  topic_category TEXT,
  thumbnail TEXT,
  embedding_vector BLOB,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (video_id) REFERENCES videos(id)
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kol_id INTEGER NOT NULL,
  video_id TEXT,
  stage TEXT NOT NULL,  -- crawl, process, clip, index
  status TEXT NOT NULL,  -- pending, running, success, failed
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  started_at DATETIME,
  completed_at DATETIME,
  FOREIGN KEY (kol_id) REFERENCES kols(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_clips_kol_name ON clips(kol_name);
CREATE INDEX IF NOT EXISTS idx_clips_topic_category ON clips(topic_category);
CREATE INDEX IF NOT EXISTS idx_clips_created_at ON clips(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_kol_id ON jobs(kol_id);
