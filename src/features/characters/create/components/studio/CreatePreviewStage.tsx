import type { ReactNode } from "react";

import { GridPatternBackground } from "@/components/shared";
import { cn } from "@/lib/utils";

interface CreatePreviewStageProps {
  children: ReactNode;
  className?: string;
}

export function CreatePreviewStage({ children, className }: CreatePreviewStageProps) {
  return (
    <GridPatternBackground className={cn("character-create-preview-stage", className)}>
      <div className="character-create-preview-stage-inner">{children}</div>
    </GridPatternBackground>
  );
}
