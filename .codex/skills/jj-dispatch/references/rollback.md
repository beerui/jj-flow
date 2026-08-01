# Dispatch 回退语义（rollback）

> 控制面诚实前进，不是 git 时光机。默认 **不** 自动 `git revert` / `reset` / unmerge / force-push。
> 权威实现：`src/dispatchControlPlane.mjs`（`prepareModeSReopen` / `reopenTarget` / `blockDispatchIntent` / `requestRework` / `abandonDispatchUnknown`）。

## 何时读

- 用户说「回退目标」「撤销验收」「假 VERIFIED」「停掉这个 task」
- 发现 `VERIFIED` 无 commit / 合成 session，需要收口而非手改 JSON
- Review `NEEDS_CHANGES` 后正式 rework
- **代码**怎么抹：reset vs revert → 见下方 **G-menu**（必须用户点选）

## 端到端流程（推荐）

```text
1. 备份 control-plane.json
2. Mode S 软 plane：prepareModeSReopen（或 reopenTarget 内自动 prepare）
3. reopenTarget 每个要回退的 target（attempt++、PREVIEW_ONLY、TARGET_REOPENED）
4. plane-self-check
5. 展示 G-menu（Git 探测表 + 选项）→ 停等用户
6. 仅执行用户选择的 git 动作；默认不 push
7. 写 progress / 可选 GIT_* event
```

禁止：手改 `VERIFIED→PENDING` 无 event；无确认改 git；Agent 默认 revert。

## 动作矩阵（控制面）

| 用户意图 | API / 等价落盘 | 从 | 到 | 必写 |
| --- | --- | --- | --- | --- |
| 误标 / 要重做已验收目标 | `reopenTarget`（`supersedeVerified` 同义） | target `VERIFIED` / `NO_CHANGE_REQUIRED` | target `PENDING` + **attempt++** + approval 清空 + delivery `PREVIEW_ONLY` | `TARGET_REOPENED`；`revision++`；保留 checkpoint 审计 |
| Mode S 软字段 plane | `prepareModeSReopen` 或 reopen 默认 `prepareSoft=true` | DONE/BOUND 软终态 | 合约 COMPLETED + checkpoint | 不单独涨 revision |
| 停掉未完成 intent | `blockDispatchIntent` | `PENDING_THREAD` / `BOUND` | `BLOCKED` | `DISPATCH_INTENT_BLOCKED` |
| Review 返工 | `requestRework` | `NEEDS_CHANGES` | attempt++ | `REWORK_REQUESTED` |
| 丢不掉的 UNKNOWN | `abandonDispatchUnknown` | `UNKNOWN` | `BLOCKED` | `DISPATCH_ABANDONED` |
| 代码要回滚 | **G-menu**（用户点选） | — | — | 用户确认后才执行 |

## Mode S 特殊规则

- 多 `task_key` **可以**共享同一真实 `thread_id`，当且仅当 `host_id=grok-build` 且 `handle_kind=session`。
- Codex `handle_kind=thread` **仍全局唯一**。
- 软写盘常见：`responsibility.status=DONE`、`intent.status=BOUND`+`result.outcome=DONE`、target 顶层 `commit` 无 `last_result`。
- **`reopenTarget` 默认先 `prepareSoft`**，再校验并 reopen；Agent 无需手写归一化脚本。
- 仍须真实 session id；合成 `session-*-YYYYMMDD` 由 plane-self-check 拦截。

```js
import { prepareModeSReopen, reopenTarget } from '…/dispatchControlPlane.mjs';

// 推荐：reopen 内自动 prepare
plane = reopenTarget(plane, {
  deliveryId: 'DEL-…',
  projectId: 'project-b',
  reason: '用户回退验收'
});

// 可选 dry-run 只归一化
const prepared = prepareModeSReopen(plane, { deliveryId: 'DEL-…' });
```

## G-menu（Git 决策 — 必须用户点选）

### 原则

1. **无用户确认，不改 git**
2. 控制面 reopen 与 git **解耦**（可选 [1] 只回 plane）
3. Agent：探测 → 填表 → 标 Recommended → **停**
4. 已合 integration：**禁止 reset**；只给 revert / fix-forward

### 每仓探测

