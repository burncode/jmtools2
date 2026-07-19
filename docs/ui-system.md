# JMTools UI 系统规范

JMTools 是本地优先的游戏资产生产桌面工具。界面目标不是营销页或通用后台，而是稳定、克制、密集但清晰的生产软件：左侧导航，中间工作区，右侧/左侧 Inspector 参数面板，所有控件都有一致的状态语言。

角色生产线的产品与架构路线见 `docs/character-pipeline-roadmap.md`。UI 规范中的角色工坊页面、动作生产页和后续工具页应以该规划为业务边界。

## 分层边界

1. `src/components/ui`
   - shadcn/ui 基础零件。
   - 不直接承载 JMTools 的业务视觉语言。
   - 不手改生成组件，必要时在 `shared` 里组合。
   - 当前基础组件包括：`Button`、`Badge`、`Checkbox`、`Input`、`Textarea`、`Tabs`、`Tooltip`、`Separator`、`Card`、`Select`、`Popover`、`Label`、`Switch`、`ScrollArea`。

2. `src/components/shared`
   - JMTools 应用级组件。
   - 负责统一按钮、下拉、分段选择、标签选择、面板、字段、空状态、工具栏和素材卡片。
   - 功能模块优先使用这一层。

3. `src/features/*`
   - 只负责业务组合、布局网格、局部尺寸和滚动区域。
   - 不再各自重写按钮、卡片、下拉、hover/active 等视觉状态。

4. `src/styles`
   - `tokens.css` 是主题 token 的唯一入口。
   - light/dark 从第一天同时维护。

## 主题规则

- 使用 `.light` 与 `.dark` 作为主题根类。
- App 启动时根据应用设置写入 `document.documentElement` 的 `.light/.dark`、`data-theme` 和 `data-density`。
- 所有颜色、边框、阴影、圆角、间距、控件高度优先使用 `--app-*` token。
- shadcn token 同步映射在 `tokens.css`，保证 Tailwind/shadcn 与自定义组件同源。
- `data-density="compact|comfortable|spacious"` 只影响 token，不在功能页单独覆盖控件高度。
- 新增主题时先补齐 light/dark 两套 token，再迁移页面，不能只为单页写新色板。

## Token 分层

`tokens.css` 必须同时维护 shadcn token 和 JMTools 产品 token。

1. shadcn token
   - `--background`
   - `--foreground`
   - `--card`
   - `--popover`
   - `--primary`
   - `--secondary`
   - `--muted`
   - `--accent`
   - `--border`
   - `--input`
   - `--ring`

2. JMTools 基础 token
   - `--app-bg`
   - `--app-surface`
   - `--app-control`
   - `--app-border`
   - `--app-text`
   - `--app-primary`

3. JMTools 语义 token
   - `--app-panel-bg`
   - `--app-panel-border`
   - `--app-control-bg`
   - `--app-control-border`
   - `--app-selected-bg`
   - `--app-selected-border`
   - `--app-shadow-sm/md/lg`
   - `--app-space-*`
   - `--app-control-height-*`
   - `--app-panel-padding`
   - `--app-panel-gap`

功能组件只能优先使用第 3 层语义 token。需要换主题、换间距、换阴影时，先改 token，不改功能页。

## Token 使用规则

功能页只能直接使用以下类型的 token：

- 背景：`--app-panel-bg`、`--app-panel-bg-muted`、`--app-control-bg`、`--app-control-bg-hover`。
- 边框：`--app-panel-border`、`--app-control-border`、`--app-border-strong`。
- 状态：`--app-selected-bg`、`--app-selected-border`、`--app-selected-ring`。
- 文本：`--app-text`、`--app-text-muted`、`--app-text-subtle`。
- 语义：`--app-success`、`--app-warning`、`--app-danger`。
- 尺寸：`--app-space-*`、`--app-control-height-*`、`--app-panel-gap`、`--app-radius*`。

允许少量例外：

- 像素角色占位图、骨架图、预览画布网格可以使用固定颜色，因为它们是图形资产而不是 UI 主题。
- 生成图片、用户上传图、项目封面图不受主题 token 限制。
- 临时 debug 标记必须在提交前删除。

