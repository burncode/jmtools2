import nodeDescriptors from "@shared/workflow-nodes/nodes.json";

import type { WorkflowNodeDescriptor } from "@/lib/tauri/commands";

import { mapRawDescriptor, type RawWorkflowNodeDescriptor } from "./nodeDescriptorMapper";
import type { WorkflowNodeDefinition, WorkflowNodeKind, WorkflowParamDefinition } from "./types";

const fallbackCatalog = (nodeDescriptors as RawWorkflowNodeDescriptor[]).map(mapRawDescriptor);

let runtimeCatalog: WorkflowNodeDefinition[] | undefined;
let initPromise: Promise<void> | undefined;

export const workflowNodeCatalog = fallbackCatalog;

export function getWorkflowNodeCatalog() {
  return runtimeCatalog ?? fallbackCatalog;
}

export function getWorkflowNodeDefinition(kind: WorkflowNodeKind) {
  return getWorkflowNodeCatalog().find((node) => node.kind === kind);
}

export function listAvailableWorkflowNodes() {
  return getWorkflowNodeCatalog().filter((node) => node.status === "available");
}

export function initWorkflowNodeRegistry(loadDescriptors: () => Promise<WorkflowNodeDescriptor[]>): Promise<void> {
  if (!initPromise) {
    initPromise = loadAndApplyDescriptors(loadDescriptors);
  }

  return initPromise;
}

async function loadAndApplyDescriptors(loadDescriptors: () => Promise<WorkflowNodeDescriptor[]>) {
  try {
    const descriptors = await loadDescriptors();
    runtimeCatalog = descriptors.map((descriptor) => {
      const fallback = fallbackCatalog.find((node) => node.kind === descriptor.id);
      const mergedParams = mergeParamUiMetadata(
        descriptor.params as RawWorkflowNodeDescriptor["params"],
        fallback?.paramsSchema,
      );

      return mapRawDescriptor({
        category: descriptor.category as RawWorkflowNodeDescriptor["category"],
        color: descriptor.color as RawWorkflowNodeDescriptor["color"],
        description: descriptor.description,
        helpText: descriptor.helpText,
        id: descriptor.id as WorkflowNodeKind,
        inputs: descriptor.inputs as RawWorkflowNodeDescriptor["inputs"],
        label: descriptor.label,
        layer: descriptor.layer as RawWorkflowNodeDescriptor["layer"],
        outputs: descriptor.outputs as RawWorkflowNodeDescriptor["outputs"],
        paramGroups: descriptor.paramGroups as RawWorkflowNodeDescriptor["paramGroups"],
        params: mergedParams,
        status: descriptor.status as RawWorkflowNodeDescriptor["status"],
      });
    });

    if (import.meta.env.DEV) {
      validateDescriptorParity(descriptors);
    }
  } catch (error) {
    runtimeCatalog = undefined;
    if (import.meta.env.DEV) {
      console.warn("工作流节点描述符运行时加载失败，已回退到构建时 JSON。", error);
    }
  }
}

function mergeParamUiMetadata(
  runtimeParams: RawWorkflowNodeDescriptor["params"],
  fallbackParams?: WorkflowParamDefinition[],
): RawWorkflowNodeDescriptor["params"] {
  if (!fallbackParams?.length) {
    return runtimeParams;
  }

  const fallbackById = new Map(fallbackParams.map((param) => [param.id, param]));

  return runtimeParams.map((param) => {
    const fallback = fallbackById.get(param.id);
    if (!fallback) {
      return param;
    }

    return {
      ...param,
      advanced: param.advanced ?? fallback.advanced,
      binding: param.binding ?? fallback.binding,
      description: param.description || fallback.description,
      display: param.display ?? fallback.display,
      options: param.options?.length ? param.options : fallback.options,
      required: param.required ?? fallback.required,
      validate: param.validate ?? fallback.validate,
      widget: param.widget ?? fallback.widget,
    };
  });
}

function validateDescriptorParity(runtimeDescriptors: WorkflowNodeDescriptor[]) {
  const runtimeIds = new Set(runtimeDescriptors.map((descriptor) => descriptor.id));
  const fallbackIds = new Set(fallbackCatalog.map((descriptor) => descriptor.kind));
  const missingInRuntime = [...fallbackIds].filter((id) => !runtimeIds.has(id));
  const missingInFallback = [...runtimeIds].filter((id) => !fallbackIds.has(id as WorkflowNodeKind));

  if (missingInRuntime.length || missingInFallback.length) {
    console.warn("工作流节点描述符不一致：", { missingInFallback, missingInRuntime });
  }
}
