# jj-evaluated report — EP-20260907-grok-review-subagent-waves

> Status: **search sample + candidate C-review-delta-reuse-v1** (user asked to land the skill after this sample; holdout empty)
>
> Skill: `$jj-evaluated` → `$jj-review`
>
> Recorded: 2026-09-07
>
> Note: full report lives under versioned `docs/evaluations/` (jj-flow forbids repo-local `.workflow/`).
>
> User: `/jj-evaluated` on Grok session `01a07980-e717-7872-9d13-87639d324c6b` (cwd `D:\2025\seo-daji-web`)

## 1. Episode and role mapping

| Field | Value |
| --- | --- |
| episode_id | `EP-20260907-grok-review-subagent-waves` |
| skill under eval | `$jj-review` (host Grok `/review` subagent path) |
| host | Grok (`agent_name=grok-build-plan`, `reasoning_effort=high`, `yolo_mode=true`) |
| thread_id | `01a07980-e717-7872-9d13-87639d324c6b` |
| run_id | `task-buyer-enter-dynamic` |
| role | omitted — not 项目A / 项目B / 项目C |
| evidence provenance | Grok `summary.json` / `signals.json` / `events.jsonl` / subagent `meta.json` (`user_export` + `thread`) |

### Role map (this episode only)

| Label | Path | Fact |
| --- | --- | --- |
| origin repo | `D:\2025\seo-daji-web` | `feat/dynamic-form` `bc9f6b477ae76117df344474b61bd8d2d72b5451`; ralph `task-buyer-enter-dynamic` |
| session export | `C:\Users\motou\.grok\sessions\D%3A%5C2025%5Cseo-daji-web\01a07980-e717-7872-9d13-87639d324c6b\` | 3× `[reviewer] local changes` subagents |
| harness | `D:\daji-docs\jj-flow` | candidate lives here; session export is evidence, not control-plane truth |

Do not rename these to 项目A/B/C.

## 2. Baseline table and clock-quality caveats

| Metric | Value | clock_quality | timestamp_provenance |
| --- | ---: | --- | --- |
| session created_at | 2026-09-07T01:34:46.041Z | derived | user_export `summary.json` |
| session last_active_at | 2026-09-07T03:37:29.250Z | derived | user_export `summary.json` |
| wall_span (created→last_active) | 7363 s (~2 h 3 min) | inconsistent | disagrees with `signals.sessionDurationSeconds=7151` |
| signals sessionDurationSeconds | 7151 s | derived | user_export `signals.json` |
| reviewer 1 `01a079ab` | 399.836 s / 48 tools | exact | subagent `meta.json` `duration_ms` |
| reviewer 2 `01a079ca` | 422.614 s / 47 tools | exact | subagent `meta.json` |
| reviewer 3 `01a079df` | 580.357 s / 49 tools | exact | subagent `meta.json` |
| reviewer-wave active sum | 1402.807 s (~23.4 min) | exact | sum of three `duration_ms` |
| compactionCount / tokens before compact | 2 / 480632 | derived | `signals.json` |
| active_duration (parent tools / stream) | not scored | unknown | parent `tool_completed.duration_ms` was 0 in this export |
| artifact_write_span | not used as authority | — | mtime forbidden |

Caveats:

- Subagent `duration_ms` is the only `exact` clock. Parent-turn active time from earlier diagnosis used per-turn `phase_changed` and is **not** copied into this episode (would be `derived` / possibly `inconsistent`).
- `signals.sessionDurationSeconds` (7151) ≠ summary created→last_active (7363). Combined wall = `inconsistent`.
- Host settings (`reasoning_effort=high`, `grok-build-plan`, 480k-token compact) are confounds, not skill text.
- Chat/memory cannot advance ralph checkpoints. This report does not write `run.json`.

`validate` 2026-09-07: `ok=true` shape=`episode_wrapper` events=7 warnings=0. `check-split`: `ok=true` warnings=0.

## 3. Failure / behavior tags and causal hypotheses

| Tag | Evidence ref | Hypothesis |
| --- | --- | --- |
| `subagent_overhead` | three `meta.json` `description="[reviewer] local changes"` | Grok host `/review` always one-shots a new reviewer (`The reviewer is not resumed`) |
| `redundant_analysis` | all three `effective_context_source=new`; review 2+3 same 6 dirty files | Follow-up `/jj-review` after 「按审查改」 re-scanned the tree instead of delta |
| `user_correction` | T0 + T7 `/jj-ralph 按审查改`; T5 + T9 `/jj-review` | ralph-fix ↔ review ping-pong is the user loop; harness made each review a full spawn |
| `evidence_gap` | parent `tool_completed.duration_ms=0` | Cannot exact-score parent-tool wait from this export |

### Artifact-backed timeline

```text
01:34:46  session open 01a07980
01:36:18  T0 /jj-ralph 按审查改
02:18:42  T5 /jj-review
02:20:57–02:27:37  reviewer 1  399.8s  48 tools  context=new
02:36:41  T6 (compaction in this window per prior diagnosis)
02:53:21  T7 /jj-ralph 按审查改
02:54:45–03:01:47  reviewer 2  422.6s  47 tools  context=new  (prompt listed prior OPEN F-1/F-2/F-3)
03:17:40  T9 /jj-review
03:18:30–03:28:11  reviewer 3  580.4s  49 tools  context=new  (same 6 files)
03:30:44  T11 /jj-end
03:37:29  last_active
```

Causal hypothesis (falsifiable): **if follow-up `$jj-review` on the same bound run in the same thread reuses the latest `REV-*` / host review file and only inspects files changed since `reviewed_commit`, then a second and third full-repo `[reviewer]` spawn with `effective_context_source=new` does not happen.**

Falsifier: a follow-up where the dirty set is a new whole-tree concern, or the user explicitly asks for a fresh whole-tree review.

## 4. Optimization / holdout / regression split

| Set | Members |
| --- | --- |
| optimization/search | `EP-20260907-grok-review-subagent-waves` |
| holdout | empty (n=1; do not invent) |
| regression | `G-review-1` in `evals/regression/EP-20260907-grok-review-subagent-waves.json` |

Leakage check: this thread is not in holdout. Proposer saw only this search sample.

## 5. Candidate change

| Field | Value |
| --- | --- |
| candidate_id | `C-review-delta-reuse-v1` |
| expected mechanism | Same-thread follow-up `$jj-review` on the same bound run is a **delta review**: reuse prior `REV-*` / host findings; do not spawn a second full-repo reviewer subagent. First review of the run may still use host `/review` once. |
| bounded diff / asset | `skills/jj-review/SKILL.md` + `references/host-review.md` (+ command/docs/zh-bridge/contract test/regression) |
| non-goals | Do not edit Grok bundled `/review` skill; do not change `reasoning_effort` / plan mode; do not merge ralph-fix + review into one command; do not auto-fix in the review turn; do not treat tests green as review PASS |

## 6. Replay results

| Suite | Result | Notes |
| --- | --- | --- |
| contract / schema | PASS | `validate` ok events=7; `check-split` ok; holdout empty |
| search subset | n=1 qualitative | this episode only |
| full search | same | no second search case |
| holdout | skipped | empty; not leaked |
| regression | landed | `evals/regression/EP-20260907-grok-review-subagent-waves.json` (`G-review-1`) |

Token / time trade-offs: expected save is the second+third reviewer (~1003 s exact, 96 tools) per similar loop. First review still pays one host spawn. Correctness: delta must re-check prior OPEN items (review 2 already listed them in the prompt — the waste was the new-context full read, not missing the checklist).

## 7. Human decision

| Field | Value |
| --- | --- |
| reviewer | user (this session) |
| decision | approve land of `C-review-delta-reuse-v1` after sample ingest |
| reward-hacking check | not optimizing by skipping review; still require a first host review and re-check OPEN items |
| leakage check | holdout empty; no holdout scores shown to proposer |
| unsafe-autonomy check | review stays read-only; no same-turn fix |

## 8. Promotion status and rollback

| Field | Value |
| --- | --- |
| promotion status | landing in the same harness change as this report (user order: commit end-copy → sample → change jj-review) |
| promoted assets | `skills/jj-review/` |
| rollback path | revert the jj-review skill commit; regression case fails closed |
| next data-collection action | a second independent Grok/Codex same-thread review-wave episode for holdout |

---

Generated from real Grok session export + `evaluated_ops` CLI. Fill remaining CLI stamps in the next section after commands run.
