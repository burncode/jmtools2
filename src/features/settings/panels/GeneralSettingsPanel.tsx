import { FolderCog, Power, Save } from "lucide-react";

import { Input } from "@/components/ui/input";

import { SettingsCheckboxRow, SettingsSelect } from "../components/SettingsControls";
import { SettingsCardGrid } from "../components/SettingsPanelPrimitives";
import { SettingsSectionCard } from "../components/SettingsSectionCard";
import { closeWindowOptions, languageOptions } from "../settingsOptions";
import type { SettingsPanelProps } from "./types";

export function GeneralSettingsPanel({ settings, updateSettings }: SettingsPanelProps) {
  return (
    <SettingsCardGrid>
      <SettingsSectionCard description="控制应用启动、关闭和剪贴板导入行为。" icon={Power} title="启动与窗口">
        <SettingsCheckboxRow
          checked={settings.launchOnStartup}
          description="以后接入系统启动项权限后生效。"
          label="开机自启动"
          onChange={(launchOnStartup) => updateSettings({ launchOnStartup })}
        />
        <SettingsCheckboxRow
          checked={settings.minimizeOnStartup}
          description="启动后进入后台，减少打断。"
          label="启动时最小化"
          onChange={(minimizeOnStartup) => updateSettings({ minimizeOnStartup })}
        />
        <SettingsCheckboxRow
          checked={settings.clipboardQuickImport}
          description="检测剪贴板里的素材路径或 Prompt JSON。"
          label="剪切板快速导入"
          onChange={(clipboardQuickImport) => updateSettings({ clipboardQuickImport })}
        />
        <SettingsSelect
          label="关闭窗口行为"
          onChange={(closeWindowBehavior) => updateSettings({ closeWindowBehavior })}
          options={closeWindowOptions}
          value={settings.closeWindowBehavior}
        />
      </SettingsSectionCard>

      <SettingsSectionCard description="用于项目工作台、生成任务和编辑器状态。" icon={Save} title="自动保存">
        <SettingsCheckboxRow
          checked={settings.autosaveEnabled}
          description="编辑中的参数、任务状态会进入本机设置缓存。"
          label="启用自动保存"
          onChange={(autosaveEnabled) => updateSettings({ autosaveEnabled })}
        />
        <label className="settings-field">
          <span>自动保存间隔（秒）</span>
          <Input
            max={600}
            min={30}
            onChange={(event) =>
              updateSettings({ autosaveIntervalSeconds: Number.parseInt(event.target.value, 10) || 30 })
            }
            type="number"
            value={settings.autosaveIntervalSeconds}
          />
        </label>
      </SettingsSectionCard>

      <SettingsSectionCard description="默认中文，后续可扩展翻译资源。" icon={FolderCog} title="语言与区域">
        <SettingsSelect
          label="界面语言"
          onChange={(language) => updateSettings({ language })}
          options={languageOptions}
          value={settings.language}
        />
      </SettingsSectionCard>
    </SettingsCardGrid>
  );
}
