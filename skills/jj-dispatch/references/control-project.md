# Control project conventions

## Directories and configuration (user-configurable)

Dispatch **does not require** a local `/portfolio`. Product default state lives under the user home directory; when a project family exists, configuration points at the portfolio.

| Concept | Meaning | Configuration |
| --- | --- | --- |
| **Config file** | global naming and directory SSOT | `$JJ_GLOBAL_CONFIG_DIR/naming.json` (Windows without env may default-discover `/portfolio/config/naming.json`) |
| **portfolio root** | top-level tree of business repos / map / knowledge | `dispatch.portfolio_root` or `JJ_PORTFOLIO_ROOT` (e.g. `/portfolio`) |
| **Controlled projects** | business repos under portfolio, see `project_map` | `project_map` / `JJ_PROJECT_MAP` |
| **Launch cwd** | `$jj-dispatch` from a business-repo session | need not be the control directory |
| **dispatch state root** | stores only manifest / task / receipt (**not** a business worktree) | **`dispatch.control_root` default `~/.jj-flow`**; may be changed e.g. `/portfolio/dispatch-control` |
| **Knowledge base** | Portfolio KB | `dispatch.knowledge_root` / `PORTFOLIO_KB_ROOT` (default may derive `{portfolio_root}/knowledge`) |
| **One delivery wave** | under state root `.workflow/dispatch/<DELIVERY_ID>/` | not a new control git repo per wave |

Starting dispatch from project A or project B is a first-class path; the Agent writes coordination state into the **resolved control_root** (verify with `jj doctor`).

### `naming.json` example (local portfolio)

```json
{
  "schema_version": "jj-flow/naming/1.0",
  "project_map": "/portfolio/map.md",
  "dispatch": {
    "portfolio_root": "/portfolio",
    "control_root": "/portfolio/dispatch-control",
    "knowledge_root": "/portfolio/knowledge"
  }
}
```

Action semantics and gate priority live in parent [SKILL.md](../SKILL.md). This file is the detail source for fields, directories, recovery, and closeout loops. Authoritative state machine: `src/dispatchControlPlane.mjs`; resolution: `src/namingConfig.mjs`.

## dispatch state root (on disk; users rarely open)

| Item | Value |
| --- | --- |
| **Product default** | **`~/.jj-flow`** (user home; create if missing) |
| **Config key** | `naming.json` → `dispatch.control_root` |
| Optional local override | e.g. `/portfolio/dispatch-control` (must be in naming.json or env) |
| Env override | `JJ_DISPATCH_CONTROL_ROOT` |
| CLI override | `--control-root` / `--manifest` |
| Resolve / create | `resolveDispatchControlRoot()` / `ensureDispatchControlRoot()` |
| Diagnostics | `jj doctor` → `paths.control_root` |

## When to read

- Resolve control root / register projects
- Write delivery / responsibility / intake
- Handle `UNKNOWN` / rework / checkpoint fields
- Validate intent bind metadata

## Registering projects

Each project must register at least:

| Field | Meaning |
| --- | --- |
| `id` | stable project id inside the control plane; must not contain `/` |
| `name` | human-readable name |
| `path` | absolute local repo path or stable path reference |
| `codex_project_id` | optional Codex App host project bind; not the same as Git identity |
| `status` | `active`, `paused`, or `retired` |

The control project itself lives in `control_project` and may also appear in `projects`, but must not default as a business target. On DISPATCH, lead/target must be `active`.

## Suggested layout

```text
# Product default control_root (all users, no config)
~/.jj-flow/
  .workflow/dispatch/<DELIVERY_ID>/control-plane.json
  .workflow/tasks/TASK-<DELIVERY_ID>/

# Optional portfolio (requires naming.json portfolio_root / control_root etc.)
/portfolio/
  config/naming.json
  map.md
  knowledge/
  project-a/   # business-repo cwd launch
  dispatch-control/   # if control_root points here
```

- **One delivery wave = one `delivery_id` directory**.
- This wave’s `control-plane.json`: sole source of truth for that delivery’s state.
- Agent / CLI call `ensureDispatchControlRoot()` before first write (default `~/.jj-flow` or configured path).

## Intake and Delivery

