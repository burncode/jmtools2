import { describe, expect, test } from "bun:test";

import { mergeNodeRunUpdate } from "./workflowEvents";
import type { WorkflowRun } from "./types";

function createRun(): WorkflowRun {
  return {
    error: "",
    id: "run-1",
    nodeRuns: [
      {
        error: "",
        nodeId: "candidates",
        nodeKind: "character.generateCandidates",
        outputs: {},
        status: "running",
      },
    ],
    startedAt: 1,
    status: "running",
    workflowId: "wf-1",
    workflowName: "测试",
  };
}

describe("mergeNodeRunUpdate", () => {
  test("merges sanitized outputs when node succeeds", () => {
    const run = createRun();
    const outputs = {
      asset: {
        data: {
          items: [
            {
              image: { path: "assets/.cache/character-candidates/task/candidate_a.png" },
              planId: "plan-a",
            },
          ],
        },
        kind: "candidateImages",
      },
    };

    const merged = mergeNodeRunUpdate(run, {
      error: "",
      nodeId: "candidates",
      nodeKind: "character.generateCandidates",
      outputSummary: "Asset：candidateImages",
      outputs,
      runId: "run-1",
      status: "succeeded",
      workflowId: "wf-1",
    });

    expect(merged?.nodeRuns[0]?.status).toBe("succeeded");
    expect(merged?.nodeRuns[0]?.outputs).toEqual(outputs);
  });

  test("keeps existing outputs when event payload has none", () => {
    const run = createRun();
    run.nodeRuns[0] = {
      ...run.nodeRuns[0],
      outputs: { image: { path: "assets/existing.png" } },
      status: "succeeded",
    };

    const merged = mergeNodeRunUpdate(run, {
      error: "",
      nodeId: "candidates",
      nodeKind: "character.generateCandidates",
      outputSummary: "",
      runId: "run-1",
      status: "running",
      workflowId: "wf-1",
    });

    expect(merged?.nodeRuns[0]?.outputs).toEqual({ image: { path: "assets/existing.png" } });
  });
});
