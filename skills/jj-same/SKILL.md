---
name: jj-same
description: Port and sync features across same-origin forked projects. Users speak natural language such as “hand off to Project B / Project C”; the agent resolves targets from the current session’s Ralph run/handoff and implements. Also works from sessions, commits, or legacy handoff snapshots. Apply robust / razor / precise / minimal / reuse principles to fit each target’s native architecture.
---

# Cross-project precise port

Sync requirement invariants; do not copy source project files. On first port of a feature from A to B, establish a verifiable baseline. Afterwards, process only effective deltas from A since the last successful sync, then apply the narrowest adaptation to B’s real capabilities. Details: [references/happy-path.md](references/happy-path.md), [references/workflow-core.md](references/workflow-core.md).

## Happy path checklist

1. Ralph-handoff-first: current `RALPH-*/run.json` → `handoff_ref` / `run.handoff`; when `ready=true`, do not redo source analysis.
2. Parse target roles from user speech; with control plane, **read-only** approved `targets` / `task_key`.
3. Branch purpose + **CREATE base freshness** preflight (hard gate) → [branch-purpose-preflight.md](references/branch-purpose-preflight.md) (includes `behind_count` / G6).
4. Default `port_profile.mode=LITE`; use FULL only for clear ADAPT / multi-file / continuous-sync work.
5. Confirm **`EXECUTION_READY`** (authorization + stable source commit/diff + converged requirements + target call chain + no `MUST`-impacting `UNRESOLVED`).
6. After the narrowest plan, change business code and focused tests **in the same turn**; do not close out by only updating plan/family status.
7. Layered verification: static/focused tests; runtime defaults to user confirmation or `N/A` (see workflow-core).
8. Self-check the final diff (five criteria are **internal/process only — do not show the checklist or slogans to the user**); artifacts go under typed `.workflow/` directories; **forbid** `.workflow/jj-same/`.
9. **To the user**: short factual closeout summary (what changed / decisions / files / verification / commit status); **do not** output “five gates” or “robust/razor/…” itemized tables.
10. Write `READY_FOR_HANDOFF / COMPLETED` and advance sync checkpoints only after **`HANDOFF_READY`**.
11. Continuous sync: restore `sync_key` + checkpoint → [continuous-sync.md](references/continuous-sync.md).

Full numbered path and control-plane boundary table → [happy-path.md](references/happy-path.md).

## How users say it

Quoted natural-language examples (user utterances; Chinese forms are common):

- `交接到 项目B` / `交接到 项目B 项目C` / `开始交接` / `提交并交接三端` / `继续迁项目C`
- English equivalents: “hand off to Project B”, “start handoff”, “continue porting Project C”
- Agent self-resolves lead Ralph run, `handoff_ref`, target roles, source commit; **do not** require the user to fill `交接=@...` / `from-ralph=...`.

## Ralph handoff first

1. Current session `RALPH-*/run.json` → `artifact_refs.handoff_ref`.
2. Primary entry: `run.handoff`; optional mirror `.../handoff/handoff.json`.
3. `ready=true`: port targets directly; **do not** redo source analysis.
4. `ready=false` and only uncommitted work: commit source first, refresh handoff, then port.
5. Without Ralph handoff, fall back to legacy snapshot / session evidence paths.
6. Default `LITE`; FULL only for clear ADAPT / multi-file / continuous sync.

## Dual gates + user-visible output

| Gate | Role |
| --- | --- |
| `EXECUTION_READY` | May code now |
| `HANDOFF_READY` | May claim handoff complete and advance checkpoints |

- Missing source review/UAT, family plan still incomplete → default caveat, **does not** block coding; hard blocks in [happy-path.md](references/happy-path.md).
- User “start migration / implement / go” → `EXECUTE_NOW`: after fact check, next action must be business code or focused tests.
- Five criteria (robust / razor / precise / minimal / reuse) = **agent self-check only**, defined in happy-path; **do not** recite them item-by-item in the user reply or list “five-gate conclusions”. Closeout is facts only.

## Project family + control-plane boundary

`2×3` matrix (Project A/B/C × frontend / admin); paths and directions → [project-family.md](references/project-family.md). Same row defaults to sibling; frontend/admin do not auto-sync. Change only explicitly authorized targets.

