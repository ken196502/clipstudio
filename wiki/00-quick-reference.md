# 00 — 快速参考

> 本文档提供项目的快速查询表，适合开发时快速查阅。

---

## 🗂️ 文件路径速查

| 功能 | 文件路径 |
|------|----------|
| 搜索页面 | `src/pages/Search.tsx` |
| KOL 管理 | `src/pages/KOLManager.tsx` |
| 任务监控 | `src/pages/TaskMonitor.tsx` |
| 视频合成 | `src/pages/Combine.tsx` |
| 片段库 | `src/pages/ClipLibrary.tsx` |
| 全局布局 | `src/Layout.tsx` |
| 状态管理 | `src/store.ts` |
| 全局样式 | `src/index.css` |
| UI 组件 | `components/ui/*.tsx` |
| 工具函数 | `lib/utils.ts` |

---

## 🎨 设计系统速查

### 颜色方案

| 用途 | Tailwind 类 | 色值 |
|------|-------------|------|
| 背景 | `bg-zinc-950` | #09090b |
| 卡片背景 | `bg-zinc-900` | #18181b |
| 边框 | `border-zinc-800` | #27272a |
| 主强调色 | `text-amber-500` | #f59e0b |
| 搜索/状态色 | `text-cyan-400` | #22d3ee |
| 成功 | `text-emerald-500` | #10b981 |
| 失败 | `text-rose-500` | #f43f5e |
| 正文 | `text-zinc-100` | #f4f4f5 |
| 次要文字 | `text-zinc-500` | #71717a |

### 字体使用

| 场景 | CSS 类 | 字体 |
|------|--------|------|
| 正文、描述 | `font-sans` | Inter |
| 标题、按钮 | `font-display` | Space Grotesk |
| 代码、状态 | `font-mono` | JetBrains Mono |

### 圆角规范

**统一使用 `rounded-sm`（2px）**，拒绝大圆角。

### 动画类

| 类名 | 效果 | 使用场景 |
|------|------|----------|
| `.hover-fx` | 底部下划线 + scale 1.05 | 按钮、链接 |
| `.hover-sweep` | 光扫效果 | 卡片、大按钮 |
| `.group-hover-wiggle` | 图标抖动 + 发光 | 图标按钮 |
| `.shimmer` | 光泽流动 | 加载状态 |

---

## 📊 数据结构速查

### KOL
```ts
{
  id: number;
  name: string;              // "李自然"
  channel_url: string;       // "youtube.com/@liziran"
  platform: string;          // "youtube"
  fetch_policy: {
    cron?: string;           // "0 3 * * *"
    max_videos?: number;     // 20
  };
  active: number;            // 1=激活, 0=暂停
  nextRun?: string;          // "今日 03:00"
}
```

### Job
```ts
{
  id: number;
  kolName: string;
  videoTitle: string;
  stage: 'crawl' | 'process' | 'clip' | 'index';
  status: 'running' | 'success' | 'failed' | 'pending';
  progress?: number;         // 0-100
  duration?: string;         // "4m 32s"
  time?: string;             // "03:12"
}
```

### Clip
```ts
{
  id: number;
  videoTitle: string;
  kolName: string;
  thumbnail: string;         // URL
  title: string;             // AI 生成
  startSec: number;
  endSec: number;
  subtitles?: SubtitleSegment[];  // 该片段的字幕（带时间戳）
  createdAt: string;         // "2024-05-20"
  relevance?: number;        // 搜索时的相关度 0-100
}

interface SubtitleSegment {
  start: number;             // 字幕开始时间（秒）
  end: number;               // 字幕结束时间（秒）
  text: string;              // 字幕文本
}
```

---

## 🔌 API 接口速查

### KOL 管理
```
GET    /api/kols              # 获取列表
POST   /api/kols              # 添加新 KOL (带去重逻辑)
PATCH  /api/kols/:id          # 更新配置
DELETE /api/kols/:id          # 删除 KOL
POST   /api/kols/:id/trigger  # 手动异步触发流水线任务
```

### 任务管理
```
GET    /api/jobs?status=running  # 获取任务列表 (Crawl->Process->Clip->Index)
GET    /api/jobs/:id             # 查询单个任务详情
POST   /api/jobs/:id/retry       # 重试失败任务
```

### 片段管理
```
GET    /api/clips?kolName=xxx&sort=newest    # 获取片段列表
POST   /api/clips/search                    # 关键词相关度评分搜索
```

### 垂直视频渲染
```
POST   /api/clips/vertical-render   # 提交垂直渲染任务
Body: { "clipId": 1 }
GET    /api/clips/vertical-render/:jobId   # 查询渲染进度及结果
GET    /api/clips/vertical-download/:filename   # 下载渲染后的竖屏视频
```

