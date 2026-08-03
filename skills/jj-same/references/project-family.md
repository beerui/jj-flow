# Project A / B / C family

## Contents

- [Logic matrix](#logic-matrix)
- [Current example paths](#current-example-paths)
- [Role judgment](#role-judgment)
- [Port directions](#port-directions)
- [Default delivery order](#default-delivery-order)
- [Branch derivation rules](#branch-derivation-rules)
- [Task-level project registry](#task-level-project-registry)

## Logic matrix

The project family forms a matrix by product shape and brand/business line:

| Shape | Project A | Project B | Project C |
|---|---|---|---|
| Frontend | Project A | Project B | Project C |
| Admin | Project A Admin | Project B Admin | Project C Admin |

Any cell may be the source project. Do not hard-code Project A as always-source; the source is the user-named session, requirement-landing repo, or feature branch.

With a `$jj-dispatch` control project, do not use a single `SOURCE` for every role. Read separately: `origin_project`, `requirement_owner`, `lead_project`, `reference_implementation`, and `targets`; the five may differ, and reference may be empty before verification. Without control, keep using this file’s task-level registry compatibility flow.

## Current example paths

Paths, role short names, and aliases are **not hard-coded by this file**. At task start, read the global project map:

- Authoritative file: `/portfolio/map.md`
- Match keys: Chinese name / aliases / directory name / package.name / remote repo name
- On hit, use that row’s `path` as the work target (for module/electron-production also combine `host`)
- Historical absolute paths are retired; if seen, treat as old evidence only, not live path

When deriving branch `role_map` (project short name) from the map:

1. Match the user’s product name or current repo to one `map.md` row.
2. From that row’s `aliases`, take the **shortest stable project short name** as the role token (common: `pa` / `pb` / `pc`; admin etc. use map aliases such as `project-a-admin` — do not invent).
3. On cross-repo ports in the same product line, replace the role token only with the **target row** short name; always re-resolve path from the map — do not guess directories.

Common frontend short names (from the map; map.md wins on change):

| Logical role | Map name example | role token | Current path (map wins) |
|---|---|---|---|
| Project A | 项目A | `pa` | `/portfolio/project-a` |
| Project B | 项目B | `pb` | `/portfolio/project-b` |
| Project C | 项目C | `pc` | `/portfolio/project-c` |
| Project A Admin | 项目A 管理端 | `project-a-admin` | `/portfolio/project-a-admin` |
| Project B Admin | 项目B 管理端 | `project-b-admin` | `/portfolio/project-b-admin` |

Re-verify path, Git repo, and role at task start. Paths/roles the user gives live take priority over stale cache, but still reconcile against `map.md`.

## Role judgment

Business role is determined by evidence, highest priority first:

1. User explicitly names “Project A/B/C + frontend/admin”.
2. Project-level architecture docs, deploy config, and business entrypoints.
3. Repo path, package name, and README as secondary clues only.

Do not reclassify a project from any single clue below:

- Vue 2 or Vue 3.
- Vuex or Pinia.
- Vue CLI or Vite.
- Whether API paths contain `/api/admin`.
- Whether the repo name contains `manager`, `admin`, or `frontend`.

Tech shape decides `DIRECT` vs `ADAPT`, not business role.

## Port directions

### Same-row ports

- Frontend requirements are analyzed only across the three frontend projects by default.
- Admin requirements are analyzed only across the three admin projects by default.
- Same origin ≠ isomorphic; each target still needs its call chain and capability matrix.

### Cross-row ports

Analyze frontend↔admin sync only when one of:

- User explicitly requires both frontend and admin changes.
- Requirement docs explicitly list both shapes.
- Shared API contract or security rules require full-end consistency.

Even when business rules are shared across rows, implement on each shape’s native architecture — do not copy components.

## Default delivery order

When Project A is the user-named lead and the agent needs to recommend the next target, same-row default serial delivery is `pa -> pb -> pc`:

1. `pa` finishes analysis, development, verification, and review.
2. User, in a new session citing the prior session ID, explicitly triggers `pb`.
3. `pb` re-runs target analysis, implements on its own business/architecture, and completes verification and review.
4. Only after another explicit user trigger enter `pc`.

The agent MUST NOT skip order into another repo on its own. When the current request clearly names a target and asks implement, treat it as an active override of the default order; check only that target’s `EXECUTION_READY`, and do not block coding on other siblings’ review, UAT, or family-plan status. Unselected projects keep prior status and MUST NOT be casually modified.

When a predecessor reaches the handoff gate, the family plan MUST record the unique `snapshot_id` and `handoff_ref`. Later targets prefer consuming that snapshot over re-reading full source sessions and requirement docs; the snapshot reuses shared requirement semantics only and does not replace target source verification.

`pa -> pb -> pc` is the default when Project A leads, not a permanent role restriction. When the current project is not Project A, the user specifies another order, or the requirement covers only a subset, follow the current user request and task-level registry; do not backfill unauthorized projects.

## Branch derivation rules

- The lead project branch is created by the user; `jj-same` only verifies and records — it does not create or rename for the user.
- On agent auto-advance, only after the predecessor reaches `HANDOFF_READY` and the user triggers, create a develop branch on the target from a **fresh** integration base (default `master`). When the current request already names a target and asks implement, use that target’s `EXECUTION_READY`.
- **CREATE base freshness (hard gate, EP-20260803)**:
  1. `git fetch <remote> <base>` (default `origin master`).
  2. Compute `behind_count = rev-list --count <base>..<remote>/<base>`; write into the preflight table.
  3. When `behind_count > 0`: prefer `git checkout -b <feat> <remote>/<base>`, or `merge --ff-only` on a **clean and ff-able** local base before creating the branch.
  4. **Forbidden**: silent branch from a behind local tip; **forbidden**: `reset --hard` or unconfirmed rewrite of dirty/divergent local `master`.
  5. Full checklist and G6 → [branch-purpose-preflight.md](branch-purpose-preflight.md).

### Naming grammar

Recommended work-branch structure (lead branch is the only template):

```text
{type}/{role}-{release_date}[-{req_suffix}][-{developer}]
```

| Segment | Meaning | Source | Example |
| --- | --- | --- | --- |
| `type` | change type | lead branch | `feat` |
| `role` | project short name | target alias/short name in `/portfolio/map.md` | `pa` / `pb` / `pc` |
| `release_date` | planned ship day | lead branch; usually `MMDD` or `YYYYMMDD` | `0731` (2026-07-31) |
| `req_suffix` | **optional** requirement suffix; only when same day/same developer needs multiple lines | **only** if lead already has it or user/requirement explicitly requires | `qi` |
| `developer` | developer abbreviation | lead branch; otherwise optional config, not hard-coded business logic | `dev` |

Optional config (does not override lead-branch facts):

- Authoritative file: `/portfolio/config/naming.json` under `branch.*`
- `branch.developer`: default developer abbreviation (example `dev`) for prompts/completion when the user has not created a branch
- `branch.date_format`: default `MMDD`
- `role_map`: **do not maintain a second table inside the skill**; always parse from `/portfolio/map.md` (see `branch.role_map_source`)

### Derivation algorithm

1. Parse lead branch segments; `role` MUST match a short name on some `map.md` row.
2. Target `role` comes from map resolution of the target product.
3. Derived result = lead template with **only the `role` segment replaced**.
4. Copy `type` / `release_date` / `req_suffix` / `developer` **as-is**.
5. Forbidden:
   - Adding `req_suffix` when the lead has none (e.g. lead `feat/pa-0731-dev` but generate `feat/pb-0731-qi-dev`)
   - Dropping lead’s existing `req_suffix` or `developer`
   - Using `-1 / -2` as project order for `pb / pc`
6. Before create, print a comparison and self-check:

```text
lead:     feat/pa-0731-dev
planned:  feat/pb-0731-dev
diff:     role pa -> pb
```

If `diff` is more than `role`, mark `BLOCKED` or recompute from the lead; do not create a branch carrying extra tokens.

### Positive / negative examples

| Lead | Target | Legal derive | Illegal derive |
| --- | --- | --- | --- |
| `feat/pa-0731-dev` | Project B | `feat/pb-0731-dev` | `feat/pb-0731-qi-dev` (unauthorized `qi`) |
| `feat/pa-0731-qi-dev` | Project C | `feat/pc-0731-qi-dev` | `feat/pc-0731-dev` (dropped `qi`) |
| `feat/pa-0717-1` | Project B | `feat/pb-0717-1` | `feat/pb-0717-2` (changed sequence) |

- When the lead branch is not in a decidable format, first verify from family plan, session, and Git history. If a unique reversible result exists under “do not expand scope, only replace role”, record the assumption and continue; if multiple valid interpretations remain, mark `BLOCKED` with candidate branches, missing evidence, and unblock conditions — no extra Q&A flow.
- Before create, re-check target repo (`map.md` path/host), origin, worktree, local `master` SHA, **`origin/master` (or configured base) SHA and behind_count**, and whether the target branch already exists; on any fact conflict or unhandled stale base, mark `BLOCKED` / run `base_action` first.

### Six-project root-cause check

When the user asks to “check all projects for the same class of issue”:

1. First locate root cause and trigger conditions on the source.
2. Search the same root cause in all six projects one by one; do not substitute similar symptoms.
3. Fix only projects that have the same root cause and are in scope.
4. Mark others `N/A`, `BLOCKED`, or “same root cause not found”.

## Task-level project registry

Generate a task-level registry table at the start of each run:

| Role | Path | ref | This-round identity | Analyze? | Modify? |
|---|---|---|---|---|---|
| Project A | path | branch/commit | SOURCE/TARGET/OUT | yes/no | yes/no |

- `SOURCE`: source project with confirmed changes and evidence.
- `TARGET`: projects the user authorized for port implement.
- `OUT`: out of this-round scope; explain non-analysis reason only when needed.

When targets are unclear and different choices change delivery scope, confirm the target set first; do not default-broadcast to all six projects.

The registry also records `delivery_order`, lead branch, derived branches, current status, predecessor gates, source session ID, current session ID, `snapshot_id`, `handoff_ref`, and freshness. Future projects register only high-level scope and differences still to verify — no prewritten executable implement tasks.
