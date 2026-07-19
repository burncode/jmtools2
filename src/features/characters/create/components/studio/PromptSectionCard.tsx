import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { SemanticSectionCard, resolveSemanticAccent } from "@/components/shared/SemanticSectionCard";
import { cn } from "@/lib/utils";

interface PromptSectionCardProps {
  actions?: ReactNode;
  className?: string;
  locked?: boolean;
  onFocus?: () => void;
  title: string;
  value: string;
  variant?: "card" | "compact";
}

export function PromptSectionCard({
  actions,
  className,
  locked,
  onFocus,
  title,
  value,
  variant = "card",
}: PromptSectionCardProps) {
  if (variant === "compact") {
    const focusable = Boolean(onFocus);

    return (
      <article
        className={cn("app-prompt-section-compact", focusable && "app-prompt-section-compact-interactive", className)}
        data-accent={resolveSemanticAccent(title)}
        onClick={onFocus}
        onKeyDown={(event) => {
          if (!onFocus) {
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onFocus();
          }
        }}
        role={focusable ? "button" : undefined}
        tabIndex={focusable ? 0 : undefined}
      >
        <header className="app-prompt-section-compact-header">
          <strong>{title}</strong>
          <div className="app-prompt-section-compact-actions">
            {locked ? <Badge variant="outline">系统</Badge> : null}
            {actions}
          </div>
        </header>
        <p>{value}</p>
      </article>
    );
  }

  return (
    <SemanticSectionCard
      accent={resolveSemanticAccent(title)}
      actions={
        <>
          {locked ? <Badge variant="outline">系统</Badge> : null}
          {actions}
        </>
      }
      className={className}
      title={title}
    >
      <p>{value}</p>
    </SemanticSectionCard>
  );
}
