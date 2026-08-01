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
| 项目A | `…/org-a/frontend-web` | `feat/pa-0731-dev` | `88ee0bebcc…` | `019fb207-2380-75c0-97f4-3de61ae0879e` |
| 项目B | `…/org-b/frontend-web` | `feat/pb-0731-dev` | `3a0ed04710…` | `019fb249-101a-7192-bb55-1afe17b4e5a3` |
| 项目C | `…/org-a/broker-web` | `feat/pc-0731-dev` | `6c6dbf2ef1…` | `019fb24c-8d31-77c3-bf73-35e8fe4d0404` |

项目C additionally: `dispatch_worktree_path` = `~/.codex/worktrees/08ce/broker-web`；export 时 dispatch tree = detached + dirty；main worktree clean after land.

Artifact anchors: `manifest.json`, `normalized-events.jsonl`, `task/dispatch-task.md`, `threads/raw/*`, `repositories/*`.

## 2. Normalized timeline (export)

| event_id | kind | role | active_s (thread) | labels | notes |
| --- | --- | --- | ---: | --- | --- |
| evt-project-a-feature-commit | commit | 项目A | — | user_correction | feature + later dev merge |
| evt-project-a-dev-merge | commit | 项目A | — | | |
| evt-project-b-context-thread | handoff_created | 项目B | — | role_mapping, handoff_reuse | main-repo feature path |
| evt-project-c-dispatch | handoff_created | 项目C | ~352 | handoff_reuse, target_native_adaptation, evidence_gap | **exclusive worktree** implement |
| evt-project-c-transfer | artifact_write | 项目C | ~87 | branch_correction | user: 合到当前分支 |
| evt-project-c-review | review | 项目C | — | validation_wait, ADAPT | APPROVE; static checks |
| evt-project-c-feature-commit | commit | 项目C | — | | Git fact |
| evt-project-c-dev-merge | commit | 项目C | — | evidence_gap | Git fact |

Task body (`task/dispatch-task.md`) instructed **`$jj-same`** onto 项目C, branch `feat/pc-0731-dev`, no push; cwd was still a Codex exclusive worktree.

## 3. Baseline (cautious)

| Metric | Value | clock_quality | provenance |
| --- | --- | --- | --- |
| Business outcome | three fronts feature + land on `dev` | exact | git timestamps in manifest |
| 项目C implement wall (thread) | ~6 min active (352s) on worktree | exact | thread |
| Transfer cost | ~87s active | exact | thread |
| Formal dispatch CAS | **absent** | n/a | evidence_gap |
| Static verification | focused tests / template / eslint / diff-check claimed | derived | export claims |
| Browser / real API | not run | n/a | export |

Do not use filesystem mtime as wall span.

## 4. Tags and causal hypotheses

| Tag | Evidence | Hypothesis |
| --- | --- | --- |
| `branch_correction` | evt-project-c-transfer; detached dirty worktree at export | Default exclusive worktree ≠ user mental model of feature branch main checkout |
| `evidence_gap` | no manifest / task_key / receipt / ANL-PLN-VRF-REV ids | Episode is same-shaped port under dispatch packaging, not full control plane |
| `target_native_adaptation` | migration_decision ADAPT; old-version paths | Correct same discipline on 项目C |
| `handoff_reuse` | source commit + task payload; 项目B/项目C consume context | Source analysis not fully rebuilt |
| `user_correction` | 项目A thread (requirement sequence); 项目C “合到当前分支” | Product/UX friction on workspace |

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
- Expected: eliminate transfer tax; align 项目A/项目B/项目C UX.
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
