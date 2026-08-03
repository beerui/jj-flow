# Current source evidence map

This file records the first observed sample used to shape the skill. It is a
baseline for evaluation, not a new authority for project routing. Re-discover
paths and verify branch/commit state before using them in a new episode.

## Observed role mapping

| Role | Observed repository | Use in evaluation |
| --- | --- | --- |
| 项目A | `/path/to/org-a/project-a` | target/source role in the older password-reminder wave; verify per episode |
| 项目B | `/path/to/org-b/project-b` | target role in the older wave; verify per episode |
| 项目C | `/path/to/org-a/project-c` | source project for the newer enterprise-tag handoff sample |
| draft-manager candidate | `/path/to/org-a/project-e` | exists, but the sampled wave did not establish it as the active source |

Do not substitute the last row for 项目C without current evidence.

## Representative episodes

Observed evidence roots for the first sample include:

- `/path/to/org-a/project-a\.workflow\.csv-wave`
- `/path/to/org-b/project-b\.workflow\.csv-wave`
- `/path/to/org-a/project-a\.workflow\ralph`
- `/path/to/org-a/project-c\.workflow\.csv-wave\20260724-analyze-source-acceptor-enterprise-tag-right-align\requirement-baseline`

These paths are input references only. Recheck existence, hashes, branch and
commit before treating an artifact as part of a new episode.

### Older password-reminder wave

Thread `019f5a11-daa6-7bb1-85b0-2017cb3e5d38` contains representative active
turns: initial analysis (~3 min), scope confirmation (~1 min), design/screenshot
supplement (~21 min), a `window.require` correction (~2.7 min), original
execution/verification (~86.5 min), current-page popup correction (~54.2 min),
and final commit (~4.1 min). These are thread-derived active-turn estimates,
not authoritative wall time. The dominant signals are repeated analysis,
correction/rework, and expensive validation waits.

### New enterprise-tag handoff

Thread `019f9446-8672-73f0-b928-f4831433c25f` produced HOF-001 and HOF-002
blocked snapshots, then HOF-003 as the fresh successor after branch/dirty-state
correction. Source commit:
`d54b25cdb28484855153a3f0e3ea5887331b533b`.

Both targets consumed HOF-003 without rebuilding source analysis. The observed
target artifact spans were about 1 second for 项目A and 80 seconds for 项目B;
source-to-target commit wall spans were about 36 and 53 minutes respectively.
Those wall spans include waiting and must be split into active, handoff, tool,
and human attention time in a future export.

## Data-quality warnings

- `.csv-wave` file mtimes can span only 0–1 seconds despite long conversations;
- some old directories span hours because of pauses or multiple sessions;
- ralph `run.json` exposes `created_at`/`updated_at`, while `progress.md` can
  exceed that interval;
- duplicate `run.json` files can exist in active/archive locations.

Use these warnings as test cases for `clock_quality`, not as reasons to discard
the episodes. The first high-value optimization hypothesis is handoff reuse with
successor/freshness validation; reducing repeated source analysis matters more
than shaving an artifact-write second.

## 2026-07-29 path refresh (Grok episode window)

Absolute paths moved off the deprecated `D:\\codeup\\...` roots. Current map-backed facts:

| Role | Current repository | Sample run / head used in 2026-07-29 baseline |
| --- | --- | --- |
| 项目A | `/portfolio/project-a` | `RALPH-inquiry-face-checkmark-20260729` @ `860417f90` |
| 项目B | `/portfolio/project-b` | port head `cb2c38a3e` |
| 项目C | `/portfolio/project-c` | port head `8257da360`; incomplete `RALPH-zf-zj-align-huiyuan-20260729` |
| 项目E | `/portfolio/project-e` | ticket-face-close + publish-esc-focus |
| 项目D | `/portfolio/project-d` | apbacent 0731 list-tag port `feat/pc-0731-dev@1e3fb4726` |
| independent SDK | `/portfolio/project-sdk` | `RALPH-appcode-logger-20260728` |

Evaluation write-up: `D:\\daji-docs\\jj-flow\\docs\\evaluations\\2026-07-29-grok-episodes-baseline.md`.

Still true:

- host/session fields missing from ralph artifacts (`host=inferred:grok` only);
- do not treat file mtime or lone `run.json` duration as active work time;
- protect EP-05 LITE family success as holdout when changing accept/archive gates.

## 2026-07-29 iteration-3 refresh

