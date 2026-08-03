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
| Map authority | Absolute paths under `/portfolio/...` as currently observed |

Role mapping used for this sample:

| Role | Repository | Observed head at evaluation |
| --- | --- | --- |
| 项目A | `/portfolio/project-a` | `fix/inquiry-face-info-checkmark@860417f90ae4` (clean) |
| 项目B | `/portfolio/project-b` | `fix/inquiry-face-info-checkmark@cb2c38a3e65a` (clean) |
| 项目C | `/portfolio/project-c` | `fix/inquiry-face-info-checkmark@8257da360bd3` (clean) |
| 项目E | `/portfolio/project-e` | `dev@e4a5ff98ba80` (clean) |
| 独立 SDK | `/portfolio/project-sdk` | `master@2fb27ef0e6ff` (clean) |

Do not rename 项目A/项目B/项目C to generic `handoff`. Independent SDK is outside the three product roles.

## 2. Episode inventory

Evidence hashes are SHA-256 prefixes of the listed artifact at evaluation time.

### EP-20260728-01 — AppCode + logger

| Field | Value |
| --- | --- |
| run_id | `RALPH-appcode-logger-20260728` |
| repo / role | `project-sdk` / independent SDK |
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
| repo / role | `project-c` / 项目C |
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
| repo / role | `project-e` / 项目E |
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
| repo / role | `project-e` / 项目E |
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
| repo / role | source `project-a` / 项目A; targets `project-b` 项目B + `project-c` 项目C |
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
- 项目B: DIRECT, head `cb2c38a3e`, `LANDED_ON_DEV` merge `87581b6f1`
- 项目C: DIRECT, head `8257da360`, `LANDED_ON_DEV` merge `7d5fd4382`
- CDN/native domains preserved per REV-2

This is the holdout / golden-path episode for the window.

### Apbacent evidence (not primary episodes)

- `/portfolio/project-a\\.workflow\\scratch\\20260728-handoff-aliyun-tracker-to-pc\\handoff.md` — same/handoff scratch for tracker port; useful later for cross-repo knowledge attach, not scored here.
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
| Portable skill sync | `skills/jj-ralph/scripts/lib/ralph.mjs` + `.grok/skills/jj-ralph/**` present with product-consistency text in `phases.md` |
| Working tree | jj-flow `main` **ahead 1** of origin; gate/eval changes still **uncommitted** (local only) |
| Host attestation | Still missing: all sampled runs keep `thread_id/task_thread_id/review_thread_id = null` |
| Role heads re-check | `project-a@860417f90` / `project-b@cb2c38a3e` / `project-c@8257da360` on `fix/inquiry-face-info-checkmark`; draft-manager `dev@e4a5ff9`; recognize `feat/pc-0731-dev@1e3fb4726` |

### Apbacent episodes in the same wall window (not re-scored)

| Episode | Evidence | Note |
| --- | --- | --- |
| list-acceptor-tag | `/portfolio/project-a/.workflow/ralph/RALPH-list-acceptor-tag-20260727` | 2026-07-27 family wave |
| pay-password-autofocus | `/portfolio/project-a/.workflow/ralph/RALPH-pay-password-autofocus-20260727` | 2026-07-27 |
| aliyun-tracker handoff scratch | project-a scratch + pc TASK-aliyun-tracker-port-pc | same/port, not full family COMPLETED sample |
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

---

## 11. Iteration-3 re-evaluation (2026-07-29 late)

Fresh `$jj-evaluated` pass after v1 landed on `main`. Read-only over business repos; evaluation authority is this file + git/artifact facts.

### Authority re-check

| Field | Value |
| --- | --- |
| jj-flow HEAD | `3dd7624` `feat(ralph): product-consistency gate and multi-env port evidence` |
| origin/main | same as HEAD (v1 no longer local-only) |
| Contract tests | `node --test tests/jj-ralph-contract.test.mjs` -> **15/15 PASS** |
| Host attestation | still missing on all sampled ralph runs |

Role heads at iteration-3:

| Role | Repository | Head |
| --- | --- | --- |
| 项目A | `/portfolio/project-a` | `fix/inquiry-face-info-checkmark@860417f90ae4` (clean) |
| 项目B | `/portfolio/project-b` | `fix/inquiry-face-info-checkmark@cb2c38a3e65a` (clean) |
| 项目C | `/portfolio/project-c` | `feat-channel-zj@9f4cff5cba51` (clean) **changed from baseline** |
| 项目E | `/portfolio/project-e` | `dev@e4a5ff98ba80` (clean) |
| 项目D | `/portfolio/project-d` | `feat/pc-0731-dev@1e3fb4726644` (clean) |

### New episode — EP-20260729-06 order-filter-bizserialid

