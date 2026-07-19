import { convertFileSrc } from "@tauri-apps/api/core";

import type { CharacterImageAsset, CharacterLibraryRecord } from "./types";

function joinProjectPath(projectRoot: string, projectRelativePath: string) {
  const root = projectRoot.replace(/[/\\]+$/, "");
  const relative = projectRelativePath.replace(/^[/\\]+/, "");
  const separator = root.includes("\\") ? "\\" : "/";

  return `${root}${separator}${relative.replace(/\//g, separator)}`;
}

export function resolveCharacterImageSrc(
  projectRoot: string,
  image?: CharacterImageAsset | null,
): string {
  if (!image) {
    return "";
  }

  if (image.dataUrl?.trim()) {
    return image.dataUrl;
  }

  const absolutePath =
    image.absolutePath?.trim() ||
    (image.projectRelativePath?.trim() && projectRoot
      ? joinProjectPath(projectRoot, image.projectRelativePath.trim())
      : "");

  if (!absolutePath) {
    return "";
  }

  return convertFileSrc(absolutePath);
}

export function resolveLibraryCardImage(projectRoot: string, record: CharacterLibraryRecord): string {
  return (
    resolveCharacterImageSrc(projectRoot, record.previewImage) ||
    resolveCharacterImageSrc(projectRoot, record.masterImage)
  );
}

export function hasCharacterImageSource(
  projectRoot: string,
  image?: CharacterImageAsset | null,
): boolean {
  if (!image) {
    return false;
  }

  return Boolean(
    image.dataUrl?.trim() ||
      image.absolutePath?.trim() ||
      (projectRoot && image.projectRelativePath?.trim()),
  );
}
