# jj-evaluated report — EP-20260828-jj-end-staging-not-dev

> Status: diagnosis complete; **C-end-integration-no-gitlog-v1** + Conflict classify (G-end-2) **human-approved** 2026-08-28; shipping in 0.1.2
>
> Skill: `$jj-evaluated`
>
> Recorded: 2026-08-28
>
> Note: full report lives under versioned `docs/evaluations/` (jj-flow forbids repo-local `.workflow/`).
>
> User: 这份报告是我从 seo-daji-web 中总结的，看看怎么修复这个问题。

## 1. Episode and role mapping

| Field | Value |
| --- | --- |
| episode_id | `EP-20260828-jj-end-staging-not-dev` |
| skill under eval | `$jj-end` / `/jj-end` |
| host | Grok |
| closeout repo | `D:\2025\trade-exhibition-mobile` @ `feat/custorm-accesses-users` `a5c844a8` |
| session cwd (intake) | `D:\2025\seo-daji-web` (almost nothing to land; not the merge target) |
| role | omitted — not 项目A / 项目B / 项目C; harness closeout on an independent business repo |
| thread_id / export_id | **null** / user markdown `docs/evaluations/EP-20260828-jj-end-staging-not-dev.md` |
| evidence provenance | user reconstruction + live git (mobile) verified 2026-08-28 |

### Role map (this episode only)

| Label | Path | Fact |
| --- | --- | --- |
| session cwd | `D:\2025\seo-daji-web` | User summarized here; `feat/dynamic-form`; no `.workflow/evaluated` |
| implementation / closeout | `D:\2025\trade-exhibition-mobile` | Work `a5c844a8`; wrong local staging merge `cdcb950c`; corrected `origin/dev` `3343c0fd` |
| harness | `D:\daji-docs\jj-flow` | Skill SSOT `skills/jj-end/SKILL.md` |

Do not rename these to 项目A/B/C.

## 2. Baseline table and clock-quality caveats

| Metric | Value | clock_quality | timestamp_provenance |
| --- | ---: | --- | --- |
| work commit | `a5c844a8` 2026-08-28T20:31:15+08:00 | exact | git |
| wrong local merge → staging | `cdcb950c` 20:31:54+08:00 | exact | git |
| `git push origin staging` | rejected by hook; remote never contained `a5c844a8` | derived | user_export + `merge-base --is-ancestor` exit 1 vs `origin/staging` |
| staging reset to `origin/staging` | reflog 20:33:34+08:00 → `91513d23` | exact | git reflog `--date=iso` |
| correct merge → `origin/dev` | `3343c0fd` 20:33:42+08:00 | exact | git |
| wall_span (wrong land → corrected) | 2 min 27 s (`20:31:15` → `20:33:42`) | derived | git |
| human_attention | user correction between 20:31:54 and 20:33:34 (~100 s, includes agent recovery) | derived | git span; no thread timestamps |
| active_duration / tokens / tool volume | unknown | unknown | no thread export |
| artifact_write_span | not used | — | mtime is not authority |

Caveats:

- No raw conversation export. User reconstruction from seo-daji-web is the narrative; git on mobile is the clock.
- Do **not** use `91513d23` committer date `14:07:59` as the reset time (that is the pointed-to commit). Reflog date `20:33:34` is the reset.
- `validate` exit 0 with 5 `CLOCK_UNKNOWN` warnings on request/cwd/wrong-resolve/push-reject/user-correction events. Those durations are not scored.
- File mtime and any ralph `run.json` on seo-daji-web are **not** this closeout clock.

`validate`: `node skills/jj-evaluated/scripts/evaluated_ops.mjs validate --episode docs/evaluations/EP-20260828-jj-end-staging-not-dev.episode.json` → **OK** shape=`episode_wrapper` events=9 warnings=5.

## 3. Failure / behavior tags and causal hypotheses

