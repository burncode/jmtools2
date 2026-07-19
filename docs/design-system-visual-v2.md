# JMTools Visual Design System v2 — Zinc Pro

桌面生产力工具视觉规范。实现位于 `src/styles/tokens.css` 与 `src/components/shared/`。

## 色板

### 暗色（默认）

| Token | 值 | 用途 |
|-------|-----|------|
| `--app-bg` | `#09090b` | 页面底 |
| `--app-surface` | `#18181b` | 卡片/面板 |
| `--app-border` | `rgba(39,39,42,0.6)` | 极细边框 |
| `--app-text` | `#fafafa` | 主文字 |
| `--app-text-muted` | `#d4d4d8` | 次要文字 |
| `--app-text-subtle` | `#a1a1aa` | 辅助说明 |
| `--app-primary` | `#6366f1` | 主色 indigo-500 |

### 浅色

| Token | 值 |
|-------|-----|
| `--app-bg` | `#fafafa` |
| `--app-surface` | `#ffffff` |
| `--app-border` | `rgba(228,228,231,0.85)` |
| `--app-text` | `#18181b` |

## 装饰 token

- `--app-glass-bg` / `--app-glass-border`：顶栏、工具栏磨砂
- `--app-shadow-pro`：面板深度阴影
- `--app-gradient-primary-from` / `--to`：主 CTA 渐变
- `--app-grid-line`：预览区网格线
- `--app-glow-primary`：空状态霓虹光晕

## 用户强调色

实现：`src/styles/accent-palettes.css` + `applyAppAccentColor()`（`src/lib/theme.ts`）。

- 设置 → 显示 → **强调色**（blue / cyan / violet / amber / rose）写入 `html[data-accent]`
- 启动与设置变更时同步更新：`--app-primary`、`--app-accent` 及 focus / selected / gradient 衍生 token
- shadcn `--primary`、`--ring` 与 `--app-primary` 绑定，Input focus、Button primary 随强调色变化
- **不随用户强调色变化**：`SemanticSectionCard` 的 Prompt 语义分区色、资产卡片 categorical tag pill、工作流节点用户自定义色

| data-accent | 暗色 primary（示例） | 用途 |
|-------------|---------------------|------|
| blue | `#2f7df6` | 默认 |
| cyan | `#06b6d4` | |
| violet | `#8b5cf6` | |
| amber | `#f59e0b` | |
| rose | `#f43f5e` | |

## 间距

- 面板内边距默认 `--app-panel-padding: 18px`（spacious: 22px）
- 区块间距 `--app-panel-gap: 14px`
- 8px rhythm 不变

## 组件约定

| 模式 | 实现 |
|------|------|
| 磨砂顶栏 | `.app-glass-chrome` 或 `ProGlassPanel` |
| 主 CTA | `GradientPrimaryButton` |
| 空状态 | `GridPatternBackground` + `.app-empty-state` |
| Prompt 分段 | `SemanticSectionCard` accent 映射 |
| 步骤条 | `.app-progress-steps` 虚线连接 |

## Prompt 语义色块

| Section 标题前缀 | Accent |
|------------------|--------|
| Identity | violet |
| Style | cyan |
| Outfit | amber |
| Generation | emerald |
| Negative / 锚点 | zinc |

## 禁止

- 不在 feature CSS 硬编码 hex；使用 `--app-*`
- 不修改 `src/components/ui/*`
- 不做 landing page 式大 hero / 过度装饰

## Sharp Typography（深色锐利化）

实现：`src/styles/typography.css` + `tokens.css` 暗色排版 token。

### 渲染（Tauri Chromium）

- 全局使用 `text-rendering: auto`、`-webkit-font-smoothing: auto`（**不用** `antialiased` / `optimizeLegibility`，深色下会发虚）
- 磨砂容器 `.app-glass-chrome`：`blur(8px)` + 更高不透明度 `--app-glass-bg`，避免文字层被过度模糊

### 暗色 token

| Token | 值 | 说明 |
|-------|-----|------|
| `--app-font-weight-normal` | `450` | 正文比浅色 +50 |
| `--app-font-variation-body` | `"wght" 475` | Geist Variable 轴 |
| `--app-font-variation-label` | `"wght" 550` | 标签/标题 |
| `--app-letter-spacing-ui` | `0.012em` | 正文/表单 |
| `--app-letter-spacing-label` | `0.02em` | 12–13px 标签 |
| `--app-line-height` | `1.55` | 暗色正文行高 |
| `--muted-foreground` | oklch 0.78 | shadcn 次要文字同步提亮 |

### 字体栈

```
Geist Variable → Segoe UI Variable → Segoe UI → PingFang SC →
Microsoft YaHei UI → Noto Sans SC → HarmonyOS Sans SC → system-ui
```

### Tailwind 新代码建议

| 场景 | 推荐 |
|------|------|
| 正文 | `text-foreground font-medium tracking-[var(--tracking-ui)]` |
| 次要说明 | `text-muted-foreground font-medium` |
| 面板标题 | `font-semibold tracking-[var(--tracking-label)]` |
| 避免 | `font-normal text-zinc-400/500` 在深色底上 |

