# 04 — 前端交互

## 全局布局（Layout.tsx）

### 侧边栏

侧边栏支持展开/收起，宽度通过 Framer Motion 动画过渡：

```
展开状态：width = 256px，显示文字标签
收起状态：width = 64px，仅显示图标
```

**自动收起规则：** 进入 `combine`（合成）页面时，侧边栏自动收起，为时间轴腾出空间：
```ts
useEffect(() => {
  if (activePage === 'combine') {
    setIsSidebarOpen(false);
  } else {
    setIsSidebarOpen(true);
  }
}, [activePage]);
```

**导航项：**

| 图标 | 标签 | page key |
|------|------|----------|
| Search | SYNAPTIC SEARCH | `search` |
| Users | TARGET ENTITIES | `kol` |
| Activity | PROCESS MONITOR | `task` |
| Film | VERTICAL CLIPS | `clip` |

> `combine` 页面不在导航栏中，通过 Clip Library 详情弹窗或其他页面跳转进入。

**激活状态样式：**
- 左侧 2px amber-500 边框
- 背景 `zinc-900`
- 右侧 amber-500 小方块指示器（仅展开时显示）

### 页面切换动画

```ts
// AnimatePresence + motion.div，key = activePage
initial: { opacity: 0, y: 10, filter: 'blur(5px)' }
animate: { opacity: 1, y: 0, filter: 'blur(0px)' }
exit:    { opacity: 0, y: -10, filter: 'blur(5px)' }
transition: { duration: 0.3 }
```

---

## 页面交互详解

### Search 页（语义搜索）

**两种状态：**

1. **初始状态**（`hasSearched = false`）：
   - 内容垂直居中（`justify-center`）
   - 搜索框居中展示，下方有 LUCKY COMBO 按钮

2. **搜索后状态**（`hasSearched = true`）：
   - 搜索框固定在顶部（带底部分割线）
   - 下方展示结果列表（ScrollArea 滚动）
   - 布局切换通过 `motion layout` 动画完成

**搜索框交互：**
- 聚焦时外层出现 cyan-500/20 模糊光晕（`group-hover` 触发）
- 边框颜色从 `zinc-700/80` 变为 `cyan-400`（`focus-within`）
- 提交按钮在 searching 状态下显示"PROCESSING + 脉冲图标"，通过 `AnimatePresence mode="wait"` 切换

**Lucky Combo 全屏动画：**
- 固定定位覆盖全屏，背景 `zinc-950/90` + `backdrop-blur-12px`
- 三步动画，每步 3 秒，使用打字机效果展示文字
- 图标持续旋转（`animate={{ rotate: 360 }}`，4s 无限循环）
- 步骤切换：`x: 200 → 0 → -200`（滑入滑出）
- 右上角 X 按钮可随时关闭（`setComboStep(-1)`）

**打字机组件（TypewriterText）：**
```ts
// 每 40ms 显示一个字符，延迟 400ms 后开始
// 依赖 text prop 变化重置
```

---

### KOL Manager 页（目标实体）

**表格行交互：**
- hover 时行背景变为 `zinc-800/30`
- 每行入场动画：`x: -20 → 0`，按 index 延迟（`delay: idx * 0.1`）

**编辑弹窗（Dialog）：**
- 触发：点击"CONFIG"按钮，`setEditingKol(kol)` 存入本地 state
- 表单字段：Source URI、Cron Schedule
- 保存：调用 `updateKOL(editingKol.id, editingKol)`，关闭弹窗
- 取消：直接 `setEditingKol(null)`

---

### Task Monitor 页（进程监控）

**双区域布局：**
- 上方"Active Threads"：仅展示 `status === 'running'` 的任务
- 下方"Execution Log"：展示所有非 running 任务

**空状态：** 无活跃任务时显示虚线边框 + "IDLE // NO ACTIVE THREADS"

**进度条：** Framer Motion 动画，从 0 宽度动画到 `${job.progress}%`，带 cyan 发光效果

**RETRY 按钮：** 仅在 `status === 'failed'` 的行末尾显示（当前为 UI 展示）

---

### Clip Library 页（片段库）

**网格布局：** 响应式 1/2/3/4 列（`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`）

**卡片交互：**
- hover 时：上移 1px（`hover:-translate-y-1`）、边框变 amber-500/50、封面图 scale 放大
- 封面图混合模式：默认 `mix-blend-luminosity`（去色），hover 后 `mix-blend-normal`（彩色）
- 四角装饰线：hover 时显示 amber-500 角标（CSS border trick）
- 光扫效果：`.hover-sweep::before` 伪元素从左到右扫过

**卡片入场动画：**
```ts
initial: { opacity: 0, scale: 0.9, y: 20 }
animate: { opacity: 1, scale: 1, y: 0 }
transition: { delay: idx * 0.05, duration: 0.3 }
```

**详情弹窗：**
- 左侧播放区：封面图 + 模拟播放控件（进度条固定 30%）
- 右侧信息区：来源、标题、时间段
- 底部：COPY REF + EXTRACT 两个操作按钮

---

### Combine 页（视频合成）

**时间轴设计：**
- 水平滚动容器，左右各有 `px-[50vw]` 的内边距，使内容可以滚动到中心
- 中心固定播放头：`left-1/2` 的 amber-500 竖线，带发光效果
- 背景：64px 网格线（`bg-[linear-gradient(...)]`）

**拖拽排序：**
```tsx
<Reorder.Group axis="x" values={timeline} onReorder={setTimeline}>
  {timeline.map(clip => (
    <Reorder.Item key={clip.id} value={clip}>
      {/* 卡片内容 */}
    </Reorder.Item>
  ))}
</Reorder.Group>
```

**删除交互：**
- 垃圾桶按钮默认隐藏（`opacity-0`），hover 时显示（`group-hover:opacity-100`）
- 点击时 `e.stopPropagation()` 阻止触发拖拽

**合成按钮：**
- 大尺寸（`h-16 px-12`），带 shimmer 光效动画
- hover 时：scale 放大 + 右箭头图标滑入（`opacity-0 -mr-6 → opacity-100 mr-0`）

---

## 全局 CSS 动画效果

| 类名 | 效果 | 触发方式 |
|------|------|----------|
| `.hover-fx` | 底部下划线从右到左展开 + scale 1.05 | `:hover` |
| `.hover-sweep` | 白色光带从左到右扫过 | `:hover` |
| `.group-hover-wiggle` | 图标抖动 + 发光 | 父元素 `.group:hover` |
| `.shimmer` | 45° 光泽流动 | 持续动画 |
| `animate-[scan_2s_...]` | 扫描线从上到下循环 | 持续动画 |

---

## 无障碍说明

- 所有交互按钮使用语义化 `<button>` 或 shadcn `<Button>` 组件
- Dialog 组件基于 Radix UI，自动管理焦点陷阱和 ARIA 属性
- 图标按钮通过 `title` 属性提供文字说明（侧边栏收起时）
- 颜色对比：amber-500 on zinc-950 满足 WCAG AA 对比度要求

> ⚠️ 完整无障碍验证需配合屏幕阅读器（如 VoiceOver）进行手动测试。
