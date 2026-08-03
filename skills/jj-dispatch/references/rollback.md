# Dispatch rollback semantics

> The control plane advances honestly; it is not a git time machine. By default **do not** auto `git revert` / `reset` / unmerge / force-push.
> Authoritative implementation: `src/dispatchControlPlane.mjs` (`prepareModeSReopen` / `reopenTarget` / `blockDispatchIntent` / `requestRework` / `abandonDispatchUnknown`).

## When to read

- User says “roll back target”, “undo acceptance”, “fake VERIFIED”, “stop this task”
- Discover `VERIFIED` without commit / synthetic session; need closeout rather than hand-editing JSON
- Formal rework after Review `NEEDS_CHANGES`
- **How to erase code**: reset vs revert → see **G-menu** below (user must choose)

## End-to-end flow (recommended)

```text
1. Back up control-plane.json
2. Mode S soft plane: prepareModeSReopen (or auto prepare inside reopenTarget)
3. reopenTarget for each target to roll back (attempt++, PREVIEW_ONLY, TARGET_REOPENED)
4. plane-self-check
5. Show G-menu (Git probe table + options) → wait for user
6. Run only the git action the user selected; default no push
7. Write progress / optional GIT_* event
```

Forbidden: hand-edit `VERIFIED→PENDING` with no event; change git without confirm; Agent default revert.

## Action matrix (control plane)

| User intent | API / equivalent persist | From | To | Must write |
| --- | --- | --- | --- | --- |
| Mis-labeled / redo an accepted target | `reopenTarget` (`supersedeVerified` synonym) | target `VERIFIED` / `NO_CHANGE_REQUIRED` | target `PENDING` + **attempt++** + clear approval + delivery `PREVIEW_ONLY` | `TARGET_REOPENED`; `revision++`; keep checkpoint audit |
| Mode S soft-field plane | `prepareModeSReopen` or reopen default `prepareSoft=true` | DONE/BOUND soft terminal | contract COMPLETED + checkpoint | does not raise revision alone |
| Stop unfinished intent | `blockDispatchIntent` | `PENDING_THREAD` / `BOUND` | `BLOCKED` | `DISPATCH_INTENT_BLOCKED` |
| Review rework | `requestRework` | `NEEDS_CHANGES` | attempt++ | `REWORK_REQUESTED` |
| Unrecoverable UNKNOWN | `abandonDispatchUnknown` | `UNKNOWN` | `BLOCKED` | `DISPATCH_ABANDONED` |
| Code needs rollback | **G-menu** (user chooses) | — | — | only after user confirm |

## Mode S special rules

- Multiple `task_key` **may** share the same real `thread_id` if and only if `host_id=grok-build` and `handle_kind=session`.
- Codex `handle_kind=thread` remains **globally unique**.
- Soft disk shapes commonly: `responsibility.status=DONE`, `intent.status=BOUND`+`result.outcome=DONE`, target top-level `commit` without `last_result`.
- **`reopenTarget` defaults to `prepareSoft` first**, then validates and reopens; Agent need not hand-write normalization scripts.
- Still require a real session id; synthetic `session-*-YYYYMMDD` is blocked by plane-self-check.

```js
import { prepareModeSReopen, reopenTarget } from '…/dispatchControlPlane.mjs';

// Recommended: auto prepare inside reopen
plane = reopenTarget(plane, {
  deliveryId: 'DEL-…',
  projectId: 'project-b',
  reason: 'user rolls back acceptance'
});

// Optional dry-run normalize only
const prepared = prepareModeSReopen(plane, { deliveryId: 'DEL-…' });
```

## G-menu (Git decision — user must choose)

### Principles

1. **No user confirm → no git change**
2. Control-plane reopen is **decoupled** from git (option [1] plane-only)
3. Agent: probe → fill table → mark Recommended → **stop**
4. Already merged to integration: **forbid reset**; only offer revert / fix-forward

### Per-repo probe

