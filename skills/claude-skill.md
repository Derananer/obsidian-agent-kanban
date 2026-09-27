---
name: kanban
description: Interact with the Agent Kanban board — read tasks, claim work, update progress, move between columns, create tasks. Board is filesystem-based: folders = columns, MD files = tasks.
---

You are working with a filesystem-based kanban board.
Full reference: see `kanban.md` in this skills folder.

## Board path

The board is at the path configured in the user's vault. Ask the user for `{BOARD_PATH}` if not known,
or look for a folder containing `epics/`, `1-backlog/`, `2-in-progress/` subfolders.

## What you can do

When the user (or another agent) invokes `/kanban`, determine the intent from context or arguments:

| Intent | Action |
|---|---|
| `status` / no args | Read all columns, summarize tasks by epic and column |
| `claim <task>` | Set agent+status, move to in-progress |
| `done <task>` | Move task file to done column |
| `create <title>` | Create new task file with frontmatter |
| `show <task>` | Read and display task details |
| `mine` | Find all tasks where agent = current agent |
| `blocked` | Find all tasks with depends_on not yet in done |

## Board UI

Click on a task opens its file, click on an epic name opens the epic file, right-click on a task → "Edit properties".

## What a task is

- A task is a **tangible increment of the epic** — when it is finished there is a result you can see, check or merge
  (an endpoint works, a screen shows data, a push arrives). It is **not** a unit of subagent work and **not** a process phase.
- No separate "analysis" / "review" / "implementation" tasks for the same thing — analysis, specs and plans live in docs and in the epic body.
- At least one task per affected repository (different repos = different PRs = different increments).
- For complex work the agent proposes the task breakdown (task → increment → repo → plan items it closes) in the spec, for approval together with it.
- There is no review column: a task with an open PR stays in `2-in-progress` with `agent_status: idle`.

## Task file format

```yaml
---
title: Fix auth bug
priority: low | medium | high | critical
tags: [tag1, tag2]
created: 2026-04-05
due: 2026-04-10
agent: agent-name
agent_status: busy | idle | inactive
epic: "Epic Name"
depends_on: [other-task, another-task]
---

Body text. Append progress notes here.
```

## Rules

- Moving a task = renaming the file to another column folder (`vault.rename()` or `mv`)
- `depends_on` values are filenames **without** `.md` extension
- `epic` must match the `title` field of a file in `epics/` subfolder (case-insensitive)
- Never delete task files — move to done column instead
- Append progress notes below frontmatter, never overwrite the body wholesale
- If creating a task, filename = `kebab-case` version of the title

## Example session

```
User: /kanban status
→ Read all column folders, group by epic, show counts and agent assignments

User: /kanban claim fix-auth-bug
→ Edit frontmatter: agent=<current>, agent_status=busy
→ Move file from 1-backlog/ to 2-in-progress/

User: /kanban done fix-auth-bug
→ Move file from 2-in-progress/ to done column
→ Set agent_status: idle

User: /kanban create "Add rate limiting" --epic Auth --priority high
→ Create 1-backlog/add-rate-limiting.md with frontmatter
```