| Scenario | Rule |
| --- | --- |
| With control | **Read-only** manifest-approved roles and `targets`/`task_key`; do not invent control tasks |
| Without control | Compatible with `source=A targets=B,C`; **family plan ≠ dispatch approval** |

## Evidence entry points (pointers)

- **Session**: `read_thread` / sessions JSONL; `python -X utf8 scripts/extract_session_evidence.py --thread-id '…'`
- **Branch/commit**: `merge-base..feature-ref`; `node scripts/collect-port-evidence.mjs --source-repo … --source-base … --source-ref … --target-repo …`
- **Mixed**: session (why) × branch (what changed) × current requirement (final) × target source (minimal how)
- **handoff_ref**: freshness + `REUSE/REFRESH/…` → [handoff-snapshot.md](references/handoff-snapshot.md)

Long scripts and prose → [workflow-core.md](references/workflow-core.md#evidence-entry-points).

## Artifact routing

Pick the shortest path from input: fast implement / standard discovery / snapshot reuse. Canonical paths and registration → [artifact-routing.md](references/artifact-routing.md). Sufficient facts beat artifact count; fill handoff artifacts before `HANDOFF_READY`. Decision labels: `DIRECT / ADAPT / EXTEND / BLOCKED / N/A`.

## Hard constraints / MUST NOT

- MUST: branch-purpose preflight before coding; **before CREATE**, `git fetch` the integration base so the new branch tip is not behind `origin/<base>` (default `origin/master`; allow ff-only or `checkout -b` from origin); change business code only when `EXECUTION_READY`; claim handoff complete only when `HANDOFF_READY`; closeout to the user is a **short summary only**.
- MUST NOT: whole-branch cherry-pick / whole-file overwrite (unless isomorphic with no target-only logic); silently create a branch from a stale local base tip when `behind_count > 0`; `reset --hard` or unconfirmed rewrite of dirty/divergent local `master`; change unauthorized repos; private `.workflow/jj-same/`; fake dispatch approval without control; chat summaries as substitutes for Git/source evidence; **show “five gates” checklists/slogan conclusions to the user**.
- Do not commit/push without explicit request; do not continuously watch the source repo.

## References

| File | Purpose |
| --- | --- |
| [happy-path.md](references/happy-path.md) | Main path, dual gates, self-check criteria, user-visible summary |
| [workflow-core.md](references/workflow-core.md) | Lifecycle, evidence, artifact detail, workflows 1–7, delivery summary format |
| [project-family.md](references/project-family.md) | Roles and paths |
| [branch-purpose-preflight.md](references/branch-purpose-preflight.md) | Branch purpose hard gate |
| [artifact-routing.md](references/artifact-routing.md) | Artifact routing |
| [handoff-snapshot.md](references/handoff-snapshot.md) | Handoff snapshot |
| [continuous-sync.md](references/continuous-sync.md) | Continuous sync |
| [silence-account-case.md](references/silence-account-case.md) | Silence-account case study |

## Invocation examples

```text
$jj-same session=019f... current_requirement=keep password entry source=ProjectA targets=ProjectB,ProjectC
$jj-same prepare-handoff session=019f... source_commit=c0c360f9d feature=password-update-reminder
$jj-same handoff=@…/handoff-snapshot.yaml current_project=ProjectB start_migration
$jj-same sync SYNC-silence-login, check A updates from last successful baseline to HEAD and sync to B
$jj-same source changes done, list syncable projects and ask sync-now vs defer
```

Natural-language user forms (keep as-is when the user speaks them):

```text
$jj-same 会话=019f... 当前需求=保留密码入口 源=项目A 目标=项目B,项目C
$jj-same 准备交接 会话=019f... 源提交=c0c360f9d 功能=密码更新提醒
$jj-same 交接=@…/handoff-snapshot.yaml 当前项目=项目B 开始迁移
$jj-same 同步 SYNC-silence-login，检查 A 从上次成功基线到 HEAD 的更新并同步到 B
$jj-same 源修改完成，列出可同步项目并询问立即同步还是延期
```
