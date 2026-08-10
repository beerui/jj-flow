# jj-same Workflow Core (detail)

Long flows and evidence detail sunk from main `SKILL.md`. Main-path checklist: [happy-path.md](happy-path.md).

## Delivery lifecycle

`jj-same` enters at the lead project’s requirement-analysis phase; do not wait for lead development to finish before sync discovery. As soon as a same-origin project family is identified:

1. Register this round’s project family, authorization scope, lead project, and delivery order.
2. Create a family delivery plan on the lead project; continuously record branch maps, session IDs, artifact refs, verification evidence, differences, and the next project’s gates.
3. After the source has a stable commit, shared `BLP/REQ`, and explicit unresolved items, generate a `PARTIAL_HANDOFF` or `READY_FOR_HANDOFF` snapshot inside source `ANL-SOURCE` and write the unique `handoff_ref` into the family plan.
4. When Project A leads, default serial order is `pa -> pb -> pc`; if the user names another lead, order, or subset, that current request wins.
5. Generate executable implement tasks only for the current project; future projects keep high-level scope and differences still to verify.
6. After development, fix, requirement correction, verification, review, commit, or block-status changes, update the family delivery plan first; on shared requirement change, generate a successor snapshot — do not rewrite the old file in place.

The lead branch is created by the user. `pa -> pb -> pc` is the default coordination order when the agent auto-picks the next target; it is not a hard gate that vetoes a user-explicit current target. When the current message clearly names “current project/target + start migration/implement/go”, treat that target as user-triggered; if it meets `EXECUTION_READY`, create a develop branch from a **fresh** integration base (default `master` / `origin/master`) and implement — do not require other siblings to finish QA, UAT, or review. Projects not selected this round keep prior status with a recorded reason. Branch names keep the lead branch’s type, date, and task sequence; only replace the project role prefix, e.g. `feat/pa-0717-1 -> feat/pb-0717-1 -> feat/pc-0717-1`.

**CREATE base freshness (local-master-only; EP-20260803 + 2026-08-10)**: before creating a feature branch, `git fetch` the integration base (default `origin master`) and ensure **local** `master` is not behind. Allowed sequence: if behind and clean → **`FF_LOCAL_MASTER`** (`checkout master` + `merge --ff-only origin/master`), then always **`CREATE_FROM_LOCAL_MASTER`** (`checkout -b <feat> master`). If already fresh → `CREATE_FROM_LOCAL_MASTER` only. **Forbidden**: `CREATE_FROM_ORIGIN` / branch directly from `origin/<base>` as primary path; silent CREATE from `dev`/`develop`; silent `checkout -b` from a stale local tip when `behind_count > 0`; `reset --hard` or rewrite of dirty/divergent local `master` without **written** user approval. Do not modify unauthorized repos. Detail: [branch-purpose-preflight.md](branch-purpose-preflight.md) checks 6–10 / G6.

With a `$jj-dispatch` control project, this round’s coordination facts are the roles and `targets` explicitly approved in the control manifest; `jj-same` still only owns porting, difference adaptation, and sync checkpoints. Without control, remain compatible with `source=A targets=B,C` and do not force-upgrade legacy handoff snapshots. Family plan ≠ dispatch approval.

## Dual-gate extension (execution priority)

- Missing latest source `quality-review PASS`, `VRF/UAT` `PENDING`, incomplete family plan, or incomplete canonical artifacts are delivery caveats or records-to-fill by default — not `EXECUTION_READY` blockers. Block coding only when there is clear failure evidence, unstable source commit, final requirements that cannot converge, unverifiable target facts, or `MUST`-impacting conflicts.
- When the user clearly says “start migration”, “implement”, or “go”, choose `EXECUTE_NOW`. After necessary fact checks, the next material action MUST be target business code or focused test changes; do not substitute by filling `.workflow`, repeating blueprints, repeating source review, or updating plan status.
- Family plan, snapshot, and `ANL/BLP/PLN` store decision-affecting evidence. When existing material is enough, add only minimal refs and ledger; do not rebuild existing source analysis, requirement body, or a full blueprint for artifact count.

On information gaps, first check current requirements, session, Git, project docs, and source. If still unclear, take only the narrowest default that does not expand scope, add product behavior, or become irreversible, and record the assumption in the plan. When safe inference is impossible and `MUST`, acceptance criteria, target set, or irreversible implementation would be affected, record `BLOCKED` with missing evidence and unblock conditions — do not start an extra requirements interrogation flow.

