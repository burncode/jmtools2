# JMTools 角色生产线规划

本文用于承接 `cankao/character_generation_system_design.md` 中的角色生成系统建议，并结合 JMTools 当前 Tauri + React + Rust + shadcn/ui + PixiJS 架构，定义后续角色工坊的落地路线。

## 目标定位

角色工坊不只是“生成一张角色图”，而是生成一个可以继续制作动作、视图、导出包并进入游戏引擎的结构化角色资产。

核心分工：

- AI：生成视觉内容、候选方案、动作关键帧和提示词建议。
- Rust：负责文件落盘、项目索引、图像处理、去背景、规范化、质量检测和导出。
- React UI：把角色设定、生成参数、预览状态、处理工具和导出配置可视化。
- PixiJS：只负责预览、动画播放、帧序列检查和后续编辑器画布，不作为导出格式。

## 当前状态

已经具备：

- `CharacterWorkshopDraft`：角色生成表单草稿，包含风格、画布、视图、特色元素、主色调、参考图和高级生成参数。
- `CharacterMasterPlan`：AI 文本生成的结构化母版方案（创建流走 Rust `generate_character_master_plan`，与节点对齐）。
- `CharacterAssetRecord`：角色入库后的资产记录，包含母版图、动作建议、候选方案信息、关键词、调色和导出建议。
- Rust `character/` 域模块 + `commands/characters/` 薄入口：候选图生成、角色入库、去背景、规范化、预检、动作帧、导出等；**拆分进行中**（原 `characters.rs` 单体 ~6500 行 → `character/{model,store,prompt,generation,actions,workflow}`）。
- **角色工坊重构（2026-06）**：资产库 → 创建工作室（五步向导）→ 生产工作室（五 Tab）；`characterWorkshopStore` + TanStack Query；与工作流双向跳转。
- 动作生产页已接入 PixiJS 预览、真实动作帧生成与 PNG/JSON/Godot 导出。
- 应用设置已有 AI 模型用途绑定，角色文本生成和角色图像生成可以走后台配置。

主要缺口（后续迭代）：

- ~~`characters.rs` 主体仍较大~~ → 见 `.cursor/rules/rust-commands-boundaries.mdc` 与 `src-tauri/src/character/` 拆分计划。
- Spritesheet/atlas 完整导出链仍优先在工作流 `atlasPack` 节点完成。
- Onion skin、跨视图一致性自动 QC、E2E 冒烟测试待补。

## 推荐数据模型演进

不要一次性推翻当前 `CharacterAssetRecord`。建议向后兼容地扩展为：

```ts
interface CharacterAssetRecord {
  // existing fields...
  config?: CharacterGenerationConfig;
  views?: CharacterViewAsset[];
  processing?: CharacterProcessingMetadata;
  exportProfiles?: CharacterExportProfile[];
}
```

### CharacterGenerationConfig

保存“为什么这样生成”，用于重生成、派生视图和动作一致性控制。

```ts
interface CharacterGenerationConfig {
  version: 1;
  identity: {
    name: string;
    role?: "hero" | "npc" | "enemy" | "boss" | "pet";
    tags: string[];
  };
  visual: {
    style: string;
    size: string;
    direction: "single" | "four" | "eight";
    featureTags: string[];
    palette: string[];
    backgroundMode: "checker" | "chroma" | "solid" | "transparent";
  };
  generation: {
    providerName: string;
    model: string;
    seed?: number;
    quality: "快速" | "标准" | "高质量";
    count: number;
    options: string[];
    prompt: string;
    negativePrompt?: string;
  };
  references: CharacterReferenceImageAsset[];
}
```

### CharacterViewAsset

保存视图资产，而不是只保存一张母版图。

```ts
interface CharacterViewAsset {
  id: string;
  kind: "front" | "side" | "back" | "threeQuarter" | "single";
  rawImage?: CharacterImageAsset;
  transparentImage?: CharacterImageAsset;
  normalizedImage?: CharacterImageAsset;
  anchor?: AnchorPoint;
  bbox?: BoundingBox;
  quality?: CharacterViewQualityReport;
}
```

### CharacterProcessingMetadata

保存图像处理结果，支撑后续动作不抖动。

```ts
interface CharacterProcessingMetadata {
  backgroundRemoved: boolean;
  normalized: boolean;
  canvas: { width: number; height: number };
  anchorMode: "bottomCenter" | "center" | "custom";
  anchor?: AnchorPoint;
  bbox?: BoundingBox;
  footLineY?: number;
  warnings: string[];
}
```

### CharacterExportProfile

保存导出配置，避免导出设置散落在 UI 状态中。

```ts
interface CharacterExportProfile {
  id: string;
  target: "png-sequence" | "spritesheet" | "generic-json" | "godot";
  frameWidth: number;
  frameHeight: number;
  fps: number;
  padding: number;
  spacing: number;
  trim: boolean;
}
```

