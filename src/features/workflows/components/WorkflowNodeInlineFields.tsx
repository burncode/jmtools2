import { AppSelect } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

import type { WorkflowNode, WorkflowNodeDefinition, WorkflowParamDefinition } from "../types";
import { getWorkflowParamValue } from "../workflowParamValidation";
import {
  parseMultiSelectValue,
  serializeMultiSelectValue,
  toggleMultiSelectValue,
} from "../workflowMultiSelect";

interface WorkflowNodeInlineFieldsProps {
  definition?: WorkflowNodeDefinition;
  node: WorkflowNode;
  onParamChange: (key: string, value: unknown) => void;
}

export function WorkflowNodeInlineFields({ definition, node, onParamChange }: WorkflowNodeInlineFieldsProps) {
  const inlineFields = (definition?.paramsSchema ?? []).filter((field) => field.display === "inline");

  if (!inlineFields.length) {
    return null;
  }

  return (
    <div className="workflow-node-inline-fields">
      {inlineFields.map((field) => renderInlineField(field, node, onParamChange))}
    </div>
  );
}

function renderInlineField(
  field: WorkflowParamDefinition,
  node: WorkflowNode,
  onParamChange: (key: string, value: unknown) => void,
) {
  const value = getWorkflowParamValue(node, field);
  const fieldId = `${node.id}-${field.id}`;

  if (field.widget === "multiSelect") {
    const selected = parseMultiSelectValue(value);
    return (
      <div className="workflow-node-inline-field workflow-node-inline-field-block" key={field.id}>
        <Label className="workflow-node-inline-field-label" htmlFor={fieldId}>
          {field.label}
        </Label>
        <div className="workflow-node-inline-chips" id={fieldId} role="group" aria-label={field.label}>
          {(field.options ?? []).map((option) => {
            const active = selected.includes(option.value);
            return (
              <button
                aria-pressed={active}
                className="workflow-node-inline-chip"
                data-active={active}
                key={option.value}
                onClick={() => onParamChange(field.id, serializeMultiSelectValue(toggleMultiSelectValue(selected, option.value)))}
                type="button"
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === "boolean") {
    return (
      <div className="workflow-node-inline-field" key={field.id}>
        <Label className="workflow-node-inline-field-label" htmlFor={fieldId}>
          {field.label}
        </Label>
        <div className="workflow-node-inline-switch">
          <Switch
            aria-label={field.label}
            checked={Boolean(value)}
            id={fieldId}
            onCheckedChange={(checked) => onParamChange(field.id, checked === true)}
          />
        </div>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="workflow-node-inline-field" key={field.id}>
        <Label className="workflow-node-inline-field-label" htmlFor={fieldId}>
          {field.label}
        </Label>
        <AppSelect
          ariaLabel={field.label}
          onValueChange={(nextValue) => onParamChange(field.id, nextValue)}
          options={field.options ?? []}
          value={String(value)}
        />
      </div>
    );
  }

  if (field.type === "number") {
    const numericValue = Number(value);
    const useSlider = field.widget === "slider" && field.min !== undefined && field.max !== undefined;

    if (useSlider) {
      const min = field.min as number;
      const max = field.max as number;
      const step = max - min <= 1 ? 0.05 : 1;
      return (
        <div className="workflow-node-inline-field workflow-node-inline-field-block" key={field.id}>
          <Label className="workflow-node-inline-field-label" htmlFor={fieldId}>
            {field.label}
          </Label>
          <div className="workflow-node-inline-slider">
            <Slider
              aria-label={field.label}
              id={fieldId}
              max={max}
              min={min}
              onValueChange={(next) => onParamChange(field.id, next[0] ?? numericValue)}
              step={step}
              value={[Number.isFinite(numericValue) ? numericValue : min]}
            />
            <span className="workflow-node-inline-slider-value">
              {Number.isFinite(numericValue) ? numericValue : min}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="workflow-node-inline-field" key={field.id}>
        <Label className="workflow-node-inline-field-label" htmlFor={fieldId}>
          {field.label}
        </Label>
        <Input
          id={fieldId}
          max={field.max}
          min={field.min}
          onChange={(event) => {
            const parsed = Number.parseInt(event.target.value, 10);
            const fallback = Number(field.defaultValue ?? 0);
            const nextValue = Number.isFinite(parsed) ? parsed : fallback;
            const clamped = Math.min(field.max ?? nextValue, Math.max(field.min ?? nextValue, nextValue));
            onParamChange(field.id, clamped);
          }}
          type="number"
          value={Number(value)}
        />
      </div>
    );
  }

  return (
    <div className="workflow-node-inline-field" key={field.id}>
      <Label className="workflow-node-inline-field-label" htmlFor={fieldId}>
        {field.label}
      </Label>
      <Input id={fieldId} onChange={(event) => onParamChange(field.id, event.target.value)} value={String(value)} />
    </div>
  );
}
