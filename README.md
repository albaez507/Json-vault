# JSON Vault

A lightweight, browser-based tool for storing and organizing **golden JSON references** for your API endpoints. No backend, no dependencies — just open `index.html` and start working.

---

## What is it?

JSON Vault lets you save known-good (golden) API responses alongside their request bodies, HTTP method, endpoint, tags and notes. When something breaks, you open the Compare tool, paste the actual response, and instantly see what changed.

---

## Features

- **Collections** — group related entries under a named collection with a custom icon and base URL
- **Entries** — store HTTP method, endpoint, response JSON, request JSON, tags and notes per entry
- **Interactive JSON Viewer** — collapsible tree with expand / collapse all controls
- **Split View** — side-by-side Request | Response panels with a draggable divider
- **Compare Tool** — paste an actual API response and diff it against the stored golden; highlights changed, missing and unexpected keys
- **Search** — instant search across entry names, endpoints, descriptions and tags
- **Import / Export** — export a single collection or the entire vault as JSON; re-import at any time
- **Duplicate & Rename** — quick entry management from the context menu
- **Keyboard Shortcuts** — see table below
- **Persistent** — all data lives in `localStorage`, nothing leaves your browser

---

## Getting Started

```bash
git clone https://github.com/albaez507/Json-vault.git
cd Json-vault
```

Open `index.html` in your browser — that's it. No install, no build step.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl / Cmd + N` | New collection |
| `Ctrl / Cmd + E` | New entry in current collection |
| `Ctrl / Cmd + K` | Focus search |
| `Escape` | Close modal / clear search |

---

## Project Structure

```
json-vault/
├── index.html          # App shell & layout
├── css/
│   └── styles.css      # All styling
└── js/
    ├── data.js         # Data layer — CRUD, localStorage persistence, import/export, diff
    ├── ui.js           # UI layer — rendering, modals, JSON tree, compare
    └── main.js         # Bootstrap & event wiring
```

---

## Import / Export Format

Exports are plain JSON files you can version-control or share with teammates.

| Export type | `_type` field | CLI |
|---|---|---|
| Single collection | `json-vault-collection` | ⋯ menu → Export Collection |
| Full vault | `json-vault-export` | Sidebar footer → Export All |

To import, click **Import** in the sidebar footer and select a previously exported file.

---

## Tech Stack

| | |
|---|---|
| Language | Vanilla HTML / CSS / JavaScript |
| Persistence | `localStorage` |
| Dependencies | None |
| Build tool | None |

---

## License

MIT
