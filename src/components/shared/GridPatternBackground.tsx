import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface GridPatternBackgroundProps {
  children?: ReactNode;
  className?: string;
}

export function GridPatternBackground({ children, className }: GridPatternBackgroundProps) {
  return <div className={cn("app-grid-pattern-bg", className)}>{children}</div>;
}
