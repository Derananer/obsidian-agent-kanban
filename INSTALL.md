# Установка Agent Kanban

## Требования

- Obsidian 1.0+
- Node.js 16+ (только для сборки)

---

## 1. Клонировать и собрать

```bash
git clone <repo-url> obsidian-agent-kanban
cd obsidian-agent-kanban
cd src
npm install
npm run build
```

После сборки в корне появится `main.js`.

---

## 2. Установить в vault

### Вариант A — симлинк (рекомендуется для разработки)

```bash
# macOS / Linux
mkdir -p /path/to/vault/.obsidian/plugins/
ln -s $(pwd) /path/to/vault/.obsidian/plugins/agent-kanban
```

```powershell
# Windows (PowerShell от администратора)
New-Item -ItemType Junction `
  -Path "C:\path\to\vault\.obsidian\plugins\agent-kanban" `
  -Target (Get-Location)
```

### Вариант B — копирование

Скопировать три файла в `.obsidian/plugins/agent-kanban/`:

```
main.js
manifest.json
styles.css
```

---

## 3. Включить плагин

```
Obsidian → Settings → Community Plugins
→ отключить Safe Mode
→ Installed Plugins → найти "Agent Kanban" → включить
```

---

## 4. Создать структуру борды

Создать папку `board` в корне vault с подпапками-колонками:

```
vault/
└── board/
    ├── epics/          ← описания эпиков
    ├── 1-backlog/
    ├── 2-in-progress/
    └── 3-done/
```

> Числовой префикс папки определяет порядок колонок.
> Название папки `epics` зарезервировано — туда помещать только эпики, не таски.

---

## 5. Открыть борду

- Кликнуть иконку **layout-kanban** на ribbon (левая панель)
- Или `Cmd/Ctrl+P` → **Open Kanban Board**

---

## Разработка (watch mode)

```bash
npm run dev
# пересобирает main.js при каждом изменении файлов
```

Для горячей перезагрузки плагина без перезапуска Obsidian:
```
Cmd/Ctrl+P → Reload app without saving
```

Или установить плагин **Hot Reload** из Community Plugins.

---

## Настройки плагина

```
Settings → Agent Kanban
```

| Параметр | По умолчанию | Описание |
|---|---|---|
| Board folder | `board` | Путь к папке борды внутри vault |
| Column order | — | Порядок колонок через запятую (если нужна ручная сортировка) |
| Done columns | `3-done` | Колонки, считающиеся завершёнными (для расчёта зависимостей) |
