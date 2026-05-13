# 03 — 业务逻辑

## 核心业务流程

ENGINE_VEC 的核心价值链：**订阅 KOL → 自动抓取 → AI 处理 → 片段入库 → 搜索/组合**。

> **项目类型：** 本地桌面应用（非 SaaS），所有数据存储在本地

```
┌──────────────┐
│  用户添加 KOL │
│  配置抓取策略  │
└──────┬───────┘
       │ 手动触发 or Cron 定时
       ▼
┌──────────────────────────────────────────────────────┐
│                   处理流水线 (Pipeline)                │
│                                                      │
│  [crawl]          [process]       [clip]    [index]  │
│  抓取视频元数据 → 验证字幕可解析 → LLM切分 → 入库     │
│                                                      │
└──────────────────────────┬───────────────────────────┘
                           │ 产出 Clip 对象
                           ▼
                    ┌─────────────┐
                    │  Asset Library │
                    │  (片段数据库)  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         语义搜索       浏览筛选      拖拽合成
        (Search)     (ClipLibrary)
```

---

## 模块业务逻辑详解

### 1. KOL 管理（Target Entities）

**职责：** 维护被追踪的 KOL 频道列表，配置自动抓取策略。

**核心操作：**

| 操作 | 触发方式 | Store Action | 说明 |
|------|----------|--------------|------|
| 添加 KOL | 点击"Add Entity" | `addKOL()` | 创建新 KOL，id 用 `Date.now()` 生成 |
| 编辑配置 | 点击"CONFIG" | `updateKOL()` | 修改 channel_url、cron |
| 手动触发 | 点击"EXECUTE" | `triggerJob()` | 仅对 `active=1` 的 KOL 显示此按钮 |

**`triggerJob()` 逻辑：**
```ts
// 在 jobs 列表头部插入一条新 running 任务
const newJob: Job = {
  id: Date.now(),
  kolName: kol.name,
  videoTitle: '调度任务...',
  stage: 'crawl',        // 从第一阶段开始
  status: 'running',
  progress: 0,
  time: new Date().toLocaleTimeString(...)
};
return { jobs: [newJob, ...state.jobs] };
```

**KOL 状态判断：**
- `active === 1` → 显示"Active"（amber 色）+ EXECUTE 按钮
- `active === 0` → 显示"Halted"（灰色），无 EXECUTE 按钮

---

### 2. 任务监控（Process Monitor）

**职责：** 实时展示后台处理任务的状态和进度。

**数据分组逻辑：**
```ts
const runningJobs = jobs.filter(j => j.status === 'running');   // 活跃线程区
const historyJobs = jobs.filter(j => j.status !== 'running');   // 执行日志区
```

**状态展示映射：**

| status | 展示 | 颜色 |
|--------|------|------|
| `running` | EXECUTING + 旋转图标 | cyan-400 |
| `success` | COMPILED + 勾选图标 | zinc-500 |
| `failed` | FAILED + X 图标 + RETRY 按钮 | rose-500 |

**进度条动画：** 使用 Framer Motion `animate={{ width: \`${job.progress}%\` }}` 实现平滑进度更新。

---

### 3. 语义搜索（Synaptic Search）

**职责：** 通过语义查询在片段库中检索相关内容。

**搜索流程：**
```
用户输入查询词
      ↓
提交表单 → setIsSearching(true)
      ↓
模拟网络延迟 800ms（setTimeout）
      ↓
setIsSearching(false) + setHasSearched(true)
      ↓
展示结果（当前从 clips 中过滤 relevance 字段存在的片段）
```

**结果排序：** 结果列表按 `relevance` 降序展示，左侧竖条高度 = `relevance%`，颜色区分：
- 第一条（最高相关）：`cyan-400`
- 其余：`cyan-700`


---

### 4. 片段库（Asset Library）

**职责：** 展示所有已处理的视频片段，支持筛选和预览。

**筛选维度：**
- SOURCE KOL：按来源 KOL 筛选
- SORT：按时间排序（最新/最旧）

> 注：已移除 CATEGORY 筛选，因为系统不再由 LLM 生成 topic_category。

**片段时长计算：**
```ts
const duration = clip.endSec - clip.startSec;
const minutes = Math.floor(duration / 60);
const seconds = Math.floor(duration % 60);
// 展示：`${minutes}m ${seconds}s`
```

**详情弹窗（Dialog）：** 点击下载图标打开，展示：
- 左侧：视频播放区（含模拟播放进度条，固定 30% 位置）
- 右侧：片段元数据（来源、标题、时间段）
- 底部操作：COPY REF（复制引用）、EXTRACT（提取片段）

---

### 5. 视频合成（Asset Combiner）

**职责：** 将多个片段拖拽排序后合成为新视频。

**时间轴设计：**
- 使用 `motion/react` 的 `Reorder.Group` + `Reorder.Item` 实现拖拽排序
- 水平滚动时间轴，中心有固定的"播放头"竖线（amber-500）
- 初始化时加载前 5 个 clip：`clips.slice(0, 5)`

**删除片段：**
```ts
const removeClip = (id: number) => {
  setTimeline(t => t.filter(c => c.id !== id));
};
// 注意：e.stopPropagation() 防止触发拖拽
```

**垂直渲染触发：** 点击"DOWNLOAD VERTICAL"按钮，生成带标题和字幕的 9:16 竖屏视频。

---

## API 集成点（已实现）

所有后端 API 已完整实现并连接前端：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/kols` | GET | 获取所有 KOL 列表 |
| `/api/kols` | POST | 添加新 KOL（幂等：相同 channel_url 会更新） |
| `/api/kols/:id` | PATCH | 更新 KOL 配置 |
| `/api/kols/:id` | DELETE | 删除 KOL |
| `/api/kols/:id/trigger` | POST | 手动触发抓取任务 |
| `/api/jobs` | GET | 获取任务列表（支持 status 过滤） |
| `/api/jobs/:id` | GET | 获取单个任务详情 |
| `/api/jobs/:id/retry` | POST | 重试失败任务 |
| `/api/clips` | GET | 获取片段列表（支持 kolName、sort 过滤） |
| `/api/clips/:id` | GET | 获取单个片段详情 |
| `/api/clips/search` | POST | 关键词搜索（body: `{ query: string }`） |
| `/api/clips/vertical-render` | POST | 提交竖屏渲染任务（body: `{ clipId: number }`） |
| `/api/clips/vertical-render/:jobId` | GET | 查询渲染进度 |
| `/api/clips/vertical-download/:filename` | GET | 下载渲染后的竖屏视频 |
| `/api/combine` | POST | 提交视频合成任务 |
| `/api/combine/:taskId` | GET | 查询合成进度 |
| `/api/combine/download/:filename` | GET | 下载合成后的视频 |
| `/ws/jobs` | WebSocket | 实时推送任务状态变更 |

LLM API 用于：
- 视频字幕切分：输入完整字幕（带时间戳），输出 `title` + `start_sec` + `end_sec`
- 搜索时的文本匹配（`title` + `subtitles` 内容）

> 注：已移除 summary/keywords/topic_category/embedding_vector 等字段，LLM 只负责"切分+起标题"，不生成冗余分析内容。
