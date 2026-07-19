import { describe, expect, test } from "bun:test";

import { resolveActionSequencePreviewAssets } from "./workflowActionSequencePreview";

describe("resolveActionSequencePreviewAssets", () => {
  test("returns frame tracks for matching action", () => {
    const outputs = {
      character: {
        actions: [
          {
            id: "idle-front",
            label: "Idle 待机 · 前",
            frames: [
              {
                index: 0,
                label: "Idle 01",
                image: { projectRelativePath: "assets/characters/h1/animations/idle/front/frame_00.png" },
              },
              {
                index: 1,
                label: "Idle 02",
                image: { projectRelativePath: "assets/characters/h1/animations/idle/front/frame_01.png" },
              },
            ],
          },
          {
            id: "idle-back",
            label: "Idle 待机 · 后",
            frames: [
              {
                index: 0,
                label: "Idle 01",
                image: { projectRelativePath: "assets/characters/h1/animations/idle/back/frame_00.png" },
              },
            ],
          },
        ],
      },
    };

    const assets = resolveActionSequencePreviewAssets(outputs, { actionId: "idle", viewKind: "auto" });

    expect(assets.kind).toBe("sequence");
    expect(assets.tracks).toHaveLength(2);
    expect(assets.tracks[0]?.frames).toHaveLength(2);
  });

  test("filters by viewKind when specified", () => {
    const outputs = {
      character: {
        actions: [
          {
            id: "idle-front",
            label: "Idle 待机 · 前",
            frames: [{ image: { path: "assets/a.png" } }],
          },
          {
            id: "idle-back",
            label: "Idle 待机 · 后",
            frames: [{ image: { path: "assets/b.png" } }],
          },
        ],
      },
    };

    const assets = resolveActionSequencePreviewAssets(outputs, { actionId: "idle", viewKind: "back" });

    expect(assets.tracks).toHaveLength(1);
    expect(assets.tracks[0]?.id).toBe("idle-back");
  });
});
