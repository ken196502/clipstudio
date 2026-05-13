# 07 — 实施路线图

## 项目当前状态

**最后更新：** 2026-05-11

**项目类型：** 本地桌面应用（非 SaaS）

✅ **已完成（Phase 0）：**
- 前端 UI 框架（React + Tailwind + Motion）
- 4 个页面组件（Search / KOL / Task / Clip）
- Zustand 状态管理 + Mock 数据
- 完整的视觉设计系统（赛博朋克风格）
- 完整的 Wiki 文档（7 个文档）
- 页面切换动画

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
- 任务监控轮询更新
- 垂直预览功能实现
- 视频下载功能实现

✅ **已完成（Phase 2）：**
- YouTube 视频抓取（yt-dlp 集成，支持自动字幕）
- 字幕分段处理（30-90 秒语义分段）
- OpenAI 兼容 LLM 内容分析（带 Fallback 容错机制）
- 异步任务流水线（Crawl → Process → Clip → Index）
- 定时任务调度（node-cron）

✅ **已完成（Phase 3）：**
- 关键词搜索（SQL LIKE 查询）
- 前后端集成搜索页面

✅ **已完成（Phase 4）：**
- 垂直视频渲染服务
- 后端 API `/api/vertical-render`

✅ **已完成（Phase 5）：**
- 视频下载服务（yt-dlp，支持绝对路径管理）
- FFmpeg 视频切割服务（支持 reencode 保证精度）
- 垂直视频合成服务
- 垂直渲染路由集成与进度轮询
- 全流程 API 自动化验证脚本

