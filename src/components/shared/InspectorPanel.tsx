import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface InspectorPanelProps {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  footer?: ReactNode;
  icon?: LucideIcon;
  label?: string;
  title?: ReactNode;
}

export function InspectorPanel({
  actions,
  children,
  className,
  description,
  footer,
  icon: Icon,
  label,
  title,
}: InspectorPanelProps) {
  const hasHeader = Boolean(Icon || title || description || actions);

  return (
    <Card className={cn("app-inspector-panel", className)} aria-label={label}>
      {hasHeader ? (
        <header className="app-inspector-panel-header">
          {Icon ? <Icon aria-hidden="true" /> : null}
          <div>
            {title ? <strong>{title}</strong> : null}
            {description ? <span>{description}</span> : null}
          </div>
          {actions ? <div className="app-inspector-panel-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="app-inspector-panel-body">{children}</div>
      {footer ? <footer className="app-inspector-panel-footer">{footer}</footer> : null}
    </Card>
  );
}
