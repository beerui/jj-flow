# Continuous incremental sync

Continuous sync targets the feature contract, not the source project tree. After first porting a feature from A to B, establish a stable relation; later process only effective deltas from A since the last successful sync point, still implemented on B’s native architecture.

## Contents

- [Sync contract](#sync-contract)
- [Family delivery plan](#family-delivery-plan)
- [Success checkpoints](#success-checkpoints)
- [First port](#first-port)
- [Later sync](#later-sync)
- [Post-change decision gate](#post-change-decision-gate)
- [Deferred sync](#deferred-sync)
- [Auto-trigger boundaries](#auto-trigger-boundaries)

## Sync contract

Assign a stable `sync_key` per continuous-sync relation, recommended format `SYNC-{feature-slug}`. It is a business-relation id, not a workflow artifact ID.

After first successful port, write arch specs: `outgoing` index on the source, `incoming` contract on each target. Both ends share the same `sync_key`:

| Field | Meaning |
|---|---|
| `sync_key` | Stable id for this feature relation |
| `direction` | Source is `outgoing`; target is `incoming` |
| `feature` | User-recognizable feature or problem domain |
| `source_repo` / `source_ref` | Project A and tracked branch or ref |
| `source_scope` | Entrypoints, capabilities, and known code scope for the feature |
| `target_repo` / `target_ref` | Project B and target branch |
| `target_scope` | Matching entrypoints and target-only extensions on B |
| `requirement_ref` | Initial or currently valid `BLP-* / REQ-*` |
| `target_only` | Exclusive behavior B must keep |
| `exclusions` | Modules, legacy, generated assets, and policies not auto-ported |
| `trigger_mode` | `manual`, `notify`, or `auto-pr` |

The sync contract is a stable rule written into each side’s `.workflow/specs/architecture-constraints.md`. Source index discovers targets after changes; target contract validates target scope and checkpoints. Do not write the changing `last_source_head` into the spec.

## Family delivery plan

Create a cross-project coordination plan when requirements start analysis on the lead project — do not wait until source development finishes to discover targets. With a `$jj-dispatch` control project, the control manifest is the authoritative record of cross-project tasks, threads, status, and decisions; the lead holds only its own canonical `PLN` and artifacts. Without control, the lead continues to hold the family coordination plan. The plan records at least:

- Project-family registration and this round’s authorization scope.
- Default or user-confirmed delivery order.
- Lead branch, derived target branches, and local `master` baseline.
- Per-project status: `NOT_STARTED / ANALYZING / IMPLEMENTING / VERIFYING / READY_FOR_USER_TEST / READY_FOR_HANDOFF / COMPLETED / BLOCKED / N/A`.
- Session IDs, `sync_key`, artifact refs, verification evidence, unresolved items, `TARGET-ONLY`, and `DO-NOT-PORT`.
- Current `snapshot_id`, `handoff_ref`, source HEAD, freshness, and successor relations.
- Next project unlock conditions and user-trigger state.

During analysis, record only high-level scope, risks, and differences still to verify for future projects — do not prefill lead project files or implement steps as target tasks. After blueprint readiness, generate or update the family coordination `PLN`; each target still must complete `ANL-TARGET` and its own implement `PLN` in its repo before development.

After any of development, bug fix, requirement correction, verification, review, commit, or handoff status changes, update the family delivery plan. Plan status cannot replace Git, `VRF`, or `REV` evidence.

### Auto-advance vs explicit target

When Project A leads, default next-target recommendation is `pa -> pb -> pc`. Before the agent auto-advances, the predecessor becomes `READY_FOR_HANDOFF` only when all of:

- Predecessor has a stable commit and verified worktree boundary.
- Agent-side non-browser static and focused checks pass.
- When target analysis says runtime verification is necessary, the user has manually completed the corresponding compile/build/browser/E2E/page tests and explicitly confirmed pass; when not necessary, an evidenced `N/A` reason exists. Agent runs those tests only when the user asks.
- `REV` does not block and there is no `MUST`-impacting unresolved item.
- Family delivery plan records final HEAD, verification evidence, differences, and next target.

Only after those evidence gates may the agent recommend the next project. Without user trigger, do not auto-create a target branch or modify the target repo. When the current request already names a target and asks migrate/implement, do not require other siblings to complete delivery evidence; check current-target `EXECUTION_READY`, then create the derived branch from local `master` and implement. Branching replaces only the project-role prefix of the lead branch; keep type, date, and task sequence.

### Cross-session handoff

The handoff package includes at least: prior session ID, `snapshot_id`, `handoff_ref`, snapshot hash, lead/current/next project identity and path, branch, HEAD, verification commit range, `BLP/ANL/PLN/VRF/REV` refs, family plan location, derived branch name, unresolved items, and target-only boundaries. New sessions first verify snapshot freshness, Git, and target source facts; re-read corresponding source materials only when the snapshot changed, is missing, or links `UNRESOLVED`.

## Success checkpoints

From B’s `.workflow/state.json`, find the latest delivery chain with the same `sync_key` and reverse along dependencies to source analysis:

```text
ANL-SOURCE-DELTA -> BLP(as needed) -> ANL-TARGET -> PLN -> EXC -> VRF
                                                    \-> REV
```

There are two success checkpoints that may advance the baseline.

**Implemented checkpoint** requires all of:

- B has an actual target commit.
- `VRF-*` has `overall_pass` true, with required user manual runtime acceptance confirmation, or evidence that such verification is `N/A`; agent-run results replace corresponding human evidence only when the user asked.
- `REV-*` is not `BLOCK`.
- No deferred, blocked, or unresolved conflicts impacting `MUST`.

**Zero-change checkpoint** applies only when every source delta this round is evidenced as `N/A`, `NOISE`, or `DO-NOT-PORT` by target analysis. `ANL-TARGET` MUST record each disposition, evidence, and a `NO_CHANGE_REQUIRED` conclusion, with no `MUST` impact or unresolved items. This path does not forge `EXC/VRF/REV`.

Outside that zero-change path, analysis-only, plan failure, implement failure, verification failure, or review block do not advance the checkpoint. The next run keeps using the previous successful `last_source_head`, so A changes not yet landed on B are not skipped.

If no success checkpoint is found, use the first-port source commit from the sync contract as the initial baseline; if that commit is also unverifiable, mark `BLOCKED` — do not guess range.

## First port

1. Per `artifact-routing.md`, generate `ANL-SOURCE -> BLP -> ANL-TARGET -> PLN -> EXC/VRF -> REV`.
2. In source analysis, record `sync_key`, `source_base`, `source_head`, and feature scope.
3. In target analysis, record B’s matching entrypoints, `TARGET-ONLY`, exclusions, and port decisions.
4. After successful verification, write arch specs: outgoing index on A, incoming contract on B.
5. Use the first-port `source_head` as the first success checkpoint.

For multi-target first ports, generate one handoff snapshot after the source reaches a handoff-ready state. Targets reuse the same shared `ANL-SOURCE / BLP/REQ` and MUST NOT rebuild separately; target success checkpoints are still maintained per target.

## Later sync

1. Locate targets from the source outgoing spec; resolve `last_source_head` from the target incoming spec and latest successful artifact chain.
2. Read A’s current `current_source_head`; confirm both ends’ refs and worktree state.
3. Analyze commits and diffs for `last_source_head..current_source_head` in time order; changed paths are clues only — ownership still follows the feature contract.
4. Classify each source delta as:
   - `REQUIREMENT_CHANGE`: add, remove, or change product behavior.
   - `BUG_FIX`: root-cause fix that does not change the product contract.
   - `REFACTOR`: structural change with unchanged external behavior.
   - `REVERT`: rollback of existing behavior.
   - `NOISE`: formatting, generated assets, docs, or other non-feature changes.
5. Generate `ANL-SOURCE-DELTA` with source scope, classification, requirement impact, and razor exclusions.
6. Choose requirement artifacts by class:
   - Any `REQUIREMENT_CHANGE`: generate a new `BLP-*` that inherits prior requirements and expresses only the delta and latest effective state.
   - Only `BUG_FIX`: reuse original `BLP-* / REQ-*`; source delta analysis records root cause and fix acceptance — do not rebuild a full blueprint.
   - Only `REFACTOR` or `NOISE`: do not port unless B truly needs it to implement the same requirement.
   - `REVERT`: first prove product reversal vs accidental rollback; keep `UNRESOLVED` when evidence is insufficient.
7. Generate a successor handoff snapshot when shared requirements or source HEAD change; evidence-only successor is allowed when only verification evidence is added. Snapshot updates themselves MUST NOT advance target sync checkpoints.
8. Run target analysis on B. Compare three sides — last successful target state, B current state, A new delta — and protect B’s post-sync local changes.
9. Port only `DIRECT / ADAPT / EXTEND`; mark bug fixes without the same root cause as `N/A`.
10. Implement and verify via plan → implement → review.
11. Only after an implemented or zero-change checkpoint is met, use `current_source_head` as the next baseline.

## Post-change decision gate

After `jj-delivery` or ordinary development finishes source changes and source verification, enter post-change discovery first; do not modify any target project immediately.

### 1. Confirm source project and branch

At least read and show:

- Project root from `git rev-parse --show-toplevel`.
- Normalized remote URL from `git remote get-url origin`.
- Project-family business role and `source_repo` from the sync contract.
- `git branch --show-current`, `git rev-parse HEAD`, and contract `source_ref`.
- `git status --short` and source verification results.

On repo/origin/role/branch mismatch, detached HEAD, unresolvable source commit, or missing target ref, mark `BLOCKED`. If source changes are not yet a stable commit, mark `PREVIEW_ONLY`: candidates may be listed, but no sync and no checkpoint advance. Do not checkout, switch branches, or rewrite the contract yourself to erase the mismatch.

### 2. List candidate targets

Prefer targets from the current source’s outgoing `sync_key` index; supplement same-family candidates without contracts via `project-family.md`. Show per item: target role, path, origin, target branch, sync relation, latest checkpoint, this-round source range, and status.

| Status | Meaning |
|---|---|
| `READY` | Contract exists, project/branch correct, pending delta |
| `ALREADY_SYNCED` | Target already consumed current `source_head` |
| `ELIGIBLE` | Same family and requirement applies, but no sync contract yet; choosing runs first port |
| `DEFERRED` | Open deferred issue for same `sync_key + target` |
| `PREVIEW_ONLY` | Source changes have no stable commit; preview only |
| `BLOCKED` | Project, branch, permission, worktree, dependency, or checkpoint not met |
| `N/A` | Business scenario or this change does not apply to the target |

### 3. Ask the user

With `READY`, `ELIGIBLE`, or `DEFERRED` targets, let the user choose per target project:

- `SYNC_NOW`: sync the selected targets immediately.
- `DEFER`: record deferral; do not modify the target or advance the baseline.
- `NOT_APPLICABLE`: user confirms not applicable this round; record reason and take `NO_CHANGE_REQUIRED`.
- `PAUSE_RELATION`: add a superseding arch decision that pauses the relation while keeping the old contract’s audit trail.

When the current user message already requires sync to specific targets, treat it as `SYNC_NOW` without re-confirm. Multiple targets cannot use a vague global “yes” instead of per-project choice; targets taking the same action may be grouped. Only `READY / ELIGIBLE / DEFERRED` enter the ask; `BLOCKED` only reports unblock conditions.

## Deferred sync

`DEFER` uses `manage-issue` to create an open issue on the target project; do not use a final `deferred` status that gets archived. The issue records at least:

- `sync_key`, source/target projects, source/target branches.
- Latest successful checkpoint, earliest unsynced `before_sha`, current `after_sha`.
- Deferral reason, decision maker, decision time, expected resume time or conditions.
- tags: `jj-same`, `sync-deferred`, `sync_key`, and target role.

Before create, scan open issues; if the same `sync_key + target_repo + target_ref` already exists, update that issue instead of duplicating. Keep the earliest `before_sha`, only extend `after_sha` to the latest source HEAD, and append change notes.

On resume, re-verify project and branch and always compute cumulative range from the latest successful checkpoint — do not use only the last event range in the issue. After an implemented or zero-change checkpoint, close with `manage-issue close --status completed`; keep open if sync still fails or the target remains blocked. Reaching the expected time only re-prompts — no auto execute and no baseline advance.

## Auto-trigger boundaries

`jj-same` is an execution entry, not a daemon. Three trigger strategies:

- `manual`: user runs `$jj-same sync <sync_key>` (or the natural-language form `同步 <sync_key>`); most robust; default.
- `notify`: A’s CI creates a sync task or notification after related path changes; does not modify B.
- `auto-pr`: A’s CI emits an event; a credentialed agent runs sync and opens a PR on B; B still needs verification and human/policy review.

CI events include at least: `sync_key`, `source_repo`, `source_ref`, `before_sha`, `after_sha`, `changed_paths`, and compare URL. CI does not decide business semantics and should not cherry-pick or auto-merge B.
