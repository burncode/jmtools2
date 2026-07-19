import type { AppSettings } from "@/lib/tauri/commands";

export interface SettingsPanelProps {
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
}
