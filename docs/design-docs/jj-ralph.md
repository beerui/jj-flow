# jj-ralph 单仓全流程自治闭环

> 状态：Implemented
>
> 验收证据：`tests/jj-ralph-contract.test.mjs`、`npm run ralph:check`、`npm run verify`
>
> 边界：skill + `ralph_ops` / CLI；无 dispatch CAS；不自动 commit/push/merge

## 1. 目标

当前**单一业务仓库**内可追溯闭环：

```text
ANALYZE → PLAN → DELIVER → ACCEPT → ARCHIVE
```

- 状态在 `.workflow/ralph/`（run ledger）  
- `business-map.json` 供下次发现  
- 事实源：`run.json` / Git / 验证产物，不是聊天  

## 2. 非目标

| 非目标 | 入口 |
| --- | --- |
| 多仓迁移 | `jj-same` |
| 多目标调度 | `jj-dispatch` |
| 宿主 review 落盘 | `jj-review` |
| Git 收工 | `jj-end` |

## 3. 阶段

权威：`.codex/skills/jj-ralph/references/phases.md`。

| 阶段 | 含义 |
| --- | --- |
| ANALYZE / PLAN | 需求与最小计划 |
| DELIVER | 实施；`deliver-attempt` 停滞/预算 |
| ACCEPT | 验收；strict 需 judgment 层 |
| ARCHIVE | `finalize` = map-merge + 归档快照（可再归档） |

**status：** `IN_PROGRESS` 等活跃态；`COMPLETED` = 最近一次归档后的展示态（可 resume）；`ABANDONED` = 废弃（禁 map，可 resume）。

**intensity：** `tiny` | `standard` | `strict`（init 时写入）。

## 4. 续作与回退

权威：`rollback.md`、`post-complete-continue.md`、`src/ralph.mjs`。

| 意图 | 动作 |
| --- | --- |
| phase 回退 | 相邻边（含 ARCHIVE→ACCEPT） |
| 归档后再做 | 同 run `resume` |
| 一半不做 | `abandon` |
| 真新需求 | 才新 run |
| Git | `$jj-end`（与 run 是否还能改无关） |

用户向：[ralph 命令](../command-jj-ralph.html#做完了还要改)。

## 5. 产物

```text
.workflow/ralph/
  business-map.json
  RALPH-{slug}-{date}/     # 权威目录（归档后仍在此续作）
  archive/…                # 历史快照
```

## 6. 衔接

| | |
| --- | --- |
| handoff | `run.handoff`；same 读后迁仓 |
| dispatch | `dispatch-snapshot` 仅推荐，不替代 control-plane |

## 7. 实现

| 层 | 路径 |
| --- | --- |
| 库 | `src/ralph.mjs` |
| 可移植 | skill `scripts/lib/ralph.mjs`（`ralph:sync`） |
| CLI | `jj ralph …`（含 resume / abandon；close deprecated） |

## 8. 硬约束

- 短分析/计划；失败有限次换策略  
- 聊天不推进 checkpoint  
- 同需求不因「已归档」强制新 run  