Delivery stores only requirement and handoff references (`request_ref`, `ANL-SOURCE`, `BLP/REQ`, `handoff_ref`, verification artifacts). Do not copy PRD body, source diffs, or target verification body text.

Each delivery must explicitly store:

- `origin_project`
- `requirement_owner`
- `lead_project`
- `lead_responsibilities`
- `targets`
- `task_mode` (`standard` | `quick`)

intake object (when `intake.status=REQUIRED`, PREVIEW advance/approve is forbidden):

- the role fields above
- `allow_multi_target` (boolean)
- `task_mode`

Rules:

- lead not in targets: by default generate one development write task into `lead_responsibilities`
- lead already in targets: use that target’s responsibilities
- `reference_implementation` is `null` on first round; write project, commit, snapshot ref/hash, and verification evidence ref only after verification passes

Each target lists role tasks via `responsibilities`. The same project may have multiple `access=write` responsibilities, but they must form a single serial chain via `depends_on`; runtime allows at most one active write per project. Product, test, and Review use `access=read`. Approval records store the full current `task_keys` and approval tasks; after targets or responsibilities change, old approvals are invalid.

Each responsibility includes at least:

```json
{
  "name": "test",
  "access": "read",
  "phase": "verification",
  "attempt": 1,
  "depends_on": [],
  "status": "PENDING"
}
```

- `depends_on` uses full `task_key` within the same delivery
- Dependencies incomplete: task is `deferred`; no thread created
- Retry: increment `attempt` and re-`PREVIEW`/approve
- Late receipts from old attempts must not advance a new attempt

## Recovery rules

1. `PREVIEW` does not write `dispatch_intent` and does not create threads.
2. `DISPATCH` preconditions: approval snapshot matches, project `active`, `REQUIRED_APP_CAPABILITIES` complete.
3. **capability / snapshot / inactive project failure: plane unchanged, no intent write, no create.** Action result is rejection (`BLOCKED`); that does not force rewriting delivery status.
4. Only after preconditions pass write `dispatch_intents` (`PENDING_THREAD`), then call host create.
5. create succeeds but bind write fails: intent → `UNKNOWN`.
6. `RECONCILE` auto-binds only a unique candidate thread; otherwise this call is `BLOCKED` and intent stays `UNKNOWN`.
7. Confirmed thread is unrecoverable: `UNKNOWN` → `BLOCKED` (record reason), increment `attempt`, re-`PREVIEW`/approve; must not reuse the original task key.
8. Target failure updates only that target’s status; does not advance its checkpoint or declare other targets complete.

### Success receipts and checkpoints

| Status | Requirements |
| --- | --- |
| `VERIFIED` | complete current-attempt responsibilities; terminal writer durable Review PASS; target commit == reviewed commit == development `produced_commit` |
| `NO_CHANGE_REQUIRED` | analysis produces `ANL-TARGET`; `difference_ref`, target HEAD, `unresolved=[]`; undispatched development/verification/review marked `SKIPPED`; do not forge Developer commit/VRF/Review |
| `EVIDENCE_READY` | worktree or artifact has evidence but **does not yet meet VERIFIED** (common: uncommitted, review not matched to sha); **user saying “merged” still cannot skip evidence and jump to VERIFIED** |

#### Agent hand-writes plane (user does not run CLI)

User does not operate the control root or run `dispatch-tick`. When the Agent edits `control-plane.json` directly:

1. **Status ceiling**: no `produced_commit` → forbid target/delivery `VERIFIED`; at most `EVIDENCE_READY`.
2. **git self-fetch sha**: write intent and checkpoint via `git rev-parse` / `log -1`; never ask the user for commit.
3. **Real session**: Grok uses the current real session id; multi-target same-session share is allowed; forbid `session-<slug>-YYYYMMDD`.
4. **Land on integration**: prefer task-scoped commit cherry-pick; before whole-feature merge, confirm tip does not contain reverts/history that would wipe other features (negative case: acceptor-tag whole-branch merge to dev wiped aliyun tracker).
5. Optional self-check: `node skills/jj-dispatch/scripts/plane-self-check.mjs --manifest <plane.json>` (for Agent, not a user manual).

When `sync_key` or `handoff_ref` exists, a success checkpoint must also store:

- freshness = `FRESH`
- handoff ref, snapshot ref/hash
- source branch/HEAD, target branch/HEAD
- difference-decision ref, verification evidence

