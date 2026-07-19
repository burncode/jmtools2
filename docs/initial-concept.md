# JMTools 初期构思文档

## 产品定位

JMTools 的目标不是做一个单点 AI 生成器，而是做一个面向游戏开发的资产生成流水线。

核心价值是把“生成、编辑、整理、打包、导出、复用”串成闭环，让生成出来的图片、动画、地图块、图集、音乐和音效可以直接进入游戏项目，而不是停留在孤立文件。

## 明确目标

1. 直接引入 PixiJS 作为主要 2D 渲染与编辑底座，避免后期从原生 Canvas 迁移带来的结构调整。
2. UI 层优先采用成熟组件库和成熟交互模式，避免重复造轮子。
3. 产品目标固定为游戏资产生成流水线，而不是泛用绘图工具、泛用 AI 聊天工具或普通素材管理器。
4. 开发期优先使用标准化、知名度较高、维护较活跃的 MCP / Skill / 插件能力，减少不稳定依赖。

## 用户工作流

推荐围绕一个完整资产工作流设计：

1. 创建或打开游戏资产项目。
2. 导入已有素材，或通过生成器创建新素材。
3. 在统一资产库中管理图片、动画、地图块、图集、音频。
4. 对素材进行编辑、切分、预览、组合和版本管理。
5. 将素材打包导出到 Godot、Unity、Phaser、PixiJS 等目标格式。

## 功能模块

### 项目管理

- 创建、打开、保存项目。
- 维护项目配置、资产索引、生成历史和导出记录。
- 支持后续引入项目模板，例如像素风 RPG、平台跳跃、塔防、卡牌等。

### 资产库

- 管理图片、序列帧、Sprite Sheet、Tile、Tile Set、Atlas、音频。
- 支持标签、类型、尺寸、来源、生成参数和导出状态。
- 资产库是整个应用的中心，不同工具模块都应该读写同一套资产模型。

### 素材生成

- 图片生成：角色、道具、图标、UI 元素、背景、贴图。
- 支持尺寸、风格、透明背景、批量数量、参考图和 seed。
- 生成结果自动进入资产库，并保留生成参数，方便复现和迭代。

### 动画制作

- 基于 PixiJS 做精灵预览、帧动画播放和编辑。
- 支持 PNG 序列、Sprite Sheet 切帧、帧率设置、循环播放。
- 后续可支持洋葱皮、碰撞盒、挂点、事件帧。

### 地图素材生成

- 生成 Tile、边缘衔接块、地形变体和装饰块。
- 支持常见规格，例如 16x16、32x32、48x48、64x64。
- 后续支持 AutoTile、Wang Tile、规则瓦片和地形过渡。

### 地图集与图集制作

- 自动合并图片为 Texture Atlas。
- 支持 padding、trim、extrude、命名规则、分组和最大尺寸限制。
- 导出 Godot、Unity、Phaser、PixiJS 可读的 atlas 元数据。

### 音乐与音效

- 管理 BGM、loop、环境音和短音效。
- 支持播放、裁剪、淡入淡出、格式转换。
- 后续接入音乐生成、音效生成和 loop 点检测。

## 推荐技术架构

数据架构备忘见：[docs/data-architecture-notes.md](data-architecture-notes.md)

### 前端

- React + TypeScript + Vite 作为现有基础。
- PixiJS 作为 2D 渲染、画布编辑、动画预览和地图编辑的核心。
- Zustand 管理应用状态，例如当前项目、选中资产、编辑器状态、任务队列。
- TanStack Query 可用于管理异步任务、生成任务、文件索引刷新等状态。
- UI 组件采用 shadcn/ui + Radix UI primitives，图标采用 lucide-react。
- TanStack Table 作为后续资产库表格、批量筛选和排序的优先方案。
- React Aria 暂不引入，避免与 Radix/shadcn 形成重复组件体系。

建议目录：

```txt
src/
  app/
  components/
    ui/
    workspace/
  features/
    project-manager/
    asset-library/
    image-generator/
    sprite-editor/
    tilemap-editor/
    atlas-builder/
    audio-studio/
  lib/
    pixi/
    tauri/
    formats/
  stores/
```

### Tauri / Rust

Rust 侧负责本地能力和重任务：

- 项目文件读写。
- 资产索引和缓存。
- 图集打包。
- 音频转码调用。
- 外部生成服务或本地模型调用。
- 长任务队列、进度事件和取消任务。

