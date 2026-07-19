import { Download, PackageCheck } from "lucide-react";

import { SettingsSelect } from "../components/SettingsControls";
import { SettingsCardGrid, SettingsNote, SettingsReadOnlyRow } from "../components/SettingsPanelPrimitives";
import { SettingsSectionCard } from "../components/SettingsSectionCard";
import { exportFormatOptions } from "../settingsOptions";
import type { SettingsPanelProps } from "./types";

export function ExportSettingsPanel({ settings, updateSettings }: SettingsPanelProps) {
  return (
    <SettingsCardGrid>
      <SettingsSectionCard description="这里仅保存默认偏好，真正导出时仍可按资源类型覆盖。" icon={Download} title="导出默认值">
        <SettingsSelect
          label="默认导出格式"
          onChange={(defaultExportFormat) => updateSettings({ defaultExportFormat })}
          options={exportFormatOptions}
          value={settings.defaultExportFormat}
        />
        <SettingsReadOnlyRow label="默认资源格式" value="普通 PNG 优先" />
      </SettingsSectionCard>

      <SettingsSectionCard description="导出插件会在后续功能稳定后再开放配置。" icon={PackageCheck} title="可插拔导出">
        <SettingsReadOnlyRow label="当前内置" value="PNG / Spritesheet + JSON" />
        <SettingsNote>默认格式保持通用，不强绑定 PixiJS、Godot 或 Unity。</SettingsNote>
      </SettingsSectionCard>
    </SettingsCardGrid>
  );
}
