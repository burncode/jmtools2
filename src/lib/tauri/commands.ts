import { invoke } from "@tauri-apps/api/core";

import { invokeWithLog } from "./diagnostics";

import type {
  CharacterActionTrack,
  CharacterAssetRecord,
  CharacterImageAsset,
  CharacterLibraryRecord,
  CharacterMasterPlan,
  CharacterReferenceImageAsset,
  CharacterWorkshopDraft,
  CreateCharacterAssetInput,
  ImportCharacterReferenceImagesInput,
} from "../../features/characters/types";
import type { PipelineProject, RecentProject } from "../../features/projects/types";
import type { ProjectCategory } from "../../features/projects/types";
import type {
  AssetToolResult,
  AssetToolSourcePreview,
  LoadAssetToolSourcePreviewInput,
  RunAssetToolInput,
} from "../../features/tools/types";
import type { WorkflowDefinition, WorkflowRun } from "../../features/workflows/types";

export interface AppHealth {
  app: string;
  status: "ok";
}

export interface AppSettings {
  accentColor: "amber" | "blue" | "cyan" | "rose" | "violet";
  aiAnimationModel: string;
  aiApiBase: string;
  aiApiKey: string;
  aiAudioModel: string;
  aiAudioProviderId: string;
  aiCharacterModel: string;
  aiCharacterProviderId: string;
  aiCharacterEditModel: string;
  aiCharacterEditProviderId: string;
  aiImageModel: string;
  aiProvider: "openai" | "deepseek" | "ollama" | "custom";
  aiSceneModel: string;
  aiSceneProviderId: string;
  aiServiceMode: "local-first" | "custom";
  aiTextModel: string;
  aiTextProviderId: string;
  aiUiModel: string;
  aiUiProviderId: string;
  aiVfxModel: string;
  aiVfxProviderId: string;
  aiAnimationProviderId: string;
  autosaveEnabled: boolean;
  autosaveIntervalSeconds: number;
  backgroundRemovalAlphaMatting: boolean;
  backgroundRemovalBackgroundThreshold: number;
  backgroundRemovalCleanupStrength: "off" | "soft" | "standard" | "strict";
  backgroundRemovalEdgeSoftness: number;
  backgroundRemovalEngine: "chroma" | "rembg";
  backgroundRemovalExecutablePath: string;
  backgroundRemovalForegroundThreshold: number;
  backgroundRemovalHoleFillMaxPixels: number;
  backgroundRemovalModel: "birefnet-general" | "birefnet-general-lite" | "custom" | "isnet-general-use" | "silueta";
  backgroundRemovalModelPath: string;
  backgroundRemovalPreserveSmallParts: boolean;
  backgroundRemovalSpillSuppression: number;
  backgroundRemovalTolerance: number;
  clipboardQuickImport: boolean;
  closeWindowBehavior: "ask" | "minimize" | "exit";
  defaultExportFormat: "png" | "spritesheet-json";
  fixedTopbar: boolean;
  fontSize: "large" | "medium" | "small";
  language: "zh-CN" | "en-US";
  launchOnStartup: boolean;
  minimizeOnStartup: boolean;
  pixelScaleMode: "nearest" | "linear";
  previewBackground: "checkerboard" | "dark" | "light" | "transparent";
  previewFpsLimit: 30 | 60 | 120;
  previewHardwareAcceleration: boolean;
  previewQuality: "balanced" | "performance" | "quality";
  reduceMotion: boolean;
  showPreviewGrid: boolean;
  panelBorderStrength: "clear" | "soft" | "standard";
  presetDictionaries: PresetDictionaries;
  sidebarDefaultState: "collapsed" | "expanded" | "remember";
  theme: "dark" | "light" | "system";
  uiDensity: "comfortable" | "compact" | "spacious";
  workspaceRoot: string;
}

export interface BackgroundRemovalRuntimeStatus {
  available: boolean;
  command: string;
  detail: string;
  version: string;
}