By default do not run compile, build, browser, E2E, or page-interaction self-tests. After non-browser static and focused checks, the agent judges whether runtime verification is needed from the change and acceptance criteria. Only when changes touch build config, runtime entrypoints, user interaction, routing, async state, permissions, or cross-page flows, and static evidence is insufficient, prompt the user for the next manual tests with a minimal list and mark `READY_FOR_USER_TEST`. After user pass confirmation, enter `READY_FOR_HANDOFF`; when not needed, record an `N/A` reason and continue without extra user noise. Run specified build or browser tests only when the user asks the agent to.

## Evidence entry points

### Session-driven

When the user provides a session ID and requirements:

1. Prefer Codex `read_thread`; if the old session is not visible, locate JSONL under `$CODEX_HOME/sessions` or `archived_sessions`.
2. Optionally run [../scripts/extract_session_evidence.py](../scripts/extract_session_evidence.py) to extract user change instructions, working directories, and the assistant’s final delivery summary.
3. Put current user requirements at highest priority; later session corrections override earlier asks.
4. Assistant delivery summaries are location clues only; MUST verify with Git and current source.

```bash
python -X utf8 scripts/extract_session_evidence.py \
  --thread-id '019f3a6a-07f2-7c80-a75e-3d40be996901'
```

### Branch-driven

When the user provides a feature branch, commit, or diff:

1. Confirm source repo, baseline ref, and feature ref; do not assume the current checkout is the source branch.
2. Walk commits in time order over `merge-base..feature-ref`; distinguish add, fix, revert, and product reversal.
3. Optionally run [../scripts/collect-port-evidence.mjs](../scripts/collect-port-evidence.mjs) to compare source change scope, stack, and same-path files on the target (shared Node implementation on Windows / macOS / Linux; `.sh` / `.ps1` are thin launchers — see [../scripts/README.md](../scripts/README.md)).
4. Continue along the target call chain; same-path presence does not mean copy-paste is valid.

Preferred entry (all platforms):

```bash
node scripts/collect-port-evidence.mjs \
  --source-repo /path/to/source \
  --source-base master \
  --source-ref feat/example \
  --target-repo /path/to/target \
  --target-ref HEAD
```

macOS / Linux also:

```bash
./scripts/collect-port-evidence.sh \
  --source-repo /path/to/source \
  --source-base master \
  --source-ref feat/example \
  --target-repo /path/to/target
```

Windows PowerShell compatibility entry:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/collect-port-evidence.ps1 `
  -SourceRepo 'D:\path\source' `
  -SourceBase 'master' `
  -SourceRef 'feat/example' `
  -TargetRepo 'D:\path\target' `
  -TargetRef 'HEAD'
```

### Mixed-driven

When session, current requirements, and branch all exist, cross-validate:

- Session explains “why it changed” and how requirements evolved.
- Branch shows “what actually changed”.
- Current requirements define “what this round finally needs”.
- Target source decides “how to implement minimally here”.

If the four conflict, list conflicts first. Explicit current user asks win; do not promote accidental source-branch implementation into product rules.

### Handoff-snapshot-driven

When the user provides `handoff_ref`:

1. Parse `jj-same/handoff-snapshot/1.0`; verify source repo, HEAD, session cursor, source fingerprints, parent chain, and canonical refs. Detail: [handoff-snapshot.md](handoff-snapshot.md).
2. Output `FRESH / PARTIAL / STALE / BROKEN` and exactly one start action: `REUSE / REFRESH_SOURCES / REBASELINE / BLOCKED`.
3. On `REUSE`, consume shared `ANL-SOURCE / BLP/REQ` referenced by the snapshot; target repos MUST NOT regenerate source analysis or blueprint.
4. `REFRESH_SOURCES` reads only changed, new, restored, or `UNRESOLVED`-linked sources and generates a successor snapshot in the source artifact owner repo.
5. For `PARTIAL_HANDOFF`, read `execution_readiness` separately: `READY` means only delivery-completion evidence is missing — implement with caveats is allowed; `BLOCKED` means unstable source, requirement conflict, or `MUST`-impacting gaps — do not create executable `PLN` or business changes.
6. The target still MUST generate its own `ANL-TARGET` from current source and record `snapshot_id`, `handoff_ref`, snapshot hash, and source HEAD.

