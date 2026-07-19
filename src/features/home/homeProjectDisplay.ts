import type { HomeRecentProject } from "./types";

export function getRecentProjectCoverLabel(project: HomeRecentProject) {
  return "assets" in project ? project.assets[0] : project.template;
}

export function getRecentProjectStatus(project: HomeRecentProject) {
  return "status" in project ? project.status : "最近打开";
}

export function getRecentProjectTags(project: HomeRecentProject) {
  return "assets" in project ? project.assets : [project.slug, project.template];
}
