# 03 — 业务逻辑

## 核心业务流程

ENGINE_VEC 的核心价值链：**订阅 KOL → 自动抓取 → AI 处理 → 片段入库 → 搜索/组合**。

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
│  抓取视频元数据 → 视频分段处理 → 提取片段 → 向量索引   │
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
        (Search)     (ClipLibrary)  (Combine)
```

---

## 模块业务逻辑详解

### 1. KOL 管理（Target Entities）

**职责：** 维护被追踪的 KOL 频道列表，配置自动抓取策略。

**核心操作：**

| 操作 | 触发方式 | Store Action | 说明 |
|------|----------|--------------|------|
| 添加 KOL | 点击"Add Entity" | `addKOL()` | 创建新 KOL，id 用 `Date.now()` 生成 |
| 编辑配置 | 点击"CONFIG" | `updateKOL()` | 修改 channel_url、cron、tags |
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

**Lucky Combo 功能：**

这是一个特色功能，点击后触发三步动画序列，完成后自动跳转到合成页：

```
步骤 0: ANALYZING SEMANTIC VECTORS...   (3s)
步骤 1: ALIGNING TIMELINE FRAGMENTS...  (3s)
步骤 2: SYNTHESIZING COMPOSITION...     (3s)
完成后: setActivePage('combine')
```

实现机制：`comboStep` 状态从 0 递增，通过 `useEffect` 监听，每 3 秒推进一步，到达 `COMBO_STEPS.length` 时触发页面跳转。

---

### 4. 片段库（Asset Library）

**职责：** 展示所有已处理的视频片段，支持筛选和预览。

**筛选维度（当前为 UI 展示，未接入过滤逻辑）：**
- SOURCE KOL：按来源 KOL 筛选
- CATEGORY：按话题分类筛选（观点/分析/教程）
- SORT：按时间排序（最新/最旧）

**片段时长计算：**
```ts
const duration = clip.endSec - clip.startSec;
const minutes = Math.floor(duration / 60);
const seconds = Math.floor(duration % 60);
// 展示：`${minutes}m ${seconds}s`
```

**详情弹窗（Dialog）：** 点击下载图标打开，展示：
- 左侧：视频播放区（含模拟播放进度条，固定 30% 位置）
- 右侧：片段元数据（分类、来源、标题、摘要、关键词）
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

**合成触发：** 点击"COMBINE AS NEW VIDEO"按钮（当前为 UI 展示，未接入实际导出逻辑）。

---

## API 集成点（待实现）

当前项目为纯前端 Mock，以下是预期的后端 API 接口：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/kols` | GET | 获取所有 KOL 列表 |
| `/api/kols` | POST | 添加新 KOL |
| `/api/kols/:id` | PATCH | 更新 KOL 配置 |
| `/api/kols/:id/trigger` | POST | 手动触发抓取任务 |
| `/api/jobs` | GET | 获取任务列表（支持 status 过滤） |
| `/api/clips` | GET | 获取片段列表（支持 kolName、category 过滤） |
| `/api/clips/search` | POST | 语义搜索（body: `{ query: string }`） |
| `/api/combine` | POST | 提交合成任务（body: `{ clipIds: number[] }`） |

Gemini API 用于：
- 视频内容摘要生成（`summary` 字段）
- 语义关键词提取（`keywords` 字段）
- 话题分类（`topicCategory` 字段）
- 搜索时的语义向量匹配（`relevance` 评分）
