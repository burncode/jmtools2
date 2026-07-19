import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InspectorField } from "@/components/shared";

import type { WorkflowPreviewImage } from "../workflowPreviewAssets";
import { resolvePreviewFileName } from "../workflowPreviewPath";

interface WorkflowOutputFileInfoProps {
  image?: WorkflowPreviewImage;
}

export function WorkflowOutputFileInfo({ image }: WorkflowOutputFileInfoProps) {
  if (!image) {
    return null;
  }

  const fileName = resolvePreviewFileName(image);
  const relativePath = image.projectRelativePath?.trim();
  const displayPath = relativePath || image.absolutePath?.trim();

  if (!fileName && !displayPath) {
    return null;
  }

  return (
    <InspectorField label="文件信息">
      <div className="workflow-output-file-info">
        {fileName ? (
          <div className="workflow-output-file-info-row">
            <span className="workflow-type-caption">文件名</span>
            <code className="workflow-output-file-info-value">{fileName}</code>
          </div>
        ) : null}
        {displayPath ? (
          <div className="workflow-output-file-info-row">
            <span className="workflow-type-caption">路径</span>
            <code className="workflow-output-file-info-value">{displayPath}</code>
            <Button
              aria-label="复制路径"
              onClick={() => void navigator.clipboard.writeText(displayPath)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Copy aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </div>
    </InspectorField>
  );
}
