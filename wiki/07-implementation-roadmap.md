# 07 — 实施路线图

## 项目当前状态

**最后更新：** 2026-05-02

✅ **已完成（Phase 0）：**
- 前端 UI 框架（React + Tailwind + Motion）
- 5 个页面组件（Search / KOL / Task / Clip / Combine）
- Zustand 状态管理 + Mock 数据
- 完整的视觉设计系统（赛博朋克风格）
- 完整的 Wiki 文档（8 个文档）
- 页面切换动画
- Lucky Combo 动画序列
- 拖拽排序时间轴

✅ **已完成（Phase 1）：**
- 后端 API 基础架构（Express.js + TypeScript）
- 数据库设计与初始化（SQLite + 4 张表）
- 基础 CRUD API（KOL、Clip、Job）
- 前后端联调（前端连接后端 API）
- 数据库种子数据
- 健康检查端点

✅ **已完成（前端修复）：**
- Add Entity 按钮功能实现
- 筛选功能实现（Clip Library）
- 搜索功能连接后端 API
- Lucky Combo 连接后端 API
- 任务监控轮询更新

✅ **已完成（Phase 2）：**
- YouTube 视频抓取（YouTube.js 集成）
- 字幕分段处理（30-90 秒语义分段）
- OpenAI LLM 内容分析（标题/摘要/关键词/分类）
- 任务队列（Bull + Redis）
- 定时任务调度（node-cron）
- 4-stage 流水线完整实现

✅ **已完成（Phase 5）：**
- 视频下载服务（YouTube.js）
- FFmpeg 视频切割服务
- 视频拼接服务
- Combine 路由集成视频处理
- 前端合成功能集成

🐛 **已修复问题（前端）：**
1. ✅ 筛选功能已实现（Clip Library 下拉框）
2. ✅ Add Entity 按钮已实现（KOL Manager）
3. ✅ 搜索结果已连接后端 API（Search 页面）
4. ✅ 任务进度已实现轮询更新（Task Monitor）
5. ✅ 合成按钮已实现（Combine 页面）

---

## 实施阶段划分

### Phase 1：后端基础架构

**目标：** 搭建可运行的后端服务，实现基本的 CRUD 操作。

#### 1.1 项目初始化
```bash
# 创建后端目录
mkdir server
cd server
npm init -y

# 安装核心依赖
npm install express cors dotenv
npm install better-sqlite3
npm install -D typescript @types/node @types/express tsx
```

#### 1.2 数据库初始化
- [ ] 创建 `server/db/schema.sql`，定义 4 张表
- [ ] 编写 `server/db/init.ts`，自动建表 + 插入测试数据
- [ ] 实现 `server/db/queries.ts`，封装常用查询

#### 1.3 API 路由实现
- [ ] `GET /api/kols` — 返回 KOL 列表
- [ ] `POST /api/kols` — 添加新 KOL
- [ ] `PATCH /api/kols/:id` — 更新 KOL
- [ ] `GET /api/clips` — 返回片段列表（支持筛选）
- [ ] `GET /api/jobs` — 返回任务列表

#### 1.4 前后端联调
- [ ] 修改前端 `store.ts`，将 Mock 数据替换为 API 调用
- [ ] 使用 `fetch` 或 `axios` 请求后端接口
- [ ] 处理加载状态和错误提示

**验收标准：**
- 前端可以从后端获取 KOL 列表并展示
- 可以通过前端添加新 KOL 并保存到数据库

---

### Phase 2：视频抓取流水线

**目标：** 实现从 YouTube URL 到生成 Clips 的完整流程。

#### 2.1 YouTube 字幕抓取
- [x] 安装 `youtubei.js`：`npm install youtubei.js`
- [x] 实现 `server/services/youtube.ts`：
  - `fetchChannelVideos(channelUrl, maxVideos)` — 获取频道最新视频列表
  - `fetchVideoInfo(videoId)` — 获取单个视频的元数据
  - `fetchSubtitles(videoId)` — 提取英文字幕（带时间戳）
  - 使用 YouTube.js 的 InnerTube API，无需 API Key
- [x] 处理异常：无字幕、私有视频、地区限制
- [x] 实现去重逻辑：检查数据库中是否已存在该视频
- [x] 参考文档：https://ytjs.dev

