import { App, Modal, TFolder, Notice } from "obsidian";
import { BoardService } from "./board-service";
import { TaskCard, TaskFrontmatter } from "./types";

type ModalMode = { mode: "create"; column: TFolder } | { mode: "edit"; card: TaskCard };

export class CardModal extends Modal {
  private service: BoardService;
  private config: ModalMode;
  private onSave: () => void;

  constructor(app: App, service: BoardService, config: ModalMode, onSave: () => void) {
    super(app);
    this.service = service;
    this.config = config;
    this.onSave = onSave;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    let existing: TaskFrontmatter = {};
    let existingContent = "";
    if (this.config.mode === "edit") {
      existing = this.config.card.frontmatter;
      existingContent = this.config.card.content;
    }
    const isEdit = this.config.mode === "edit";

    contentEl.createEl("h2", { text: isEdit ? "Edit task" : "New task" });

    const form = contentEl.createEl("div", { cls: "kanban-modal-form" });

    // Title
    const titleLabel = form.createEl("label", { text: "Title" });
    const titleInput = titleLabel.createEl("input", { type: "text" });
    titleInput.value = existing.title ?? "";
    titleInput.addClass("kanban-modal-input");

    // Priority
    const priorityLabel = form.createEl("label", { text: "Priority" });
    const prioritySelect = priorityLabel.createEl("select");
    prioritySelect.addClass("kanban-modal-input");
    for (const p of ["low", "medium", "high", "critical"]) {
      const opt = prioritySelect.createEl("option", { value: p, text: p });
      if (existing.priority === p) opt.selected = true;
    }

    // Agent
    const agentLabel = form.createEl("label", { text: "Agent" });
    const agentInput = agentLabel.createEl("input", { type: "text" });
    agentInput.value = existing.agent ?? "";
    agentInput.addClass("kanban-modal-input");

    // Agent status
    const agentStatusLabel = form.createEl("label", { text: "Agent Status" });
    const agentStatusSelect = agentStatusLabel.createEl("select");
    agentStatusSelect.addClass("kanban-modal-input");
    const statusOpts = [{ value: "", text: "— none —" }, { value: "busy", text: "busy" }, { value: "idle", text: "idle" }, { value: "inactive", text: "inactive" }];
    for (const s of statusOpts) {
      const opt = agentStatusSelect.createEl("option", { value: s.value, text: s.text });
      if ((existing.agent_status ?? "") === s.value) opt.selected = true;
    }

    // Tags
    const tagsLabel = form.createEl("label", { text: "Tags (comma-separated)" });
    const tagsInput = tagsLabel.createEl("input", { type: "text" });
    tagsInput.value = existing.tags?.join(", ") ?? "";
    tagsInput.addClass("kanban-modal-input");

    // Epic
    const epicLabel = form.createEl("label", { text: "Epic" });
    const epicInput = epicLabel.createEl("input", { type: "text" });
    epicInput.value = existing.epic ?? "";
    epicInput.placeholder = "e.g. User Auth";
    epicInput.addClass("kanban-modal-input");

    // Depends on
    const depsLabel = form.createEl("label", { text: "Depends on (comma-separated filenames without .md)" });
    const depsInput = depsLabel.createEl("input", { type: "text" });
    depsInput.value = existing.depends_on?.join(", ") ?? "";
    depsInput.placeholder = "e.g. login-form, oauth-callback";
    depsInput.addClass("kanban-modal-input");

    // Due date
    const dueLabel = form.createEl("label", { text: "Due date" });
    const dueInput = dueLabel.createEl("input", { type: "date" });
    dueInput.value = existing.due ?? "";
    dueInput.addClass("kanban-modal-input");

    // Description
    const descLabel = form.createEl("label", { text: "Description" });
    const descArea = descLabel.createEl("textarea");
    descArea.value = existingContent;
    descArea.addClass("kanban-modal-textarea");

    // Buttons
    const btnRow = form.createEl("div", { cls: "kanban-modal-buttons" });
    const saveBtn = btnRow.createEl("button", { text: "Save", cls: "mod-cta" });
    const cancelBtn = btnRow.createEl("button", { text: "Cancel" });

    cancelBtn.addEventListener("click", () => this.close());

    saveBtn.addEventListener("click", async () => {
      const title = titleInput.value.trim();
      if (!title) {
        new Notice("Title is required");
        return;
      }

      const fm: TaskFrontmatter = {
        title,
        priority: prioritySelect.value as TaskFrontmatter["priority"],
        created: isEdit ? existing.created : new Date().toISOString().split("T")[0],
      };

      const tags = tagsInput.value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (tags.length > 0) fm.tags = tags;
      if (dueInput.value) fm.due = dueInput.value;
      if (agentInput.value.trim()) fm.agent = agentInput.value.trim();
      if (agentStatusSelect.value) fm.agent_status = agentStatusSelect.value as TaskFrontmatter["agent_status"];
      if (epicInput.value.trim()) fm.epic = epicInput.value.trim();
      const deps = depsInput.value.split(",").map((d) => d.trim()).filter(Boolean);
      if (deps.length > 0) fm.depends_on = deps;

      const content = descArea.value.trim();

      try {
        if (this.config.mode === "edit") {
          await this.service.updateTask(this.config.card.file, fm, content);
        } else {
          await this.service.createTask(this.config.column, fm, content);
        }
        this.onSave();
        this.close();
      } catch (e) {
        new Notice(`Error saving task: ${e}`);
      }
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
