# Ralph 回退（agent）

实现：`src/ralph.mjs` — `setGate` / `rollbackPhase` / `setRunStatus` / `resumeRun` / `abandonRun` / `archiveRun`。

## 动作

| 意图 | 命令 | 说明 |
| --- | --- | --- |
| 改 gate | `gate --status FAIL` | 须写 progress / updated_at |
| phase 回退 | `rollback-phase --to …` | **仅相邻边**（下表） |
| 暂停 / 阻塞 | `set-status PAUSED\|BLOCKED` | 须 reason |
| 归档后续作 | `resume` | 同 run；可再 archive |
| 一半不做 | `abandon` | 禁 map；可 resume |
| 真新需求 | `init` 新 run | 勿把「再改同一需求」当新 run |
| 代码回滚 | git 建议 | 默认不自动 revert |

## phase 相邻边

```text
PLAN    → ANALYZE
DELIVER → PLAN
ACCEPT  → DELIVER
ARCHIVE → ACCEPT
```

`rollbackPhase`：校验相邻边；`COMPLETED`/`ABANDONED` 时默认先回到 `IN_PROGRESS`；后续 gates 置 PENDING；写 progress。

## status

| status | 含义 |
| --- | --- |
| `IN_PROGRESS` 等 | 活跃 / 停表 |
| `COMPLETED` | 最近一次归档后的展示态；**可 resume** |
| `ABANDONED` | 废弃；禁 map-merge；可 resume |

## archive

- 需 accept PASS（或 force）  
- 写快照（路径占用则时间戳目录，允许再归档）  
- map-merge（ABANDONED 禁止）  
- 可记 `last_archived_at` / `last_archive_path`  
- 旧快照保留；续作改的是当前 run 目录，不是擦掉历史快照  

续作决策树：[post-complete-continue.md](post-complete-continue.md)。

## 脚本

```bash
ralph_ops.mjs gate --run-id RALPH-x --gate accept --status FAIL
ralph_ops.mjs rollback-phase --run-id RALPH-x --to DELIVER --reason "…"
ralph_ops.mjs resume --run-id RALPH-x --reason "…"
ralph_ops.mjs abandon --run-id RALPH-x --reason "…"
ralph_ops.mjs set-status --run-id RALPH-x --status PAUSED --reason "…"
```
