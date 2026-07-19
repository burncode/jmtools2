import type { CSSProperties, ReactNode } from "react";
import { Check, Circle, LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ProgressStepItem } from "./ProgressSteps";

interface NodeProgressRailProps {
  className?: string;
  metaLabel?: ReactNode;
  progress?: number;
  steps: readonly ProgressStepItem[];
  title?: ReactNode;
}

export function NodeProgressRail({ className, metaLabel, progress = 0, steps, title }: NodeProgressRailProps) {
  const normalizedProgress = Math.max(0, Math.min(100, progress));

  return (
    <section className={cn("app-node-progress-rail", className)} aria-label={typeof title === "string" ? title : "进度"}>
      {title ? <header className="app-node-progress-rail-title">{title}</header> : null}

      <div className="app-node-progress-rail-track" style={{ "--node-progress": `${normalizedProgress}%` } as CSSProperties}>
        <div className="app-node-progress-rail-line" aria-hidden="true">
          <i />
        </div>
        <ol className="app-node-progress-rail-nodes">
          {steps.map((step, index) => (
            <li data-status={step.status} key={`${String(step.label)}-${index}`}>
              <span className="app-node-progress-rail-node-icon" aria-hidden="true">
                {step.status === "done" ? (
                  <Check />
                ) : step.status === "active" ? (
                  <LoaderCircle className="app-node-progress-rail-spinner" />
                ) : (
                  <Circle />
                )}
              </span>
              <span className="app-node-progress-rail-node-label">{step.label}</span>
            </li>
          ))}
        </ol>
      </div>

      {metaLabel ? <footer className="app-node-progress-rail-meta">{metaLabel}</footer> : null}
    </section>
  );
}
