---
name: jj-dispatch
description: Start multi-project dispatch from a business repo: PREVIEW → approve → DISPATCH → tick/resume. Coordination state defaults to the user home directory ~/.jj-flow (configurable). Use for cross-project dispatch, delivery, and TASK-ID recovery. Single-repo loop → jj-ralph; migration implementation → jj-same; single-repo review → jj-review.
---

# jj-dispatch

Cross-project dispatch entry. Platforms: **Codex / Qoder / Grok**. **No Claude slash is intentional** (do not add `/jj-dispatch`).

> **real-host acceptance: PENDING** — [docs/milestones/real-host-acceptance.md](../../../docs/milestones/real-host-acceptance.md)
>
> **VERIFIED must bind attestation file evidence** (`sandbox_evidence_ref` → `attestations/*.json`, including review). Verbal/chat VERIFIED is forbidden.

## Happy path checklist

```text
TASK-ID recovery -> PREVIEW (branch/workspace table)
  -> user approves task_keys
  -> (if uncertain, confirm branch/mode) -> DISPATCH -> tick/resume
```

| # | Gate (first match wins) | Action |
| --- | --- | --- |
| 1 | intake incomplete | `INTAKE_REQUIRED` only |
| 2 | intent=`UNKNOWN` | `RECONCILE` / manual BIND only; never recreate the same key |
| 3 | no task_keys approval | `PREVIEW_ONLY` read-only |
| 4 | write branch/workspace uncertain; **base stale on CREATE** | show decision table (incl. `behind_count`/`base_action`); no DISPATCH until confirmed; never silently create a branch from a behind local master |
| 5 | missing Codex capabilities | Codex: BLOCKED and plane unchanged; **Grok → degrade to Mode S** |
| 6 | approved and path ready | write intent → BIND (Grok: real session + attestation file) |
| 7 | receipt present / already bound | tick/resume; **without CLI, Agent writes plane** (see agent-write-plane) |
| 8 | mark VERIFIED | need commit + review + real session + **attestation file**; **T-task-result-sync** refresh result/progress in the same write batch |

Full gates and decision table → [happy-path.md](references/happy-path.md). Control-plane authority: `src/dispatchControlPlane.mjs` + schema; do not invent parallel enums.

## Directory configuration

**Product default control_root = `~/.jj-flow`** (not `/portfolio`).

| Item | Value |
| --- | --- |
| Config dir | `$JJ_GLOBAL_CONFIG_DIR` / `$DAJI_CONFIG_DIR`; on Windows without env, **optional** discovery of `/portfolio/config` (legacy; not the product default state root) |
| Config file | `<configDir>/naming.json` |
| Inspect resolution | `jj doctor` → `control_root` / `portfolio_root` / `knowledge_root` / `project_map` |

| Config key | Meaning | Product default | Env var |
| --- | --- | --- | --- |
| `dispatch.control_root` | plane / task / receipt | **`~/.jj-flow`** | `JJ_DISPATCH_CONTROL_ROOT` |
| `dispatch.portfolio_root` | top-level business-repo tree | null | `JJ_PORTFOLIO_ROOT` |
| `dispatch.knowledge_root` | Portfolio KB | `{portfolio_root}/knowledge` or none | `PORTFOLIO_KB_ROOT` |
| `project_map` | project map | null | `JJ_PROJECT_MAP` |

CLI overrides: `--control-root` / `--manifest`. Resolution order: CLI → env → naming.json → **`~/.jj-flow`**.

| | **Where the user starts** | **Where state is written** |
| --- | --- | --- |
| Product default | any business-repo cwd | **`~/.jj-flow`** |
| **Portfolio example (not default)** | e.g. `/portfolio/project-a` | only after naming config, e.g. `/portfolio/dispatch-control` |

Details → [control-project.md](references/control-project.md).

## Four actions