## 推荐项目目录

当前项目已有：

```text
assets/characters/<character_id>/character.json
assets/characters/index.json
```

下一阶段建议演进为：

```text
assets/characters/<character_id>/
├─ character.json
├─ config/
│  └─ generation.json
├─ raw/
│  ├─ candidate_a.png
│  └─ candidate_b.png
├─ processed/
│  ├─ master_transparent.png
│  └─ master_normalized.png
├─ views/
│  ├─ front.png
│  ├─ side.png
│  └─ back.png
├─ animations/
│  ├─ idle/
│  ├─ walk/
│  └─ attack/
├─ exports/
│  ├─ spritesheet.png
│  ├─ atlas.json
│  └─ godot/
└─ cache/
```

落地原则：

- `character.json` 是角色资产主记录。
- `config/generation.json` 是可重放的生成配置。
- `raw` 保存 AI 原始输出。
- `processed` 保存去背景、裁剪、规范化结果。
- `views` 保存多视图。
- `animations` 保存动作帧。
- `exports` 保存导出产物。
- SQLite 只做索引和查询缓存，不直接存大图。

## Rust 架构演进

当前 `src-tauri/src/commands/characters.rs` 已经承担过多职责。后续建议拆为：

```text
src-tauri/src/
├─ commands/
│  └─ characters.rs          # Tauri command 入出口
├─ character/
│  ├─ mod.rs
│  ├─ model.rs               # 角色数据结构
│  ├─ store.rs               # JSON + SQLite 读写
│  ├─ generation.rs          # 生成任务编排
│  └─ manifest.rs            # character.json schema / migration
├─ image_pipeline/
│  ├─ mod.rs
│  ├─ alpha.rs               # Alpha 清理
│  ├─ normalize.rs           # 裁剪、缩放、画布统一
│  ├─ anchor.rs              # bbox / 脚底线 / anchor
│  └─ quality.rs             # 基础质量检测
└─ export/
   ├─ mod.rs
   ├─ spritesheet.rs
   ├─ generic_json.rs
   └─ godot.rs
```

拆分顺序：

1. 先抽 `character/model.rs`，移动 Rust 结构体。
2. 再抽 `character/store.rs`，移动角色 JSON、index、SQLite 读写。
3. 保持 `commands/characters.rs` 只做参数校验、日志、调用服务和返回错误。
4. 后续新增图像处理时放到 `image_pipeline`，不继续堆在 command 文件中。

## Prompt Builder 演进

当前 `src/features/characters/services/characterPlanGeneration.ts` 已包含 Prompt 拼接和结果解析。后续建议拆成：

```text
src/features/characters/services/
├─ characterPromptBuilder.ts
├─ characterPlanParser.ts
├─ characterGenerationConfig.ts
└─ characterPlanGeneration.ts
```

目标：

- UI 不直接拼 Prompt。
- Prompt 来自 `CharacterGenerationConfig`。
- 参考图、特色元素、像素风格、背景模式、生成视图、高级参数都进入 Prompt Builder。
- 文本方案生成和图像生成共享同一份结构化配置。

## 阶段路线

### Phase 1：角色资产结构化

目标：让入库角色不只是图片和文字，而是可继续处理的角色资产包。

任务：

- 扩展前端 `CharacterAssetRecord` 类型，增加 `config / views / processing / exportProfiles` 可选字段。
- Rust `CharacterAssetRecord` 同步 serde 默认字段，保证旧数据可读。
- 创建 `config/generation.json`。
- 保存 AI 原始候选图到 `raw/`。
- 保存选中母版到 `processed/master_original.png` 或等价路径。
- `character.json` 增加 schema version。

验收：

- 老角色仍可打开。
- 新角色入库后有清晰目录结构。
- 角色详情页能展示生成配置摘要。

### Phase 2：图像预检与规范化

目标：为去背景、动作和导出打基础。

任务：

- Rust 增加基础图像处理依赖，优先 `image`。
- 新增命令：`analyze_character_master_image`。
- 计算图片尺寸、主体 bbox、Alpha 状态、主体中心、脚底线候选。
- 将结果写入 `processing`。
- 角色详情页展示“图像预检结果”。

验收：

- 能看到画布尺寸、主体 bbox、透明状态、脚底线。
- 预检失败有中文错误。
- 不改变原始图片，只写 metadata。

### Phase 3：去背景工具

目标：从 AI 原图得到干净透明 PNG。

任务：

- 第一版先做简单背景处理：纯色/绿幕/近似背景色 Alpha 清理。
- UI 提供 Alpha 阈值、边缘清理、裁剪透明边界、保留阴影选项。
- 结果保存到 `processed/master_transparent.png`。
- 后续再接入 rembg / MODNet / SAM 类能力，但必须检查商用授权。