#### 2.2 字幕分段处理
- [x] 实现 `server/services/segmenter.ts`：
  - 按时间窗口（30-90 秒）分段
  - 在句子边界断句
  - 合并过短片段（< 15 秒）
- [x] 单元测试：验证分段逻辑正确性

#### 2.3 OpenAI LLM 集成
- [x] 安装 `openai` SDK：`npm install openai`
- [x] 实现 `server/services/llm.ts`：
  ```ts
  async function analyzeClip(text: string, videoTitle: string, kolName: string) {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL,
      messages: [
        { role: 'system', content: '你是视频内容分析专家' },
        { role: 'user', content: buildPrompt(text, videoTitle, kolName) }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });
    return JSON.parse(response.choices[0].message.content);
  }
  ```
- [x] 实现 Prompt 模板（参考 06-backend-design.md）
- [x] 批量处理：并发调用 LLM（限制并发数为 5）

#### 2.4 任务队列
- [x] 安装 Bull：`npm install bull @types/bull`
- [x] 安装 node-cron：`npm install node-cron @types/node-cron`
- [x] 安装 cron-parser：`npm install cron-parser @types/cron-parser`
- [x] 配置 Redis（本地开发用 Docker）
- [x] 实现 `server/scheduler.ts`：
  - `startScheduler()` — 启动定时任务调度器
  - `shouldRunNow()` — 判断是否应该执行
  - 每分钟检查所有 `active=1` 的 KOL
  - 根据 `fetch_policy.cron` 判断是否到了执行时间
- [x] 实现 2 个 job processor：
  - `crawl-channel` — 抓取频道视频列表
  - `process-video` — 处理单个视频（4 个 stage）
- [x] 实现进度更新：`job.progress(percent)`
- [x] 在 `server/index.ts` 中启动调度器

#### 2.5 前端集成
- [x] 实现 `POST /api/kols/:id/trigger` 接口（抓取该 KOL 频道的最新视频）
- [x] 前端"EXECUTE"按钮调用此接口
- [x] Task Monitor 页面轮询 `/api/jobs?status=running` 更新进度
- [x] 显示当前处理的视频标题（`job.videoTitle`）

**验收标准：**
- 在 KOL Manager 点击"EXECUTE"按钮
- Task Monitor 显示 4 个 stage 依次执行（crawl → process → clip → index）
- 完成后 Clip Library 出现该频道的新片段（可能是多个视频的多个片段）

---

### Phase 3：搜索功能

**目标：** 实现语义搜索，返回相关片段。

#### 3.1 关键词搜索（MVP）
- [ ] 实现 `POST /api/clips/search`
- [ ] SQL 查询：`WHERE title LIKE ? OR summary LIKE ?`
- [ ] 计算简单相关度评分（匹配次数）

#### 3.2 向量搜索（可选）
- [ ] 生成 Embeddings：
  ```ts
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: `${clip.title} ${clip.summary} ${clip.keywords.join(' ')}`
  });
  ```
- [ ] 保存到数据库 `embedding_vector` 字段（BLOB）
- [ ] 实现余弦相似度计算
- [ ] 或使用向量数据库（Pinecone / Weaviate / pgvector）

#### 3.3 前端集成
- [ ] Search 页面提交表单时调用 `/api/clips/search`
- [ ] 展示返回的结果（带 relevance 评分）
- [ ] 实现筛选器（SOURCE KOL / CATEGORY）

**验收标准：**
- 输入"AI 职业"，返回相关片段
- 相关度评分合理（最相关的排在前面）

---

### Phase 4：Lucky Combo 智能组合

**目标：** 根据用户 Prompt 自动挑选片段并组合。

#### 4.1 LLM 选片逻辑
- [ ] 实现 `POST /api/lucky-combo`
- [ ] 请求体：`{ "prompt": "制作一个关于 AI 改变职业的视频" }`
- [ ] LLM Prompt：
  ```
  用户需求：{prompt}
  
  可用片段列表：
  1. [ID: 1] AI 取代哪些职业 - 探讨了 AI 在未来5年内最可能替代的职业类型...
  2. [ID: 2] GPT-5 核心突破点 - 从技术和商业化角度深度剖析...
  ...
  
  请从上述片段中选择 3-5 个最相关的，按逻辑顺序排列。
  返回 JSON 格式：
  {
    "selectedClipIds": [1, 5, 3],
    "reasoning": "选择理由"
  }
  ```
