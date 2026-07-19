import { cn } from "@/lib/utils";

export interface ColorThemeOption {
  gradient: string;
  label: string;
  value: string;
}

export const DEFAULT_COLOR_THEME_OPTIONS: ColorThemeOption[] = [
  {
    gradient: "linear-gradient(135deg, #0f172a 0%, #1e293b 45%, #334155 100%)",
    label: "暗色",
    value: "dark",
  },
  {
    gradient: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 45%, #cbd5e1 100%)",
    label: "亮色",
    value: "light",
  },
  {
    gradient: "linear-gradient(135deg, #312e81 0%, #7c3aed 45%, #22d3ee 100%)",
    label: "奇幻",
    value: "fantasy",
  },
  {
    gradient: "linear-gradient(135deg, #7c2d12 0%, #ea580c 45%, #fbbf24 100%)",
    label: "暖色",
    value: "warm",
  },
  {
    gradient: "linear-gradient(135deg, #0c4a6e 0%, #0284c7 45%, #67e8f9 100%)",
    label: "冷色",
    value: "cool",
  },
  {
    gradient: "linear-gradient(135deg, #09090b 0%, #22d3ee 45%, #f0abfc 100%)",
    label: "霓虹",
    value: "neon",
  },
  {
    gradient: "linear-gradient(135deg, #fce7f3 0%, #fbcfe8 45%, #ddd6fe 100%)",
    label: "粉彩",
    value: "pastel",
  },
  {
    gradient: "linear-gradient(135deg, #365314 0%, #854d0e 45%, #78716c 100%)",
    label: "大地",
    value: "earth",
  },
  {
    gradient: "linear-gradient(135deg, #171717 0%, #525252 45%, #d4d4d4 100%)",
    label: "单色",
    value: "monochrome",
  },
];

interface ColorThemePickerProps {
  onValueChange: (value: string) => void;
  options?: ColorThemeOption[];
  value: string;
}

export function ColorThemePicker({
  onValueChange,
  options = DEFAULT_COLOR_THEME_OPTIONS,
  value,
}: ColorThemePickerProps) {
  return (
    <div aria-label="配色主题" className="app-color-theme-picker" role="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            aria-checked={selected}
            className={cn("app-color-theme-card", selected && "app-color-theme-card-selected")}
            key={option.value}
            onClick={() => onValueChange(option.value)}
            role="radio"
            type="button"
          >
            <span aria-hidden="true" className="app-color-theme-preview" style={{ background: option.gradient }} />
            <span className="app-color-theme-label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
