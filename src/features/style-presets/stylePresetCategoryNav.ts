export interface StylePresetCategoryNavItem {
  id: string;
  label: string;
}

export const STYLE_PRESET_CATEGORY_NAV: StylePresetCategoryNavItem[] = [
  { id: "all", label: "全部" },
  { id: "pixel", label: "像素" },
  { id: "anime", label: "动漫" },
  { id: "realistic", label: "写实" },
  { id: "hand_paint", label: "手绘" },
  { id: "low_poly", label: "低模" },
];

export function getCategoryNavItem(categoryId: string): StylePresetCategoryNavItem {
  return STYLE_PRESET_CATEGORY_NAV.find((item) => item.id === categoryId) ?? STYLE_PRESET_CATEGORY_NAV[0];
}
