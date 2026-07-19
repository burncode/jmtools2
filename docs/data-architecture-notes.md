# JMTools 数据架构备忘录

## 结论

JMTools 采用“本地项目文件 + SQLite 索引数据库 + 元数据 JSON”的混合架构作为中长期方向。

当前阶段先使用 `jmproject.json` 驱动项目创建、打开和基础资产索引；等导入素材、筛选、搜索、生成记录和导出记录变复杂后，再引入 `project.db`。应用级数据也先用轻量 JSON，后续再升级为 `app.db`。

核心原则：

- 本地优先。
- 项目独立。
- 资源可迁移。
- 导出可复现。
- 后期可接云同步，但当前不依赖云端。

一句话：

```txt
应用管入口，项目管内容，文件管实体。
```

## 数据分层

### 文件系统

真实素材文件放在项目目录中，不放进数据库。

适合存放：

- PNG / JPG / WebP
- GIF / APNG
- Aseprite 文件
- WAV / OGG / MP3
- Sprite Sheet
- Tile Set
- Texture Atlas
- 导出 JSON
- 模型或外部工具生成的原始结果

### 项目 JSON

`jmproject.json` 是项目主清单，负责保存项目配置和最小可迁移信息。

当前阶段建议保存：

```json
{
  "version": 1,
  "name": "幻想地牢素材库",
  "slug": "fantasy_dungeon_assets",
  "description": "",
  "template": "pixelRpg",
  "exportTargets": ["pixijs", "godot"],
  "assets": [],
  "generators": [],
  "exports": []
}
```

### 项目数据库

`project.db` 后期加入，负责单个项目内部的索引、关系和历史记录。

适合保存：

- 素材 ID
- 名称
- 类型
- 路径
- 标签
- 尺寸
- 状态
- 创建时间
- 修改时间
- 生成参数
- 编辑历史
- 导出记录
- 缩略图路径
- 批处理任务记录

### 应用数据

应用级数据只管理软件自身状态，不强绑定具体项目素材。

当前阶段：

```txt
recent-projects.json
```

后期可升级为：

```txt
AppData/JMTools/
  app.db
  settings.json
  recent-projects.json
  model-providers.json
  templates/
  cache/
  thumbnails/
  logs/
  temp/
```

应用级数据适合保存：

- 最近项目
- 用户设置
- 窗口布局
- 快捷键
- 模型 API 配置
- 插件状态
- 全局导出预设
- 模板库
- 最近访问素材
- 后台任务记录
- 操作日志

## 推荐项目目录

保留 `jmproject.json` 作为 JMTools 的项目主清单名称，不改成通用的 `project.json`。

```txt
MyAssetProject/
  jmproject.json
  project.db
  assets/
    images/
    sprites/
    tiles/
    audio/
    ui/
    effects/
  generated/
  edited/
  thumbnails/
  exports/
  cache/
  history/
```

说明：

- `assets/`：正式入库素材。
- `generated/`：AI 或外部模型的原始生成结果。
- `edited/`：编辑、裁剪、合成后的结果。
- `thumbnails/`：缩略图缓存。
- `exports/`：导出结果。
- `cache/`：临时缓存。
- `history/`：版本快照，后期可选。

## 核心资产模型

建议统一为 `Asset`。

```ts
interface Asset {
  id: string;
  name: string;
  kind: "image" | "sprite" | "tile" | "atlas" | "audio" | "ui" | "effect";
  status: "draft" | "generated" | "editing" | "ready" | "exported" | "archived" | "failed";
  sourcePath: string;
  thumbnailPath?: string;
  tags: string[];
  width?: number;
  height?: number;
  format: string;
  createdAt: string;
  updatedAt: string;
}
```

后续配套模型：

- `GenerationRecord`
- `EditHistory`
- `ExportRecord`
- `AssetVersion`
- `ProjectConfig`
- `PipelineTask`

## 素材状态流

JMTools 是资产生产流水线，因此资产状态很重要。

推荐状态机：

```txt
draft
  ↓
generated
  ↓
editing
  ↓
ready
  ↓
exported
```

旁路状态：

- `failed`：生成、导入、转换、导出失败。
- `archived`：废弃但保留记录。

这样后续可以自然支持：

- 待处理素材
- 待编辑素材
- 待导出素材
- 最近生成素材
- 失败任务重试

## 模块边界

推荐模块：

- `Project Manager`：项目创建、打开、保存、迁移。
- `Asset Manager`：资产入库、索引、标签、状态管理。
- `Generation Service`：AI 生成任务和 provider 抽象。
- `Editor Core`：PixiJS 编辑器、动画、地图、图集编辑。
- `Thumbnail Service`：缩略图生成和缓存。
- `Export Pipeline`：导出适配器和批量导出。
- `Model Provider`：模型 API、本地模型、外部服务配置。
- `Plugin System`：后期插件能力。

## 分阶段落地

### 第一阶段

当前阶段。

- 使用 `jmproject.json`。
- 使用 `recent-projects.json`。
- 完成新建项目、打开项目、最近项目。
- 导入素材先写入 `jmproject.json` 的 `assets`。

### 第二阶段

当资产数量、筛选、搜索、缩略图和历史记录变复杂时加入 `project.db`。

- SQLite 做项目内资产索引。
- `jmproject.json` 保持项目配置和迁移入口。
- `project.db` 可重建，避免成为唯一真相。

### 第三阶段

当应用设置、模型服务、插件、模板、任务记录变复杂时加入 `app.db`。

- `app.db` 管应用自身。
- `project.db` 管项目内容。
- 文件系统保存真实资产。

## 当前决策

现在不急着引入 SQLite。

当前优先级：

1. 新建/打开项目稳定。
2. 导入素材入库。
3. 写入 `jmproject.json`。
4. 素材列表、标签、状态显示。
5. 再评估 `project.db` 的引入时机。

这能避免早期过度设计，也不会堵死后续专业化空间。
