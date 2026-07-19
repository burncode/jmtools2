import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ToolbarProps {
  children: ReactNode;
  className?: string;
  label: string;
}

export function Toolbar({ children, className, label }: ToolbarProps) {
  return (
    <div aria-label={label} className={cn("app-toolbar", className)} role="toolbar">
      {children}
    </div>
  );
}
