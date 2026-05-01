# ENGINE_VEC — 项目 Wiki

> **ENGINE_VEC** 是一个面向内容创作者的 AI 驱动视频片段管理平台。它通过 YouTube 链接自动提取英文字幕，使用 LLM 分析生成关键片段（clips），支持语义搜索和智能组合，最终合成新视频。

---

## 📚 文档导航

| 文档 | 内容 | 状态 |
|------|------|------|
| [00-quick-reference.md](./00-quick-reference.md) | 🔥 快速参考：速查表、常用命令、调试技巧 | 📖 参考手册 |
| [01-architecture.md](./01-architecture.md) | 技术栈、项目结构、部署方式 | ✅ 已完成 |
| [02-data.md](./02-data.md) | 数据模型、实体关系、状态管理 | ✅ 已完成 |
| [03-business.md](./03-business.md) | 核心业务逻辑、处理流水线、API | ✅ 已完成 |
| [04-interaction.md](./04-interaction.md) | 前端交互设计、页面说明、UI 规范 | ✅ 已完成 |
| [05-qa.md](./05-qa.md) | 测试用例、已知问题、故障复盘 | ✅ 已完成 |
| [06-backend-design.md](./06-backend-design.md) | 后端架构、API 设计、视频处理流程 | 📝 设计文档 |
| [07-implementation-roadmap.md](./07-implementation-roadmap.md) | 实施路线图、开发优先级、时间估算 | 📝 设计文档 |

---

## 🎯 核心流程

```
用户添加 KOL 频道（如 youtube.com/@liziran）
       ↓
配置定时策略（如每天凌晨 3:00）or 手动触发
       ↓
[crawl] 抓取频道最新视频 + 提取英文字幕
       ↓
[process] 字幕按语义分段（30-90秒/段）
       ↓
[clip] OpenAI LLM 分析 → 生成标题/摘要/关键词
       ↓
[index] 保存到数据库 + 生成向量索引
       ↓
Asset Library（片段库）
       ↓
用户搜索 / Lucky Combo 智能选片
       ↓
拖拽排序 → FFmpeg 合成新视频
```

---

## 🚀 快速启动

### 前端（当前可用）

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入 OpenAI 配置

# 3. 启动开发服务器
npm run dev
# 访问 http://localhost:3000
```

### 后端（待实现）

```bash
# 1. 进入后端目录
cd server

# 2. 安装依赖
npm install

# 3. 初始化数据库
npm run db:init

# 4. 启动后端服务
npm run dev
# API 运行在 http://localhost:3001
```

**系统依赖：**
- Node.js 18+
- Redis（任务队列）
- FFmpeg（视频处理）
- yt-dlp（YouTube 下载）

---

## 📦 核心功能模块

| 模块 | 路由 key | 前端状态 | 后端状态 |
|------|----------|----------|----------|
| Synaptic Search | `search` | ✅ UI 完成 | ❌ 待实现 API |
| Target Entities | `kol` | ✅ UI 完成 | ❌ 待实现 CRUD |
| Process Monitor | `task` | ✅ UI 完成 | ❌ 待实现队列 |
| Asset Library | `clip` | ✅ UI 完成 | ❌ 待实现存储 |
| Asset Combiner | `combine` | ✅ UI 完成 | ❌ 待实现合成 |

---

## 🔧 技术栈

### 前端（已完成）
- **框架：** React 19 + TypeScript
- **构建：** Vite 6
- **样式：** Tailwind CSS 4
- **状态：** Zustand
- **动画：** Framer Motion
- **UI 组件：** shadcn/ui + Radix UI

### 后端（待实现）
- **框架：** Express.js + TypeScript
- **数据库：** SQLite（开发）/ PostgreSQL（生产）
- **任务队列：** Bull + Redis
- **LLM：** OpenAI Chat Completion API（支持自定义 baseURL）
- **视频处理：** yt-dlp + FFmpeg

---

## 🎨 设计风格

**赛博朋克 / 工业终端风格：**
- 主色调：`zinc-950`（背景）+ `amber-500`（主强调）+ `cyan-400`（搜索/状态）
- 字体分层：Inter（正文）/ Space Grotesk（标题）/ JetBrains Mono（代码/状态）
- 动画：页面切换 blur + y 轴位移，卡片 scale + opacity 入场
- 特效：光扫效果（hover-sweep）、图标抖动（wiggle）、扫描线动画

---

## 📋 开发状态

### ✅ 已完成
- [x] 前端 5 个页面 UI
- [x] Zustand 状态管理 + Mock 数据
- [x] 完整的视觉设计系统
- [x] 页面切换动画
- [x] Lucky Combo 动画序列
- [x] 拖拽排序时间轴

### 🚧 进行中
- [ ] 后端 API 基础架构（Phase 1）
- [ ] 数据库设计与初始化

### 📝 待开发
- [ ] YouTube 字幕抓取（Phase 2）
- [ ] OpenAI LLM 内容分析（Phase 2）
- [ ] 任务队列 + 进度更新（Phase 2）
- [ ] 语义搜索（Phase 3）
- [ ] Lucky Combo 智能选片（Phase 4）
- [ ] 视频合成（Phase 5）

详见 [07-implementation-roadmap.md](./07-implementation-roadmap.md)

---

## 🐛 已知问题

1. **筛选功能未实现** — Clip Library 的下拉框不过滤结果
2. **Add Entity 按钮无响应** — KOL Manager 的添加功能未实现
3. **搜索结果为硬编码** — Search 页面不根据查询词返回结果
4. **任务进度不更新** — Task Monitor 的进度条固定不动
5. **合成按钮无响应** — Combine 页面的导出功能未实现

详见 [05-qa.md](./05-qa.md)

---

## 📞 联系与贡献

- **项目类型：** AI Studio App
- **AI Studio URL：** https://ai.studio/apps/f86bdbb0-4ca6-4cf8-a94f-31495ffa83d6
- **开发周期：** 预计 10-15 周完成全部功能

**下一步行动：** 参考 [07-implementation-roadmap.md](./07-implementation-roadmap.md) 开始 Phase 1 开发
