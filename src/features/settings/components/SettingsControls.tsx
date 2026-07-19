import type { ReactNode } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface SettingsFieldProps {
  children: ReactNode;
  description?: string;
  label: string;
}

interface SettingsSelectOption<TValue extends number | string> {
  label: string;
  value: TValue;
}

interface SettingsSelectProps<TValue extends number | string> {
  disabled?: boolean;
  label: string;
  onChange: (value: TValue) => void;
  options: readonly SettingsSelectOption<TValue>[];
  value: TValue;
}

interface SettingsCheckboxRowProps {
  checked: boolean;
  description?: string;
  label: string;
  onChange: (checked: boolean) => void;
}

function getSelectItemValue(value: number | string, index: number) {
  const stringValue = String(value);

  return stringValue.length > 0 ? stringValue : `__settings_empty_${index}`;
}

export function SettingsField({ children, description, label }: SettingsFieldProps) {
  return (
    <label className="settings-field">
      <span>{label}</span>
      {description ? <small>{description}</small> : null}
      {children}
    </label>
  );
}

export function SettingsSelect<TValue extends number | string>({
  disabled = false,
  label,
  onChange,
  options,
  value,
}: SettingsSelectProps<TValue>) {
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedValue = selectedIndex >= 0 ? getSelectItemValue(value, selectedIndex) : "";

  return (
    <SettingsField label={label}>
      <Select
        disabled={disabled}
        onValueChange={(nextValue) => {
          const selectedOption = options.find((option, index) => getSelectItemValue(option.value, index) === nextValue);

          if (selectedOption) {
            onChange(selectedOption.value);
          }
        }}
        value={selectedValue}
      >
        <SelectTrigger className="settings-select-trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="settings-select-content">
          <div className="settings-select-viewport">
            {options.map((option, index) => (
              <SelectItem
                className="settings-select-item"
                key={`${String(option.value)}-${index}`}
                value={getSelectItemValue(option.value, index)}
              >
                {option.label}
              </SelectItem>
            ))}
          </div>
        </SelectContent>
      </Select>
    </SettingsField>
  );
}

export function SettingsCheckboxRow({ checked, description, label, onChange }: SettingsCheckboxRowProps) {
  return (
    <label className="settings-check-row">
      <span>
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      <Switch checked={checked} className="settings-switch" onCheckedChange={onChange} />
    </label>
  );
}
