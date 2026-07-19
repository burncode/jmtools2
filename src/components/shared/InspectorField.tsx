import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { FieldHint } from "./FieldHint";

interface InspectorFieldProps {
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  hint?: string;
  label: ReactNode;
}

export function InspectorField({ children, className, description, hint, label }: InspectorFieldProps) {
  return (
    <label className={cn("app-inspector-field", className)}>
      <span className="app-inspector-label">
        {label}
        {hint ? <FieldHint text={hint} /> : null}
      </span>
      {children}
      {description ? <small className="app-inspector-description">{description}</small> : null}
    </label>
  );
}
