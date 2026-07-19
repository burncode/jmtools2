import { ImageOff } from "lucide-react";

import { EmptyState } from "@/components/shared";
import type { AssetToolResult } from "../types";

type PreviewBackground = "checkerboard" | "dark" | "light";
type PreviewMode = "compare" | "source" | "result";

interface AssetToolPreviewProps {
  background: PreviewBackground;
  mode: PreviewMode;
  result?: AssetToolResult;
  sourcePreviewUrl?: string;
}

export function AssetToolPreview({
  background,
  mode,
  result,
  sourcePreviewUrl,
}: AssetToolPreviewProps) {
  const hasSource = Boolean(sourcePreviewUrl);
  const hasResult = Boolean(result?.outputImage.dataUrl);

  return (
    <div className="asset-tool-preview-shell">
      <div className="asset-tool-preview-stage" data-background={background} data-mode={mode}>
        {!hasSource ? (
          <EmptyState
            className="asset-tool-preview-empty"
            description="上传 PNG、JPG 或 WEBP 后，可以在这里查看原图、透明图和前后对比。"
            icon={ImageOff}
            title="等待图片"
          />
        ) : mode === "compare" ? (
          <div className="asset-tool-compare-grid">
            <PreviewFrame label="原图" src={sourcePreviewUrl} />
            <PreviewFrame label="透明结果" src={result?.outputImage.dataUrl} />
          </div>
        ) : mode === "source" ? (
          <PreviewFrame label="原图" src={sourcePreviewUrl} />
        ) : (
          <PreviewFrame label="透明结果" src={result?.outputImage.dataUrl} />
        )}

        {hasSource && !hasResult && mode === "result" ? (
          <div className="asset-tool-preview-empty-note">执行去背景后显示结果图。</div>
        ) : null}
      </div>
    </div>
  );
}

function PreviewFrame({ label, src }: { label: string; src?: string }) {
  return (
    <figure className="asset-tool-preview-frame">
      <figcaption>{label}</figcaption>
      {src ? <img alt={label} src={src} /> : <span>暂无结果</span>}
    </figure>
  );
}
