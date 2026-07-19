import type { KeyboardEvent, ReactNode } from "react";
import { Check, Heart } from "lucide-react";

import { cn } from "@/lib/utils";

interface AssetOptionCardProps {
  badge?: string;
  className?: string;
  focus?: string;
  meta?: string;
  onSelect: () => void;
  preview: ReactNode;
  score?: string;
  selected: boolean;
  title: string;
}

export function AssetOptionCard({
  badge,
  className,
  focus,
  meta,
  onSelect,
  preview,
  score,
  selected,
  title,
}: AssetOptionCardProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  }

  return (
    <article
      className={cn("app-asset-option-card", className)}
      data-selected={selected}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="app-asset-option-preview">{preview}</div>
      <div className="app-asset-option-topline">
        {badge ? <span>{badge}</span> : null}
        {selected ? <Check aria-hidden="true" /> : <Heart aria-hidden="true" />}
      </div>
      <footer>
        <div>
          <strong>{title}</strong>
          {score ? <span>{score}</span> : null}
        </div>
        {focus ? <small>{focus}</small> : null}
        {meta ? <small>{meta}</small> : null}
      </footer>
    </article>
  );
}
