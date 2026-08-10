---
name: jj-dispatch
description: "Multi-project dispatch control plane: PREVIEW → approve task_keys → DISPATCH → tick/resume. Triggers: $jj-dispatch, jj-dispatch, 调度, 分发, 预览, PREVIEW, DISPATCH, 回滚, TASK-ID, delivery, cross-project dispatch. Coordination state defaults to ~/.jj-flow (configurable). From a business-repo cwd: recover TASK-ID, approve keys, bind real sessions + attestation. Not single-repo loop (jj-ralph), not port/implement (jj-same), not single-repo review (jj-review). No Claude /jj-dispatch slash (intentional)."
---

# jj-dispatch

Cross-project dispatch entry. Platforms: **Codex / Qoder / Grok**. **No Claude slash is intentional** (do not add `/jj-dispatch`).

> **real-host acceptance: PENDING** — [docs/milestones/real-host-acceptance.md](../../../docs/milestones/real-host-acceptance.md)
>
> **VERIFIED must bind attestation file evidence** (`sandbox_evidence_ref` → `attestations/*.json`, including review). Verbal/chat VERIFIED is forbidden.

## Happy path (In → action → Out)

```text
TASK-ID recovery -> PREVIEW (branch/workspace table)
  -> 🔴 user approves task_keys
  -> 🔴 (if uncertain) confirm branch/mode
  -> DISPATCH -> tick/resume
  -> 🔴 VERIFIED only with full evidence
```

| # | In | Action | Out / next |
| --- | --- | --- | --- |
| 1 | Business-repo cwd / TASK-ID | Recover index + manifest (`jj task context/status` **or** read `control_root` task dir + plane) | Context loaded |
| 2 | Intake fields | If incomplete → `INTAKE_REQUIRED` only (no PREVIEW advance) | Intake complete **or** stop |
| 3 | Complete intake | **PREVIEW** read-only: write-task branch/workspace table (`behind_count`, `base_action`, …); **no** intent write | `PREVIEW_ONLY` + table |
| 4 | PREVIEW table | 🔴 **CHECKPOINT · user approves `task_keys`** this round. No approval → 🛑 **STOP** at `PREVIEW_ONLY` | Approved keys |
| 5 | Branch/mode / CREATE base | 🔴 **CHECKPOINT · `NEEDS_CONFIRM`** when confidence low, dirty/diverged base, or unclear isolation. Show decision table; 🛑 **STOP** DISPATCH until user confirms | `READY` path |
| 6 | Approved + path ready | **DISPATCH**: write intent `PENDING_THREAD` → BIND (Grok Mode S: real session + attestation file). Default `project-branch` | Bound / RUNNING |
| 7 | Receipt / bound tasks | tick/resume; **without CLI, Agent writes plane** → [agent-write-plane.md](references/agent-write-plane.md) | Advanced status |
| 8 | Claim done | 🔴 **CHECKPOINT · VERIFIED**: need `produced_commit` + review + real session + **attestation file** + **T-task-result-sync** in same write batch. Missing any → 🛑 **STOP** at `EVIDENCE_READY`/`RUNNING` | VERIFIED or hold |

Control-plane authority: `src/dispatchControlPlane.mjs` + schema; **do not invent parallel enums**. Full gates/decision table → [happy-path.md](references/happy-path.md).

## Gates 1–8 (first match wins)

| # | Gate | Action |
| --- | --- | --- |
| 1 | intake incomplete | `INTAKE_REQUIRED` only |
| 2 | intent=`UNKNOWN` | `RECONCILE` / manual BIND only; never recreate the same key |
| 3 | no task_keys approval | `PREVIEW_ONLY` read-only |
| 4 | write branch/workspace uncertain; **base stale on CREATE** | decision table (`behind_count` / `base_action` = `FF_LOCAL_MASTER` \| `CREATE_FROM_LOCAL_MASTER` \| `NEEDS_CONFIRM` \| `BLOCKED`); no DISPATCH until confirmed; CREATE only from freshened **local** `master` (never `CREATE_FROM_ORIGIN`; never silent CREATE from `dev`) |
| 5 | missing Codex capabilities | Codex: BLOCKED, plane unchanged; **Grok → Mode S** |
| 6 | approved and path ready | write intent → BIND (Grok: real session + attestation) |
| 7 | receipt / already bound | tick/resume; no CLI → Agent writes plane |
| 8 | mark VERIFIED | commit + review + real session + **attestation file** + T-task-result-sync |

## Failure recovery (if X → Y)

