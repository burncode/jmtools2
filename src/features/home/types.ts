import type { LucideIcon } from "lucide-react";

import type { ProjectTemplate } from "../projects/types";
import type { RecentProject } from "../projects/types";

export type NavigationTarget = "home" | "open" | "templates" | "learn" | "tools" | "settings";

export interface NavigationItem {
  icon: LucideIcon;
  label: string;
  target: NavigationTarget;
}

export interface StarterRecentProject {
  assets: string[];
  name: string;
  path: string;
  status: string;
  updatedAt: string;
}

export type HomeRecentProject = RecentProject | StarterRecentProject;

export interface HomeActivity {
  kind: string;
  name: string;
  status: string;
  time: string;
}

export interface HomeTemplateOption {
  description: string;
  icon: LucideIcon;
  label: string;
  value: ProjectTemplate;
}