## Artifact routing (detail)

Summary and canonical table: [artifact-routing.md](artifact-routing.md). Do not change code before requirements and target facts converge, and do not treat “artifact chain complete” as “facts sufficient”. Choose the shortest path from input:

- **Fast implement**: user explicitly asks migrate/implement; stable source commit/diff, final requirement sources, and target call chain are all verifiable; no `MUST`-impacting `UNRESOLVED`. Reuse existing `ANL/BLP/REQ`; if missing, record a minimal source-cited requirement ledger in target `ANL-TARGET`, generate the narrowest `PLN`, then enter `EXC` immediately. Do not rebuild full `ANL-SOURCE` or blueprint for formal completeness; fill missing canonical handoff artifacts before `HANDOFF_READY`.
- **Standard discovery**: conflicting requirements, unclear source scope, multiple targets need shared semantics, or `MUST`-impacting evidence has not converged. Generate full source analysis and formal requirements.
- **Snapshot reuse**: with a valid `handoff_ref`, reuse shared source analysis and requirements; only do freshness, target analysis, implement, and verification.

Standard discovery generates and registers in order:

1. **Source analysis `ANL-SOURCE`**: summarize session, requirement evolution, commits, diffs, source change map, draft requirement ledger, and razor list.
2. **Formal requirements `BLP`**: consume source analysis into `.workflow/blueprint/BLP-*/requirements/REQ-*.md`; do not rewrite `UNRESOLVED` as confirmed requirements.
3. **Target analysis `ANL-TARGET`**: each target reviews current architecture, call chain, capability matrix, risks, and port decisions (from blueprint `BLP-*`). Across repos, use the blueprint’s direct path.
4. **Implement plan `PLN`**: only after requirement readiness passes and target analysis has no `MUST`-impacting block, generate minimal `plan.json` and `.task/TASK-*.json`; after plan generation, continue coding in the same implement request — do not stop at plan delivery.
5. **Implement and re-review `EXC/VRF/REV`**: implement, then `quality-review`; each skill writes canonical artifacts and registers them in the target repo’s `.workflow/state.json`.

After the source finishes steps 1–2 and has a stable commit, generate the handoff snapshot inside source `ANL-SOURCE` per [handoff-snapshot.md](handoff-snapshot.md). With a valid `handoff_ref`, targets reuse shared steps 1–2 and only run the freshness gate plus their own steps 3–5; do not copy a full source analysis and blueprint into every target for “artifact completeness”.

Multi-project tasks maintain the family coordination plan from the `ANL-SOURCE` phase. Before blueprint readiness, record only plan drafts and blockers; after readiness, register the family coordination `PLN` on the lead project. It manages project order, status, branches, session handoff, and unlock gates only — it does not replace each target’s own `ANL-TARGET -> PLN`.

Single-target ports without handoff snapshot: the target repo owns the full artifact chain. Prepare-handoff mode: the source artifact owner holds shared source analysis, blueprint, and snapshot; whether one or many targets, each target separately owns `ANL-TARGET`, `PLN`, `EXC/VRF`, and `REV`. If the target has no `.workflow/`, run workflow init first.

Subsequent sync uses an incremental chain:

1. Restore `sync_key` and stable scope from the target arch spec; reverse `last_source_head` from the latest successful `VRF/REV` delivery chain or a `NO_CHANGE_REQUIRED` target analysis.
2. Analyze `last_source_head..current_source_head` and generate `ANL-SOURCE-DELTA`.
3. On product-behavior change, generate a new `BLP-*` requirement delta; for bug fixes under the same requirement, reuse the original blueprint.
4. Each target regenerates `ANL-TARGET -> PLN -> EXC/VRF -> REV`; do not code from an old target analysis.
5. Only when target non-browser checks pass, required user manual tests are confirmed or evidenced as `N/A`, and review does not block — or target analysis proves all deltas need no change — treat this `current_source_head` as the next successful checkpoint.

Source and target analysis MUST at least produce:

- **Requirement ledger**: `MUST`, `TARGET-ONLY`, `DO-NOT-PORT`, `UNRESOLVED`.
- **Source change map**: requirement behavior -> commit -> file -> method/API -> verification evidence.
- **Target capability matrix**: each target’s matching entrypoints, differences, risks, and port decisions.
- **Razor list**: files, legacy, docs, formatting, and reverted behavior explicitly not ported.
- **Handoff snapshot**: shared requirement refs, source fingerprints, source HEAD, coverage, user correction order, verification status, and target differences still to verify.

