import { Plugin, WorkspaceLeaf, TFolder, Notice } from "obsidian";
import { KanbanView, KANBAN_VIEW_TYPE } from "./kanban-view";
import { KanbanSettingTab } from "./settings";
import { BoardService } from "./board-service";
import { CardModal } from "./card-modal";
import { KanbanSettings, DEFAULT_SETTINGS } from "./types";

export default class AgentKanbanPlugin extends Plugin {
  settings: KanbanSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(KANBAN_VIEW_TYPE, (leaf) => new KanbanView(leaf, this));

    this.addRibbonIcon("layout-kanban", "Agent Kanban", () => this.activateView());

    this.addCommand({
      id: "open-kanban",
      name: "Open Kanban Board",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "create-task",
      name: "Create new task",
      callback: () => this.openCreateTaskModal(),
    });

    this.addSettingTab(new KanbanSettingTab(this.app, this));
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(KANBAN_VIEW_TYPE);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(KANBAN_VIEW_TYPE);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getLeaf(false);
      await leaf.setViewState({ type: KANBAN_VIEW_TYPE, active: true });
    }

    workspace.revealLeaf(leaf);
  }

  async openCreateTaskModal(): Promise<void> {
    const service = new BoardService(this.app, this.settings);
    const columns = service.getColumns();

    if (columns.length === 0) {
      new Notice(`No columns found in "${this.settings.boardFolder}"`);
      return;
    }

    // Default to first column
    const firstColumn = columns[0];
    new CardModal(
      this.app,
      service,
      { mode: "create", column: firstColumn },
      () => {
        const leaves = this.app.workspace.getLeavesOfType(KANBAN_VIEW_TYPE);
        if (leaves.length > 0) {
          (leaves[0].view as KanbanView).refresh();
        }
      }
    ).open();
  }
}
