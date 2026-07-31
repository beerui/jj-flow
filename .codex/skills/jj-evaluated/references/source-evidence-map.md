# Current source evidence map

This file records the first observed sample used to shape the skill. It is a
baseline for evaluation, not a new authority for project routing. Re-discover
paths and verify branch/commit state before using them in a new episode.

## Observed role mapping

| Role | Observed repository | Use in evaluation |
| --- | --- | --- |
| 承接前台 | `D:\codeup\chengjie\cj-frontend-web` | target/source role in the older password-reminder wave; verify per episode |
| 兑接前台 | `D:\codeup\duijie\dj-frontend-web` | target role in the older wave; verify per episode |
| 承载前台 | `D:\codeup\chengjie\cz-broker-web` | source project for the newer enterprise-tag handoff sample |
| draft-manager candidate | `D:\codeup\chengjie\cz-draft-manager-web` | exists, but the sampled wave did not establish it as the active source |

Do not substitute the last row for 承载 without current evidence.

## Representative episodes

Observed evidence roots for the first sample include:

- `D:\codeup\chengjie\cj-frontend-web\.workflow\.csv-wave`
- `D:\codeup\duijie\dj-frontend-web\.workflow\.csv-wave`
- `D:\codeup\chengjie\cj-frontend-web\.workflow\ralph`
- `D:\codeup\chengjie\cz-broker-web\.workflow\.csv-wave\20260724-analyze-source-acceptor-enterprise-tag-right-align\requirement-baseline`

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
target artifact spans were about 1 second for 承接 and 80 seconds for 兑接;
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
| 承接用户端 | `D:\\a\\cj-web` | `RALPH-inquiry-face-checkmark-20260729` @ `860417f90` |
| 兑接用户端 | `D:\\a\\dj-web` | port head `cb2c38a3e` |
| 承载用户端 | `D:\\a\\cz-broker-web` | port head `8257da360`; incomplete `RALPH-zf-zj-align-huiyuan-20260729` |
| 承载草稿管理 | `D:\\a\\cz-draft-manager-web` | ticket-face-close + publish-esc-focus |
| 承载识票 | `D:\\a\\cz-broker-recognize-web` | adjacent 0731 list-tag port `feat/cz-0731-lyj@1e3fb4726` |
| independent SDK | `D:\\a\\rd-sdt-tracker` | `RALPH-appcode-logger-20260728` |

Evaluation write-up: `D:\\daji-docs\\jj-flow\\docs\\evaluations\\2026-07-29-grok-episodes-baseline.md`.

Still true:

- host/session fields missing from ralph artifacts (`host=inferred:grok` only);
- do not treat file mtime or lone `run.json` duration as active work time;
- protect EP-05 LITE family success as holdout when changing accept/archive gates.

## 2026-07-29 iteration-3 refresh

| Role | Current repository | Head at iteration-3 |
| --- | --- | --- |
| 承接用户端 | `D:\\a\\cj-web` | `fix/inquiry-face-info-checkmark@860417f90ae4` |
| 兑接用户端 | `D:\\a\\dj-web` | `fix/inquiry-face-info-checkmark@cb2c38a3e65a` |
| 承载用户端 | `D:\\a\\cz-broker-web` | `feat-channel-zj@9f4cff5cba51` (moved off inquiry-face branch) |
| 承载草稿管理 | `D:\\a\\cz-draft-manager-web` | `dev@e4a5ff98ba80` |
| 承载识票 | `D:\\a\\cz-broker-recognize-web` | `feat/cz-0731-lyj@1e3fb4726644` |

New search/regression sample:

- `RALPH-order-filter-bizserialid-20260729` on 承载用户端 (COMPLETED; path-consistent; synthetic progress timestamps).
- EP-02 `RALPH-zf-zj-align-huiyuan-20260729` still PLAN while deliver commit `459e72f39` exists.

Candidate v1 product-consistency gate is on jj-flow `main@3dd7624`.

## 2026-07-30 Grok window

Live paths (unchanged map roots under `D:\\a\\...`). Evaluation write-up:
`D:\\daji-docs\\jj-flow\\docs\\evaluations\\2026-07-30-grok-episodes.md`.

| Sample | Evidence |
| --- | --- |
| EP-H1 harness | Grok thread `019fb1e2-…`; jj-flow commits `f547935` / `35a878c` (beta.34) |
| EP-B1 sale-draft | `D:\\a\\cz-broker-web\\.workflow\\ralph\\RALPH-sale-draft-pay-channel-20260730` |
| EP-S1 tracker same | `D:\\a\\cz-broker-recognize-web\\.workflow\\handoffs\\HOF-aliyun-tracker-20260729-2` + branch mis-attach recovery |
| EP-K1 SDK Node14 | `D:\\a\\rd-sdt-tracker` postinstall `0.6.3` + static compat test |

Candidate v5 (branch purpose preflight) lives in `jj-same` skill SSOT; protect EP-S1 golden table and EP-B1 holdout.

## 2026-07-30 formal dispatch (acceptor-tag-color)

First live multi-target delivery with real control-plane files under
`D:/a/dispatch-control` (not the null-plane preference-modified export).

| Field | Value |
| --- | --- |
| delivery_id | `DEL-acceptor-tag-color-20260730` |
| task_id | `TASK-DEL-acceptor-tag-color-20260730` |
| control-plane | `D:/a/dispatch-control/.workflow/dispatch/DEL-acceptor-tag-color-20260730/control-plane.json` |
| lead / 兑接 | `D:/a/dj-web` @ `feat/dj-0731-lyj` style `5af0b1c6b` |
| target / 承接 | `D:/a/cj-web` @ `feat/cj-0731-lyj` style `f68b7043f` |
| target / 承载识票 | `D:/a/cz-broker-recognize-web` @ `feat/cz-0731-lyj` style `493db28c5` |
| thread | Grok `019fb288-5e92-7a73-bb0a-b6d6edfe1420` (cwd dj-web) |
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
| control-plane | `D:/a/dispatch-control/.../control-plane.json` hash `690410c60e45` |
| plane-self-check | **OK** |
| session | `019fb5b3-b1f4-78b3-b79d-ffd601f91e55` (shared Mode S) |
| lead / 承接 | `D:/a/cj-web` @ `1ec732bd6` ralph COMPLETED |
| target / 兑接 | `D:/a/dj-web` @ `9093b961d` |
| target / 承载用户端 | `D:/a/cz-broker-web` @ `f7fbe8818` |
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
| dj-web tip | `3ee8d3cc4` Revert of `9093b961d` @ `feat/dj-0731-lyj` |
| cz-broker-web tip | `6d589864f` Revert of `f7fbe8818` @ `feat/cz-0731-lyj` |
| cj-web tip (lead) | `86dbbdf23` Revert of `1ec732bd6` @ `feat/cj-0731-lyj` |
| on dev? | pnpm commits **not** ancestors of `dev` / `origin/dev` |
| remote | feature **ahead 2**, not pushed |
| events | `TARGET_REOPENED`×2 + `GIT_ROLLBACK_REVERT` |

Candidate **R-soft-reopen**: Mode S soft plane cannot call strict `reopenTarget`
(shared session `thread_id` uniqueness + DONE/BOUND fields). Soft equivalent used
live; promote via skill/fixture or session-gated validator exception.

Ralph `RALPH-readme-pnpm-install-20260731` remains COMPLETED/ARCHIVE (no un-archive).
