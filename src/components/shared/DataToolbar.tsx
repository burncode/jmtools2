import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DataToolbarProps {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  label?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchValue?: string;
}

export function DataToolbar({
  actions,
  children,
  className,
  label = "数据工具栏",
  onSearchChange,
  searchPlaceholder,
  searchValue,
}: DataToolbarProps) {
  const showSearch = Boolean(searchPlaceholder || onSearchChange || typeof searchValue === "string");

  return (
    <div className={cn("app-data-toolbar", className)} role="toolbar" aria-label={label}>
      {showSearch ? (
        <label className="app-data-toolbar-search">
          <Search aria-hidden="true" />
          <Input
            readOnly={!onSearchChange}
            value={searchValue ?? ""}
            placeholder={searchPlaceholder}
            onChange={(event) => onSearchChange?.(event.target.value)}
          />
        </label>
      ) : null}
      {children ? <div className="app-data-toolbar-filters">{children}</div> : null}
      {actions ? <div className="app-data-toolbar-actions">{actions}</div> : null}
    </div>
  );
}