建议目录：

```txt
src-tauri/src/
  commands/
    project.rs
    assets.rs
    image.rs
    atlas.rs
    audio.rs
    export.rs
  services/
    file_store.rs
    job_queue.rs
    cache.rs
    external_tools.rs
  models/
    project.rs
    asset.rs
    job.rs
  lib.rs
  main.rs
```

## 项目文件格式

建议项目目录采用可读、可迁移结构：

```txt
MyGameAssets/
  jmproject.json
  assets/
    images/
    sprites/
    tiles/
    audio/
  generated/
  exports/
  cache/
```

`jmproject.json` 初期可以保持简单：

```json
{
  "version": 1,
  "name": "Demo Project",
  "assets": [],
  "generators": [],
  "exports": []
}
```

后续再扩展资产版本、生成参数、导出目标、依赖关系和项目设置。

## 关键设计原则

- 资产优先：所有功能最终都围绕资产库流转。
- 导出优先：生成结果要能进入真实游戏引擎。
- 参数可复现：AI 生成、图集打包、动画切分都要保存参数。
- 任务队列化：生成、导出、转码、打包都按任务处理，支持进度和取消。
- Provider 抽象：图像生成、音乐生成、外部模型都通过 provider 接口接入。
- 本地优先：项目文件、缓存、资产索引尽量可离线工作。

## MVP 阶段规划

### 第一阶段：工作台骨架

- 应用主布局：顶部栏、左侧资产库、中间工作区、右侧属性面板、底部任务队列。
- 项目创建、打开、保存。
- 图片和音频导入。
- 资产库索引和预览。
- 基础 Tauri command 封装。

### 第二阶段：PixiJS 编辑底座

- PixiJS 视口、缩放、平移、选中、网格。
- Sprite 预览。
- Sprite Sheet 切帧。
- 帧动画播放和帧率设置。

### 第三阶段：图集与导出

- Texture Atlas 打包。
- 导出 PNG + JSON。
- 支持 PixiJS / Phaser 格式，之后扩展 Godot / Unity。

### 第四阶段：生成能力接入

- 图像生成 provider 抽象。
- 本地或远程生成器接入。
- 生成历史和参数复现。

### 第五阶段：地图与音频

- Tile Set 编辑。
- AutoTile 规则。
- 音频导入、裁剪、loop、转换。
- 音乐和音效生成 provider。

## MCP / Skill 推荐

### 当前项目内可直接考虑的 Skill

- `tauri-development`：适合约束 Tauri + React + Rust 桌面开发方式。
- `typescript`：适合约束 TypeScript 类型风格和可维护性。
- `frontend-design` / `ui-ux-pro-max`：适合做工作台界面、面板布局和复杂工具 UI。
- `agent-browser` 或 `browser:browser`：适合本地前端调试、截图、交互验证。
- `godot-docs`：如果后续要导出 Godot 资源格式，很有帮助。
- `game-art`：适合制定素材风格、资产管线和游戏美术规范。

### 推荐关注的 MCP

- GitHub MCP：用于 issue、PR、仓库和项目协作。
- Filesystem MCP：用于受控读写本地文件。需要严格限制允许访问的目录。
- Git MCP：用于检索提交、分支、diff 和仓库历史。
- Playwright MCP：用于自动化测试本地 WebView / 前端页面，适合工具 UI 验证。
- Fetch MCP：用于读取网页文档和远程资料。
- Memory MCP：用于保存长期项目偏好、架构决策和约定。
- Sequential Thinking MCP：用于复杂功能设计和架构推演，但不应替代真实代码验证。
- Figma MCP：如果未来需要把设计稿、组件规范或图标资产接入开发流程，可以考虑。

### 选择 MCP 的标准

- 优先官方组织、知名公司或高星仓库。
- 优先只给最小权限，特别是 filesystem、GitHub token、浏览器控制类 MCP。
- 能不用远程服务就先不用远程服务。
- 能通过项目脚本和本地工具解决的问题，不必强行 MCP 化。
- 对生产环境或敏感数据场景，不使用未经审计的社区 MCP。

## 近期建议

下一步建议先实现“工作台骨架 + 项目格式 + 资产库模型”，不要急着接 AI 生成。只要资产流转模型设计清楚，后面的 PixiJS 编辑器、图集、地图、音乐、生成 provider 都能自然挂上去。
