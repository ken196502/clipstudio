# 06 — 后端设计

## 系统架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  Search → KOL Manager → Task Monitor → Clip Library   │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API
┌────────────────────────────▼────────────────────────────────────┐
│                      Backend (Express.js)                        │
│  ┌──────────────┐                    ┌──────────────┐          │
│  │  API Routes  │                    │  LLM Service │          │
│  └──────┬───────┘                    └──────┬───────┘          │
│         │                                   │                  │
│         ▼                                   ▼                  │
│  ┌──────────────────────────────────────────────────┐           │
│  │              Database (SQLite)                   │           │
│  │  Tables: kols, videos, clips, jobs               │           │
│  └──────────────────────────────────────────────────┘           │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      External Services                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   YouTube    │  │   OpenAI     │  │   FFmpeg     │          │
│  │   Data API   │  │   API        │  │   (视频处理)  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 核心流程详解

### 1. 视频抓取与处理流水线

```
用户添加 KOL 频道（如 youtube.com/@liziran）
       ↓
手动触发 or Cron 定时任务
       ↓
[crawl] 抓取频道最新视频列表 + 提取字幕
       ↓
[process] 验证字幕可解析
       ↓
[clip] LLM 根据完整字幕切分片段（title + start_sec + end_sec）
       ↓
[index] 保存到数据库 + 生成向量索引
       ↓
完成：片段可搜索
```

#### Stage 1: crawl（抓取）

**输入：** KOL 的频道 URL（如 `youtube.com/@liziran`）+ 抓取策略（`fetch_policy`）

**处理步骤：**
1. 使用 **yt-dlp**（通过 Python venv 调用）获取频道的最新视频列表（`--flat-playlist --dump-json`）
2. 根据 `fetch_policy.max_videos` 限制抓取数量（默认 20 个）
3. 对每个视频：
   - 获取元数据：标题、时长、缩略图、发布日期
   - 提取字幕：优先提取手动上传的英文字幕，若无则提取自动生成的字幕（`--write-sub --write-auto-sub --sub-lang en`）
   - 解析 VTT 格式字幕，清理 HTML 标签和内联时间戳
4. 过滤已处理过的视频（检查数据库 `videos` 表）

**输出：**
```json
{
  "videos": [
    {
      "videoId": "VIDEO_ID_1",
      "title": "AI的未来",
      "duration": 1234,
      "thumbnail": "...",
      "publishedAt": "2024-05-20T10:00:00Z",
      "subtitles": [
        { "start": 0.0, "end": 3.5, "text": "Hello everyone" }
      ]
    }
  ]
}
```

**依赖库：**
- **yt-dlp**（Python venv 安装）— 视频下载与元数据提取
- **FFmpeg** — 视频切片与合成的核心引擎

---

#### Stage 3: clip（LLM 切分）

**输入：** 完整视频字幕（带时间戳的 JSON 数组）

**LLM 调用：** 使用 OpenAI 兼容 API

**核心职责：**
LLM 只负责一件事：把完整字幕切成若干个有独立主题的片段，每个片段返回 `title` + `start_sec` + `end_sec`。

**错误处理（严格模式）：**
- LLM API 调用失败（如 503、网络问题）→ **直接报错，任务失败**
- LLM 返回空 clips 或无效数据 → **直接报错，任务失败**
- 标题质量不合格（空洞、过短、纯时间戳格式）→ **直接报错，任务失败**
- 时间段超出视频范围 → **直接报错，任务失败**

**不存在 Fallback 机制。** 系统坚持"宁缺毋滥"原则：LLM 失败时不生成低质量片段，而是让任务失败，等待人工排查或重试。

---

## 视频处理逻辑

### 1. 视频下载 (Downloader)
使用 `yt-dlp` 下载最佳质量的视频流。下载后的文件存储在 `storage/clips/{videoId}.mp4`。

### 2. 片段切分 (FFmpeg)
根据数据库中记录的 `start_sec` 和 `end_sec`，使用 FFmpeg 进行精确切分。
- 策略：使用 `reencode`（重编码）以确保片段的时间戳和关键帧对齐。

