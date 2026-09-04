# Migration handoff snapshot

## Preferred path (Ralph)

When a lead Ralph run exists, prefer: `.workflow/ralph/<run_id>/.state/handoff.json` (live flat `task-<slug>/`; leftover `tasks/<id>/` ok). SSOT remains `run.handoff`. Fallback: leftover `.workflow/ralph/RALPH-*/handoff/handoff.json`. Users only say natural language such as “hand off to …”. Legacy csv-wave is **read-only** compatibility.

Handoff snapshot passes already-converged source requirement semantics to multiple target projects. It solves the duplication and understanding drift of “every target re-reads the full source session and requirement docs”. It does not replace formal requirements and does not cache target source facts.

## Core boundaries

- `BLP-* / REQ-*` remain the only formal-requirements source of truth.
- Snapshot is an immutable derived inventory inside the source `ANL-SOURCE` artifact; MUST store only refs, source fingerprints, coverage, correction order, verification status, and target differences still to verify.
- Snapshot MUST NOT copy requirement body; MUST NOT write into `.workflow/specs/`, `.workflow/.sessions/*/status.json`, or create `.workflow/jj-same/`.
- Source Inventory entities MUST live only in the snapshot’s owning `requirement-baseline` bundle; `context-package.json` stores only `handoff_ref`, `snapshot_id`, and necessary summaries.
- Each target MUST re-verify current Git, source, call chain, and target-only behavior, and write ADAPT / plan / verify into **that repo’s** `.workflow/ralph/task-<slug>/` (`task_plan.md` = Goal / 验收 / Steps). `ANL-TARGET` / `PLN` / `EXC` remain **ids**; do not create control-root `ANL-*.md` or a second csv-wave home.

Canonical path:

```text
.workflow/.csv-wave/{date}-analyze-{topic}/
  context-package.json
  requirement-baseline/
    HOF-{feature}-{sequence}/
      handoff-snapshot.yaml
```

Field contract: [handoff-snapshot.schema.json](handoff-snapshot.schema.json).

## When to generate

Generate a snapshot when the source project enters either state:

- `PARTIAL_HANDOFF`: source commit is stable, but delivery or requirement evidence is still incomplete. MUST also give `execution_readiness`: `READY` when only source review, UAT, VRF, or handoff records are missing — targets MAY implement with caveats; `BLOCKED` when source is unstable, final requirements conflict, or `MUST`-impacting gaps exist — targets may only do high-level difference analysis.
- `READY_FOR_HANDOFF`: source commit stable, required static checks pass, required user runtime tests confirmed or evidenced `N/A`, review does not block, and no `MUST`-impacting `UNRESOLVED`. After user trigger, targets MAY fill their Ralph `task_plan.md` and the implement chain.

`handoff_status` is source handoff completeness; `execution_readiness` is whether the current target has enough facts to start coding — do not mix them. Source `review/user_test` `PENDING` can only prevent claiming `READY_FOR_HANDOFF`; it alone MUST NOT drop `execution_readiness` to `BLOCKED`.

Still maintain the family delivery plan early in source analysis; snapshot does not wait for all targets to finish. The correct trigger is “source project reaches a verifiable handoff state”, not “chat window naturally ends”.

## Freshness decision

Before a target consumes a snapshot, reassess it; do not trust old summaries:

| Freshness | Judgment | Start action |
|---|---|---|
| `FRESH` | source HEAD, session cursor, source fingerprints, parent snapshot, and canonical refs all verifiable and unchanged | `REUSE` |
| `PARTIAL` | refs verifiable, but missing sources or `UNRESOLVED` exist | `REUSE` only within allowed analysis scope; keep `BLOCKED` when `MUST` is impacted |
| `STALE` | source HEAD, session cursor, requirement-doc hash, or explicit user requirement changed | `REFRESH_SOURCES` — read only changed sources and generate a successor |
| `BROKEN` | schema, parent chain, source repo, canonical refs, or provenance unresolvable | `REBASELINE`; if unrecoverable, `BLOCKED` |

`seal_freshness` inside the snapshot only records the generation-time `FRESH` or `PARTIAL` claim and MUST NOT be rewritten. The target session MUST write the current `FRESH / PARTIAL / STALE / BROKEN` assessment into its analysis or decision report, and MUST output exactly one start action: `REUSE / REFRESH_SOURCES / REBASELINE / BLOCKED`.

## Prepare handoff

When running prepare-handoff (e.g. `$jj-same prepare-handoff` / user “准备交接”):

