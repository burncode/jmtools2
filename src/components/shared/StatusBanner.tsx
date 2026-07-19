import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, CheckCircle2, Info, LoaderCircle, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

type StatusBannerVariant = "danger" | "info" | "loading" | "success" | "warning";

interface StatusBannerProps {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  description?: ReactNode;
  icon?: LucideIcon;
  meta?: ReactNode;
  title: ReactNode;
  variant?: StatusBannerVariant;
}

const statusBannerIcons = {
  danger: AlertCircle,
  info: Info,
  loading: LoaderCircle,
  success: CheckCircle2,
  warning: TriangleAlert,
} as const satisfies Record<StatusBannerVariant, LucideIcon>;

export function StatusBanner({
  actions,
  children,
  className,
  description,
  icon,
  meta,
  title,
  variant = "info",
}: StatusBannerProps) {
  const Icon = icon ?? statusBannerIcons[variant];

  return (
    <section className={cn("app-status-banner", className)} data-variant={variant} aria-live="polite">
      <div className="app-status-banner-icon" aria-hidden="true">
        <Icon />
      </div>
      <div className="app-status-banner-copy">
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
        {meta ? <small>{meta}</small> : null}
        {children ? <div className="app-status-banner-content">{children}</div> : null}
      </div>
      {actions ? <div className="app-status-banner-actions">{actions}</div> : null}
    </section>
  );
}
