# Grok Episodes Baseline — 2026-07-28 ~ 2026-07-29

> Status: baseline / read-only evaluation
>
> Skill: `jj-evaluated`
>
> Scope: summarize recent Ralph/same episodes that the user reports were executed on Grok; derive one promotion candidate.
>
> Non-goals: do not edit production skills, business repositories, or control-plane checkpoints in this document.

## 1. Scope and authorities

| Field | Value |
| --- | --- |
| Evaluation date | 2026-07-29 |
| Host claim | User-reported Grok runs for the last ~2 days |
| Host evidence in artifacts | **Missing**: all sampled `run.json` / review records have `thread_id` / `task_thread_id` / `review_thread_id` = `null`; no `host_id=grok-build` field |
| Host label used here | `host=inferred:grok` |
| Control-plane authority | Not used. Grok Host Adapter Phase 1 is contract-only; no Phase 3 real-run attestation. |
| Business evidence authority | Per-repo `.workflow/ralph/**` artifacts + git heads at evaluation time |
| Map authority | Absolute paths under `D:\\a\\...` as currently observed |

Role mapping used for this sample:

| Role | Repository | Observed head at evaluation |
| --- | --- | --- |
| 承接用户端 | `D:\\a\\cj-web` | `fix/inquiry-face-info-checkmark@860417f90ae4` (clean) |
| 兑接用户端 | `D:\\a\\dj-web` | `fix/inquiry-face-info-checkmark@cb2c38a3e65a` (clean) |
| 承载用户端 | `D:\\a\\cz-broker-web` | `fix/inquiry-face-info-checkmark@8257da360bd3` (clean) |
| 承载草稿管理 | `D:\\a\\cz-draft-manager-web` | `dev@e4a5ff98ba80` (clean) |
| 独立 SDK | `D:\\a\\rd-sdt-tracker` | `master@2fb27ef0e6ff` (clean) |

Do not rename 承接/兑接/承载 to generic `handoff`. Independent SDK is outside the three product roles.

## 2. Episode inventory

Evidence hashes are SHA-256 prefixes of the listed artifact at evaluation time.

### EP-20260728-01 — AppCode + logger

| Field | Value |
| --- | --- |
| run_id | `RALPH-appcode-logger-20260728` |
| repo / role | `rd-sdt-tracker` / independent SDK |
| status | COMPLETED / ARCHIVE |
| created_at → updated_at | `2026-07-28T08:22:30Z` → `2026-07-28T08:30:39Z` |
| wall_span (artifact) | ~8.1 min |
| active_duration | unknown |
| clock_quality | derived |
| timestamp_provenance | artifact (`run.json`) |
| outcome | gates all PASS; acceptance claims typecheck + 47 unit tests PASS |
| review | none recorded |
| tags | `validation_evidence_present` |
| key refs | `run.json#b7b2bbd37b16`, `acceptance.md#94f7720a41e8`, `progress.md#6f16f21f2734` |

Notes: clean single-repo delivery with machine-checkable acceptance. Good regression candidate for “SDK-style ralph with tests”, weak as a product-family handoff sample.

### EP-20260729-02 — 智付中金对齐智付汇元

| Field | Value |
| --- | --- |
| run_id | `RALPH-zf-zj-align-huiyuan-20260729` |
| repo / role | `cz-broker-web` / 承载用户端 |
| status | IN_PROGRESS / PLAN |
| created_at → updated_at | `2026-07-29T05:36:10Z` → `2026-07-29T05:38:04Z` |
| wall_span (artifact) | ~1.9 min (ledger timestamps only) |
| active_duration | unknown |
| clock_quality | inconsistent |
| timestamp_provenance | artifact + progress free text |
| outcome | analyze/plan PASS; deliver/accept/archive PENDING |
| review | none |
| tags | `stale_snapshot`, `user_correction` (suspected) |
| key refs | `run.json#046496fc3317`, `analyze.md#9c64f1ccf803`, `plan.md#f337a1a8a33e`, `progress.md#1381f51920ca` |

Drift: `run.json` still says PLAN, but `progress.md` already records DELIVER work and a product-confirmed field change for quota tips. This episode is incomplete and must not be scored as a finished delivery.

### EP-20260729-03 — 票面预览关闭按钮失效

| Field | Value |
| --- | --- |
| run_id | `RALPH-ticket-face-close-20260729` |
| repo / role | `cz-draft-manager-web` / 承载草稿管理 |
| status | COMPLETED / ARCHIVE |
| created_at → updated_at | `2026-07-29T06:36:43Z` → `2026-07-29T06:38:40Z` |
| wall_span (artifact) | ~2.0 min |
| active_duration | unknown |
| clock_quality | derived |
| timestamp_provenance | artifact |
| outcome | gates PASS; REV-1 PASS with WAIVED uncommitted-fix finding |
| review | `REV-1` PASS (`26a260a3672c`) |
| tags | `uncommitted_fix_review`, `target_native_adaptation` (component-local) |
| key refs | `run.json#913586a7bc11`, `analyze.md#dd29f64fcfca`, `REV-1.json#26a260a3672c` |

