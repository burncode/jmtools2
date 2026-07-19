import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CharacterTraitDictionaryEntry } from "@/lib/tauri/commands";

import type { AppearanceTraitCategory, CharacterEntityType, CharacterWorkshopDraft } from "../../../types";
import { useCharacterTraitDictionary } from "../../hooks/useCharacterTraitDictionary";
import { createAppearanceTrait } from "./traitQuickChips";

const categoryLabels: Record<AppearanceTraitCategory, string> = {
  accessory: "配饰",
  body: "形体",
  costume: "服装",
  effect: "特效",
  other: "配色",
  weapon: "武器",
};

const categoryOrder: AppearanceTraitCategory[] = ["costume", "weapon", "body", "accessory", "effect", "other"];

function traitCategoryToAppearanceCategory(category: CharacterTraitDictionaryEntry["category"]): AppearanceTraitCategory {
  if (category === "accessory" || category === "body" || category === "costume" || category === "effect" || category === "weapon") {
    return category;
  }

  return "other";
}

interface OptionalResourcePickerProps {
  draft: CharacterWorkshopDraft;
  entityType: CharacterEntityType;
  onDraftChange: (draft: Partial<CharacterWorkshopDraft>) => void;
}

export function OptionalResourcePicker({ draft, entityType, onDraftChange }: OptionalResourcePickerProps) {
  const [query, setQuery] = useState("");
  const { loading, traits } = useCharacterTraitDictionary();
  const normalizedQuery = query.trim().toLowerCase();

  const visibleGroups = useMemo(() => {
    const filtered = traits.filter((item: CharacterTraitDictionaryEntry) => {
      const matchesEntity = item.entityTypes.length === 0 || item.entityTypes.includes(entityType);
      const matchesQuery =
        !normalizedQuery ||
        item.label.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery) ||
        item.prompt.toLowerCase().includes(normalizedQuery);

      return matchesEntity && matchesQuery;
    });

    return categoryOrder
      .map((category) => ({
        items: filtered.filter((item: CharacterTraitDictionaryEntry) => item.category === category),
        title: categoryLabels[category],
      }))
      .filter((group) => group.items.length > 0);
  }, [entityType, normalizedQuery, traits]);

  function handlePick(item: CharacterTraitDictionaryEntry) {
    if (item.category === "other" && item.colors?.length) {
      onDraftChange({ palette: item.colors.slice(0, 8) });
      return;
    }

    const trait = createAppearanceTrait({
      category: traitCategoryToAppearanceCategory(item.category),
      colors: item.colors,
      label: item.label,
      prompt: item.prompt,
    });

    onDraftChange({
      appearanceTraits: [...draft.appearanceTraits.filter((existing) => existing.label !== item.label), trait].slice(0, 24),
      featureTags: Array.from(new Set([...draft.featureTags, item.label])).slice(0, 16),
    });
  }

  return (
    <details className="character-optional-resource-picker">
      <summary>从资源库挑选（可选）</summary>
      <div className="character-optional-resource-body">
        <label className="assist-search-field">
          <Search aria-hidden="true" size={15} />
          <Input onChange={(event) => setQuery(event.target.value)} placeholder="搜索资源..." value={query} />
        </label>
        {loading ? <p className="character-optional-resource-loading">正在加载资源字典...</p> : null}
        {!loading && visibleGroups.length === 0 ? (
          <p className="character-optional-resource-empty">没有匹配的资源，可在设置中维护「角色外观特征」字典。</p>
        ) : null}
        {visibleGroups.map((group) => (
          <section className="character-optional-resource-group" key={group.title}>
            <header>
              <strong>{group.title}</strong>
            </header>
            <div className="character-optional-resource-grid">
              {group.items.map((item) => (
                <Button key={item.id} onClick={() => handlePick(item)} size="sm" type="button" variant="outline">
                  {item.label}
                </Button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </details>
  );
}
