import { ItemView, WorkspaceLeaf, TFolder, TFile } from "obsidian";
import AgentKanbanPlugin from "./main";
import { BoardService } from "./board-service";
import { CardModal } from "./card-modal";
import { TaskCard, EpicCard } from "./types";

export const KANBAN_VIEW_TYPE = "agent-kanban";

function epicMatch(taskEpic: string | undefined, epicName: string | null): boolean {
  if (epicName === null) return !taskEpic || taskEpic.trim() === "";
  return (taskEpic ?? "").trim().toLowerCase() === epicName.trim().toLowerCase();
}

export class KanbanView extends ItemView {
  private plugin: AgentKanbanPlugin;
  private service: BoardService;
  /** Persists across refreshes; key = epic name or "" for no-epic row */
  private collapsedEpics = new Set<string>();

  constructor(leaf: WorkspaceLeaf, plugin: AgentKanbanPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.service = new BoardService(plugin.app, plugin.settings);
  }

  getViewType(): string { return KANBAN_VIEW_TYPE; }
  getDisplayText(): string { return "Kanban"; }
  getIcon(): string { return "layout-kanban"; }

  async onOpen(): Promise<void> {
    this.registerEvent(this.app.vault.on("rename", () => this.refresh()));
    this.registerEvent(this.app.vault.on("modify", () => this.refresh()));
    this.registerEvent(this.app.vault.on("create", () => this.refresh()));
    this.registerEvent(this.app.vault.on("delete", () => this.refresh()));
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.service = new BoardService(this.app, this.plugin.settings);
    const container = this.contentEl;
    container.empty();
    container.addClass("kanban-view-container");

    const board = container.createEl("div", { cls: "kanban-board" });
    const columns = this.service.getColumns();

    if (columns.length === 0) {
      board.createEl("p", {
        text: `No columns found in "${this.plugin.settings.boardFolder}". Create subfolders to define columns.`,
        cls: "kanban-empty-state",
      });
      return;
    }

    const [epics, allTasks] = await Promise.all([
      this.service.getEpics(),
      this.service.getAllTasks(),
    ]);

    this.renderHeaderRow(board, columns);

    // Swimlane row per epic (sorted alphabetically by getEpics)
    for (const epic of epics) {
      this.renderEpicRow(board, epic, columns, allTasks);
    }

    // Always show "no epic" row
    this.renderEpicRow(board, null, columns, allTasks);
  }