export interface BackgroundRemovalModelStatus {
  description: string;
  id: string;
  installed: boolean;
  label: string;
  path: string;
  recommended: boolean;
}

export interface WarmupBackgroundRemovalModelResult {
  message: string;
  model: string;
  modelPath: string;
  runtime: BackgroundRemovalRuntimeStatus;
}

export interface PresetDictionaryEntry {
  description: string;
  enabled: boolean;
  id: string;
  label: string;
  value: string;
}

export interface CharacterTraitDictionaryEntry extends PresetDictionaryEntry {
  category: "accessory" | "body" | "costume" | "effect" | "other" | "weapon";
  colors?: string[];
  entityTypes: Array<"boss" | "construct" | "creature" | "humanoid" | "spirit">;
  prompt: string;
}

export interface PresetDictionaries {
  characterFeatures: PresetDictionaryEntry[];
  characterStyles: PresetDictionaryEntry[];
  characterTraits: CharacterTraitDictionaryEntry[];
}

export function getAppHealth() {
  return invoke<AppHealth>("app_health");
}

export function getAppSettings() {
  return invoke<AppSettings>("get_app_settings");
}

export function saveAppSettings(settings: AppSettings) {
  return invoke<AppSettings>("save_app_settings", { settings });
}

export function testBackgroundRemovalRuntime(input: {
  executablePath?: string;
}) {
  return invoke<BackgroundRemovalRuntimeStatus>("test_background_removal_runtime", { input });
}

export function listBackgroundRemovalModels() {
  return invoke<BackgroundRemovalModelStatus[]>("list_background_removal_models");
}

export function warmupBackgroundRemovalModel(input: {
  executablePath?: string;
  model: AppSettings["backgroundRemovalModel"];
  modelPath?: string;
}) {
  return invoke<WarmupBackgroundRemovalModelResult>("warmup_background_removal_model", { input });
}

export type AiModelProviderType = "foreign" | "domestic" | "local" | "custom";

export interface AiModelProvider {
  apiBase: string;
  apiKey: string;
  createdAt: number;
  id: string;
  imageModel: string;
  isDefault: boolean;
  name: string;
  preset: string;
  providerType: AiModelProviderType;
  textModel: string;
  updatedAt: number;
}

export interface AiProviderTestResult {
  message: string;
  ok: boolean;
}

export type AiProviderModelKind = "audio" | "embedding" | "image" | "image-edit" | "rerank" | "text" | "vision";

export interface AiProviderRemoteModel {
  defaultHeight?: number;
  defaultWidth?: number;
  displayName: string;
  modelKind: AiProviderModelKind;
  name: string;
  ready?: boolean;
}

export interface AiProviderModel {
  contextLength: number;
  createdAt: number;
  defaultHeight: number;
  defaultTemperature: number;
  defaultWidth: number;
  displayName: string;
  id: string;
  isDefault: boolean;
  isEnabled: boolean;
  maxOutputTokens: number;
  modelKind: AiProviderModelKind;
  name: string;
  providerId: string;
  updatedAt: number;
}

export function listAiModelProviders() {
  return invoke<AiModelProvider[]>("list_ai_model_providers");
}

export function listAiProviderModels(providerId?: string) {
  return invoke<AiProviderModel[]>("list_ai_provider_models", { providerId });
}

export function saveAiModelProvider(provider: AiModelProvider) {
  return invoke<AiModelProvider>("save_ai_model_provider", { provider });
}

export function saveAiProviderModel(model: AiProviderModel) {
  return invoke<AiProviderModel>("save_ai_provider_model", { model });
}

export function deleteAiModelProvider(providerId: string) {
  return invoke<void>("delete_ai_model_provider", { providerId });
}

export function deleteAiProviderModel(modelId: string) {
  return invoke<void>("delete_ai_provider_model", { modelId });
}

export function refreshAiProviderModels(provider: AiModelProvider) {
  return invoke<AiProviderRemoteModel[]>("refresh_ai_provider_models", { provider });
}

