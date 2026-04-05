import { TFile } from "obsidian";

export interface TaskFrontmatter {
  title?: string;
  priority?: "low" | "medium" | "high" | "critical";
  tags?: string[];
  created?: string;
  due?: string;
  agent?: string;
  agent_status?: "busy" | "idle" | "inactive";
  epic?: string;
  depends_on?: string[];
}

export interface TaskCard {
  file: TFile;
  frontmatter: TaskFrontmatter;
  content: string;
  column: string;
}

/** Epic file from board/epics/ folder */
export interface EpicCard {
  file: TFile;
  frontmatter: TaskFrontmatter;
  content: string;
  /** Resolved display name: frontmatter.title ?? file.basename */
  name: string;
  /** Deterministic color from name hash */
  color: string;
}

export interface DepStatus {
  blockers: TaskCard[];
  missing: string[];
}

export interface KanbanSettings {
  boardFolder: string;
  columnOrder: string[];
  doneColumns: string[];
}

export const DEFAULT_SETTINGS: KanbanSettings = {
  boardFolder: "board",
  columnOrder: [],
  doneColumns: ["3-done"],
};
