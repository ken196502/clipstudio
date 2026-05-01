# 06 — 后端设计（待实现）

## 系统架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  Search → KOL Manager → Task Monitor → Clip Library → Combine   │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API
┌────────────────────────────▼────────────────────────────────────┐
│                      Backend (Express.js)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  API Routes  │  │  Job Queue   │  │  LLM Service │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
│         ▼                  ▼                  ▼                  │
│  ┌──────────────────────────────────────────────────┐           │
│  │              Database (SQLite / PostgreSQL)       │           │
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
[process] 字幕分段 + 时间戳对齐
       ↓
[clip] LLM 分析生成片段（每个视频生成多个 clips）
       ↓
[index] 保存到数据库 + 生成向量索引
       ↓
完成：片段可搜索
```

#### Stage 1: crawl（抓取）

**输入：** KOL 的频道 URL（如 `youtube.com/@liziran`）+ 抓取策略（`fetch_policy`）

**处理步骤：**
1. 使用 **YouTube.js** (`youtubei.js`) 获取频道的最新视频列表
2. 根据 `fetch_policy.max_videos` 限制抓取数量（如最多 20 个）
3. 对每个视频：
   - 获取视频元数据：标题、时长、缩略图、发布日期
   - 提取自动英文字幕（带时间戳）
4. 过滤已处理过的视频（检查数据库中是否存在）

**输出：**
```json
{
  "videos": [
    {
      "videoId": "VIDEO_ID_1",
      "title": "AI的未来",
      "duration": 1234,
      "thumbnail": "https://i.ytimg.com/vi/VIDEO_ID_1/maxresdefault.jpg",
      "publishedAt": "2024-05-20T10:00:00Z",
      "subtitles": [
        { "start": 0.0, "end": 3.5, "text": "Hello everyone" },
        { "start": 3.5, "end": 7.2, "text": "Today we'll talk about AI" }
      ]
    }
  ]
}
```

**依赖库：**
- **推荐：** `youtubei.js` — YouTube 官方 InnerTube API 的 JavaScript 客户端
  - 支持 Node.js、Deno、浏览器
  - 无需 API Key，直接访问 YouTube 私有 API
  - 可获取频道视频列表、视频信息、字幕、评论等
  - GitHub: https://github.com/LuanRT/YouTube.js
  - 文档: https://ytjs.dev

**实现示例：**
```ts
import { Innertube } from 'youtubei.js';

async function crawlChannel(channelUrl: string, maxVideos: number = 20) {
  // 初始化 YouTube.js 客户端
  const youtube = await Innertube.create();
  
  // 提取频道 ID 或 handle（如 @liziran）
  const channelHandle = extractChannelHandle(channelUrl); // "@liziran"
  
  // 获取频道信息
  const channel = await youtube.getChannel(channelHandle);
  
  // 获取频道的视频列表（按上传时间排序）
  const videos = await channel.getVideos();
  
  // 限制数量并提取前 N 个视频
  const videoList = videos.videos.slice(0, maxVideos);
  
  // 对每个视频提取详细信息和字幕
  const results = [];
  for (const video of videoList) {
    try {
      const info = await youtube.getInfo(video.id);
      
      // 获取字幕
      const transcriptData = await info.getTranscript();
      const subtitles = transcriptData?.transcript?.content?.body?.initial_segments.map(segment => ({
        start: segment.start_ms / 1000,
        end: segment.end_ms / 1000,
        text: segment.snippet.text
      })) || [];
      
      // 跳过无字幕的视频
      if (subtitles.length === 0) {
        console.log(`Skipping ${video.id}: No subtitles available`);
        continue;
      }
      
      results.push({
        videoId: video.id,
        title: info.basic_info.title,
        duration: info.basic_info.duration,
        thumbnail: info.basic_info.thumbnail?.[0]?.url,
        publishedAt: info.basic_info.publish_date,
        subtitles
      });
    } catch (error) {
      console.error(`Failed to process video ${video.id}:`, error);
    }
  }
  
  return { videos: results };
}
```

---

#### Stage 2: process（分段）

**输入：** 字幕数组 + 视频元数据

**处理步骤：**
1. 将字幕按语义边界分段（每 30-60 秒一段，或按句子完整性）
2. 合并过短的片段（< 15 秒）
3. 为每段生成时间戳范围

**输出：**
```json
{
  "segments": [
    {
      "startSec": 0,
      "endSec": 45,
      "text": "Hello everyone. Today we'll talk about AI and its impact..."
    },
    {
      "startSec": 45,
      "endSec": 92,
      "text": "The key challenge is understanding how models learn..."
    }
  ]
}
```

**分段策略：**
- 优先在句号、问号、感叹号处断句
- 避免在句子中间切分
- 目标长度：30-90 秒

---

#### Stage 3: clip（AI 分析）

**输入：** 分段后的文本片段

**LLM 调用：** 使用 OpenAI Chat Completion API

**Prompt 模板：**
```
你是一个视频内容分析专家。请分析以下视频片段的字幕文本，提取关键信息。