export function testAiModelProvider(provider: AiModelProvider) {
  return invoke<AiProviderTestResult>("test_ai_model_provider", { provider });
}

export interface AiTextGenerationRequest {
  maxTokens?: number;
  model?: string;
  prompt: string;
  providerId?: string;
  systemPrompt?: string;
  taskId?: string;
  temperature?: number;
}

export interface AiTextGenerationResult {
  content: string;
  model: string;
  providerId: string;
  providerName: string;
}

export function generateAiText(request: AiTextGenerationRequest) {
  return invoke<AiTextGenerationResult>("generate_ai_text", { request });
}

export function runAssetTool(input: RunAssetToolInput) {
  return invoke<AssetToolResult>("run_asset_tool", { input });
}

export function loadAssetToolSourcePreview(input: LoadAssetToolSourcePreviewInput) {
  return invoke<AssetToolSourcePreview>("load_asset_tool_source_preview", { input });
}

export function createCharacterAsset(input: CreateCharacterAssetInput) {
  return invoke<CharacterAssetRecord>("create_character_asset", { input });
}

export function getCharacterAsset(projectRoot: string, characterId: string) {
  return invoke<CharacterAssetRecord>("get_character_asset", { characterId, projectRoot });
}

export function deleteCharacterAsset(projectRoot: string, characterId: string) {
  return invoke<void>("delete_character_asset", {
    input: { characterId, projectRoot },
  });
}

export function toggleCharacterFavorite(projectRoot: string, characterId: string, favorite: boolean) {
  return invoke<CharacterAssetRecord>("toggle_character_favorite", {
    input: { characterId, favorite, projectRoot },
  });
}

export interface CharacterMasterCandidateImage {
  directionPreviews?: Partial<Record<"back" | "front" | "left" | "right", CharacterImageAsset>>;
  generationWarnings?: string[];
  image: CharacterImageAsset;
  planId: string;
}

export interface ProjectCharacterArchetype {
  description: string;
  id: string;
  label: string;
  patch: Partial<CharacterWorkshopDraft>;
}

export function listProjectCharacterArchetypes(projectRoot: string) {
  return invoke<ProjectCharacterArchetype[]>("list_project_character_archetypes", {
    input: { projectRoot },
  });
}

export function saveProjectCharacterArchetype(projectRoot: string, archetype: ProjectCharacterArchetype) {
  return invoke<ProjectCharacterArchetype>("save_project_character_archetype", {
    input: { archetype, projectRoot },
  });
}

export function deleteProjectCharacterArchetype(projectRoot: string, id: string) {
  return invoke<void>("delete_project_character_archetype", {
    input: { id, projectRoot },
  });
}

export function optimizeCharacterDescription(input: {
  classOrOccupation: string;
  description: string;
  entityType: string;
  model: string;
  providerId: string;
  role: string;
}) {
  return invoke<string>("optimize_character_description", { input });
}

export function generateCharacterMasterCandidates(input: {
  compiledPrompt?: string;
  draft: CharacterWorkshopDraft;
  masterPlan: CharacterMasterPlan;
  projectRoot: string;
  taskId: string;
}) {
  return invokeWithLog<CharacterMasterCandidateImage[]>(
    "generate_character_master_candidates",
    { input },
    { scope: "tauri.command", taskId: input.taskId },
  );
}

export function generateCharacterMasterImage(projectRoot: string, characterId: string) {
  return invokeWithLog<CharacterAssetRecord>(
    "generate_character_master_image",
    { input: { characterId, projectRoot } },
    { scope: "tauri.command", characterId },
  );
}

export function removeCharacterBackground(input: {
  alphaMatting?: boolean;
  backgroundThreshold?: number;
  characterId: string;
  cleanupStrength?: AppSettings["backgroundRemovalCleanupStrength"];
  customModelPath?: string;
  edgeSoftness?: number;
  engine?: "chroma" | "rembg";
  executablePath?: string;
  foregroundThreshold?: number;
  holeFillMaxPixels?: number;
  model?: AppSettings["backgroundRemovalModel"];
  preserveSmallParts?: boolean;
  projectRoot: string;
  spillSuppression?: number;
  tolerance?: number;
  viewId?: string;
}) {
  return invoke<CharacterAssetRecord>("remove_character_background", { input });
}

