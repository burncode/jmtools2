import type { KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface VisualChoiceOption {
  description?: string;
  icon?: LucideIcon;
  label: string;
  value: string;
}

interface VisualChoiceGridProps {
  ariaLabel: string;
  className?: string;
  columns?: "auto" | number;
  onValueChange: (value: string) => void;
  options: VisualChoiceOption[];
  size?: "compact" | "regular";
  value: string;
}

export function VisualChoiceGrid({
  ariaLabel,
  className,
  columns = "auto",
  onValueChange,
  options,
  size = "regular",
  value,
}: VisualChoiceGridProps) {
  const columnStyle =
    columns === "auto"
      ? undefined
      : { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return;
    }

    event.preventDefault();
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (index + delta + options.length) % options.length;
    onValueChange(options[nextIndex]?.value ?? value);
  }

  return (
    <div
      aria-label={ariaLabel}
      className={cn("app-visual-choice-grid", size === "compact" && "app-visual-choice-grid-compact", className)}
      role="radiogroup"
      style={columnStyle}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        const Icon = option.icon;

        return (
          <button
            aria-checked={selected}
            aria-label={option.label}
            className="app-visual-choice-tile"
            data-selected={selected}
            key={option.value}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            role="radio"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            {Icon ? (
              <Icon aria-hidden="true" className="app-visual-choice-icon" />
            ) : null}
            <span className="app-visual-choice-label">{option.label}</span>
            {option.description ? <small className="app-visual-choice-description">{option.description}</small> : null}
          </button>
        );
      })}
    </div>
  );
}
