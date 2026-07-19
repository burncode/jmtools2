import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

import type { WorkflowPreviewAssets } from "./workflowPreviewAssets";
import { resolvePreviewImageSrc } from "./workflowPreviewPath";

interface WorkflowOutputPreviewProps {
  assets: WorkflowPreviewAssets;
  onActiveImageChange?: (index: number) => void;
  projectRoot: string;
}

export function WorkflowOutputPreview({ assets, onActiveImageChange, projectRoot }: WorkflowOutputPreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = Math.min(activeIndex, Math.max(assets.images.length - 1, 0));
  const activeImage = assets.images[safeIndex];
  const activeSrc = useMemo(
    () => resolvePreviewImageSrc(projectRoot, activeImage),
    [activeImage, projectRoot],
  );

  const thumbnails = useMemo(() => assets.images, [assets.images]);

  function selectIndex(index: number) {
    setActiveIndex(index);
    onActiveImageChange?.(index);
  }

  if (assets.kind === "empty" || !activeImage || !activeSrc) {
    return <p className="workflow-muted">当前节点还没有可预览的图片输出。</p>;
  }

  return (
    <div className="workflow-output-preview">
      {assets.kind === "spritesheet" && assets.atlasSummary ? (
        <p className="workflow-type-caption workflow-output-preview-summary">{assets.atlasSummary}</p>
      ) : null}
      {assets.kind === "multi" && thumbnails.length > 1 ? (
        <div className="workflow-output-preview-thumbs">
          {thumbnails.map((item, index) => (
            <Button
              aria-label={item.label ?? `候选图 ${index + 1}`}
              className="workflow-output-preview-thumb"
              data-active={index === safeIndex ? "true" : "false"}
              key={item.id ?? `${item.projectRelativePath ?? item.absolutePath}-${index}`}
              onClick={() => selectIndex(index)}
              size="sm"
              type="button"
              variant="outline"
            >
              {item.label ?? `#${index + 1}`}
            </Button>
          ))}
        </div>
      ) : activeImage.label ? (
        <p className="workflow-type-caption workflow-output-preview-label">{activeImage.label}</p>
      ) : null}
      <div className="workflow-output-preview-main">
        <img alt={activeImage.label ?? "输出预览"} className="workflow-output-preview-image" src={activeSrc} />
      </div>
    </div>
  );
}