不允许的写法：

- 在功能页为按钮、输入框、分段控件、下拉、标签、卡片新写完整 hover/active/focus 样式。
- 在功能页随手写 `rgba(...)` 或 hex 来表达面板、控件、边框、选中、危险、成功等状态。
- 用 `border-radius: 10px` 这类裸值控制通用控件圆角；使用 `--app-radius*`。

如果确实缺 token，先扩展 `tokens.css`，再使用它。

## 为什么要靠近 shadcn 的方式

shadcn 的专业感来自三件事：

- 组件变体由组件负责，不由页面 CSS 临时写。
- 主题由 CSS Variables 驱动，不在功能页散写颜色。
- 状态一致：hover、focus、selected、disabled 都来自同一套 token。

因此 JMTools 的 shared 组件必须遵循同样模式：用 shadcn primitives 组合产品组件，用 `cn()` 暴露少量 className 扩展，不修改 `components/ui`。

## 功能模块 CSS 允许做什么

- 页面布局：grid、flex、pane 尺寸。
- 局部间距：gap、padding、scroll area。
- 媒体/画布尺寸：aspect-ratio、min/max、overflow。
- 只针对业务组件的定位关系。
- 业务图形或预览画布的绘制样式。
- 响应式布局、container query、稳定高度和滚动区域。

## 功能模块 CSS 禁止做什么

- 禁止完整重写 `button/select/details/summary/input/textarea` 视觉样式。
- 禁止直接写新的选中态、hover 态、active 态。
- 禁止随意写 `rgba(...)`、随机 hex、随机 `border-radius`。
- 禁止在功能页直接定义控件 `hover/focus/selected/disabled` 状态。
- 禁止嵌套卡片制造“框套框”。
- 禁止使用系统 `title` 作为正式 tooltip。
- 禁止在 feature CSS 中复制 shared 组件已有的类结构。
- 禁止同一个交互状态在不同页面使用不同视觉语言，例如一个页面用紫色实心选中、另一个页面用蓝色线框选中。

## 第一批共享组件

- `AppSelect`：单选下拉，替代原生 select 和 feature-local details 下拉。
- `TagPicker`：多选标签下拉，替代平铺式标签列表。
- `AppTagInput`：动态标签输入，替代功能页自写 badge + input 组合。
- `SegmentedControl`：分段选择，统一线框高亮。
- `IconButton`：图标按钮，统一尺寸、描边、按下和选中态。
- `Toolbar`：工具条容器，统一图标操作密度。
- `AssetOptionCard`：可选资产/候选方案卡片，统一选中、推荐、分数和预览结构。
- `AssetGridCard`：角色库、素材库、场景库的固定高度资产卡片，统一预览、收藏、打开和删除操作。
- `DataToolbar`：列表/网格页的搜索、筛选、排序工具条。
- `ActionBar`：底部保存、导出、确认类操作栏。
- `EmptyState`：空列表、空画布、无搜索结果等状态。
- `InspectorPanel`：统一左/右参数面板外壳、滚动区、头部与底部区域。
- `CanvasPanel`：统一画布/预览舞台外壳、工具栏、内容区和底部信息区。
- `StatusBanner`：统一生成中、错误、成功、限流等状态提示。
- `ProgressSteps`：统一生成流程进度、耗时和阶段状态。
- `PanelSection`：面板分区，轻边界，不嵌套卡片。
- `InspectorField`：Inspector 字段结构，统一标题、说明和控件位置。

## 共享组件扩展规则

新增 shared 组件需要满足：

- 基于 `components/ui` primitive 或已有 shared 组件组合。
- 支持 `className`，但默认视觉必须来自 `shared.css` 和 token。
- 组件内部处理 hover、focus、selected、disabled 等通用状态。
- 业务文案、业务数据和 Tauri 命令不得写入 shared 组件。
- 如果一个 feature 中出现第二次相似控件，优先抽到 shared，而不是复制 CSS。

当前建议新增但尚未完成的 shared 组件：

- `ConfirmDialog`：统一删除、覆盖、批处理等危险确认。
- `PropertyGrid`：统一只读属性、规格、元数据展示。

