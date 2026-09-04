# Artifact routing

`jj-same` recovers port requirements and chooses targets; **implementation state MUST live in each business repo’s Ralph**. Formal ids (`ANL-*`, `PLN-*`, `EXC-*`) may appear in plane / `state.json` / progress — they are not a second file tree under `~/.jj-flow` or `.workflow/.csv-wave/`. Do not create a private `.workflow/jj-same/` directory that other tools cannot discover.

Write plane:

```text
# lead (source) repo
.workflow/ralph/<run_id>/          # live flat task-<slug>/
  task_plan.md                     # Goal / 验收 / Steps
  progress.md
  findings.md
  .state/run.json                  # run.handoff is SSOT
  .state/handoff.json              # optional mirror

# each target repo (same slug when a delivery exists)
.workflow/ralph/task-<slug>/
  task_plan.md                     # Goal / 验收 / Steps + DIRECT|ADAPT|EXTEND|BLOCKED
  progress.md
  findings.md
  .state/run.json

# dispatch coordination only — not the implement home
~/.jj-flow/.workflow/dispatch/<DEL>/control-plane.json
~/.jj-flow/.workflow/tasks/TASK-*/task.md   # index (Goal / 验收 / Steps + Ralph pointers)
```

Legacy leftovers (`.workflow/.csv-wave/`, `.workflow/scratch/`, `RALPH-*`, `tasks/<id>/`, control `ANL-*.md`) are **read-only**. Do not create them as the new home.

The `jj-flow` repo itself still follows Harness rules and does not treat `.workflow` as this repository’s fact source; the directory constraints above apply to real business projects and acceptance projects.

## Artifact ownership

- Single-target standard discovery without handoff snapshot: the target repo owns analysis + plan + verify inside **its Ralph**. Optional source `BLP/REQ` stay in the source repo.
- Fast implement: when the user explicitly authorizes implement and stable source commit/diff, final requirement sources, and target call chain are enough for `EXECUTION_READY`, reuse existing canonical refs; if missing, write a minimal source-cited ledger into the target `task_plan.md` (id may still be `ANL-TARGET`), then the narrowest Steps and code. Do not rebuild full source analysis or blueprint only for formal completeness before coding; fill handoff-required canonical artifacts before `HANDOFF_READY`.
- Prepare-handoff mode: the source Ralph / optional `BLP/REQ` hold shared semantics; each target owns only its Ralph ADAPT + implement + review.
- Multi-target port: one shared source handoff; each target repo writes only its own Ralph. Do not copy ANL bodies into `control_root`.
- Family / coordination plan: with a `$jj-dispatch` control project, the control manifest holds cross-project tasks, threads, status, decisions, and artifact refs; the lead Ralph holds only its own plan. Without control, the lead may keep a family coordination note. Neither replaces each target’s Ralph `task_plan.md`. same does **not** call `ensureDispatchRalphRuns`.
- Migration handoff snapshot: prefer source Ralph `run.handoff`. Leftover `ANL-SOURCE/requirement-baseline/{snapshot_id}/handoff-snapshot.yaml` is read-only; multiple targets reuse via path, not by copying into target repos.
- When the current repo is not the target, clarify the shared blueprint owner repo before starting. Other targets consume that blueprint via `@file` or direct path; do not copy an untraceable requirements set.
- Each repo’s artifact IDs resolve only in that repo’s `.workflow/state.json`; across repos, do not assume `blueprint:BLP-*` or `analyze:ANL-*` auto-resolve.

## Canonical routes

| Stage | Action | Canonical artifact | State registration |
|---|---|---|---|
| Init | Initialize workflow directories | `.workflow/project.md`, `.workflow/state.json` | init artifact |
| Continuous-sync contract | Write arch spec | Source outgoing index and target incoming contracts, each in that repo’s `.workflow/specs/architecture-constraints.md` | spec entry |
| Source evidence summary | Source analysis | **Write:** lead `.workflow/ralph/<run_id>/` (`task_plan` / progress / findings). **Read-only leftover:** `.workflow/.csv-wave/{YYYYMMDD}-analyze-{slug}/` | `ANL-*` id |
| Migration handoff snapshot | Prefer Ralph `run.handoff` / `.state/handoff.json`. Legacy snapshot inside source analysis is read-only | `run.handoff`; leftover `ANL-SOURCE/requirement-baseline/{snapshot_id}/handoff-snapshot.yaml` | `handoff_ref` |
| Formal requirements | Formal requirement generation | On standard discovery or before handoff complete: `.workflow/blueprint/BLP-{slug}-{date}/product-brief.md`, `requirements/REQ-*.md`, `readiness-report.md`, and other needed canonical files | `BLP-*` |
| Family coordination plan | `$jj-dispatch` control manifest; without control, lead Ralph note | Control `~/.jj-flow` stores only coordination + refs; without control, lead `.workflow/ralph/<run_id>/` | control `delivery_id`; without control, `PLN-*` id |
| Target project review | Target analysis (from blueprint / handoff) | **That target’s** `.workflow/ralph/task-<slug>/task_plan.md` | `ANL-TARGET` id |
| Implement plan | Implement plan (from analyze) | Same `task_plan.md` `## Steps` (+ progress). Leftover scratch `plan.json` is read-only | `PLN-*` id |
| Implement and verify | Implement execution | Target Ralph `progress.md` / `findings.md` / `.state/events.jsonl` | `EXC-*`, `VRF-*` ids |
| Code review | `$jj-review` / `review-record` | Target Ralph `.state/reviews/REV-*.json` | `REV-*` |

