# Episode evaluation — rollback `DEL-readme-pnpm-install-20260731`

> Status: **rollback episode closed** (control-plane reopen + feature-branch task-scoped git revert); remote push **optional open**
>
> Skill: `jj-evaluated`
>
> Scope: first live exercise of dispatch/ralph **rollback path B** on the Mode S golden delivery
>
> Non-goals: do not rewrite historical VERIFIED snapshot without events; do not force-push; do not unmerge `dev` (pnpm commits were never ancestors of `dev`)

## 1. Scope and authorities

| Field | Value |
| --- | --- |
| episode_id | `EP-20260731-D1-readme-pnpm-rollback` |
| parent_episode | `EP-20260731-D1-readme-pnpm-install` (`docs/evaluations/2026-07-31-readme-pnpm-dispatch.md`) |
| delivery_id | `DEL-readme-pnpm-install-20260731` |
| task_id | `TASK-DEL-readme-pnpm-install-20260731` |
| feature | 回退 README 安装依赖 `pnpm install` → 恢复 `npm install` |
| host | Grok Build Mode S（同会话调度；回退在后续会话执行） |
| session_id (original dispatch) | `019fb5b3-b1f4-78b3-b79d-ffd601f91e55` |
| control_root | `D:/a/dispatch-control` |
| control-plane hash @ eval | `2f07acdfb729` (SHA-256 prefix) |
| plane revision | `4` (VERIFIED) → `6` (reopen) → **`7`** (git revert recorded) |
| evaluation_date | 2026-07-31 |
| harness | `@shendu-sdt/jj-flow` R1–R3 rollback APIs + Mode S soft plane |

### Role mapping (facts @ rollback)

| Role | project_id | path | branch | tip @ eval | note |
| --- | --- | --- | --- | --- | --- |
| 承接 lead/owner/origin | `cj-web` | `D:/a/cj-web` | `feat/cj-0731-lyj` | `86dbbdf23` Revert | **not** a dispatch target; source/lead; path B 一并 revert |
| 兑接 target | `dj-web` | `D:/a/dj-web` | `feat/dj-0731-lyj` | `3ee8d3cc4` Revert | target reopen + git revert |
| 承载用户端 target | `cz-broker-web` | `D:/a/cz-broker-web` | `feat/cz-0731-lyj` | `6d589864f` Revert | target reopen + git revert |

Artifact anchors:

- `D:/a/dispatch-control/.workflow/dispatch/DEL-readme-pnpm-install-20260731/control-plane.json` (`2f07acdfb729`)
- backup pre-reopen: `control-plane.pre-reopen-2026-07-31T01-48-07-073Z.json`
- task: `…/tasks/TASK-DEL-readme-pnpm-install-20260731/{progress,result}.md`
- prior success eval: `docs/evaluations/2026-07-31-readme-pnpm-dispatch.md`
- rollback exec plan: `docs/exec-plans/active/2026-07-31-dispatch-ralph-rollback.md`

## 2. Normalized timeline (trace-backed)

| event_id | kind | phase | labels | evidence |
| --- | --- | --- | --- | --- |
| evt-parent-verified | artifact_write | dispatch | Mode S golden | plane rev 4 VERIFIED; eval readme-pnpm-dispatch |
| evt-user-request-rollback | user_request | dispatch | user_correction | 用户：开始回退 DEL-readme-pnpm… |
| evt-reopen-blocked-strict | tool_call | dispatch | evidence_gap | `validateControlPlane` fail：共享 session thread_id + DONE/BOUND 软字段 |
| evt-reopen-soft | artifact_write | dispatch | reopen | soft `reopenTarget` 等价：rev 4→6；`TARGET_REOPENED`×2 |
| evt-path-choice | user_request | dispatch | user_correction | 用户选 **B**（控制面已 reopen + feature git revert） |
| evt-git-revert-dj | commit | sync | task_scoped_revert | `9093b961d` → revert `3ee8d3cc4` |
| evt-git-revert-cz | commit | sync | task_scoped_revert | `f7fbe8818` → revert `6d589864f` |
| evt-git-revert-cj | commit | sync | task_scoped_revert | lead `1ec732bd6` → revert `86dbbdf23` |
| evt-git-event | artifact_write | dispatch | evidence | plane rev 7 `GIT_ROLLBACK_REVERT` |
| evt-self-check | verification | dispatch | C3 | plane-self-check **OK**（findings=[]） |

