import {
  AudioWaveform,
  Boxes,
  Brush,
  Clapperboard,
  Download,
  Flame,
  Grid3X3,
  Hammer,
  Layers,
  Map,
  Package,
  Shield,
  Sparkles,
  Sword,
  Wrench,
  Wand2,
  Workflow,
} from "lucide-react";

import type { PipelineTask, ProductionModule, RecentWorkItem, WorkspaceNavItem, WorkspaceStat } from "./types";

export const workspaceNavItems = [
  { group: "production", icon: Grid3X3, label: "工作台", panel: "dashboard" },
  { group: "production", icon: Workflow, label: "节点工作台", panel: "workflow" },
  { group: "production", icon: Sword, label: "角色工坊", panel: "characters" },
  { group: "production", icon: Wrench, label: "素材工具", panel: "assetTools" },
  { group: "production", icon: Map, label: "场景与地图", panel: "scenes" },
  { group: "production", icon: Package, label: "物品道具", panel: "items" },
  { group: "production", icon: Flame, label: "特效工坊", panel: "vfx" },
  { group: "production", icon: Layers, label: "UI 资源", panel: "ui" },
  { group: "production", icon: Clapperboard, label: "动画编辑", panel: "animation" },
  { group: "production", icon: Boxes, label: "地图集", panel: "atlas" },
  { group: "production", icon: AudioWaveform, label: "音频制作", panel: "audio" },
  { group: "management", icon: Download, label: "导出中心", panel: "export" },
  { group: "management", icon: Hammer, label: "批量处理", panel: "batch" },
] as const satisfies WorkspaceNavItem[];

export const productionModules = [
  {
    accent: "purple",
    description: "用节点编排图片、角色、后处理、导出和批量任务。",
    icon: Workflow,
    label: "节点工作台",
    metric: "2 模板",
    panel: "workflow",
    status: "队列底座可用",
  },
  {
    accent: "blue",
    description: "角色设定、动作拆分、方向帧与动画状态。",
    icon: Sword,
    label: "角色工坊",
    metric: "12 角色",
    panel: "characters",
    status: "3 个待补动画",
  },
  {
    accent: "cyan",
    description: "去背景、预检、切割和格式转换等通用素材处理。",
    icon: Wrench,
    label: "素材工具",
    metric: "4 工具",
    panel: "assetTools",
    status: "去背景可用",
  },
  {
    accent: "green",
    description: "场景素材、瓦片规则、地图草图与地形组合。",
    icon: Map,
    label: "场景与地图",
    metric: "5 地图",
    panel: "scenes",
    status: "2 个待导出",
  },
  {
    accent: "orange",
    description: "武器、道具、掉落物、图标和稀有度配置。",
    icon: Package,
    label: "物品道具",
    metric: "48 物品",
    panel: "items",
    status: "14 个草稿",
  },
  {
    accent: "red",
    description: "技能特效、粒子序列、命中特效与预览。",
    icon: Flame,
    label: "特效工坊",
    metric: "8 特效",
    panel: "vfx",
    status: "1 个失败",
  },
  {
    accent: "cyan",
    description: "按钮、面板、图标、状态样式和 UI 套件。",
    icon: Layers,
    label: "UI 资源",
    metric: "21 套件",
    panel: "ui",
    status: "6 个待入库",
  },
  {
    accent: "purple",
    description: "序列帧、状态机、帧率、碰撞帧与导出。",
    icon: Clapperboard,
    label: "动画编辑",
    metric: "36 动画",
    panel: "animation",
    status: "5 个待检查",
  },
  {
    accent: "blue",
    description: "贴图合批、padding、命名规则与 atlas 元数据。",
    icon: Boxes,
    label: "地图集制作",
    metric: "3 图集",
    panel: "atlas",
    status: "1 个待打包",
  },
  {
    accent: "green",
    description: "音效、循环音乐、格式转换和响度检查。",
    icon: AudioWaveform,
    label: "音频制作",
    metric: "28 音频",
    panel: "audio",
    status: "4 个待转换",
  },
] as const satisfies ProductionModule[];

export const recentWorkItems = [
  { detail: "16 frames · 32x32", module: "角色工坊", name: "hero_idle", status: "动画编辑中", time: "2 小时前", type: "角色" },
  { detail: "tileset · 256x256", module: "场景与地图", name: "forest_tileset", status: "待导出", time: "昨天 16:30", type: "场景" },
  { detail: "12 frames · additive", module: "特效工坊", name: "fireball_vfx", status: "生成完成", time: "3 小时前", type: "特效" },
  { detail: "normal/hover/pressed", module: "UI 资源", name: "ui_button_set", status: "已入库", time: "昨天 11:20", type: "UI" },
] as const satisfies RecentWorkItem[];

export const pipelineTasks = [
  { detail: "fireball_vfx 变体生成", progress: 68, status: "生成中", title: "特效生成" },
  { detail: "ui_button_set 写入资产索引", progress: 40, status: "待入库", title: "资产入库" },
  { detail: "main_atlas padding 检查", progress: 76, status: "待打包", title: "图集打包" },
  { detail: "PixiJS manifest 输出", progress: 24, status: "待导出", title: "导出任务" },
  { detail: "heal_potion 命名冲突", progress: 100, status: "失败重试", title: "批处理" },
] as const satisfies PipelineTask[];

export const inspectorStats = [
  { label: "资产总数", value: "1,248" },
  { label: "待处理", value: "23" },
  { label: "导出目标", value: "4" },
  { label: "项目大小", value: "12.45 GB" },
] as const satisfies WorkspaceStat[];

export const exportTargetLabels = ["PixiJS", "Godot", "Unity", "Phaser"] as const;

export const coverBadges = [
  { icon: Brush, label: "2D RPG" },
  { icon: Shield, label: "本地项目" },
  { icon: Wand2, label: "生成流水线" },
  { icon: Sparkles, label: "像素风" },
] as const;