| 项 | 用途 |
| --- | --- |
| branch / tip | 展示 |
| task_shas[] | 本任务 produced_commit |
| ahead of origin | 是否仅本地 |
| tip 是否仅本任务提交 | 能否 reset 一刀 |
| task_sha 是否在 dev/develop/main 历史上 | 能否 reset |
| dirty | 先停 |

### 推荐规则

```text
dirty → 先处理脏区
on_integration → revert | fix-forward（禁止 reset）
已 push feature → revert（reset 须二次确认 force 风险）
未 push 且 tip 即本任务 → reset（Recommended）| revert | 保留代码
其他 → task-scoped revert | 保留代码
```

### 标准选项

```text
【Git 怎么处理？】（可按仓不同，默认同策略）

[1] 仅控制面回退，代码保留
[2] 本地丢弃 tip（reset）— 未 push 且 tip 干净时 Recommended
[3] 追加 revert 提交 — 已 push / 要留审计
[4] 取消 git 动作

说明：
- 未合 dev 时 [2]/[3] 都不影响线上 integration
- [2] 历史最干净，通常无需 push
- [3] 未 push 时通常不必选（会留下 A+Revert）
```

### 执行边界

| 选项 | 允许 | 禁止 |
| --- | --- | --- |
| [1] | 无 git | — |
| [2] | `git reset --hard` 到任务前 tip | force-push；已合 dev |
| [3] | `git revert <task_sha…>` | 默认 force-push |
| 已合 dev | 仅 [3] 或 fix-forward | [2] |

执行后写 task `progress.md`；可选 event `GIT_ROLLBACK_RESET` / `GIT_ROLLBACK_REVERT`。**默认不 push。**

### 旧路径对照

| 旧说法 | G-menu |
| --- | --- |
| A 只 plane | [1] |
| B 撤代码 | **拆成 [2] reset / [3] revert**（勿默认 revert） |
| C 放弃 | plane 停 PREVIEW + [1] |

## 负例

| 负例 | 正确做法 |
| --- | --- |
| 手改 VERIFIED 无 event | `reopenTarget` |
| 未确认默认 `git revert` | G-menu 等用户 |
| 未 push 干净 tip 却默认 revert | **推荐 [2] reset** |
| 已合 dev 却 reset/force | 只 revert/fix-forward |
| 同 key 再 create | attempt++ 新 key |

## R4 `rollbackPrep`（建议包，不执行 git）

```js
import { buildRollbackPrep, buildRollbackPrepFromPlane, recommendGitStrategy } from '…/dispatchRollbackPrep.mjs';

const prep = buildRollbackPrep({
  delivery_id: 'DEL-…',
  reason: 'user rollback',
  repos: [{
    project_id: 'project-b',
    path: '/portfolio/project-b',
    branch: 'feat/…',
    task_shas: ['9093b961d…'],
    ahead: 1,
    pushed: false,
    tip_is_task_only: true,
    on_integration: false,
    dirty: false
  }]
});
// prep.repos[].recommended === 'reset' | 'revert' | …
// prep.repos[].commands — show user; do NOT run until G-menu confirm
```

验收：fixture 与 readme-pnpm 类 probe 输出一致；`executes_git: false`。

## 正式关闭 delivery

回退完成后若不重做 attempt：

```js
plane = closeDelivery(plane, {
  deliveryId: 'DEL-…',
  outcome: 'ROLLED_BACK', // ABANDONED | ROLLED_BACK | SUPERSEDED_CLOSED | CANCELLED
  reason: '用户确认关闭：控制面已 reopen，代码已 reset/revert'
});
// status → BLOCKED；event DELIVERY_CLOSED；closeout 元数据
```

禁止对仍 `VERIFIED` 的 delivery 直接 close（须先 reopen）。

## plane-self-check

假/残缺 VERIFIED → `VERIFIED_REOPEN_SUGGESTED`：走 reopen，勿静默改 status。  
C4：BOUND + grok-build 要求 attestation **文件路径**（含 review）。  
C5：`gradePlaneTerminalIntegrity` → `ok|degraded|fail`；可 `setIntegrityGrade` 写 plane。  
C6：`setRemoteCloseout` 标注 push/merge（不挡 VERIFIED）。