### Time accounting

| Metric | Value | timestamp_provenance | clock_quality |
| --- | --- | --- | --- |
| wall_span (reopen→git event) | ~2.3 min (`01:48:07Z` → `01:50:28Z`) | artifact | exact |
| active_duration | unknown（无完整 thread export 覆盖本回退会话） | — | unknown |
| human_attention | 2 决策：开始回退；选路径 B | user_export / chat | derived |
| tool_wait | 无 build/lint/browser | — | exact (N/A) |
| handoff_wait | 0 | — | exact |
| git_revert_span | 三仓连续 revert ~1s 墙钟 | git | exact |
| artifact_write_span | plane + progress/result 追加 | filesystem | diagnostic only |

**勿**用 `run.json` 时长代替本 episode 时钟。

## 3. Baseline outcomes

| Layer | Before rollback | After path B | Correctness |
| --- | --- | --- | --- |
| Dispatch delivery | `VERIFIED` | **`PREVIEW_ONLY`** | pass |
| Targets dj/cz | `VERIFIED` attempt 1 | **`PENDING` attempt 2** | pass |
| Approval | APPROVED frozen keys | **PENDING** | pass |
| Events | empty / soft | `TARGET_REOPENED`×2 + `GIT_ROLLBACK_REVERT` | pass |
| plane-self-check | OK @ VERIFIED（parent） | **OK** @ PREVIEW_ONLY | pass |
| Feature README tip | `pnpm install` | **`npm install`** 三仓 | pass (git) |
| On `dev`? | pnpm sha **not** ancestor of `dev`/`origin/dev` | 仍无需 unmerge | pass |
| Remote feature | ahead 1 (pnpm) | **ahead 2** (pnpm+revert)，**未 push** | open |
| Ralph source run | `COMPLETED` ARCHIVE | **仍 COMPLETED**（未 supersede 新 run） | intentional gap |

## 4. Behavior tags and causal hypotheses

| Tag | Evidence | Causal hypothesis |
| --- | --- | --- |
| `user_correction` | 用户驱动 reopen + 选 B | 回退非自动；人闸门有效 |
| `evidence_gap` | 严格 `reopenTarget` 因 Mode S 软 plane 失败 | 共享 `thread_id` 唯一性 + `DONE`/`BOUND` 非合约枚举 → **必须 soft 等价路径** |
| `handoff_reuse` | 复用 parent delivery 身份与 task 目录 | 未新建 delivery；审计链连续 |
| `branch_correction` | 无（分支名未改） | feature 不变，仅 tip 追加 revert |
| `regression` (positive) | 未 force-push / 未动 dev / task-scoped sha | 与 rollback exec plan 非目标一致 |
| `stale_snapshot` (mild) | `result.md` 仍含历史「状态：VERIFIED」段落后跟 Rollback 节 | 追加写 progress 正确，result 标题未改写 |
| `redundant_analysis` | 无 | 未重做 README 分析 |

**Root cause of strict-API miss（非业务失败）：**  
Mode S 合法同会话多 intent 绑定同一 `session_id`，但 `validateControlPlane` 对 **所有** 带 `thread_id` 的 intent 做全局唯一；COMPLETED 后仍冲突。软 plane 另用 `DONE` 而非 `COMPLETED`。故 **R2 API 无法直接吃 live Mode S 金样**，必须 soft reopen 或先归一化（归一化又撞 session 唯一性）。

## 5. Split (search / holdout / regression)

| Split | Membership | Leakage check |
| --- | --- | --- |
| **search** | soft Mode S → reopen 适配；`GIT_ROLLBACK_REVERT` 事件形状；result.md 收口文案 | 勿用「手改 VERIFIED」当训练正例 |
| **holdout** | 已合 `dev` 的回退（本 episode **未覆盖**）；多仓 merge-commit 回退 | 保留给 R4 / 真合 dev 负例 |
| **regression** | path B：reopen 后 task-scoped `git revert`；禁止 force-push/unmerge；双层真相（plane+git）同向 | 与 acceptor-tag「整支 merge 冲树」负例正交 |

Parent golden **readme-pnpm install** 仍为 Mode S success regression；本文件是 **rollback regression 金样**。

## 6. One candidate change（本迭代只推一个）

### Candidate **R-soft-reopen**（推荐下一刀）

