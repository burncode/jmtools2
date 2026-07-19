import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface AppToolbarRowProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  end?: ReactNode;
  start?: ReactNode;
}

/** Horizontal toolbar row — SegmentedControl and action groups must live here to avoid vertical stacking. */
export function AppToolbarRow({ children, className, end, start, ...props }: AppToolbarRowProps) {
  return (
    <div className={cn("app-toolbar-row", className)} {...props}>
      {start ? <div className="app-toolbar-row-start">{start}</div> : null}
      {children ? <div className="app-toolbar-row-main">{children}</div> : null}
      {end ? <div className="app-toolbar-row-end">{end}</div> : null}
    </div>
  );
}
