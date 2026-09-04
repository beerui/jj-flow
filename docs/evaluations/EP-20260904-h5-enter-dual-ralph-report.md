# jj-evaluated report — EP-20260904-h5-enter-dual-ralph

> Status: **C-h5-enter-reuse-sibling-v1 human-approved** 2026-09-04; regression `G-h5-reuse-sibling` landed
>
> Skill: `$jj-evaluated`
>
> Recorded: 2026-09-04
>
> Note: full report lives under versioned `docs/evaluations/` (jj-flow forbids repo-local `.workflow/`).
>
> User: `/jj-evaluated 8cca3b80-f99e-427f-bdec-30d1309ffb8a`

## 1. Episode and role mapping

| Field | Value |
| --- | --- |
| episode_id | `EP-20260904-h5-enter-dual-ralph` |
| skill under eval | `$jj-dispatch` bind + `$jj-ralph` init |
| host | Grok (`runtime.deliveries.run_id` = `grok-8cca3b80-…`) |
| thread_id | `8cca3b80-f99e-427f-bdec-30d1309ffb8a` |
| delivery | `DEL-enter-form-h5-20260904` status `RUNNING` |
| role | omitted — not 项目A / 项目B / 项目C |
| evidence provenance | control-plane + ralph `run.json` / `index.md` (no raw thread export) |

### Role map (this episode only)

| Label | Path | Fact |
| --- | --- | --- |
| control | `C:\Users\motou\.jj-flow` | plane + `TASK-enter-form-h5-20260904` |
| origin / lead | `D:\2025\seo-daji-web` | `feat/dynamic-form` `dcfb809b8509`; dispatch slug ANALYZE only |
| target merchants | `D:\2025\daji-merchants-mobile` | `feat/dynamic-enter-form` `b86c2d624670`; **two** live runs |
| target buyer | `D:\2025\trade-exhibition-mobile` | `feat/dynamic-enter-form` `587153950302`; slug used for real ACCEPT |
| harness | `D:\daji-docs\jj-flow` | candidate lives here; not control-plane truth |

Do not rename these to 项目A/B/C.

## 2. Baseline table and clock-quality caveats

| Metric | Value | clock_quality | timestamp_provenance |
| --- | ---: | --- | --- |
| plane PREVIEW | 2026-09-04T08:40:00Z | derived | artifact (rounded) |
| plane APPROVED | 2026-09-04T08:49:30Z | derived | artifact (rounded) |
| merchants review-slice init | 2026-09-04T09:37:42.801Z | exact | artifact `run.json` |
| dispatch triple init | 2026-09-04T09:47:22.121Z–.145Z (24 ms) | exact | artifact |
| REV-1 → REV-5 on review-fix | 09:45:54.621Z → 10:30:38.087Z | exact | artifact |
| buyer slug last update | 2026-09-04T12:33:56.576Z | exact | artifact |
| wall_span (PREVIEW → buyer update) | ~3 h 54 min | inconsistent | plane rounded vs ralph ms |
| dual-init lag (slice → slug) | ~9 min 39 s | derived | two artifact clocks |
| review-loop wait (REV-2 → updated_at) | 1848 s | derived | artifact span; not active time |
| active_duration / tokens | unknown | unknown | no thread export |
| artifact_write_span | not used as authority | — | mtime forbidden |

Caveats:

- No raw conversation export for `8cca3b80`. Chat/memory cannot advance dispatch.
- Plane `events[].at` are minute-rounded; ralph `created_at` has milliseconds. Combined spans = `inconsistent`.
- Lone `run.json` duration is not wall time of the Grok session.
- Buyer `task-enter-form-h5` progressing to ACCEPT is **not** the same bug as merchants' empty sibling.

`validate` / `check-split` recorded in §6 after CLI.

## 3. Failure / behavior tags and causal hypotheses

| Tag | Evidence ref | Hypothesis |
| --- | --- | --- |
| `redundant_analysis` | merchants `task-enter-form-h5` ANALYZE @ 09:47:22 beside live `task-h5-enter-review-fix` | Dispatch always inited the delivery slug; ignored same-session live run |
| `stale_snapshot` | control `task.md` Ralph run_id = `task-enter-form-h5` only | Index lied about where work lived |
| `user_correction` | user: 不要 absorb/abandon；从错产物进化工作流 | Field dual-run is a teaching case, not a merge job |
| `evidence_gap` | pre-candidate `init` only saw `options.task_thread_id` | CLI `--thread-id` / `host.thread_id` did not trip same-session guard |
| `regression` | harness working tree `reuse-sibling` | Next dispatch must resume the live slice, not open a second ANALYZE |

