import {
  generateAiText,
  type AiTextGenerationRequest,
} from "@/lib/tauri/commands";

export interface GeneratePipelineTextInput {
  maxTokens?: number;
  model?: string;
  prompt: string;
  providerId?: string;
  systemPrompt?: string;
  taskId?: string;
  temperature?: number;
}

export function generatePipelineText(input: GeneratePipelineTextInput) {
  const request: AiTextGenerationRequest = {
    maxTokens: input.maxTokens,
    model: input.model,
    prompt: input.prompt,
    providerId: input.providerId,
    systemPrompt: input.systemPrompt,
    taskId: input.taskId,
    temperature: input.temperature,
  };

  return generateAiText(request);
}