| Field | Content |
| --- | --- |
| Problem | Live Mode S plane 无法调用严格 `reopenTarget`；Agent 易回退到手改 JSON |
| Mechanism | 在 skill `rollback.md` + 可选 `reopenTargetSoft`（或文档化「先关 intent / 共享 session 例外」）中：**承认 Mode S 共享 session 的历史 intent**；reopen 写 `TARGET_REOPENED` + attempt++ + PREVIEW_ONLY |
| Bounded diff | skill 文案 + 合约测试 fixture（软 plane → reopen 事件）；**或** validator 对 `host_id=grok-build` + `COMPLETED` 允许多 intent 同 `thread_id` |
| Expected | 金样可机械重放；减少 ad-hoc 脚本 |
| Not in this candidate | 自动 git revert；Ralph COMPLETED un-archive |

**Confounders：** 改 validator 可能放宽 Codex 多 thread 误绑 — 须 `handle_kind=session` 门控。

### Deferred（不在本刀）

| ID | Note |
| --- | --- |
| R4 rollback-prep | fixture 输出与本 episode sha 列表对齐 |
| R-ralph-supersede | 源 `RALPH-readme-pnpm-install-20260731` 仍 COMPLETED；若业务要求 ledger 一致，应新 run + supersedes |
| R-result-hygiene | result.md 顶部 VERIFIED 段落改「superseded」避免人读混淆 |

## 7. Replay / checks（本 episode）

| Check | Result | Note |
| --- | --- | --- |
| plane-self-check | **OK** | 无 VERIFIED 假绿 |
| pnpm sha ∉ dev | **OK** | merge-base ancestor exit=1 三仓 |
| README tip | **OK** | 三仓 `npm install` |
| force-push | **not used** | — |
| strict validateControlPlane | **still fail-closed on soft shape** | 预期；soft reopen 不宣称严格合约绿 |
| jj-flow unit tests for R1–R3 | prior session **PASS** | 库 API 有测；**live soft 路径无仓内 fixture** |

未跑 build/lint/browser：验收合同仅为 README 一行；`clock_quality` 与 acceptance 不要求。

## 8. Scorecard（multi-objective，非单一标量）

| Objective | Grade | Note |
| --- | --- | --- |
| 控制面诚实 | **A** | events + revision 单调；无静默擦 VERIFIED |
| Git 安全 | **A** | task-scoped revert；未动 dev；无 force-push |
| 双层对齐 | **A-** | plane reopen + git revert；Ralph 层未动 |
| 可机械复现 | **B** | soft 路径 ad-hoc；严格 API 未跑通 live |
| 用户门禁 | **A** | B 需确认后才 revert |
| 文档/result 卫生 | **B-** | progress 好；result 历史标题残留 |
| 时间精度 | **B** | wall exact；active unknown |

## 9. Promotion / rollback of *this eval*

| Item | Status |
| --- | --- |
| Episode archive | **this file**（versioned in jj-flow） |
| Promote R-soft-reopen | **promoted in tree**（session share + `prepareModeSReopen` + G-menu skill；见 v2 plan） |
| Promote R4 | wait for soft-reopen 或独立 fixture |
| Rollback of business git | already applied (revert commits)；若误操作可 `git revert` 再反转 tip |
| Rollback of plane | restore `control-plane.pre-reopen-2026-07-31T01-48-07-073Z.json`（**不推荐**除非演练） |

## 10. Next data-collection

1. 若 push feature：记录 origin ahead 收敛，更新本 eval remote 层。  
2. 补 **已合 dev** 回退 holdout（另 episode）。  
3. 将 soft reopen 固化为仓内 negative/soft fixture 测试。  
4. 可选：Ralph `suggestReopenAsNew` 对 COMPLETED 源 run 走 supersede 文档演练。

## 11. Bottom line

**本次回退任务：成功（路径 B 完整）。**

- **控制面**：`VERIFIED` → `PREVIEW_ONLY`，attempt 2，事件可追溯，self-check 绿。  
- **Git**：三仓 feature task-scoped revert，README 恢复 `npm install`，**未**进 `dev`、**未** push。  
- **主要进化点**：Mode S **软 plane 与严格 `reopenTarget` 之间的缺口**（候选 **R-soft-reopen**）。  
- **未做**：Ralph COMPLETED 原地回退（符合「新 run / 不 un-archive」裁决）；远端收口。

**Harness：** 不必为本次改 harness-manifest；把 soft reopen 与 GIT_ROLLBACK 事件形状纳入 skill + 合约测试即可。
