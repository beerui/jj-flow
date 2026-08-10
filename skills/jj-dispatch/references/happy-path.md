# jj-dispatch Happy Path

Main path and gate index. Agent plane-write rules → [agent-write-plane.md](agent-write-plane.md); fields/directories → [control-project.md](control-project.md).

## User-visible main line

```text
Read TASK-ID main title -> PREVIEW (incl. branch/workspace decision)
  -> user approves task_keys
  -> (if branch/workspace still uncertain) show judgment and ask -> user confirms
  -> DISPATCH -> tick/resume
```

Exceptions and gates **outrank** the main line.

**Confirm gate (`NEEDS_CONFIRM`)**: when branch/workspace/intake is uncertain or `confidence=low`, stop and ask the user. **Before user confirm, do not write DISPATCH intent** and do not create_thread (确认前不写 intent / 确认前不 DISPATCH).

## Gates 1–8 (compact)

1. **Missing intake** (`intake.status=REQUIRED` or required fields unconfirmed) → return only `INTAKE_REQUIRED`; no PREVIEW advance, no APPROVE, no DISPATCH, no create_thread.
2. **Any `dispatch_intent` with `status=UNKNOWN`** → only `RECONCILE` or manual `BIND_THREAD`; never create_thread / write a second intent for the same `task_key`.
3. **No explicit approval of this round's task_keys** → `PREVIEW` (`action=PREVIEW`, `status=PREVIEW_ONLY`); read-only; no intent write; no create_thread.
4. **Write-responsibility target branch / workspace mode uncertain** → output self-check decision table first and confirm with the user; no DISPATCH / create_thread / intent write until confirmed; user may override `project-branch` / `exclusive-worktree` / target branch name.
5. **Approved but missing REQUIRED_APP_CAPABILITIES** → Codex App: DISPATCH rejected (`ok=false`, `BLOCKED`), plane unchanged, no intent write. **Grok Build**: do not fake whole-wave BLOCKED solely for “no multi-session create/list”; **degrade to Mode S** (single-session serial + project-branch), see [grok-dispatch-execution.md](grok-dispatch-execution.md). Still forbid forged capabilities or synthetic sessions faking BOUND.
6. **Approved, branch/workspace confirmed (or unambiguous), and (Codex capabilities complete / or Grok Mode S)** → DISPATCH: persist intent(`PENDING_THREAD`) first → Codex: `CREATE_THREAD` → `BIND_THREAD`; Grok: **Mode S** bind current real session id (shared across task_keys allowed) + write attestation file.
7. **Receipt present or need to advance already-bound tasks** → tick/resume (with CLI: `jj dispatch-tick`; **without CLI, Agent edits plane directly**, must follow [agent-write-plane.md](agent-write-plane.md)).
8. **Mark target/delivery VERIFIED** (or development DONE) → first satisfy terminal evidence (git commit / review / real session id + **attestation file**). If not met: at most `EVIDENCE_READY` / `RUNNING`; never write VERIFIED because the user said “done / merged”. **T-task-result-sync**: in the same plane write that promotes VERIFIED, refresh task dir `result.md` / `progress.md`; forbid plane VERIFIED while result still says EVIDENCE_READY.

When a `TASK-ID` exists, recover index and manifest first (with CLI: `jj task context/status`; without CLI: read task dir and plane under control_root), then apply the gates above.

## real-host acceptance

**Status: PENDING** — see repo [docs/milestones/real-host-acceptance.md](../../../../docs/milestones/real-host-acceptance.md).

- Semi-real host trial / skill install **cannot** raise A2, and **cannot** verbally claim VERIFIED in place of this milestone.
- **VERIFIED must bind attestation file evidence** (`sandbox_evidence_ref` → `attestations/<task_key_safe>.json`, including review/read); forbid string-only `host:…:session:…` or chat closeout.

## Branch and workspace decision table (write responsibilities, before DISPATCH)

| Column | Content |
| --- | --- |
| project / path | registered path |
| intended_branch | task/lead-derived/user-specified feature branch |
| current_branch @ path | `git branch --show-current` (main worktree) |
| dirty | whether there are dirty changes **not belonging to this task** |
| active_write | whether the same project already has an active write intent |
| proposed_mode | `project-branch` (default) or `exclusive-worktree` |
| base / origin_base | integration base ref and tip (default **local** `master` / `origin/master`) |
| behind_count | `git rev-list --count <base>..<remote>/<base>` (must `git fetch` before CREATE) |
| base_action | `FF_LOCAL_MASTER` / `CREATE_FROM_LOCAL_MASTER` / `NEEDS_CONFIRM` / `BLOCKED` |
| create_from | **local** `master` only (never `origin/master` as primary) |
| confidence | `high` / `low` |
| action | `READY` or `NEEDS_CONFIRM` |

**CREATE base freshness (local-master-only; EP-20260803 + 2026-08-10)**: when intended does not exist and must be created from base, **CREATE only from freshened local `master`** (`git checkout -b <feat> master`). Default `base=master`, `create_from=master` (local). Sequence:

1. `git fetch origin master`
2. If `behind_count > 0` and local master is **clean + ff-able** → `FF_LOCAL_MASTER`: `git checkout master` + `git merge --ff-only origin/master`
3. Then `CREATE_FROM_LOCAL_MASTER`: `git checkout -b <feat> master`
4. If already `behind_count = 0` and not diverged → `CREATE_FROM_LOCAL_MASTER` only

**Forbidden as primary path**: `CREATE_FROM_ORIGIN` (`checkout -b` from `origin/master` while leaving local master stale); silent CREATE from `dev`/`develop`; silent `checkout -b` from a stale local tip when `behind_count > 0`; `reset --hard` on dirty/diverged local master without **written** user approval. Aligns with jj-same [branch-purpose-preflight](../../jj-same/references/branch-purpose-preflight.md) checks 6–10 / G6.

**When you must stop and ask (`NEEDS_CONFIRM`)**: target branch missing/conflicting; main worktree branch ≠ intended and cannot safely fast-forward; isolation is unclear; user previously asked to “merge onto current branch” or a worktree-transfer correction occurred; **local base is dirty/diverged and cannot safely ff while CREATE is required**; **cannot fetch and cannot prove base is fresh**.

Before user confirmation: **no** DISPATCH, **no** create_thread, **no** write of `dispatch_intent`.

## Recommended delivery status chain

```text
DRAFT -> PREVIEW_ONLY -> APPROVED -> DISPATCHING -> RUNNING
       -> EVIDENCE_READY -> VERIFIED
Any stage may enter delivery BLOCKED; bind anomaly intent -> UNKNOWN -> RECONCILE
```

## Other references

| File | When to read |
| --- | --- |
| [agent-write-plane.md](agent-write-plane.md) | Agent hand-writes plane / no-CLI closeout |
| [control-project.md](control-project.md) | Directories, intake, fields, Review loop |
| [grok-dispatch-execution.md](grok-dispatch-execution.md) | Grok Mode S/W/P |
| [rollback.md](rollback.md) | Rollback / reopen / fake VERIFIED |
| [host-action-contract.json](host-action-contract.json) | capability and host actions |
| [task-receipt.schema.json](task-receipt.schema.json) | Receipt shape |
