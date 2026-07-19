import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AppSelect, InspectorField } from "@/components/shared";
import type { WorkflowParamDefinition } from "@/features/workflows/types";
import { resolveParamWidget } from "@/features/workflows/workflowParamValidation";

export interface ParamFieldRendererProps {
  error?: string;
  field: WorkflowParamDefinition;
  onChange: (value: unknown) => void;
  value: unknown;
}

export function ParamFieldRenderer({ error, field, onChange, value }: ParamFieldRendererProps) {
  const widget = resolveParamWidget(field);
  const resolvedValue = value ?? field.defaultValue ?? "";

  if (field.type === "select") {
    return (
      <InspectorField hint={field.description} label={field.label}>
        <AppSelect
          ariaLabel={field.label}
          onValueChange={(nextValue) => onChange(nextValue)}
          options={field.options ?? []}
          value={String(resolvedValue)}
        />
        {error ? <small className="workflow-field-error">{error}</small> : null}
      </InspectorField>
    );
  }

  if (field.type === "number") {
    const numericValue = Number(resolvedValue);
    if (field.widget === "slider" && field.min !== undefined && field.max !== undefined) {
      const min = field.min;
      const max = field.max;
      const step = max - min <= 1 ? 0.05 : 1;
      return (
        <InspectorField hint={field.description} label={field.label}>
          <div className="workflow-inspector-slider">
            <Slider
              aria-label={field.label}
              max={max}
              min={min}
              onValueChange={(next) => onChange(next[0] ?? numericValue)}
              step={step}
              value={[Number.isFinite(numericValue) ? numericValue : min]}
            />
            <span className="workflow-inspector-slider-value">{Number.isFinite(numericValue) ? numericValue : min}</span>
          </div>
          {error ? <small className="workflow-field-error">{error}</small> : null}
        </InspectorField>
      );
    }

    return (
      <InspectorField hint={field.description} label={field.label}>
        <Input
          max={field.max}
          min={field.min}
          onChange={(event) => onChange(Number(event.target.value))}
          type="number"
          value={Number.isFinite(numericValue) ? numericValue : ""}
        />
        {error ? <small className="workflow-field-error">{error}</small> : null}
      </InspectorField>
    );
  }

  if (field.type === "boolean") {
    return (
      <div className="app-inspector-field">
        <label className="workflow-boolean-row">
          <span className="app-inspector-label">{field.label}</span>
          <Switch checked={Boolean(resolvedValue)} onCheckedChange={(checked) => onChange(checked === true)} />
        </label>
        {field.description ? <small className="app-inspector-description">{field.description}</small> : null}
        {error ? <small className="workflow-field-error">{error}</small> : null}
      </div>
    );
  }

  if (widget === "textarea") {
    return (
      <InspectorField hint={field.description} label={field.label}>
        <Textarea onChange={(event) => onChange(event.target.value)} rows={4} value={String(resolvedValue)} />
        {error ? <small className="workflow-field-error">{error}</small> : null}
      </InspectorField>
    );
  }

  return (
    <InspectorField hint={field.description} label={field.label}>
      <Input onChange={(event) => onChange(event.target.value)} value={String(resolvedValue)} />
      {error ? <small className="workflow-field-error">{error}</small> : null}
    </InspectorField>
  );
}
