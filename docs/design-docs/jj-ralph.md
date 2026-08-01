# jj-ralph 单仓全流程自治闭环

> 状态：Implemented
>
> 验收证据：`tests/jj-ralph-contract.test.mjs`、`tests/install-skill.test.mjs`、`tests/portfolio-knowledge.test.mjs`、`npm run verify`、`npm run ralph:check`
>
> 实施边界：协议资产（skill）+ 轻量 CLI / `ralph_ops.mjs` 机械步骤；**无** dispatch 式 CAS 状态机；**不**自动 commit/push/merge/release

## 1. 目标

在当前**单一业务仓库**内完成可追溯闭环：

```text
ANALYZE → PLAN → DELIVER → ACCEPT → ARCHIVE
```

约束：

- 全步骤写入 `.workflow/ralph/`（run ledger），可恢复、可检索
- 能力地图 `business-map.json` 供下次会话发现历史经验
- 默认自治；仅范围、权限、验收歧义时请用户介入
- 事实源是 `run.json` / Git / 验证产物，不是聊天「做完了」

## 2. 非目标

| 非目标 | 正确入口 |
| --- | --- |
| 多仓迁移实现 | `jj-same`（读 `run.handoff` 或 handoff 镜像） |
| 控制面 tick / CAS / 多目标派发 | `jj-dispatch` |
| 宿主 review 映射落盘 | `jj-review` → `reviews/REV-*.json` |
| 自动 push / merge / release | 人工或 `jj-end` 等收工流程（仍需用户/宿主执行） |
| 后台 daemon | 不实现 |

## 3. 阶段与门禁

权威阶段细则：`.codex/skills/jj-ralph/references/phases.md`。

| 阶段 | 含义 | 典型门禁 |
| --- | --- | --- |
| ANALYZE | 需求、范围、证据与不做清单 | 范围确认 |
| PLAN | 最小计划与验收标准 | plan 可执行 |
| DELIVER | 实施与验证循环 | 验证证据；`deliver-attempt` 停滞/预算早停 |
| ACCEPT | 验收结论（双层：mechanical + 可选 judgment） | `gate accept` PASS/FAIL；strict 需 judgment PASS |
| ARCHIVE | map-merge + soft archive 快照（可再归档） | `finalize` |

### 生命周期 status（无终态冻结）

| status | 含义 |
| --- | --- |
| `IN_PROGRESS` / `READY_FOR_USER_TEST` / `BLOCKED` / `PAUSED` | 活跃或停表 |
| `COMPLETED` | 最近一次 soft archive 后的**兼容展示态**；**可** resume 同 `run_id` |
| `ABANDONED` | 半做成弃；**禁** map-merge；可 resume 救回 |

归档是**事件**（快照 + map 提升 + `last_archived_at`），不是墓碑。`close` deprecated。`$jj-end` 只做 Git。

### 强度档 intensity（速度 × 质量）

`init --intensity tiny|standard|strict`（默认 standard）。写入 `run.intensity` / `budget` / `stagnation` / `accept_layers`；遗留 run 缺字段按 standard。

- **tiny**：短 `max_iterations`、跳过判断层（除非已有 review 否定结论）
- **standard**：现网默认；accept 判断层可 SKIPPED
- **strict**：更紧预算；accept 前 `accept_layers.judgment` 必须 PASS（review/recheck）

不引入 ACO / 多 worker 主循环；对抗只作为 judgment_mode 可选备注，事实源仍是 ledger + verify。

- accept PASS 后默认 `finalize`（map-merge + soft archive；可 re-archive）
- `map-merge` 默认要求 accept=PASS（`--force` 可覆盖）；**ABANDONED 禁止** map-merge
- ARCHIVE / COMPLETED 后要再做 → **同 run** `resume` / `rollback-phase`（含 ARCHIVE→ACCEPT）；仅真新需求才 `init` 新 run

## 4. 回退（ledger）

权威：`.codex/skills/jj-ralph/references/rollback.md`、`src/ralph.mjs`。

