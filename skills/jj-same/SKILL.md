---
name: jj-same
description: "Port and sync features across same-origin forked projects (not whole-file copy). Triggers: $jj-same, /jj-same, jj-same, 交接, 交接到, 开始交接, 迁, 迁移, 同步, hand off, handoff, port, continuous sync, SYNC-*. User says e.g. “交接到项目B/C” or “hand off to Project B”; agent resolves targets from current Ralph run/handoff (also sessions, commits, legacy snapshots) and implements. Not for single-repo loop (jj-ralph) or multi-project dispatch control (jj-dispatch). Principles: robust / razor / precise / minimal / reuse against each target’s native architecture."
---

# Cross-project precise port

Sync requirement invariants; do not copy source project files. On first port of a feature from A to B, establish a verifiable baseline. Afterwards, process only effective deltas from A since the last successful sync, then apply the narrowest adaptation to B’s real capabilities. Details: [references/happy-path.md](references/happy-path.md), [references/workflow-core.md](references/workflow-core.md).

## Happy path (In → action → Out)

| # | In | Action | Out / next gate |
| --- | --- | --- | --- |
| 1 | Session / cwd | Ralph-handoff-first: `RALPH-*/run.json` → `artifact_refs.handoff_ref` / `run.handoff` (mirror `.../handoff/handoff.json` ok). `ready=true` → **do not** redo source analysis | `handoff` pinned **or** [Failure recovery](#failure-recovery-if-x--y) |
| 2 | User speech (+ optional control manifest) | Parse target roles; with control, **read-only** approved `targets` / `task_key`. Ambiguous multi-target (e.g.「三端」未点名) → 🔴 **CHECKPOINT**: confirm targets before coding | Authorized target set |
| 3 | Current branch + task purpose | 🔴 **CHECKPOINT · branch purpose + CREATE base freshness** → [branch-purpose-preflight.md](references/branch-purpose-preflight.md) (`behind_count` / G6). Mismatch or stale base → 🛑 **STOP** | Work branch GO |
| 4 | Change shape | `port_profile.mode` via [LITE vs FULL](#lite-vs-full) (single decision point) | `LITE` or `FULL` |
| 5 | Auth + stable source commit/diff + requirements + target call chain + no MUST-`UNRESOLVED` | 🔴 **CHECKPOINT · `EXECUTION_READY`**. Unmet → 🛑 **STOP** business code (`BLOCKED` / caveat) | May code |
| 6 | Narrowest plan | Same turn: business code + focused tests on authorized targets only; not plan-status-only closeout | Diff + tests |
| 7 | Diff | Layered verification: static/focused tests; runtime = user confirm or evidenced `N/A` | Verify record |
| 8 | Final diff | Internal five criteria only (**do not** show to user); artifacts under typed `.workflow/`; **forbid** `.workflow/jj-same/` | Self-check done |
| 9 | Facts from 6–8 | User closeout = [template](#user-visible-closeout) only; no five-gates / slogan tables | User summary |
| 10 | Verify + acceptance | 🔴 **CHECKPOINT · `HANDOFF_READY`** before `READY_FOR_HANDOFF` / `COMPLETED` / advancing sync checkpoints. Unmet → 🛑 **STOP** claiming complete | Handoff claim or hold |
| 11 | `sync_key` scenario | Continuous sync: restore checkpoint → [continuous-sync.md](references/continuous-sync.md) | Delta plan |

### Global map (read-only here)

Product default: `~/.jj-flow/map.md`. Missing home → `jj home init`, then continue. Unindexed cwd does not block authorized port. Map join / KB bootstrap → `$jj-init`.

Full prose path + control-plane boundary → [happy-path.md](references/happy-path.md).

### LITE vs FULL

| Use **LITE** (default) | Use **FULL** |
| --- | --- |
| Near-isomorphic, few files, handoff `ready=true` | Clear ADAPT / multi-file / continuous-sync |

### Dual gates

| Gate | Role |
| --- | --- |
| `EXECUTION_READY` | May code now |
| `HANDOFF_READY` | May claim handoff complete and advance checkpoints |

- Missing source review/UAT / incomplete family plan → delivery caveat; **does not** block coding (hard blocks → [happy-path.md](references/happy-path.md)).
- User “start migration / implement / go” → `EXECUTE_NOW`: after fact check, next action = business code or focused tests.
- Five criteria (robust / razor / precise / minimal / reuse) = **agent-internal only** (definitions in happy-path).

### User-visible closeout

Use this skeleton (facts only; omit empty lines; one target block per project):

```text
## <target project> summary
- Decision: DIRECT | ADAPT | EXTEND | BLOCKED | N/A
- Changes: path + one-line behavior
- Verification: what ran / skipped / waiting on user?
- Git: branch @ tip; committed / uncommitted
- Next: (optional one line)
```

**Do not** attach five-gate checklists, slogan recaps, or long artifact dumps unless user asks or `BLOCKED` needs evidence.

## How users say it

- `交接到 项目B` / `交接到 项目B 项目C` / `开始交接` / `提交并交接三端` / `继续迁项目C`
- English: “hand off to Project B”, “start handoff”, “continue porting Project C”
- Agent self-resolves lead Ralph run, `handoff_ref`, target roles, source commit; **do not** require `交接=@...` / `from-ralph=...`.

## Ralph handoff (pointer)

- Resolve: session `RALPH-*/run.json` → `handoff_ref` → primary `run.handoff` (optional file mirror).
- `ready=true` → port; `ready=false` / missing / `STALE` → [Failure recovery](#failure-recovery-if-x--y).
- Mode: [LITE vs FULL](#lite-vs-full) only — do not restate elsewhere.

## Failure recovery (if X → Y)

Trigger → first fix → still failed. No silent workarounds.

| Trigger | First fix | Still failed → |
| --- | --- | --- |
| No `RALPH-*/run.json` or no `handoff_ref` | Legacy snapshot / session evidence / commit range (`extract_session_evidence.py`, `collect-port-evidence.mjs`) | Ask user for source commit + targets; `BLOCKED` until pinned |
| `run.handoff.ready=false` and only uncommitted source work | Commit source (if user allows), refresh handoff, re-read `ready` | Port only after stable commit/diff; else `BLOCKED` |
| Handoff `STALE` / source HEAD or requirement hash changed | `REFRESH`: re-read only changed sources; pin new stable commit; successor handoff if needed | 🛑 **STOP** target business code until new commit pinned |
| Branch purpose ≠ task purpose (e.g. release train) | Switch/create correct feat branch from freshened local `master` | 🛑 **STOP**; need **written** override that this train **is** the land line |
| CREATE needed and `behind_count > 0`, local `master` clean | `git fetch` → `FF_LOCAL_MASTER` → `CREATE_FROM_LOCAL_MASTER` (`checkout -b <feat> master`) | Dirty/divergent: 🛑 **STOP**; no `reset --hard` without **written** approval |
| CREATE base would be `dev`/`develop` or remote tip as primary | Refuse; use local `master` after fetch/ff | Override only if user writes it; never silent |
| `EXECUTION_READY` unmet | Fill missing facts; plan/evidence-only | 🛑 **STOP** business code; `BLOCKED` |
| Target lacks isomorphic surface (ADAPT/EXTEND) | Narrowest target-native plan; set `FULL` when multi-file/ADAPT | Unauthorized scope → `BLOCKED` / ask scope |
| Multi-target: some pass, some fail (e.g. B ok, C fail) | Per-target status; successful targets may reach `HANDOFF_READY`; failed stay `BLOCKED` + reason | **Never** claim family/all-targets complete because one sibling succeeded |
| User target ∉ control-plane approved `targets` | Read-only manifest; refuse scope expand | User must change approval or shrink request |
| Focused tests fail after port | Fix in-scope only (razor); re-run | Do not claim `HANDOFF_READY`; report failure + next |
| Runtime verification required, user not confirmed | Pending; ship static/focused evidence only | `HANDOFF_READY` only with pass or evidenced `N/A` |
| Continuous sync: missing `sync_key` / checkpoint | Discover last successful baseline from family plan / prior artifacts | Ask which baseline; do not invent HEAD-as-baseline |
| Commit/push without explicit user request | Do not commit/push | Wait for explicit “commit / push / 提交” |
| Current repo not in `~/.jj-flow/map.md` | Continue authorized port unindexed | Join / bootstrap → `$jj-init` |

Hard-block catalog → [happy-path.md](references/happy-path.md), [branch-purpose-preflight.md](references/branch-purpose-preflight.md), [handoff-snapshot.md](references/handoff-snapshot.md).

## Project family + control-plane boundary

`2×3` matrix (Project A/B/C × frontend / admin) → [project-family.md](references/project-family.md). Same row defaults to sibling; frontend/admin do not auto-sync. Change only explicitly authorized targets.

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

Shortest path: fast implement / standard discovery / snapshot reuse. Canonical paths → [artifact-routing.md](references/artifact-routing.md). Sufficient facts beat artifact count; fill handoff artifacts before `HANDOFF_READY`. Labels: `DIRECT / ADAPT / EXTEND / BLOCKED / N/A`.

## Hard constraints / MUST NOT

- MUST: 🔴 branch-purpose preflight before coding; **before CREATE**, `git fetch`, ff-only freshen **local** `master` when behind+clean (`FF_LOCAL_MASTER`), then `checkout -b <feat> master` only (`CREATE_FROM_LOCAL_MASTER`; default `create_from=master` local); code only when `EXECUTION_READY`; claim complete only when `HANDOFF_READY`; user closeout = [template](#user-visible-closeout) only.
- MUST NOT: whole-branch cherry-pick / whole-file overwrite (unless isomorphic with no target-only logic); `CREATE_FROM_ORIGIN` as primary path; silent CREATE from `dev`/`develop`; silent CREATE from stale local base when `behind_count > 0`; `reset --hard` or rewrite dirty/divergent local `master` without **written** approval; change unauthorized repos; private `.workflow/jj-same/`; fake dispatch approval without control; chat summaries as Git/source evidence; **show “five gates” / slogan conclusions to the user**; claim all-targets complete when any authorized target is still `BLOCKED`.
- Do not commit/push without explicit request; do not continuously watch the source repo.
- 🛑 **STOP** on purpose mismatch, unmet `EXECUTION_READY`, or unmet `HANDOFF_READY` — recover via [Failure recovery](#failure-recovery-if-x--y); never skip gates silently.

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

```text
$jj-same 会话=019f... 当前需求=保留密码入口 源=项目A 目标=项目B,项目C
$jj-same 准备交接 会话=019f... 源提交=c0c360f9d 功能=密码更新提醒
$jj-same 交接=@…/handoff-snapshot.yaml 当前项目=项目B 开始迁移
$jj-same 同步 SYNC-silence-login，检查 A 从上次成功基线到 HEAD 的更新并同步到 B
$jj-same 源修改完成，列出可同步项目并询问立即同步还是延期
```