| Trigger | First fix | Still failed → |
| --- | --- | --- |
| Intake incomplete | Return `INTAKE_REQUIRED`; collect required roles/fields only | 🛑 no PREVIEW/DISPATCH/create_thread |
| intent `UNKNOWN` | `RECONCILE` if unique thread match; else manual `BIND_THREAD` | 🛑 this call BLOCKED; never second intent for same `task_key` |
| No user approval of this round’s `task_keys` | Stay `PREVIEW_ONLY`; show table | 🛑 no intent / no create_thread |
| Branch/workspace uncertain or `confidence=low` | Output decision table; ask user | 🛑 no DISPATCH until written confirm |
| CREATE needed, `behind_count>0`, local `master` clean | `git fetch` → `FF_LOCAL_MASTER` → `CREATE_FROM_LOCAL_MASTER` (`checkout -b <feat> master`) | Dirty/diverged / cannot fetch: `NEEDS_CONFIRM` or `BLOCKED`; no silent `reset --hard` |
| Codex missing REQUIRED capabilities | BLOCKED; plane unchanged | Do not forge APIs or projectless degrade |
| Grok missing multi-session caps | **Degrade Mode S** (serial + project-branch) | Still forbid synthetic `session-…` faking BOUND |
| RECONCILE 0 or many thread candidates | This call BLOCKED; intent stays `UNKNOWN` | User picks handle → manual BIND |
| User says “done / VERIFIED” without evidence | Cap at `EVIDENCE_READY`/`RUNNING` | 🛑 no VERIFIED until commit+review+session+attestation file |
| No CLI for tick/closeout | Agent writes plane/attestation/receipt per agent-write-plane; optional `plane-self-check.mjs` | Self-check C5/C6 fail → fix plane, do not raise status |
| Target/attempt set changed after approve | Re-PREVIEW + re-approval | 🛑 no DISPATCH on stale approval |

## User-visible PREVIEW / closeout

**PREVIEW** (facts only):

```text
## PREVIEW
- delivery / TASK-ID:
- task_keys (proposed):
- branch table: project | intended | current | dirty | base_action | confidence | action
- needs from you: approve task_keys [+ confirm branch/mode if NEEDS_CONFIRM]
```

**After DISPATCH / tick** (per target or delivery):

```text
## <task_key or delivery> status
- Action: PREVIEW | DISPATCH | tick | RECONCILE | BIND
- Plane: intent status / BOUND? / delivery status
- Evidence: commit / review / attestation path / session id
- Git base: base_action if CREATE this turn
- Next: (one line; 🛑 if blocked)
```

**Do not** claim VERIFIED in prose without attestation file path; **do not** dump full plane JSON unless user asks or BLOCKED needs it.

## Directory configuration

**Product default control_root = `~/.jj-flow`** (not `/portfolio`).

| Item | Value |
| --- | --- |
| Config dir | `$JJ_GLOBAL_CONFIG_DIR` / `$DAJI_CONFIG_DIR`; on Windows without env, **optional** discovery of `/portfolio/config` (legacy; not product default state root) |
| Config file | `<configDir>/naming.json` |
| Inspect | `jj doctor` → `control_root` / `portfolio_root` / `knowledge_root` / `project_map` |

| Config key | Meaning | Product default | Env var |
| --- | --- | --- | --- |
| `dispatch.control_root` | plane / task / receipt | **`~/.jj-flow`** | `JJ_DISPATCH_CONTROL_ROOT` |
| `dispatch.portfolio_root` | business-repo tree | null | `JJ_PORTFOLIO_ROOT` |
| `dispatch.knowledge_root` | Portfolio KB | `{portfolio_root}/knowledge` or none | `PORTFOLIO_KB_ROOT` |
| `project_map` | project map | null | `JJ_PROJECT_MAP` |

CLI overrides: `--control-root` / `--manifest`. Order: CLI → env → naming.json → **`~/.jj-flow`**.

| | **User starts** | **State written** |
| --- | --- | --- |
| Product default | any business-repo cwd | **`~/.jj-flow`** |
| Portfolio example (not default) | e.g. `/portfolio/project-a` | only after naming config, e.g. `/portfolio/dispatch-control` |

Details → [control-project.md](references/control-project.md).

## Four actions

| Action | Essentials |
| --- | --- |
| **PREVIEW** | read-only; incomplete intake → `INTAKE_REQUIRED`; else `PREVIEW_ONLY` + branch table; no intent write |
| **DISPATCH** | only after 🔴 approved `task_keys` + branch/mode confirmed; `PENDING_THREAD` → BIND; default `project-branch`; target/attempt change → re-PREVIEW + re-approve |
| **RECONCILE** | auto-bind only on unique matching thread; 0/many → BLOCKED, intent `UNKNOWN` |
| **BIND_THREAD** | real host handle + attestation; “done” is not evidence |