Causal note: review explicitly says fix was still in the working tree and `reviewed_commit` was baseline HEAD. At evaluation time the worktree is clean on `dev`, so either the fix landed later without binding a fix commit into this run, or the archive completed without a durable reviewed commit identity.

### EP-20260729-04 — Esc 关闭后一键发布仍选中

| Field | Value |
| --- | --- |
| run_id | `RALPH-publish-esc-focus-20260729` |
| repo / role | `cz-draft-manager-web` / 承载草稿管理 |
| status | COMPLETED / ARCHIVE |
| created_at → updated_at | `2026-07-29T06:45:21Z` → `2026-07-29T06:50:14Z` |
| wall_span (artifact) | ~4.9 min |
| active_duration | unknown |
| clock_quality | derived |
| timestamp_provenance | artifact |
| outcome | gates claim PASS, but latest review is `NEEDS_CHANGES` |
| review | `REV-1` NEEDS_CHANGES (`35ba0a719f27`), 2 OPEN findings |
| tags | `stale_snapshot`, `user_correction`, `false_completed_archive`, `acceptance_implementation_drift` |
| key refs | `run.json#eccd1d8fe07f`, `plan.md#aa0b7a16dc4f`, `acceptance.md#578bcdc0ef35`, `REV-1.json#35ba0a719f27` |

Trace-backed failure:

1. Plan/acceptance prescribe `publish-dialog.vue` + `batch-publish-dialog.vue` `@closed` blur.
2. Review says working tree actually changed `InventoryManager.vue` CSS `.link-btn:focus-visible`.
3. Archive still completed with ACCEPT/ARCHIVE PASS while OPEN medium finding remains.

This is the highest-value failure cluster in the window.

### EP-20260729-05 — 询单票面已回复未打勾 + family port

| Field | Value |
| --- | --- |
| run_id | `RALPH-inquiry-face-checkmark-20260729` |
| repo / role | source `cj-web` / 承接; targets `dj-web` 兑接 + `cz-broker-web` 承载 |
| status | COMPLETED / ARCHIVE |
| created_at → updated_at | `2026-07-29T08:14:24Z` → `2026-07-29T08:20:29Z` |
| wall_span (artifact) | ~6.1 min for source ledger only |
| extended span (progress free text) | progress continues to ~`08:35Z` for same/end (~21 min source-to-end narrative) |
| active_duration | unknown |
| clock_quality | inconsistent across run.json vs progress narrative timestamps |
| timestamp_provenance | artifact + progress free text |
| outcome | source PASS; handoff LITE READY; ports landed on dev per handoff |
| review | REV-1 PASS source; REV-2 PASS ports |
| tags | `handoff_reuse`, `target_native_adaptation`, `family_port_success` |
| key refs | `run.json#0aa9eeb92aa1`, `handoff/handoff.json#70ace65aa1e3`, `REV-1.json#91f014250734`, `REV-2.json#a55bf0fbcdff` |

Handoff facts from `handoff.json`:

- mode: `LITE`
- source_head: `860417f90ae460bfae38690feb0dc0722a5309fe`
- 兑接: DIRECT, head `cb2c38a3e`, `LANDED_ON_DEV` merge `87581b6f1`
- 承载: DIRECT, head `8257da360`, `LANDED_ON_DEV` merge `7d5fd4382`
- CDN/native domains preserved per REV-2

This is the holdout / golden-path episode for the window.

### Adjacent evidence (not primary episodes)

- `D:\\a\\cj-web\\.workflow\\scratch\\20260728-handoff-aliyun-tracker-to-cz\\handoff.md` — same/handoff scratch for tracker port; useful later for cross-repo knowledge attach, not scored here.
- Older list-acceptor-tag wave under `.csv-wave` (2026-07-27) remains in historical sample set from skill bootstrap; not re-scored in this baseline.

## 3. Baseline scorecard

Durations are artifact-derived only. Do not compare active efficiency across hosts without session exports.

| Episode | Outcome | Review | Rework signal | Handoff | Efficiency signal | Usability / integrity |
| --- | --- | --- | --- | --- | --- | --- |
| EP-01 appcode | success | none | low | n/a | short artifact span + tests | high evidence quality |
| EP-02 zf-align | incomplete | none | medium drift | n/a | unknown | ledger/status drift |
| EP-03 ticket-close | partial integrity | PASS | uncommitted review | n/a | short artifact span | reviewed_commit not fix commit |
| EP-04 publish-esc | false complete | NEEDS_CHANGES | high | n/a | short artifact span misleading | plan/acceptance ≠ code |
| EP-05 inquiry-face | success family | PASS×2 | low-medium (2 reviews) | LITE reuse | best path despite clock noise | strong port evidence |

