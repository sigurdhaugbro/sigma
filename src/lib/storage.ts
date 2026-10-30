import { isProject, type Project } from "./model";

const INDEX_KEY = "setscreens:index";
const PROJECT_KEY = (id: string) => `setscreens:project:${id}`;
const CURRENT_KEY = "setscreens:current";

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
}

export function listProjects(): ProjectSummary[] {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function loadProject(id: string): Project | null {
  try {
    const raw = localStorage.getItem(PROJECT_KEY(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isProject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Returns false when the browser storage quota is exceeded (usually large images). */
export function saveProject(project: Project): boolean {
  try {
    localStorage.setItem(PROJECT_KEY(project.id), JSON.stringify(project));
    const index = listProjects().filter((p) => p.id !== project.id);
    index.unshift({ id: project.id, name: project.name, updatedAt: project.updatedAt });
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    localStorage.setItem(CURRENT_KEY, project.id);
    return true;
  } catch {
    return false;
  }
}

export function deleteProject(id: string) {
  localStorage.removeItem(PROJECT_KEY(id));
  localStorage.setItem(INDEX_KEY, JSON.stringify(listProjects().filter((p) => p.id !== id)));
}

export function currentProjectId(): string | null {
  return localStorage.getItem(CURRENT_KEY);
}

export function downloadProject(project: Project) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.name.replace(/[^\w\- ]+/g, "").trim() || "project"}.setscreens.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function readProjectFile(file: File): Promise<Project> {
  const parsed = JSON.parse(await file.text());
  if (!isProject(parsed)) throw new Error("Not a valid project file");
  return parsed;
}
