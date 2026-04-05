import { App, TFile, TFolder, normalizePath } from "obsidian";
import { KanbanSettings, TaskCard, TaskFrontmatter, EpicCard, DepStatus } from "./types";

const EPIC_PALETTE = [
  "#4e79a7", "#f28e2b", "#e15759", "#76b7b2",
  "#59a14f", "#edc948", "#b07aa1", "#ff9da7",
  "#9c755f", "#bab0ac", "#d37295", "#a0cbe8",
];

export function epicColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return EPIC_PALETTE[Math.abs(hash) % EPIC_PALETTE.length];
}

const EPICS_FOLDER = "epics";

export class BoardService {
  constructor(private app: App, private settings: KanbanSettings) {}

  getColumns(): TFolder[] {
    const root = this.app.vault.getAbstractFileByPath(
      normalizePath(this.settings.boardFolder)
    );
    if (!(root instanceof TFolder)) return [];

    const folders = root.children.filter(
      (f): f is TFolder => f instanceof TFolder && f.name !== EPICS_FOLDER
    );

    if (this.settings.columnOrder.length > 0) {
      const order = this.settings.columnOrder;
      folders.sort((a, b) => {
        const ai = order.indexOf(a.name);
        const bi = order.indexOf(b.name);
        if (ai === -1 && bi === -1) return this.numericPrefix(a.name) - this.numericPrefix(b.name);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    } else {
      folders.sort((a, b) => this.numericPrefix(a.name) - this.numericPrefix(b.name));
    }

    return folders;
  }

  async getEpics(): Promise<EpicCard[]> {
    const epicsPath = normalizePath(`${this.settings.boardFolder}/${EPICS_FOLDER}`);
    const folder = this.app.vault.getAbstractFileByPath(epicsPath);
    if (!(folder instanceof TFolder)) return [];

    const cards: EpicCard[] = [];
    for (const child of folder.children) {
      if (!(child instanceof TFile) || child.extension !== "md") continue;
      const cache = this.app.metadataCache.getFileCache(child);
      const frontmatter: TaskFrontmatter = cache?.frontmatter ?? {};
      const raw = await this.app.vault.read(child);
      const content = this.stripFrontmatter(raw);
      const name = frontmatter.title ?? child.basename;
      cards.push({ file: child, frontmatter, content, name, color: epicColor(name) });
    }

    // Sort alphabetically by name
    cards.sort((a, b) => a.name.localeCompare(b.name));
    return cards;
  }

  private numericPrefix(name: string): number {
    const match = name.match(/^(\d+)/);
    return match ? parseInt(match[1]) : 9999;
  }

  async getTasksInFolder(folder: TFolder): Promise<TaskCard[]> {
    const cards: TaskCard[] = [];
    for (const child of folder.children) {
      if (!(child instanceof TFile) || child.extension !== "md") continue;
      const cache = this.app.metadataCache.getFileCache(child);
      const frontmatter: TaskFrontmatter = cache?.frontmatter ?? {};
      const raw = await this.app.vault.read(child);
      const content = this.stripFrontmatter(raw);
      cards.push({ file: child, frontmatter, content, column: folder.name });
    }
    return cards;
  }

  async getAllTasks(): Promise<TaskCard[]> {
    const columns = this.getColumns();
    const results = await Promise.all(columns.map((col) => this.getTasksInFolder(col)));
    return results.flat();
  }

  getDependencyStatus(task: TaskCard, allTasks: TaskCard[]): DepStatus {
    const deps = task.frontmatter.depends_on;
    if (!deps || deps.length === 0) return { blockers: [], missing: [] };

    const doneSet = new Set(this.settings.doneColumns);
    const blockers: TaskCard[] = [];
    const missing: string[] = [];

    for (const dep of deps) {
      const found = allTasks.find((t) => t.file.basename === dep);
      if (!found) {
        missing.push(dep);
      } else if (!doneSet.has(found.column)) {
        blockers.push(found);
      }
    }

    return { blockers, missing };
  }

  private stripFrontmatter(raw: string): string {
    if (!raw.startsWith("---")) return raw;
    const end = raw.indexOf("\n---", 3);
    if (end === -1) return raw;
    return raw.slice(end + 4).trimStart();
  }

  async moveTask(file: TFile, targetFolder: TFolder): Promise<void> {
    const newPath = normalizePath(`${targetFolder.path}/${file.name}`);
    await this.app.vault.rename(file, newPath);
  }

  async createTask(
    column: TFolder,
    frontmatter: TaskFrontmatter,
    content: string
  ): Promise<TFile> {
    const title = frontmatter.title || "Untitled";
    const filename = `${title.replace(/[\\/:*?"<>|]/g, "-")}.md`;
    const path = normalizePath(`${column.path}/${filename}`);
    const body = this.buildFileContent(frontmatter, content);
    return await this.app.vault.create(path, body);
  }

  async updateTask(
    file: TFile,
    frontmatter: TaskFrontmatter,
    content: string
  ): Promise<void> {
    const body = this.buildFileContent(frontmatter, content);
    await this.app.vault.modify(file, body);
  }

  async updateFrontmatter(
    file: TFile,
    patch: Partial<TaskFrontmatter>
  ): Promise<void> {
    const raw = await this.app.vault.read(file);
    const updated = this.patchFrontmatter(raw, patch);
    await this.app.vault.modify(file, updated);
  }

  private buildFileContent(frontmatter: TaskFrontmatter, content: string): string {
    const lines: string[] = ["---"];
    if (frontmatter.title) lines.push(`title: ${frontmatter.title}`);
    if (frontmatter.priority) lines.push(`priority: ${frontmatter.priority}`);
    if (frontmatter.tags && frontmatter.tags.length > 0) {
      lines.push(`tags: [${frontmatter.tags.join(", ")}]`);
    }
    if (frontmatter.created) lines.push(`created: ${frontmatter.created}`);
    if (frontmatter.due) lines.push(`due: ${frontmatter.due}`);
    if (frontmatter.agent) lines.push(`agent: ${frontmatter.agent}`);
    if (frontmatter.agent_status) lines.push(`agent_status: ${frontmatter.agent_status}`);
    if (frontmatter.epic) lines.push(`epic: "${frontmatter.epic}"`);
    if (frontmatter.depends_on && frontmatter.depends_on.length > 0) {
      lines.push(`depends_on: [${frontmatter.depends_on.join(", ")}]`);
    }
    lines.push("---");
    if (content) lines.push("", content);
    return lines.join("\n");
  }

  private patchFrontmatter(raw: string, patch: Partial<TaskFrontmatter>): string {
    if (!raw.startsWith("---")) {
      const fm = this.buildFileContent(patch as TaskFrontmatter, "").split("\n").slice(0, -1).join("\n");
      return fm + "\n" + raw;
    }
    const endIdx = raw.indexOf("\n---", 3);
    if (endIdx === -1) return raw;

    const fmBlock = raw.slice(4, endIdx);
    const afterFm = raw.slice(endIdx + 4);
    const fmLines = fmBlock.split("\n");

    const keys = Object.keys(patch) as (keyof TaskFrontmatter)[];
    for (const key of keys) {
      const val = patch[key];
      const lineIdx = fmLines.findIndex((l) => l.startsWith(`${key}:`));

      // undefined = remove the field entirely
      if (val === undefined || val === null) {
        if (lineIdx >= 0) fmLines.splice(lineIdx, 1);
        continue;
      }

      let serialized: string;
      if (Array.isArray(val)) {
        serialized = `${key}: [${(val as string[]).join(", ")}]`;
      } else if (key === "epic") {
        serialized = `${key}: "${val}"`;
      } else {
        serialized = `${key}: ${val}`;
      }
      if (lineIdx >= 0) {
        fmLines[lineIdx] = serialized;
      } else {
        fmLines.push(serialized);
      }
    }

    return `---\n${fmLines.join("\n")}\n---${afterFm}`;
  }
}
