import { LoaderCircle } from "lucide-react";

import { Card } from "@/components/ui/card";

interface CharacterProductionLoadingPlaceholderProps {
  characterId?: string;
  displayName?: string;
}

export function CharacterProductionLoadingPlaceholder({
  characterId,
  displayName,
}: CharacterProductionLoadingPlaceholderProps) {
  return (
    <Card aria-busy="true" aria-live="polite" className="character-production-loading-placeholder">
      <LoaderCircle aria-hidden="true" className="character-production-loading-icon" />
      <div>
        <strong>{displayName ? `正在打开「${displayName}」` : "正在加载角色"}</strong>
        <p>{characterId ? `角色 ID：${characterId}` : "请稍候…"}</p>
      </div>
    </Card>
  );
}
