import { useEffect, useState } from "react";

import type { CharacterTraitDictionaryEntry } from "@/lib/tauri/commands";
import { getAppSettings } from "@/lib/tauri/commands";

import { defaultCharacterTraits } from "@/features/settings/settingsDefaults";

let cachedTraits: CharacterTraitDictionaryEntry[] | null = null;
let cachePromise: Promise<CharacterTraitDictionaryEntry[]> | null = null;

export function useCharacterTraitDictionary() {
  const [traits, setTraits] = useState<CharacterTraitDictionaryEntry[]>(cachedTraits ?? defaultCharacterTraits);
  const [loading, setLoading] = useState(!cachedTraits);

  useEffect(() => {
    if (cachedTraits) {
      return;
    }

    if (!cachePromise) {
      cachePromise = getAppSettings()
        .then((settings) => {
          const entries = settings.presetDictionaries.characterTraits?.filter(
            (entry) => entry.enabled && entry.label.trim() && entry.prompt.trim(),
          );
          cachedTraits = entries?.length ? entries : defaultCharacterTraits;
          return cachedTraits;
        })
        .catch(() => defaultCharacterTraits);
    }

    void cachePromise.then((entries) => {
      cachedTraits = entries;
      setTraits(entries);
      setLoading(false);
    });
  }, []);

  return { loading, traits };
}

export function invalidateCharacterTraitDictionaryCache() {
  cachedTraits = null;
  cachePromise = null;
}