export function bindCharacterToolResult(input: {
  bbox?: AssetToolResult["bbox"];
  characterId: string;
  outputImage: AssetToolResult["outputImage"];
  projectRoot: string;
  score?: number;
  viewId?: string;
  warnings: string[];
}) {
  return invoke<CharacterAssetRecord>("bind_character_tool_result", { input });
}

export function prepareCharacterViewStyle(input: {
  characterId: string;
  projectRoot: string;
}) {
  return invoke<CharacterAssetRecord>("prepare_character_view_style", { input });
}

export function generateCharacterViewImages(input: {
  characterId: string;
  generationStrategy?: string;
  projectRoot: string;
  referenceMode?: string;
  referenceStrength?: number;
  viewMode?: string;
  views?: string[];
}) {
  return invoke<CharacterAssetRecord>("generate_character_view_images", { input });
}

export function importCharacterReferenceImages(input: ImportCharacterReferenceImagesInput) {
  return invoke<CharacterReferenceImageAsset[]>("import_character_reference_images", { input });
}

export function listCharacterAssets(projectRoot: string) {
  return invoke<CharacterAssetRecord[]>("list_character_assets", { projectRoot });
}

export function listCharacterLibrary(projectRoot: string) {
  return invoke<CharacterLibraryRecord[]>("list_character_library", { projectRoot });
}

export function hydrateCharacterActionPreviews(input: {
  actionId: string;
  characterId: string;
  projectRoot: string;
}) {
  return invoke<CharacterActionTrack>("hydrate_character_action_previews", { input });
}

export interface CharacterSummary {
  displayName: string;
  id: string;
}

export function listCharacterSummaries(projectRoot: string) {
  return invoke<CharacterSummary[]>("list_character_summaries", { projectRoot });
}

export interface ProjectManifestInput {
  name: string;
  rootPath: string;
}

export function createProjectManifest(input: ProjectManifestInput) {
  const { name, rootPath } = input;

  return invoke<PipelineProject>("create_project_manifest", { name, rootPath });
}

export interface CreateProjectInput {
  category: ProjectCategory;
  coverImageSource?: string;
  description: string;
  name: string;
  rootPath: string;
  slug: string;
  tags: string[];
}

export function createProject(input: CreateProjectInput) {
  const { category, coverImageSource, description, name, rootPath, slug, tags } = input;

  return invoke<PipelineProject>("create_project", {
    category,
    coverImageSource,
    description,
    name,
    rootPath,
    slug,
    tags,
  });
}

export interface OpenProjectInput {
  projectPath: string;
}

export function openProject(input: OpenProjectInput) {
  const { projectPath } = input;

  return invoke<PipelineProject>("open_project", { projectPath });
}

export function listRecentProjects() {
  return invoke<RecentProject[]>("list_recent_projects");
}

export function listWorkflowDefinitions(projectRoot: string) {
  return invoke<WorkflowDefinition[]>("list_workflow_definitions", { projectRoot });
}

export function getWorkflowDefinition(projectRoot: string, workflowId: string) {
  return invoke<WorkflowDefinition>("get_workflow_definition", { projectRoot, workflowId });
}

export function saveWorkflowDefinition(projectRoot: string, definition: WorkflowDefinition) {
  return invoke<WorkflowDefinition>("save_workflow_definition", { input: { definition, projectRoot } });
}

export function deleteWorkflowDefinition(projectRoot: string, workflowId: string) {
  return invoke<void>("delete_workflow_definition", { input: { projectRoot, workflowId } });
}

export function exportWorkflowDefinition(path: string, definition: WorkflowDefinition) {
  return invoke<void>("export_workflow_definition", { input: { definition, path } });
}

export function importWorkflowFromFile(path: string) {
  return invoke<WorkflowDefinition>("import_workflow_from_file", { input: { path } });
}