视频标题：{videoTitle}
KOL 名称：{kolName}
片段文本：
{segmentText}

请以 JSON 格式返回：
{
  "title": "片段的简短标题（10字以内）",
  "summary": "内容摘要（50字以内）",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "topicCategory": "观点|分析|教程|其他"
}

要求：
- title 要吸引人，概括核心观点
- summary 要准确提炼主要内容
- keywords 提取 3-5 个语义关键词
- topicCategory 从四个选项中选一个
```

**API 调用示例：**
```ts
const response = await fetch(process.env.OPENAI_BASE_URL + '/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: process.env.OPENAI_MODEL,
    messages: [
      { role: 'system', content: '你是视频内容分析专家' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3
  })
});
```

**输出：**
```json
{
  "clipId": "uuid-generated",
  "videoId": "VIDEO_ID",
  "kolName": "李自然",
  "startSec": 45,
  "endSec": 92,
  "title": "AI 模型的学习机制",
  "summary": "深入探讨了神经网络如何通过反向传播学习特征表示，以及梯度下降的优化过程。",
  "keywords": ["神经网络", "反向传播", "梯度下降"],
  "topicCategory": "分析"
}
```

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
  tags TEXT,  -- JSON 数组字符串
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
  summary TEXT,
  keywords TEXT,  -- JSON 数组字符串
  topic_category TEXT,
  thumbnail TEXT,
  embedding_vector BLOB,  -- 向量数据（可选）
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
      "tags": ["AI", "科技"],
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
  "tags": ["标签1", "标签2"],
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

### 视频合成

#### POST /api/combine
提交合成任务

**Request:**
```json
{
  "clipIds": [1, 3, 5, 7],
  "outputFormat": "mp4",
  "resolution": "1080p"
}
```

**Response:**
```json
{
  "taskId": "combine-uuid",
  "status": "processing",
  "estimatedTime": 120  // 秒
}
```

#### GET /api/combine/:taskId
查询合成进度

**Response:**
```json
{
  "taskId": "combine-uuid",
  "status": "completed",
  "progress": 100,
  "downloadUrl": "/downloads/combined-video.mp4"
}
```

---

## 视频合成实现

使用 **FFmpeg** 进行视频拼接：

```bash
# 1. 下载原视频片段（如果未缓存）
yt-dlp -f best "https://youtube.com/watch?v=VIDEO_ID" -o "video_%(id)s.mp4"

# 2. 按时间戳切割片段
ffmpeg -i video_VIDEO_ID.mp4 -ss 00:00:45 -to 00:01:32 -c copy clip_1.mp4
ffmpeg -i video_VIDEO_ID.mp4 -ss 00:03:20 -to 00:04:15 -c copy clip_2.mp4

# 3. 生成拼接列表
echo "file 'clip_1.mp4'" > concat_list.txt
echo "file 'clip_2.mp4'" >> concat_list.txt