| Role | Current repository | Head at iteration-3 |
| --- | --- | --- |
| 项目A | `/portfolio/project-a` | `fix/inquiry-face-info-checkmark@860417f90ae4` |
| 项目B | `/portfolio/project-b` | `fix/inquiry-face-info-checkmark@cb2c38a3e65a` |
| 项目C | `/portfolio/project-c` | `feat-channel-zj@9f4cff5cba51` (moved off inquiry-face branch) |
| 项目E | `/portfolio/project-e` | `dev@e4a5ff98ba80` |
| 项目D | `/portfolio/project-d` | `feat/pc-0731-dev@1e3fb4726644` |

New search/regression sample:

- `RALPH-order-filter-bizserialid-20260729` on 项目C (COMPLETED; path-consistent; synthetic progress timestamps).
- EP-02 `RALPH-zf-zj-align-huiyuan-20260729` still PLAN while deliver commit `459e72f39` exists.

Candidate v1 product-consistency gate is on jj-flow `main@3dd7624`.

## 2026-07-30 Grok window

Live paths (unchanged map roots under `/portfolio/...`). Evaluation write-up:
`D:\\daji-docs\\jj-flow\\docs\\evaluations\\2026-07-30-grok-episodes.md`.

| Sample | Evidence |
| --- | --- |
| EP-H1 harness | Grok thread `019fb1e2-…`; jj-flow commits `f547935` / `35a878c` (beta.34) |
| EP-B1 sale-draft | `/portfolio/project-c\\.workflow\\ralph\\RALPH-sale-draft-pay-channel-20260730` |
| EP-S1 tracker same | `/portfolio/project-d\\.workflow\\handoffs\\HOF-aliyun-tracker-20260729-2` + branch mis-attach recovery |
| EP-K1 SDK Node14 | `/portfolio/project-sdk` postinstall `0.6.3` + static compat test |

Candidate v5 (branch purpose preflight) lives in `jj-same` skill SSOT; protect EP-S1 golden table and EP-B1 holdout.

## 2026-07-30 formal dispatch (acceptor-tag-color)

First live multi-target delivery with real control-plane files under
`/portfolio/dispatch-control` (not the null-plane preference-modified export).

| Field | Value |
| --- | --- |
| delivery_id | `DEL-acceptor-tag-color-20260730` |
| task_id | `TASK-DEL-acceptor-tag-color-20260730` |
| control-plane | `/portfolio/dispatch-control/.workflow/dispatch/DEL-acceptor-tag-color-20260730/control-plane.json` |
| lead / 项目B | `/portfolio/project-b` @ `feat/pb-0731-dev` style `5af0b1c6b` |
| target / 项目A | `/portfolio/project-a` @ `feat/pa-0731-dev` style `f68b7043f` |
| target / 项目D | `/portfolio/project-d` @ `feat/pc-0731-dev` style `493db28c5` |
| thread | Grok `019fb288-5e92-7a73-bb0a-b6d6edfe1420` (cwd project-b) |
| evaluation | `docs/evaluations/2026-07-30-acceptor-tag-color-dispatch.md` |

Caveats recorded in that evaluation: PREVIEW + project-branch + ADAPT succeeded;
`VERIFIED` was hand-written without `produced_commit`; synthetic session ids;
scheduler implemented targets in the same session.

**C3 promoted (agent-path, no user CLI):** jj-dispatch skill hard gates +
`scripts/plane-self-check.mjs` — same-session OK with real session id; no synthetic
`session-*-YYYYMMDD`; no VERIFIED without git `produced_commit`.

## 2026-07-31 Mode S closed loop (readme-pnpm)

| Field | Value |
| --- | --- |
| delivery_id | `DEL-readme-pnpm-install-20260731` |
| task_id | `TASK-DEL-readme-pnpm-install-20260731` |
| control-plane | `/portfolio/dispatch-control/.../control-plane.json` hash `690410c60e45` |
| plane-self-check | **OK** |
| session | `019fb5b3-b1f4-78b3-b79d-ffd601f91e55` (shared Mode S) |
| lead / 项目A | `/portfolio/project-a` @ `1ec732bd6` ralph COMPLETED |
| target / 项目B | `/portfolio/project-b` @ `9093b961d` |
| target / 项目C | `/portfolio/project-c` @ `f7fbe8818` |
| evaluation | `docs/evaluations/2026-07-31-readme-pnpm-dispatch.md` |

