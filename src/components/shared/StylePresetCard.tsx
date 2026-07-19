import type { KeyboardEvent, MouseEvent } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface StylePresetCardProps {
  className?: string;
  onSelect: () => void;
  onUse?: () => void;
  selected: boolean;
  showUseButton?: boolean;
  tagline: string;
  thumbnail: string;
  title: string;
  variant?: "compact" | "library";
}

export function StylePresetCard({
  className,
  onSelect,
  onUse,
  selected,
  showUseButton = false,
  tagline,
  thumbnail,
  title,
  variant = "compact",
}: StylePresetCardProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  }

  function handleUseClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onUse?.();
  }

  return (
    <article
      className={cn("app-style-preset-card", className)}
      data-selected={selected}
      data-variant={variant}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="app-style-preset-preview">
        <img alt="" src={thumbnail} />
        {selected ? (
          <span aria-hidden="true" className="app-style-preset-check">
            <Check />
          </span>
        ) : null}
        {showUseButton && onUse ? (
          <div className="app-style-preset-use-overlay">
            <Button onClick={handleUseClick} size="sm" type="button">
              使用模板
            </Button>
          </div>
        ) : null}
      </div>
      <div className="app-style-preset-body">
        <strong className="app-style-preset-title">{title}</strong>
        {tagline ? <small className="app-style-preset-tagline">{tagline}</small> : null}
      </div>
    </article>
  );
}
