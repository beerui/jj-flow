# Grok Dispatch execution flow (Mode S default)

> **Status**: Accepted for skill MVP (Mode S + agent artifacts); Mode W mechanical Implemented (Phase 2b); Host Wave 2 / Mode P still Proposed
> **Host**: `host_id=grok-build`, `handle_kind=session`
> **SSOT location**: this file (`skills/jj-dispatch/references/`); `~/.grok/skills` is only an `install-skill` copy
> **Related**: `host-action-contract.json`, `docs/design-docs/grok-host-adapter.md`, C3 Agent plane-write hard gates,
> `docs/evaluations/2026-07-30-acceptor-tag-color-dispatch.md`

This document defines **how to run `$jj-dispatch` / `/jj-dispatch` on Grok Build**.
The control-plane state machine is unchanged; it only specifies the **Grok host execution layer + skill behavior + artifact conventions**.

---

## 0. Architecture rulings (multi-session? Workflow?)

| Question | Ruling |
| --- | --- |
| Is the protocol “multi-task”? | **Yes**: multiple `task_key` / responsibility |
| Is Grok **default execution** multi-session? | **No**. Default **Mode S**: one coordinator session completes serially |
| Must use Grok **Workflow (Rhai)**? | **No**. Workflow may explore / parallel read-only; **must not** advance control-plane checkpoints or replace receipts |
| When multi-session / Mode P? | When throughput is insufficient and RECONCILE/attestation are already landed (Phase 2c); **not default now** |

```text
User-visible: business-repo natural language → PREVIEW → approve → implement → commit/closeout
Grok default execution: Mode S (single-session serial + project-branch)
Optional acceleration: Mode W (isolation worktree) | Mode P (multi-session, deferred) | Workflow (not truth source)
Truth source: control_root control-plane.json + attestations + receipts + git commit
```

**Do not** forge `session-*-YYYYMMDD` to “look multi-session”.
**Do not** use Workflow run state in place of delivery `revision` / `VERIFIED`.

---

## 1. Problems and negative cases

### 1.1 Done

| Layer | Status |
| --- | --- |
| Control-plane schema / intake / approval / intent | usable |
| `host_id=grok-build` + `handle_kind=session` contract | Phase 1 |
| PREVIEW→approve→project-branch; C3 terminal gates | skill MVP |

### 1.2 Gaps (this spec fills)

| Gap | Harm |
| --- | --- |
| No standard Mode enum | same-session / worktree / fake multi-session mixed |
| No default attestation / receipt on disk | tick has no input; fake VERIFIED |
| DISPATCH before source is committed | wrong/missed target migration |
| No merge-tree risk warning | Revert-branch whole merge to dev wipes other capabilities |

### 1.3 Real negative cases (must keep for regression)

**EP-20260730 acceptor-tag-color (project B → project A / project D)**

1. PREVIEW/DISPATCH before source was committed.
2. Placeholder `session-acceptor-tag-*-20260730`.
3. Coordinator session edited multi repos directly (reasonable MVP, but no standard receipt written).
4. Project C feature containing Revert tracker was whole-merged into `dev`, wiping telemetry.

Upgrade goals: **prevent 1–2 becoming default; fold 3 into Mode S; write 4 into land/merge warnings**.

---

## 2. Goals and non-goals

### Goals

1. Three Grok execution modes and selection rules (§3).
2. Repeatable post-DISPATCH bind / workspace / receipt / advance steps (**user does not run CLI**; Agent persists).
3. Default Mode S; Mode W when isolation is required; Mode P deferred.
4. Versionable evidence; do not forge Codex threads.
5. Share control plane with Codex.

### Non-goals

- Do not implement Grok cloud multi-tenant scheduling.
- Do not auto merge/push/release (`$jj-end` or user-explicit closeout).
- Do not promote subagent / Workflow run id to delivery-level identity (unless BIND is the unique real session).
- Do not raise `max_unattended_level` / close Host Wave 2 because of skill install.
- **Do not require the user** to run `jj dispatch-tick` or other CLI.

---

