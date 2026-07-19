import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteCharacterAsset,
  getCharacterAsset,
  listCharacterLibrary,
  toggleCharacterFavorite,
} from "@/lib/tauri/commands";

import type { CharacterAssetRecord, CharacterLibraryRecord } from "../types";

export const characterQueryKeys = {
  all: (projectRoot: string) => ["characters", projectRoot] as const,
  detail: (projectRoot: string, characterId: string) => ["characters", projectRoot, characterId] as const,
  library: (projectRoot: string) => ["characters", projectRoot, "library"] as const,
};

export function useCharacterLibraryList(projectRoot: string) {
  return useQuery({
    enabled: Boolean(projectRoot),
    queryFn: () => listCharacterLibrary(projectRoot),
    queryKey: characterQueryKeys.library(projectRoot),
  });
}

export function useCharacterRecord(projectRoot: string, characterId: string | undefined) {
  return useQuery({
    enabled: Boolean(projectRoot && characterId),
    queryFn: () => getCharacterAsset(projectRoot, characterId!),
    queryKey: characterQueryKeys.detail(projectRoot, characterId ?? ""),
  });
}

export function useCharacterRecordMutations(projectRoot: string) {
  const queryClient = useQueryClient();

  function invalidateCharacter(record: CharacterAssetRecord) {
    void queryClient.invalidateQueries({ queryKey: characterQueryKeys.library(projectRoot) });
    void queryClient.invalidateQueries({ queryKey: characterQueryKeys.detail(projectRoot, record.id) });
    queryClient.setQueryData(characterQueryKeys.detail(projectRoot, record.id), record);
  }

  function invalidateLibrary() {
    void queryClient.invalidateQueries({ queryKey: characterQueryKeys.library(projectRoot) });
  }

  const toggleFavorite = useMutation({
    mutationFn: ({ characterId, favorite }: { characterId: string; favorite: boolean }) =>
      toggleCharacterFavorite(projectRoot, characterId, favorite),
    onSuccess: invalidateCharacter,
  });

  const deleteCharacter = useMutation({
    mutationFn: (characterId: string) => deleteCharacterAsset(projectRoot, characterId),
    onSuccess: (_result, characterId) => {
      void queryClient.invalidateQueries({ queryKey: characterQueryKeys.library(projectRoot) });
      queryClient.removeQueries({ queryKey: characterQueryKeys.detail(projectRoot, characterId) });
    },
  });

  return {
    deleteCharacter,
    invalidateCharacter,
    invalidateLibrary,
    toggleFavorite,
  };
}

export type { CharacterLibraryRecord };