export function preflightWorkflow(projectRoot: string, definition: WorkflowDefinition, nodeIds?: string[]) {
  return invoke<void>("preflight_workflow", {
    input: { definition, nodeIds: nodeIds ?? [], projectRoot },
  });
}

export function runWorkflow(projectRoot: string, definition: WorkflowDefinition, nodeIds?: string[]) {
  return invokeWithLog<WorkflowRun>(
    "run_workflow",
    { input: { definition, nodeIds: nodeIds ?? [], projectRoot } },
    { scope: "tauri.command", workflowId: definition.id },
  );
}

export function cancelWorkflowRun(projectRoot: string, runId: string) {
  return invoke<void>("cancel_workflow_run", { input: { projectRoot, runId } });
}

export function listWorkflowNodeDescriptors() {
  return invoke<WorkflowNodeDescriptor[]>("list_workflow_node_descriptors");
}

export interface WorkflowNodeDescriptor {
  category: string;
  color: string;
  description: string;
  helpText: string;
  id: string;
  inputs: Array<{ id: string; kind: string; label: string }>;
  label: string;
  layer?: string;
  outputs: Array<{ id: string; kind: string; label: string }>;
  paramGroups?: Array<{ id: string; label: string }>;
  params: Array<{
    advanced?: boolean;
    binding?: string;
    defaultValue?: unknown;
    description?: string;
    display?: string;
    group?: string;
    id: string;
    label: string;
    max?: number;
    min?: number;
    options?: Array<{ label: string; value: string }>;
    required?: boolean;
    type: string;
    widget?: string;
  }>;
  status: string;
}

export function retryWorkflowNode(projectRoot: string, runId: string, nodeId: string) {
  return invoke<WorkflowRun>("retry_workflow_node", { input: { nodeId, projectRoot, runId } });
}

export function resumeWorkflowRun(projectRoot: string, runId: string, nodeId: string, decision: unknown) {
  return invokeWithLog<WorkflowRun>(
    "resume_workflow_run",
    { input: { decision, nodeId, projectRoot, runId } },
    { scope: "tauri.command", nodeId, runId },
  );
}

export function getWorkflowRun(projectRoot: string, runId: string) {
  return invoke<WorkflowRun>("get_workflow_run", { projectRoot, runId });
}

export function listWorkflowRuns(projectRoot: string, workflowId?: string) {
  return invoke<WorkflowRun[]>("list_workflow_runs", { projectRoot, workflowId });
}

export interface WorkflowAwaitingInputContext {
  allowMultiple: boolean;
  nodeId: string;
  nodeKind: string;
  options: Array<{ label: string; value: string }>;
  previewImages: Array<{
    absolutePath?: string;
    label?: string;
    planId: string;
    projectRelativePath?: string;
  }>;
  prompt: string;
  runId: string;
  workflowId: string;
}

export function getWorkflowAwaitingInput(projectRoot: string, workflowId?: string) {
  return invoke<WorkflowAwaitingInputContext | null>("get_workflow_awaiting_input", {
    input: { projectRoot, workflowId },
  });
}

export interface StylePresetRecord {
  createdAt: number;
  id: string;
  isBuiltin: boolean;
  label: string;
  params: Record<string, unknown>;
  tagline: string;
  tags: string[];
  thumbnail: string;
  updatedAt: number;
}

export interface SaveStylePresetInput {
  id: string;
  label: string;
  params: Record<string, unknown>;
  tagline: string;
  tags: string[];
  thumbnail: string;
}

export function listStylePresets() {
  return invoke<StylePresetRecord[]>("list_style_presets");
}

export function getStylePresetRecord(id: string) {
  return invoke<StylePresetRecord | null>("get_style_preset", { id });
}

export function saveStylePreset(input: SaveStylePresetInput) {
  return invoke<StylePresetRecord>("save_style_preset", { input });
}

export function deleteStylePreset(id: string) {
  return invoke<void>("delete_style_preset", { id });
}
