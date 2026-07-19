import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  icon?: LucideIcon;
  title: ReactNode;
}

export function EmptyState({
  actions,
  children,
  className,
  description,
  eyebrow,
  icon: Icon,
  title,
}: EmptyStateProps) {
  return (
    <section className={cn("app-empty-state", className)}>
      {Icon ? (
        <div className="app-empty-state-icon" aria-hidden="true">
          <Icon />
        </div>
      ) : null}
      <div className="app-empty-state-copy">
        {eyebrow ? <span>{eyebrow}</span> : null}
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
      {children ? <div className="app-empty-state-content">{children}</div> : null}
      {actions ? <div className="app-empty-state-actions">{actions}</div> : null}
    </section>
  );
}
