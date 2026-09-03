# Ralph 工作区布局（方案 A）

> 状态：Implemented
>
> 验收证据：`tests/jj-ralph-contract.test.mjs`（扁平 live / `completed/` / `events.jsonl` / `migrate --prune-archive`）、`npm run ralph:check`
>
> 关联：[Ralph 任务工作区 `.plans` 化改造](ralph-plans-workspace.html)（Implemented，P0–P2+）· 规划草案曾推荐方案 B（保留 `tasks/`）；**拍板采用方案 A**。

## 结论

| 决策 | 口径 |
| --- | --- |
| 活跃任务位置 | **方案 A**：`.workflow/ralph/<task_key>/` 扁平，不再套 `tasks/` |
| COMPLETED / ABANDONED | 一律 `rename` 进 `completed/<task_key>/`；`resume` 再抬回根 |
| 机器事件 | `.state/events.jsonl`（JSONL，append-only）；`progress.md` 人读轮次追加 |
| finding | **沿用软提示**（`FINDING_HINT`），不硬失败 |
| 1.0 `archive/` | 默认只读；`jj ralph migrate --prune-archive` dry-run，加 `--yes` 删除 |
| `.migrated-RALPH-*` | 收容进 `migrated/` |
| schema | **不升**（仍 1.2）；不动 dispatch |

## 目录

```text
.workflow/ralph/
  index.md
  business-map.json
  task-foo/                 # active
    task_plan.md
    progress.md             # ## 轮次 N · …（只追加）
    findings.md
    .state/
      run.json
      events.jsonl          # gate / deliver-attempt / review / …
      reviews/
      handoff.json
  completed/task-foo/       # COMPLETED 或 ABANDONED
  migrated/RALPH-…/         # migrate 残骸
  archive/…                 # 1.0 快照（可选 prune）
  tasks/                    # 仅 migrate lift 遗留；空则可删
```

## 命令

- `jj ralph migrate [--prune-archive] [--yes]`：lift `tasks/` → 根、shelter `.migrated-*` → `migrated/`、可选 prune `archive/`
- archive / abandon → `completed/`；resume → 根并开新 progress 轮次
