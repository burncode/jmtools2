import { InspectorField } from "@/components/shared/InspectorField";
import { Slider } from "@/components/ui/slider";

interface AppSliderProps {
  hint?: string;
  label: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}

export function AppSlider({ hint, label, max = 1, min = 0, onChange, step = 0.01, value }: AppSliderProps) {
  const displayValue = step >= 1 ? Math.round(value) : value.toFixed(2);

  return (
    <InspectorField hint={hint} label={label}>
      <div className="app-slider-row">
        <Slider
          aria-label={label}
          className="app-slider-control"
          max={max}
          min={min}
          onValueChange={(nextValue) => onChange(nextValue[0] ?? min)}
          step={step}
          value={[value]}
        />
        <span className="app-slider-value">{displayValue}</span>
      </div>
    </InspectorField>
  );
}
