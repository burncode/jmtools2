import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ActionBarProps {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  description?: ReactNode;
  leading?: ReactNode;
  status?: ReactNode;
  title?: ReactNode;
}

export function ActionBar({
  actions,
  children,
  className,
  description,
  leading,
  status,
  title,
}: ActionBarProps) {
  const hasHeading = Boolean(leading || title || description);

  return (
    <section className={cn("app-action-bar", className)}>
      {hasHeading ? (
        <div className="app-action-bar-heading">
          {leading ? <div className="app-action-bar-leading">{leading}</div> : null}
          <div>
            {title ? <strong>{title}</strong> : null}
            {description ? <span>{description}</span> : null}
          </div>
        </div>
      ) : null}
      {children ? <div className="app-action-bar-content">{children}</div> : null}
      {status ? <div className="app-action-bar-status">{status}</div> : null}
      {actions ? <div className="app-action-bar-actions">{actions}</div> : null}
    </section>
  );
}
