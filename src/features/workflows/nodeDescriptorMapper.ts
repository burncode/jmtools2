import {
  Ban,
  Bot,
  Box,
  Clapperboard,
  Film,
  Eye,
  FileCode2,
  FileOutput,
  FileText,
  GitMerge,
  Hand,
  Image,
  Images,
  LayoutGrid,
  Link2,
  Lock,
  Package,
  Palette,
  Ruler,
  ScanEye,
  ScanSearch,
  Scissors,
  Shirt,
  Sparkles,
  SlidersHorizontal,
  UserPlus,
  UserRound,
  WandSparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { WorkflowNodeCategory, WorkflowNodeDefinition, WorkflowNodeKind, WorkflowParamDefinition, WorkflowPortKind } from "./types";

export interface RawWorkflowNodeDescriptor {
  category: WorkflowNodeCategory;
  color: WorkflowNodeDefinition["color"];
  description: string;
  helpText: string;
  id: WorkflowNodeKind;
  inputs: Array<{ id: string; kind: WorkflowPortKind; label: string }>;
  label: string;
  layer?: WorkflowNodeDefinition["layer"];
  outputs: Array<{ id: string; kind: WorkflowPortKind; label: string }>;
  paramGroups?: WorkflowParamGroupDefinition[];
  params: Array<{
    defaultValue?: unknown;
    description?: string;
    group?: string;
    id: string;
    label: string;
    max?: number;
    min?: number;
    options?: Array<{ label: string; value: string }>;
    required?: boolean;
    type: WorkflowParamDefinition["type"];
    display?: WorkflowParamDefinition["display"];
    validate?: {
      pattern?: string;
    };
    widget?: WorkflowParamDefinition["widget"];
    binding?: WorkflowParamDefinition["binding"];
    advanced?: boolean;
  }>;
  status: "available" | "planned";
}

type WorkflowParamGroupDefinition = {
  id: string;
  label: string;
};

const NODE_ICONS: Record<WorkflowNodeKind, LucideIcon> = {
  "ai.imageGenerate": Sparkles,
  "ai.negativePrompt": Ban,
  "ai.prompt": Bot,
  "character.analyze": ScanSearch,
  "character.bindToolResult": Link2,
  "character.create": UserPlus,
  "character.generateActionFrames": Clapperboard,
  "character.generateCandidates": Images,
  "character.generatePlan": FileText,
  "character.generateViews": ScanEye,
  "character.inputSeed": UserRound,
  "character.load": UserRound,
  "character.normalize": Ruler,
  "character.outfitProfile": Shirt,
  "character.removeBackground": Scissors,
  "character.styleProfile": Palette,
  "control.consistencyLock": Lock,
  "control.manualGate": Hand,
  "control.referenceStrength": SlidersHorizontal,
  "control.seedLock": Lock,
  "image.input": Image,
  "logic.promptCompiler": GitMerge,
  "logic.promptMerge": GitMerge,
  "output.animationExport": Clapperboard,
  "output.asset": Box,
  "output.atlasPack": Package,
  "output.godotSpriteFrames": FileCode2,
  "output.spriteSplit": LayoutGrid,
  "output.spritesheet": FileOutput,
  "preview.actionSequence": Film,
  "preview.image": Eye,
  "tool.backgroundRemoval": Scissors,
};

export function mapRawDescriptor(descriptor: RawWorkflowNodeDescriptor): WorkflowNodeDefinition {
  const inputKinds = [...new Set(descriptor.inputs.map((port) => port.kind))];
  const outputKinds = [...new Set(descriptor.outputs.map((port) => port.kind))];

  return {
    category: descriptor.category,
    color: descriptor.color,
    description: descriptor.description,
    helpText: descriptor.helpText,
    icon: NODE_ICONS[descriptor.id] ?? WandSparkles,
    inputKinds,
    inputs: descriptor.inputs,
    kind: descriptor.id,
    label: descriptor.label,
    layer: descriptor.layer,
    outputKinds,
    outputs: descriptor.outputs,
    paramGroups: descriptor.paramGroups,
    paramsSchema: descriptor.params.map((param) => ({
      advanced: param.advanced,
      binding: param.binding,
      defaultValue: param.defaultValue,
      description: param.description,
      display: param.display,
      group: param.group,
      id: param.id,
      label: param.label,
      max: param.max,
      min: param.min,
      options: param.options,
      required: param.required,
      type: param.type,
      validate: param.validate,
      widget: param.widget,
    })),
    status: descriptor.status,
  };
}
