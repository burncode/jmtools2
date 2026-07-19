import { describe, expect, test } from "bun:test";

import { resolveNodePreviewAssets } from "./workflowPreviewAssets";

describe("resolveNodePreviewAssets", () => {
  test("generateViews includes rawImage-only views", () => {
    const outputs = {
      character: {
        id: "hero-1",
        views: [
          { kind: "front", rawImage: { projectRelativePath: "assets/characters/hero-1/views/front.png" } },
          { kind: "back", rawImage: { projectRelativePath: "assets/characters/hero-1/views/back.png" } },
          { kind: "left", rawImage: { projectRelativePath: "assets/characters/hero-1/views/left.png" } },
          { kind: "right", rawImage: { projectRelativePath: "assets/characters/hero-1/views/right.png" } },
        ],
      },
    };

    const assets = resolveNodePreviewAssets(outputs, "character.generateViews");

    expect(assets.kind).toBe("multi");
    expect(assets.images).toHaveLength(4);
  });
});
