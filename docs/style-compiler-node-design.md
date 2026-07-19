# 风格编译器节点设计（Style Compiler）

JMTools 将 `character.styleProfile` 定位为**引用风格资产**节点：节点只保存 `presetId` 与可选局部覆盖；完整 Visual DNA / 调色 / 光照 / 约束在**风格预设库**独立窗口编辑。

## 三层分工（当前）

| 区域 | 职责 |
|------|------|
| **独立窗口** `style-preset-library` | 浏览全部预设、新建/保存用户预设、六 Tab 完整编辑 |
| **画布节点卡片** | 缩略图 + Render / 色板 / 光照 / 一致性摘要 |
| **右侧 Inspector** | 常用预设 2 列快选、「全部预设 >」、节点覆盖参数（启用局部覆盖 + 4 滑条） |

## 数据

- 内置预设：`shared/style-presets/*.json`，首次启动写入应用级 SQLite `jmtools.db` → `style_presets`
- 用户预设：同表，`is_builtin = 0`，Tauri commands `list/save/delete_style_preset`
- 节点 params（新）：`presetId`、`enableLocalOverride`、`styleWeight`、`consistencyStrength`、`referenceStrength`、`negativeConstraintStrength`
- 旧工作流：节点若仍带 inline `renderType` 等字段，Rust 编译器走 legacy 路径，Inspector 显示「内联参数模式」

## 画布节点线框

```text
┌─ 引用风格资产 ───────────────┐
│ 像素复古 16 色            ●  │
│ [缩略图]                     │
│ 渲染   像素                  │
│ 色板   16 色                 │
│ 光照   平光                  │
│ 一致性 85%                   │
│              styleProfile ○  │
└──────────────────────────────┘
```

## 风格预设库 Inspector Tab（独立窗口）

1. **概览**：艺术参考、配色主题
2. **视觉基因**：渲染类型、像素密度、边缘风格、四维滑条（带 hint）
3. **调色系统**：模式、最大色数、强度、抖动、色板网格编辑
4. **光照模型**：光照类型、阴影/高光/环境光
5. **约束**：色板锁、线稿锁、身份锁、一致性强度
6. **输出预览**：`stylePrompt`、负向建议、`styleProfile` JSON

## 图级控制（不变）

| 区域 | 职责 |
|------|------|
| 图级 control 节点 | `control.consistencyLock` 等；与 style 内 constraints merge，control 优先 |

## styleProfile Asset 字段

见 [`workflow-character-asset-schema.md`](workflow-character-asset-schema.md)。

## 与 Prompt Compiler 接口

```text
styleProfile.stylePrompt        → AST slot "style"
styleProfile.negativeHints[]    → 追加 negative segments
styleProfile.constraints        → merge 进 controlSignals（controlProfile 优先）
styleProfile.palette.colors     → controlSignals.palette（可选）
```

## 内置预设

| id | 说明 |
|----|------|
| `pixel_retro_16` | 16 色像素复古 |
| `anime_cel` | 赛璐璐动漫 |
| `realistic_soft` | 柔光写实 |
| `hand_paint` | 手绘风格 |
| `low_poly_flat` | 低模平光 |

文件位于 [`shared/style-presets/`](../shared/style-presets/)。

## 向后兼容

旧 workflow 仅含 `styleType` / `artReference` / `colorTheme` 时，Rust 编译器填默认 nested 字段并生成 `stylePrompt`。

## 推迟（Phase 2+）

- `referenceImage` 端口连线与自动色板提取
- 项目级 `.jmstyle` preset CRUD
- Inspector 显示已连接 control 节点的 effective flags
