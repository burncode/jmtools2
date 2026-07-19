import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

import { Button } from "@/components/ui/button";

import { HomeView } from "./features/home/HomeView";
import { navigationItems } from "./features/home/homeFixtures";
import { NewProjectView } from "./features/projects/NewProjectView";
import type { PipelineProject, ProjectTemplate, RecentProject } from "./features/projects/types";
import { SettingsView } from "./features/settings/SettingsView";
import { defaultSettings } from "./features/settings/settingsDefaults";
import { ProjectWorkspaceView } from "./features/workspace/ProjectWorkspaceView";
import {
  getAppSettings,
  listRecentProjects,
  openProject as openProjectCommand,
  saveAppSettings,
  type AppSettings,
} from "./lib/tauri/commands";
import { appLogger } from "./lib/logger";
import { useWorkspaceStore } from "./stores/workspaceStore";
import { applyAppDensity, applyAppAccentColor, applyAppTheme, initAppTheme, type AppTheme } from "./lib/theme";

import "./styles/tokens.css";
import "./styles/accent-palettes.css";
import "./styles/typography.css";
import "./App.css";
import "./components/shared/shared.css";
import "./components/shared/layouts/layouts.css";

type AppView = "home" | "newProject" | "projectWorkspace" | "settings";

function App() {
  const currentProject = useWorkspaceStore((state) => state.currentProject);
  const setCurrentProject = useWorkspaceStore((state) => state.setCurrentProject);
  const [view, setView] = useState<AppView>("home");
  const [homeMessage, setHomeMessage] = useState("");
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    let isMounted = true;
    let cleanup: (() => void) | undefined;

    getAppSettings()
      .then((settings) => {
        if (isMounted) {
          const mergedSettings = { ...defaultSettings, ...settings };
          setAppSettings(mergedSettings);
          cleanup?.();
          cleanup = initAppTheme(mergedSettings.theme);
          applyAppDensity(mergedSettings.uiDensity);
          applyAppAccentColor(mergedSettings.accentColor);
        }
      })
      .catch(() => {
        if (isMounted) {
          cleanup?.();
          cleanup = initAppTheme("dark");
          applyAppAccentColor("blue");
        }
      });

    listRecentProjects()
      .then((projects) => {
        if (isMounted) {
          setRecentProjects(projects);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setHomeMessage(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, []);

  const handleCreateProject = () => {
    setView("newProject");
  };

  const handleCreateProjectFromTemplate = (_template: ProjectTemplate) => {
    setView("newProject");
  };

  const handleProjectCreated = (project: PipelineProject, projects: RecentProject[]) => {
    setCurrentProject(project);
    setRecentProjects(projects);
    setView("projectWorkspace");
  };

  const handleOpenProject = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: "选择 JMTools 项目目录",
      });

      if (typeof selectedPath !== "string") {
        return;
      }

      const project = await openProjectCommand({ projectPath: selectedPath });

      setCurrentProject(project);
      setHomeMessage(`已打开项目：${project.name}`);
      setRecentProjects(await listRecentProjects());
      setView("projectWorkspace");
    } catch (error) {
      const message = getErrorMessage(error);
      await appLogger.error(`打开项目失败：message=${message}`);
      setHomeMessage(message);
    }
  };

  const handleOpenRecentProject = async (projectPath: string) => {
    try {
      const project = await openProjectCommand({ projectPath });

      setCurrentProject(project);
      setHomeMessage(`已打开项目：${project.name}`);
      setRecentProjects(await listRecentProjects());
      setView("projectWorkspace");
    } catch (error) {
      const message = getErrorMessage(error);
      await appLogger.error(`打开最近项目失败：path=${projectPath} message=${message}`);
      setHomeMessage(`无法打开最近项目：${message}`);
    }
  };

  const handleToggleTheme = async () => {
    const nextTheme: AppTheme = appSettings.theme === "dark" ? "light" : "dark";
    const optimisticSettings = { ...appSettings, theme: nextTheme };

    setAppSettings(optimisticSettings);
    applyAppTheme(nextTheme);

    try {
      const savedSettings = await saveAppSettings(optimisticSettings);
      setAppSettings({ ...defaultSettings, ...savedSettings });
    } catch (error) {
      const message = getErrorMessage(error);
      await appLogger.error(`切换主题失败：theme=${nextTheme} message=${message}`);
      setHomeMessage(`主题切换失败：${message}`);
    }
  };

  if (view === "projectWorkspace" && currentProject) {
    return <ProjectWorkspaceView onBackHome={() => setView("home")} onOpenProject={handleOpenProject} project={currentProject} />;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="工作台导航">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            JM
          </div>
          <div>
            <p className="eyebrow">游戏素材生产平台</p>
            <h1>JMTools</h1>
          </div>
        </div>

        <nav className="nav-stack" aria-label="功能模块">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.target === view;

            return (
              <Button
                className={`nav-item ${isActive ? "active" : ""}`}
                key={item.label}
                onClick={() => {
                  if (item.target === "home") {
                    setView("home");
                  }

                  if (item.target === "open") {
                    void handleOpenProject();
                  }

                  if (item.target === "settings") {
                    setView("settings");
                  }
                }}
                type="button"
                variant="ghost"
              >
                <Icon aria-hidden="true" size={18} />
                <span>{item.label}</span>
              </Button>
            );
          })}
        </nav>

        <section className="sidebar-tip" aria-label="当前项目">
          <p className="panel-label">当前项目</p>
          <strong>{currentProject?.name ?? "未打开项目"}</strong>
          <span>{currentProject?.rootPath ?? "首页只负责新建、打开和恢复项目；真正的素材制作会放到进入项目后的工作台。"}</span>
        </section>
      </aside>

      {view === "newProject" ? (
        <NewProjectView onBack={() => setView("home")} onProjectCreated={handleProjectCreated} />
      ) : view === "settings" ? (
        <section className="workspace settings-home-workspace">
          <SettingsView />
        </section>
      ) : (
        <HomeView
          homeMessage={homeMessage}
          onCreateProject={handleCreateProject}
          onCreateProjectFromTemplate={handleCreateProjectFromTemplate}
          onOpenSettings={() => setView("settings")}
          onOpenProject={handleOpenProject}
          onOpenRecentProject={(projectPath) => void handleOpenRecentProject(projectPath)}
          onToggleTheme={() => void handleToggleTheme()}
          recentProjects={recentProjects}
          theme={appSettings.theme}
        />
      )}
    </main>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default App;