Mark one decision per capability:

- `DIRECT`: target contract and structure are isomorphic; replay the same semantic patch.
- `ADAPT`: same business, different framework/API/state/component structure; implement natively on the target.
- `EXTEND`: target has exclusive entrypoints the source lacks; must cover them additionally.
- `BLOCKED`: should support but lacks interface, product definition, or base capability.
- `N/A`: target has no such business scenario.

Real-project tasks, handoffs, dispatch, reports, and receipts MUST enter typed `.workflow/` task directories; **MUST NOT** create a private `.workflow/jj-same/` directory or write requirement body into `.workflow/.sessions/*/status.json`. The `jj-flow` repo itself still does not use `.workflow` as a fact source.

## Continuous-sync rules

Full contract, checkpoints, and deferral fields: [continuous-sync.md](continuous-sync.md). Summary:

- Assign `SYNC-{feature-slug}` per A -> B feature relation; after first successful delivery, write arch specs: outgoing index on A, incoming contract on each B.
- Spec stores only source/target, feature scope, target-only behavior, exclusions, and trigger policy; mutable commit cursors reverse from the latest successful artifact chain.
- Later sync MUST compare three sides — last successful target state, B’s current state, A’s new delta — and preserve B’s local changes after the first port.
- Classify source deltas as `REQUIREMENT_CHANGE / BUG_FIX / REFACTOR / REVERT / NOISE`. Only requirement-related changes and same-root-cause fixes enter target review.
- Failed sync does not advance the baseline; next run continues cumulative analysis from the old baseline and MUST NOT skip intermediate commits.
- When all deltas this round are `N/A / NOISE / DO-NOT-PORT`, allow `ANL-TARGET` to form a `NO_CHANGE_REQUIRED` zero-change checkpoint; do not forge `EXC/VRF/REV`.
- `jj-same` does not continuously watch A. Automation only has A’s CI emit `sync_key + before_sha + after_sha + changed_paths`; default is a reviewable PR on B — no silent edits or auto-merge.

## Post-change sync decision

After source changes and verification, run discovery first; do not sync immediately:

1. Show and verify project root, origin, business role, current branch, HEAD, worktree, and verification results.
2. Load outgoing sync contracts from the current project’s arch spec and align with current project and branch; on mismatch, detached HEAD, or unresolvable ref, mark `BLOCKED`.
3. If source changes are not yet a stable commit, only `PREVIEW_ONLY` — no sync and no checkpoint advance.
4. List each syncable project’s role, path, target branch, `sync_key`, checkpoint, source range, and `READY / ALREADY_SYNCED / ELIGIBLE / DEFERRED / PREVIEW_ONLY / BLOCKED / N/A`.
5. With actionable targets, ask the user per project for `SYNC_NOW / DEFER / NOT_APPLICABLE / PAUSE_RELATION`. Skip re-confirm when the current request already names immediate-sync targets.
6. `DEFER` creates or updates an open issue on the target via `manage-issue`; same `sync_key + target` keeps the earliest unsynced start and updates latest source HEAD without advancing the baseline.
7. On resume, recompute cumulative range from the latest successful checkpoint; close the issue after successful sync or `NO_CHANGE_REQUIRED`.

Detailed execution and deferral fields: [continuous-sync.md](continuous-sync.md). Do not switch repos or branches yourself just to make a candidate `READY`.

## Workflows 1–7

### 1. Lock scope

