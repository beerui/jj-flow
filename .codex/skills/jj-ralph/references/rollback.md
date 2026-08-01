# Ralph 回退语义（rollback）

> Ledger 诚实前进：gate / phase / status 可按允许边回退；**无终态冻结**（COMPLETED / ARCHIVE / ABANDONED 均可同 run resume）；**不**默认 git 时光机；**不**擦除历史 archive 快照。  
> 权威实现：`src/ralph.mjs`（`setGate` / `rollbackPhase` / `setRunStatus` / `resumeRun` / `abandonRun` / `archiveRun`）。

## 何时读

- 用户说「撤销上次验收」「退回 DELIVER」「暂停任务」「阻塞原因」「继续已归档任务」「不做了」
- accept 误 PASS，或 product-consistency 发现后要诚实回到实施
- COMPLETED / 归档后要再做 → **同 run resume**（优先）；仅真新需求才新 run
- 一半不做了 → `ABANDONED`（可再 resume）

## 动作矩阵

| 用户意图 | API / 脚本 | 允许 | 禁止 |
| --- | --- | --- | --- |
| 改 gate | `setGate` / `ralph_ops gate` | PASS→FAIL/PENDING/BLOCKED；写 `updated_at` | 无日志手改 `run.json` gates |
| phase 回退 | `rollbackPhase` | 相邻允许边（见下），含 **ARCHIVE→ACCEPT** | 跳级回退 |
| 暂停 / 阻塞 | `setRunStatus` | 各 soft status 互转（须 reason） | 无 reason |
| 归档后续作 | `resumeRun` / `setRunStatus`→`IN_PROGRESS` / `rollback-phase` | 同 `run_id`；可再 archive | 默认强制新 run；声称 COMPLETED 不可 reopen |
| 一半不做 | `abandonRun` / `set-status ABANDONED` | 记 reason；禁 map-merge | 对 ABANDONED 直接 archive |
| 废弃救回 | `resumeRun` | → `IN_PROGRESS` | — |
| 真新需求 | `init` 新 run（可选 progress 链） | 用户明确新需求族 | 把「再改同一需求」当成必须新 run |
| 代码回滚 | git 建议包 | 列 sha + revert message | 默认自动 revert |
| `close` | — | **deprecated**；提示 `abandon` 或 `archive` | 当一等终态入口 |

## phase 回退边（仅此）

```text
PLAN    → ANALYZE   （gates.analyze 可回 PENDING/FAIL；plan 及之后清为 PENDING）
DELIVER → PLAN
ACCEPT  → DELIVER
ARCHIVE → ACCEPT    （soft archive 后续作；离开后 accept/archive gate 可清 PENDING）
```

`rollbackPhase` 会：

1. 校验当前 `phase` 与目标 `toPhase` 为上表相邻边
2. **允许** `status=COMPLETED` / `ABANDONED`：默认 `resumeInProgress` → 写回 `IN_PROGRESS` 再回退
3. 将目标 phase 之后的 gates 置 `PENDING`；可选把离开 phase 的 gate 置 `FAIL`
4. 写 `progress.md` 一行 + `run.updated_at`
5. `status` 若为 `BLOCKED` 且原因消失，可回到 `IN_PROGRESS`（由调用方 `setRunStatus` 或参数控制）

## status（全部 soft）

```text
IN_PROGRESS ↔ PAUSED
IN_PROGRESS ↔ BLOCKED
IN_PROGRESS ↔ READY_FOR_USER_TEST
IN_PROGRESS ↔ ABANDONED      （abandon / resume）
IN_PROGRESS ↔ COMPLETED      （archive 展示态 / resume 续作）
```

- `COMPLETED`：兼容别名 = 最近一次 soft archive 后的展示态；**必须可 continue**，不得 throw
- `ABANDONED`：半做成弃；**禁止** map 当 durable 能力源；resume 可救回
- 历史读入的旧 COMPLETED：**允许**同目录拉回 `IN_PROGRESS`

## archive（事件，非墓碑）

- 要求 `gates.accept=PASS`（或 force）
- 写 **快照** 到 archive 目录；路径已存在则 **时间戳子目录**（允许 re-archive）
- `map-merge` 提升 durable 能力（**ABANDONED 禁止**）
- 记录 `last_archived_at` / `last_archive_path`
- status 可置 `COMPLETED` 作展示，**不**锁死后续同 run 修改
- 历史快照保留审计；「不 un-archive 覆盖」= **不擦掉旧 snapshot 装成没归档过**，**不是**禁止 resume

改错 / 子需求 / 续作决策树：见 [post-complete-continue.md](post-complete-continue.md)。

## 负例

| 负例 | 正确做法 |
| --- | --- |
| COMPLETED 后强制新 run「因为关账了」 | `resume` / `set-status IN_PROGRESS` 同 run |
| 手改 status 无 progress | `setRunStatus` / `resumeRun`（写 progress） |
| ACCEPT 误 PASS 后只改聊天 | `setGate accept FAIL` 或 `rollbackPhase` → DELIVER |
| ARCHIVE 后认为 phase 不可回 | `rollback-phase --to ACCEPT`（再按需到 DELIVER） |
| ABANDONED 上 map-merge | 先 `resume` |
| 用 `close` 关任务 | `abandon` 或 soft `archive`/`finalize` |
| 把 `$jj-end` 当任务终态 | Git only，与 run 生死正交 |

## 脚本

```bash
node <resolved>/ralph_ops.mjs gate --run-id RALPH-x --gate accept --status FAIL
node <resolved>/ralph_ops.mjs rollback-phase --run-id RALPH-x --to DELIVER --reason "验收证据不足"
node <resolved>/ralph_ops.mjs set-status --run-id RALPH-x --status PAUSED --reason "等 UAT"
node <resolved>/ralph_ops.mjs resume --run-id RALPH-x --reason "归档后继续改 tip"
node <resolved>/ralph_ops.mjs abandon --run-id RALPH-x --reason "需求取消"
```

库 API：

```js
rollbackPhase(runId, { toPhase: 'DELIVER', reason: '…', cwd });
// ARCHIVE → ACCEPT 合法；COMPLETED/ABANDONED 时默认 resumeInProgress
setRunStatus(runId, { status: 'PAUSED', reason: '…', cwd });
resumeRun(runId, { reason: '…', cwd });
abandonRun(runId, { reason: '…', cwd });
setGate(runId, { gate: 'accept', status: 'FAIL', cwd, advance: false });
```
