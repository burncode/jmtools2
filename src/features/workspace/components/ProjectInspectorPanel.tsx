import { projectCategories, exportTargets } from "../../projects/projectOptions";
import type { PipelineProject } from "../../projects/types";

interface ProjectInspectorPanelProps {
  project: PipelineProject;
}

export function ProjectInspectorPanel({ project }: ProjectInspectorPanelProps) {
  const categoryLabel = projectCategories.find((item) => item.value === project.category)?.label ?? "其他";
  const configuredExportTargets = project.exportTargets
    .map((target) => exportTargets.find((item) => item.value === target)?.label ?? target)
    .filter(Boolean);
  const inspectorStats = [
    { label: "资产总数", value: project.assets.length.toString() },
    { label: "待处理", value: "0" },
    { label: "项目分类", value: categoryLabel },
    { label: "标签数量", value: project.tags.length.toString() },
  ];

  return (
    <aside className="project-inspector" aria-label="项目检查器">
      <section className="inspector-section">
        <p className="panel-label">上下文检查器</p>
        <h3>项目概览</h3>
        <div className="inspector-stat-grid">
          {inspectorStats.map((stat) => (
            <div key={stat.label}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="inspector-section">
        <h3>项目标签</h3>
        <div className="category-list">
          {(project.tags.length > 0 ? project.tags : ["暂无标签"]).map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="inspector-section">
        <h3>导出目标</h3>
        <div className="export-target-list">
          {(configuredExportTargets.length > 0 ? configuredExportTargets : ["导出时选择"]).map((target) => (
            <span key={target}>{target}</span>
          ))}
        </div>
      </section>

      <section className="inspector-section">
        <h3>存储使用</h3>
        <div className="storage-meter">
          <strong>12.45 GB</strong>
          <span>24.9% 已使用</span>
          <div>
            <i />
          </div>
        </div>
      </section>
    </aside>
  );
}
