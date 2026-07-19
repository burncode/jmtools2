import { AppPageShell } from "@/components/shared";

import type { AppTheme } from "@/lib/theme";
import type { ProjectTemplate, RecentProject } from "../projects/types";
import { HomeHero } from "./components/HomeHero";
import { HomeTopbar } from "./components/HomeTopbar";
import { RecentActivitiesSection } from "./components/RecentActivitiesSection";
import { RecentProjectsSection } from "./components/RecentProjectsSection";
import { TemplateStripSection } from "./components/TemplateStripSection";
import { starterRecentProjects } from "./homeFixtures";

interface HomeViewProps {
  homeMessage: string;
  onCreateProject: () => void;
  onCreateProjectFromTemplate: (template: ProjectTemplate) => void;
  onOpenSettings: () => void;
  onOpenProject: () => void;
  onOpenRecentProject: (projectPath: string) => void;
  onToggleTheme: () => void;
  recentProjects: RecentProject[];
  theme: AppTheme;
}

export function HomeView({
  homeMessage,
  onCreateProject,
  onCreateProjectFromTemplate,
  onOpenSettings,
  onOpenProject,
  onOpenRecentProject,
  onToggleTheme,
  recentProjects,
  theme,
}: HomeViewProps) {
  const visibleRecentProjects = recentProjects.length > 0 ? recentProjects : starterRecentProjects;

  return (
    <section className="workspace home-workspace" id="workspace">
      <AppPageShell className="home-page-shell" size="library">
        <HomeTopbar onOpenSettings={onOpenSettings} onToggleTheme={onToggleTheme} theme={theme} />

        <div className="home-content">
          <HomeHero onCreateProject={onCreateProject} onOpenProject={onOpenProject} />
          <RecentProjectsSection
            homeMessage={homeMessage}
            onOpenProject={onOpenProject}
            onOpenRecentProject={onOpenRecentProject}
            projects={visibleRecentProjects}
          />
          <RecentActivitiesSection />
          <TemplateStripSection onCreateProjectFromTemplate={onCreateProjectFromTemplate} />
        </div>
      </AppPageShell>
    </section>
  );
}
