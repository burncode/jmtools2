export const STYLE_PRESET_TAG_OPTIONS = [
  { label: "像素", value: "像素" },
  { label: "动漫", value: "动漫" },
  { label: "写实", value: "写实" },
  { label: "手绘", value: "手绘" },
  { label: "低模", value: "低模" },
  { label: "复古", value: "复古" },
  { label: "RPG", value: "RPG" },
  { label: "立绘", value: "立绘" },
  { label: "场景", value: "场景" },
  { label: "UI", value: "UI" },
  { label: "VFX", value: "VFX" },
] as const;

export const BUILTIN_PRESET_TAGS: Record<string, string[]> = {
  pixel_retro_16: ["像素", "复古", "RPG"],
  anime_cel: ["动漫", "立绘"],
  realistic_soft: ["写实", "场景"],
  hand_paint: ["手绘", "场景"],
  low_poly_flat: ["低模", "场景"],
};