## 3. Execution modes

```text
Mode S — Session Serial (default, Grok MVP)
  One coordinator session completes each task_key serially.
  handle = real coordinator session id (multiple task_key may share the same id).
  workspace = project-branch @ project.path.
  progress notes execution=same-session | execution_mode=S.

Mode W — Worktree Isolated
  exclusive-worktree, named branch tip, forbid silent detached.
  Only when: main repo has unrelated dirty, same-project active write, or user requires isolation.

Mode P — Parallel Sessions (deferred)
  One child session (or recoverable subagent) per write task_key.
  Only when Mode S is insufficient and attestation/RECONCILE already landed.
```

### 3.1 Selection

| Condition | Mode |
| --- | --- |
| Default / targets ≤3 / small ADAPT | **S** |
| isolation | **W** |
| Large migration and S times out (Phase 2c+) | **P** |
| Same project multi-write | forbid parallel; `depends_on` serial |

### 3.2 vs Codex / Workflow

| Step | Codex | Grok Mode S | Grok Workflow (optional) |
| --- | --- | --- | --- |
| create | CREATE_THREAD | declare/bind **current real session** | may spawn agent; **must not** write plane |
| bind | thread + sandbox att. | session_id + path/git att. file | no BIND eligibility |
| work | worktree tends isolation | **project-branch main repo** | prefer read-only exploration |
| done | receipt | **receipt file + produced_commit** | output must be written into receipt by dispatch Agent |
| checkpoint | tick/CAS | Agent edits plane (follow C3) or optional CLI | **forbid** Workflow directly setting VERIFIED |

> Default workspace: **project-branch** (same as jj-same); exclusive only for isolation.

### 3.3 When Grok capabilities are incomplete

Contract `REQUIRED_APP_CAPABILITIES` as written for Codex is often incomplete on Grok.

**Grok rules (override skill gate 5 absolute BLOCKED):**

- Cannot multi-session create/list → **enter Mode S**; do not fake whole-wave BLOCKED and stall.
- Do not use placeholder sessions to fake BOUND.
- Real session id + attestation file → may BIND (multiple intents may share the same session id).
- Still C3: no `produced_commit` → no VERIFIED.

---

## 4. End-to-end flow (upgraded)

```text
INTAKE (CONFIRMED)
  → PREVIEW (+ branch/workspace table; Grok marks proposed Mode S|W)
  → USER APPROVE
  → PREFLIGHT (§5; on failure do not write intent)
  → DISPATCH
       persist intents PENDING_THREAD
       Mode S: BIND real session + write attestation file
       (do not create fake sessions; do not force Mode P)
  → EXECUTE (same-session serial project-branch)
       write code → minimal verify → write receipt → git commit → produced_commit
  → advance plane (Agent disk write follows C3; optional plane-self-check / dispatch-tick)
  → VERIFIED only when commit-level evidence is complete
  → closeout $jj-end (task-scoped land; watch Revert-tree risk)
```

### 4.1 Extra distribution_prompt fields

| Field | Requirement |
| --- | --- |
| `source_head` | **already committed SHA**; forbid treating working tree alone as true source |
| `source_working_tree_note` | if still dirty, write-task DISPATCH is **blocked** |
| `execution_mode` | `S` \| `W` \| `P` |

### 4.2 BIND attestation (minimum)

Path:

```text
{control_root}/.workflow/dispatch/{DELIVERY_ID}/attestations/{task_key_safe}.json
```

`task_key_safe`: replace `/` with `__`.

```json
{
  "host_id": "grok-build",
  "handle_kind": "session",
  "session_id": "<real-grok-session-uuid>",
  "task_key": "DEL-…/project/development/1",
  "agent_name": "jj-workflow-developer",
  "execution_mode": "S",
  "sandbox_mode": "workspace-write",
  "effective_sandbox_mode": "workspace-write",
  "effective_boundary_source": "declared-coordinator",
  "environment": "project-branch",
  "worktree": "/portfolio/project-a",
  "intended_branch": "feat/…",
  "git_head_at_bind": "<sha|null>",
  "project_path": "/portfolio/project-a",
  "bound_at": "ISO-8601"
}
```

