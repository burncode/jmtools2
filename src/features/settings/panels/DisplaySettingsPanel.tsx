import {
  Check,
  Eye,
  Gauge,
  LayoutPanelLeft,
  MonitorCog,
  PanelTop,
  Type,
  Zap,
} from "lucide-react";

import { SettingsCheckboxRow, SettingsSelect } from "../components/SettingsControls";
import { SettingsSection } from "../components/SettingsPanelPrimitives";
import {
  densityOptions,
  fontSizeOptions,
  panelBorderOptions,
  pixelScaleOptions,
  previewBackgroundOptions,
  previewFpsOptions,
  previewQualityOptions,
  sidebarStateOptions,
} from "../settingsOptions";
import type { SettingsPanelProps } from "./types";

const themeCards = [
  {
    description: "当前主视觉，适合长时间编辑素材。",
    label: "深色",
    previewClass: "dark",
    value: "dark",
  },
  {
    description: "适合白天环境，后续接入浅色变量。",
    label: "浅色",
    previewClass: "light",
    value: "light",
  },
  {
    description: "跟随操作系统外观。",
    label: "跟随系统",
    previewClass: "system",
    value: "system",
  },
] as const;

const accentColors = [
  { className: "blue", label: "蓝色", value: "blue" },
  { className: "cyan", label: "青色", value: "cyan" },
  { className: "violet", label: "紫色", value: "violet" },
  { className: "amber", label: "琥珀", value: "amber" },
  { className: "rose", label: "玫红", value: "rose" },
] as const;

export function DisplaySettingsPanel({ settings, updateSettings }: SettingsPanelProps) {
  return (
    <div className="display-settings-shell">
      <SettingsSection
        className="display-settings-section"
        contentClassName="display-settings-section-body"
        description="控制 JMTools 的视觉风格、主题和文字呈现。"
        icon={MonitorCog}
        title="界面外观"
      >
        <div className="display-theme-grid" aria-label="主题模式">
          {themeCards.map((theme) => {
            const isActive = settings.theme === theme.value;

            return (
              <button
                className="display-theme-card"
                data-active={isActive ? "true" : "false"}
                data-theme-preview={theme.previewClass}
                key={theme.value}
                onClick={() => updateSettings({ theme: theme.value })}
                type="button"
              >
                <span className="display-theme-preview" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  <strong>{theme.label}</strong>
                  <small>{theme.description}</small>
                </span>
                {isActive ? <Check aria-label="当前主题" /> : null}
              </button>
            );
          })}
        </div>

        <div className="display-control-grid">
          <label className="display-swatch-field">
            <span>
              <strong>强调色</strong>
              <small>用于主按钮、选中态和关键状态提示。</small>
            </span>
            <div className="display-swatch-row">
              {accentColors.map((color) => (
                <button
                  aria-label={color.label}
                  className="display-swatch"
                  data-active={settings.accentColor === color.value ? "true" : "false"}
                  data-color={color.className}
                  key={color.value}
                  onClick={() => updateSettings({ accentColor: color.value })}
                  type="button"
                />
              ))}
            </div>
          </label>
          <SettingsSelect
            label="界面密度"
            onChange={(uiDensity) => updateSettings({ uiDensity })}
            options={densityOptions}
            value={settings.uiDensity}
          />
          <SettingsSelect
            label="字体大小"
            onChange={(fontSize) => updateSettings({ fontSize })}
            options={fontSizeOptions}
            value={settings.fontSize}
          />
          <SettingsSelect
            label="面板边框"
            onChange={(panelBorderStrength) => updateSettings({ panelBorderStrength })}
            options={panelBorderOptions}
            value={settings.panelBorderStrength}
          />
        </div>

        <div className="display-preview-strip">
          <div className="display-preview-copy">
            <Type aria-hidden="true" />
            <span>
              <strong>JMTools 界面预览</strong>
              <small>当前偏好会影响后续工作台、预览器和设置面板的视觉密度。</small>
            </span>
          </div>
          <div className="display-preview-window" data-density={settings.uiDensity}>
            <span />
            <span />
            <span />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        className="display-settings-section"
        contentClassName="display-settings-section-body"
        description="控制桌面窗口中的常驻区域与工作台初始布局。"
        icon={LayoutPanelLeft}
        title="布局行为"
      >
        <div className="display-control-grid display-control-grid-two">
          <SettingsSelect
            label="侧边栏状态"
            onChange={(sidebarDefaultState) => updateSettings({ sidebarDefaultState })}
            options={sidebarStateOptions}
            value={settings.sidebarDefaultState}
          />
          <SettingsCheckboxRow
            checked={settings.fixedTopbar}
            description="滚动内容时保持顶部工具栏可见。"
            label="固定顶部工具栏"
            onChange={(fixedTopbar) => updateSettings({ fixedTopbar })}
          />
        </div>
        <div className="display-layout-demo">
          <PanelTop aria-hidden="true" />
          <span>固定工具栏 + 左侧生产模块导航 + 中央工作区，是后续角色工坊、地图工坊和动画编辑器的默认桌面布局。</span>
        </div>
      </SettingsSection>

      <SettingsSection
        className="display-settings-section"
        contentClassName="display-settings-section-body"
        description="配置 PixiJS 预览器、像素缩放和编辑辅助效果。"
        icon={Eye}
        title="预览与编辑器"
      >
        <div className="display-control-grid display-control-grid-two">
          <SettingsSelect
            label="PixiJS 预览质量"
            onChange={(previewQuality) => updateSettings({ previewQuality })}
            options={previewQualityOptions}
            value={settings.previewQuality}
          />
          <SettingsSelect
            label="预览帧率上限"
            onChange={(previewFpsLimit) => updateSettings({ previewFpsLimit })}
            options={previewFpsOptions}
            value={settings.previewFpsLimit}
          />
          <SettingsSelect
            label="像素资源缩放"
            onChange={(pixelScaleMode) => updateSettings({ pixelScaleMode })}
            options={pixelScaleOptions}
            value={settings.pixelScaleMode}
          />
          <SettingsSelect
            label="预览背景"
            onChange={(previewBackground) => updateSettings({ previewBackground })}
            options={previewBackgroundOptions}
            value={settings.previewBackground}
          />
          <SettingsCheckboxRow
            checked={settings.showPreviewGrid}
            description="在预览器中显示辅助网格。"
            label="显示调试网格"
            onChange={(showPreviewGrid) => updateSettings({ showPreviewGrid })}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        className="display-settings-section"
        contentClassName="display-settings-section-body"
        description="影响预览器性能与界面动效的偏好设置。"
        icon={Gauge}
        title="高级显示"
      >
        <div className="display-control-grid display-control-grid-two">
          <SettingsCheckboxRow
            checked={settings.previewHardwareAcceleration}
            description="优先让预览器使用 GPU 加速能力。"
            label="预览硬件加速"
            onChange={(previewHardwareAcceleration) => updateSettings({ previewHardwareAcceleration })}
          />
          <SettingsCheckboxRow
            checked={settings.reduceMotion}
            description="减少非必要过渡动画，适合长时间工作。"
            label="减少界面动效"
            onChange={(reduceMotion) => updateSettings({ reduceMotion })}
          />
        </div>
        <div className="display-advanced-note">
          <Zap aria-hidden="true" />
          <span>部分显示设置会在重新进入工作台或重启应用后完整生效。</span>
        </div>
      </SettingsSection>
    </div>
  );
}