- Confirm operation type: first port, establish continuous sync, continue sync, bug fix, requirement add, requirement delete, or product adjustment.
- Confirm entry mode: prepare handoff, consume `handoff_ref`, update handoff, first port without snapshot, or later sync by `sync_key`.
- Confirm source project, target projects, shared-blueprint artifact owner repo, evidence entry, and whether commit/push is required.
- Confirm lead project, default or user-specified delivery order, lead branch, derived target branches, and family plan ownership; when Project A leads, default `pa -> pb -> pc`.
- **Branch purpose + base freshness preflight (hard gate, before coding)**: read [branch-purpose-preflight.md](branch-purpose-preflight.md). Before writing business code or creating a target branch, answer from current-repo `git branch --show-current` / HEAD: task purpose, current branch purpose, intended work branch, this turn’s **integration land** (check 4 — not CREATE base), and (if the user asks about ship content) whether the **tip tree** contains the target capability. On task/current purpose mismatch, mark `BLOCKED`; only allow switch/create of the correct branch or a recorded explicit user override (“land on this train branch”). Do not attach requirements onto a release train or unrelated feature line just because it is checked out (regression: EP-20260730-S1). **On CREATE additionally**: after `git fetch`, fill `base` / `origin_base` / `behind_count` / `base_action` / `create_from=master` (local); when `behind_count > 0` and clean, run `FF_LOCAL_MASTER` then `CREATE_FROM_LOCAL_MASTER`; forbid `CREATE_FROM_ORIGIN` and silent CREATE from `dev` (regression: EP-20260803 + 2026-08-10).
- For continuous sync, confirm `sync_key`, source ref, trigger mode, and last successful checkpoint; if checkpoint is missing and initial baseline cannot be verified, stay `BLOCKED`.
- When the user only asks for analysis: generate `ANL-SOURCE` and `BLP` only without a valid handoff snapshot; with a valid snapshot, only run the freshness gate and current-target `ANL-TARGET` — no business code.
- When the user asks migrate or change, continue implement after analysis; without explicit ask, do not commit or push on your own.
- When the agent auto-advances to the next project, the predecessor must reach `HANDOFF_READY`; when the current message explicitly names a target and asks implement, use that target’s `EXECUTION_READY` — do not require other siblings first.
- With `handoff_ref`, run the freshness gate first; `STALE/BROKEN` MUST NOT continue; `PARTIAL` MUST NOT bypass `MUST`-impacting source gates.

### 2. Establish repo facts

In each repo, follow that repo’s `AGENTS.md` and architecture gates. At least check:

- Relevant `ARCHITECTURE.md` sections, `package.json`, current branch, and worktree status.
- Real chain: route/entry -> page -> component -> API -> store/request wrapper.
- API paths, params, response wrappers, error codes, and error-message ownership.
- Target-only entrypoints, feature flags, tenant differences, permissions, and legacy conditions.
- Existing tests, lint, build, and commit hooks on the target.

Locate code with `rg`/Grep, Git, and targeted reads.

### 3. Generate formal requirements

- First port: generate formal requirement blueprint from `ANL-SOURCE`; do not hand-write scattered AI requirement docs.
- Later sync: generate a new blueprint that inherits prior requirements only on product-behavior change; bug fixes that keep the product contract reuse original `BLP-* / REQ-*`.
- Turn `MUST` and confirmed `TARGET-ONLY` into traceable `REQ-*` and acceptance criteria.
- Put `DO-NOT-PORT` in out-of-scope; keep `UNRESOLVED` and block fake readiness pass.
- On readiness `Fail`, stop; on `Review`, fully pass caveats to target analysis and plan.
- After source requirements are handoff-ready, generate the handoff snapshot; when the target hits a valid snapshot, reuse formal requirements — do not regenerate the blueprint.

### 4. Review target and decide port

Build a matrix:

| Capability / acceptance | Source evidence | Target entry | Target difference | Decision | Minimal files | Razor exclusions |
|---|---|---|---|---|---|---|
| Business behavior | session/doc/commit/file:line | call chain or missing | contract/framework/exclusive entry | DIRECT/ADAPT/EXTEND/BLOCKED/N/A | files | not ported |

- Same-named directories, methods, and APIs are clues only.
- Capabilities present on source but absent on target are not auto-created; first decide `N/A` or `BLOCKED`.
- Extra target entrypoints MUST be accepted separately as `EXTEND`.
- Frontend changes MUST NOT auto-port to admin (or vice versa) just because of “same brand”.

### 5. Design the narrowest patch

- Every changed line must trace to a `MUST` in the requirement ledger or that target’s `TARGET-ONLY`.
- Reuse the target’s existing API wrappers, state, components, constants, error handling, and test style.
- No whole-branch cherry-pick and no whole-file overwrite unless common baseline, isomorphic content, and no target-only logic are proven.
- Do not unify target legacy “for maintainability”; keep only new or this-round-changed logic consistent.
- `.gitignore`, requirement drafts, generated files, local tools, and unrelated formatting default into the razor list.

Extra checks for APIs or async UI:

