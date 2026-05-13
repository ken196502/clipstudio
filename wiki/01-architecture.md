# 01 — 架构总览

## 技术栈

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | React | 19.x | UI 渲染 |
| 语言 | TypeScript | 5.8.x | 类型安全 |
| 构建工具 | Vite | 6.x | 开发服务器 & 打包 |
| 样式 | Tailwind CSS | 4.x | 原子化 CSS |
| 状态管理 | Zustand | 5.x | 全局状态 |
| 动画 | Motion (Framer Motion) | 12.x | 页面/组件动画 |
| UI 组件库 | shadcn/ui + Radix UI | — | 无障碍基础组件 |
| 图标 | Lucide React | 0.546.x | SVG 图标集 |
| AI API | OpenAI 兼容 API (`fetch`) | — | LLM 字幕切分（严格模式：失败即报错） |
| 服务端 | Express | 4.x | 核心业务逻辑、任务调度、视频处理 |
| 数据库 | SQLite | 3.x | 数据持久化（KOLs, Videos, Clips, Jobs） |
| 视频处理 | FFmpeg + yt-dlp | — | 视频下载、切片、合成 |
| 字体 | Inter / Space Grotesk / JetBrains Mono | — | 三套字体分层使用 |

---

## 项目目录结构

```
engine_vec/
├── src/                  # 前端源代码 (Vite + React)
│   ├── store.ts          # Zustand 全局状态 + API 调用封装
│   └── pages/            # 页面组件
├── server/               # 后端源代码 (Express + TypeScript)
│   ├── src/
│   │   ├── db/           # 数据库初始化与 Schema
│   │   ├── routes/       # API 路由 (Kols, Clips, Jobs)
│   │   ├── services/     # 业务逻辑 (YouTube, LLM, FFmpeg, Vertical Renderer)
│   │   └── index.ts      # 后端入口
│   └── data/             # SQLite 数据库文件
├── data/                 # 测试数据 (如 testKOL.txt)
├── storage/              # 视频文件存储 (videos, temp, output)
├── wiki/                 # 项目文档
├── vite.config.ts        # 前端配置
└── package.json          # 全项目依赖
```

---

## 环境变量 (server/.env)

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `OPENAI_API_KEY` | 是 | LLM API 密钥（用户配置） |
| `OPENAI_BASE_URL` | 否 | LLM API 代理地址 |
| `OPENAI_MODEL` | 否 | 使用的 LLM 模型名 |
| `DATABASE_URL` | 否 | SQLite 数据库路径 (默认 ./data/engine_vec.db) |
| `STORAGE_PATH` | 否 | 视频存储根路径 (默认 ./storage) |
| `HTTPS_PROXY` | 否 | 用于 YouTube 下载的代理 |
| `ENABLE_SCHEDULER` | 否 | 是否启用定时任务 (默认 true) |
| `SCHEDULER_CHECK_INTERVAL` | 否 | 调度器检查间隔 (默认 * * * * *) |

本地开发：
```bash
npm run dev      # 启动 Vite 开发服务器，端口 3000，监听 0.0.0.0
npm run build    # 生产构建，输出到 dist/
npm run preview  # 预览生产构建
npm run lint     # TypeScript 类型检查（tsc --noEmit）
```

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

---

## 设计风格定位

UI 采用**赛博朋克 / 工业终端**风格：
- 主色调：`zinc-950`（近黑背景）+ `amber-500`（主强调色）+ `cyan-400`（搜索/状态色）
- 所有圆角使用 `rounded-sm`（2px），拒绝大圆角
- 大量使用 `font-mono` + `uppercase` + `tracking-widest` 营造终端感
- 动画：页面切换使用 blur + y 轴位移；卡片使用 scale + opacity 入场
