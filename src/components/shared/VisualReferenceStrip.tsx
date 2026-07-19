import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Upload, X } from "lucide-react";
import { useMemo } from "react";

import { resolveProjectImagePath, toProjectRelativePath } from "@/features/style-presets/stylePresetParams";

interface VisualReferenceStripProps {
  maxCount?: number;
  onChange: (paths: string[]) => void;
  paths: string[];
  projectRoot?: string;
}

export function VisualReferenceStrip({
  maxCount = 4,
  onChange,
  paths,
  projectRoot = "",
}: VisualReferenceStripProps) {
  const canAdd = paths.length < maxCount;

  const previewUrls = useMemo(
    () =>
      paths.map((path) => {
        const resolved = resolveProjectImagePath(projectRoot, path);
        if (!resolved) {
          return "";
        }
        try {
          return convertFileSrc(resolved);
        } catch {
          return "";
        }
      }),
    [paths, projectRoot],
  );

  async function handleUpload() {
    if (!canAdd) {
      return;
    }

    const selected = await open({
      defaultPath: projectRoot || undefined,
      filters: [{ extensions: ["png", "jpg", "jpeg", "webp"], name: "图片" }],
      multiple: true,
      title: "选择视觉参考",
    });

    const selectedPaths = normalizeSelectedPaths(selected).slice(0, maxCount - paths.length);
    if (selectedPaths.length === 0) {
      return;
    }

    const nextPaths = selectedPaths.map((absolutePath) =>
      projectRoot ? toProjectRelativePath(projectRoot, absolutePath) : absolutePath,
    );

    onChange([...paths, ...nextPaths]);
  }

  function handleRemove(index: number) {
    onChange(paths.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="app-visual-reference-strip">
      <button
        className="app-visual-reference-upload"
        disabled={!canAdd}
        onClick={() => void handleUpload()}
        type="button"
      >
        <Upload aria-hidden="true" />
        <span>{canAdd ? "上传参考图" : "已满"}</span>
        <span>{paths.length}/{maxCount}</span>
      </button>

      {paths.map((path, index) => (
        <figure className="app-visual-reference-thumb" key={`${path}-${index}`} title={path}>
          {previewUrls[index] ? <img alt="" src={previewUrls[index]} /> : <span className="app-visual-reference-upload" />}
          <button
            aria-label={`移除参考图 ${index + 1}`}
            className="app-visual-reference-remove"
            onClick={() => handleRemove(index)}
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </figure>
      ))}
    </div>
  );
}

function normalizeSelectedPaths(selected: string | string[] | null): string[] {
  if (!selected) {
    return [];
  }
  return Array.isArray(selected) ? selected : [selected];
}
