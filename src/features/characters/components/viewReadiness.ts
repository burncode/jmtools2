import type { CharacterAssetRecord, CharacterViewAsset } from "../types";
import { hasCharacterImageSource, resolveCharacterImageSrc } from "../characterImageSrc";

import type { DirectionViewKind } from "./CharacterDirectionGrid";

export type ViewReadiness = "default" | "mirrored" | "missing" | "ready";

export function getMirrorSourceKind(
  targetKind: string,
  direction: CharacterAssetRecord["direction"],
): string | undefined {
  if (direction === "four") {
    if (targetKind === "left") {
      return "right";
    }
    return undefined;
  }
  if (direction === "eight") {
    const map: Record<string, string> = {
      backLeft: "backRight",
      frontLeft: "frontRight",
      left: "right",
    };
    return map[targetKind];
  }
  return undefined;
}

export function isViewImageReady(view: CharacterViewAsset | undefined, projectRoot = "") {
  if (!view) {
    return false;
  }

  return (
    hasCharacterImageSource(projectRoot, view.transparentImage) ||
    hasCharacterImageSource(projectRoot, view.normalizedImage) ||
    hasCharacterImageSource(projectRoot, view.rawImage)
  );
}

export function findViewByKind(record: CharacterAssetRecord, viewKind: string) {
  return record.views?.find((view) => view.kind === viewKind);
}

export function findViewThumb(
  record: CharacterAssetRecord,
  viewKind: DirectionViewKind,
  projectRoot = "",
) {
  if (viewKind === "default") {
    return undefined;
  }

  const view = findViewByKind(record, viewKind);

  return (
    resolveCharacterImageSrc(projectRoot, view?.transparentImage) ||
    resolveCharacterImageSrc(projectRoot, view?.normalizedImage) ||
    resolveCharacterImageSrc(projectRoot, view?.rawImage) ||
    undefined
  );
}

export function getViewReadiness(
  record: CharacterAssetRecord,
  viewKind: DirectionViewKind,
  projectRoot = "",
): ViewReadiness {
  if (viewKind === "default") {
    return "default";
  }

  const view = findViewByKind(record, viewKind);
  if (isViewImageReady(view, projectRoot)) {
    return "ready";
  }

  const mirrorSource = getMirrorSourceKind(viewKind, record.direction);
  if (mirrorSource && isViewImageReady(findViewByKind(record, mirrorSource), projectRoot)) {
    return "mirrored";
  }

  return "missing";
}

export function resolveTargetViewKind(
  viewKind: DirectionViewKind | undefined,
  direction: CharacterAssetRecord["direction"],
): DirectionViewKind {
  if (!viewKind || viewKind === "default") {
    if (direction === "single") {
      return "single";
    }
    return "front";
  }
  return viewKind;
}
