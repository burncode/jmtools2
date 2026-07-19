import type { ProjectCharacterGenerationSettings } from "@/features/projects/characterGenerationTypes";

import type { PromptSection } from "./draftToPromptInputs";

export function compileProjectAnchorPromptSections(
  settings: ProjectCharacterGenerationSettings,
  variantKey?: string,
): PromptSection[] {
  const sections: PromptSection[] = [];
  const trimmedAnchor = settings.styleAnchor?.trim() ?? "";

  if (trimmedAnchor) {
    sections.push({
      locked: true,
      title: "Style Anchor 项目锚点",
      value: trimmedAnchor,
    });
  }

  const key = variantKey?.trim() ?? "";
  if (key) {
    const variant = settings.styleAnchorVariants?.[key]?.trim() ?? "";
    if (variant) {
      sections.push({
        locked: true,
        title: `Style Variant (${key})`,
        value: variant,
      });
    }
  }

  const template = settings.generationTemplate ?? {};
  const templateParts = [
    template.perspective?.trim() ? `Perspective: ${template.perspective.trim()}` : "",
    template.proportion?.trim() ? `Proportion: ${template.proportion.trim()}` : "",
    template.background?.trim() ? `Background: ${template.background.trim()}` : "",
    template.walkCycleHints?.trim() ? `Walk cycle: ${template.walkCycleHints.trim()}` : "",
  ].filter(Boolean);

  if (templateParts.length > 0) {
    sections.push({
      locked: true,
      title: "Generation Template 生成模板",
      value: templateParts.join("；"),
    });
  }

  const layoutDescription = settings.layoutAnchorDescription?.trim() ?? "";
  if (settings.layoutAnchorCharacterId?.trim() && layoutDescription) {
    sections.push({
      locked: true,
      title: "Layout Anchor 布局基准",
      value: layoutDescription,
    });
  }

  return sections;
}