🐛 **已修复问题：**
1. ✅ 路径管理问题（由相对路径改为绝对路径）
2. ✅ 代理配置冲突（修复空代理导致下载失败）
3. ✅ LLM API 鉴权失败时的系统崩溃问题（加入 Fallback）
4. ✅ 视频合成时的路径解析错误
5. ✅ 限流策略导致的自动化脚本失效

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
npm install express cors dotenv better-sqlite3
npm install -D typescript @types/node @types/express tsx vitest supertest
```

#### 1.2 数据库初始化
- [x] 创建 `server/src/db/schema.sql`，定义 4 张表
- [x] 编写 `server/src/db/init.ts`，自动建表

#### 1.3 API 路由实现
- [x] `GET /api/kols` — 返回 KOL 列表
- [x] `POST /api/kols` — 添加新 KOL
- [x] `GET /api/clips` — 返回片段列表（支持筛选）
- [x] `GET /api/jobs` — 返回任务列表
- [x] `POST /api/kols/:id/trigger` — 手动触发抓取任务

#### 1.4 前后端联调
- [x] 修改前端 `store.ts`，连接后端 API
- [x] 修复前端筛选、搜索、添加等交互逻辑

---

### Phase 2：视频处理流水线

**目标：** 实现从 YouTube URL 到生成 Clips 的完整流程。

#### 2.1 YouTube 数据抓取
- [x] 安装 `youtube-dl-exec`：`npm install youtube-dl-exec`
- [x] 实现 `server/src/services/youtube.ts`：
  - 支持 `yt-dlp` 抓取频道视频列表
  - 支持提取手动字幕及自动生成字幕 (`writeAutoSub`)
- [x] 实现去重与 KOL 自动关联逻辑

#### 2.2 字幕分段处理
- [x] 实现 `server/src/services/segmenter.ts`：
  - 30-90 秒语义窗口切分
  - VTT 格式解析

#### 2.3 LLM 内容分析
- [x] 实现 `server/src/services/llm.ts`：
  - 基于 REST API 的内容分析
  - **Fallback 机制**：确保 API 失效时系统仍能运行
- [x] 批量处理与并发控制

#### 2.4 定时任务与异步处理
- [x] 实现 `server/src/services/scheduler.ts`：
  - 基于 `node-cron` 的分钟级扫描
- [x] 实现异步 `processJob` 流水线

---

### Phase 3：搜索与智能选片

**目标：** 实现片段检索与 Lucky Combo 逻辑。

#### 3.1 搜索功能
- [x] 实现 `/api/clips/search`（关键词评分匹配）
- [x] 前端 Search 页面集成

#### 3.2 视频合成 (Combine)
- [x] 实现 `/api/combine` 接口：
  - 支持多个 clip 按顺序拼接
  - 支持 portrait 9:16 模式（模糊背景+文字覆盖）
  - 前端 Combine 页面支持拖拽排序

---

### Phase 5：物理合成服务

**目标：** 真正实现视频的切分与拼接。

#### 5.1 视频下载
- [x] 实现 `server/src/services/downloader.ts`
- [x] 解决 YouTube 鉴权与代理配置问题

#### 5.2 FFmpeg 切割与拼接
- [x] 实现 `server/src/services/ffmpeg.ts`：
  - `extractClip` (reencode)
  - `combineClips` (reencode)
- [x] 解决跨目录路径拼接错误（使用绝对路径）

#### 5.3 任务状态与进度
- [x] 内存中管理 `combineTasks` 状态
- [x] 前端轮询任务进度，展示处理阶段

---

## 技术栈总结

| 层级 | 技术选型 | 理由 |
|------|----------|------|
| 前端 | React + Zustand | 已完成，轻量高效 |
| 后端 | Express.js + tsx | 极速开发与部署 |
| 数据库 | SQLite (WAL mode) | 零配置，支持并发读取 |
| 异步处理 | 原生 Promise + Async | 无需 Redis，适合内部轻量使用 |
| 视频处理 | yt-dlp + FFmpeg | 行业顶尖处理方案 |
| AI API | OpenAI API | 灵活可控，严格模式（失败即报错） |

---

## 开发优先级

### 🔴 P0（核心功能，必须实现）
1. ✅ **后端 API 基础架构** — Express.js + TypeScript + SQLite
2. ✅ **数据库设计与初始化** — 4 张表（kols, videos, clips, jobs）
3. ✅ **前后端联调** — 替换 Mock 数据为 API 调用
4. ✅ **YouTube 字幕抓取** — youtube-dl-exec 集成
5. ✅ **OpenAI LLM 字幕切分** — 只返回 title + 时间段，程序按时间戳提取字幕

### 🟡 P1（重要功能，尽快实现）
6. ✅ **任务队列 + 进度更新** — 异步 Promise + 轮询
7. ✅ **基础搜索（关键词匹配）** — SQL LIKE 查询
8. ✅ **视频合成** — FFmpeg 切割和拼接
9. ✅ **定时任务调度** — node-cron

### 🟢 P2（优化功能，后续迭代）
10. ✅ **垂直视频渲染** — Puppeteer 截图 + FFmpeg filter_complex 合成
11. ✅ **视频合成** — FFmpeg 切割和拼接（支持 portrait 9:16 模式）
12. [ ] **向量搜索** — OpenAI Embeddings + 余弦相似度
13. [ ] **缩略图生成** — FFmpeg 截图
14. [ ] **视频预览** — 在线播放片段
15. [ ] **用户系统** — 多用户隔离（本地应用可能不需要）
16. [ ] **批量导入 KOL 频道** — 批量添加功能

### 🔵 P3（增强功能，长期规划）
16. ✅ **前端已知问题修复** — 筛选、Add Entity、搜索结果等
17. [ ] **性能优化** — 缓存、数据库索引
18. [ ] **本地打包部署** — Tauri 打包为桌面应用
19. [ ] **配置管理界面** — 用户配置 API 密钥和存储路径
20. [ ] **本地文件管理** — 文件浏览器和清理功能

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
- [x] 集成 yt-dlp，实现频道视频列表抓取
- [x] 实现字幕提取和 VTT 解析
- [x] 集成 OpenAI API，实现 LLM 字幕切分（严格模式，无 Fallback）
- [x] 实现 4 个 stage 依次执行的异步流水线
- [x] Task Monitor 页面实时显示进度

**验收：** 在 KOL Manager 点击 EXECUTE，Task Monitor 显示进度，完成后 Clip Library 出现新片段

---

### Milestone 3：搜索功能
**目标：** 用户可以通过关键词搜索相关片段

**任务清单：**
- [x] 实现 `/api/clips/search` 接口（关键词匹配）
- [x] 前端 Search 页面调用 API
- [x] 实现筛选功能（KOL、分类）
- [ ] （可选）实现向量搜索

**验收：** 输入"AI 职业"，返回相关片段

---

### Milestone 4：垂直视频渲染
**目标：** 实现竖屏视频渲染和下载功能

**任务清单：**
- [x] 实现 Puppeteer + FFmpeg 竖屏渲染服务
- [x] 实现 `/api/clips/vertical-render` 接口
- [x] 前端 Clip Library 集成竖屏预览和下载
- [x] 调度器后台自动预渲染

**验收：** 在 Clip Library 点击下载，生成带标题和字幕的 9:16 竖屏视频

---

### Milestone 5：视频合成
**目标：** 用户可以下载合成后的视频

**任务清单：**
- [x] 集成 YouTube.js 下载视频
- [x] 实现 FFmpeg 切割和拼接
- [x] 实现 `/api/combine` 接口
- [x] 前端显示合成进度和下载链接

**验收：** 在 Combine 页面拖拽 3 个片段，点击合成，下载视频

---

### Milestone 6：定时任务
**目标：** 系统自动按 Cron 表达式抓取频道

**任务清单：**
- [x] 实现 node-cron 调度器
- [x] 每分钟检查是否有需要执行的 KOL
- [x] 自动触发抓取任务

**验收：** 配置 KOL 的 cron 为 `*/5 * * * *`（每 5 分钟），观察是否自动执行

---

### Milestone 7：本地打包与部署
**目标：** 将应用打包为本地可执行文件

**任务清单：**
- [ ] 选择打包方案（Electron 或 Tauri）
- [ ] 配置打包脚本
- [ ] 实现本地数据存储路径管理
- [ ] 测试打包后的应用功能
- [ ] 生成安装包（.dmg/.exe/.AppImage）

**验收：** 用户可以下载并安装应用，无需配置开发环境即可使用

---


---

## 本地部署方案

### 技术选型

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| Electron | 成熟稳定、跨平台、生态丰富 | 体积大（~150MB）、资源占用高 | ⭐⭐⭐ |
| Tauri | 体积小（~10MB）、性能好、安全性高 | 配置复杂、Rust 学习曲线 | ⭐⭐⭐⭐⭐ |

**推荐使用 Tauri**，原因：
1. 体积小，用户体验好
2. 性能优异，适合视频处理场景
3. 安全性高，适合本地数据处理
4. 与前端技术栈（React + Vite）集成良好

### Tauri 集成步骤

#### 1. 安装依赖
```bash
# 安装 Rust（Tauri 依赖）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Tauri CLI
npm install -D @tauri-apps/cli

