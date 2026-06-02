/**
 * 專案儲存抽象 — 介面可換接 Tauri SQLite / 檔案系統，瀏覽器開發用 localStorage。
 * 存檔前不強制 schema 校驗（編輯中允許暫態），載入後以 Zod 寬鬆解析。
 */
import { projectSchema } from "../../model/schema";
import type { Project } from "../../model/types";

export interface ProjectListItem {
  id: string;
  title: string;
  updatedAt: number;
}

export interface ProjectStore {
  list(): Promise<ProjectListItem[]>;
  load(id: string): Promise<Project | null>;
  save(project: Project): Promise<void>;
  remove(id: string): Promise<void>;
}

const KEY_PREFIX = "csg:project:";
const INDEX_KEY = "csg:index";
const LAST_KEY = "csg:last-project-id";

/** 記錄／讀取最近開啟的專案 id（用於重新整理後自動還原）。 */
export function setLastProjectId(id: string): void {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    /* ignore */
  }
}

export function getLastProjectId(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

class LocalStorageStore implements ProjectStore {
  async list(): Promise<ProjectListItem[]> {
    return this.readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async load(id: string): Promise<Project | null> {
    const raw = localStorage.getItem(KEY_PREFIX + id);
    if (!raw) return null;
    try {
      const parsed = projectSchema.safeParse(JSON.parse(raw));
      return parsed.success ? (parsed.data as Project) : (JSON.parse(raw) as Project);
    } catch {
      return null;
    }
  }

  async save(project: Project): Promise<void> {
    const updatedAt = Date.now();
    localStorage.setItem(KEY_PREFIX + project.id, JSON.stringify(project));
    const index = this.readIndex().filter((p) => p.id !== project.id);
    index.push({ id: project.id, title: project.meta.title, updatedAt });
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    setLastProjectId(project.id);
  }

  async remove(id: string): Promise<void> {
    localStorage.removeItem(KEY_PREFIX + id);
    localStorage.setItem(INDEX_KEY, JSON.stringify(this.readIndex().filter((p) => p.id !== id)));
    if (getLastProjectId() === id) localStorage.removeItem(LAST_KEY);
  }

  private readIndex(): ProjectListItem[] {
    try {
      const raw = localStorage.getItem(INDEX_KEY);
      return raw ? (JSON.parse(raw) as ProjectListItem[]) : [];
    } catch {
      return [];
    }
  }
}

let active: ProjectStore = new LocalStorageStore();

export function getStore(): ProjectStore {
  return active;
}

export function setStore(store: ProjectStore): void {
  active = store;
}
