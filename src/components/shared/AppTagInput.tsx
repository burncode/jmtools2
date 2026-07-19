import { X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AppTagInputProps {
  className?: string;
  maxTags?: number;
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  showAddButton?: boolean;
  value: string[];
}

export function AppTagInput({
  className,
  maxTags = 8,
  onValueChange,
  placeholder = "输入标签后回车",
  showAddButton = true,
  value,
}: AppTagInputProps) {
  const [draft, setDraft] = useState("");

  function addTag() {
    const nextTag = normalizeTag(draft);

    if (!nextTag || value.includes(nextTag) || value.length >= maxTags) {
      return;
    }

    onValueChange([...value, nextTag]);
    setDraft("");
  }

  function removeTag(tag: string) {
    onValueChange(value.filter((item) => item !== tag));
  }

  return (
    <div className={cn("app-tag-input", className)}>
      <div className="app-tag-input-values" aria-label="当前标签">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary">
            {tag}
            <button aria-label={`移除标签 ${tag}`} onClick={() => removeTag(tag)} type="button">
              <X aria-hidden="true" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="app-tag-input-row">
        <Input
          maxLength={20}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "," || event.key === "，") {
              event.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder}
          value={draft}
        />
        {showAddButton ? (
          <Button disabled={value.length >= maxTags || draft.trim().length === 0} onClick={addTag} type="button" variant="outline">
            添加
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function normalizeTag(value: string) {
  return value.trim().replace(/[,，\s]+/g, "").slice(0, 12);
}
