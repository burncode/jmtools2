export type CharacterDirection = "single" | "four" | "eight";

export type CharacterRole = "hero" | "npc" | "enemy" | "boss" | "pet";

export type CharacterEntityType = "humanoid" | "creature" | "boss" | "spirit" | "construct";

export type CharacterAgeBand = "child" | "young" | "adult" | "elder" | "ancient";

export type CharacterGender = "male" | "female" | "unknown" | "na";

export type AppearanceTraitCategory = "costume" | "weapon" | "accessory" | "body" | "effect" | "other";

export interface CharacterIdentityBlock {
  ageBand: CharacterAgeBand;
  classOrOccupation: string;
  entityType: CharacterEntityType;
  gender: CharacterGender;
  narrativeTags: string[];
  raceOrSpecies: string;
  role: CharacterRole;
}

export interface AppearanceTrait {
  category: AppearanceTraitCategory;
  colors?: string[];
  id: string;
  label: string;
  prompt: string;
}

export type CreateSetupTab = "template" | "identity" | "style" | "appearance" | "generation";

export type CreateSetupSection = "preset" | "concept" | "output" | "advanced";

export type CharacterStyle = "pixel16" | "pixel32" | "custom";

export interface CharacterMasterDraft {
  description: string;
  direction: CharacterDirection;
  displayName: string;
  id: string;
  model: string;
  palette: string[];
  role: CharacterRole;
  size: "32x32" | "48x48" | "64x64";
  style: CharacterStyle;
}

export interface CharacterLibraryItem {
  actions: number;
  direction: string;
  id: string;
  name: string;
  size: string;
  status: string;
}

export interface CharacterLibraryRecord {
  displayName: string;
  favorite: boolean;
  id: string;
  masterImage?: CharacterImageAsset;
  previewImage?: CharacterImageAsset;
  selectedPlanName: string;
  size: string;
  status: string;
  style: string;
  updatedAt: string;
  visualKeywords: string[];
}

export interface CharacterKitStep {
  description: string;
  label: string;
  status: "active" | "pending";
}

export interface CharacterCandidatePlan {
  id: string;
  name: string;
  note?: string;
  selected: boolean;
}

export interface CharacterGenerationOption {
  checked: boolean;
  label: string;
  value: string;
}

export type CharacterElementColorKey = "armor" | "cape" | "eyes" | "hair" | "skin" | "shield" | "weapon";

export type CharacterResourceKind =
  | "armor"
  | "cape"
  | "eye"
  | "hair"
  | "helmet"
  | "palette"
  | "shield"
  | "skin"
  | "template"
  | "weapon";

export interface SelectedCharacterResource {
  colors?: string[];
  group: string;
  id: string;
  kind: CharacterResourceKind;
  label: string;
  prompt: string;
  tags: string[];
}

export interface CharacterWorkshopDraft {
  appearanceTraits: AppearanceTrait[];
  archetypeTemplateId?: string;
  backgroundMode: "checker" | "chroma" | "solid" | "transparent";
  customHeight: number;
  customWidth: number;
  description: string;
  direction: "eight" | "four" | "single";
  elementColors: Partial<Record<CharacterElementColorKey, string[]>>;
  featureTags: string[];
  generationCount: "2" | "4" | "6" | "8";
  generationOptions: string[];
  generationQuality: "快速" | "标准" | "高质量";
  identity: CharacterIdentityBlock;
  moodKeywords: string[];
  name: string;
  palette: string[];
  referenceImages: CharacterReferenceImageAsset[];
  referenceStrength: number;
  selectedResources: SelectedCharacterResource[];
  size: "32x48" | "48x48" | "64x64" | "自定义";
  style: string;
  styleAnchorVariantKey?: string;
  stylePresetId?: string;
}

export interface CharacterMasterCandidatePlan {
  directionPreviews?: Partial<Record<"back" | "front" | "left" | "right", CharacterImageAsset>>;
  focus: string;
  generationWarnings?: string[];
  id: string;
  masterImage?: CharacterImageAsset;
  name: string;
  recommendationScore: number;
  selected: boolean;
}

export interface CharacterMasterPlan {
  actionSuggestions: {
    attack: string;
    idle: string;
    walk: string;
  };
  candidatePlans: CharacterMasterCandidatePlan[];
  directionConsistency: string[];
  exportNotes: string[];
  pixelPrompt: string;
  rawContent: string;
  rolePositioning: string;
  summary: string;
  visualKeywords: string[];
}

export interface CharacterMasterPlanGenerationResult {
  model: string;
  plan: CharacterMasterPlan;
  providerId: string;
  providerName: string;
  taskId: string;
}

export interface CharacterGenerationConfig {
  appearanceTraits?: AppearanceTrait[];
  archetypeTemplateId?: string;
  generation: {
    count: number;
    model: string;
    negativePrompt?: string;
    options: string[];
    prompt: string;
    providerName: string;
    quality: CharacterWorkshopDraft["generationQuality"];
    seed?: number;
  };
  identity: {
    classOrOccupation?: string;
    entityType?: CharacterEntityType;
    name: string;
    narrativeTags?: string[];
    raceOrSpecies?: string;
    role?: CharacterRole;
    tags: string[];
  };
  references: CharacterReferenceImageAsset[];
  referenceStrength?: number;
  stylePresetId?: string;
  version: 1 | 2;
  visual: {
    backgroundMode: CharacterWorkshopDraft["backgroundMode"];
    direction: CharacterWorkshopDraft["direction"];
    elementColors?: CharacterWorkshopDraft["elementColors"];
    featureTags: string[];
    palette: string[];
    selectedResources?: SelectedCharacterResource[];
    size: CharacterWorkshopDraft["size"];
    style: string;
  };
}

