import { pipelineTasks } from "../workspaceFixtures";

export function PipelineTaskPanel() {
  return (
    <section className="workspace-panel" aria-label="管线任务">
      <div className="section-heading compact-heading">
        <div>
          <p className="panel-label">管线任务</p>
          <h3>生成到导出的状态流</h3>
        </div>
      </div>
      <div className="pipeline-task-list">
        {pipelineTasks.map((task) => (
          <article className="pipeline-task-row" key={task.title}>
            <div>
              <strong>{task.title}</strong>
              <p>{task.detail}</p>
            </div>
            <span>{task.status}</span>
            <div className="task-progress" aria-label={`${task.title} 进度 ${task.progress}%`}>
              <i style={{ width: `${task.progress}%` }} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