- [ ] 返回选中的 Clip 列表

#### 4.2 前端集成
- [ ] Lucky Combo 动画完成后调用 `/api/lucky-combo`
- [ ] 将返回的 clips 设置为 Combine 页面的 timeline
- [ ] 跳转到 Combine 页面

**验收标准：**
- 点击 Lucky Combo，输入"制作 AI 教程视频"
- 自动选择 3-5 个相关片段
- 跳转到 Combine 页面，时间轴已填充

---

### Phase 5：视频合成

**目标：** 将选中的片段合成为一个新视频。

#### 5.1 视频下载与缓存
- [ ] 安装 `youtubei.js`：`npm install youtubei.js`
- [ ] 实现 `server/services/downloader.ts`：
  ```ts
  import { Innertube } from 'youtubei.js';
  
  async function downloadVideo(videoId: string) {
    const outputPath = `./storage/videos/${videoId}.mp4`;
    if (fs.existsSync(outputPath)) return outputPath;
    
    const youtube = await Innertube.create();
    const info = await youtube.getInfo(videoId);
    
    // 获取最佳视频流
    const format = info.chooseFormat({ quality: 'best', type: 'video+audio' });
    const stream = await info.download({ format });
    
    // 保存到本地
    const writeStream = fs.createWriteStream(outputPath);
    stream.pipe(writeStream);
    
    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => resolve(outputPath));
      writeStream.on('error', reject);
    });
  }
  ```
- [ ] 实现缓存策略（避免重复下载）

#### 5.2 FFmpeg 视频切割
- [ ] 安装 FFmpeg（系统依赖）
- [ ] 实现 `server/services/ffmpeg.ts`：
  ```ts
  async function extractClip(videoPath: string, startSec: number, endSec: number, outputPath: string) {
    await execAsync(`ffmpeg -i "${videoPath}" -ss ${startSec} -to ${endSec} -c copy "${outputPath}"`);
  }
  ```

#### 5.3 视频拼接
- [ ] 实现 `combineClips(clips: Clip[], outputPath: string)`
- [ ] 生成 concat 列表文件
- [ ] 调用 FFmpeg 合并

#### 5.4 任务队列
- [ ] 创建 `combine-video` 队列
- [ ] 实现进度回调（每个片段处理完更新进度）
- [ ] 完成后生成下载链接

#### 5.5 前端集成
- [ ] Combine 页面"COMBINE AS NEW VIDEO"按钮调用 `POST /api/combine`
- [ ] 显示进度条（轮询 `GET /api/combine/:taskId`）
- [ ] 完成后显示下载按钮

**验收标准：**
- 在 Combine 页面拖拽 3 个片段
- 点击合成按钮
- 等待 1-2 分钟后下载合成视频
- 播放视频，确认片段顺序正确

---

---

## 技术栈总结

| 层级 | 技术选型 | 理由 |
|------|----------|------|
| 前端 | React + Vite + Tailwind | 已完成，保持不变 |
| 后端 | Express.js + TypeScript | 轻量、易上手 |
| 数据库 | SQLite | 零配置，适合开发 |
| 任务队列 | node-cron | 简单定时任务 |
| LLM | OpenAI Chat Completion (RESTful) | 支持自定义 baseURL，兼容各种 API |
| 视频处理 | yt-dlp + FFmpeg | 行业标准工具 |

---

## 开发优先级

### 🔴 P0（核心功能，必须实现）
1. ✅ **后端 API 基础架构** — Express.js + TypeScript + SQLite
2. ✅ **数据库设计与初始化** — 4 张表（kols, videos, clips, jobs）
3. ✅ **前后端联调** — 替换 Mock 数据为 API 调用
4. ✅ **YouTube 字幕抓取** — YouTube.js 集成
5. ✅ **OpenAI LLM 内容分析** — 片段标题/摘要/关键词生成

