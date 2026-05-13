# 02 — 数据层

## 状态管理方案

项目使用 **Zustand** 进行全局状态管理，所有数据定义在 `src/store.ts`。数据通过 REST API 与后端 SQLite 数据库持久化。

> **项目类型：** 本地桌面应用（非 SaaS），数据存储在本地 SQLite 数据库

---

## 数据实体定义

### KOL（目标频道实体）

```ts
interface KOL {
  id: number;               // 唯一标识
  name: string;             // 显示名称（如"李自然"）
  channel_url: string;      // 频道 URL（如 youtube.com/@liziran）
  platform: string;         // 平台（当前仅 'youtube'）
  fetch_policy: {
    cron?: string;          // Cron 表达式（如 '0 3 * * *'）
    max_videos?: number;    // 每次最多抓取视频数
  };
  active: number;           // 启用状态：1=激活，0=暂停
  last_run?: string;        // 最后一次执行时间（ISO 8601）
  next_run?: string;        // 下次执行时间（展示用字符串）
  created_at: string;       // 创建时间（ISO 8601）
}
```

### Job（后台处理任务）

```ts
interface Job {
  id: number;
  kolName: string;          // 关联 KOL 名称
  videoTitle: string;       // 处理的视频标题
  stage: 'crawl' | 'process' | 'clip' | 'index';  // 当前流水线阶段
  status: 'running' | 'success' | 'failed' | 'pending';
  progress?: number;        // 进度百分比（0-100），running 状态时有效
  duration?: string;        // 执行耗时（如 '4m 32s'）
  time?: string;            // 开始时间（如 '03:12'）
}
```

### Clip（视频片段）

```ts
interface Clip {
  id: number;
  video_id: string;         // 来源视频 ID（YouTube videoId）
  videoTitle: string;       // 来源视频标题
  kolName: string;          // 来源 KOL 名称
  thumbnail: string;        // 片段封面图 URL
  verticalCover?: string;   // 竖屏渲染视频 URL（可选）
  title: string;            // AI 生成的片段标题
  startSec: number;         // 片段起始时间（秒）
  endSec: number;           // 片段结束时间（秒）
  createdAt: string;        // 创建日期（ISO 8601）
  relevance?: number;       // 搜索相关度评分（0-100），搜索结果时有效
}

interface SubtitleSegment {
  start: number;            // 字幕开始时间（秒）
  end: number;              // 字幕结束时间（秒）
  text: string;             // 字幕文本
}
```

---

## 实体关系图（ER）

```
┌─────────────────┐         ┌─────────────────────┐
│      KOL        │         │        Job           │
├─────────────────┤  1 : N  ├─────────────────────┤
│ id (PK)         │────────▶│ id (PK)              │
│ name            │         │ kolName (FK→KOL.name)│
│ channel_url     │         │ videoTitle           │
│ platform        │         │ stage                │
│ fetch_policy    │         │ progress             │
│ active          │         │ duration             │
│ nextRun         │         │ time                 │
└─────────────────┘         └─────────────────────┘
         │
         │ 1 : N（通过 videoTitle 间接关联）
         ▼
┌─────────────────────┐
│        Clip          │
├─────────────────────┤
│ id (PK)              │
│ videoTitle           │
│ kolName (FK→KOL.name)│
│ thumbnail            │
│ title                │
│ startSec / endSec    │
│ subtitles[]          │
│ createdAt            │
│ relevance            │
└─────────────────────┘
```

**关系说明：**
- 一个 KOL 对应多个 Job（每次抓取任务）
- 一个 KOL 对应多个 Clip（来自其视频的片段）
- Job 与 Clip 通过 `videoTitle` 间接关联（同一视频处理后产生多个 Clip）

---

## Zustand Store 结构

```ts
interface AppState {
  // 数据
  kols: KOL[];
  jobs: Job[];
  clips: Clip[];

  // UI 状态
  theme: 'dark' | 'light';
  activePage: PageType;     // 'kol' | 'task' | 'clip' | 'search'

  // Actions
  setTheme: (theme) => void;
  setActivePage: (page) => void;
  addKOL: (kol: Omit<KOL, 'id'>) => void;
  updateKOL: (id, partial) => void;
  triggerJob: (kolId) => void;   // 手动触发抓取任务
}
```

---

## 数据来源

所有数据通过 REST API 从后端 SQLite 数据库获取：

| 数据 | API 端点 | 说明 |
|------|----------|------|
| KOLs | `GET /api/kols` | 从 `kols` 表读取 |
| Jobs | `GET /api/jobs` | 从 `jobs` 表读取 |
| Clips | `GET /api/clips` | 从 `clips` 表读取 |

前端 `store.ts` 在初始化时自动调用 `fetchKOLs()`、`fetchJobs()`、`fetchClips()` 加载数据。

---

## Job 流水线阶段说明

| stage 值 | 展示标签 | 含义 |
|----------|----------|------|
| `crawl` | AWAITING_METADATA | 抓取视频元数据 |
| `process` | SEGMENT_STREAM | 验证字幕可解析 |
| `clip` | EXTRACT_HIGHLIGHTS | LLM 切分片段（title + 时间段）|
| `index` | VECTOR_INDEXING | 向量化索引入库 |

---

## 页面路由类型

```ts
type PageType = 'kol' | 'task' | 'clip' | 'search';
```

`activePage` 存储在 Zustand store 中，由 `Layout.tsx` 读取并渲染对应页面组件。