Portfolio under same control_root:

| delivery | business | integrity |
| --- | --- | --- |
| readme-pnpm-20260731 | VERIFIED | self-check **OK** |
| acceptor-tag-20260730 | VERIFIED label / git landed | self-check **FAIL** (regression negative) |

Remote push for readme-pnpm still open (feature branches ahead 1). Harness-manifest:
no required change for this closeout; optional evolutions C4–C6 **archived** in
`docs/exec-plans/active/2026-07-31-dispatch-upgrade-backlog.md` (blocked until upgrade window).

## 2026-07-31 rollback path B (readme-pnpm)

Live rollback of the Mode S golden delivery (control reopen + feature task-scoped
`git revert`). Evaluation:
`docs/evaluations/2026-07-31-readme-pnpm-rollback.md`.

| Field | Value |
| --- | --- |
| delivery_id | `DEL-readme-pnpm-install-20260731` |
| plane hash @ eval | `2f07acdfb729` revision **7** |
| delivery status | **PREVIEW_ONLY** (was VERIFIED) |
| plane-self-check | **OK** |
| project-b tip | `3ee8d3cc4` Revert of `9093b961d` @ `feat/pb-0731-dev` |
| project-c tip | `6d589864f` Revert of `f7fbe8818` @ `feat/pc-0731-dev` |
| project-a tip (lead) | `86dbbdf23` Revert of `1ec732bd6` @ `feat/pa-0731-dev` |
| on dev? | pnpm commits **not** ancestors of `dev` / `origin/dev` |
| remote | feature **ahead 2**, not pushed |
| events | `TARGET_REOPENED`×2 + `GIT_ROLLBACK_REVERT` |

Candidate **R-soft-reopen**: Mode S soft plane cannot call strict `reopenTarget`
(shared session `thread_id` uniqueness + DONE/BOUND fields). Soft equivalent used
live; promote via skill/fixture or session-gated validator exception.

Ralph `RALPH-readme-pnpm-install-20260731` was COMPLETED/ARCHIVE at capture time.
> **Note (2026-08-01 product):** historical episode wording “no un-archive” meant “do not erase snapshot facts.” Current ralph allows **same-run resume** after soft archive (re-archive OK); it does not require a new `run_id` merely because status was COMPLETED.

## 2026-08-03 dispatch stale master base (shang-tag-color → 承载)

| Field | Value |
| --- | --- |
| episode_id | `EP-20260803-dispatch-stale-master-branch` |
| delivery_id | `DEL-shang-tag-color-cz-20260803` |
| control-plane | `D:/a/dispatch-control/.../control-plane.json` rev **2** after `BASE_RECOVERY` |
| failure | CREATE `feat/cz-0807-lyj` from **stale local master** (64 behind `origin/master`) |
| recovery | fetch+ff master → recreate feat; ADAPT re-applied; tip `d78af9489` |
| candidate | **C-base-freshness-v1 promoted** (jj-same G6 + dispatch preflight) |
| evaluation | `docs/evaluations/2026-08-03-dispatch-stale-master-branch.md` |
| report | `docs/evaluations/EP-20260803-dispatch-stale-master-branch-report.md`（jj-flow 仓不写 `.workflow/`） |

Protect: EP-S1 purpose gate still required; this episode adds base-freshness, does not replace it.

## 2026-07-31 Codex multi-thread dispatch (telemetry-image)

Offline export package (local only; raw JSONL unredacted):

`D:\dingding-download\20260731-102519-telemetry-image-dispatch\20260731-102519-telemetry-image-dispatch`

| Field | Value |
| --- | --- |
| episode_id | `ep-20260731-telemetry-image-request-dispatch` |
| delivery_id | `DELIVERY-telemetry-image-request-20260731` |
| host | **codex-app** / `handle_kind=thread` (4 task threads + coordinator) |
| feature | Image telemetry: no DOM mount + sync try/catch |
| delivery | VERIFIED rev 6; plane-self-check **ok** |
| strict validate | FAIL 4 (empty lead_responsibilities; checkpoint recorded_at mismatch) |
| evaluation | `docs/evaluations/2026-07-31-telemetry-image-codex-dispatch.md` |

Roles at capture (Mac paths): 项目A `project-a` @ `c2fc7d7e`; 项目B `project-b` @ `bbb9c4bc` ADAPT; 项目C `project-c` @ `c243db37` ADAPT.
