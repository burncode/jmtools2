import { Component, Fragment, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { appLogger } from "@/lib/logger";

interface WorkflowErrorBoundaryProps {
  children: ReactNode;
}

interface WorkflowErrorBoundaryState {
  errorMessage?: string;
  resetKey: number;
}

/// 节点工作台渲染兜底：当画布/节点子树进入渲染崩溃（如 Maximum update depth exceeded）时，
/// 用可恢复的错误面板替代整屏黑屏，并记录组件栈用于定位根因。点击重试会重挂子树。
export class WorkflowErrorBoundary extends Component<WorkflowErrorBoundaryProps, WorkflowErrorBoundaryState> {
  state: WorkflowErrorBoundaryState = { resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<WorkflowErrorBoundaryState> {
    return { errorMessage: error.message || "节点工作台渲染出错。" };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const componentStack = (errorInfo.componentStack ?? "").trim();
    void appLogger.error(`节点工作台渲染崩溃：message=${error.message} componentStack=${componentStack}`);
    console.error("节点工作台渲染崩溃：", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState((state) => ({ errorMessage: undefined, resetKey: state.resetKey + 1 }));
  };

  render() {
    if (this.state.errorMessage) {
      return (
        <div className="workflow-error-boundary" role="alert">
          <h2 className="workflow-error-boundary-title">节点工作台渲染出错</h2>
          <p className="workflow-error-boundary-message">{this.state.errorMessage}</p>
          <p className="workflow-error-boundary-hint">
            已记录错误日志。可点击重试恢复，或切换到其它面板后重新进入工作台。
          </p>
          <Button onClick={this.handleRetry} type="button" variant="default">
            重试
          </Button>
        </div>
      );
    }

    return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>;
  }
}