| Tag | Evidence ref | Hypothesis |
| --- | --- | --- |
| `regression` | mobile reflog `staging@{1}` merge `cdcb950c`; user: 「为什么会合并预发？」 | Agent landed on 预发 despite skill heuristic `dev` |
| `user_correction` | episode §1 + git recovery 20:33:34–20:33:42 | Human caught it; hook blocked remote staging |
| `evidence_gap` | HEAD skill already said priority-2 only if **docs or user config name** the branch | Negative examples were missing; agent filled the gap from git log |
| `role_mapping` | cwd seo-daji-web vs implement mobile | Repo switch was **correct**; not the failure |
| `branch_correction` | work merge-base vs `origin/staging` = `0aaf7960 Merge #452 into staging` | Staging-merge parent was treated as “should return to staging” |
| `tool_unavailable` | push `origin/staging` hook reject | Blast radius stayed local |

### Git-backed timeline (trade-exhibition-mobile)

```text
20:31:15  a5c844a8  feat(message): 站内信去回复跳转客服   (work)
20:31:54  cdcb950c  Merge branch 'feat/custorm-accesses-users' into staging
          parents: 91513d23 (origin/staging) + a5c844a8
          reflog: staging@{1} merge … ort
          push origin staging → rejected (hook)
20:33:34  git branch -f / reset staging → origin/staging 91513d23
20:33:42  3343c0fd  Merge branch 'feat/custorm-accesses-users' into dev
          now origin/dev tip; a5c844a8 ancestor of origin/dev
          a5c844a8 NOT ancestor of origin/staging
```

Live confirm 2026-08-28 (read-only):

| Fact | Value |
| --- | --- |
| `origin/HEAD` | `refs/remotes/origin/master` |
| `origin/dev` | `3343c0fd` |
| `origin/staging` / local `staging` | `91513d23 Merge #454 into staging` |
| work merge-base vs staging | `0aaf7960 Merge #452 into staging` |
| `naming.json` | missing |
| AGENTS.md | **no** closeout branch; has `pnpm build:h5:staging` (build flavor) |

### Causal chain (single root)

1. User said `/jj-end` with **no** `integration=`. Intent: land on **dev**.
2. Skill priority (HEAD, already on disk): ① user → ② docs/user config **name** the integration branch → ③ heuristic `dev` → `develop` → `main`. `origin/dev` existed. Correct answer was ③ **dev**.
3. Agent looked **outside** the list: recent `Merge #N into staging`, work branch cut from `0aaf7960`, `origin/HEAD → master`.
4. Those facts were promoted to “family/repo convention” (priority 2) and **overrode** the heuristic.
5. Local merge into `staging` succeeded; remote push was rejected. User correction forced reset + merge to `dev`.

**Not** the primary cause: wrong repo (mobile was right), missing `dev`, user asking for 预发, or AGENTS.md naming a closeout branch (it does not).

**Confounder (must encode):** AGENTS.md contains the word `staging` in `pnpm build:h5:staging`. A skill that says “if AGENTS.md names the branch” can be misread as a word match. Candidate must say: build/env/script flavor ≠ land target.

**Falsifier:** if AGENTS.md/`naming.json` had a sentence “closeout/land/merge target is `staging`”, priority 2 would have been legal. Live files do not.

## 4. Optimization / holdout / regression split

| Set | Episode ids | Notes |
| --- | --- | --- |
| optimization/search | `EP-20260828-jj-end-staging-not-dev` | only sample of this class |
| holdout | (empty) | next independent staging-vs-dev closeout reserved; **do not invent** |
| regression | `G-end-1` | Golden Q&A invariant: git-log staging + `origin/dev` + no `integration=` → `dev` |

Leakage checks:

- [x] no holdout outcomes (set empty)
- [x] search id ≠ regression id (`check-split` overlap rule)
- [x] group: feature = inbox cs-unread closeout; host = Grok; date = 2026-08-28; repo = trade-exhibition-mobile

`check-split`: `node skills/jj-evaluated/scripts/evaluated_ops.mjs check-split --manifest docs/evaluations/EP-20260828-jj-end-staging-not-dev.split.json` → **OK**.

## 5. Candidate change

