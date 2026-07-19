import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SettingsPanelCardProps {
  bodyClassName?: string;
  children: ReactNode;
  className?: string;
  description?: string;
  icon?: LucideIcon;
  title: string;
}

export function SettingsPanelCard({
  bodyClassName,
  children,
  className,
  description,
  icon: Icon,
  title,
}: SettingsPanelCardProps) {
  return (
    <section className={cn("settings-card", className)}>
      <header className="settings-card-title">
        {Icon ? <Icon aria-hidden="true" /> : null}
        <div>
          <strong>{title}</strong>
          {description ? <span>{description}</span> : null}
        </div>
      </header>
      <div className={cn("local-models-panel-body", bodyClassName)}>{children}</div>
    </section>
  );
}

interface SettingsMetricCardProps {
  children: ReactNode;
  className?: string;
  icon: LucideIcon;
  title: string;
}

export function SettingsMetricCard({ children, className, icon: Icon, title }: SettingsMetricCardProps) {
  return (
    <article className={cn("settings-card local-models-metric-card", className)}>
      <header className="settings-card-title local-models-metric-card-title">
        <Icon aria-hidden="true" />
        <div>
          <strong>{title}</strong>
        </div>
      </header>
      <div className="local-models-metric-card-body space-y-2">{children}</div>
    </article>
  );
}