If the target repo has no Ralph `task-<slug>/`, init/resume it in **that repo** first (`jj ralph init`). Do not hand-forge artifact IDs or treat `control_root` TASK files as completion. Leftover `.workflow/state.json` ids are optional citations only.

## Content mapping

### Source analysis `ANL-SOURCE`

Record in source analysis:

- Current user requirements, session correction order, branch baseline, commits and diffs.
- Real behavior, reverted behavior, accidental implementation, and unrelated changes.
- Draft `MUST`, `TARGET-ONLY`, `DO-NOT-PORT`, `UNRESOLVED`.
- Session, commit, file, method, API, and verification evidence for each conclusion.

Source analysis is evidence interpretation, not the final product spec.

### Migration handoff snapshot

- After the source has a stable commit, formal `BLP/REQ`, and explicit unresolved items, generate an immutable snapshot inside the owning `ANL-SOURCE`.
- Snapshot stores only canonical refs, Source Inventory, source HEAD, coverage, supersession, verification status, and target differences still to verify — not requirement body text.
- When a target hits a valid `handoff_ref`, consume shared source analysis and blueprint directly; write only that target’s Ralph (`task_plan.md` + progress).
- On source change, generate a successor snapshot under the same canonical ownership; targets MUST NOT modify or copy the shared snapshot.

### Formal requirements `BLP`

- Write `MUST` and confirmed `TARGET-ONLY` as `REQ-*.md` with RFC 2119 keywords, acceptance criteria, and source traceability.
- Write non-functional constraints as `NFR-*.md`.
- Put `DO-NOT-PORT` in product-brief out-of-scope and readiness traceability.
- Keep `UNRESOLVED`; do not rewrite inference as confirmed requirements.
- If readiness is `Fail` and impacts `MUST`, stop; if `Review`, pass caveats to target analysis and plan. Do not block fast implement solely because review/UAT evidence is still pending.

### Target analysis `ANL-TARGET`

`ANL-TARGET` is an **evidence id** (plane / ledger). The body is the **target repo** `.workflow/ralph/task-<slug>/task_plan.md` (Goal / 验收 / Steps). Do not write `ANL-TARGET.md` under `~/.jj-flow/.workflow/tasks/`.

Each target records independently:

- Mapping of `REQ-*` to target entrypoints, APIs, state, permissions, legacy, and tests.
- `DIRECT`, `ADAPT`, `EXTEND`, `BLOCKED`, `N/A` decisions.
- Minimal file scope, razor exclusions, existing-feature protection, and verification strategy.
- `Locked / Free / Deferred` decisions and Go/No-Go.

Do not generate an executable plan when `MUST`-impacting `Deferred`, `BLOCKED`, or unresolved conflicts exist.

## State boundaries

- Session status stores only orchestration steps, goals, and completion evidence — not requirement body text.
- `.workflow/specs/` stores only delivery-validated, reusable stable rules. Continuous-sync `sync_key`, scope, and exclusion policy may enter arch spec; changing commit cursors and one-shot migration requirements/analysis/plans MUST NOT.
- Raw extraction reports should be referenced or absorbed by the source analyze session; do not create a separate long-lived directory.
- `context-package.json` stores only `snapshot_id`, `handoff_ref`, and necessary summaries; Source Inventory entities exist only under `ANL-SOURCE/requirement-baseline/`.
- Standard discovery and snapshot reuse should be traceable before implement as target Ralph Steps → `ANL-TARGET` id → `BLP-*` → source Ralph / `ANL-SOURCE` id. Fast implement should at least trace target `task_plan.md` → current requirements/docs/session + stable source diff, and fill handoff refs before `HANDOFF_READY`; after implement, continue citing `EXC-*`, `VRF-*`, and `REV-*` from that Ralph.

Maintain family coordination `PLN` from the lead project’s analysis phase. Standard discovery registers formal `PLN` after requirement readiness; fast implement only requires target `EXECUTION_READY` — incomplete family plan MUST NOT block the current target’s independent implement `PLN`. Future projects keep high-level placeholders only and MUST NOT be casually modified by the current task.

For continuous sync, read [continuous-sync.md](continuous-sync.md). Subsequent bug fixes that do not change the product contract reuse the original `BLP-*`; product-behavior changes generate a new blueprint delta. Sync checkpoints reverse from the latest successful `VRF-* / REV-*` artifact chain; do not advance early because analysis finished or the source branch moved.
