type RunWorkflowGroupHandler = (groupId: string) => void;

let runWorkflowGroupHandler: RunWorkflowGroupHandler | undefined;

export function setRunWorkflowGroupHandler(handler: RunWorkflowGroupHandler | undefined) {
  runWorkflowGroupHandler = handler;
}

export function runWorkflowGroup(groupId: string) {
  runWorkflowGroupHandler?.(groupId);
}