export interface AnchorPoint {
  mode: "bottomCenter" | "center" | "custom";
  x: number;
  y: number;
}

export interface BoundingBox {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface CharacterViewQualityReport {
  checkedAt?: string;
  score?: number;
  warnings: string[];
}

export interface CharacterViewAsset {
  anchor?: AnchorPoint;
  bbox?: BoundingBox;
  id: string;
  kind: string;
  normalizedImage?: CharacterImageAsset;
  quality?: CharacterViewQualityReport;
  rawImage?: CharacterImageAsset;
  transparentImage?: CharacterImageAsset;
}

export interface CharacterProcessingMetadata {
  anchor?: AnchorPoint;
  anchorMode: AnchorPoint["mode"];
  backgroundRemoved: boolean;
  bbox?: BoundingBox;
  canvas: {
    height: number;
    width: number;
  };
  footLineY?: number;
  normalized: boolean;
  warnings: string[];
}

export interface CharacterExportProfile {
  fps: number;
  frameHeight: number;
  frameWidth: number;
  id: string;
  padding: number;
  spacing: number;
  target: "generic-json" | "godot" | "png-sequence" | "spritesheet";
  trim: boolean;
}

export interface CharacterAssetRecord {
  actionSuggestions: CharacterMasterPlan["actionSuggestions"];
  actions: CharacterActionTrack[];
  config?: CharacterGenerationConfig;
  createdAt: string;
  description: string;
  direction: CharacterWorkshopDraft["direction"];
  displayName: string;
  exportProfiles?: CharacterExportProfile[];
  exportNotes: string[];
  favorite?: boolean;
  id: string;
  masterImage?: CharacterImageAsset;
  palette: string[];
  pixelPrompt: string;
  processing?: CharacterProcessingMetadata;
  projectRelativePath: string;
  providerName: string;
  selectedPlanFocus: string;
  selectedPlanId: string;
  selectedPlanName: string;
  selectedPlanScore: number;
  size: CharacterWorkshopDraft["size"];
  status: "draft" | "ready";
  style: string;
  styleAnchorVariantKey?: string;
  summary: string;
  taskId: string;
  updatedAt: string;
  views?: CharacterViewAsset[];
  visualKeywords: string[];
}

export type CharacterActionId = "idle" | "walk" | "attack";

export interface CharacterImageAsset {
  absolutePath?: string;
  dataUrl?: string;
  height: number;
  id: string;
  projectRelativePath: string;
  role: "frame" | "master" | "reference" | "spritesheet" | "transparent";
  source: "ai-generated" | "background-removal" | "imported" | "placeholder";
  width: number;
}

export interface CharacterReferenceImageAsset {
  absolutePath: string;
  dataUrl: string;
  fileName: string;
  id: string;
  projectRelativePath: string;
  role: "character" | "prop" | "scene" | "pose";
}

export interface ImportCharacterReferenceImagesInput {
  imagePaths: string[];
  projectRoot: string;
}

/// 动作轨道 ID：基础动作为 "idle"/"walk"/"attack"，多视图轨道为复合 ID（如 "idle-front"）。
export type CharacterActionTrackId = string;

export interface CharacterActionTrack {
  direction: CharacterAssetRecord["direction"];
  exportReady: boolean;
  filmstripCutPositions?: number[];
  filmstripSource?: CharacterImageAsset;
  frames: CharacterActionFrame[];
  id: CharacterActionTrackId;
  label: string;
  loopMode: "loop" | "once";
  note: string;
  previewFps: number;
  qualityErrors?: string[];
  qualityGrade?: string;
  qualityScore?: number;
  qualityWarnings?: string[];
  status: "empty" | "draft" | "ready" | "generated";
}

export interface CharacterActionFrame {
  durationMs: number;
  id: string;
  image?: CharacterImageAsset;
  index: number;
  label: string;
  source: "placeholder" | "asset" | "workflow-generate-action-frames" | "ai-generated";
  status: "key" | "inbetween";
}

export interface CreateCharacterAssetInput {
  draft: CharacterWorkshopDraft;
  masterPlan: CharacterMasterPlan;
  model: string;
  projectRoot: string;
  providerName: string;
  selectedPlan: CharacterMasterCandidatePlan;
  taskId: string;
}

export interface CharacterCreateMetadata {
  description: string;
  tags: string[];
}

export type CharacterPlanGenerationPhase = "candidates" | "plan";

export type CharacterPlanGenerationState =
  | {
      message: string;
      status: "idle";
    }
  | {
      candidateIndex?: number;
      candidateTotal?: number;
      message: string;
      pendingPlan?: CharacterMasterPlan;
      phase: CharacterPlanGenerationPhase;
      startedAt: number;
      status: "generating";
      taskId: string;
    }
  | {
      result: CharacterMasterPlanGenerationResult;
      status: "success";
    }
  | {
      message: string;
      status: "error";
      taskId?: string;
    };