| Action | Essentials |
| --- | --- |
| **PREVIEW** | read-only by default; intake incomplete → `INTAKE_REQUIRED`; complete → `PREVIEW_ONLY` + write-task branch table; does not write intent |
| **DISPATCH** | **attempt** only after user approves `task_keys` and branch/mode are confirmed; write `PENDING_THREAD` → BIND; default `project-branch`; target/attempt changes require re-PREVIEW + re-approval |
| **RECONCILE** | auto-bind only on a unique matching thread; 0/many candidates → this call BLOCKED, intent stays `UNKNOWN` |
| **BIND_THREAD** | bind a real host handle; attestation required; the word “done” is not evidence |

Fields and Review loop → [control-project.md](references/control-project.md).

## Agent writes plane

When the user does not run CLI, the **Agent may and must** write plane / task / attestation / receipt directly, following [agent-write-plane.md](references/agent-write-plane.md) (status ceiling, `produced_commit`, session bind C4, self-check C5/C6, **T-task-result-sync**). Optional: `node skills/jj-dispatch/scripts/plane-self-check.mjs --manifest …`.

## Grok Mode S (default)

| Question | Answer |
| --- | --- |
| Is the protocol multi-task? | Yes (multiple task_key) |
| Default multi Grok session? | **No** (Mode S); Mode P is deferred |
| Must use Grok Workflow? | **No**; Workflow **must not** advance checkpoints |
| Does the user run CLI? | **No**; Agent writes attestation/receipt/plane |

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

“Roll back target / fake VERIFIED / stop task” → [rollback.md](references/rollback.md). Default **no** auto merge/push/force-push; `reopenTarget` / `blockDispatchIntent` / `requestRework` etc. write `events[]` + `revision++`.

## Host action contract tokens

Authoritative contract: [host-action-contract.json](references/host-action-contract.json).

- Action types: `CREATE_THREAD` · `RECONCILE_THREAD`
- Capabilities: `list_projects` · `list_threads` · `create_thread` · `read_thread` · `send_message_to_thread` · `worktree` · `sandbox`
- Write default `project-branch`; isolation → `exclusive-worktree`; `worktree` field binds path

Role fields (intake / plane): `origin_project` · `requirement_owner` · `lead_project` · `reference_implementation` · `targets` (details → control-project.md).

## Relation to `jj-same`

`$jj-dispatch` is the cross-project control plane, not a sync implementer. Approved targets may be handed to `$jj-same`; target analysis, difference adaptation, verification, and sync checkpoints remain `jj-same` responsibilities. Legacy `source=A targets=B,C` maps to `origin_project/requirement_owner/lead_project=A`, `reference_implementation=null`, `targets=[B,C]`.

## Explicitly out of scope

- Do not require the user to open the control root or create a new control repo per wave
- **Do not require the user to run CLI** for PREVIEW / approve / closeout
- Do not implement a long-running daemon / DB / full multi-agent engine
- **By default do not** auto merge, push, or release; **before CREATE of a feature branch must** fetch and ensure tip is not behind `origin/<base>` (see happy-path decision table / EP-20260803)
- Do not advance checkpoints from thread stop or model prose alone
- Do not hand-write `VERIFIED` without `produced_commit` / real session / **attestation file**
- Do not synthesize `session-…` placeholder threads to fake BOUND
- Do not add Claude `/jj-dispatch`
- Do not treat the control root as a business source project
- Do not forge host APIs or “degrade to projectless” on capability failure
- Do not treat skill install or `host:trial` as real Host acceptance

## References

| File | When to read |
| --- | --- |
| [happy-path.md](references/happy-path.md) | Main path, Gates 1–8, decision table, PENDING |
| [agent-write-plane.md](references/agent-write-plane.md) | Agent plane writes A–D / C4–C6 / T-task-result-sync |
| [control-project.md](references/control-project.md) | Directories, intake, fields, Review loop |
| [rollback.md](references/rollback.md) | Rollback / reopen |
| [grok-dispatch-execution.md](references/grok-dispatch-execution.md) | Grok Mode S/W/P |
| [control-plane.schema.json](references/control-plane.schema.json) | Key lookup before writing plane |
| [host-action-contract.json](references/host-action-contract.json) | capability / host actions |
| [task-receipt.schema.json](references/task-receipt.schema.json) | Receipts |
