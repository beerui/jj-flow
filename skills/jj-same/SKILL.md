---
name: jj-same
description: "Port and sync features across same-origin forked projects (not whole-file copy). Triggers: $jj-same, /jj-same, jj-same, 交接, 交接到, 开始交接, 迁, 迁移, 同步, hand off, handoff, port, continuous sync, SYNC-*. User says e.g. “交接到项目B/C” or “hand off to Project B”; agent resolves targets from current Ralph run/handoff (also sessions, commits, legacy snapshots) and implements. Not for task loop (jj-ralph) or multi-project dispatch control (jj-dispatch). Principles: robust / razor / precise / minimal / reuse against each target’s native architecture."
---

# Cross-project precise port

Sync requirement invariants; do not copy source project files. On first port of a feature from A to B, establish a verifiable baseline. Afterwards, process only effective deltas from A since the last successful sync, then apply the narrowest adaptation to B’s real capabilities.

Parent chat is **team-lead** (客服). Conversational `$jj-same` / 「交接到…」 writes **this-round** task docs, researches each target repo, then spawns implementers. **Do not** port business code in this chat. Do not `search_replace` in the parent. **Do not** treat dispatch `distribution_prompt` as the worker spec or 人设提示词. This skill's `references/` are not a startup checklist. Spawn protocol (Announce / Occupancy / Resume / Description / exact paths): [assignment-spawn.md](../jj/references/assignment-spawn.md).

## Conversational path (客服; must not skip)

