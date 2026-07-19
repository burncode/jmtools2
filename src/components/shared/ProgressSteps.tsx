import type { ReactNode } from "react";
import { Check, Circle, LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ProgressStepItem {
  description?: ReactNode;
  label: ReactNode;
  status: "active" | "done" | "pending";
}

interface ProgressStepsProps {
  className?: string;
  elapsedLabel?: ReactNode;
  label?: ReactNode;
  progress?: number;
  steps: readonly ProgressStepItem[];
}

export function ProgressSteps({ className, elapsedLabel, label, progress = 0, steps }: ProgressStepsProps) {
  const normalizedProgress = Math.max(0, Math.min(100, progress));

  return (
    <section className={cn("app-progress-steps", className)} aria-label={typeof label === "string" ? label : undefined}>
      {(label || elapsedLabel) ? (
        <header className="app-progress-steps-header">
          {label ? <strong>{label}</strong> : null}
          {elapsedLabel ? <span>{elapsedLabel}</span> : null}
        </header>
      ) : null}
      <div className="app-progress-steps-bar" aria-hidden="true">
        <i style={{ width: `${normalizedProgress}%` }} />
      </div>
      <ol className="app-progress-steps-list">
        {steps.map((step, index) => (
          <li data-status={step.status} key={`${String(step.label)}-${index}`}>
            {step.status === "done" ? (
              <Check aria-hidden="true" />
            ) : step.status === "active" ? (
              <LoaderCircle aria-hidden="true" />
            ) : (
              <Circle aria-hidden="true" />
            )}
            <span>
              <strong>{step.label}</strong>
              {step.description ? <small>{step.description}</small> : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
