import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { FolderOpen, Heart, Trash2 } from "lucide-react";

import { IconButton } from "./IconButton";
import { cn } from "@/lib/utils";

interface AssetGridCardProps {
  badge?: ReactNode;
  className?: string;
  deleteLabel?: string;
  favorite?: boolean;
  favoriteLabel?: string;
  meta?: ReactNode;
  onDelete?: () => void;
  onOpen?: () => void;
  onToggleFavorite?: () => void;
  openLabel?: string;
  preview: ReactNode;
  selected?: boolean;
  subtitle?: ReactNode;
  timestamp?: ReactNode;
  title: ReactNode;
}

function stopCardAction(callback?: () => void) {
  return (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    callback?.();
  };
}

export function AssetGridCard({
  badge,
  className,
  deleteLabel = "删除资产",
  favorite = false,
  favoriteLabel,
  meta,
  onDelete,
  onOpen,
  onToggleFavorite,
  openLabel = "打开资产",
  preview,
  selected = false,
  subtitle,
  timestamp,
  title,
}: AssetGridCardProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!onOpen || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    onOpen();
  };

  const showHoverActions = Boolean(onOpen || onDelete || onToggleFavorite);

  return (
    <article
      className={cn("app-asset-grid-card", className)}
      data-selected={selected}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
    >
      <div className="app-asset-grid-preview">
        {preview}
        {onToggleFavorite && favorite ? (
          <button
            className="app-asset-grid-favorite app-asset-grid-favorite--pinned"
            type="button"
            aria-label={favoriteLabel ?? "取消收藏"}
            aria-pressed={favorite}
            onClick={stopCardAction(onToggleFavorite)}
          >
            <Heart fill="currentColor" />
          </button>
        ) : null}
        {showHoverActions ? (
          <div className="app-asset-grid-hover-actions">
            {onOpen ? (
              <IconButton
                aria-label={openLabel}
                size="icon-sm"
                type="button"
                variant="outline"
                onClick={stopCardAction(onOpen)}
              >
                <FolderOpen aria-hidden="true" />
              </IconButton>
            ) : null}
            {onDelete ? (
              <IconButton
                aria-label={deleteLabel}
                size="icon-sm"
                type="button"
                variant="outline"
                onClick={stopCardAction(onDelete)}
              >
                <Trash2 aria-hidden="true" />
              </IconButton>
            ) : null}
            {onToggleFavorite && !favorite ? (
              <button
                className="app-asset-grid-favorite"
                type="button"
                aria-label={favoriteLabel ?? "收藏资产"}
                aria-pressed={favorite}
                onClick={stopCardAction(onToggleFavorite)}
              >
                <Heart fill="none" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="app-asset-grid-body">
        <div className="app-asset-grid-title-row">
          <strong className="app-asset-grid-title">{title}</strong>
          {timestamp ? <span className="app-asset-grid-timestamp">{timestamp}</span> : null}
          {badge ? <span className="app-asset-grid-badge">{badge}</span> : null}
        </div>
        {subtitle ? <p className="app-asset-grid-subtitle">{subtitle}</p> : null}
        {meta ? <div className="app-asset-grid-meta">{meta}</div> : null}
      </div>
    </article>
  );
}
