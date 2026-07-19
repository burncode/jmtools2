interface WorkflowNodeProgressProps {
  progress?: number;
  status: string;
}

export function WorkflowNodeProgress({ progress, status }: WorkflowNodeProgressProps) {
  if (status !== "running") {
    return null;
  }

  const value = Math.max(0, Math.min(100, progress ?? 0));
  if (value <= 0) {
    return null;
  }

  return (
    <div aria-label={`运行进度 ${value}%`} className="workflow-node-progress" role="progressbar" aria-valuemax={100} aria-valuemin={0} aria-valuenow={value}>
      <div className="workflow-node-progress-track">
        <div className="workflow-node-progress-fill" style={{ width: `${value}%` }} />
      </div>
      <span className="workflow-type-caption workflow-node-progress-label">{value}%</span>
    </div>
  );
}
