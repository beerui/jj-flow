# 阶段与检查点

聊天正文不能推进检查点。事实来源：`run.json`、阶段产物、Git 证据。

| 阶段 | phase | 必须产物 | gates.* PASS 条件 |
| --- | --- | --- | --- |
| 需求分析 | `ANALYZE` | `analyze.md`、REQ 账本 | MUST/验收可追溯；无阻塞 UNRESOLVED 或已 `BLOCKED` |
| 计划实施 | `PLAN` | `plan.md`、任务表 | 每 TASK → REQ；范围与不做范围明确 |
| 实施验证 | `DELIVER` | 代码、`progress.md` 迭代、聚焦验证 | 任务完成且验证非 FAIL；可循环返工 |
| 验收完成 | `ACCEPT` | `acceptance.md` | 清单项 `PASS` 或 `N/A`+理由；缺证据不得 PASS；**product-consistency**：deliver 已 PASS；最新 review 不得为 `NEEDS_CHANGES`/`BLOCKED`；路径集合一致 |
| 归档 | `ARCHIVE` | `archive-manifest.json`、archive 目录、地图合并 | 写好 archive 冻结副本 + 合并 `business-map.json`；product-consistency + 若有 PASS review 则必须 commit scope/fix SHA |

终态：`COMPLETED` | `BLOCKED` | `PAUSED` | `READY_FOR_USER_TEST`。

## 自治循环

```text
读 run.json + progress.md + business-map.json + Git
  → 做当前 phase 下一任务
  → 追加 progress + 更新 run.json
  → 验证 FAIL 且 iteration < max → 继续 DELIVER
  → 需人决策 → BLOCKED / READY_FOR_USER_TEST 停表
  → accept PASS → finalize（map-merge + archive）→ COMPLETED
```

`max_iterations` 默认 20，触顶写 `intervention_needed.kind=MAX_ITERATIONS`。

## 精简执行

- 单点/单文件：ANALYZE/PLAN 只写最短 MUST、文件列表、验收；跟随 [tiny-example.md](tiny-example.md)。
- 已定位文件后直接 DELIVER；不要为完整而重复检索。
- 同一工具/策略失败 2 次必须换法。
- 全部步骤由当前会话直接读写约定路径完成（不绑定特定宿主）。
- 未要求 commit/push 时给 commit-prep 建议或完成报告即可。

## 用户介入（仅此）

1. 影响 MUST/验收/范围且无法安全推断
2. 不可逆操作（push、merge、release、删数据）— 只准备，不执行
3. 缺密钥/权限
4. 需人工 UAT 且静态证据不足
5. 脏工作区会覆盖用户改动

阶段 PASS 后默认自动进入下一阶段，不询问「是否继续」。

## 收口

- accept PASS 后优先 `ralph_ops.mjs finalize`（或 `jj ralph finalize`）= map-merge + archive。
- 分步亦可：`map-merge` 再 `archive`；勿只 archive 导致地图漏写。

## 回退（phase / status）

完整矩阵见 [rollback.md](rollback.md)。摘要：

- 相邻 phase 回退：`rollback-phase --to PLAN|DELIVER|ANALYZE`（自当前 phase）；ARCHIVE 与 COMPLETED 不可回旧目录
- 暂停/阻塞：`set-status --status PAUSED|BLOCKED`
- gate 可 FAIL 覆盖先前 PASS，须写 progress / `updated_at`，禁止无日志改 gates

## gate

- 优先 `ralph_ops.mjs gate --run-id … --gate analyze|plan|deliver|accept|archive --status PASS`。
- PASS 默认推进 phase；`--no-advance` 只改 gate。
- `accept`/`archive` PASS 会跑 product-consistency：
  - `gates.deliver` 必须已是 `PASS` 或 `N/A`（禁止代码已落地、ledger 仍停在 PLAN）
  - progress/diff 显示 DELIVER 证据但 `deliver` 未 PASS → 拒绝（deliver-outside-ledger）
  - 最新 review = `NEEDS_CHANGES` 或 `BLOCKED` → 拒绝 PASS
  - plan/acceptance/`scope.in` 中的实现路径 vs 当前 diff（或显式 `diff_paths`）不一致 → 拒绝 PASS
  - **ARCHIVE** 若存在最新 `PASS` review：必须 `review_scope=commit` 且有 `fix_commit`/`reviewed_commit`；`working_tree` PASS 只算临时证据，不能归档为已落地
  - 策略中途变更时，必须先改写 plan/acceptance 再验收；不要只改代码
  - 运维覆盖可用 `force: true`（库 API / finalize force），默认对话路径不要用
- host 元数据（可选，不推进检查点）：`run.host.host_id` / `thread_id` / `model_id` / `export_path`；`jj ralph host-record` 或 init 时写入，供评估与会话回溯
- review 记录可选：`--review-scope working_tree|commit`、`--fix-commit <sha>`