| Field | Value |
| --- | --- |
| run_id | `RALPH-order-filter-bizserialid-20260729` |
| repo / role | `project-c` / 项目C |
| status | COMPLETED / ARCHIVE |
| created_at -> updated_at | `2026-07-29T09:10:00Z` -> `2026-07-29T09:10:54Z` |
| wall_span (artifact) | ~0.9 min |
| active_duration | unknown |
| clock_quality | inconsistent |
| timestamp_provenance | artifact (`run.json`) + fabricated progress sequence (`00:00Z`...`00:03Z`) |
| outcome | gates all PASS; single-file fix committed as `9f4cff5cb` |
| review | none |
| tags | `target_native_adaptation`, `clock_inconsistency`, `evidence_gap` (no host/session; synthetic progress clock) |
| key refs | `run.json#8dea70bf1ace`, `plan.md#e0c4ac4d4c6f`, `acceptance.md#644d6fb164f8`, `progress.md#99092ce43a26`, archive `2026-07-29-order-filter-bizserialid` |

Ledger vs code: plan/acceptance name `sdm-detail-list.vue` and `bizSerialId`; git shows only that file changed (+2/-3). Path consistency would PASS under candidate v1.

Usability note: progress timestamps are placeholder-like and must not be used for active-time comparisons.

### EP-02 drift deepened (still search set)

`RALPH-zf-zj-align-huiyuan-20260729` remains `IN_PROGRESS` / `PLAN` with deliver/accept/archive PENDING, while:

- `progress.md` records DELIVER work and a product-confirmed field change;
- git has `459e72f39 fix(account): 智付中金额度字段对齐汇元并移除其它虚户分支` on `feat-channel-zj`.

Tags reinforced: `stale_snapshot`, `user_correction` (product field change), `evidence_gap` (run ledger not advanced). This is still the open incomplete multi-step delivery in the window; do not score it as COMPLETED.

### Scorecard delta

| Episode | Prior | Iteration-3 |
| --- | --- | --- |
| EP-01..05 | unchanged | unchanged |
| EP-06 order-filter | n/a | success, path-consistent, no review, synthetic progress clock |
| EP-02 zf-align | incomplete ledger | still incomplete; deliver commit exists outside ledger |

Aggregate reading:

- Candidate v1 remains the right promotion for EP-04-class false completes.
- EP-06 shows clean single-file ralph can still archive without review; integrity risk is low here because plan/acceptance/diff align, but host/time data remains unusable.
- EP-02 is now a stronger example of **deliver-outside-ledger**: code landed, run stayed PLAN.
- Dominant open evolution debt is no longer commit-v1; it is **run/progress rebinding after mid-run strategy or deliver** (H1) plus **host observability** (H5/v3).

### Split update (still frozen for v1; additive only)

| Split | Episodes | Note |
| --- | --- | --- |
| optimization/search | EP-02, EP-03, EP-04 (+ EP-06 clock/progress as secondary) | EP-02 remains primary incomplete-ledger case |
| holdout | EP-05 | still protected family LITE success |
| regression | EP-01 + EP-06 (path-consistent no-review archive) + historical handoff-freshness | EP-06 protects matching single-file ledger still archives under v1 |

Do not move EP-05 or EP-04 across splits.

### Candidate status

| Item | Status |
| --- | --- |
| Candidate v1 (product-consistency gate) | **committed on main** `3dd7624`; contract 15/15 PASS |
| Candidate v2 (review_scope / fix_commit) | still proposed; v1 commit gate cleared; implement only with human approval |
| Candidate v3 (host/session metadata) | still blocked on exports / schema usage |
| Candidate v4 (proposed) | **run rebinding after deliver**: when progress/commits show deliver work, refuse to leave run at PLAN without explicit supersede/continue record; falsifier = intentional multi-run split with new run_id |

### Next action

1. Keep v1 as regression-protected behavior; no further skill edit without a new approved candidate.
2. Prefer human decision on v2 vs v4: commit-identity for reviews vs incomplete-run rebinding for mid-flight delivers.
3. If Grok/Codex session exports for EP-02/EP-06 become available, recompute active/wait times before any host-time optimization.
4. Business repositories remain evaluation inputs only; no auto-fix of EP-02 ledger from this skill.


---

## 12. Candidate v2/v4/host implementation (2026-07-29)

Implemented in jj-flow `src/ralph.mjs` + CLI + schema + phases:

| Candidate | Mechanism | Tests |
| --- | --- | --- |
| v2 | `review_scope`/`fix_commit`; ARCHIVE blocks working_tree PASS | contract case pass |
| v4 | accept/archive require deliver PASS; deliver-outside-ledger detection | contract case pass |
| v3 data plane | optional `run.host` + `jj ralph host-record` | contract case pass |

`node --test tests/jj-ralph-contract.test.mjs` → 18/18 PASS.
Promotion still needs human commit/release of this change set; business repos untouched.