Rules:

- `session_id` must be a real host id (e.g. `019f…-…`); **forbid** `session-<slug>-YYYYMMDD`.
- Mode S: `worktree == project_path`; multi-task may share the same `session_id`.
- Mode W: `environment=exclusive-worktree` and `worktree != project_path`; land on a named branch tip; forbid silent detached HEAD.
- intent.`thread_id` = that `session_id` (do not use `coordinator:…#task` as the sole handle).
- `sandbox_evidence_ref` points to the path of the above file relative to control_root.
- **C4: development *and* review/read responsibilities both write attestation files**; forbid string-only `host:grok-build:session:…` as review `sandbox_evidence_ref`.
- Missing critical fields → refuse BOUND.

read/review example uses the same path rules; `sandbox_mode`/`agent_name` follow access as `read-only` / `jj-workflow-reviewer`; `worktree` may be null.

### 4.3 Receipt

```text
{control_root}/.workflow/dispatch/{DELIVERY_ID}/receipts/{task_key_safe}.json
```

```json
{
  "schema_version": "jj-flow/task-receipt/1.0",
  "task_key": "...",
  "outcome": "DONE|FAILED|NO_CHANGE_REQUIRED",
  "produced_commit": "<sha|null>",
  "changed_files": ["..."],
  "branch": "feat/...",
  "evidence": ["diff|rg|lint"],
  "host_id": "grok-build",
  "session_id": "...",
  "execution_mode": "S",
  "finished_at": "ISO-8601"
}
```

Natural-language “done” must not advance checkpoints.

---

## 5. PREFLIGHT (before writing intent)

| # | Check | On failure |
| --- | --- | --- |
| 1 | approval matches task_keys | BLOCKED |
| 2 | project active; path/git resolvable | BLOCKED |
| 3 | **source migratable truth already committed** (`source_head` includes the fix) | BLOCKED (PREVIEW allowed) |
| 4 | write: `intended_branch` clear or NEEDS_CONFIRM | stop and ask |
| 5 | mode S/W consistent with isolation | stop/BLOCKED |
| 6 | no second active write on same project | BLOCKED |
| 7 | control_root writable for attestation/receipt | BLOCKED |
| 8 | no unhandled UNKNOWN intent | RECONCILE only |
| 9 | **CREATE base freshness (local-master-only)**: after `git fetch`, check `behind_count`; if >0 and clean → `FF_LOCAL_MASTER` then `CREATE_FROM_LOCAL_MASTER`; if already fresh → `CREATE_FROM_LOCAL_MASTER` only; **forbid** `CREATE_FROM_ORIGIN` / stale local tip / silent CREATE from `dev` (EP-20260803 + 2026-08-10) | stop/BLOCKED |

---

## 6. Skill behavior (effective immediately on Grok)

1. **Default Mode S**; do not unapproved parallel multi-repo writes (serial OK).
2. PREVIEW includes branch table + `proposed_mode=S|W`.
3. Source MUST changes uncommitted → **do not write DISPATCH for targets**.
4. intent: `host_id=grok-build`, `handle_kind=session`, `thread_id`=real session; **every BOUND intent (including review) writes attestation file (C4)**.
5. After implementation write receipt; git for `produced_commit`; follow C3 before VERIFIED.
6. User does not run CLI; Agent may optionally use `plane-self-check.mjs` (outputs `integrity_grade` C5) / `dispatch-tick`.
7. After VERIFIED may annotate `remote_closeout` (C6: pushed/merged_to; **does not** block VERIFIED).
8. Closeout `$jj-end`; feature→integration **prefer task-scoped cherry-pick**; when feature history contains Revert-deleted capabilities, must warn tree risk.
9. **Grok Workflow**: assist only; completion reports must be written into receipt/plane by the dispatch Agent.

---

## 7. Implementation waves (jj-flow)

### Phase 2a — Mode S skill MVP (this commit’s goal)

