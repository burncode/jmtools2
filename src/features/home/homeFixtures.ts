import {
  BookOpen,
  Boxes,
  FolderKanban,
  Home,
  ImagePlus,
  LayoutTemplate,
  Settings,
  Sparkles,
  Wand2,
  Wrench,
} from "lucide-react";

import type { HomeActivity, HomeTemplateOption, NavigationItem, StarterRecentProject } from "./types";

export const navigationItems = [
  { icon: Home, label: "首页", target: "home" },
  { icon: FolderKanban, label: "项目库", target: "open" },
  { icon: LayoutTemplate, label: "模板市场", target: "templates" },
  { icon: BookOpen, label: "学习资源", target: "learn" },
  { icon: Wrench, label: "工具箱", target: "tools" },
  { icon: Settings, label: "设置", target: "settings" },
] as const satisfies NavigationItem[];

export const starterRecentProjects = [
  {
    assets: ["角色", "瓦片", "音效"],
    name: "幻想地牢素材库",
    path: "D:\\JMTools\\Projects\\fantasy_dungeon_assets",
    status: "进行中",
    updatedAt: "今天 14:30",
  },
  {
    assets: ["地图", "图集", "UI"],
    name: "像素小镇物语",
    path: "D:\\JMTools\\Projects\\pixel_town",
    status: "进行中",
    updatedAt: "昨天 19:20",
  },
  {
    assets: ["怪物", "技能", "特效"],
    name: "暗影地牢",
    path: "D:\\JMTools\\Projects\\shadow_ruins",
    status: "草稿",
    updatedAt: "3 天前",
  },
] as const satisfies StarterRecentProject[];

export const recentActivities = [
  { kind: "角色", name: "hero_idle", status: "最近编辑", time: "2 小时前" },
  { kind: "特效", name: "fireball_vfx", status: "已生成", time: "3 小时前" },
  { kind: "场景", name: "forest_tileset", status: "待导出", time: "昨天 16:30" },
  { kind: "UI", name: "ui_button_set", status: "已导出", time: "昨天 11:20" },
  { kind: "物品", name: "health_potion", status: "最近编辑", time: "2 天前" },
] as const satisfies HomeActivity[];

export const homeTemplates = [
  { description: "从标准目录与项目清单开始", icon: ImagePlus, label: "空白项目", value: "empty" },
  { description: "角色、场景、图集与导出预设", icon: Sparkles, label: "2D RPG 模板", value: "pixelRpg" },
  { description: "平台瓦片、角色动作和关卡素材", icon: Boxes, label: "平台跳跃模板", value: "platformer" },
  { description: "按钮、图标、面板与状态素材", icon: LayoutTemplate, label: "UI 资源模板", value: "uiPack" },
  { description: "音效、循环音乐与转换流程", icon: Wand2, label: "音效模板", value: "audioPack" },
] as const satisfies HomeTemplateOption[];
