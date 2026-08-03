# Evaluation: DEL-shang-tag-color-cz-20260803 — stale local master base

**Date:** 2026-08-03  
**Episode:** `EP-20260803-dispatch-stale-master-branch`  
**Full report:** `docs/evaluations/EP-20260803-dispatch-stale-master-branch-report.md`  
(jj-flow 仓禁止 `.workflow/`；episode 正文落在 versioned `docs/evaluations/`)

## Verdict

**Confirmed.** On 承载 `cz-broker-web`, the agent created `feat/cz-0807-lyj` from **stale local `master`** without updating against `origin/master`. The new branch tip equals local master `f45576c02` (2026-07-27) and is **64 commits behind** `origin/master` `d78af9489` (2026-08-01).

Branch-purpose preflight worked (left tracker train). Base-freshness was never gated.

## Evidence (git + plane)

| Fact | Value |
| --- | --- |
| delivery | `DEL-shang-tag-color-cz-20260803` |
| plane preflight action | `CREATE from local master then CODE` |
| reflog | `Created from HEAD` after `checkout master` @ `f45576c02` |
| local master | `f45576c02` Merge #169 (2026-07-27) |
| origin/master | `d78af9489` Merge #187 (2026-08-01) |
| lag | `git rev-list --count master..origin/master` → **64** |
| feat tip | identical to local master (no own commit yet; dirty ADAPT) |

Contrast: 承接/兑接 local master already matched origin/master (`0 0`), so the same CREATE rule looked fine there.

## Root cause (policy, not only agent slip)

jj-same family rules **require** CREATE from local `master` and **forbid** auto-updating local `master`:

- `references/workflow-core.md` — 「不得自动更新本地 master」
- `references/project-family.md` §分支派生规则
- `SKILL.md` MUST NOT

That combination systematically produces stale bases on lagging clones.

## Candidate → promoted

**C-base-freshness-v1** promoted 2026-08-03 into jj-same + jj-dispatch skill SSOT, then `jj install-skill --platform all --force`.

- CREATE preflight: `behind_count` + `base_action` (`USE_LOCAL` / `FETCH_FF` / `CREATE_FROM_ORIGIN` / `NEEDS_CONFIRM` / `BLOCKED`)
- G6 golden Q&A; dispatch happy-path table + host-action-contract confirm reasons + Grok PREFLIGHT #9
- Policy: fetch+ff or from origin **required** when lagging; still forbid hard-reset of dirty/divergent master

Protect regression: EP-S1 branch-purpose gate.

## Ops recovery (done)

On `D:/a/cz-broker-web` (2026-08-03):

1. Stashed 3-file ADAPT (backup patch under delivery dir)
2. `git fetch origin master` + `merge --ff-only` on master (`f45576c02` → `d78af9489`)
3. Deleted stale `feat/cz-0807-lyj`, recreated from updated master
4. Stash pop clean; ADAPT intact; `behind_count=0`
5. control-plane rev 2 event `BASE_RECOVERY`; plane-self-check OK

Still dirty / uncommitted → plane ceiling remains `EVIDENCE_READY` until commit.
