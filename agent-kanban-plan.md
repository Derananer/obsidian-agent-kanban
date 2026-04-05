# Agent Kanban — план разработки Obsidian плагина

## Концепция

Борда полностью основана на файловой системе. Папки = колонки, MD файлы = таски.
Никакого бэкенда. Агенты живут снаружи и пишут в файлы сами — борда только отображает.

---

## Структура файловой системы

```
vault/
└── board/
    ├── 1-backlog/
    │   └── fix-auth-bug.md
    ├── 2-in-progress/
    │   └── redesign-header.md
    ├── 3-review/
    └── 4-done/
        └── setup-ci.md
```

Порядок колонок определяется числовым префиксом папки (`1-`, `2-`, `3-`...).
Перемещение таски между колонками = `vault.rename()` файла в другую папку.

---

## Формат MD файла таски

```markdown
---
title: Fix auth bug
priority: high
tags: [auth, backend]
created: 2026-04-05
due: 2026-04-10
agent: backend-agent
agent_status: busy
---

Описание задачи в свободном markdown.
Агент дописывает сюда свои заметки по мере работы.
```

### Поля frontmatter

| Поле | Тип | Значения |
|---|---|---|
| `title` | string | Заголовок таски |
| `priority` | string | `low` \| `medium` \| `high` \| `critical` |
| `tags` | string[] | Произвольные теги |
| `created` | date | ISO дата создания |
| `due` | date | ISO дата дедлайна |
| `agent` | string | Имя агента, взявшего задачу |
| `agent_status` | string | `busy` \| `idle` \| `inactive` |

---

## Структура проекта

```
obsidian-agent-kanban/
├── src/
│   ├── main.ts           # Entry point, Plugin class
│   ├── types.ts          # Интерфейсы и типы
│   ├── kanban-view.ts    # ItemView с доской
│   ├── card-modal.ts     # Модалка создания/редактирования
│   ├── board-service.ts  # Работа с файлами и папками
│   ├── settings.ts       # PluginSettingTab
│   └── styles.css        # Стили
├── manifest.json
├── package.json
├── tsconfig.json
└── esbuild.config.mjs
```

---

## Описание модулей

### `types.ts`

```typescript
interface TaskCard {
  file: TFile;
  frontmatter: TaskFrontmatter;
  content: string;   // всё что после frontmatter блока
  column: string;    // имя папки
}

interface TaskFrontmatter {
  title?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  tags?: string[];
  created?: string;
  due?: string;
  agent?: string;
  agent_status?: 'busy' | 'idle' | 'inactive';
}

interface KanbanSettings {
  boardFolder: string;    // путь к папке борды внутри vault
  columnOrder: string[];  // ручная сортировка колонок по имени
}
```

---

### `board-service.ts`

Вся работа с файловой системой через Obsidian API.

**Методы:**

- `getColumns()` — читает дочерние папки из `settings.boardFolder`, сортирует по числовому префиксу или `columnOrder`
- `getTasksInFolder(folder: TFolder)` — читает `.md` файлы папки, парсит frontmatter
- `moveTask(file: TFile, targetFolder: TFolder)` — вызывает `vault.rename()` чтобы переместить файл
- `createTask(column: TFolder, frontmatter: TaskFrontmatter, content: string)` — создаёт новый MD файл
- `updateFrontmatter(file: TFile, patch: Partial<TaskFrontmatter>)` — обновляет поля frontmatter не трогая контент

**Важно для `updateFrontmatter`:**
Читать файл как строку, найти блок между `---`, заменить только нужные строки, записать обратно. Не использовать `metadataCache` для записи.

**Важно для чтения frontmatter:**
Использовать `app.metadataCache.getFileCache(file)?.frontmatter` — это быстро и надёжно.

---

### `kanban-view.ts`

Extends `ItemView` из obsidian.

- `getViewType()` возвращает константу `"agent-kanban"`
- `getDisplayText()` возвращает `"Kanban"`
- Рендер в `onOpen()`:
  - Горизонтальный flex контейнер с колонками
  - Каждая колонка — вертикальный список карточек + заголовок + кнопка `+`
  - Каждая карточка — `draggable` div

**Drag & Drop (нативный HTML5 DnD, без библиотек):**
- `ondragstart` на карточке — сохранять путь файла в `dataTransfer`
- `ondragover` на колонке — `preventDefault()` чтобы разрешить drop
- `ondrop` на колонке — вызывать `board-service.moveTask()`

**Отображение на карточке:**
- Заголовок (из frontmatter `title` или имени файла)
- Цветная точка приоритета: `critical`=красный, `high`=оранжевый, `medium`=жёлтый, `low`=серый
- Теги как пилюли
- Дата дедлайна если задана (красная если просрочена)
- Бейдж `agent` + иконка статуса если поле `agent` задано:
  - `busy` → 🟢
  - `idle` → 🟡
  - `inactive` → ⚪

**Обновление UI:**
Подписаться на события vault в `onOpen`:
```typescript
this.registerEvent(this.app.vault.on('rename', () => this.refresh()));
this.registerEvent(this.app.vault.on('modify', () => this.refresh()));
this.registerEvent(this.app.vault.on('create', () => this.refresh()));
this.registerEvent(this.app.vault.on('delete', () => this.refresh()));
```

