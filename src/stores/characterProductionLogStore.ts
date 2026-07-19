import { create } from "zustand";

export type CharacterProductionLogLevel = "debug" | "error" | "info" | "qc" | "step";

export interface CharacterProductionLogEntry {
  id: string;
  level: CharacterProductionLogLevel;
  message: string;
  phase?: "delivery" | "export" | "generate" | "reference";
  timestamp: number;
}

interface CharacterProductionLogState {
  characterId?: string;
  entries: CharacterProductionLogEntry[];
  isExpanded: boolean;
  appendLog: (entry: Omit<CharacterProductionLogEntry, "id" | "timestamp">) => void;
  clearLogs: (characterId?: string) => void;
  setExpanded: (expanded: boolean) => void;
  setCharacterScope: (characterId: string) => void;
}

let logSequence = 0;

export const useCharacterProductionLogStore = create<CharacterProductionLogState>((set, get) => ({
  characterId: undefined,
  entries: [],
  isExpanded: false,
  appendLog: (entry) =>
    set((state) => ({
      entries: [
        ...state.entries,
        {
          ...entry,
          id: `log-${++logSequence}`,
          timestamp: Date.now(),
        },
      ].slice(-200),
    })),
  clearLogs: (characterId) =>
    set((state) => {
      if (characterId && state.characterId && state.characterId !== characterId) {
        return state;
      }
      return { entries: [] };
    }),
  setExpanded: (expanded) => set({ isExpanded: expanded }),
  setCharacterScope: (characterId) => {
    const current = get().characterId;
    if (current !== characterId) {
      set({ characterId, entries: [] });
    }
  },
}));

export function logProductionStep(
  message: string,
  phase: CharacterProductionLogEntry["phase"] = "generate",
  level: CharacterProductionLogLevel = "step",
) {
  useCharacterProductionLogStore.getState().appendLog({ level, message, phase });
}

export function logProductionError(message: string, phase?: CharacterProductionLogEntry["phase"]) {
  useCharacterProductionLogStore.getState().appendLog({ level: "error", message, phase });
}

export function logProductionQc(message: string) {
  useCharacterProductionLogStore.getState().appendLog({ level: "qc", message, phase: "delivery" });
}
