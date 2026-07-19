import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface AppSelectOption {
  description?: string;
  label: string;
  value: string;
}

interface AppSelectProps {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
  options: AppSelectOption[];
  placeholder?: string;
  size?: "default" | "compact";
  value: string;
}

export function AppSelect({
  ariaLabel,
  className,
  disabled = false,
  onValueChange,
  options,
  placeholder = "请选择",
  size = "default",
  value,
}: AppSelectProps) {
  return (
    <Select disabled={disabled} onValueChange={onValueChange} value={value}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          "app-select-trigger",
          size === "compact" && "app-select-trigger--compact",
          size === "compact" &&
            "h-[var(--app-control-height-sm)] border-[var(--app-control-border)] bg-[var(--app-control-bg)]",
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="app-select-content">
        {options.map((option) => (
          <SelectItem className="app-select-item" key={option.value} value={option.value}>
            <span>{option.label}</span>
            {option.description ? <small>{option.description}</small> : null}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