| Field | Value |
| --- | --- |
| candidate_id | **C-end-integration-no-gitlog-v1** |
| expected mechanism | Make priority-2 **negative examples** executable: discard git-log / existence / build-script word-match; require `integration_source`; blacklist row 11; G-end-1 must not regress |
| bounded diff / asset | `skills/jj-end/SKILL.md` (+ grep contract `tests/jj-end-contract.test.mjs`; user-facing pitfalls/command/zh-bridge mirrors) |
| non-goals | No jj-end CLI resolver in `src/`; no business-repo edit; no ralph/dispatch checkpoint; no Darwin Phase 2 yet |

HEAD already had “if docs or user config name the integration branch”. Restating that sentence **without** a discard-list is the same failure class. The candidate therefore:

1. Defines “explicitly name” as a **closeout/land/merge-target** sentence, not a word match.
2. **Discard** illegal sources and continue the list (usually heuristic `dev`) — no extra 🔴 pause on the happy path.
3. Adds blacklist #11 (agents scan that table).
4. Records `integration_source` = `user` \| `docs` \| `heuristic`; never print `git-log`.
5. Adds G-end-1 golden Q&A.
6. Names the live confounder `pnpm build:h5:staging`.
7. Failure-table row: staging candidate with illegal source → discard, do not merge 预发.

**Rejected alternatives (this iteration):**

- Executable `jj-end` resolver in `src/` — stronger, but couples a new CLI into a skill-only workflow; not the isolated prompt/routing change this loop allows.
- Extra 🔴 STOP whenever `staging` exists — would reintroduce the historical “ask first / half-closeout” failure (blacklist #6).

## 6. Replay results

| Suite | Result | Notes |
| --- | --- | --- |
| episode validate | PASS (warnings 5 CLOCK_UNKNOWN) | contract minimums |
| check-split | PASS | n=1; empty holdout legal |
| `node --test tests/jj-end-contract.test.mjs` | PASS 1/1 | grep: EP-20260828, Not convention, G-end-1, `integration_source`, `pnpm build:h5:staging`, blacklist git-log |
| `git diff --check` (touched docs/skill/test) | PASS | after stripping markdown two-space line-breaks in the hunk |
| full search / holdout / `npm run verify` | **skipped** | cheap replay is the contract; no `src/` runtime; n=1 has no holdout; expensive suite reserved until promote |

Token / time trade-offs: skill text only. Correctness > speed. The original wrong land was ~39 s (commit → staging merge); the cost was a user correction + local reset, not remote 预发 pollution.

## 7. Human decision

| Field | Value |
| --- | --- |
| reviewer | user (session 2026-08-28) |
| decision | **approve** (发版 0.1.2) |
| reward-hacking check | grep contract can be gamed by leaving the strings while weakening the discard rule; reviewer should read the integration section, not only the test |
| leakage check | no holdout used |
| unsafe-autonomy check | does **not** add a new pause on happy-path push/merge; illegal staging is discarded, not “ask first” |

## 8. Promotion status and rollback

| Field | Value |
| --- | --- |
| promotion status | **approved**; landing on `main` as 0.1.2 |
| promoted assets | `skills/jj-end/SKILL.md` + `tests/jj-end-contract.test.mjs` + user docs |
| rollback path | `git restore -- skills/jj-end/SKILL.md tests/jj-end-contract.test.mjs docs/commands/jj-end.md docs/pitfalls.md docs/skill-zh-bridge/jj-end/README.zh.md CHANGELOG.md` or drop the auto-optimize branch after copying the report |
| next data-collection action | keep a raw Grok/Codex export next time; second independent staging-vs-dev closeout becomes holdout; after promote, `node src/cli.mjs install-skill --platform all --force` |

🛑 Business repo `trade-exhibition-mobile` was **not** edited. Local `staging` is already `91513d23` = `origin/staging`. Remote `dev` already has `3343c0fd`.

---

🔴 CHECKPOINT · 🛑 STOP — explicit human approval required before commit/promote of C-end-integration-no-gitlog-v1.
