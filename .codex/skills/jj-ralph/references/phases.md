# 阶段与检查点

聊天正文不能推进检查点。事实来源：`run.json`、阶段产物、Git 证据。

| 阶段 | phase | 必须产物 | gates.* PASS 条件 |
| --- | --- | --- | --- |
| 需求分析 | `ANALYZE` | `analyze.md`、REQ 账本 | MUST/验收可追溯；无阻塞 UNRESOLVED 或已 `BLOCKED` |
| 计划实施 | `PLAN` | `plan.md`、任务表 | 每 TASK → REQ；范围与不做范围明确 |
| 实施验证 | `DELIVER` | 代码、`progress.md` 迭代、聚焦验证 | 任务完成且验证非 FAIL；可循环返工 |
| 验收完成 | `ACCEPT` | `acceptance.md` | 清单项 `PASS` 或 `N/A`+理由；缺证据不得 PASS；**product-consistency**：deliver 已 PASS；最新 review 不得为 `NEEDS_CHANGES`/`BLOCKED`；路径集合一致 |
| 归档 | `ARCHIVE` | `archive-manifest.json`、archive 快照、地图合并 | 快照 + 合并 `business-map.json`；product-consistency + 若有 PASS review 则必须 commit scope/fix SHA；**可再归档** |

## status

| status | 含义 |
| --- | --- |
| `IN_PROGRESS` / `READY_FOR_USER_TEST` / `BLOCKED` / `PAUSED` | 活跃或停表 |
| `COMPLETED` | 最近一次归档后；**可** `resume` 同 run 再改 |
| `ABANDONED` | 废弃；禁 map/archive；可 `resume` 救回 |

同需求始终优先同一 `run_id`。新 run 仅真新需求。

## 自治循环

```text
读 run.json + progress.md + business-map.json + Git
  → 做当前 phase 下一任务
  → 追加 progress + 更新 run.json
  → 验证 FAIL 且 iteration < max → 继续 DELIVER
  → 需人决策 → BLOCKED / READY_FOR_USER_TEST 停表
  → accept PASS → finalize（map-merge + 归档快照）→ COMPLETED（可 resume）
  → 一半不做 → abandon → ABANDONED（可 resume）
```

`max_iterations` 默认 20，触顶写 `intervention_needed.kind=MAX_ITERATIONS`。

## 强度档（intensity）

`init --intensity tiny|standard|strict` 写入 `run.intensity` + 默认 `budget` / `stagnation` / `accept_layers`。缺省与遗留 run = `standard`。

| intensity | max_iterations | PLAN | DELIVER | ACCEPT 判断层 |
| --- | --- | --- | --- | --- |
| `tiny` | 8 | 最短（见 tiny-example） | 单线；`deliver-attempt` 停滞早停 | 默认可 SKIPPED |
| `standard` | 20 | 正常最短计划 | 同上 | 有 review 则尊守；无则 SKIPPED |
| `strict` | 12 | 建议 2～3 路线写入 `plan_options` | 更紧预算 | **必须** `accept_layers.judgment=PASS`（review/recheck） |

机械步骤：

```bash
ralph_ops.mjs deliver-attempt --run-id … [--improved true|false|auto] [--signal "verify:…"]
# omit --improved / auto：对比工作区 diff 指纹 + signal，防谎报 improved
ralph_ops.mjs accept-layer --run-id … --layer judgment --status PASS --mode review|recheck
ralph_ops.mjs gate --run-id … --gate accept --status PASS
```

- **层1 mechanical**：现有 product-consistency（deliver PASS、路径、review 不得 NEEDS_CHANGES…）
- **层2 judgment**：strict 必过；error 级 `gate_issues` 始终挡 accept（除非 waived/`--force`）
- 连续 `improved=false` 达 `stagnation.patience`（默认 2）→ `BLOCKED` + `intervention_needed.kind=STAGNATION`
- 触顶 `max_iterations` / `budget.max_deliver_loops` → `MAX_ITERATIONS`
- `review-record` outcome=PASS/NEEDS_CHANGES → 自动写 `accept_layers.judgment`（strict 可直接 gate accept）
- `map-merge` / finalize 自动把 STAGNATION、strict 等写入 capability `lessons`（弱信息素，供 map-find）
- **ABANDONED** 禁止 `map-merge` / `archive`（先 `resume`）

## 精简执行

- 单点/单文件：ANALYZE/PLAN 只写最短 MUST、文件列表、验收；跟随 [tiny-example.md](tiny-example.md)；优先 `intensity=tiny`。
- 已定位文件后直接 DELIVER；不要为完整而重复检索。
- 同一工具/策略失败 2 次必须换法；每次 verify 后记 `deliver-attempt`。
- 全部步骤由当前会话直接读写约定路径完成（不绑定特定宿主）。
- 未要求 commit/push 时给 commit-prep 建议或完成报告即可。
- `$jj-end` **只做 Git**，与 run status 正交，可多次。

## 用户介入（仅此）

1. 影响 MUST/验收/范围且无法安全推断
2. 不可逆操作（push、merge、release、删数据）— 只准备，不执行
3. 缺密钥/权限
4. 需人工 UAT 且静态证据不足
5. 脏工作区会覆盖用户改动

阶段 PASS 后默认自动进入下一阶段，不询问「是否继续」。

## 收口

- accept PASS 后优先 `finalize` = map-merge + 归档快照（可再归档）。
- 分步：`map-merge` 再 `archive`；勿只 archive 漏地图。
- 再改：`resume` 同 run → 再验 → 可再 `finalize`。
- 一半不做：`abandon`；可再 `resume`。`close` 已弃用。
- 真新需求才 `init` 新 RALPH。

## 回退

见 [rollback.md](rollback.md)。相邻 phase；ARCHIVE→ACCEPT 合法；`resume` / `abandon` 写 progress；gate FAIL 须有日志。

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

续作决策树（归档后 / 废弃后 / 子需求）：[post-complete-continue.md](post-complete-continue.md)。