1. Verify source repo, origin, business role, branch, HEAD, worktree, and verification results.
2. Build Source Inventory from source session, current user requirements, requirement docs, Git, and existing artifacts.
3. Record latest explicit user corrections as supersession; old docs MUST NOT override the new definition.
4. Verify `ANL-SOURCE`, `BLP/REQ`, and family coordination plan refs.
5. From missing sources, `UNRESOLVED`, review, and UAT, generate `PARTIAL_HANDOFF` or `READY_FOR_HANDOFF`, and independently compute `execution_readiness`.
6. Write a new immutable snapshot; when an existing snapshot would change, create a successor with `parent_snapshot` pointing at the old version — do not rewrite the old file in place.
7. Register `snapshot_id`, `handoff_ref`, source HEAD, and status in source `context-package.json` and the family coordination plan.

## Consume handoff

When running consume-handoff (e.g. `$jj-same handoff=@.../handoff-snapshot.yaml` / user “交接=@…”):

1. Parse snapshot schema; verify source repo, HEAD, session cursor, source fingerprints, and all canonical refs.
2. Output freshness, `execution_readiness`, and exactly one start action.
3. On `REUSE`, consume shared `ANL-SOURCE / BLP/REQ` directly; MUST NOT regenerate source analysis or blueprint in the target repo.
4. On `REFRESH_SOURCES`, read only changed, new, restored, or `UNRESOLVED`-linked sources and generate a successor snapshot in the source artifact owner repo; targets MUST NOT privately rewrite shared requirements.
5. On `REBASELINE`, return to the source artifact owner repo to rebuild source analysis and blueprint refs; target stays `BLOCKED`.
6. Target Ralph `task_plan.md` / progress MUST record consumed `snapshot_id`, `handoff_ref`, snapshot hash, source HEAD, and freshness evidence (`ANL-TARGET` as id only).
7. When the current target finds differences that apply only to itself, write `TARGET-ONLY / DO-NOT-PORT / N/A`; when shared product semantics change, return to the source for a requirement delta and successor snapshot.

## Update handoff

When source requirements, implementation, or verification status change, call on the source artifact owner repo:

```text
$jj-same update-handoff handoff=@<absolute path to old handoff-snapshot.yaml> session=<source requirement session id> source_commit=<new commit> change=<requirement correction or bug fix>
```

Natural-language / Chinese form (user utterance):

```text
$jj-same 更新交接 交接=@<旧 handoff-snapshot.yaml 绝对路径> 会话=<源需求会话 ID> 源提交=<新 commit> 变更=<需求纠正或 bug fix>
```

Rules:

1. Old snapshot MUST be read-only and used as `parent_snapshot`.
2. Re-read only sources whose fingerprint changed, are new, restored, or linked to `UNRESOLVED`.
3. Product-behavior change MUST update canonical `BLP/REQ` first; pure bug fix MAY reuse original requirement refs.
4. Output new `snapshot_id`, `handoff_ref`, source HEAD, seal freshness, and change summary.
5. Family plan MUST mark which targets consumed the old version and which need delta reconciliation.
6. The snapshot successor itself MUST NOT advance any target’s `last_source_head`.

## Delta and continuous sync

- When source HEAD is unchanged and only verification evidence for the same requirement is added, MAY generate an evidence-only successor without new product requirements.
- When product behavior is added, removed, corrected, or restored, MUST first generate a new `BLP/REQ` that inherits prior requirements, then generate the successor snapshot.
- Bug fixes that do not change the product contract MAY reuse original `BLP/REQ`, but the snapshot MUST record the new source HEAD, root cause, and acceptance refs.
- Snapshot updates do not advance `last_source_head`. Delivery checkpoints still advance only via successful target `VRF/REV` or evidenced `NO_CHANGE_REQUIRED`.

## Minimal handoff output

```yaml
schema_version: jj-same/handoff-snapshot/1.0
snapshot_id: HOF-password-reminder-001
parent_snapshot: null
feature: password-update-reminder
created_at: 2026-07-14T16:00:00+08:00
handoff_status: READY_FOR_HANDOFF
execution_readiness: READY
seal_freshness: FRESH
source:
  repo: /path/to/org-a/project-a
  role: ProjectA
  ref: feat/pa-0717-3
  head: c0c360f9d
  thread_id: 019f...
canonical:
  anl_source_ref: ANL-...
  blueprint_ref: BLP-...
  requirement_refs: [REQ-001]
  family_plan_ref: PLN-...
source_inventory:
  - source_id: source-thread
    type: thread
    locator: 019f...
    fingerprint: last-event:U19
    status: AVAILABLE
requirement_ledger:
  must:
    - id: REQ-001
      requirement_ref: BLP-.../requirements/REQ-001.md
      status: CONFIRMED
  do_not_port: []
  unresolved: []
verification:
  commit_stable: true
  static_checks: PASS
  review: PASS
  user_test: PASS
target_candidates: []
```
