import {
  Activity,
  Bell,
  BookOpenText,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  FileClock,
  FolderOpen,
  Info,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { SettingsInfoPanel } from "../components/SettingsPanelPrimitives";

const currentVersion = "v0.1.0";

const releaseNotes = [
  {
    description: "新增服务商、模型列表、用途绑定和模型参数配置。",
    title: "AI 模型设置重构",
  },
  {
    description: "加入主题预览、强调色、预览器和布局行为设置。",
    title: "显示设置升级",
  },
  {
    description: "设置数据开始接入本机 SQLite，便于后续扩展。",
    title: "本地设置存储",
  },
];

const capabilityItems = [
  { icon: Sparkles, label: "AI 资产生成", value: "规划中" },
  { icon: Wrench, label: "角色工坊", value: "原型中" },
  { icon: FolderOpen, label: "项目工作台", value: "已接入" },
  { icon: Database, label: "本地数据库", value: "已接入" },
];

export function AboutSettingsPanel() {
  return (
    <div className="about-settings-shell">
      <section className="about-hero-panel">
        <div className="about-hero-content">
          <div className="about-logo-lockup">
            <div className="about-logo-cube" aria-hidden="true">
              <span />
            </div>
            <div>
              <h3>JMTools</h3>
              <p>本地优先的一站式游戏资产生产工具集。</p>
            </div>
          </div>

          <div className="about-version-grid">
            <div>
              <span>当前版本</span>
              <strong>{currentVersion}</strong>
              <small>
                <CheckCircle2 aria-hidden="true" />
                当前为开发预览版
              </small>
            </div>
            <div>
              <span>发布阶段</span>
              <strong>Early Alpha</strong>
              <small>功能架构和工作台能力持续完善中</small>
            </div>
          </div>
        </div>

        <div className="about-hero-visual" aria-hidden="true">
          <div className="about-orbit">
            <i />
            <i />
            <i />
          </div>
          <div className="about-floating-cube">
            <span />
          </div>
        </div>
      </section>

      <section className="about-update-panel">
        <div className="about-panel-copy">
          <span className="settings-kicker">自动更新</span>
          <h3>保持工具链稳定更新</h3>
          <p>后续会接入版本检查、更新提示和安装包下载。当前阶段先保留检查入口与版本状态展示。</p>
        </div>
        <div className="about-update-status">
          <div>
            <Bell aria-hidden="true" />
            <span>更新通道</span>
            <strong>开发预览</strong>
          </div>
          <div>
            <FileClock aria-hidden="true" />
            <span>上次检查</span>
            <strong>尚未检查</strong>
          </div>
          <Button type="button">
            <RotateCw aria-hidden="true" />
            检查更新
          </Button>
        </div>
      </section>

      <div className="about-info-grid">
        <SettingsInfoPanel description="最近开发重点" icon={ClipboardList} title="更新日志">
          <div className="about-release-list">
            {releaseNotes.map((item) => (
              <article key={item.title}>
                <span />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </SettingsInfoPanel>

        <SettingsInfoPanel description="当前产品模块状态" icon={Activity} title="能力概览">
          <div className="about-capability-grid">
            {capabilityItems.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.label}>
                  <Icon aria-hidden="true" />
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              );
            })}
          </div>
        </SettingsInfoPanel>

        <SettingsInfoPanel
          actions={
            <>
              <Button type="button" variant="outline">
                <FolderOpen aria-hidden="true" />
                应用数据目录
              </Button>
              <Button type="button" variant="outline">
                <Download aria-hidden="true" />
                导出诊断信息
              </Button>
            </>
          }
          description="本机优先的存储策略"
          icon={ShieldCheck}
          title="本地数据"
        >
          <div className="about-diagnostic-list">
            <div>
              <span>应用设置数据库</span>
              <strong>jmtools.db</strong>
            </div>
            <div>
              <span>项目清单格式</span>
              <strong>jmproject.json</strong>
            </div>
            <div>
              <span>默认语言</span>
              <strong>简体中文</strong>
            </div>
          </div>
        </SettingsInfoPanel>

        <SettingsInfoPanel
          actions={
            <Button type="button" variant="outline">
              <BookOpenText aria-hidden="true" />
              查看开发备忘录
            </Button>
          }
          description="当前阶段的关键约定"
          icon={Info}
          title="说明"
        >
          <div className="about-note-stack">
            <p>PixiJS 用于内部预览、动画检查和编辑器画布，不绑定最终导出格式。</p>
            <p>核心项目数据保存在项目目录中，应用级设置保存在本机 SQLite。</p>
            <p>真实素材生产工作会集中在进入项目后的工作台中完成。</p>
          </div>
        </SettingsInfoPanel>
      </div>
    </div>
  );
}
