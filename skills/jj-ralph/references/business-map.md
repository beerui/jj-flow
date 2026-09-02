# Business / capability map

Path: `.workflow/ralph/business-map.json`  
Contract: [business-map.schema.json](business-map.schema.json)

## Node fields

| Field | Meaning |
| --- | --- |
| `id` | `CAP-*` |
| `title` / `summary` | Title and one-line summary |
| `status` | `active` \| `done` \| `deprecated` |
| `reqs` | Requirement IDs |
| `modules` | Related source paths |
| `acceptance` | Acceptance doc paths |
| `run_refs` | Source `task-*` (leftover `RALPH-*` refs stay until migrate) |
| `keywords` / `lessons` | Search keywords and lessons |
| `handoff_refs` | Handoff paths |

When creating/merging nodes, copy [capability.skeleton.json](capability.skeleton.json).

## When to write

- ANALYZE: may draft in `task_plan.md` `## 分析`; map node optionally `active`.
- ARCHIVE / after accept PASS: merge strong evidence into `business-map.json` (multiple archives allowed; update current).
- **`ABANDONED` forbids map-merge** (must resume then archive).
- Do not delete historical capabilities; deprecate with `deprecated`.

## map-find

Prefer: `ralph_ops.mjs map-find --query "…"` (outputs matches + discover_paths).

1. Read `business-map.json`; search by title / keywords / module fragments.
2. On hit, open `.workflow/ralph/tasks/<task_key>/.state/run.json`, `progress.md`, `task_plan.md` via `run_refs` (legacy `RALPH-*/run.json` until migrate).
3. `discover_paths` in tool output is a search-time path list — **not persisted**.
4. If `handoff_refs` exist, read requirements under `.workflow/handoffs/<HOF-ID>/`; do not implement migration inside the ralph directory.
