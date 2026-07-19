你的判断是对的：不是 shadcn / Tailwind 乱，而是项目缺少“应用级组件规范”。shadcn 只解决基础组件，不会自动帮你统一业务界面。

我建议你把目标定成：

功能页不直接写视觉风格，只写业务组合。

也就是：

shadcn/ui          = 基础零件
components/shared = 应用级组件
features/*        = 业务页面，只组合 shared

最关键的是先做这几个共享组件：

AppButton
AppSelect
SegmentedControl
PanelSection
InspectorField
TagPicker
IconButton
EmptyState
AssetCard
Toolbar

你的角色工坊、设置页、生成页都必须使用它们，不再各自写 .css 里的按钮、卡片、下拉、选中态。

整改顺序建议这样：

1. 先统一按钮、下拉、卡片、分段选择
2. 再统一颜色 token
3. 最后清理各功能页 CSS

颜色 token 可以先收敛成这一组：

:root {
  --app-bg: #f5f5f7;
  --app-panel: #ffffff;
  --app-panel-muted: #f8f8fa;

  --app-control: #f2f3f5;
  --app-control-hover: #e9ebef;
  --app-control-active: #111827;

  --app-border: #e5e7eb;
  --app-border-strong: #d1d5db;

  --app-text: #111827;
  --app-text-muted: #6b7280;
  --app-text-soft: #9ca3af;

  --app-accent: #6366f1;
  --app-accent-soft: #eef2ff;

  --app-radius-sm: 8px;
  --app-radius-md: 12px;
  --app-radius-lg: 16px;
}

然后定一条硬规则：

功能模块 CSS 里禁止直接写：
- button/select/details/summary 的完整视觉样式
- rgba(...)
- border-radius 随意写
- hover/active 重新定义一套

可以保留的只有：

- 页面布局
- grid/flex
- 间距
- 局部尺寸

可以。你的应用现在要做的不是“继续美化页面”，而是建立一套应用级 UI 架构。

核心架构建议：

src/
├─ components/
│  ├─ ui/              # shadcn 原子组件，不直接改业务
│  ├─ shared/          # 应用级通用组件
│  └─ layout/          # 应用框架布局
│
├─ features/
│  ├─ character/       # 角色工坊
│  ├─ action/          # 动作工坊
│  ├─ asset/           # 素材库
│  ├─ settings/        # 设置
│  └─ export/          # 导出
│
├─ styles/
│  ├─ tokens.css       # 颜色、圆角、阴影、边框
│  ├─ globals.css
│  └─ utilities.css
│
├─ lib/
│  ├─ cn.ts
│  └─ constants.ts
│
└─ types/

你应该建立三层 UI 规则：

第一层：shadcn/ui
只作为基础零件，比如 Button、Select、Dialog、Tabs。

第二层：components/shared
封装你的产品语言，比如 AppButton、PanelSection、AssetCard、InspectorField。

第三层：features/*
业务页面只组合 shared 组件，不再自己写视觉风格。

重点组件建议：

布局类：
AppShell
Sidebar
TopBar
PageHeader
WorkspaceLayout

面板类：
Panel
PanelSection
InspectorPanel
PropertyGroup
EmptyState

表单类：
AppInput
AppSelect
AppTextarea
InspectorField
SegmentedControl
TagPicker

素材类：
AssetCard
AssetGrid
AssetPreview
SpriteFrameStrip
ActionTemplateCard

操作类：
AppButton
IconButton
Toolbar
ActionBar
ContextMenu

颜色和视觉 token 要先统一：

:root {
  --app-bg: #f5f5f7;
  --app-surface: #ffffff;
  --app-surface-muted: #f8f8fa;

  --app-border: #e5e7eb;
  --app-border-strong: #d1d5db;

  --app-text: #111827;
  --app-text-muted: #6b7280;
  --app-text-soft: #9ca3af;

  --app-control: #f3f4f6;
  --app-control-hover: #e5e7eb;
  --app-control-active: #111827;

  --app-accent: #6366f1;
  --app-accent-soft: #eef2ff;

  --app-radius-sm: 8px;
  --app-radius-md: 12px;
  --app-radius-lg: 16px;

  --app-shadow-panel: 0 8px 24px rgba(15, 23, 42, 0.06);
}

以后功能页里禁止这样写：

button { ... }
select { ... }
.card { ... }
rgba(...)
border-radius: 13px;

功能页 CSS 只允许负责：

页面布局
网格排布
局部尺寸
间距
滚动区域

比如角色工坊应该变成这种结构：

<CharacterWorkshopPage>
  <PageHeader />
  <WorkspaceLayout>
    <AssetGrid />
    <AssetPreview />
    <InspectorPanel>
      <PanelSection title="基础信息">
        <InspectorField />
        <AppSelect />
      </PanelSection>

      <PanelSection title="生成设置">
        <SegmentedControl />
        <TagPicker />
      </PanelSection>
    </InspectorPanel>
  </WorkspaceLayout>
</CharacterWorkshopPage>

而不是在 CharacterWorkshop.css 里重新写一整套按钮、卡片、下拉。

整改路线建议：

第一阶段：冻结风格
确定 token、圆角、间距、按钮尺寸、卡片样式。

第二阶段：抽 shared 组件
先抽 AppButton、AppSelect、PanelSection、InspectorField、AssetCard。

第三阶段：改一个核心页面
优先改 CharacterWorkshop，作为样板页。

第四阶段：迁移其他页面
SettingsView、ActionWorkshop、AssetLibrary 按样板页重构。

第五阶段：清理 CSS
删除重复按钮样式、重复卡片样式、重复 hover/active 状态。

第六阶段：建立开发规范
以后新页面必须用 shared 组件，不允许直接写视觉控件。

你这个项目最适合的目标是：

Notion / Eagle / Figma 工具感
干净、克制、卡片化、强层级
左侧导航 + 中间工作区 + 右侧 Inspector

一句话总结：

shadcn 负责“基础控件”，shared 负责“产品气质”，features 只负责“业务组合”。

只要这个边界建立起来，你的应用就不会继续乱。