### Artifact-backed timeline

```text
08:40     plane PREVIEW DEL-enter-form-h5-20260904
08:49:30  APPROVED 12 task_keys; lead pin dcfb809b8
08:54     lead analysis/dev/verify/review COMPLETED (receipts)
09:10     both target analyses COMPLETED
09:15     BIND merchants development; feat/dynamic-enter-form
09:25     merchants ADAPT uncommitted; delivery still RUNNING
09:37:42  task-h5-enter-review-fix created (real merchants work)
09:45:54  REV-1 NEEDS_CHANGES on review-fix
09:47:22  task-enter-form-h5 inited in seo + merchants + buyer (empty ANALYZE on seo/merchants)
09:59–10:30  REV-2..5 on review-fix; still IN_PROGRESS ACCEPT
12:33:56  buyer task-enter-form-h5 updated (ACCEPT) — productive use of the slug
```

Merchants `index.md` now has `## 同需求提示` for the review-slice. Do **not** merge/abandon those two runs.

## 4. Optimization / holdout / regression split

| Set | Episode ids | Notes |
| --- | --- | --- |
| optimization/search | `EP-20260904-h5-enter-dual-ralph` | n=1 diagnose set |
| holdout | (empty) | no second independent dual-Ralph dispatch |
| regression | `G-h5-reuse-sibling` | `evals/regression/EP-20260904-h5-enter-dual-ralph.json` |

Leakage checks:

- [x] no shared ids across sets
- [x] holdout empty (outcomes not shown to proposer)
- [ ] group-split by a second thread — **blocked**: n=1

Validate split: `node skills/jj-evaluated/scripts/evaluated_ops.mjs check-split --manifest docs/evaluations/EP-20260904-h5-enter-dual-ralph.split.json`

## 5. Candidate change

| Field | Value |
| --- | --- |
| candidate_id | `C-h5-enter-reuse-sibling-v1` |
| expected mechanism | Same delivery + same session thread, or the only live review-slice in that repo → `reuse-sibling`. `init` refuses `审查修复` / `review-fix` slugs. `task.md` lists actual `run_id`. `--thread-id` / `host.thread_id` counts as the session. |
| bounded diff / asset | `src/dispatchRalph.mjs`, `src/ralph/knowledge.mjs`, `src/ralph/state.mjs`, `src/taskArtifacts.mjs` + contracts (jj-flow working tree) |
| non-goals | Do not rewrite merchants/buyer Ralph; do not absorb/abandon field runs; do not auto-fix during `$jj-review` |

## 6. Replay results

| Suite | Result | Notes |
| --- | --- | --- |
| contract / schema | OK | `validate` exit 0, 8 events, 2 `CLOCK_UNKNOWN` warnings (evt-07/08). `check-split` exit 0 |
| search subset | OK | `tests/task-artifacts.test.mjs` including reuse-sibling（同会话 / 审查切片 / 仅 `host.thread_id`） |
| full search | skipped | n=1; no second search case |
| holdout | skipped | empty by design |
| regression | landed | `evals/regression/EP-20260904-h5-enter-dual-ralph.json` |

Expensive build/lint/browser: **not required** — this is a harness routing invariant, not H5 UI acceptance.

## 7. Human decision

| Field | Value |
| --- | --- |
| decision | **approve** 2026-09-04（本会话用户「批准」） |
| reviewer | user |
| reward-hacking / leakage | none scored on holdout |
| unsafe autonomy | candidate does not write business repos |
| rollback | revert the four `src/` files + `evals/regression/EP-20260904-h5-enter-dual-ralph.json` |

## 8. Promotion / archive / next data

| Field | Value |
| --- | --- |
| promotion status | **promoted** 2026-09-04（工作区 + 回归用例；不是 npm 发版） |
| promoted assets | `src/dispatchRalph.mjs`；`skills/jj-dispatch/SKILL.md`；`skills/jj-same/SKILL.md`；`evals/regression/EP-20260904-h5-enter-dual-ralph.json`；`evals/regression/EP-20260904-h5-enter-same-live-sibling.json` |
| rollback path | keep field dual-runs; revert the promoted assets + `src/ralph/{state,knowledge}.mjs` / `src/taskArtifacts.mjs` 配套 diff |
| next data-collection | raw export of thread `8cca3b80` if duration/token baseline is required; a second delivery that already has a live review-slice |

Unresolved data-quality (do not smooth):

- plane clocks are rounded;
- no thread export;
- buyer slug success can be misread as “dispatch init was correct everywhere”.