Additionally:

- `VERIFIED` must store reviewed commit
- `NO_CHANGE_REQUIRED` must have `commit` and `reviewed_commit` as `null`
- Old checkpoints cannot backfill fields missing in this round
- `STALE`, missing fields, or handoff mismatch → remain blocked

Full field constraints: [control-plane.schema.json](control-plane.schema.json).

## Reviewer / Developer loop

Bound intents must also record:

- `host_id` (approved: `codex-app` | `grok-build`; trial hosts may use other ids), `agent_name`
- `handle_kind` (`thread` | `session`; Grok must be `session`, value written into the `thread_id` field)
- expected `sandbox_mode`, actual `effective_sandbox_mode`, `sandbox_evidence_ref`
- `environment`, `bound_at`

TOML defaults cannot substitute for runtime sandbox attestation; refuse bind without attestation.

| access | agent | sandbox | environment | workspace (`worktree` field) |
| --- | --- | --- | --- | --- |
| read | `jj-workflow-reviewer` | `read-only` | `project-read` | forbidden (must be null) |
| write (default) | `jj-workflow-developer` | `workspace-write` | `project-branch` | project main path + **named feature branch** (same as same) |
| write (isolation) | same as above | same | `exclusive-worktree` | exclusive worktree, **must hang a named branch tip**; forbid silent detached start |

**workspace selection (EP-20260730 negative case: detached worktree → user “merge onto current branch”)**

1. Default `project-branch`: task branch exists and is checked out / checkable at `project.path` → bind main worktree directly.
2. Only when “same project already has active write”, “main repo has unrelated dirty that must not be polluted”, or “user explicitly requires isolation” → `exclusive-worktree`.
3. Landing rule: code facts must live on a **named branch tip**; do not leave live patches only on a detached tree.

**If uncertain, ask before DISPATCH (hard procedure)**

- After PREVIEW / approval, before CREATE: for each write target output a decision table (intended_branch, current_branch, dirty, proposed_mode, **base / origin_base / behind_count / base_action**, confidence).
- When **CREATE** of a feature branch is required: `git fetch` the integration base first; if `behind_count > 0` use `FETCH_FF` or `CREATE_FROM_ORIGIN`; **forbid** silent branch creation from a stale local tip (EP-20260803).
- `confidence=low` or fact conflict → `NEEDS_CONFIRM`: show judgment, ask user; **before confirm, no intent write, no create_thread**.
- User may change branch or mode; after change, user choice wins.
- Forbid silent choice of detached exclusive worktree or silent switch to a non-task branch.

Review receipts write into `delivery.reviews`:

- result may only be `PASS` or `NEEDS_CHANGES`
- finding: `id`, `severity`, `file`, positive integer `line`, `description`, `status`, `acceptance`
- `delivery.reviews` and corresponding `intent.result.review` must match
- `NEEDS_CHANGES`: first close out still-active old downstream, then `requestRework` to increment developer and downstream attempts and re-approve
- next-round `PASS` must `RESOLVED` or `WAIVED` old OPEN findings

Receipt shape: [task-receipt.schema.json](task-receipt.schema.json). Host allowlist: [host-action-contract.json](host-action-contract.json); contract schema: [host-action-contract.schema.json](host-action-contract.schema.json).

## Schema lookup keys

When reading [control-plane.schema.json](control-plane.schema.json), look up by need; do not default-read the whole file:

| Key | Use |
| --- | --- |
| `intake` | intake gates and multi-target / task_mode |
| `approval` | approval snapshot and task_keys |
| `dispatch_intents` | intent lifecycle and bind metadata |
| `responsibilities` | phase / attempt / depends_on |
| `reviews` | PASS/NEEDS_CHANGES and findings |
| `reference_implementation` | reusable implementation artifact |
| `checkpoint` | sync checkpoint and freshness |
| `task_mode` | quick/standard |

| File | Use |
| --- | --- |
| [control-plane.schema.json](control-plane.schema.json) | manifest field constraints |
| [task-receipt.schema.json](task-receipt.schema.json) | subtask and review receipts |
| [host-action-contract.json](host-action-contract.json) | capability and access-profile truth |
| [host-action-contract.schema.json](host-action-contract.schema.json) | host contract schema |