验收：

- 对纯色/绿幕背景能得到透明图。
- 可以回退到原图。
- 处理参数可记录到 `processing`。

### Phase 4：多视图系统

目标：支持 Front / Side / Back 的角色生产。

任务：

- `CharacterViewAsset` 落地。
- UI 增加视图页或视图工具。
- 先支持 `single` 和 `front/side/back`，四方向可由 side 镜像补齐。
- 增加多视图一致性提示：主色、bbox、高度、脚底线。

验收：

- 角色详情页能切换视图。
- 每个视图有独立 raw / transparent / normalized。
- 视图一致性问题能提示用户。

### Phase 5：动作关键帧生成

目标：生成 Idle / Walk / Attack 基础动作帧。

任务：

- 扩展 `CharacterActionId`，逐步增加 `hurt / die / cast / run`。
- 生成动作请求使用角色母版图和 `CharacterGenerationConfig`。
- 帧保存到 `animations/<action>/`。
- 每帧记录 duration、anchor、bbox、status。
- PixiJS 预览真实动作帧。
- 增加异常帧标记：bbox 变化、脚底漂移、Alpha 残留。

验收：

- 至少 Idle 可以从 AI 输出保存为真实帧。
- 动作页不再只显示占位帧。
- 用户可以预览、选择帧、看到异常提示。

### Phase 6：Spritesheet 与引擎导出

目标：输出可进入游戏引擎的资源包。

任务：

- SpriteSheet PNG。
- 通用 Atlas JSON。
- PNG 序列。
- Godot SpriteFrames / `.tres` 初版。
- 导出配置写入 `exportProfiles`。

验收：

- 导出文件落在 `exports/`。
- JSON 包含动作、fps、loop、frame rect、anchor。
- Godot 可直接导入基础 AnimatedSprite2D 数据。

### Phase 7：半自动 Rig

目标：提高动作一致性和批量复用能力，但不作为早期承诺。

任务：

- 关键点建议。
- 用户手动修正。
- 保存骨骼模板。
- 动作模板复用。

原则：

- 不承诺全自动 Rig。
- 优先做“智能建议 + 人工确认”。
- 保持像素风、怪物、披风和武器的人工可调空间。

## UI 页面拆分

角色工坊后续保持多页/多模式，而不是把所有工具塞进一个页面。

建议结构：

- 角色库：管理角色资产、收藏、删除、筛选、打开。
- 生成角色：角色设定、候选方案、入库。
- 角色详情：母版、生成配置、处理状态、视图概览。
- 视图工具：Front / Side / Back 生成、对齐、一致性检查。
- 动作生产：动作选择、帧生成、PixiJS 预览、异常帧提示。
- 导出工具：PNG 序列、SpriteSheet、Atlas JSON、Godot 导出。

UI 约束：

- 使用 `AppPageShell`、`WorkbenchLayout`、`InspectorPanel`、`CanvasPanel`、`ActionBar`。
- 生产页保持桌面工具布局，不做营销式大卡片。
- 预览舞台高度使用 `--app-preview-max-height`。
- PixiJS 只预览，不作为导出目标。

## 风险与决策

### AI 一致性

风险：

- 多视图脸、装备、颜色变化。
- 动作帧抖动。

策略：

- 固定 `CharacterGenerationConfig`。
- 保存 seed。
- 使用参考图。
- 做基础图像统计检查。
- 异常帧允许重生成。

### 图像处理授权

风险：

- 部分去背景模型不适合商用或开源分发。

策略：

- 第一版先做本地规则化处理。
- 模型型去背景作为可选插件。
- 每个模型/LoRA/风格包保存 license 字段。

### Rust 模块膨胀

风险：

- `commands/characters.rs` 继续变成巨型文件。

策略：

- 下一阶段开始拆 `character/model.rs` 和 `character/store.rs`。
- 新图像处理能力必须进入 `image_pipeline`。

### 功能过早复杂化

风险：

- 过早做 Rig、视频生成、多引擎导出，导致主线变慢。

策略：

- 先完成结构化角色资产包。
- 再完成去背景和规范化。
- 动作和导出按最小可用范围推进。

## 近期优先级

最建议马上做：

1. 定义前端 `CharacterGenerationConfig / CharacterViewAsset / CharacterProcessingMetadata / CharacterExportProfile`。
2. 扩展前后端 `CharacterAssetRecord`，保持旧数据兼容。
3. Rust 侧拆出 `character/model.rs` 和 `character/store.rs`。
4. 新增 `analyze_character_master_image` 命令，先做图像预检 metadata。
5. 在角色详情页增加“图像预检结果”区块。

完成这五步后，角色工坊就会从“生成角色图”正式转向“结构化角色资产生产线”。
