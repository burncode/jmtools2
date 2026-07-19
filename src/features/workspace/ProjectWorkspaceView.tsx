import { useEffect, useState } from "react";

import { AppPageShell } from "@/components/shared";
import { listWorkflowNodeDescriptors } from "@/lib/tauri/commands";

import { CharacterWorkshopView } from "../characters/CharacterWorkshopView";
import type { PipelineProject } from "../projects/types";
import { AssetToolWorkspaceView } from "../tools/AssetToolWorkspaceView";
import { initWorkflowNodeRegistry } from "../workflows/nodeCatalog";
import { WorkflowErrorBoundary } from "../workflows/WorkflowErrorBoundary";
import { WorkflowWorkbenchView } from "../workflows/WorkflowWorkbenchView";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { PipelineTaskPanel } from "./components/PipelineTaskPanel";
import { ProductionModuleGrid } from "./components/ProductionModuleGrid";
import { ProjectCoverSummary } from "./components/ProjectCoverSummary";
import { ProjectInspectorPanel } from "./components/ProjectInspectorPanel";
import { RecentWorkPanel } from "./components/RecentWorkPanel";
import { WorkspaceSidebar } from "./components/WorkspaceSidebar";
import { WorkspaceTopbar } from "./components/WorkspaceTopbar";

interface ProjectWorkspaceViewProps {
  onBackHome: () => void;
  onOpenProject: () => void;
  project: PipelineProject;
}

function getWorkflowPanelClassName(isActive: boolean) {
  return isActive ? "project-workspace-panel" : "project-workspace-panel project-workspace-panel-hidden";
}

export function ProjectWorkspaceView({ onBackHome, onOpenProject, project }: ProjectWorkspaceViewProps) {
  const activePanel = useWorkspaceStore((state) => state.activePanel);
  const isWorkflowWorkbench = activePanel === "workflow";
  const isCharacterWorkshop = activePanel === "characters";
  const isAssetToolWorkspace = activePanel === "assetTools";
  const isOverviewPanel = !isWorkflowWorkbench && !isCharacterWorkshop && !isAssetToolWorkspace;
  const [workflowMounted, setWorkflowMounted] = useState(false);

  useEffect(() => {
    void initWorkflowNodeRegistry(listWorkflowNodeDescriptors);
  }, []);

  useEffect(() => {
    if (activePanel === "workflow") {
      setWorkflowMounted(true);
    }
  }, [activePanel]);

  return (
    <main className="project-workspace-shell">
      <WorkspaceSidebar />
      <section className="project-workspace">
        <AppPageShell className="project-page-shell" size="workbench">
          <WorkspaceTopbar onBackHome={onBackHome} onOpenProject={onOpenProject} project={project} />
          <div className={`project-workspace-content ${!isOverviewPanel ? "single-column-workspace" : ""}`}>
            {workflowMounted ? (
              <div
                aria-hidden={!isWorkflowWorkbench}
                className={getWorkflowPanelClassName(isWorkflowWorkbench)}
                hidden={!isWorkflowWorkbench}
              >
                <WorkflowErrorBoundary>
                  <WorkflowWorkbenchView isActive={isWorkflowWorkbench} project={project} />
                </WorkflowErrorBoundary>
              </div>
            ) : null}
            {isCharacterWorkshop ? (
              <div className="project-workspace-panel">
                <CharacterWorkshopView project={project} />
              </div>
            ) : null}
            {isAssetToolWorkspace ? (
              <div className="project-workspace-panel">
                <AssetToolWorkspaceView project={project} />
              </div>
            ) : null}
            {isOverviewPanel ? (
              <div className="project-workspace-overview">
                <div className="project-workspace-main">
                  <ProjectCoverSummary project={project} />
                  <ProductionModuleGrid />
                  <div className="workspace-bottom-grid">
                    <RecentWorkPanel />
                    <PipelineTaskPanel />
                  </div>
                </div>
                <ProjectInspectorPanel project={project} />
              </div>
            ) : null}
          </div>
        </AppPageShell>
      </section>
    </main>
  );
}