## 组合规则

- `AppSelect` 必须组合 `components/ui/select`。
- 多选弹层优先组合 `components/ui/popover`，不要在 feature 中手写 absolute 弹层。
- 面板容器优先组合 `components/ui/card` 或 `PanelSection`。
- 开关优先使用 `components/ui/switch`，不要在设置页重复手写 SwitchPrimitive 样式。
- 长列表和可滚动面板优先使用 `components/ui/scroll-area`。
- `components/shared` 可以定义产品级 className，但状态颜色必须来自 semantic token。

## 页面布局模板

## 桌面响应式标准

JMTools 的响应式不是移动端优先，而是桌面生产软件优先。窗口缩放时要保证工具区稳定、预览区不重叠、卡片不无限拉伸。

### 页面容器

所有页面必须先选择一个页面容器，而不是在功能页里自行写 `max-width`。

1. 设置型页面
   - 使用 `AppPageShell size="settings"` 和 `SettingsLayout`。
   - 最大宽度使用 `--app-page-max-settings`，当前为 `1180px`。
   - 内容居中，两侧留白随窗口增加。
   - 适用：应用设置、项目设置、预设字典、关于页。

2. 资产库页面
   - 使用 `AppPageShell size="library"` 和 `AssetLibraryLayout`。
   - 最大宽度使用 `--app-page-max-library`，当前为 `1440px`。
   - 卡片固定高度和稳定宽度，窗口变宽只增加列数，不拉长卡片。
   - 适用：角色库、素材库、导出中心、批处理。

3. 生产工作区页面
   - 使用 `AppPageShell size="workbench"` 和 `WorkbenchLayout`。
   - 最大宽度使用 `--app-page-max-workbench`，当前为 `1680px`。
   - 适用：角色生成、动作生成、地图工坊、特效工坊、UI 资源编辑。
   - 预览舞台高度使用 `--app-preview-max-height` / `--app-preview-max-height-sm`，不得随窗口无限拉伸。

### 断点

统一使用以下桌面断点：

- `compact`：`< 1120px`
  - 所有多栏布局变单列。
  - Inspector、Canvas、Aside 依次纵向排列。
  - 候选方案放在预览下方，不再作为右栏。

- `standard`：`1120px - 1439px`
  - 允许双栏：Inspector + Workspace。
  - 右侧候选/参数区优先下移，避免压缩主预览。

- `wide`：`1440px - 1679px`
  - 允许三栏：Inspector + Canvas + Aside。
  - 右栏宽度由 `--app-aside-width` 控制。

- `xl`：`>= 1680px`
  - 内容保持最大宽度，窗口继续变宽只增加留白。
  - 不允许画布、卡片、表单无限拉伸。

### 布局 Token

布局宽度和间距只从 `tokens.css` 取值：

- `--app-page-max-settings`
- `--app-page-max-library`
- `--app-page-max-workbench`
- `--app-page-padding-x`
- `--app-page-padding-y`
- `--app-inspector-width`
- `--app-inspector-width-sm`
- `--app-aside-width`
- `--app-preview-max-height`
- `--app-preview-max-height-sm`
- `--app-content-gap`
- `--app-workspace-gap`

如果页面需要不同宽度，先扩展 token 或 shared layout，不在 feature CSS 中直接写新 `max-width`。

### 验收规则

- 设置页拉宽后应像桌面偏好设置：内容居中，左右留白舒服。
- 工作区拉宽后应像生产软件：内容最多到 `1680px`，不铺满超宽屏。
- 缩小窗口后不允许元素重叠、右栏压进画布、卡片高度被拉长。
- 候选方案、工具栏和保存栏必须各自占据稳定区域。
- 通用页面容器必须来自 `src/components/shared/layouts`。
- 对“预览 + 候选/方案库”这类强关联区域，可以保持横向配对布局；宽度不足时优先压缩到设计最小列宽，而不是让预览被无限拉伸或突然变成很长的上下流。

生产工具页优先使用以下模板：

1. Inspector + Workspace
   - 左侧或右侧固定宽度 Inspector。
   - 中间是可滚动工作区或画布区。
   - 底部可选 ActionBar。