# 初始化 Tauri
npm run tauri init
```

#### 2. 配置 Tauri
```json
// src-tauri/tauri.conf.json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:3000",
    "distDir": "../dist"
  },
  "tauri": {
    "bundle": {
      "identifier": "com.enginevec.app",
      "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"]
    },
    "allowlist": {
      "fs": {
        "all": true,
        "scope": ["$APPDATA/**", "$DOCUMENT/**", "$DOWNLOAD/**"]
      },
      "shell": {
        "all": false,
        "open": true
      }
    }
  }
}
```

#### 3. 本地数据存储
```typescript
// 使用 Tauri API 获取本地路径
import { appDataDir, downloadDir } from '@tauri-apps/api/path';

const appDataPath = await appDataDir();
const downloadPath = await downloadDir();

// 配置后端使用本地路径
process.env.STORAGE_PATH = `${appDataPath}/storage`;
process.env.DATABASE_URL = `${appDataPath}/engine_vec.db`;
```

#### 4. 打包命令
```bash
# 开发模式
npm run tauri dev

# 构建生产版本
npm run tauri build

# 构建结果
# macOS: src-tauri/target/release/bundle/dmg/
# Windows: src-tauri/target/release/bundle/msi/
# Linux: src-tauri/target/release/bundle/appimage/
```

### 本地数据管理

#### 数据库路径
```typescript
// 开发环境
DATABASE_URL="./data/engine_vec.db"

// 生产环境（Tauri）
DATABASE_URL="$APPDATA/engine_vec.db"
```

#### 视频存储路径
```typescript
// 开发环境
STORAGE_PATH="./storage"

// 生产环境（Tauri）
STORAGE_PATH="$DOCUMENT/engine_vec/storage"
```

#### 配置文件
```typescript
// 配置文件路径
CONFIG_PATH="$APPDATA/engine_vec/config.json"

// 默认配置
{
  "OPENAI_BASE_URL": "https://api.openai.com/v1",
  "OPENAI_API_KEY": "",
  "OPENAI_MODEL": "gpt-4o-mini",
  "ENABLE_SCHEDULER": true,
  "MAX_VIDEO_SIZE_MB": 500
}
```

### 本地功能增强

#### 1. 配置管理界面
- 添加设置页面，允许用户配置：
  - OpenAI API 密钥
  - 代理设置
  - 存储路径
  - 定时任务策略

#### 2. 本地文件管理
- 添加文件浏览器，查看：
  - 已下载的视频
  - 生成的片段
  - 合成的视频
- 支持删除和清理功能

#### 3. 导入导出
- 支持导出数据库备份
- 支持导入配置和片段库
- 支持导出为 JSON 格式
