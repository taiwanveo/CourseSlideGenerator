import Database from "@tauri-apps/plugin-sql";
import { projectSchema } from "../model/schema";
import type { Project } from "../model/types";
import type { ProjectListItem, ProjectStore } from "../engine/storage/store";

/** Tauri SQLite 後端的專案儲存。 */
export class TauriSqlStore implements ProjectStore {
  private dbPromise: Promise<Database>;

  constructor() {
    this.dbPromise = Database.load("sqlite:courseslide.db");
  }

  private async db(): Promise<Database> {
    return this.dbPromise;
  }

  async list(): Promise<ProjectListItem[]> {
    const db = await this.db();
    const rows = await db.select<Array<{ id: string; title: string; updated_at: number }>>(
      "SELECT id, title, updated_at FROM projects ORDER BY updated_at DESC",
    );
    return rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updated_at }));
  }

  async load(id: string): Promise<Project | null> {
    const db = await this.db();
    const rows = await db.select<Array<{ data: string }>>(
      "SELECT data FROM projects WHERE id = $1",
      [id],
    );
    const first = rows[0];
    if (!first) return null;
    try {
      const parsed = projectSchema.safeParse(JSON.parse(first.data));
      return parsed.success ? (parsed.data as Project) : (JSON.parse(first.data) as Project);
    } catch {
      return null;
    }
  }

  async save(project: Project): Promise<void> {
    const db = await this.db();
    await db.execute(
      `INSERT INTO projects (id, title, updated_at, data) VALUES ($1, $2, $3, $4)
       ON CONFLICT(id) DO UPDATE SET title = $2, updated_at = $3, data = $4`,
      [project.id, project.meta.title, project.meta.updatedAt, JSON.stringify(project)],
    );
  }

  async remove(id: string): Promise<void> {
    const db = await this.db();
    await db.execute("DELETE FROM projects WHERE id = $1", [id]);
  }
}