| 意图 | 动作 |
| --- | --- |
| 改 gate | `ralph_ops gate --status FAIL`（或 PASS） |
| phase 回退 | 仅相邻边：`rollback-phase --to DELIVER` 等；**ARCHIVE→ACCEPT** 合法 |
| 暂停 / 阻塞 | `set-status --status PAUSED\|BLOCKED` |
| 归档后 / COMPLETED 再做 | **同 run** `resume`（可 re-archive）；不默认新 run |
| 一半不做 | `abandon` → `ABANDONED`；可再 `resume` |
| 真新需求 | 才新 run；可选 `progress.md` 链 |

续作（**改错** / **加子需求** / **归档后** / **废弃救回**：始终优先同 `run_id`）与话术：用户向 [ralph 命令 · 做完了还要改](../command-jj-ralph.html#做完了还要改-还要加东西)；agent 向 `.codex/skills/jj-ralph/references/post-complete-continue.md`。

默认**不**自动 git revert。

## 5. 产物布局

```text
.workflow/ralph/
  business-map.json
  RALPH-{slug}-{date}/          # 权威 run 目录（归档后仍在此续作）
    run.json                    # 真相：phase / gates / handoff / knowledge_refs / last_archived_*
    handoff/handoff.json        # 可选镜像（same 可读）
    reviews/REV-*.json          # jj-review 映射
  archive/YYYY-MM-DD-{slug}/    # soft archive 历史快照（re-archive 可带时间戳）
.workflow/handoffs/<HOF-ID>/    # handoff 导出（跨仓）
.workflow/dispatch/recommendations/<SNAP-ID>/
```

archive 目录默认去重 run_id 末尾日期（例 `2026-07-23-smoke`，而非 `…-smoke-20260723`）。

## 6. 交接与调度衔接

| 关系 | 约定 |
| --- | --- |
| handoff 真相 | **`run.handoff`**（精简字段：`ready` / `blocked_reasons` / `source_head` / `must` / `do_not_port` / `targets` / `mode`） |
| same | 用户自然语言「交接到…」；same 读当前会话 run/handoff；跨仓实现不在 `.workflow/ralph/` 内完成 |
| dispatch | `jj ralph dispatch-snapshot` 写出推荐快照；不替代 control-plane |
| knowledge | `ralph init` 默认挂载 `knowledge_refs`（可 `--no-knowledge-refs`） |

未提交时 `ready=false`；提交后再交接。用户不必填 handoff 路径。

## 7. 机械步骤

| 层 | 路径 |
| --- | --- |
| 权威实现 | `src/ralph.mjs` |
| Skill 可移植副本 | `.codex/skills/jj-ralph/scripts/lib/ralph.mjs`（`npm run ralph:sync`） |
| Agent 入口 | `.codex/skills/jj-ralph/scripts/ralph_ops.mjs`（优先 live src，否则 bundled；业务仓无需装 npm 包） |
| CLI | `jj ralph init\|status\|archive\|finalize\|map-merge\|gate\|deliver-attempt\|accept-layer\|map-find\|handoff\|dispatch-snapshot\|commit-prep\|review-record\|rollback-phase\|set-status\|resume\|abandon`（`close` deprecated） |

解析顺序：repo skill scripts → `$CODEX_HOME/skills/jj-ralph/scripts/` → `jj ralph`。

## 8. 硬约束

- 不做无关重构；单点 analyze/plan 宜短
- 同操作失败有限次后换策略或升级用户
- 未要求 commit/push/review/handoff/dispatch 则不做
- 聊天、thread 状态、memory 不能推进 checkpoint
- **无终态冻结**：不得以 COMPLETED/已归档拒绝同 run 续作；新 run 仅真新需求；`close` 非一等入口

## 9. 验收

- 安装含 `jj-ralph` skill 与 Claude/Grok/Qoder 对应入口
- sample run / map 与 schema 校验通过
- map-merge 后 map-find 可恢复 run 路径与 lessons
- archive / resume / abandon / re-archive / rollback 路径与合约测试一致
- `npm run ralph:check` 与 `tests/jj-ralph-contract.test.mjs` 通过

## 10. 与产品面位置

```text
ralph  单仓闭环 + 能力地图
  │ handoff          │ dispatch-snapshot
  v                  v
same  跨仓迁移      dispatch  多项目调度
  │
  v
review  宿主审查 → REV（可选，挂在 run 下）
```

当前实现事实见根 `ARCHITECTURE.md` 与 [架构](../architecture.html)。使用者入口见 [命令页](../command-jj-ralph.html)。
