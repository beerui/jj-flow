# Episode evaluation — preference-modified three-frontend port

> Status: evaluation closed for this export (candidates already promoted)
>
> Skill: `jj-evaluated`
>
> Export: `D:\dingding-download\20260730-172506-preference-modified-dispatch`
>
> Non-goals: do not invent control-plane facts; do not re-open business commits.

## 1. Scope and authorities

| Field | Value |
| --- | --- |
| episode_id | `ep-20260730-preference-modified-state-three-frontends` |
| feature | 收票偏好修改态与新增项虚线标记修复 |
| export generated_at | `2026-07-30T17:25:06+08:00` |
| control-plane | **null** (no `control-plane.json` / `task_key`) |
| host | Codex Desktop (thread JSONL) |
| evaluation_date | 2026-07-30 |

Role mapping (export facts only):

| Role | project_path | branch | feature_commit | thread_id |
| --- | --- | --- | --- | --- |
| 承接 | `…/chengjie/frontend-web` | `feat/cj-0731-jmb` | `88ee0bebcc…` | `019fb207-2380-75c0-97f4-3de61ae0879e` |
| 兑接 | `…/duijie/frontend-web` | `feat/dj-0731-jmb` | `3a0ed04710…` | `019fb249-101a-7192-bb55-1afe17b4e5a3` |
| 承载 | `…/chengjie/broker-web` | `feat/cz-0731-jmb` | `6c6dbf2ef1…` | `019fb24c-8d31-77c3-bf73-35e8fe4d0404` |

承载 additionally: `dispatch_worktree_path` = `~/.codex/worktrees/08ce/broker-web`；export 时 dispatch tree = detached + dirty；main worktree clean after land.

Artifact anchors: `manifest.json`, `normalized-events.jsonl`, `task/dispatch-task.md`, `threads/raw/*`, `repositories/*`.

## 2. Normalized timeline (export)

| event_id | kind | role | active_s (thread) | labels | notes |
| --- | --- | --- | ---: | --- | --- |
| evt-cj-feature-commit | commit | 承接 | — | user_correction | feature + later dev merge |
| evt-cj-dev-merge | commit | 承接 | — | | |
| evt-dj-context-thread | handoff_created | 兑接 | — | role_mapping, handoff_reuse | main-repo feature path |
| evt-cz-dispatch | handoff_created | 承载 | ~352 | handoff_reuse, target_native_adaptation, evidence_gap | **exclusive worktree** implement |
| evt-cz-transfer | artifact_write | 承载 | ~87 | branch_correction | user: 合到当前分支 |
| evt-cz-review | review | 承载 | — | validation_wait, ADAPT | APPROVE; static checks |
| evt-cz-feature-commit | commit | 承载 | — | | Git fact |
| evt-cz-dev-merge | commit | 承载 | — | evidence_gap | Git fact |

Task body (`task/dispatch-task.md`) instructed **`$jj-same`** onto 承载, branch `feat/cz-0731-jmb`, no push; cwd was still a Codex exclusive worktree.

## 3. Baseline (cautious)

| Metric | Value | clock_quality | provenance |
| --- | --- | --- | --- |
| Business outcome | three fronts feature + land on `dev` | exact | git timestamps in manifest |
| 承载 implement wall (thread) | ~6 min active (352s) on worktree | exact | thread |
| Transfer cost | ~87s active | exact | thread |
| Formal dispatch CAS | **absent** | n/a | evidence_gap |
| Static verification | focused tests / template / eslint / diff-check claimed | derived | export claims |
| Browser / real API | not run | n/a | export |

Do not use filesystem mtime as wall span.

## 4. Tags and causal hypotheses

| Tag | Evidence | Hypothesis |
| --- | --- | --- |
| `branch_correction` | evt-cz-transfer; detached dirty worktree at export | Default exclusive worktree ≠ user mental model of feature branch main checkout |
| `evidence_gap` | no manifest / task_key / receipt / ANL-PLN-VRF-REV ids | Episode is same-shaped port under dispatch packaging, not full control plane |
| `target_native_adaptation` | migration_decision ADAPT; old-version paths | Correct same discipline on 承载 |
| `handoff_reuse` | source commit + task payload; 兑接/承载 consume context | Source analysis not fully rebuilt |
| `user_correction` | 承接 thread (requirement sequence); 承载 “合到当前分支” | Product/UX friction on workspace |

**Dominant failure mode:** workspace isolation default, not wrong product code.

**Success mode:** ADAPT + static gates + three-role git land.

## 5. Dataset split

| Split | Use |
| --- | --- |
| **search** | this episode (worktree → transfer) |
| **holdout** | ~~future formal plane~~ → **graduated** by `2026-07-31-readme-pnpm-dispatch.md` (Mode S OK) |
| **regression** | project-branch default; confirm-before-DISPATCH; no silent detached exclusive |

Leakage: formal Mode S success is documented; do not train on acceptor-tag fake VERIFIED as success.

## 6. Candidate changes (status)

### C1 — Default write `project-branch` (same-style)

- Mechanism: bind developer to named feature branch at `project.path`; exclusive worktree only for concurrent write / dirty main / user opt-in.
- Expected: eliminate transfer tax; align 承接/兑接/承载 UX.
- **Promoted:** jj-flow `10da281` (`feat(dispatch): default write workspace to project-branch`); contract tests green.

### C2 — Confirm branch/workspace when uncertain before DISPATCH

- Mechanism: PREVIEW judgment table; `NEEDS_CONFIRM` blocks intent/create until user answers.
- Expected: fewer silent wrong-branch / wrong-mode binds.
- **Promoted:** jj-flow `074a167` (`feat(dispatch): confirm branch/workspace before DISPATCH when uncertain`).

### Out of scope for this episode

- Closing real Host Wave 2 (still PENDING).
- Inventing control-plane artifacts for this export.

## 7. Replay

| Check | Result |
| --- | --- |
| dispatch-runtime + jj-dispatch-contract + harness-check (post-promote) | PASS (session recheck 78 tests subset + harness) |
| Target-native ADAPT | preserved (no identical-diff requirement) |
| Browser | skipped (export acceptance did not require) |

## 8. Promotion / rollback

| Item | Status |
| --- | --- |
| Evaluation record | this file |
| C1 | **promoted** on `main` |
| C2 | **promoted** on `main` |
| Rollback C1 | revert environment default to exclusive-worktree |
| Rollback C2 | remove NEEDS_CONFIRM gate from skill |
| Business repos | untouched by evaluation |

## 9. Next data-collection

1. One formal dispatch wave with `control-plane.json`, `task_key`, receipts, and project-branch bind (holdout).
2. Confirm PREVIEW judgment table appears in a live Grok/Codex dispatch session.
3. Optional: browser/API acceptance sample for preference-modified UI.

## 10. Bottom line

Episode proves **three-role same/port can land** with ADAPT and static checks, and proves **exclusive detached worktree defaults create user-visible branch_correction**. Protocol response (project-branch default + confirm-before-dispatch) is already on `main`; this export remains the regression narrative for that change.
