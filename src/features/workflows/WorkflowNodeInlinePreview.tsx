import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import type { WorkflowPreviewAssets, WorkflowPreviewImage } from "./workflowPreviewAssets";
import { resolvePreviewImageSrc } from "./workflowPreviewPath";

interface WorkflowNodeInlinePreviewProps {
  assets: WorkflowPreviewAssets;
  className?: string;
  projectRoot: string;
}

export function WorkflowNodeInlinePreview({ assets, className, projectRoot }: WorkflowNodeInlinePreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = Math.min(activeIndex, Math.max(assets.images.length - 1, 0));
  const activeImage = assets.images[safeIndex];
  const activeSrc = useMemo(
    () => resolvePreviewImageSrc(projectRoot, activeImage),
    [activeImage, projectRoot],
  );

  if (assets.kind === "empty" || !activeImage || !activeSrc) {
    return null;
  }

  const isMulti = assets.kind === "multi" && assets.images.length > 1;

  return (
    <div className={cn("workflow-node-inline-preview", className)}>
      {assets.kind === "spritesheet" && assets.atlasSummary ? (
        <p className="workflow-node-inline-preview-meta">{assets.atlasSummary}</p>
      ) : null}
      {isMulti ? (
        <div className="workflow-node-inline-preview-segments">
          {assets.images.map((item, index) => (
            <button
              className="workflow-node-inline-preview-segment"
              data-active={index === safeIndex ? "true" : "false"}
              key={item.id ?? `${item.projectRelativePath ?? item.absolutePath}-${index}`}
              onClick={() => setActiveIndex(index)}
              type="button"
            >
              {item.label ?? `#${index + 1}`}
            </button>
          ))}
        </div>
      ) : activeImage.label ? (
        <p className="workflow-node-inline-preview-label">{activeImage.label}</p>
      ) : null}
      <div className="workflow-node-inline-preview-main is-transparent">
        <img alt={activeImage.label ?? "节点预览"} className="workflow-node-inline-preview-image" src={activeSrc} />
      </div>
      {isMulti ? (
        <div className="workflow-node-inline-preview-thumbs">
          {assets.images.map((item, index) => (
            <WorkflowNodeInlineThumb
              active={index === safeIndex}
              image={item}
              index={index}
              key={item.id ?? `${item.projectRelativePath ?? item.absolutePath}-${index}`}
              onSelect={() => setActiveIndex(index)}
              projectRoot={projectRoot}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function WorkflowNodeInlineThumb({
  active,
  image,
  index,
  onSelect,
  projectRoot,
}: {
  active: boolean;
  image: WorkflowPreviewImage;
  index: number;
  onSelect: () => void;
  projectRoot: string;
}) {
  const src = resolvePreviewImageSrc(projectRoot, image);
  if (!src) {
    return null;
  }

  return (
    <button
      aria-label={image.label ?? `候选图 ${index + 1}`}
      className="workflow-node-inline-preview-thumb"
      data-active={active ? "true" : "false"}
      onClick={onSelect}
      title={image.label ?? undefined}
      type="button"
    >
      <img alt="" src={src} />
    </button>
  );
}
