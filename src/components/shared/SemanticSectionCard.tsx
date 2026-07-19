import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type SemanticAccent = "amber" | "cyan" | "emerald" | "violet" | "zinc";

interface SemanticSectionCardProps {
  accent?: SemanticAccent;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  title: ReactNode;
}

export function resolveSemanticAccent(title: string): SemanticAccent {
  if (title.includes("Identity") || title.includes("身份")) {
    return "violet";
  }
  if (title.includes("Style") || title.includes("风格")) {
    return "cyan";
  }
  if (title.includes("Outfit") || title.includes("外观")) {
    return "amber";
  }
  if (title.includes("Generation") || title.includes("生成")) {
    return "emerald";
  }
  return "zinc";
}

export function SemanticSectionCard({
  accent = "zinc",
  actions,
  children,
  className,
  title,
}: SemanticSectionCardProps) {
  return (
    <article className={cn("app-semantic-section-card", className)} data-accent={accent}>
      <header>
        <strong>{title}</strong>
        {actions}
      </header>
      {children}
    </article>
  );
}
