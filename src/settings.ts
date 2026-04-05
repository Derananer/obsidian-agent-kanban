import { App, PluginSettingTab, Setting } from "obsidian";
import AgentKanbanPlugin from "./main";

export class KanbanSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: AgentKanbanPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Agent Kanban Settings" });

    new Setting(containerEl)
      .setName("Board folder")
      .setDesc("Path to the kanban board folder inside your vault (e.g. board)")
      .addText((text) =>
        text
          .setPlaceholder("board")
          .setValue(this.plugin.settings.boardFolder)
          .onChange(async (value) => {
            this.plugin.settings.boardFolder = value.trim() || "board";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Column order")
      .setDesc(
        "Comma-separated folder names to override sort order (e.g. 1-backlog, 2-in-progress, 3-done)"
      )
      .addText((text) =>
        text
          .setPlaceholder("1-backlog, 2-in-progress, 3-done")
          .setValue(this.plugin.settings.columnOrder.join(", "))
          .onChange(async (value) => {
            this.plugin.settings.columnOrder = value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Done columns")
      .setDesc(
        "Comma-separated folder names that count as 'done' for dependency resolution (e.g. 3-done)"
      )
      .addText((text) =>
        text
          .setPlaceholder("3-done")
          .setValue(this.plugin.settings.doneColumns.join(", "))
          .onChange(async (value) => {
            this.plugin.settings.doneColumns = value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            await this.plugin.saveSettings();
          })
      );
  }
}