Клик на карточку → открыть `card-modal` в режиме редактирования.

---

### `card-modal.ts`

Extends `Modal` из obsidian. Два режима: создание и редактирование.

**Поля формы:**
- Title — текстовое поле
- Priority — `<select>` с вариантами low / medium / high / critical
- Agent — текстовое поле (имя агента)
- Agent Status — `<select>` с вариантами busy / idle / inactive
- Tags — текстовое поле, через запятую
- Due date — `<input type="date">`
- Description — `<textarea>` для контента

При сохранении вызывает `board-service.createTask()` или `board-service.updateFrontmatter()`.

---

### `settings.ts`

Extends `PluginSettingTab`.

**Настройки:**

- **Board folder** — текстовое поле, путь внутри vault (по умолчанию `board`)
- **Column order** — текстовое поле, имена папок через запятую для ручной сортировки

---

### `main.ts`

```typescript
export default class AgentKanbanPlugin extends Plugin {
  settings: KanbanSettings;

  async onload() {
    await this.loadSettings();
    this.registerView('agent-kanban', (leaf) => new KanbanView(leaf, this));
    this.addRibbonIcon('layout-kanban', 'Agent Kanban', () => this.activateView());
    this.addCommand({ id: 'open-kanban', name: 'Open Kanban Board', callback: () => this.activateView() });
    this.addCommand({ id: 'create-task', name: 'Create new task', callback: () => this.openCreateTaskModal() });
    this.addSettingTab(new KanbanSettingTab(this.app, this));
  }
}
```

---

### `styles.css`

Минималистичный тёмный стиль, совместимый с темами Obsidian.
Использовать CSS переменные Obsidian: `--background-primary`, `--text-normal`, `--interactive-accent` и т.д.

**Элементы для стилизации:**
- `.kanban-board` — горизонтальный flex, overflow-x: auto
- `.kanban-column` — фиксированная ширина ~280px, flex-direction: column
- `.kanban-column-header` — заголовок колонки + счётчик карточек
- `.kanban-card` — белая/тёмная карточка с тенью, cursor: grab
- `.kanban-card.is-dragging` — opacity 0.5 при перетаскивании
- `.kanban-column.drag-over` — подсветка при наведении
- `.priority-dot` — цветная точка
- `.agent-badge` — бейдж с именем агента и иконкой статуса
- `.tag-pill` — пилюля тега
- `.due-date` — дата, красная если `< new Date()`

---

### `manifest.json`

```json
{
  "id": "agent-kanban",
  "name": "Agent Kanban",
  "version": "1.0.0",
  "minAppVersion": "1.0.0",
  "description": "Filesystem-based kanban board. Folders as columns, MD files as tasks.",
  "author": "you",
  "isDesktopOnly": true
}
```

---

## Порядок реализации для Claude Code

Реализуй модули строго в этом порядке:

1. `manifest.json`, `package.json`, `tsconfig.json`, `esbuild.config.mjs` — взять из шаблона [obsidianmd/obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
2. `src/types.ts`
3. `src/board-service.ts`
4. `src/settings.ts`
5. `src/card-modal.ts`
6. `src/kanban-view.ts`
7. `src/main.ts`
8. `src/styles.css`

---

## Установка и запуск локально

### 1. Создать проект из шаблона

```bash
git clone https://github.com/obsidianmd/obsidian-sample-plugin obsidian-agent-kanban
cd obsidian-agent-kanban
npm install
```

### 2. Найти папку своего vault

В Obsidian: правый клик на vault → **Show in Finder / Explorer**.
Путь будет вида `/Users/name/Documents/MyVault`.

### 3. Создать симлинк плагина в vault

```bash
# macOS / Linux
mkdir -p /path/to/vault/.obsidian/plugins/
ln -s $(pwd) /path/to/vault/.obsidian/plugins/agent-kanban

# Windows (PowerShell, от администратора)
New-Item -ItemType Junction -Path "C:\vault\.obsidian\plugins\agent-kanban" -Target (Get-Location)
```

Симлинк означает что `npm run dev` сразу обновляет файлы в vault — не нужно ничего копировать.

### 4. Запустить сборку

```bash
npm run dev
# Следит за изменениями и пересобирает main.js автоматически
```

### 5. Включить плагин в Obsidian

```
Settings → Community Plugins → выключить Safe Mode
→ Installed Plugins → найти "Agent Kanban" → включить
```

### 6. Перезагрузка при разработке

Вместо перезапуска Obsidian использовать:
```
Ctrl+P (или Cmd+P) → "Reload app without saving"
```

Или установить плагин **Hot Reload** из community plugins — он перезагружает плагин автоматически при изменении `main.js`.

---

## Промпт для Claude Code

> Реализуй Obsidian плагин по спецификации в этом файле. Начни с `manifest.json`, `package.json`, `tsconfig.json`, `esbuild.config.mjs` — возьми их за основу из официального шаблона obsidianmd/obsidian-sample-plugin. Затем реализуй модули строго в порядке: `types.ts` → `board-service.ts` → `settings.ts` → `card-modal.ts` → `kanban-view.ts` → `main.ts` → `styles.css`. Не добавляй никаких вызовов внешних API — борда работает только с файловой системой через Obsidian API.
