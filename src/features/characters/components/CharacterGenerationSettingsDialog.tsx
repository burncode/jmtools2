import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { CharacterLibraryRecord } from "../types";
import { CharacterGenerationSettingsPanel } from "./CharacterGenerationSettingsPanel";

interface CharacterGenerationSettingsDialogProps {
  libraryRecords: CharacterLibraryRecord[];
  onClose: () => void;
  open: boolean;
  projectRoot: string;
}

export function CharacterGenerationSettingsDialog({
  libraryRecords,
  onClose,
  open,
  projectRoot,
}: CharacterGenerationSettingsDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="character-generation-modal-backdrop" onClick={onClose} role="presentation">
      <section
        aria-label="项目角色生成配置"
        className="character-generation-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="character-generation-modal-header">
          <div>
            <strong>项目角色生成配置</strong>
            <p>风格锚点、布局基准与生成模板会写入 jmproject.json。</p>
          </div>
          <Button aria-label="关闭" onClick={onClose} type="button" variant="ghost">
            <X aria-hidden="true" />
          </Button>
        </header>
        <div className="character-generation-modal-body">
          <CharacterGenerationSettingsPanel libraryRecords={libraryRecords} projectRoot={projectRoot} />
        </div>
      </section>
    </div>
  );
}
