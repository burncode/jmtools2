import { ArrowLeft, ExternalLink, Plus, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { type AppSettings, getAppSettings } from "@/lib/tauri/commands";
import { setProjectLayoutAnchorCharacter } from "@/lib/tauri/projectCharacterGeneration";
import { useWorkspaceStore } from "@/stores/workspaceStore";

import type { PipelineProject } from "../projects/types";
import { defaultSettings } from "../settings/settingsDefaults";
import "./CharacterWorkshop.css";
import { CharacterAssetLibraryView } from "./components/CharacterAssetLibraryView";
import { CharacterGenerationSettingsDialog } from "./components/CharacterGenerationSettingsDialog";
import { CharacterPipelineProgressBar } from "./components/CharacterPipelineProgressBar";
import { CreateStudioShell } from "./create/CreateStudioShell";
import { useCharacterLibraryList, useCharacterRecord, useCharacterRecordMutations } from "./hooks/useCharacterRecord";
import { useCharacterPipeline } from "./pipeline/useCharacterPipeline";
import { ProductionStudioShell } from "./production/ProductionStudioShell";
import { CharacterExportPopover } from "./production/CharacterExportPopover";
import { CharacterProductionLogPopover } from "./production/CharacterProductionLogPopover";
import { CharacterProductionLoadingPlaceholder } from "./production/CharacterProductionLoadingPlaceholder";
import {
  createPhaseLabels,
  productionTabLabels,
  useCharacterWorkshopStore,
  type CreatePhase,
  type ProductionTab,
} from "./stores/characterWorkshopStore";
import type { CharacterAssetRecord, CharacterLibraryRecord } from "./types";
import { appLogger } from "@/lib/logger";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

interface CharacterWorkshopViewProps {
  project: PipelineProject;
}

export function CharacterWorkshopView({ project }: CharacterWorkshopViewProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <CharacterWorkshopContent project={project} />
    </QueryClientProvider>
  );
}

