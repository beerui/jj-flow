# Ralph 回退语义（rollback）

> Ledger 诚实前进：gate / phase / status 可按允许边回退；**不** un-archive 覆盖；**不** 默认 git 时光机。
> 权威实现：`src/ralph.mjs`（`setGate` / `rollbackPhase` / `setRunStatus`）。

## 何时读

- 用户说「撤销上次验收」「退回 DELIVER」「暂停任务」「阻塞原因」
- accept 误 PASS，或 product-consistency 发现后要诚实回到实施
- COMPLETED 要再做 → **新 run**，不是改旧目录 status

## 动作矩阵

| 用户意图 | API / 脚本 | 允许 | 禁止 |
| --- | --- | --- | --- |
| 改 gate | `setGate` / `ralph_ops gate` | PASS→FAIL/PENDING/BLOCKED；写 `updated_at` | 无日志手改 `run.json` gates |
| phase 回退 | `rollbackPhase` | 仅相邻允许边（见下） | ARCHIVE→任意；跳级回退 |
| 暂停 / 阻塞 | `setRunStatus` | `IN_PROGRESS` ↔ `PAUSED` / `BLOCKED` | `COMPLETED` → `IN_PROGRESS` |
| 再做已归档 | 新 run + `supersedes_run_id` 元数据建议 | 复制 goal/scope | un-archive 覆盖旧 archive |
| 代码回滚 | git 建议包 | 列 sha + revert message | 默认自动 revert |

## phase 回退边（仅此）

```text
PLAN    → ANALYZE   （gates.analyze 可回 PENDING/FAIL；plan 及之后清为 PENDING）
DELIVER → PLAN
ACCEPT  → DELIVER
ARCHIVE → （不可回）须新 run
```

`rollbackPhase` 会：

1. 校验当前 `phase` 与目标 `toPhase` 为上表相邻边
2. 拒绝 `status=COMPLETED`（须新 run）
3. 将目标 phase 之后的 gates 置 `PENDING`；可选把离开 phase 的 gate 置 `FAIL`
4. 写 `progress.md` 一行 + `run.updated_at`
5. `status` 若为 `BLOCKED` 且原因消失，可回到 `IN_PROGRESS`（由调用方 `setRunStatus` 或参数控制）

## status

```text
IN_PROGRESS ↔ PAUSED
IN_PROGRESS ↔ BLOCKED
READY_FOR_USER_TEST → IN_PROGRESS|PAUSED|BLOCKED（显式）
COMPLETED → 禁止 reopen 旧目录；新 run 链 supersedes_run_id
```

## COMPLETED / archive

- **不** `un-archive` 覆盖冻结副本
- 建议：`ralph_ops init` 新 `run_id`，在 **`progress.md` 首行** 写 `supersedes_run_id: <old_run_id>`（纠正）或 `parent_run_id: <old_run_id>`（纯子需求）；**勿**向未 schema 的 `run.json` invent 字段
- 旧 archive 与 map 条目保留作审计
- **改错 vs 子需求**（同 run 扩 scope / 新 run 链；相邻边回退）：见 [post-complete-continue.md](post-complete-continue.md)

## 负例

| 负例 | 正确做法 |
| --- | --- |
| 手改 `COMPLETED` → `IN_PROGRESS` 无 progress | `setRunStatus` 拒绝；新 run |
| ACCEPT 误 PASS 后只改聊天 | `setGate accept FAIL` 或 `rollbackPhase` → DELIVER |
| ARCHIVE 后改 phase=ACCEPT | 新 run |

## 脚本

```bash
node <resolved>/ralph_ops.mjs gate --run-id RALPH-x --gate accept --status FAIL
node <resolved>/ralph_ops.mjs rollback-phase --run-id RALPH-x --to DELIVER --reason "验收证据不足"
node <resolved>/ralph_ops.mjs set-status --run-id RALPH-x --status PAUSED --reason "等 UAT"
```

库 API：

```js
rollbackPhase(runId, { toPhase: 'DELIVER', reason: '…', cwd });
setRunStatus(runId, { status: 'PAUSED', reason: '…', cwd });
setGate(runId, { gate: 'accept', status: 'FAIL', cwd, advance: false });
```
