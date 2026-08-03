# jj-evaluated report — EP-20260803-dispatch-stale-master-branch

> Status: diagnosis complete; **A recovery done**; **C-base-freshness-v1 promoted** to skill SSOT (2026-08-03)
>
> Skill: `$jj-evaluated`
>
> Recorded: 2026-08-03
>
> Note: full report lives under versioned `docs/evaluations/` (jj-flow forbids repo-local `.workflow/`).
>
> User hypothesis: 新建分支时没有先更新本地 master 再拉分支，而是直接从落后很多的本地 master 新建。

## 1. Episode and role mapping

| Field | Value |
| --- | --- |
| episode_id | `EP-20260803-dispatch-stale-master-branch` |
| delivery_id | `DEL-shang-tag-color-cz-20260803` |
| task_id | `TASK-DEL-shang-tag-color-cz-20260803` |
| control-plane | `D:/a/dispatch-control/.workflow/dispatch/DEL-shang-tag-color-cz-20260803/control-plane.json` |
| host mode | Grok Mode S（同会话串行 + project-branch） |
| lead / 承接 | `D:/a/cj-web` @ `feat/cj-0807-lyj` `9d5214739` |
| reference / 兑接 | `D:/a/dj-web` @ `feat/dj-0807-lyj` `1f3f8c1d8`（sibling ADAPT） |
| target / 承载用户端 | `D:/a/cz-broker-web` @ `feat/cz-0807-lyj` `f45576c02`（= 陈旧 local master tip） |
| handoff_ref | `D:/a/cj-web/.workflow/ralph/RALPH-shang-tag-color-blue-20260803/handoff/handoff.json` |
| evidence provenance | control-plane artifact + target git reflog/for-each-ref（`timestamp_provenance=git` / `artifact`） |

### Role map (this episode only)

| Role | Path | Branch @ tip | Notes |
| --- | --- | --- | --- |
| 承接（lead + source） | `D:/a/cj-web` | `feat/cj-0807-lyj@9d5214739` | Created from master; local master == origin/master |
| 兑接（sibling reference） | `D:/a/dj-web` | `feat/dj-0807-lyj@1f3f8c1d8` | Created from HEAD/master; local master == origin/master |
| 承载（dispatch target） | `D:/a/cz-broker-web` | `feat/cz-0807-lyj@f45576c02` | **stale base**; dirty uncommitted ADAPT |
| control | `D:/a/dispatch-control` | n/a | revision 1, status RUNNING, ceiling EVIDENCE_READY |

## 2. Baseline table and clock-quality caveats

| Metric | Value | clock_quality | timestamp_provenance |
| --- | ---: | --- | --- |
| wall_span (PREVIEW→DISPATCH) | ~2.7 min (03:35:10Z → 03:37:54Z) | exact | artifact (control-plane events) |
| branch CREATE moment | 2026-08-03 11:37:14 +0800 | exact | git reflog |
| local master lag vs origin/master | **64 commits** | exact | git rev-list |
| local master tip date | 2026-07-27 18:59:19 +0800 | exact | git |
| origin/master tip date | 2026-08-01 16:11:59 +0800 | exact | git |
| active implement duration | unknown (same-session soft write; no session id) | unknown | — |
| produced_commit | null（dirty worktree） | exact | artifact |

Caveats:

- Do not treat filesystem mtime as active work time.
- Plane writes PREVIEW/APPROVED/DISPATCH/EVIDENCE_READY with same `at` for later events → wall span for implement is not separable from soft Mode S batch write.
- `origin/master` lag uses **already-fetched** remote-tracking ref; no network re-fetch performed in this evaluation.

## 3. Failure / behavior tags and causal hypotheses

