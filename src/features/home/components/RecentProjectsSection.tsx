import { FolderOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { HomeRecentProject } from "../types";
import { getRecentProjectCoverLabel, getRecentProjectStatus, getRecentProjectTags } from "../homeProjectDisplay";

interface RecentProjectsSectionProps {
  homeMessage: string;
  onOpenProject: () => void;
  onOpenRecentProject: (projectPath: string) => void;
  projects: HomeRecentProject[];
}

export function RecentProjectsSection({
  homeMessage,
  onOpenProject,
  onOpenRecentProject,
  projects,
}: RecentProjectsSectionProps) {
  return (
    <section className="home-section" aria-label="最近项目">
      <div className="section-heading">
        <div>
          <p className="panel-label">最近项目</p>
          <h3>继续上次的素材工程</h3>
        </div>
        <Button onClick={onOpenProject} type="button" variant="ghost">
          查看全部
        </Button>
      </div>
      {homeMessage ? <p className="dashboard-message">{homeMessage}</p> : null}
      <div className="recent-project-grid">
        {projects.map((project) => (
          <button
            aria-label={`打开项目 ${project.name}`}
            className="recent-project-card"
            key={`${project.name}-${project.path}`}
            onClick={() => onOpenRecentProject(project.path)}
            type="button"
          >
            <div className="project-thumbnail">
              <span>{getRecentProjectCoverLabel(project)}</span>
            </div>
            <div>
              <h4>{project.name}</h4>
              <p>{project.path}</p>
            </div>
            <div className="project-meta">
              <Badge variant="secondary">{getRecentProjectStatus(project)}</Badge>
              <small>{project.updatedAt}</small>
            </div>
            <div className="tag-list">
              {getRecentProjectTags(project).map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </button>
        ))}
        <Button className="open-more-card" onClick={onOpenProject} type="button" variant="outline">
          <FolderOpen aria-hidden="true" size={34} />
          打开更多项目
        </Button>
      </div>
    </section>
  );
}
