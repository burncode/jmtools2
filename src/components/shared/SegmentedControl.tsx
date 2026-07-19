import { cn } from "@/lib/utils";

export interface SegmentedControlOption<TValue extends string> {
  description?: string;
  label: string;
  value: TValue;
}

interface SegmentedControlProps<TValue extends string> {
  ariaLabel: string;
  className?: string;
  onValueChange: (value: TValue) => void;
  options: Array<SegmentedControlOption<TValue>>;
  value: TValue;
}

export function SegmentedControl<TValue extends string>({
  ariaLabel,
  className,
  onValueChange,
  options,
  value,
}: SegmentedControlProps<TValue>) {
  return (
    <div aria-label={ariaLabel} className={cn("app-segmented-control", className)} role="group">
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          className="app-segmented-item"
          data-active={option.value === value}
          key={option.value}
          onClick={() => onValueChange(option.value)}
          type="button"
        >
          <span>{option.label}</span>
          {option.description ? <small>{option.description}</small> : null}
        </button>
      ))}
    </div>
  );
}
