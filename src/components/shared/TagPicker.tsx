import { Check, ChevronDown, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface TagPickerOption {
  label: string;
  value: string;
}

interface TagPickerProps {
  className?: string;
  maxVisibleTags?: number;
  onValueChange: (value: string[]) => void;
  options: TagPickerOption[];
  placeholder?: string;
  value: string[];
}

export function TagPicker({
  className,
  maxVisibleTags = 5,
  onValueChange,
  options,
  placeholder = "选择标签",
  value,
}: TagPickerProps) {
  const visibleTags = value.slice(0, maxVisibleTags);
  const hiddenCount = Math.max(0, value.length - visibleTags.length);

  function toggleValue(nextValue: string) {
    if (value.includes(nextValue)) {
      onValueChange(value.filter((item) => item !== nextValue));
      return;
    }

    onValueChange([...value, nextValue]);
  }

  return (
    <div className={cn("app-tag-picker", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <button className="app-tag-picker-trigger" type="button">
            <span>{value.length > 0 ? `已选 ${value.length} 个元素` : placeholder}</span>
            <ChevronDown aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="app-tag-picker-popover">
          {options.map((option) => {
            const isActive = value.includes(option.value);

            return (
              <button
                aria-pressed={isActive}
                className="app-tag-picker-option"
                data-active={isActive}
                key={option.value}
                onClick={() => toggleValue(option.value)}
                type="button"
              >
                <span>{option.label}</span>
                {isActive ? <Check aria-hidden="true" /> : null}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
      {value.length > 0 ? (
        <div className="app-tag-picker-values">
          {visibleTags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
              <button aria-label={`移除 ${tag}`} onClick={() => toggleValue(tag)} type="button">
                <X aria-hidden="true" />
              </button>
            </Badge>
          ))}
          {hiddenCount > 0 ? <Badge variant="secondary">+{hiddenCount}</Badge> : null}
        </div>
      ) : null}
    </div>
  );
}