  private renderHeaderRow(board: HTMLElement, columns: TFolder[]): void {
    const row = board.createEl("div", { cls: "kanban-header-row" });

    const labelCell = row.createEl("div", { cls: "kanban-col-header-label" });
    const refreshBtn = labelCell.createEl("button", { cls: "kanban-refresh-btn", title: "Refresh board" });
    refreshBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`;
    refreshBtn.addEventListener("click", () => this.refresh());

    for (const col of columns) {
      const header = row.createEl("div", { cls: "kanban-col-header" });
      const displayName = col.name.replace(/^\d+-/, "");
      header.createEl("span", { text: displayName, cls: "kanban-col-header-title" });

      const addBtn = header.createEl("button", { text: "+", cls: "kanban-add-btn" });
      addBtn.setAttribute("aria-label", `Add task to ${displayName}`);
      addBtn.addEventListener("click", () => {
        new CardModal(this.app, this.service, { mode: "create", column: col }, () => this.refresh()).open();
      });
    }
  }

  private renderEpicRow(
    board: HTMLElement,
    epic: EpicCard | null,
    columns: TFolder[],
    allTasks: TaskCard[]
  ): void {
    const row = board.createEl("div", { cls: "kanban-epic-row" });

    if (epic) row.style.setProperty("--epic-color", epic.color);

    const collapseKey = epic?.name ?? "";
    const isCollapsed = this.collapsedEpics.has(collapseKey);
    if (isCollapsed) row.addClass("is-collapsed");

    // Epic label
    const label = row.createEl("div", { cls: "kanban-epic-label" });

    // Toggle button
    const toggle = label.createEl("button", {
      cls: "epic-collapse-toggle",
      title: isCollapsed ? "Expand" : "Collapse",
    });
    toggle.setAttribute("aria-expanded", String(!isCollapsed));
    toggle.createEl("span", { cls: "epic-collapse-chevron" });
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.collapsedEpics.has(collapseKey)) {
        this.collapsedEpics.delete(collapseKey);
        row.removeClass("is-collapsed");
        toggle.setAttribute("aria-expanded", "true");
      } else {
        this.collapsedEpics.add(collapseKey);
        row.addClass("is-collapsed");
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    if (epic) {
      // Name
      label.createEl("div", { text: epic.name, cls: "epic-label-name" });

      // Meta row: priority dot + progress
      const epicTasks = allTasks.filter((t) => epicMatch(t.frontmatter.epic, epic.name));
      const doneSet = new Set(this.plugin.settings.doneColumns);
      const doneTasks = epicTasks.filter((t) => doneSet.has(t.column)).length;
      const total = epicTasks.length;

      const meta = label.createEl("div", { cls: "epic-label-meta" });
      if (epic.frontmatter.priority) {
        const dot = meta.createEl("span", { cls: `priority-dot priority-${epic.frontmatter.priority}` });
        dot.setAttribute("title", epic.frontmatter.priority);
      }
      if (total > 0) {
        meta.createEl("span", {
          text: `${doneTasks}/${total}`,
          cls: "epic-label-progress",
          title: `${doneTasks} done of ${total} tasks`,
        });
      }

      // Due date
      if (epic.frontmatter.due) {
        const isOverdue = new Date(epic.frontmatter.due) < new Date();
        label.createEl("div", {
          text: epic.frontmatter.due,
          cls: "epic-label-due" + (isOverdue ? " overdue" : ""),
          title: isOverdue ? "Overdue" : "Due date",
        });
      }

      // Tags
      if (epic.frontmatter.tags?.length) {
        const tagsEl = label.createEl("div", { cls: "epic-label-tags" });
        for (const tag of epic.frontmatter.tags) {
          tagsEl.createEl("span", { text: tag, cls: "tag-pill tag-pill-sm" });
        }
      }
    } else {
      label.createEl("span", { text: "—", cls: "kanban-epic-label-none" });
    }

    // Cells for each column
    for (const col of columns) {
      const cell = row.createEl("div", { cls: "kanban-epic-cell" });
      cell.setAttribute("data-folder", col.path);
      cell.setAttribute("data-epic", epic?.name ?? "");

      cell.addEventListener("dragover", (e) => {
        e.preventDefault();
        cell.addClass("drag-over");
      });
      cell.addEventListener("dragleave", () => cell.removeClass("drag-over"));
      cell.addEventListener("drop", async (e) => {
        e.preventDefault();
        cell.removeClass("drag-over");

        const filePath = e.dataTransfer?.getData("text/plain");
        if (!filePath) return;
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof TFile)) return;

        const task = allTasks.find((t) => t.file.path === filePath);
        if (!task) return;

        const sameColumn = task.file.parent?.path === col.path;
        const sameEpic = epicMatch(task.frontmatter.epic, epic?.name ?? null);

        const ops: Promise<void>[] = [];
        if (!sameColumn) ops.push(this.service.moveTask(file, col));
        if (!sameEpic) ops.push(this.service.updateFrontmatter(file, { epic: epic?.name ?? undefined }));
        if (ops.length > 0) await Promise.all(ops);
      });

      // Cards: matching epic name AND column
      const cards = allTasks.filter(
        (t) => t.column === col.name && epicMatch(t.frontmatter.epic, epic?.name ?? null)
      );

      for (const task of cards) {
        this.renderCard(cell, task, allTasks);
      }
    }
  }

  private renderCard(container: HTMLElement, task: TaskCard, allTasks: TaskCard[]): void {
    const card = container.createEl("div", { cls: "kanban-card" });
    card.setAttribute("draggable", "true");

    card.addEventListener("dragstart", (e) => {
      card.addClass("is-dragging");
      e.dataTransfer?.setData("text/plain", task.file.path);
    });
    card.addEventListener("dragend", () => card.removeClass("is-dragging"));
    card.addEventListener("click", () => {
      new CardModal(this.app, this.service, { mode: "edit", card: task }, () => this.refresh()).open();
    });

    // Priority left-border accent
    if (task.frontmatter.priority) {
      card.addClass(`priority-${task.frontmatter.priority}`);
    }

    // Priority dot (top-right)
    if (task.frontmatter.priority) {
      const dot = card.createEl("span", { cls: `priority-dot priority-${task.frontmatter.priority}` });
      dot.setAttribute("title", task.frontmatter.priority);
    }

    // Title
    card.createEl("div", { text: task.frontmatter.title || task.file.basename, cls: "kanban-card-title" });

    // Tags
    if (task.frontmatter.tags?.length) {
      const tagsEl = card.createEl("div", { cls: "kanban-card-tags" });
      for (const tag of task.frontmatter.tags) {
        tagsEl.createEl("span", { text: tag, cls: "tag-pill" });
      }
    }

    // Due date
    if (task.frontmatter.due) {
      const isOverdue = new Date(task.frontmatter.due) < new Date();
      const dueEl = card.createEl("div", {
        text: task.frontmatter.due,
        cls: "due-date" + (isOverdue ? " overdue" : ""),
      });
      dueEl.setAttribute("title", isOverdue ? "Overdue" : "Due date");
    }

    // Agent badge
    if (task.frontmatter.agent) {
      const agentEl = card.createEl("div", { cls: "agent-badge" });
      agentEl.createEl("span", { text: this.agentStatusIcon(task.frontmatter.agent_status), cls: "agent-status-icon" });
      agentEl.createEl("span", { text: task.frontmatter.agent, cls: "agent-name" });
    }

    // Dependency status
    const { blockers, missing } = this.service.getDependencyStatus(task, allTasks);

    if (blockers.length > 0) {
      card.addClass("is-blocked");
      const names = blockers.map((b) => b.file.basename).join(", ");
      const row = card.createEl("div", { cls: "blocker-row", title: `Blocked by: ${names}` });
      row.createEl("span", { text: "🔒", cls: "blocker-icon" });
      row.createEl("span", { text: names, cls: "blocker-list" });
    }

    if (missing.length > 0) {
      card.addClass("has-missing-deps");
      const names = missing.join(", ");
      const row = card.createEl("div", { cls: "missing-dep-row", title: `Missing dependency: ${names}` });
      row.createEl("span", { text: "⚠️", cls: "blocker-icon" });
      row.createEl("span", { text: names, cls: "blocker-list" });
    }
  }

  private agentStatusIcon(status?: string): string {
    switch (status) {
      case "busy": return "🟢";
      case "idle": return "🟡";
      case "inactive": return "⚪";
      default: return "⚪";
    }
  }
}