function CharacterWorkshopContent({ project }: CharacterWorkshopViewProps) {
  const mode = useCharacterWorkshopStore((state) => state.mode);
  const selectedCharacterId = useCharacterWorkshopStore((state) => state.selectedCharacterId);
  const setProjectRoot = useCharacterWorkshopStore((state) => state.setProjectRoot);
  const openCreate = useCharacterWorkshopStore((state) => state.openCreate);
  const openLibrary = useCharacterWorkshopStore((state) => state.openLibrary);
  const openProduction = useCharacterWorkshopStore((state) => state.openProduction);
  const setCreatePhase = useCharacterWorkshopStore((state) => state.setCreatePhase);
  const characterWorkshopIntent = useWorkspaceStore((state) => state.characterWorkshopIntent);
  const clearCharacterWorkshopIntent = useWorkspaceStore((state) => state.clearCharacterWorkshopIntent);
  const openWorkflowWithIntent = useWorkspaceStore((state) => state.openWorkflowWithIntent);

  const [appSettings, setAppSettings] = useState<AppSettings>(defaultSettings);
  const [showGenerationSettings, setShowGenerationSettings] = useState(false);
  const { data: libraryRecords = [], error: listError, isLoading } = useCharacterLibraryList(project.rootPath);
  const { data: selectedCharacter, refetch: refetchSelectedCharacter } = useCharacterRecord(
    project.rootPath,
    mode === "production" ? selectedCharacterId : undefined,
  );
  const { deleteCharacter, invalidateCharacter, toggleFavorite } = useCharacterRecordMutations(project.rootPath);
  const { segments } = useCharacterPipeline(selectedCharacter);

  useEffect(() => {
    setProjectRoot(project.rootPath);
  }, [project.rootPath, setProjectRoot]);

  useEffect(() => {
    void getAppSettings()
      .then((settings) => setAppSettings({ ...defaultSettings, ...settings }))
      .catch(() => undefined);
  }, [setAppSettings]);

  useEffect(() => {
    if (!characterWorkshopIntent) {
      return;
    }

    if (characterWorkshopIntent.mode === "create") {
      openCreate();
      if (characterWorkshopIntent.createPhase) {
        const session = useCharacterWorkshopStore.getState().createGenerationSession;
        if (characterWorkshopIntent.createPhase === "review" && session.status !== "success") {
          setCreatePhase("setup");
        } else {
          setCreatePhase(characterWorkshopIntent.createPhase);
        }
      }
    } else if (characterWorkshopIntent.mode === "production" && characterWorkshopIntent.characterId) {
      openProduction(characterWorkshopIntent.characterId, characterWorkshopIntent.productionTab);
    } else {
      openLibrary();
    }

    clearCharacterWorkshopIntent();
  }, [
    characterWorkshopIntent,
    clearCharacterWorkshopIntent,
    openCreate,
    openLibrary,
    openProduction,
    setCreatePhase,
  ]);

  async function handleOpenCharacter(record: CharacterLibraryRecord) {
    openProduction(record.id, "actions");
    await refetchSelectedCharacter();
  }

  async function handleToggleFavorite(record: CharacterLibraryRecord) {
    try {
      await toggleFavorite.mutateAsync({ characterId: record.id, favorite: !record.favorite });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await appLogger.error(`更新角色收藏状态失败：id=${record.id} message=${message}`);
    }
  }

  async function handleDeleteCharacter(record: CharacterLibraryRecord) {
    const isConfirmed = window.confirm(`确定删除角色「${record.displayName}」？此操作会移除项目内的角色资产目录。`);
    if (!isConfirmed) {
      return;
    }

    try {
      await deleteCharacter.mutateAsync(record.id);
      if (selectedCharacterId === record.id) {
        openLibrary();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await appLogger.error(`删除角色资产失败：id=${record.id} message=${message}`);
    }
  }

  function handleRecordChange(record: CharacterAssetRecord) {
    invalidateCharacter(record);
  }

  async function handleSetLayoutAnchor(record: CharacterAssetRecord) {
    try {
      await setProjectLayoutAnchorCharacter(project.rootPath, record.id);
      await appLogger.info(`已将「${record.displayName}」设为项目布局基准角色。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await appLogger.error(`设置布局基准失败：${message}`);
    }
  }

  const stylePresets = getEnabledStylePresets(appSettings);
  const header = getHeaderCopy(mode);
  const pendingProductionRecord = libraryRecords.find((record) => record.id === selectedCharacterId);

  return (
    <section className="character-workshop-view" data-mode={mode} aria-label={`${project.name} 角色工坊`}>
      {mode !== "create" ? (
        <header className="character-workshop-header">
          <div>
            <p className="panel-label">角色工坊</p>
            <h2>{header.title}</h2>
            <span>{header.description}</span>
          </div>
          <div className="character-workshop-header-actions">
            <Button onClick={() => setShowGenerationSettings(true)} type="button" variant="outline">
              <Settings2 aria-hidden="true" />
              生成配置
            </Button>
            {mode !== "library" ? (
              <Button onClick={openLibrary} type="button" variant="outline">
                <ArrowLeft aria-hidden="true" />
                返回资产库
              </Button>
            ) : (
              <Button onClick={openCreate} type="button">
                <Plus aria-hidden="true" />
                新建角色
              </Button>
            )}
            {selectedCharacter && mode === "production" ? (
              <>
                <Button onClick={() => void handleSetLayoutAnchor(selectedCharacter)} type="button" variant="outline">
                  设为布局基准
                </Button>
                <CharacterProductionLogPopover />
                <CharacterExportPopover projectRoot={project.rootPath} record={selectedCharacter} />
              </>
            ) : null}
            {selectedCharacter ? (
              <Button
                onClick={() =>
                  openWorkflowWithIntent({
                    characterId: selectedCharacter.id,
                    templateId: "character-full-pipeline",
                  })
                }
                type="button"
                variant="outline"
              >
                <ExternalLink aria-hidden="true" />
                在工作流中打开
              </Button>
            ) : null}
          </div>
        </header>
      ) : null}

      {mode === "library" ? (
        <CharacterAssetLibraryView
          error={listError instanceof Error ? listError.message : listError ? String(listError) : undefined}
          isLoading={isLoading}
          onCreateNew={openCreate}
          onDeleteRecord={(record) => void handleDeleteCharacter(record)}
          onOpenRecord={(record) => void handleOpenCharacter(record)}
          onToggleFavorite={(record) => void handleToggleFavorite(record)}
          projectRoot={project.rootPath}
          records={libraryRecords}
        />
      ) : null}

      {mode === "create" ? (
        <CreateStudioShell
          onCharacterCreated={(record) => {
            invalidateCharacter(record);
          }}
          onEnterProduction={(record) => {
            invalidateCharacter(record);
            openProduction(record.id, "actions");
          }}
          onExit={() => openLibrary()}
          project={project}
          stylePresets={stylePresets}
        />
      ) : null}

      {mode === "production" ? (
        <div className="character-workshop-production-body">
          {selectedCharacter ? (
            <div className="character-production-content-canvas">
              <CharacterPipelineProgressBar compact interactive={false} segments={segments} variant="full" />
              <ProductionStudioShell onRecordChange={handleRecordChange} project={project} record={selectedCharacter} />
            </div>
          ) : (
            <CharacterProductionLoadingPlaceholder
              characterId={selectedCharacterId}
              displayName={pendingProductionRecord?.displayName}
            />
          )}
        </div>
      ) : null}

      <CharacterGenerationSettingsDialog
        libraryRecords={libraryRecords}
        onClose={() => setShowGenerationSettings(false)}
        open={showGenerationSettings}
        projectRoot={project.rootPath}
      />
    </section>
  );
}

function getHeaderCopy(mode: "library" | "create" | "production") {
  if (mode === "create") {
    return {
      description: "左侧设定 · 中间预览画布 · 右侧 Prompt 与候选对比。",
      title: "创建工作室",
    };
  }
  if (mode === "production") {
    return {
      description: "左：角色摘要 · 中：动作卡片 · 右：预览；资产准备与帧后处理全自动，详见产线日志。",
      title: "生产工作室",
    };
  }
  return {
    description: "管理项目中的角色母版、产线状态与导出记录。",
    title: "资产库",
  };
}

function getEnabledStylePresets(settings: AppSettings) {
  const entries = settings.presetDictionaries.characterStyles
    .filter((entry) => entry.enabled && entry.label.trim() && entry.value.trim())
    .map((entry) => ({
      label: entry.label.trim(),
      value: entry.value.trim(),
    }));

  return entries.length > 0
    ? entries
    : defaultSettings.presetDictionaries.characterStyles.map((entry) => ({
        label: entry.label,
        value: entry.value,
      }));
}

export { createPhaseLabels, productionTabLabels };
export type { CreatePhase, ProductionTab };