### 🟡 P1（重要功能，尽快实现）
6. ✅ **任务队列 + 进度更新** — Bull + Redis
7. ✅ **基础搜索（关键词匹配）** — SQL LIKE 查询
8. ⏳ **视频合成** — FFmpeg 切割和拼接
9. ✅ **定时任务调度** — node-cron

### 🟢 P2（优化功能，后续迭代）
10. **Lucky Combo 智能选片** — LLM 自动选片
11. **向量搜索** — OpenAI Embeddings + 余弦相似度
12. **缩略图生成** — FFmpeg 截图
13. **视频预览** — 在线播放片段
14. **用户系统** — 多用户隔离
15. **批量导入 KOL 频道** — 批量添加功能

### 🔵 P3（增强功能，长期规划）
16. **前端已知问题修复** — 筛选、Add Entity、搜索结果等
17. **性能优化** — Redis 缓存、数据库索引

---

## 本地开发流程

### 启动后端服务
```bash
cd server
npm run dev
# API 运行在 http://localhost:3001
```

### 启动前端服务
```bash
npm run dev
# 访问 http://localhost:3000
```

### 环境变量配置
```bash
# OpenAI API 配置
OPENAI_BASE_URL="https://api.openai.com/v1"
OPENAI_API_KEY="sk-your-api-key"
OPENAI_MODEL="gpt-4o-mini"

# 数据库
DATABASE_URL="./data/engine_vec.db"

# 服务器
PORT=3001
NODE_ENV="development"

# 文件存储
STORAGE_PATH="./storage"
MAX_VIDEO_SIZE_MB=500

# 定时任务
ENABLE_SCHEDULER=true
SCHEDULER_CHECK_INTERVAL="* * * * *"
```

---

## 本地开发里程碑

### Milestone 1：后端可运行
**目标：** 前后端联调成功，可以从数据库读取数据

**任务清单：**
- [x] 创建 `server/` 目录，初始化 TypeScript 项目
- [x] 编写数据库 schema（4 张表）
- [x] 实现基础 CRUD API（KOL、Clip、Job）
- [x] 前端替换 Mock 数据为 API 调用

**验收：** 前端可以从后端获取 KOL 列表并展示

---

### Milestone 2：视频抓取流水线
**目标：** 点击 EXECUTE 按钮，能自动抓取频道视频并生成片段

**任务清单：**
- [x] 集成 YouTube.js，实现频道视频列表抓取
- [x] 实现字幕提取和分段逻辑
- [x] 集成 OpenAI API，实现 LLM 分析
- [x] 实现 Bull 任务队列，4 个 stage 依次执行
- [x] Task Monitor 页面实时显示进度

**验收：** 在 KOL Manager 点击 EXECUTE，Task Monitor 显示进度，完成后 Clip Library 出现新片段

---

### Milestone 3：搜索功能
**目标：** 用户可以通过关键词搜索相关片段

**任务清单：**
- [ ] 实现 `/api/clips/search` 接口（关键词匹配）
- [ ] 前端 Search 页面调用 API
- [ ] 实现筛选功能（KOL、分类）
- [ ] （可选）实现向量搜索

**验收：** 输入"AI 职业"，返回相关片段

---

### Milestone 4：Lucky Combo
**目标：** AI 根据用户 Prompt 自动选片

**任务清单：**
- [ ] 实现 `/api/lucky-combo` 接口
- [ ] LLM 根据 Prompt 从片段库中选择 3-5 个
- [ ] 前端动画完成后跳转到 Combine 页面

**验收：** 点击 Lucky Combo，输入 Prompt，自动选片并跳转

---

### Milestone 5：视频合成
**目标：** 用户可以下载合成后的视频

**任务清单：**
- [ ] 集成 YouTube.js 下载视频
- [ ] 实现 FFmpeg 切割和拼接
- [ ] 实现 `/api/combine` 接口
- [ ] 前端显示合成进度和下载链接

**验收：** 在 Combine 页面拖拽 3 个片段，点击合成，下载视频

---

### Milestone 6：定时任务
**目标：** 系统自动按 Cron 表达式抓取频道

**任务清单：**
- [ ] 实现 node-cron 调度器
- [ ] 每分钟检查是否有需要执行的 KOL
- [ ] 自动触发抓取任务

**验收：** 配置 KOL 的 cron 为 `*/5 * * * *`（每 5 分钟），观察是否自动执行
