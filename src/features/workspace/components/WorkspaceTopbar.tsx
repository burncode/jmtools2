import { CheckCircle2, Download, FolderOpen, Home, Pencil, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { projectCategories } from "../../projects/projectOptions";
import type { PipelineProject } from "../../projects/types";

interface WorkspaceTopbarProps {
  onBackHome: () => void;
  onOpenProject: () => void;
  project: PipelineProject;
}

export function WorkspaceTopbar({ onBackHome, onOpenProject, project }: WorkspaceTopbarProps) {
  const categoryLabel = projectCategories.find((item) => item.value === project.category)?.label ?? "其他";

  return (
    <header className="project-topbar">
      <div className="project-title-block">
        <div className="project-title-row">
          <h2>{project.name}</h2>
          <Button aria-label="编辑项目名称" className="icon-ghost-button" type="button" variant="ghost">
            <Pencil aria-hidden="true" size={15} />
          </Button>
          <span className="project-type-badge">{categoryLabel}</span>
          <span className="save-state">
            <CheckCircle2 aria-hidden="true" size={14} />
            已保存：今天 14:30
          </span>
        </div>
        <span className="project-path">{project.rootPath}</span>
      </div>
      <label className="global-search project-search">
        <Search aria-hidden="true" size={18} />
        <Input aria-label="搜索项目素材" placeholder="搜索素材、模块、任务..." />
      </label>
      <div className="topbar-actions" aria-label="项目操作">
        <Button onClick={onBackHome} type="button" variant="outline">
          <Home aria-hidden="true" />
          返回首页
        </Button>
        <Button onClick={onOpenProject} type="button" variant="outline">
          <FolderOpen aria-hidden="true" />
          打开项目
        </Button>
        <Button className="primary-action" type="button">
          <Download aria-hidden="true" />
          导出
        </Button>
      </div>
    </header>
  );
}
