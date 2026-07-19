import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ProGlassPanelProps {
  children: ReactNode;
  className?: string;
}

export function ProGlassPanel({ children, className }: ProGlassPanelProps) {
  return <div className={cn("app-glass-chrome", className)}>{children}</div>;
}