2. Library + Detail
   - 左侧分类/标签。
   - 中间固定高度资产卡片网格。
   - 详情页从卡片打开，不在卡片里塞完整编辑器。

3. Canvas Tool
   - 主画布占最大空间。
   - 工具条贴近画布内部边缘。
   - 参数面板使用 InspectorField/PanelSection。

4. Generation Flow
   - 步骤条只表达流程，不承载重复标题。
   - 生成中必须有明确状态、进度感和错误反馈。
   - 候选方案使用统一 AssetOptionCard/AssetGridCard。

页面必须避免：

- 多层浮动卡片套卡片。
- 大面积营销式 hero。
- 自然高度卡片在大屏被拉长。
- 内容区和候选区高度上下文不一致。

## 状态语言

所有可交互控件使用同一套状态：

- 默认：`--app-control-bg` + `--app-control-border`。
- Hover：`--app-control-bg-hover` + `--app-border-strong`。
- Focus：`--app-selected-ring`。
- Selected：`--app-selected-bg` + `--app-selected-border`。
- Disabled：降低透明度，不改变布局尺寸。
- Success/Warning/Danger：只用 `--app-success`、`--app-warning`、`--app-danger`。

选中态优先使用线框高亮；除主操作按钮外，不使用大面积实心渐变。

## 页面验收清单

迁移一个页面前后都按此检查：

- 页面是否只使用 shared 组件或 `components/ui` primitive 来表达通用控件。
- Feature CSS 中是否还有裸 `button/select/input/textarea` 的完整视觉样式。
- Feature CSS 中新增的颜色是否来自 `--app-*` token 或明确属于图形资产。
- 卡片、工具条、Inspector、保存栏是否使用稳定高度或响应式约束。
- hover、focus、selected、disabled 是否和其他页面一致。
- light/dark 下是否都能读清文本和边框。
- 窗口缩小后是否没有文字重叠、横向滚动和异常拉伸。
- 是否通过 `bun run build`。

## CSS 审计命令

迁移页面时先跑：

```bash
rg -n "rgba\(|#[0-9a-fA-F]{3,8}|border-radius: [0-9]|box-shadow:|background: linear-gradient" src/features/<feature>
rg -n "<select|className=\".*active|title=" src/features/<feature>
```

这些命中不一定都要删除，但每一处都需要判断：

- 是 UI 状态：迁移到 token/shared。
- 是图形资产：可以保留。
- 是旧样式：删除。

## 迁移顺序

1. 冻结 token 与 shared 组件 API。
2. 角色工坊作为样板页，先迁移参数面板、方案库、角色库。
3. 迁移动作生产页，统一预览舞台、动作列表、导出面板。
4. 迁移设置页，统一 Settings 控件与 shared 控件。
5. 迁移场景、道具、特效、UI 资源等后续模块。
6. 清理功能 CSS 中的裸控件视觉样式。

## 当前成熟度

- 规范建立：约 86%。
- token 基础：约 80%，light/dark/density、页面最大宽度和预览高度上限已有，但还缺更细的资产状态栏、数据工具条 token。
- shared 组件：约 90%，核心表单、选择控件、工具条、空状态、操作栏、固定高度资产卡片、Inspector/Canvas 外壳、Workbench 布局覆写、状态提示和进度步骤已有。
- 角色工坊落地：约 88%，生成角色和角色库已经迁移一轮，动作生产页已接入 `WorkbenchLayout`，预览舞台高度上限、右侧参数、帧序列标题、状态提示、生成进度和局部标签已接入 shared/shadcn。
- 全应用一致性：约 38%，设置页观感较好，Home/Project 已接页面最大宽度，后续还需要继续清理功能 CSS 中的旧控件样式。

达到 90% 的条件：

- `src/features` 中通用控件不再自写 hover/active/focus。
- 新增页面可以从 shared 组件拼出 80% 以上界面。
- light/dark/density 切换不需要 feature CSS 补丁。
- 每个生产模块都有同一套 Inspector、Toolbar、GridCard、ActionBar 语言。