- Slow-request loading scope and action locks.
- Dialog close, object switch, duplicate requests, and late responses (races).
- Form, captcha, slider, countdown, and previous-object state reset.
- Whether global and local toasts duplicate.
- Fail-open vs fail-closed vs legacy fallback on request failure.

Hand the reviewed matrix to implement planning so `plan.json` and each `TASK-*` trace to `REQ-*` or a temporary source-cited `MUST` ledger, target analysis, and minimal file scope. Only `MUST`-impacting `UNRESOLVED` or `BLOCKED` stops implement; pending review, UAT, family plan, or canonical handoff records MUST NOT masquerade as business blockers.

### 6. Implement increments

Entering this section means `EXECUTION_READY`. If the current request clearly asks implement, after the minimal plan you MUST continue changing business code and focused tests in the same turn unless a new `MUST`-impacting hard block appears; do not end after only updating task status, scratch, blueprint, or family plan.

- New feature: port the full behavior loop, not accidental source structure.
- Bug fix: first prove the same root cause exists on the target; if not, do not change.
- Add requirement: port only the new delta from the last accepted state.
- Delete requirement: remove the corresponding behavior; clean only code introduced by that feature and confirmed without consumers.
- Product reversal: overwrite old behavior with the latest and check residual old state/conditions.

When the user already has local edits, collaborate — do not overwrite, revert, or format unrelated content. Multiple targets implement, verify, and commit separately.

Update the family delivery plan after every status change. When the source meets handoff gates, generate or update the immutable handoff snapshot; after the current project finishes, produce a cross-session handoff package with at least prior session ID, `snapshot_id`, `handoff_ref`, project path and role, branch, HEAD, verification commit range, `BLP/ANL/PLN/VRF/REV` refs, plan location, next target and derived branch, unresolved items, and `TARGET-ONLY / DO-NOT-PORT`. New sessions verify snapshot freshness, Git, and target source facts before consuming old-session evidence.

After continuous sync completes, record in the target delivery report: `sync_key`, `last_source_head`, `current_source_head`, target commit, and artifact chain. Only when step-7 verification meets the implemented checkpoint, or target analysis meets a `NO_CHANGE_REQUIRED` zero-change checkpoint, mark `current_source_head` as the new synced baseline.

### 7. Layered verification

Each target at least:

1. Agent runs non-browser checks: `git diff --check`, target-file lint, focused unit or contract tests.
2. By default skip compile, build, browser, E2E, and page-interaction self-tests; run them only when the user asks the agent to.
3. Judge whether runtime verification is necessary: changes to build config, runtime entrypoints, user interaction, routing, async state, permissions, or cross-page flows with insufficient static coverage; when no runtime impact, record `N/A` reason and continue.
4. When necessary, prompt the user for next manual tests with a minimal list from the capability matrix covering real this-round risks, and mark `READY_FOR_USER_TEST`.
5. Without user confirmation, do not write verification pass, `COMPLETED`, or `READY_FOR_HANDOFF`; after pass confirmation, write `VRF` and the family plan; on failure feedback, return to fix flow.
6. Check `git status`; re-check the worktree after commit hooks; **internally** re-review the final diff against the five criteria (do not output to the user).

User-visible verification note: one sentence for what the agent ran, what was skipped by default, `N/A`, and waiting-on-user; do not describe static checks as runtime or user acceptance.

## Delivery format (user-visible = short summary)

**Default** compact factual summary per project to the user — not a long report, not “five gates” itemization:

| Required | Content |
| --- | --- |
| Target | project role / path / branch @ short sha |
| Decision | `DIRECT` / `ADAPT` / … + one-line difference |
| Changes | file list or paths + one-line behavior |
| Verification | ran / skipped / waiting on user |
| Git | whether commit/push; dirty worktree |
| Block/next | one line only when present |

**Forbidden** (unless the user explicitly asks for “detailed report / write artifact / BLOCKED evidence”):

- Heading or list reciting “robust / razor / precise / minimal / reuse” or similar slogan checkmarks
- Default dumping of full `ANL/BLP/PLN/EXC/VRF/REV` path lists
- Ritual full skill delivery templates

**When writing to disk** (`.workflow/` artifacts, family plan, dispatch receipt): full evidence chain and self-check records are fine — those are file facts, not chat ceremony. User chat still prefers the short summary.

In continuous-sync scenarios, add one line: `sync_key`, source/target head range, whether the checkpoint advanced.
