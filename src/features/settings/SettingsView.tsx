import { CheckCircle2, RotateCcw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppPageShell, SettingsLayout } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { getAppSettings, saveAppSettings, type AppSettings } from "@/lib/tauri/commands";
import { applyAppAccentColor, applyAppDensity, applyAppTheme } from "@/lib/theme";

import { SettingsSidebar } from "./components/SettingsSidebar";
import { defaultSettings } from "./settingsDefaults";
import { settingsSections } from "./settingsOptions";
import { AboutSettingsPanel } from "./panels/AboutSettingsPanel";
import { DiagnosticsSettingsPanel } from "./panels/DiagnosticsSettingsPanel";
import { AiSettingsPanel } from "./panels/AiSettingsPanel";
import { DisplaySettingsPanel } from "./panels/DisplaySettingsPanel";
import { ExportSettingsPanel } from "./panels/ExportSettingsPanel";
import { GeneralSettingsPanel } from "./panels/GeneralSettingsPanel";
import { LocalModelsSettingsPanel } from "./panels/LocalModelsSettingsPanel";
import { PresetDictionarySettingsPanel } from "./panels/PresetDictionarySettingsPanel";
import { ProjectResourcesSettingsPanel } from "./panels/ProjectResourcesSettingsPanel";
import type { SettingsSectionId } from "./types";

import "./SettingsView.css";

export function SettingsView() {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("general");
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("设置保存在本机 SQLite 数据库中。");
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const loadedSettings = await getAppSettings();

        if (isMounted) {
          const mergedSettings = { ...defaultSettings, ...loadedSettings };
          setSettings(mergedSettings);
          applyAppTheme(mergedSettings.theme);
          applyAppDensity(mergedSettings.uiDensity);
          applyAppAccentColor(mergedSettings.accentColor);
          setMessage("已读取本机设置。");
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeSectionMeta = useMemo(
    () => settingsSections.find((section) => section.id === activeSection) ?? settingsSections[0],
    [activeSection],
  );

  async function handleSave() {
    setIsSaving(true);
    setError("");

    try {
      const savedSettings = await saveAppSettings(settings);
      setSettings({ ...defaultSettings, ...savedSettings });
      // Apply theme and density immediately so the user sees the effect
      applyAppTheme(savedSettings.theme);
      applyAppDensity(savedSettings.uiDensity);
      applyAppAccentColor(savedSettings.accentColor);
      setMessage("设置已保存。");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  function updateSettings(nextSettings: Partial<AppSettings>) {
    setSettings((currentSettings) => {
      const updated = { ...currentSettings, ...nextSettings };

      // Apply theme and density in real time for live preview
      if (nextSettings.theme !== undefined) {
        applyAppTheme(nextSettings.theme);
      }
      if (nextSettings.uiDensity !== undefined) {
        applyAppDensity(nextSettings.uiDensity);
      }
      if (nextSettings.accentColor !== undefined) {
        applyAppAccentColor(nextSettings.accentColor);
      }

      return updated;
    });
  }

  function handleReset() {
    setSettings(defaultSettings);
    applyAppTheme(defaultSettings.theme);
    applyAppDensity(defaultSettings.uiDensity);
    applyAppAccentColor(defaultSettings.accentColor);
  }

  function renderPanel() {
    if (activeSection === "ai") {
      return <AiSettingsPanel settings={settings} updateSettings={updateSettings} />;
    }

    if (activeSection === "display") {
      return <DisplaySettingsPanel settings={settings} updateSettings={updateSettings} />;
    }

    if (activeSection === "local-models") {
      return <LocalModelsSettingsPanel settings={settings} updateSettings={updateSettings} />;
    }

    if (activeSection === "presets") {
      return <PresetDictionarySettingsPanel settings={settings} updateSettings={updateSettings} />;
    }

    if (activeSection === "resources") {
      return <ProjectResourcesSettingsPanel settings={settings} updateSettings={updateSettings} />;
    }

    if (activeSection === "export") {
      return <ExportSettingsPanel settings={settings} updateSettings={updateSettings} />;
    }

    if (activeSection === "about") {
      return <AboutSettingsPanel />;
    }

    if (activeSection === "diagnostics") {
      return <DiagnosticsSettingsPanel />;
    }

    return <GeneralSettingsPanel settings={settings} updateSettings={updateSettings} />;
  }

  return (
    <AppPageShell
      className="settings-workspace"
      description="管理 JMTools 的启动行为、AI 服务、预设字典、显示体验、项目资源和导出默认值。"
      kicker="应用设置"
      size="settings"
      title="本机设置中心"
      actions={
        <div className="settings-status" data-error={error ? "true" : "false"}>
          {error ? error : message}
        </div>
      }
    >
      <SettingsLayout
        sidebar={<SettingsSidebar activeSection={activeSection} onSectionChange={setActiveSection} />}
        editor={
          <section className="settings-editor-panel">
          <header className="settings-panel-header">
            <div>
              <span>{activeSectionMeta.label}</span>
              <h2>设置项</h2>
            </div>
            {activeSection !== "diagnostics" && activeSection !== "about" ? (
              <Button onClick={handleReset} size="sm" type="button" variant="outline">
                <RotateCcw />
                恢复默认
              </Button>
            ) : null}
          </header>

          <div className="settings-panel-body">
            {isLoading ? <div className="settings-empty-state">正在读取本机设置...</div> : renderPanel()}
          </div>

          <footer className="settings-actions">
            {activeSection === "diagnostics" ? (
              <div>
                <CheckCircle2 />
                <span>诊断与日志设置独立保存，不写入应用设置 SQLite。</span>
              </div>
            ) : (
              <>
                <div>
                  <CheckCircle2 />
                  <span>这些是应用级设置，不会修改当前项目清单。</span>
                </div>
                <Button disabled={isSaving || isLoading} onClick={handleSave} type="button">
                  <Save />
                  {isSaving ? "保存中..." : "保存设置"}
                </Button>
              </>
            )}
          </footer>
          </section>
        }
      />
    </AppPageShell>
  );
}