| Tag | Evidence ref | Hypothesis |
| --- | --- | --- |
| `stale_base_branch` | cz-broker-web: `master`/`feat/cz-0807-lyj` = `f45576c02`; `origin/master` = `d78af9489`; `rev-list master..origin/master` = **64** | Feature branch created from stale local master without fetch/ff |
| `branch_create_no_fetch` | reflog: `checkout tracker→master→feat/cz-0807-lyj` all at `f45576c02`; `branch: Created from HEAD` | Agent switched to local master tip and branched; no `git fetch` / ff-only update |
| `policy_conflict` | jj-same `workflow-core.md` L17; `project-family.md` L107; SKILL MUST NOT「自动更新本地 master」 | Skill **forbids** auto-updating master while also requiring CREATE from local master → systematic stale-base risk |
| `branch_purpose_ok` | plane preflight: current tracker train `feat/cz-aliyun-tracker-integration@9e81c4006`, intended `feat/cz-0807-lyj`, action CREATE | Purpose preflight (EP-S1 fix) worked; wrong-train avoided; base freshness not checked |
| `base_freshness_gap` | preflight table has task/current/intended/match/action only — no `base` / `behind_count` | Gate incomplete for CREATE path |
| `sibling_contrast` | cj/dj: master...origin/master = `0 0` | Same CREATE rule succeeds when local master already current; defect only surfaces on lagging clones |
| `user_correction` | user `/jj-evaluated` call | Human diagnosed without needing chat-as-truth; git confirms |

### Trace-backed timeline (cz-broker-web)

```text
2026-08-03 11:37:14 +0800  checkout: feat/cz-aliyun-tracker-integration → master
                           tip still f45576c02 (Merge #169 into master from staging, 2026-07-27)
2026-08-03 11:37:14 +0800  checkout: master → feat/cz-0807-lyj
                           reflog: "branch: Created from HEAD"  (== local master, not origin/master)
after                      dirty ADAPT on 3 files; no commit
```

### Control-plane preflight (as written)

```text
task:     商票标签 #0076F6 → 承载用户端
action:   CREATE from local master then CODE
intended: feat/cz-0807-lyj
match:    NO
current:  feat/cz-aliyun-tracker-integration @ 9e81c4006 — tracker train
```

Missing fields that would have caught the bug:

```text
base:           master @ f45576c02
origin_base:    origin/master @ d78af9489
behind_count:   64
base_action:    FETCH+FF or CREATE from origin/master after fetch
```

### Causal chain (single root)

1. Branch-purpose preflight correctly forced **CREATE** off the tracker train (good).
2. Family rule says: create from **local `master`**, and **do not auto-update** local master.
3. Agent complied: `checkout master` + `checkout -b feat/cz-0807-lyj` with zero fetch.
4. Local master was **64 commits behind** already-fetched `origin/master` (last local master tip 2026-07-27; remote tip 2026-08-01).
5. Work landed on a base older than production master → future merge/rebase pain, missing intermediate fixes, false sense of “on master line”.

**Not** the primary cause: wrong intended branch name, wrong project path, or exclusive-worktree transfer. Those gates fired correctly.

## 4. Optimization / holdout / regression split

| Set | Episode ids | Notes |
| --- | --- | --- |
| optimization/search | `EP-20260803-dispatch-stale-master-branch` | primary search sample for base-freshness gate |
| holdout | (none yet for this failure class) | next similar CREATE-with-lag wave reserved when seen |
| regression | `EP-20260730-S1` branch purpose (protect) | must keep wrong-train BLOCKED; new gate must not replace purpose check |

Leakage checks:

- [x] no holdout outcomes fed into candidate text beyond “protect EP-S1”
- [x] group: feature = shang-tag-color; role = 承载; host = Grok Mode S; date = 2026-08-03

## 5. Candidate change

| Field | Value |
| --- | --- |
| candidate_id | **C-base-freshness-v1** |
| expected mechanism | Before any `CREATE` of intended feature branch: require base freshness against remote-tracking integration tip; prefer branching from `origin/<base>` after `git fetch`, or ff-only update local base when clean |
| bounded diff / asset | skill text only (jj-same + jj-dispatch preflight table); optional later: tiny helper script `base_freshness_check.mjs` |
| non-goals | force-push; rewrite user dirty master; auto-merge unrelated local master commits; change default base from master→dev; silent rebase of existing feature branches |

### Proposed hard gate (CREATE path)

Extend branch-purpose preflight (and dispatch workspace confirm table) with:

