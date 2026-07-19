import { convertFileSrc } from "@tauri-apps/api/core";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";

import { projectCategories } from "../../projects/projectOptions";
import type { PipelineProject } from "../../projects/types";
import { coverBadges } from "../workspaceFixtures";

interface ProjectCoverSummaryProps {
  project: PipelineProject;
}

export function ProjectCoverSummary({ project }: ProjectCoverSummaryProps) {
  const coverImagePath = project.coverImage ? `${project.rootPath}\\${project.coverImage.replace(/\//g, "\\")}` : "";
  const coverImageUrl = coverImagePath ? convertFileSrc(coverImagePath) : "";
  const categoryLabel = projectCategories.find((item) => item.value === project.category)?.label ?? "其他";
  const projectTags = project.tags.length > 0 ? project.tags : ["生成流水线"];

  return (
    <section className="project-cover" aria-label="项目封面摘要">
      {coverImageUrl ? <img alt="" className="project-cover-image" src={coverImageUrl} /> : null}
      <div className="project-cover-content">
        <p className="eyebrow">项目概览</p>
        <h2>{project.name}</h2>
        <p>{project.description || "管理素材生成、编辑、打包与导出流程。"}</p>
        <div className="cover-badge-list">
          <span>{categoryLabel}</span>
          {projectTags.slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
          {coverBadges.slice(1, 3).map((badge) => {
            const Icon = badge.icon;

            return (
              <span key={badge.label}>
                <Icon aria-hidden="true" size={15} />
                {badge.label}
              </span>
            );
          })}
        </div>
      </div>
      <Button className="cover-edit-button" type="button" variant="outline">
        <Pencil aria-hidden="true" />
        编辑封面
      </Button>
    </section>
  );
}
