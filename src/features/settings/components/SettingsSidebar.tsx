import { BookMarked, BrainCircuit, Database, Download, FileText, HardDrive, Info, MonitorCog, Settings2 } from "lucide-react";

import { settingsSections } from "../settingsOptions";
import type { SettingsSectionId } from "../types";

interface SettingsSidebarProps {
  activeSection: SettingsSectionId;
  onSectionChange: (sectionId: SettingsSectionId) => void;
}

const sectionIcons = {
  about: Info,
  ai: BrainCircuit,
  diagnostics: FileText,
  display: MonitorCog,
  export: Download,
  general: Settings2,
  "local-models": HardDrive,
  presets: BookMarked,
  resources: Database,
} as const satisfies Record<SettingsSectionId, typeof Settings2>;

export function SettingsSidebar({ activeSection, onSectionChange }: SettingsSidebarProps) {
  return (
    <nav className="settings-section-list" aria-label="设置分类">
      {settingsSections.map((section) => {
        const Icon = sectionIcons[section.id];

        return (
          <button
            className="settings-section-button"
            data-active={activeSection === section.id}
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            type="button"
          >
            <Icon aria-hidden="true" />
            <span>{section.label}</span>
            <small>{section.description}</small>
          </button>
        );
      })}
    </nav>
  );
}