| Item | Use |
| --- | --- |
| branch / tip | display |
| task_shas[] | this task’s produced_commit |
| ahead of origin | local-only? |
| tip is only this task’s commits | can reset in one cut |
| task_sha on history of dev/develop/main | can reset |
| dirty | stop first |

### Recommendation rules

```text
dirty → handle dirty tree first
on_integration → revert | fix-forward (forbid reset)
feature already pushed → revert (reset needs second confirm for force risk)
not pushed and tip is this task only → reset (Recommended) | revert | keep code
other → task-scoped revert | keep code
```

### Standard options

```text
[Git how to handle?] (may differ per repo; default same strategy)

[1] Control-plane rollback only; keep code
[2] Discard local tip (reset) — Recommended when unpushed and tip is clean
[3] Append revert commit — already pushed / need audit trail
[4] Cancel git action

Notes:
- Before merge to dev, neither [2] nor [3] affects online integration
- [2] leaves the cleanest history; usually no push needed
- [3] is usually unnecessary when unpushed (leaves A+Revert)
```

### Execution bounds

| Option | Allowed | Forbidden |
| --- | --- | --- |
| [1] | no git | — |
| [2] | `git reset --hard` to pre-task tip | force-push; already on dev |
| [3] | `git revert <task_sha…>` | force-push by default |
| already on dev | only [3] or fix-forward | [2] |

After execution write task `progress.md`; optional event `GIT_ROLLBACK_RESET` / `GIT_ROLLBACK_REVERT`. **Default no push.**

### Legacy path mapping

| Old wording | G-menu |
| --- | --- |
| A plane only | [1] |
| B undo code | **split into [2] reset / [3] revert** (do not default revert) |
| C abandon | stop plane at PREVIEW + [1] |

## Negative cases

| Negative | Correct approach |
| --- | --- |
| Hand-edit VERIFIED with no event | `reopenTarget` |
| Default `git revert` without confirm | G-menu wait for user |
| Unpushed clean tip but default revert | **recommend [2] reset** |
| Already on dev yet reset/force | only revert/fix-forward |
| Recreate same key | attempt++ new key |

## R4 `rollbackPrep` (advice pack; does not run git)

```js
import { buildRollbackPrep, buildRollbackPrepFromPlane, recommendGitStrategy } from '…/dispatchRollbackPrep.mjs';

const prep = buildRollbackPrep({
  delivery_id: 'DEL-…',
  reason: 'user rollback',
  repos: [{
    project_id: 'project-b',
    path: '/portfolio/project-b',
    branch: 'feat/…',
    task_shas: ['9093b961d…'],
    ahead: 1,
    pushed: false,
    tip_is_task_only: true,
    on_integration: false,
    dirty: false
  }]
});
// prep.repos[].recommended === 'reset' | 'revert' | …
// prep.repos[].commands — show user; do NOT run until G-menu confirm
```

Acceptance: fixture and readme-pnpm-class probe output match; `executes_git: false`.

## Formal delivery close

After rollback, if not redoing an attempt:

```js
plane = closeDelivery(plane, {
  deliveryId: 'DEL-…',
  outcome: 'ROLLED_BACK', // ABANDONED | ROLLED_BACK | SUPERSEDED_CLOSED | CANCELLED
  reason: 'user confirmed close: plane reopened; code reset/revert done'
});
// status → BLOCKED; event DELIVERY_CLOSED; closeout metadata
```

Forbid closing a delivery that is still `VERIFIED` (must reopen first).

## plane-self-check

Fake/incomplete VERIFIED → `VERIFIED_REOPEN_SUGGESTED`: take reopen path; do not silently change status.
C4: BOUND + grok-build requires attestation **file path** (including review).
C5: `gradePlaneTerminalIntegrity` → `ok|degraded|fail`; may `setIntegrityGrade` write plane.
C6: `setRemoteCloseout` annotates push/merge (does not block VERIFIED).