Aggregate reading:

- Correctness median is acceptable for tiny UI fixes, but integrity is uneven.
- The expensive historical problem (repeat source analysis) is **not** the dominant failure this window.
- The dominant failure this window is **ledger/implementation consistency under strategy change**.
- The dominant success this window is **LITE handoff + target-native DIRECT ports**.

## 4. Behavior tags and causal hypotheses

### H1 — Acceptance ledger does not rebind after strategy change

- Evidence: EP-04 plan/acceptance still describe blur on dialog files; review says CSS on `InventoryManager.vue`; ARCHIVE still PASS.
- Confounders: user may have asked for CSS after plan freeze; Grok may have archived from gates without re-reading review outcome.
- Falsifier: a run where implementation changes and plan/acceptance are rewritten before ACCEPT.
- Optimization implication: gate ACCEPT/ARCHIVE on path-set consistency between plan/acceptance and working tree / reviewed diff.

### H2 — COMPLETED can coexist with OPEN review findings

- Evidence: EP-04 `status=COMPLETED` + `REV-1 outcome=NEEDS_CHANGES` + OPEN medium finding.
- Confounders: review may have been written after archive finalize.
- Falsifier: ordering proof from host session timestamps.
- Optimization implication: archive gate must consume latest review outcome, not only local phase checklist.

### H3 — Review often binds baseline HEAD, not fix identity

- Evidence: EP-03/EP-04/EP-05 REV-1 all note uncommitted fix / baseline commit.
- Confounders: user may intentionally delay commit; Grok host may lack easy commit attestation.
- Falsifier: runs that require commit before review and store fix SHA.
- Optimization implication: distinguish `review_scope=working_tree|commit` explicitly; do not treat baseline HEAD PASS as landed evidence.

### H4 — Family handoff LITE path is already working when source is clean

- Evidence: EP-05 HOF ready, DIRECT ports, REV-2 PASS, landed on dev, native CDN preserved.
- Confounders: simple single-file semantic patch; may not generalize to multi-file or model-divergent ports.
- Falsifier: multi-file or divergent-target failure under same LITE path.
- Optimization implication: protect this path in regression; do not “optimize” it into heavier analysis.

### H5 — Host observability gap blocks time optimization

- Evidence: all primary episodes lack host/session/thread binding.
- Implication: token/time comparisons versus Codex are not yet scientifically usable.
- Optimization implication: before time-tuning prompts, add `host_id`, session handle, and exportable turn timestamps.

## 5. Dataset split (proposed, frozen for next iteration)

Group unit = full run_id / handoff lineage. No turn-level split.

| Split | Episodes | Purpose |
| --- | --- | --- |
| optimization/search | EP-02, EP-03, EP-04 | diagnose ledger drift, uncommitted review, false complete |
| holdout | EP-05 | protect successful family handoff generalization |
| regression | EP-01 + historical handoff-freshness cases from skill bootstrap | protect tested SDK delivery and prior handoff invariants |

Leakage checks:

- Do not use EP-05 review text while designing the candidate beyond “must not regress family LITE success”.
- Do not move EP-04 into holdout after seeing it fail; it stays search.
- Record this split as immutable for candidate v1.

## 6. Candidate change v1 (not implemented in this baseline)

### Proposal

Add a **Ralph product-consistency gate** before ACCEPT/ARCHIVE:

1. Parse planned files from `plan.md` / structured task file refs when present.
2. Parse claimed evidence files from `acceptance.md`.
3. Compare against actual diff path set (working tree or reviewed commit).
4. If mismatched and not explicitly re-baselined in analyze/plan/acceptance, force:
   - review outcome ceiling = `NEEDS_CHANGES`, and
   - ACCEPT/ARCHIVE cannot be PASS.
5. If latest review outcome is `NEEDS_CHANGES` or `BLOCKED`, archive cannot flip to COMPLETED.

### Expected mechanism

Stops EP-04-class false completes where strategy changed in code but ledger stayed on the old blur plan.

### Bounded surface

- skill/recipe text for `jj-ralph` accept/archive checks
- optional contract test fixtures under `tests/`
- no business repository mutation
- no autonomy level increase
- no host adapter Phase 2/3 scope creep

### Replay plan

1. Cheap: existing ralph/review contract tests + new fixture cloned from EP-04 shape.
2. Search: replay gate decision on EP-02/03/04 artifact snapshots.
3. Holdout: confirm EP-05 still PASS / would not be blocked.
4. Regression: EP-01 still PASS.

### Human review checklist before promotion

- No reward hacking by emptying plan file lists
- No false block on legitimate LITE ports
- No silent rewrite of business acceptance history
- Rollback target recorded

