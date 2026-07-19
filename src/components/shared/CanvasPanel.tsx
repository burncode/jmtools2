import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CanvasPanelProps {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  label?: string;
  title?: ReactNode;
  toolbar?: ReactNode;
}

export function CanvasPanel({ actions, children, className, footer, label, title, toolbar }: CanvasPanelProps) {
  const hasToolbar = Boolean(title || toolbar || actions);

  return (
    <Card className={cn("app-canvas-panel", className)} aria-label={label}>
      {hasToolbar ? (
        <header className="app-canvas-panel-toolbar">
          {title ? <div className="app-canvas-panel-title">{title}</div> : null}
          {toolbar ? <div className="app-canvas-panel-controls">{toolbar}</div> : null}
          {actions ? <div className="app-canvas-panel-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="app-canvas-panel-body">{children}</div>
      {footer ? <footer className="app-canvas-panel-footer">{footer}</footer> : null}
    </Card>
  );
}
