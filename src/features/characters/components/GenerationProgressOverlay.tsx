import { useEffect, useMemo, useState } from "react";

import { NodeProgressRail } from "@/components/shared";

import type { CharacterPlanGenerationPhase } from "../types";

interface GenerationProgressOverlayProps {
  candidateIndex?: number;
  candidateTotal?: number;
  message?: string;
  phase?: CharacterPlanGenerationPhase;
  startedAt: number;
}

export function GenerationProgressOverlay({
  candidateIndex,
  candidateTotal,
  message,
  phase = "plan",
  startedAt,
}: GenerationProgressOverlayProps) {
  const [now, setNow] = useState(Date.now());
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const progressValue = useMemo(() => {
    if (phase === "plan") {
      return Math.min(38, 12 + elapsedSeconds * 4);
    }

    if (candidateTotal && candidateTotal > 0 && candidateIndex !== undefined) {
      const ratio = Math.min(candidateIndex, candidateTotal) / candidateTotal;
      return Math.min(96, 40 + ratio * 52);
    }

    return Math.min(92, 40 + elapsedSeconds * 3);
  }, [candidateIndex, candidateTotal, elapsedSeconds, phase]);

  const steps = useMemo(() => {
    const candidateLabel =
      candidateTotal && candidateTotal > 0
        ? `生成候选 ${Math.min(candidateIndex ?? 0, candidateTotal)}/${candidateTotal}`
        : "生成候选图";

    if (phase === "plan") {
      return [
        { label: "编译母版方案", status: "active" as const },
        { label: candidateLabel, status: "pending" as const },
        { label: "完成", status: "pending" as const },
      ];
    }

    const candidatesDone = Boolean(candidateTotal && candidateIndex !== undefined && candidateIndex >= candidateTotal);

    return [
      { label: "编译母版方案", status: "done" as const },
      {
        label: candidateLabel,
        status: candidatesDone ? ("done" as const) : ("active" as const),
      },
      { label: "完成", status: candidatesDone ? ("active" as const) : ("pending" as const) },
    ];
  }, [candidateIndex, candidateTotal, phase]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="generation-progress-overlay" aria-live="polite">
      <div className="generation-orbit" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <NodeProgressRail
        className="generation-node-progress-rail"
        metaLabel={`已用时 ${formatElapsedTime(elapsedSeconds)}`}
        progress={progressValue}
        steps={steps}
        title={message ?? (phase === "plan" ? "正在编译母版方案..." : "正在生成候选图...")}
      />
    </div>
  );
}

function formatElapsedTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
}
