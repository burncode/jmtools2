import { ArrowLeft, RotateCcw, Sparkles } from "lucide-react";

import { GradientPrimaryButton, ProGlassPanel } from "@/components/shared";
import { Button } from "@/components/ui/button";

interface CreateStudioToolbarProps {
  displayName: string;
  entityLabel: string;
  roleLabel: string;
  isGenerating: boolean;
  canGenerate: boolean;
  canSave: boolean;
  isCreatingCharacter: boolean;
  showRetry: boolean;
  onExit: () => void;
  onGenerate: () => void;
  onFinalize: () => void;
}

export function CreateStudioToolbar({
  displayName,
  entityLabel,
  roleLabel,
  isGenerating,
  canGenerate,
  canSave,
  isCreatingCharacter,
  showRetry,
  onExit,
  onGenerate,
  onFinalize,
}: CreateStudioToolbarProps) {
  return (
    <ProGlassPanel className="character-create-studio-toolbar-card">
      <header className="character-create-studio-toolbar">
        <Button onClick={onExit} type="button" variant="outline">
          <ArrowLeft aria-hidden="true" />
          返回资产库
        </Button>
        <div className="character-create-studio-toolbar-title">
          <strong>{displayName}</strong>
          <span>
            {entityLabel} · {roleLabel}
          </span>
        </div>
        <div className="character-create-studio-toolbar-actions">
          {showRetry ? (
            <Button disabled={isGenerating} onClick={onGenerate} type="button" variant="outline">
              <RotateCcw aria-hidden="true" />
              重试
            </Button>
          ) : null}
          <GradientPrimaryButton disabled={isGenerating || !canGenerate} onClick={onGenerate} type="button">
            <Sparkles aria-hidden="true" />
            {isGenerating ? "生成中..." : "生成母版"}
          </GradientPrimaryButton>
          <Button disabled={!canSave || isCreatingCharacter} onClick={onFinalize} type="button" variant="secondary">
            入库
          </Button>
        </div>
      </header>
    </ProGlassPanel>
  );
}
