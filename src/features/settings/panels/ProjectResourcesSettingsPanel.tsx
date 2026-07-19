import { Database, FolderCog } from "lucide-react";

import { Input } from "@/components/ui/input";

import { SettingsField } from "../components/SettingsControls";
import { SettingsCardGrid, SettingsReadOnlyRow } from "../components/SettingsPanelPrimitives";
import { SettingsSectionCard } from "../components/SettingsSectionCard";
import type { SettingsPanelProps } from "./types";

export function ProjectResourcesSettingsPanel({ settings, updateSettings }: SettingsPanelProps) {
  return (
    <SettingsCardGrid>
      <SettingsSectionCard description="应用设置进入本机数据库，项目数据仍留在项目目录。" icon={Database} title="本地数据">
        <SettingsReadOnlyRow label="设置数据库" value="jmtools.db" />
        <SettingsReadOnlyRow label="项目清单" value="jmproject.json" />
      </SettingsSectionCard>

      <SettingsSectionCard description="用于新建项目时的默认路径，后续会接入目录选择器。" icon={FolderCog} title="项目目录">
        <SettingsField label="默认工作目录">
          <Input
            onChange={(event) => updateSettings({ workspaceRoot: event.target.value })}
            placeholder="例如 D:\\JMTools\\Projects"
            value={settings.workspaceRoot}
          />
        </SettingsField>
      </SettingsSectionCard>
    </SettingsCardGrid>
  );
}