| ID | Item | Status |
| --- | --- | --- |
| G2A-1 | this file + SKILL entry + openai.yaml Mode S | this wave |
| G2A-2 | Agent hand-written attestation/receipt path convention | this wave |
| G2A-3 | PREFLIGHT source commit + fake session ban (skill) | this wave |
| G2A-4 | plane-self-check synthetic session / VERIFIED without commit | already present |
| G2A-5 | commands/jj-dispatch Grok Mode S wording | this wave |
| G2A-6 | optional CLI bind/receipt (**not** user path) | deferred |

### Phase 2b — Mode W

| ID | Item | Status |
| --- | --- | --- |
| G2B-1 | `selectWriteWorkspaceMode` + PREFLIGHT #5 (Mode S vs isolation) | this wave |
| G2B-2 | PREVIEW `workspace_table` with `proposed_mode=S\|W` | this wave |
| G2B-3 | DISPATCH isolation → intent `environment=exclusive-worktree` | this wave |
| G2B-4 | exclusive-worktree create/inspect/cleanup; named branch tip; forbid detached | this wave |
| G2B-5 | attestation `execution_mode=W` cannot bind `project.path` | this wave |

Does **not** close Host Wave 2. Live isolated Grok delivery is still optional evidence, not A2.

### Phase 2c — Mode P

child session 1:1; RECONCILE; forbid same-project parallel write.

### Phase 3 — Real Host trial

`docs/milestones/real-host-trial-grok.json` written and evaluable (NEEDS_CHANGES rework included). Wave 2 still Proposed; do not raise A2. Revert-remerge warning cases remain.

---

## 8. Optional CLI (Agent only; user does not run)

```bash
# Agent self-check only; user does not need this
node skills/jj-dispatch/scripts/plane-self-check.mjs --manifest <plane.json>
# if jj installed and CAS wanted:
jj dispatch-tick --delivery DEL-… --write
```

Without CLI the skill **must** hand-write equivalent attestation/receipt/plane fields.

---

## 9. Acceptance

### 9.1 Phase 2a Done

- [x] This spec is in `skills` SSOT
- [x] Grok default Mode S written into SKILL / default_prompt
- [ ] Next-wave real Grok delivery: PREVIEW→approve→Mode S→receipt→real produced_commit→VERIFIED with plane-self-check OK
- [ ] uncommitted source blocked in live practice

### 9.1b Phase 2b Mode W (mechanical)

- [x] PREVIEW `proposed_mode=S|W` + PREFLIGHT #5 fail-closed
- [x] exclusive-worktree create/bind/cleanup on a named branch tip
- [x] attestation `execution_mode=W` cannot bind `project.path`
- [ ] Live isolated Grok delivery (optional; does **not** close Host Wave 2)

### 9.2 Failure conditions

- Chat state replaces control-plane revision
- Placeholder session id
- Workflow/subagent directly marks VERIFIED
- Same-project parallel write without depends_on

---

## 10. Decision log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-07-30 | Grok defaults Mode S | no mature multi-session API; small live edits already work; aligns with same |
| 2026-07-30 | multi-session/Mode P deferred | fake BIND risk > throughput gain |
| 2026-07-30 | Workflow not checkpoint authority | Rhai runtime ≠ control-plane CAS |
| 2026-07-30 | user does not run CLI | Agent disk write + optional self-check |
| 2026-07-30 | project-branch default | avoid worktree-transfer negative case |
| 2026-07-30 | source must be committed | distribution truth-drift negative case |
| 2026-08-03 | base freshness before CREATE | EP-20260803 stale local master branch create; fetch+ff or from origin |
| 2026-08-10 | **supersede** CREATE path | CREATE **only** from freshened **local** `master` (`FF_LOCAL_MASTER` → `CREATE_FROM_LOCAL_MASTER`); `CREATE_FROM_ORIGIN` removed as primary path; no silent CREATE from `dev` |
| 2026-09-01 | Mode W mechanical | isolation → exclusive-worktree + named branch; PREFLIGHT #5; not Wave 2 / not A2 |
