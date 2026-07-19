import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface PanelSectionProps {
  children: ReactNode;
  className?: string;
  description?: string;
  icon?: LucideIcon;
  title: string;
}

export function PanelSection({ children, className, description, icon: Icon, title }: PanelSectionProps) {
  return (
    <section className={cn("app-panel-section", className)}>
      <header className="app-panel-section-header">
        {Icon ? <Icon aria-hidden="true" /> : null}
        <div>
          <strong>{title}</strong>
          {description ? <span>{description}</span> : null}
        </div>
      </header>
      <div className="app-panel-section-body">{children}</div>
    </section>
  );
}
