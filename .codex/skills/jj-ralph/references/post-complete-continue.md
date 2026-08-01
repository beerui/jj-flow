# 续作（agent）

用户向：`docs/commands/jj-ralph.md` §「做完了还要改」。  
回退边：`rollback.md`。

## 原则

- **同一需求 → 同一 `run_id`**（含已归档、`COMPLETED`、`ABANDONED` 救回）。  
- **归档** = map-merge + 快照；可再改、再归档。  
- **新 run** 仅用户明确新需求 / 新 id。  
- 聊天不推进检查点。

## 探测

1. 解析目标 run：用户点名 → 该 id；否则最近相关 run（含 COMPLETED / ABANDONED）。  
2. 同需求 → **不要 init**：  
   - `ABANDONED` → `resume`  
   - 已归档 / `COMPLETED` / `phase=ARCHIVE` → `resume` 或 `rollback-phase`（如 →DELIVER）  
   - 活跃 → 直接改；若 accept 已 PASS：先 `gate accept FAIL` 或 rollback  
3. 真新需求 → `init`；可选 progress 写 `parent_run_id` / `supersedes_run_id`（**勿** invent 进 run.json）

## 改错

| 阶段 | 动作 |
| --- | --- |
| DELIVER 中 | 改代码 + progress + 再验 |
| accept 误 PASS | `gate accept FAIL` 或 `rollback-phase --to DELIVER` |
| 计划/分析错 | **相邻边**逐步回退（禁止跳级） |
| 已归档 | `resume` → 同上 → 可再 `finalize` |

## 加需求

同 run：analyze 加 REQ、plan 加 TASK、扩 `scope.in`；一次再验收覆盖全部。  
accept 已过或已归档：先回到 DELIVER，再改再验。

## 废弃

```bash
ralph_ops.mjs abandon --run-id RALPH-x --reason "…"
# 救回
ralph_ops.mjs resume --run-id RALPH-x --reason "…"
```

ABANDONED 上禁止 `map-merge` / `archive`（须先 resume）。  
`close` deprecated。

## 负例

| 错 | 对 |
| --- | --- |
| 归档后默认新 init | 同 run resume |
| ACCEPT 一次 rollback 到 ANALYZE | 相邻边逐步退 |
| 链字段写进 run.json | 真新 run 时写 progress.md |
| ABANDONED 直接 finalize | 先 resume |
| 把 `$jj-end` 当任务结束 | end 只 Git |

## 命令

```bash
ralph_ops.mjs resume --run-id RALPH-x --reason "…"
ralph_ops.mjs abandon --run-id RALPH-x --reason "…"
ralph_ops.mjs rollback-phase --run-id RALPH-x --to DELIVER --reason "…"
ralph_ops.mjs finalize --run-id RALPH-x
```
