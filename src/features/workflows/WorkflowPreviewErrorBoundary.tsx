import { Component, type ErrorInfo, type ReactNode } from "react";

interface WorkflowPreviewErrorBoundaryProps {
  children: ReactNode;
}

interface WorkflowPreviewErrorBoundaryState {
  errorMessage?: string;
}

export class WorkflowPreviewErrorBoundary extends Component<
  WorkflowPreviewErrorBoundaryProps,
  WorkflowPreviewErrorBoundaryState
> {
  state: WorkflowPreviewErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): WorkflowPreviewErrorBoundaryState {
    return { errorMessage: error.message || "图片预览渲染失败。" };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Workflow preview render failed:", error, errorInfo);
  }

  render() {
    if (this.state.errorMessage) {
      return <p className="workflow-field-error">{this.state.errorMessage}</p>;
    }

    return this.props.children;
  }
}