| # | Check | Evidence |
| --- | --- | --- |
| 6 | **Base ref** | family default `master` (or map override) |
| 7 | **Local base tip** | `git rev-parse <base>` |
| 8 | **Remote-tracking tip** | after `git fetch <remote> <base>`: `git rev-parse <remote>/<base>` |
| 9 | **behind_count** | `git rev-list --count <base>..<remote>/<base>` |
| 10 | **base_action** | `USE_LOCAL` only if behind=0 (and ahead handled); else `FETCH_FF` if local base clean & can ff; else `CREATE_FROM_ORIGIN` (`git checkout -b <feat> <remote>/<base>`); if local base dirty with unrelated changes → `NEEDS_CONFIRM` / `BLOCKED` |

Golden Q&A to add (must not regress purpose gates):

**G6 — Stale local master**

- Q: Intended branch missing; local `master` behind `origin/master` by 64; worktree clean on other branch. CREATE?
- A: Fetch first. Do **not** `checkout -b` from stale local master. Prefer `git checkout -b feat/… origin/master` (or ff-only update master when clean, then branch). Report `behind_count` in preflight table.

### Policy rewrite (precise)

Replace blanket:

> 不得自动更新本地 `master`

with:

> **不得**在未确认时 `reset --hard` / 改写带本地提交的 `master`。  
> **CREATE 功能分支前必须** `git fetch` 集成基线，并保证新分支 tip 不落后于 `origin/<base>`（默认 `origin/master`）。  
> 允许：`fetch` + 干净时的 **ff-only** 更新 local base，或 **直接从 `origin/<base>` 建分支**（不移动 local master 指针亦可）。

Touch points (promotion only after human OK):

1. `.codex/skills/jj-same/references/branch-purpose-preflight.md` — checks 6–10 + G6
2. `.codex/skills/jj-same/references/project-family.md` §分支派生规则
3. `.codex/skills/jj-same/references/workflow-core.md` L17
4. `.codex/skills/jj-same/SKILL.md` MUST NOT wording
5. `.codex/skills/jj-dispatch/references/happy-path.md` + control-project workspace table
6. Then `jj install-skill --platform all --force`

### Immediate recovery for this delivery (ops, not promotion)

On `D:/a/cz-broker-web` (user must confirm before destructive git):

1. Stash or keep the 3-file dirty ADAPT.
2. `git fetch origin master`
3. Recreate base: e.g. delete/rename stale `feat/cz-0807-lyj` if unpushed, `git checkout -b feat/cz-0807-lyj origin/master` (or ff master then branch).
4. Re-apply stash; commit; only then raise plane beyond EVIDENCE_READY.

**Not done in this evaluation** (read-only unless user asks).

## 6. Replay results

| Suite | Result | Notes |
| --- | --- | --- |
| contract / schema | n/a | no skill edit yet |
| git forensics | PASS | lag=64, reflog CREATE from HEAD proven |
| plane-self-check | not re-run | plane soft Mode S; ceiling EVIDENCE_READY expected without produced_commit |
| search subset | deferred | candidate not implemented |
| holdout / regression | deferred | protect EP-S1 purpose gate |

Token / time trade-offs:

- One `git fetch` + rev-list is cheaper than later rebase/cherry-pick across 64 master merges.
- Printing `behind_count` in PREVIEW table is near-zero token cost vs branch_correction loops.

## 7. Human decision / promotion

| Field | Value |
| --- | --- |
| human decision | **approved** — user: A+B both do |
| promotion status | **promoted** to `.codex/skills` SSOT + `jj install-skill --platform all --force` |
| recovery (A) | `cz-broker-web`: stash ADAPT → fetch+ff master `f45576c02→d78af9489` → recreate `feat/cz-0807-lyj` → stash pop clean; plane rev 2 `BASE_RECOVERY`; behind_count=0 |
| skill assets (B) | jj-same: branch-purpose-preflight checks 6–10 + G6; project-family / workflow-core / SKILL / happy-path; jj-dispatch: happy-path table, control-project, SKILL gate 4, host-action-contract confirm list, grok-dispatch preflight #9 |
| rollback path | revert skill text commits; keep EP report as regression narrative; business branch already on fresh master |
| next data-collection | next CREATE wave must print behind_count; protect EP-S1 purpose gate |

## 8. Archive notes

- Episode class: dispatch + same CREATE path / base freshness.
- Do not advance delivery checkpoint from this report.
- Related prior: EP-S1 fixed **wrong train**; this episode shows **right train name, wrong base tip**.
