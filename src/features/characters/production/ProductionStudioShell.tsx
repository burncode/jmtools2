import { useEffect } from "react";

import { CharacterActionWorkspace } from "../components/CharacterActionWorkspace";
import type { CharacterAssetRecord } from "../types";
import { useCharacterProductionLogStore } from "@/stores/characterProductionLogStore";

import "./ProductionStudio.css";

interface ProductionStudioShellProps {
  onRecordChange: (record: CharacterAssetRecord) => void;
  project: { rootPath: string };
  record: CharacterAssetRecord;
}

export function ProductionStudioShell({ onRecordChange, project, record }: ProductionStudioShellProps) {
  const setCharacterScope = useCharacterProductionLogStore((state) => state.setCharacterScope);

  useEffect(() => {
    setCharacterScope(record.id);
  }, [record.id, setCharacterScope]);

  return (
    <div className="character-production-studio character-production-studio-layout">
      <div className="character-production-studio-body">
        <CharacterActionWorkspace onRecordChange={onRecordChange} projectRoot={project.rootPath} record={record} />
      </div>
    </div>
  );
}