# 4. 合并视频
ffmpeg -f concat -safe 0 -i concat_list.txt -c copy output.mp4
```

**Node.js 封装：**
```ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function combineClips(clips: Clip[], outputPath: string) {
  // 1. 下载并切割片段
  for (const clip of clips) {
    await execAsync(`ffmpeg -i ${clip.videoPath} -ss ${clip.startSec} -to ${clip.endSec} -c copy ${clip.id}.mp4`);
  }
  
  // 2. 生成拼接列表
  const concatList = clips.map(c => `file '${c.id}.mp4'`).join('\n');
  await fs.writeFile('concat_list.txt', concatList);
  
  // 3. 合并
  await execAsync(`ffmpeg -f concat -safe 0 -i concat_list.txt -c copy ${outputPath}`);
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

## 任务队列设计

使用 **Bull**（基于 Redis）或 **BullMQ** 管理后台任务：

```ts
import Queue from 'bull';

const videoQueue = new Queue('video-processing', {
  redis: { host: 'localhost', port: 6379 }
});

// 添加任务
videoQueue.add('process-video', {
  kolId: 1,
  videoUrl: 'https://youtube.com/watch?v=...'
});

// 处理任务
videoQueue.process('process-video', async (job) => {
  const { kolId, videoUrl } = job.data;
  
  // Stage 1: crawl
  job.progress(10);
  const metadata = await crawlVideo(videoUrl);
  
  // Stage 2: process
  job.progress(30);
  const segments = await processSubtitles(metadata.subtitles);
  
  // Stage 3: clip
  job.progress(60);
  const clips = await analyzeWithLLM(segments);
  
  // Stage 4: index
  job.progress(90);
  await saveToDatabase(clips);
  
  job.progress(100);
  return { success: true, clipsCount: clips.length };
});
```

---

## 定时任务设计

### Cron 调度器

使用 **node-cron** 实现定时抓取：

```ts
import cron from 'node-cron';
import { db } from './db';

// 启动定时任务调度器
export function startScheduler() {
  // 每分钟检查一次是否有需要执行的任务
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    
    // 获取所有激活的 KOL
    const activeKols = await db.query(
      'SELECT * FROM kols WHERE active = 1 AND fetch_policy IS NOT NULL'
    );
    
    for (const kol of activeKols) {
      const policy = JSON.parse(kol.fetch_policy);
      
      // 检查是否到了执行时间
      if (shouldRunNow(policy.cron, kol.last_run)) {
        console.log(`Triggering scheduled job for KOL: ${kol.name}`);
        
        // 添加到任务队列
        await videoQueue.add('crawl-channel', {
          kolId: kol.id,
          channelUrl: kol.channel_url,
          maxVideos: policy.max_videos || 20
        });
        
        // 更新最后执行时间
        await db.query(
          'UPDATE kols SET last_run = ? WHERE id = ?',
          [now.toISOString(), kol.id]
        );
      }
    }
  });
  
  console.log('Scheduler started');
}

// 判断是否应该执行
function shouldRunNow(cronExpression: string, lastRun: string | null): boolean {
  if (!cronExpression) return false;
  
  // 使用 cron-parser 解析表达式
  const parser = require('cron-parser');
  const interval = parser.parseExpression(cronExpression);
  const nextRun = interval.next().toDate();
  
  // 如果从未执行过，或者已经过了下次执行时间
  if (!lastRun) return true;
  
  const lastRunDate = new Date(lastRun);
  const now = new Date();
  
  return now >= nextRun && now.getTime() - lastRunDate.getTime() > 60000; // 至少间隔 1 分钟
}
```

### 数据库表更新

需要在 `kols` 表中添加 `last_run` 字段：

```sql
ALTER TABLE kols ADD COLUMN last_run DATETIME;
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
│                      Cloud Run (Frontend)                    │
│                    Vite Build + Static Files                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Cloud Run (Backend API)                    │
│                      Express.js Server                       │
└────────────────┬────────────────────────────────────────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌──────────┐
│ Cloud  │  │ Redis  │  │  Cloud   │
│ SQL    │  │ (Bull) │  │ Storage  │
│ (PG)   │  │        │  │ (视频)    │
└────────┘  └────────┘  └──────────┘
```

**成本优化：**
- 开发阶段：SQLite + 本地文件存储
- 生产阶段：PostgreSQL + Cloud Storage