### 3. 垂直视频渲染
使用 **Puppeteer** 截图 HTML/CSS 模板生成标题和字幕覆盖层 PNG，再用 **FFmpeg** `filter_complex` 合成到视频上。
- 支持 9:16 竖屏格式（1080×1920）
- 背景为模糊视频填充，中间为原视频
- 顶部显示标题覆盖层，底部显示逐句字幕
- 支持批量预渲染（调度器后台自动渲染）
- 输出文件：`storage/vertical-videos/clip-{id}-vertical.mp4`

---

#### Stage 4: index（入库）

**输入：** LLM 生成的 Clip 对象

**处理步骤：**
1. 保存到数据库 `clips` 表
2. 生成语义向量（可选，用于高级搜索）
   - 使用 OpenAI Embeddings API：`text-embedding-3-small`
   - 将 `title + summary + keywords` 拼接后生成 1536 维向量
3. 更新 Job 状态为 `success`

**数据库写入：**
```sql
INSERT INTO clips (
  video_id, kol_name, start_sec, end_sec, 
  title, summary, keywords, topic_category, 
  thumbnail, created_at, embedding_vector
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
```

---

## 数据库设计

### 表结构

#### kols 表
```sql
CREATE TABLE kols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  channel_url TEXT NOT NULL,
  platform TEXT DEFAULT 'youtube',
  fetch_policy TEXT,  -- JSON 对象字符串: { "cron": "0 3 * * *", "max_videos": 20 }
  active INTEGER DEFAULT 1,
  last_run DATETIME,  -- 最后一次执行时间
  next_run TEXT,  -- 下次执行时间（展示用）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### videos 表
```sql
CREATE TABLE videos (
  id TEXT PRIMARY KEY,  -- YouTube video ID
  kol_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  duration INTEGER,
  thumbnail TEXT,
  published_at DATETIME,
  subtitles TEXT,  -- JSON 数组字符串
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (kol_id) REFERENCES kols(id)
);
```

#### clips 表
```sql
CREATE TABLE clips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  kol_name TEXT NOT NULL,
  start_sec INTEGER NOT NULL,
  end_sec INTEGER NOT NULL,
  title TEXT NOT NULL,
  thumbnail TEXT,
  vertical_cover TEXT,
  subtitles TEXT,  -- JSON 数组字符串 [{start,end,text},...] 用于渲染
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (video_id) REFERENCES videos(id)
);
```

#### jobs 表
```sql
CREATE TABLE jobs (
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
```

---

## API 接口设计

### KOL 管理

#### GET /api/kols
获取所有 KOL 列表

**Response:**
```json
{
  "kols": [
    {
      "id": 1,
      "name": "李自然",
      "channel_url": "youtube.com/@liziran",
      "platform": "youtube",
      "fetch_policy": { "cron": "0 3 * * *" },
      "active": 1,
      "nextRun": "今日 03:00"
    }
  ]
}
```

#### POST /api/kols
添加新 KOL

**Request:**
```json
{
  "name": "新 KOL",
  "channel_url": "youtube.com/@example",
  "fetch_policy": { "cron": "0 4 * * *", "max_videos": 10 }
}
```

#### PATCH /api/kols/:id
更新 KOL 配置

#### POST /api/kols/:id/trigger
手动触发抓取任务

**说明：** 抓取该 KOL 频道的最新视频（根据 `fetch_policy.max_videos` 限制数量）

**Response:**
```json
{
  "jobId": 123,
  "status": "pending",
  "message": "开始抓取频道最新视频"
}
```

---

### 任务管理

#### GET /api/jobs?status=running
获取任务列表（支持状态过滤）

**Response:**
```json
{
  "jobs": [
    {
      "id": 101,
      "kolName": "李自然",
      "videoTitle": "AI的未来",
      "stage": "clip",
      "status": "running",
      "progress": 62,
      "startedAt": "2024-05-20T03:12:00Z"
    }
  ]
}
```

#### POST /api/jobs/:id/retry
重试失败的任务

---

### 片段管理

#### GET /api/clips
获取片段列表

**Query Params:**
- `kolName`: 按 KOL 筛选
- `category`: 按分类筛选
- `sort`: 排序方式（newest/oldest）
- `limit`: 每页数量
- `offset`: 分页偏移

**Response:**
```json
{
  "clips": [...],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

#### POST /api/clips/search
语义搜索

**Request:**
```json
{
  "query": "AI 如何改变职业",
  "limit": 10
}
```

**Response:**
```json
{
  "results": [
    {
      "clip": { /* Clip 对象 */ },
      "relevance": 82  // 相关度评分
    }
  ]
}
```

**搜索实现方式：**

**方案 1：关键词匹配（简单）**
```sql
SELECT *, 
  (CASE 
    WHEN title LIKE '%AI%' THEN 30
    WHEN summary LIKE '%AI%' THEN 20
    WHEN keywords LIKE '%AI%' THEN 10
    ELSE 0
  END) as relevance
FROM clips
WHERE relevance > 0
ORDER BY relevance DESC;
```

**方案 2：向量相似度（高级）**
1. 用 OpenAI Embeddings API 将查询词转为向量
2. 计算与所有 clip 的余弦相似度
3. 返回 Top-K 结果

```ts
// 生成查询向量
const queryEmbedding = await getEmbedding(query);

// 计算相似度（需要向量数据库或内存计算）
const results = clips.map(clip => ({
  clip,
  relevance: cosineSimilarity(queryEmbedding, clip.embeddingVector)
})).sort((a, b) => b.relevance - a.relevance);
```

---

### 垂直视频渲染

#### POST /api/clips/vertical-render
提交竖屏渲染任务

**Request:**
```json
{
  "clipId": 1
}
```

**Response:**
```json
{
  "jobId": 1,
  "status": "pending"
}
```

#### GET /api/clips/vertical-render/:jobId
查询渲染进度

**Response:**
```json
{
  "jobId": 1,
  "clipId": 1,
  "status": "completed",
  "progress": 100,
  "outputPath": "/api/vertical-covers/clip-1-vertical.mp4"
}
```

#### GET /api/clips/vertical-download/:filename
下载渲染后的竖屏视频

---

## 垂直视频渲染实现

使用 **Puppeteer** 截图 + **FFmpeg** `filter_complex` 合成：

**核心渲染流程（`server/src/services/vertical-renderer.ts`）：**
```ts
async function renderVerticalVideo(clip: ClipData): Promise<string> {
  // 1. 下载视频片段（yt-dlp --download-sections）
  const segmentPath = await downloadSegment(clip.video_id, clip.start_sec, clip.end_sec);

  // 2. 用 Puppeteer 渲染标题 PNG 覆盖层
  const titlePng = await renderTitleOverlay(clip.id, clip.title);

  // 3. 用 Puppeteer 逐句渲染字幕 PNG 覆盖层
  const subtitleOverlays = await renderSubtitleOverlays(clip.id, preparedSubs);

  // 4. FFmpeg filter_complex 合成：
  //    - 背景：视频放大+模糊，撑满 1080×1920
  //    - 中间：原视频保持比例居中
  //    - 顶部：标题覆盖层
  //    - 底部：字幕覆盖层（按时间 enable）
  const filterComplex = buildFilterComplex(...);
  await runFFmpeg(ffmpegArgs);

  // 5. 更新数据库 vertical_cover 字段
  db.prepare('UPDATE clips SET vertical_cover = ? WHERE id = ?');
}
```

**合成页面（`Combine`）视频拼接：**
```ts
import { combineClips } from './services/ffmpeg';

async function combineClips(options: CombineClipsOptions): Promise<string> {
  // Portrait 模式：每个片段单独处理 filter_complex（模糊背景+文字覆盖），再 concat
  // Landscape 模式：直接用 concat demuxer 拼接
}
```

---

## 环境变量配置

更新 `.env.example`：

```bash
# OpenAI API 配置
OPENAI_BASE_URL="https://api.openai.com/v1"
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4o-mini"

# 数据库
DATABASE_URL="./data/engine_vec.db"

# 服务器
PORT=3001
NODE_ENV="development"

# 文件存储
STORAGE_PATH="./storage"
MAX_VIDEO_SIZE_MB=500
```

---

## 定时任务设计

### Cron 调度器

使用 **node-cron** 实现定时抓取（`server/src/services/scheduler.ts`）：

```ts
import cron from 'node-cron';
import cronParser from 'cron-parser';
import { db } from '../db/init';
import { processJob } from './job-processor';

let schedulerTask: cron.ScheduledTask | null = null;

function cronPrevMsBeforeNow(cronExpression: string, nowMs: number): number | null {
  try {
    const interval = cronParser.parseExpression(cronExpression, {
      currentDate: new Date(nowMs),
    });
    return interval.prev().getTime();
  } catch (error) {
    console.error(`Invalid cron expression: ${cronExpression}`, error);
    return null;
  }
}

function kolEffectiveLastRunMs(kol: { last_run: string | null; created_at: string }): number {
  if (kol.last_run) {
    const t = Date.parse(kol.last_run);
    if (!Number.isNaN(t)) return t;
  }
  const created = Date.parse(kol.created_at);
  return Number.isNaN(created) ? 0 : created;
}

async function checkAndTriggerJobs(): Promise<void> {
  const kols = db.prepare('SELECT * FROM kols WHERE active = 1').all() as any[];

  for (const kol of kols) {
    const fetchPolicy = kol.fetch_policy ? JSON.parse(kol.fetch_policy) : {};
    const cronExpression = fetchPolicy.cron;
    if (!cronExpression) continue;

    const nowMs = Date.now();
    const effectiveLastTs = kolEffectiveLastRunMs({
      last_run: kol.last_run ?? null,
      created_at: kol.created_at ?? '',
    });

    const slotTs = cronPrevMsBeforeNow(cronExpression, nowMs);
    if (slotTs !== null && slotTs > effectiveLastTs && slotTs <= nowMs) {
      // 检查是否已有活跃任务
      const activeJob = db.prepare(`
        SELECT id FROM jobs WHERE kol_id = ? AND status IN ('running', 'pending')
        ORDER BY id DESC LIMIT 1
      `).get(kol.id);
      if (activeJob) continue;

      // 创建任务并后台处理
      const result = db.prepare(`
        INSERT INTO jobs (kol_id, status, stage, progress, started_at)
        VALUES (?, 'running', 'crawl', 0, ?)
      `).run(kol.id, new Date().toISOString());

      processJob(result.lastInsertRowid as number).catch(console.error);

      // 标记该 cron slot 已执行（防止重复触发）
      db.prepare('UPDATE kols SET last_run = ? WHERE id = ?')
        .run(new Date(slotTs).toISOString(), kol.id);
    }
  }
}

export function startScheduler(): void {
  schedulerTask = cron.schedule('* * * * *', async () => {
    await checkAndTriggerJobs();
    // 同时后台预渲染未处理的竖屏视频
    preRenderVerticalVideos().catch(console.error);
  });
}
```

**关键设计：**
- 使用 `cron-parser` 的 `prev()` 获取上次应执行的时间点（slot）
- 比较 slot 与 `last_run`：slot > last_run 表示该 slot 尚未执行
- 更新 `last_run` 为 slot 时间戳（而非当前时间），确保同一 slot 不会重复触发
- 同时后台预渲染缺失的竖屏视频

### 数据库表

`kols` 表已包含 `last_run` 字段（见 schema.sql）：

```sql
CREATE TABLE IF NOT EXISTS kols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  channel_url TEXT NOT NULL,
  platform TEXT DEFAULT 'youtube',
  fetch_policy TEXT,
  active INTEGER DEFAULT 1,
  last_run DATETIME,   -- 已存在
  next_run TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 任务队列处理器

```ts
// 处理定时抓取任务
videoQueue.process('crawl-channel', async (job) => {
  const { kolId, channelUrl, maxVideos } = job.data;
  
  try {
    // 获取 KOL 信息
    const kol = await db.query('SELECT * FROM kols WHERE id = ?', [kolId]);
    
    // Stage 1: crawl - 抓取频道视频
    job.progress(10);
    const { videos } = await crawlChannel(channelUrl, maxVideos);
    
    console.log(`Found ${videos.length} videos for ${kol.name}`);
    
    // 为每个视频创建子任务
    for (const video of videos) {
      // 检查是否已处理过
      const existing = await db.query(
        'SELECT id FROM videos WHERE id = ?',
        [video.videoId]
      );
      
      if (existing.length > 0) {
        console.log(`Video ${video.videoId} already processed, skipping`);
        continue;
      }
      
      // 创建新的处理任务
      await videoQueue.add('process-video', {
        kolId,
        kolName: kol.name,
        video
      });
    }
    
    job.progress(100);
    return { success: true, videosFound: videos.length };
  } catch (error) {
    console.error(`Failed to crawl channel for KOL ${kolId}:`, error);
    throw error;
  }
});

// 处理单个视频
videoQueue.process('process-video', async (job) => {
  const { kolId, kolName, video } = job.data;
  
  // 创建 Job 记录
  const jobRecord = await db.query(
    'INSERT INTO jobs (kol_id, video_id, stage, status, started_at) VALUES (?, ?, ?, ?, ?)',
    [kolId, video.videoId, 'process', 'running', new Date().toISOString()]
  );
  const jobId = jobRecord.lastID;
  
  try {
    // Stage 2: process - 分段
    await updateJobStage(jobId, 'process', 20);
    const segments = await processSubtitles(video.subtitles);
    
    // Stage 3: clip - LLM 分析
    await updateJobStage(jobId, 'clip', 50);
    const clips = await analyzeSegments(segments, video.title, kolName);
    
    // Stage 4: index - 入库
    await updateJobStage(jobId, 'index', 80);
    await saveClips(clips, video.videoId, kolName);
    
    // 完成
    await db.query(
      'UPDATE jobs SET status = ?, progress = ?, completed_at = ? WHERE id = ?',
      ['success', 100, new Date().toISOString(), jobId]
    );
    
    job.progress(100);
    return { success: true, clipsCount: clips.length };
  } catch (error) {
    await db.query(
      'UPDATE jobs SET status = ?, error_message = ? WHERE id = ?',
      ['failed', error.message, jobId]
    );
    throw error;
  }
});

async function updateJobStage(jobId: number, stage: string, progress: number) {
  await db.query(
    'UPDATE jobs SET stage = ?, progress = ? WHERE id = ?',
    [stage, progress, jobId]
  );
}
```

### 环境变量配置

```bash
# 定时任务配置
ENABLE_SCHEDULER=true  # 是否启用定时任务
SCHEDULER_CHECK_INTERVAL="* * * * *"  # 检查间隔（默认每分钟）
```

### 启动服务器时初始化

```ts
// server/index.ts
import express from 'express';
import { startScheduler } from './scheduler';

const app = express();

// ... 其他中间件和路由

// 启动定时任务调度器
if (process.env.ENABLE_SCHEDULER === 'true') {
  startScheduler();
}

app.listen(3001, () => {
  console.log('Server running on port 3001');
});
```

### Cron 表达式示例

| 表达式 | 说明 |
|--------|------|
| `0 3 * * *` | 每天凌晨 3:00 |
| `0 */6 * * *` | 每 6 小时一次 |
| `0 0 * * 0` | 每周日午夜 |
| `0 9,18 * * *` | 每天 9:00 和 18:00 |
| `*/30 * * * *` | 每 30 分钟 |

---

## 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                    本地桌面应用 (Tauri)                      │
│                  React Frontend + Express Backend            │
└─────────────────────────────────────────────────────────────┘
                              │
    ┌─────────────────────────┼─────────────────────────┐
    ▼                         ▼                         ▼
┌────────┐              ┌──────────┐              ┌──────────┐
│ SQLite │              │ 本地文件 │              │ 外部 API  │
│ (数据库)│              │ (视频存储)│              │ (OpenAI)  │
└────────┘              └──────────┘              └──────────┘
```

**本地部署特点：**
- 数据存储：SQLite 数据库（本地文件）
- 视频存储：本地文件系统（用户文档目录）
- API 调用：直接调用 OpenAI API（用户配置密钥）
- 无需云服务：完全本地运行，数据隐私保护