1. Pin source commit + authorized targets (read-only dispatch approval if a plane exists). This round = the effective delta (e.g. one CSS commit), not the historic DEL Goal. Ralph-handoff-first: lead `.workflow/ralph/<run_id>/.state/run.json` → `run.handoff` (`ready=true` → **do not** redo source analysis; `ready=false` / missing / `STALE` → [Failure recovery](#failure-recovery-if-x--y)). Ambiguous multi-target (e.g.「三端」未点名) → 🔴 **CHECKPOINT**. **Same turn:** pin each target’s Ralph `task-<slug>` ([Write plane](#write-plane--do-not-collapse)).
2. Follow assignment-spawn.md Occupancy before RESEARCH.
3. Write `assignments/ASSIGNMENT-RESEARCH-<target>.md` in **that target’s** Ralph (客服 shape: 来自 team-lead / 读这些 / 交付 / 不要改 / 先确认再开工; **exact paths**). Follow assignment-spawn.md, then Call `spawn_subagent` (`jj-researcher`; missing → `general-purpose`) this turn per target — `cwd` is that repo; exclusive input is that file; **调研 人设提示词 prefix** + file; read-only.
4. From the research report, write `assignments/ASSIGNMENT-HANDOFF-<target>.md`. Before coding: 🔴 branch-purpose + CREATE freshness ([branch-purpose-preflight.md](references/branch-purpose-preflight.md)); `EXECUTION_READY` unmet → 🛑 **STOP**. LITE vs FULL is one decision ([LITE vs FULL](#lite-vs-full)). Follow assignment-spawn.md, then Spawn `jj-implementer` (missing → `general-purpose`) with the **实施 人设提示词 prefix** + that file only.
5. After each target reports: update that repo’s Ralph. If a delivery exists and Git has a ≥7-char sha, write `produced_commit` / receipt — do not leave the previous wave’s dirty receipt. User closeout = [happy-path template](references/happy-path.md#user-visible-closeout-summary-only) only. Claim complete only at `HANDOFF_READY`. Continuous sync (`SYNC-*`) restores the last checkpoint; do not invent HEAD-as-baseline.

Missing `run.handoff`: still write this-round assignments from the source commit/diff. Empty `run.handoff` after a landed sha is not a stop.

Paste the matching **人设提示词 prefix** into every spawn (调研 vs 实施; never mix 调研+实施 in one paste). Spawn with 人设提示词 + `ASSIGNMENT-HANDOFF` (or RESEARCH).

### 调研 人设提示词 prefix (paste into RESEARCH spawn)

```
你不是 team-lead。你是目标仓调研执行人。默认中文（简体）。
只读独占派单文件。不要读父会话聊天。不要打开 skill references/。
第一条回复必须是一句话确认：(1) 对目标的理解 (2) 计划的第一步。
只读。不要改业务代码。不要 Start broad。不要全仓 grep/list_dir。不要再 spawn。
完成后向 team-lead 短句汇报（路径对照 / 保留项 / 清单）。空闲不等于完成。
```

### 实施 人设提示词 prefix (paste into HANDOFF spawn)

```
你不是 team-lead。你是目标仓实施执行人。默认中文（简体）。
只读独占派单文件。不要读父会话聊天。不要打开 skill references/。
第一条回复必须是一句话确认：(1) 对目标的理解 (2) 计划的第一步。打包了多条则逐条枚举。
只改「交付」列出的文件。不要 Start broad。不要全仓 grep/list_dir。不要再 spawn。不要 commit。
完成后向 team-lead 短句汇报（做了什么 / 路径 / 证据）。空闲不等于完成。
```

## Global map (read-only here)

Product default: `~/.jj-flow/map.md`. Missing home → `jj home init`, then continue. Unindexed cwd does not block authorized port. Map join / KB bootstrap → `$jj-init`.

## LITE vs FULL

| Use **LITE** (default) | Use **FULL** |
| --- | --- |
| Near-isomorphic, few files, handoff `ready=true` | Clear ADAPT / multi-file / continuous-sync |

## Dual gates

`EXECUTION_READY` (may code) vs `HANDOFF_READY` (may claim complete). Definitions, caveats, `EXECUTE_NOW`, five criteria, and user closeout → [happy-path.md](references/happy-path.md).

## How users say it

- `交接到 项目B` / `交接到 项目B 项目C` / `开始交接` / `提交并交接三端` / `继续迁项目C`
- English: “hand off to Project B”, “start handoff”, “continue porting Project C”
- Agent self-resolves lead Ralph run, `handoff_ref`, target roles, source commit; **do not** require `交接=@...` / `from-ralph=...`.

## Write plane (do not collapse)

same **ports into** a target Ralph; it does not replace Ralph and does not own dispatch scaffold.

| Layer | Where | What |
| --- | --- | --- |
| **源** | lead repo `.workflow/ralph/<run_id>/` | `run.handoff` + Goal；不要重做源分析 |
| **实施** | **each target repo** `.workflow/ralph/task-<slug>/` | full Ralph: `task_plan.md` (Goal / 验收 / Steps + ADAPT) + `progress.md` + `findings.md` + `assignments/` (RESEARCH / HANDOFF) + `.state/run.json` |
| **统筹** | `~/.jj-flow` (`control_root`) | plane / 回执 / `TASK-*/task.md` **index only** — never ANL body or port work |

- Slug: with a delivery, first resume the target’s **live** Ralph (same session thread or the only review-slice — same rule as dispatch `reuse-sibling`). Else use dispatch `task-<slug>` (e.g. `DEL-enter-form-h5-20260904` → `task-enter-form-h5`). Without control, reuse the lead `run_id` or a feature `task-<slug>`.
- Missing target Ralph → write that repo’s `.workflow/ralph/task-<slug>/` documents (`task_plan.md` / `progress.md` / `findings.md` / `index.md`). Never `jj ralph init` CLI. Do **not** call `ensureDispatchRalphRuns` (dispatch already did, or there is no control plane). Never init `task-*-review-fix` as a new requirement.
- `ANL-TARGET` may remain a plane / ledger **id**; the body is the target `task_plan.md`. Legacy scratch / csv-wave / leftover `ANL-*` `PLN-*` are **read-only** — do not create a second implement home.
- Do **not** write `ANL-LEAD.md` / `ANL-TARGET.md` under `~/.jj-flow/.workflow/tasks/TASK-*`.

## Failure recovery (if X → Y)

Trigger → first fix → still failed. No silent workarounds. CREATE grammar → [branch-purpose-preflight.md](references/branch-purpose-preflight.md).

| Trigger | First fix | Still failed → |
| --- | --- | --- |
| No lead `.workflow/ralph/<run_id>/.state/run.json` (and no leftover `tasks/` or `RALPH-*/run.json`) or no `handoff_ref` | Source commit/diff + this-round ASSIGNMENT-RESEARCH / ASSIGNMENT-HANDOFF; or legacy snapshot / session evidence / commit range | Ask user for source commit + targets; `BLOCKED` until pinned. Empty `run.handoff` after a landed sha is not a stop |
| Target repo has no `.workflow/ralph/task-<slug>/` | Write plane: resume live sibling or write `task-<slug>/` documents **in that repo** | 🛑 **STOP** coding; never invent ANL body under `~/.jj-flow` |
| `run.handoff.ready=false` and only uncommitted source work | Commit source (if user allows), refresh handoff, re-read `ready` | Port only after stable commit/diff; else `BLOCKED` |
| Handoff `STALE` / source HEAD or requirement hash changed | `REFRESH`: re-read only changed sources; pin new stable commit; successor handoff if needed | 🛑 **STOP** target business code until new commit pinned |
| Branch purpose ≠ task purpose (e.g. release train) | Switch/create correct feat branch from freshened local `master` | 🛑 **STOP**; need **written** override that this train **is** the land line |
| CREATE needed / base freshness | `git fetch` then `FF_LOCAL_MASTER` → `CREATE_FROM_LOCAL_MASTER` when behind+clean; else CREATE from fresh local `master` only | Dirty/divergent or `dev`/`develop`/remote tip as primary: 🛑 **STOP**; no `reset --hard` without **written** approval |
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

`2×3` matrix and port directions → [project-family.md](references/project-family.md). With/without control rules → [happy-path.md](references/happy-path.md#control-plane-boundary). Change only explicitly authorized targets.

## Evidence + artifacts

Evidence entry points → [workflow-core.md](references/workflow-core.md#evidence-entry-points). Canonical paths and labels (`DIRECT` / `ADAPT` / `EXTEND` / `BLOCKED` / `N/A`) → [artifact-routing.md](references/artifact-routing.md).

## Hard constraints

- 🔴 branch-purpose + CREATE freshness before coding → [branch-purpose-preflight.md](references/branch-purpose-preflight.md); unmet `EXECUTION_READY` / `HANDOFF_READY` → [Failure recovery](#failure-recovery-if-x--y).
- Conversational: this-round `ASSIGNMENT-RESEARCH` / `ASSIGNMENT-HANDOFF` + matching **人设提示词 prefix**; spawn per assignment-spawn.md; no parent port.
- User closeout = happy-path template only.
- MUST NOT: whole-branch cherry-pick / whole-file overwrite (unless isomorphic with no target-only logic); unauthorized repos; private `.workflow/jj-same/`; port/ANL body under `control_root` `TASK-*`; leftovers as implement home when a target Ralph exists; fake dispatch approval; chat summaries as Git evidence; `distribution_prompt` as worker spec or 人设提示词; show “five gates” / slogan conclusions to the user; claim all-targets complete while any authorized target is still `BLOCKED`.
- Do not commit/push without explicit request.

## References

| File | Purpose |
| --- | --- |
| [happy-path.md](references/happy-path.md) | Main path, dual gates, self-check criteria, user-visible summary, control-plane boundary |
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
