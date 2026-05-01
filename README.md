<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ENGINE_VEC — AI 视频片段管理平台

> 通过 YouTube 链接自动提取字幕，使用 LLM 分析生成关键片段，支持语义搜索和智能组合，最终合成新视频。

[![AI Studio](https://img.shields.io/badge/AI%20Studio-App-blue)](https://ai.studio/apps/f86bdbb0-4ca6-4cf8-a94f-31495ffa83d6)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8)](https://tailwindcss.com/)

---

## ✨ 核心功能

- 🎬 **YouTube 频道订阅** — 添加 YouTuber 频道，配置定时抓取策略（Cron）
- 🤖 **自动字幕提取** — 使用 YouTube.js 提取视频英文字幕
- 🧠 **LLM 智能分析** — 使用 OpenAI API 生成片段标题、摘要、关键词
- ⏰ **定时任务调度** — 根据 Cron 表达式自动抓取频道最新视频
- 🔍 **语义搜索** — 通过自然语言查询相关视频片段
- ✨ **Lucky Combo** — AI 根据 Prompt 自动挑选并组合片段
- 🎞️ **视频合成** — 拖拽排序片段，FFmpeg 合成新视频
- 📊 **任务监控** — 实时查看处理流水线进度

---

## 🚀 快速启动

### 前端（当前可用）

**Prerequisites:** Node.js 18+

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env.local

# 编辑 .env.local，填入以下配置：
# OPENAI_BASE_URL="https://api.openai.com/v1"
# OPENAI_API_KEY="sk-your-api-key"
# OPENAI_MODEL="gpt-4o-mini"

# 3. 启动开发服务器
npm run dev
```

访问 http://localhost:3000

### 后端（待实现）

后端功能正在开发中，详见 [wiki/07-implementation-roadmap.md](wiki/07-implementation-roadmap.md)

---

## 📚 完整文档

所有设计文档位于 `wiki/` 目录：

| 文档 | 内容 |
|------|------|
| [README.md](wiki/README.md) | 项目概览、导航、快速启动 |
| [01-architecture.md](wiki/01-architecture.md) | 技术栈、目录结构、部署方式 |
| [02-data.md](wiki/02-data.md) | 数据模型、ER 图、状态管理 |
| [03-business.md](wiki/03-business.md) | 业务逻辑、流水线、API 设计 |
| [04-interaction.md](wiki/04-interaction.md) | 前端交互、动画、UI 规范 |
| [05-qa.md](wiki/05-qa.md) | 测试用例、已知问题 |
| [06-backend-design.md](wiki/06-backend-design.md) | 后端架构、视频处理流程 |
| [07-implementation-roadmap.md](wiki/07-implementation-roadmap.md) | 实施路线图、开发优先级 |

---

## 🎨 技术栈

### 前端
- React 19 + TypeScript
- Vite 6（构建工具）
- Tailwind CSS 4（样式）
- Zustand（状态管理）
- Framer Motion（动画）
- shadcn/ui + Radix UI（组件库）

### 后端（待实现）
- Express.js + TypeScript
- SQLite / PostgreSQL
- Bull + Redis（任务队列）
- node-cron（定时任务调度）
- OpenAI API（LLM 分析）
- YouTube.js（视频信息和字幕提取）
- yt-dlp + FFmpeg（视频处理）

---

## 📦 项目结构

```
engine_vec/
├── src/
│   ├── pages/          # 5 个页面组件
│   ├── store.ts        # Zustand 全局状态
│   └── Layout.tsx      # 全局布局
├── components/ui/      # shadcn/ui 组件
├── wiki/               # 完整设计文档
├── server/             # 后端代码（待创建）
└── .env.example        # 环境变量模板
```

---

## 🛠️ 开发命令

```bash
npm run dev      # 启动开发服务器（端口 3000）
npm run build    # 生产构建
npm run preview  # 预览生产构建
npm run lint     # TypeScript 类型检查
```

---

## 📋 开发状态

### ✅ 已完成
- [x] 前端 UI 框架（5 个页面）
- [x] 状态管理 + Mock 数据
- [x] 完整的视觉设计系统
- [x] 页面切换动画
- [x] Lucky Combo 动画序列
- [x] 拖拽排序时间轴

### 🚧 进行中
- [ ] 后端 API 基础架构
- [ ] 数据库设计

### 📝 待开发
- [ ] YouTube 字幕抓取
- [ ] OpenAI LLM 内容分析
- [ ] 任务队列 + 进度更新
- [ ] 语义搜索
- [ ] 视频合成

**预计完成时间：** 10-15 周

---

## 🐛 已知问题

1. 筛选功能未实现（Clip Library 下拉框）
2. Add Entity 按钮无响应
3. 搜索结果为硬编码
4. 任务进度不实时更新
5. 合成按钮无响应

详见 [wiki/05-qa.md](wiki/05-qa.md)

---

## 📞 链接

- **AI Studio App:** https://ai.studio/apps/f86bdbb0-4ca6-4cf8-a94f-31495ffa83d6
- **完整文档:** [wiki/README.md](wiki/README.md)
- **实施路线图:** [wiki/07-implementation-roadmap.md](wiki/07-implementation-roadmap.md)
