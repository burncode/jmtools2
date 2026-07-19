export type SettingsSectionId =
  | "general"
  | "ai"
  | "local-models"
  | "presets"
  | "display"
  | "resources"
  | "export"
  | "diagnostics"
  | "about";

export interface SettingsSection {
  description: string;
  id: SettingsSectionId;
  label: string;
}
