import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type SelectableListRowVariant = "default" | "tile";

export interface SelectableListRowProps {
  className?: string;
  description?: string;
  disabled?: boolean;
  label: string;
  meta?: ReactNode;
  onSelect: () => void;
  selected?: boolean;
  trailing?: ReactNode;
  variant?: SelectableListRowVariant;
}

export function SelectableListRow({
  className,
  description,
  disabled = false,
  label,
  meta,
  onSelect,
  selected = false,
  trailing,
  variant = "default",
}: SelectableListRowProps) {
  return (
    <button
      aria-current={selected ? "true" : undefined}
      aria-pressed={selected}
      className={cn(
        "app-selectable-list-row",
        variant === "tile" && "app-selectable-list-row--tile",
        selected && "app-selectable-list-row--selected",
        className,
      )}
      disabled={disabled}
      onClick={onSelect}
      type="button"
    >
      <span className="app-selectable-list-row-label">{label}</span>
      {description ? <small className="app-selectable-list-row-description">{description}</small> : null}
      {meta ? <span className="app-selectable-list-row-meta">{meta}</span> : null}
      {trailing ? <span className="app-selectable-list-row-trailing">{trailing}</span> : null}
    </button>
  );
}
