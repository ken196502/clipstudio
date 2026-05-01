# 02 — 数据层

## 状态管理方案

项目使用 **Zustand** 进行全局状态管理，所有数据定义在 `src/store.ts`。当前版本为纯前端 Mock 数据，无持久化后端。

---

## 数据实体定义

### KOL（目标频道实体）

```ts
interface KOL {
  id: number;               // 唯一标识
  name: string;             // 显示名称（如"李自然"）
  channel_url: string;      // 频道 URL（如 youtube.com/@liziran）
  platform: string;         // 平台（当前仅 'youtube'）
  tags: string[];           // 分类标签（如 ['AI', '科技', '评测']）
  fetch_policy: {
    cron?: string;          // Cron 表达式（如 '0 3 * * *'）
    max_videos?: number;    // 每次最多抓取视频数
  };
  active: number;           // 启用状态：1=激活，0=暂停
  nextRun?: string;         // 下次执行时间（展示用字符串）
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
  videoTitle: string;       // 来源视频标题
  kolName: string;          // 来源 KOL 名称
  kolAvatar?: string;       // KOL 头像 URL（可选）
  thumbnail: string;        // 片段封面图 URL
  title: string;            // AI 生成的片段标题
  summary: string;          // AI 生成的内容摘要
  keywords: string[];       // AI 提取的语义关键词
  startSec: number;         // 片段起始时间（秒）
  endSec: number;           // 片段结束时间（秒）
  topicCategory: string;    // 话题分类（观点/分析/教程）
  createdAt: string;        // 创建日期（YYYY-MM-DD）
  relevance?: number;       // 搜索相关度评分（0-100），搜索结果时有效
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
│ tags[]          │         │ status               │
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
│ summary              │
│ keywords[]           │
│ startSec / endSec    │
│ topicCategory        │
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
  activePage: PageType;     // 'kol' | 'task' | 'clip' | 'search' | 'combine'

  // Actions
  setTheme: (theme) => void;
  setActivePage: (page) => void;
  addKOL: (kol: Omit<KOL, 'id'>) => void;
  updateKOL: (id, partial) => void;
  triggerJob: (kolId) => void;   // 手动触发抓取任务
}
```

---

## Mock 数据说明

当前所有数据为硬编码 Mock，定义在 `store.ts` 顶部：

| 常量 | 内容 |
|------|------|
| `DUMMY_KOLS` | 3 个 KOL：李自然（激活）、硅谷徐（激活）、TESTV（暂停） |
| `DUMMY_JOBS` | 5 条任务记录：1 条 running（进度 62%）、3 条 success、1 条 failed |
| `DUMMY_CLIPS` | 3 个片段：来自李自然和硅谷徐，含封面图（Unsplash）、摘要、关键词 |

---

## Job 流水线阶段说明

| stage 值 | 展示标签 | 含义 |
|----------|----------|------|
| `crawl` | AWAITING_METADATA | 抓取视频元数据 |
| `process` | SEGMENT_STREAM | 视频分段处理 |
| `clip` | EXTRACT_HIGHLIGHTS | AI 提取高亮片段 |
| `index` | VECTOR_INDEXING | 向量化索引入库 |

---

## 页面路由类型

```ts
type PageType = 'kol' | 'task' | 'clip' | 'search' | 'combine';
```

`activePage` 存储在 Zustand store 中，由 `Layout.tsx` 读取并渲染对应页面组件。`Search` 页面可通过 `setActivePage('combine')` 直接跳转到合成页（Lucky Combo 功能触发）。
