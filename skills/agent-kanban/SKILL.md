---
name: agent-kanban
description: Read or update an Obsidian Agent Kanban filesystem board when the user asks to manage its tasks, epics, or status.
---

# Agent Kanban

The board is a directory of Markdown files: column directories hold tasks and `epics/` holds epic definitions. Discover the board location and existing column names from project instructions and the vault; do not assume every board has the same columns or done state. Project-specific workflow and user instructions take precedence.

Read existing task and epic files before editing. Task properties live in YAML frontmatter; `epic` matches an epic title and `depends_on` lists task filenames without `.md`. Preserve existing content and metadata, quote YAML strings when needed, and append progress notes rather than replacing the description.

To claim work, check ownership, set `agent` and `agent_status`, then move the file to the appropriate active column. Update status and links as project conventions require. Move completed or canceled tasks to the corresponding configured column; do not delete tasks. A board may treat open PRs as in progress. For dependency status consult its configured done columns, not the folder number alone.

Respect the scope of the user request: reading the board does not authorize claiming or changing tasks. Avoid changing the vault’s `.obsidian/` configuration unless explicitly requested.