## 7. Data-collection actions

Required before a serious host/time evolution loop:

1. Export Grok session transcripts/handles for EP-01..EP-05 if still available.
2. Extend ralph run schema usage to persist:
   - `host_id` (`grok-build` / `codex`)
   - `handle_kind` + session/thread handle
   - model id
3. Require review records to set `review_scope` and bind fix commit when claiming landed evidence.
4. When strategy changes mid-run, write a new plan/acceptance revision instead of overwriting meaning in progress only.

## 8. Promotion status

| Item | Status |
| --- | --- |
| Baseline report | **recorded** (this file) |
| Candidate v1 implementation | **implemented** in `src/ralph.mjs` (`evaluateAcceptArchiveGate` + accept/archive hooks) |
| Skill/code promotion | **promoted** to portable skill lib via `npm run ralph:sync`; phases.md updated |
| Contract tests | `tests/jj-ralph-contract.test.mjs` — product-consistency cases PASS (15/15 suite) |
| Rollback | revert `src/ralph.mjs` accept/archive gate hooks + re-run `npm run ralph:sync` |

## 9. Next action

Candidate v1 is live for new accept/archive PASS attempts:

- EP-04 shape (ledger vs diff drift / NEEDS_CHANGES) is covered by contract tests.
- EP-05 holdout not blocked: clean matching single-file ledger remains PASS-capable.
- EP-01 regression: no review + clean tree / no false path claims still archives.

Remaining data-collection debt is unchanged: Grok session exports + host metadata before any time/token optimization loop.

---

## 10. Iteration-2 verification (2026-07-29 evening)

Re-ran `$jj-evaluated` on the same 2-day Grok claim window. No new business episodes since baseline freeze; verification focuses on promotion evidence and remaining evolution debt.

### Re-check results

| Check | Result |
| --- | --- |
| Contract tests | `node --test tests/jj-ralph-contract.test.mjs` -> **15/15 PASS** |
| Gate surface | `evaluateAcceptArchiveGate` wired into `setGate(accept|archive)` and `archiveRun` |
| Portable skill sync | `.codex/skills/jj-ralph/scripts/lib/ralph.mjs` + `.grok/skills/jj-ralph/**` present with product-consistency text in `phases.md` |
| Working tree | jj-flow `main` **ahead 1** of origin; gate/eval changes still **uncommitted** (local only) |
| Host attestation | Still missing: all sampled runs keep `thread_id/task_thread_id/review_thread_id = null` |
| Role heads re-check | `cj-web@860417f90` / `dj-web@cb2c38a3e` / `cz-broker-web@8257da360` on `fix/inquiry-face-info-checkmark`; draft-manager `dev@e4a5ff9`; recognize `feat/cz-0731-lyj@1e3fb4726` |

### Adjacent episodes in the same wall window (not re-scored)

| Episode | Evidence | Note |
| --- | --- | --- |
| list-acceptor-tag | `D:/a/cj-web/.workflow/ralph/RALPH-list-acceptor-tag-20260727` | 2026-07-27 family wave |
| pay-password-autofocus | `D:/a/cj-web/.workflow/ralph/RALPH-pay-password-autofocus-20260727` | 2026-07-27 |
| aliyun-tracker handoff scratch | cj-web scratch + cz TASK-aliyun-tracker-port-cz | same/port, not full family COMPLETED sample |
| jj-same UX redesign | Codex thread `019fa2ca-e865-...` | workflow evolution (handoff into ralph) |

### Candidate v2 (proposed, not implemented)

Hypothesis H3 still open after v1: reviews often PASS against baseline HEAD while the fix is only in the working tree (EP-03/04/05 REV-1). v1 blocks false ACCEPT when review is NEEDS_CHANGES or path sets drift, but does not force a fix-commit identity.

Bounded change:

1. Extend review record optional fields: `review_scope: working_tree|commit` and `fix_commit` (nullable).
2. When outcome=PASS and `review_scope=working_tree`, treat landed evidence as provisional.
3. ARCHIVE COMPLETED requires `review_scope=commit` + SHA, or no review + clean tree + path consistency.
4. Contract fixtures from EP-03 shape; holdout EP-05 must still archive after real commit identity is present.

Do not implement v2 until v1 is committed/released and human-approved.

### Candidate v3 (data plane, blocked on exports)

Persist on `run.json`: `host_id`, session/thread handle, model id, optional active-turn export path. Without this, host time/token comparisons remain non-scientific.

### Promotion status after iteration-2

| Item | Status |
| --- | --- |
| Baseline + hypotheses | confirmed |
| Candidate v1 code/tests | verified PASS locally |
| Candidate v1 release | **pending commit / npm beta bump / skill install** |
| Candidate v2 | proposed only |
| Business repos | untouched |
