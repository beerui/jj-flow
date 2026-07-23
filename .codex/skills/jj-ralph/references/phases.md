# 阶段与检查点

聊天正文不能推进检查点。事实来源：`run.json`、阶段产物、Git 证据。

| 阶段 | phase | 必须产物 | gates.* PASS 条件 |
| --- | --- | --- | --- |
| 需求分析 | `ANALYZE` | `analyze.md`、REQ 账本 | MUST/验收可追溯；无阻塞 UNRESOLVED 或已 `BLOCKED` |
| 计划实施 | `PLAN` | `plan.md`、任务表 | 每 TASK → REQ；范围与不做范围明确 |
| 实施验证 | `DELIVER` | 代码、`progress.md` 迭代、聚焦验证 | 任务完成且验证非 FAIL；可循环返工 |
| 验收完成 | `ACCEPT` | `acceptance.md` | 清单项 `PASS` 或 `N/A`+理由；缺证据不得 PASS |
| 归档 | `ARCHIVE` | `archive-manifest.json`、archive 目录、地图合并 | CLI `jj ralph archive` + `map-merge` 成功 |

终态：`COMPLETED` | `BLOCKED` | `PAUSED` | `READY_FOR_USER_TEST`。

## 自治循环

```text
读 run.json + progress.md + business-map.json + Git
  → 做当前 phase 下一任务
  → 追加 progress + 更新 run.json
  → 验证 FAIL 且 iteration < max → 继续 DELIVER
  → 需人决策 → BLOCKED / READY_FOR_USER_TEST 停表
  → accept PASS → archive + map-merge → COMPLETED
```

`max_iterations` 默认 20，触顶写 `intervention_needed.kind=MAX_ITERATIONS`。

## 用户介入（仅此）

1. 影响 MUST/验收/范围且无法安全推断
2. 不可逆操作（push、merge、release、删数据）— 只准备，不执行
3. 缺密钥/权限
4. 需人工 UAT 且静态证据不足
5. 脏工作区会覆盖用户改动

阶段 PASS 后**默认自动进入下一阶段**，不询问「是否继续」。

## 执行方式

分析、计划、实施、验收均由本协议 + 仓库工具（Read/Grep/Git/测试）完成。需要通用审查时用 `$jj-review`（`jj ralph review-record` 落盘），非强制。
