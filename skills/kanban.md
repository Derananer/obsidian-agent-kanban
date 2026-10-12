# Agent Kanban — Master Reference

> **Filesystem-based kanban board.** Folders = columns, MD files = tasks.
> No API, no backend — agents read and write files directly.

---

## Board location

```
{BOARD_PATH}/          ← set this to your vault's board folder
├── epics/             ← epic definitions
│   ├── auth.md
│   └── infrastructure.md
├── 1-backlog/         ← columns sorted by numeric prefix
├── 2-in-progress/   ← agent working, or PR open awaiting merge
├── 4-done/
└── 5-canceled/
```

**Moving a task between columns = renaming/moving the file to another folder.**

## What a task is

- A task is a **tangible increment of the epic** — when it is finished there is a result you can see, check or merge
  (an endpoint works, a screen shows data, a push arrives). It is **not** a unit of subagent work and **not** a process phase.
- No separate "analysis" / "review" / "implementation" tasks for the same thing — analysis, specs and plans live in docs and in the epic body.
- At least one task per affected repository (different repos = different PRs = different increments).
- For complex work the agent proposes the task breakdown (task → increment → repo → plan items it closes) in the spec, for approval together with it.
- There is no review column: a task with an open PR stays in `2-in-progress` with `agent_status: idle`.

---

## Task file format

```markdown
---
title: Fix auth bug
priority: low | medium | high | critical
tags: [auth, backend]
created: 2026-04-05
due: 2026-04-10
agent: your-agent-name
agent_status: busy | idle | inactive
epic: "Auth"
depends_on: [other-task-filename, another-task]
---

Free-form description in markdown.
Append progress notes here as you work.
```

### Field reference

| Field | Required | Description |
|---|---|---|
| `title` | yes | Human-readable task name |
| `priority` | no | `low` `medium` `high` `critical` |
| `tags` | no | Array of strings |
| `created` | no | ISO date `2026-04-05` |
| `due` | no | Deadline ISO date |
| `agent` | no | Name of the agent currently owning the task |
| `agent_status` | no | `busy` = actively working · `idle` = paused · `inactive` = unassigned |
| `epic` | no | Must match `title` field of an epic file in `epics/` (case-insensitive) |
| `depends_on` | no | Array of **filenames without `.md`** that must be done before this task |

---

## Epic file format

Same structure as a task, stored in `epics/` folder.
The `title` field is the name other tasks reference in their `epic:` field.

```markdown
---
title: Auth
priority: high
tags: [security, backend]
created: 2026-04-01
due: 2026-04-30
---

Epic description. Goal and scope.
```

---

## Operations

### Read the board

```bash
# List all columns
ls {BOARD_PATH}/

# List tasks in a column
ls {BOARD_PATH}/1-backlog/

# Read a task
cat {BOARD_PATH}/1-backlog/fix-auth-bug.md

# Find all tasks assigned to you
grep -r "agent: your-agent-name" {BOARD_PATH} --include="*.md" -l

# Find all blocked tasks (has depends_on)
grep -r "depends_on:" {BOARD_PATH} --include="*.md" -l
```

### Claim a task

Edit the task file's frontmatter:

```yaml
agent: your-agent-name
agent_status: busy
```

Then move to in-progress column:

```bash
mv {BOARD_PATH}/1-backlog/fix-auth-bug.md {BOARD_PATH}/2-in-progress/fix-auth-bug.md
```

### Update progress

Append notes to the task body (below the `---` frontmatter block):

```markdown
## Agent notes — 2026-04-05

Investigated the issue. Root cause: JWT expiry not handled in middleware.
Next: patch the auth middleware and add test coverage.
```

### Complete a task

```bash
# Move to done column
mv {BOARD_PATH}/2-in-progress/fix-auth-bug.md {BOARD_PATH}/4-done/fix-auth-bug.md
```

Optionally update frontmatter:
```yaml
agent_status: idle
```

### Create a task

Create a new `.md` file directly in the target column:

```bash
cat > {BOARD_PATH}/1-backlog/my-new-task.md << 'EOF'
---
title: My new task
priority: medium
created: 2026-04-05
agent: your-agent-name
agent_status: busy
epic: "Auth"
---

What needs to be done.
EOF
```

### Add a dependency

Edit frontmatter of the dependent task:

```yaml
depends_on: [blocking-task-filename, another-blocker]
```

The board UI will show 🔒 on this card until all listed tasks are in the done column.

---

## Workflow

### Standard agent loop

```
1. READ    → scan backlog for unassigned tasks matching your domain
2. CLAIM   → set agent + agent_status: busy, move to in-progress
3. WORK    → edit files, append notes, create sub-tasks if needed
4. BLOCK   → if blocked, add depends_on + set agent_status: idle
5. DONE    → move file to done column, set agent_status: idle
6. REPEAT  → pick next task from backlog
```

### Multi-agent coordination

- Each agent claims tasks by writing its name to `agent` field
- Check if `agent` field is already set before claiming
- Use `depends_on` to declare inter-task dependencies
- Done column is the source of truth for "completed" status

### Naming conventions

- Task filenames: `kebab-case.md` (e.g. `fix-auth-middleware.md`)
- Agent names: consistent identifier (e.g. `backend-agent`, `cursor-agent-1`)
- Epic names: match `title` in the epic file exactly (case-insensitive)

---

## Quick reference card

```
CLAIM TASK
  1. Add agent + agent_status: busy to frontmatter
  2. mv task.md 1-backlog/ → 2-in-progress/

UPDATE PROGRESS
  Append ## notes under frontmatter

COMPLETE TASK
  mv task.md 2-in-progress/ → 4-done/

CREATE TASK
  Write new .md with frontmatter to column folder

ADD DEPENDENCY
  depends_on: [other-task-filename]

SET EPIC
  epic: "Epic Name"   ← must match title in epics/ folder
```