Fields and Review loop → [control-project.md](references/control-project.md).

## Agent writes plane

Without CLI, the **Agent may and must** write plane / task / attestation / receipt per [agent-write-plane.md](references/agent-write-plane.md) (status ceiling, `produced_commit`, session bind C4, self-check C5/C6, **T-task-result-sync**). Optional: `node skills/jj-dispatch/scripts/plane-self-check.mjs --manifest …`.

## Grok Mode S (default)

| Question | Answer |
| --- | --- |
| Protocol multi-task? | Yes (multiple task_key) |
| Default multi Grok session? | **No** (Mode S); Mode P deferred |
| Must use Grok Workflow? | **No**; Workflow **must not** advance checkpoints |
| User runs CLI? | **No**; Agent writes attestation/receipt/plane |

Full spec → [grok-dispatch-execution.md](references/grok-dispatch-execution.md).

## CLI matrix (Agent-optional)

| Purpose | Command |
| --- | --- |
| Path resolution | `jj doctor` |
| Task dir | `jj task scaffold --delivery …` |
| Recover context | `jj task context --task TASK-ID` |
| Status JSON | `jj task status --task TASK-ID --json` |
| Assign confirm | `jj task assign --delivery … --task …` |
| Consume receipts | `jj dispatch-tick --delivery …` (optional `--write`) |
| plane self-check | `plane-self-check.mjs --manifest …` |
| Contracts | `npm run harness:check` |

## Rollback

“Roll back target / fake VERIFIED / stop task” → [rollback.md](references/rollback.md). Default **no** auto merge/push/force-push; `reopenTarget` / `blockDispatchIntent` / `requestRework` write `events[]` + `revision++`.

## Host action contract tokens

Authoritative: [host-action-contract.json](references/host-action-contract.json).

- Actions: `CREATE_THREAD` · `RECONCILE_THREAD`
- Capabilities: `list_projects` · `list_threads` · `create_thread` · `read_thread` · `send_message_to_thread` · `worktree` · `sandbox`
- Write default `project-branch`; isolation → `exclusive-worktree`

Role fields: `origin_project` · `requirement_owner` · `lead_project` · `reference_implementation` · `targets` (→ control-project.md).

## Relation to `jj-same`

`$jj-dispatch` = control plane, not sync implementer. Approved targets may hand to `$jj-same`; analysis / adapt / verify / sync checkpoints stay `jj-same`. Legacy `source=A targets=B,C` → `origin_project/requirement_owner/lead_project=A`, `reference_implementation=null`, `targets=[B,C]`.

## Explicitly out of scope / MUST NOT

- Do not require user to open control root or create a new control repo per wave
- **Do not require CLI** for PREVIEW / approve / closeout
- No long-running daemon / DB / full multi-agent engine
- **By default no** auto merge, push, or release
- **Before CREATE**: `git fetch`, ff-only freshen **local** `master` when behind+clean, then `checkout -b <feat> master` only; forbid `CREATE_FROM_ORIGIN` and silent CREATE from `dev`/`develop`
- Do not advance checkpoints from thread stop or model prose alone
- Do not hand-write `VERIFIED` without `produced_commit` / real session / **attestation file**
- Do not synthesize `session-…` placeholders to fake BOUND
- Do not add Claude `/jj-dispatch`
- Do not treat control root as a business source project
- Do not forge host APIs or “degrade to projectless” on capability failure
- Do not treat skill install or `host:trial` as real Host acceptance
- 🛑 **STOP** DISPATCH without approved keys + confirmed branch/mode; 🛑 **STOP** VERIFIED without attestation-bound evidence — recover via [Failure recovery](#failure-recovery-if-x--y)

## References

| File | When to read |
| --- | --- |
| [happy-path.md](references/happy-path.md) | Gates 1–8 detail, decision table, PENDING |
| [agent-write-plane.md](references/agent-write-plane.md) | Agent plane writes A–D / C4–C6 / T-task-result-sync |
| [control-project.md](references/control-project.md) | Directories, intake, fields, Review loop |
| [rollback.md](references/rollback.md) | Rollback / reopen |
| [grok-dispatch-execution.md](references/grok-dispatch-execution.md) | Grok Mode S/W/P |
| [control-plane.schema.json](references/control-plane.schema.json) | Key lookup before writing plane |
| [host-action-contract.json](references/host-action-contract.json) | capability / host actions |
| [task-receipt.schema.json](references/task-receipt.schema.json) | Receipts |
