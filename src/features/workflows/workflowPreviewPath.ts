import { convertFileSrc } from "@tauri-apps/api/core";

import type { WorkflowPreviewImage } from "./workflowPreviewAssets";

export function normalizeFilesystemPath(path: string): string {
  let normalized = path.trim().replace(/\\/g, "/");

  if (normalized.startsWith("//?/UNC/")) {
    normalized = normalized.slice("//?/UNC/".length);
  } else if (normalized.startsWith("//?/")) {
    normalized = normalized.slice("//?/".length);
  } else if (normalized.startsWith("\\\\?\\UNC\\")) {
    normalized = normalized.slice("\\\\?\\UNC\\".length).replace(/\\/g, "/");
  } else if (normalized.startsWith("\\\\?\\")) {
    normalized = normalized.slice("\\\\?\\".length).replace(/\\/g, "/");
  }

  return normalized;
}

export function resolvePreviewPath(projectRoot: string, image: WorkflowPreviewImage): WorkflowPreviewImage {
  if (image.projectRelativePath) {
    const normalizedRoot = projectRoot.replace(/[\\/]+$/, "");
    const normalizedPath = image.projectRelativePath.replace(/^[/\\]+/, "");
    return {
      ...image,
      absolutePath: `${normalizedRoot}/${normalizedPath}`.replace(/\\/g, "/"),
    };
  }

  if (image.absolutePath) {
    return {
      ...image,
      absolutePath: normalizeFilesystemPath(image.absolutePath),
    };
  }

  return image;
}

export function resolvePreviewImageSrc(projectRoot: string, image: WorkflowPreviewImage | undefined): string | undefined {
  if (!image) {
    return undefined;
  }

  if (image.dataUrl?.trim()) {
    return image.dataUrl.trim();
  }

  const resolved = resolvePreviewPath(projectRoot, image);
  const path = resolved.absolutePath ?? resolved.projectRelativePath;
  if (!path) {
    return undefined;
  }

  return convertFileSrc(normalizeFilesystemPath(path));
}

export function resolvePreviewFileName(image: WorkflowPreviewImage): string | undefined {
  const path = image.projectRelativePath ?? image.absolutePath;
  if (!path) {
    return undefined;
  }

  const segments = normalizeFilesystemPath(path).split("/");
  return segments[segments.length - 1];
}
