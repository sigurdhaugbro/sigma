import { isProject, type Project } from "./model";

const PREFIX = "sigma:";
const LEGACY_PREFIX = "setscreens:";
const INDEX_KEY = `${PREFIX}index`;
const PROJECT_KEY = (id: string) => `${PREFIX}project:${id}`;
const CURRENT_KEY = `${PREFIX}current`;

let migrated = false;

/** Moves data saved before the app was renamed to Sigma ("setscreens:*" keys) to the new keys. */
export function migrateLegacyStorage() {
  if (migrated || typeof localStorage === "undefined") return;
  migrated = true;
  try {
    const legacy: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(LEGACY_PREFIX)) legacy.push(k);
    }
    for (const k of legacy) {
      const next = PREFIX + k.slice(LEGACY_PREFIX.length);
      if (localStorage.getItem(next) === null) localStorage.setItem(next, localStorage.getItem(k)!);
      localStorage.removeItem(k);
    }
  } catch {
    // Storage full or unavailable: leave legacy keys in place and keep going.
  }
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
}

export function listProjects(): ProjectSummary[] {
  migrateLegacyStorage();
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function loadProject(id: string): Project | null {
  migrateLegacyStorage();
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
  migrateLegacyStorage();
  return localStorage.getItem(CURRENT_KEY);
}

export function downloadProject(project: Project) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.name.replace(/[^\w\- ]+/g, "").trim() || "project"}.sigma.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function readProjectFile(file: File): Promise<Project> {
  const parsed = JSON.parse(await file.text());
  if (!isProject(parsed)) throw new Error("Not a valid project file");
  return parsed;
}