### 视频合成
```
POST   /api/combine   # 提交视频合成任务
Body: { "clipIds": [1,2,3], "portrait": true, "textOverlays": [...] }
GET    /api/combine/:taskId   # 查询合成进度
GET    /api/combine/download/:filename   # 下载合成后的视频
```

---

## 🛠️ 常用命令速查

### 全栈启动
```bash
# 前端 (localhost:3002)
npm run dev

# 后端 (localhost:3001)
cd server && npm run dev
```

### 后端开发
```bash
cd server
npm run db:init  # 初始化 SQLite 数据库
npm test         # 运行后端 API 集成测试
```

### 视频验证
```bash
# 使用 npx tsx 运行验证脚本
npx tsx src/verify-api-flow.ts
```

### 视频处理工具
```bash
# 手动切割视频片段 (强制重编码以对齐关键帧)
ffmpeg -i video.mp4 -ss 10 -to 40 -c:v libx264 -crf 23 -c:a aac output.mp4
```

---

## 🔑 环境变量速查

| 变量名 | 必填 | 示例值 | 说明 |
|--------|------|--------|------|
| `OPENAI_BASE_URL` | 是 | `https://api.openai.com/v1` | OpenAI API 地址 |
| `OPENAI_API_KEY` | 是 | `sk-...` | OpenAI API 密钥 |
| `OPENAI_MODEL` | 是 | `gpt-4o-mini` | 使用的模型 |
| `ENABLE_SCHEDULER` | 否 | `true` | 是否启用定时任务 |
| `SCHEDULER_CHECK_INTERVAL` | 否 | `* * * * *` | 调度器检查间隔 |
| `DATABASE_URL` | 是 | `./data/engine_vec.db` | 数据库路径 |
| `PORT` | 否 | `3001` | 后端端口 |
| `STORAGE_PATH` | 否 | `./storage` | 文件存储路径 |

---

## 🐛 调试技巧

### 查看 Zustand 状态
```tsx
// 在任意组件中
import { useAppStore } from './store';

function DebugPanel() {
  const state = useAppStore();
  console.log('Current state:', state);
  return <pre>{JSON.stringify(state, null, 2)}</pre>;
}
```

### 查看 API 请求
```ts
// 在 store.ts 中添加日志
const response = await fetch('/api/kols');
console.log('API Response:', await response.json());
```

### 查看动画状态
```tsx
// 在 motion 组件中
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  onAnimationStart={() => console.log('Animation started')}
  onAnimationComplete={() => console.log('Animation completed')}
>
```

---

## 📦 依赖包速查

### 核心依赖
```json
{
  "react": "^19.0.1",
  "zustand": "^5.0.12",
  "motion": "^12.23.24",
  "lucide-react": "^0.546.0"
}
```

### 后端依赖
```json
{
  "express": "^4.21.2",
  "better-sqlite3": "^11.8.1",
  "node-cron": "^3.0.3",
  "cron-parser": "^4.9.0",
  "openai": "^4.80.1",
  "puppeteer-core": "^24.43.0",
  "ws": "^8.20.0",
  "uuid": "^11.0.3",
  "express-rate-limit": "^8.4.1"
}
```

### 系统依赖
- Node.js 18+
- FFmpeg 4.4+
- yt-dlp 2023+
- Rust（用于 Tauri 打包，可选）

---

## 🚦 Job Stage 映射

| stage 值 | 展示标签 | 说明 |
|----------|----------|------|
| `crawl` | AWAITING_METADATA | 抓取视频元数据 + 字幕 |
| `process` | SEGMENT_STREAM | 验证字幕可解析 |
| `clip` | EXTRACT_HIGHLIGHTS | LLM 切分片段（title + 时间段） |
| `index` | VECTOR_INDEXING | 保存到数据库 + 向量索引 |

---

## 🎯 页面路由映射

| activePage 值 | 组件 | 导航标签 |
|---------------|------|----------|
| `search` | `Search.tsx` | SYNAPTIC SEARCH |
| `kol` | `KOLManager.tsx` | TARGET ENTITIES |
| `task` | `TaskMonitor.tsx` | PROCESS MONITOR |
| `clip` | `ClipLibrary.tsx` | VERTICAL CLIPS |
| `combine` | `Combine.tsx` | ASSET COMBINER |

---

## 📞 快速链接

- **OpenAI API 文档:** https://platform.openai.com/docs/api-reference
- **FFmpeg 文档:** https://ffmpeg.org/documentation.html
- **yt-dlp 文档:** https://github.com/yt-dlp/yt-dlp
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Framer Motion:** https://www.framer.com/motion/
- **Tauri 文档:** https://tauri.app/v1/guides/
