import { X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TagInputProps {
  className?: string;
  onChange: (tags: string[]) => void;
  placeholder?: string;
  value: string[];
}

export function TagInput({
  className,
  onChange,
  placeholder = "输入标签后按 Enter 添加",
  value,
}: TagInputProps) {
  const [draft, setDraft] = useState("");

  function addTag(raw: string) {
    const nextTag = raw.trim();
    if (!nextTag || value.includes(nextTag)) {
      return;
    }
    onChange([...value, nextTag]);
  }

  function removeTag(tag: string) {
    onChange(value.filter((item) => item !== tag));
  }

  return (
    <div className={cn("app-tag-input", className)}>
      <Input
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            addTag(draft);
            setDraft("");
            return;
          }

          if (event.key === "Backspace" && draft.length === 0 && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        placeholder={placeholder}
        value={draft}
      />
      {value.length > 0 ? (
        <div className="app-tag-input-values">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
              <button aria-label={`移除标签 ${tag}`} onClick={() => removeTag(tag)} type="button">
                <X aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
