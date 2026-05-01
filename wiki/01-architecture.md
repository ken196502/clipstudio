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
| AI API | Google Gemini (`@google/genai`) | 1.x | 语义分析、摘要生成 |
| 服务端 | Express | 4.x | 可选后端 API 层 |
| 字体 | Inter / Space Grotesk / JetBrains Mono | — | 三套字体分层使用 |

---

## 项目目录结构

```
engine_vec/
├── src/
│   ├── main.tsx          # 应用入口，挂载 React 根节点
│   ├── App.tsx           # 根组件，直接渲染 Layout
│   ├── Layout.tsx        # 全局布局：侧边栏 + 主内容区 + 页面路由
│   ├── store.ts          # Zustand 全局状态 + 类型定义 + Mock 数据
│   ├── index.css         # 全局样式、自定义动画、字体导入
│   └── pages/
│       ├── Search.tsx        # 语义搜索页
│       ├── KOLManager.tsx    # KOL 管理页
│       ├── TaskMonitor.tsx   # 任务监控页
│       ├── ClipLibrary.tsx   # 片段库页
│       └── Combine.tsx       # 视频合成页
├── components/
│   └── ui/               # shadcn/ui 组件（button, dialog, input 等）
├── lib/
│   └── utils.ts          # cn() 工具函数（clsx + tailwind-merge）
├── wiki/                 # 本文档目录
├── vite.config.ts        # Vite 配置（路径别名 @、Gemini API Key 注入）
├── .env.example          # 环境变量模板
└── package.json
```

---

## 路径别名

`vite.config.ts` 中配置了 `@` 指向项目根目录：

```ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, '.'),
  },
}
```

因此 `import { Button } from '@/components/ui/button'` 等价于从根目录引入。

---

## 字体分层规范

项目使用三套字体，各有职责：

| CSS 变量 | 字体 | 使用场景 |
|----------|------|----------|
| `font-sans` | Inter | 正文、描述性文字 |
| `font-display` | Space Grotesk | 标题、按钮、导航标签 |
| `font-mono` | JetBrains Mono | 状态标签、时间戳、技术参数 |

---

## 环境变量

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `GEMINI_API_KEY` | 是 | Google Gemini API 密钥，用于 AI 处理 |
| `APP_URL` | 否 | 应用部署 URL，用于 OAuth 回调等 |

Vite 通过 `define` 将 `GEMINI_API_KEY` 注入到前端运行时：

```ts
define: {
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
}
```

---

## 部署方式

本项目托管于 **Google AI Studio**，通过 Cloud Run 自动部署。

```
AI Studio → 构建 Docker 镜像 → 推送 Cloud Run → 自动注入 GEMINI_API_KEY & APP_URL
```

本地开发：
```bash
npm run dev      # 启动 Vite 开发服务器，端口 3000，监听 0.0.0.0
npm run build    # 生产构建，输出到 dist/
npm run preview  # 预览生产构建
npm run lint     # TypeScript 类型检查（tsc --noEmit）
```

---

## 设计风格定位

UI 采用**赛博朋克 / 工业终端**风格：
- 主色调：`zinc-950`（近黑背景）+ `amber-500`（主强调色）+ `cyan-400`（搜索/状态色）
- 所有圆角使用 `rounded-sm`（2px），拒绝大圆角
- 大量使用 `font-mono` + `uppercase` + `tracking-widest` 营造终端感
- 动画：页面切换使用 blur + y 轴位移；卡片使用 scale + opacity 入场
