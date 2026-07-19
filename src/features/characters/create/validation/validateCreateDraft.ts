import type { CreateSetupSection, CharacterWorkshopDraft } from "../../types";

export interface CreateDraftValidationIssue {
  field: string;
  message: string;
  section: CreateSetupSection;
  type: "blocking" | "warning";
}

export interface CreateDraftValidationResult {
  blockingIssues: CreateDraftValidationIssue[];
  isValid: boolean;
  sectionStatuses: Record<CreateSetupSection, "complete" | "error" | "idle" | "warning">;
  warningIssues: CreateDraftValidationIssue[];
}

const setupSections: CreateSetupSection[] = ["preset", "concept", "output", "advanced"];

export function validateCreateDraft(draft: CharacterWorkshopDraft): CreateDraftValidationResult {
  const blockingIssues: CreateDraftValidationIssue[] = [];
  const warningIssues: CreateDraftValidationIssue[] = [];

  if (!draft.identity.entityType) {
    blockingIssues.push({
      field: "identity.entityType",
      message: "请选择实体类型（可通过顶部模板预设加载）。",
      section: "preset",
      type: "blocking",
    });
  }

  if (!draft.identity.role) {
    blockingIssues.push({
      field: "identity.role",
      message: "请选择游戏职能（可通过顶部模板预设加载）。",
      section: "preset",
      type: "blocking",
    });
  }

  if (!draft.style.trim()) {
    blockingIssues.push({
      field: "style",
      message: "请选择像素风格（可通过顶部模板预设加载）。",
      section: "preset",
      type: "blocking",
    });
  }

  if (!draft.name.trim()) {
    blockingIssues.push({
      field: "name",
      message: "请填写角色名称。",
      section: "concept",
      type: "blocking",
    });
  }

  if (draft.description.trim().length < 10) {
    blockingIssues.push({
      field: "description",
      message: "角色描述至少 10 个字。",
      section: "concept",
      type: "blocking",
    });
  }

  if (!draft.size) {
    blockingIssues.push({
      field: "size",
      message: "请选择画布规格。",
      section: "output",
      type: "blocking",
    });
  }

  if (!draft.direction) {
    blockingIssues.push({
      field: "direction",
      message: "请选择方向规格。",
      section: "output",
      type: "blocking",
    });
  }

  if (draft.palette.length < 2) {
    warningIssues.push({
      field: "palette",
      message: "建议设置至少 2 个主色（可通过模板预设加载）。",
      section: "preset",
      type: "warning",
    });
  }

  if (draft.appearanceTraits.length === 0 && draft.description.trim().length < 40) {
    warningIssues.push({
      field: "appearanceTraits",
      message: "建议添加特征标签，或写更详细的角色描述。",
      section: "concept",
      type: "warning",
    });
  }

  if (draft.identity.entityType === "boss" && draft.size === "32x48") {
    warningIssues.push({
      field: "size",
      message: "Boss 建议使用更大画布（如 64×64）。",
      section: "output",
      type: "warning",
    });
  }

  if (draft.referenceImages.length === 0) {
    warningIssues.push({
      field: "referenceImages",
      message: "上传参考图可提升生成一致性。",
      section: "output",
      type: "warning",
    });
  }

  const sectionStatuses = buildSectionStatuses(blockingIssues, warningIssues);

  return {
    blockingIssues,
    isValid: blockingIssues.length === 0,
    sectionStatuses,
    warningIssues,
  };
}

function buildSectionStatuses(
  blockingIssues: CreateDraftValidationIssue[],
  warningIssues: CreateDraftValidationIssue[],
): Record<CreateSetupSection, "complete" | "error" | "idle" | "warning"> {
  const statuses = Object.fromEntries(setupSections.map((section) => [section, "idle"])) as Record<
    CreateSetupSection,
    "complete" | "error" | "idle" | "warning"
  >;

  for (const section of setupSections) {
    if (blockingIssues.some((issue) => issue.section === section)) {
      statuses[section] = "error";
    } else if (warningIssues.some((issue) => issue.section === section)) {
      statuses[section] = "warning";
    } else {
      statuses[section] = "complete";
    }
  }

  return statuses;
}

export function getSectionStatus(
  validation: CreateDraftValidationResult,
  section: CreateSetupSection,
): "complete" | "error" | "idle" | "warning" {
  return validation.sectionStatuses[section];
}

export function getIssuesForSection(issues: CreateDraftValidationIssue[], section: CreateSetupSection) {
  return issues.filter((issue) => issue.section === section);
}

export function getIssuesForField(validation: CreateDraftValidationResult, field: string) {
  return [...validation.blockingIssues, ...validation.warningIssues].filter((issue) => issue.field === field);
}
