---
name: jj-ralph
description: "单仓需求闭环 ANALYZE→PLAN→DELIVER→ACCEPT→ARCHIVE；产物 .workflow/ralph/RALPH-*/ + business-map；handoff 在 run.handoff。同需求始终优先同一 run_id（归档后 resume、半途 abandon 可救回）。跨仓用 jj-same；调度用 jj-dispatch。机械步骤 ralph_ops.mjs。"
---

# jj-ralph

单仓：需求 → 验收 → 归档。状态只写 `.workflow/ralph/` 与 Git。

**续作：** 同一需求用同一 `run_id`。归档 = 快照 + map，不是作废；再改用 `resume`。半途不做 → `abandon`（可再 resume）。新 run **仅**真新需求。`$jj-end` 只 Git。

## 立即动作

1. **定位 run：** 有同需求 run（任意状态）→ `resume` / 继续，**禁止默认 init**。无 run 才 `init`（并选 intensity，见下）。  
   命名与 map：`jj doctor` / `JJ_GLOBAL_CONFIG_DIR` 或 `DAJI_CONFIG_DIR` → `naming.json` + project map；缺失 hard-stop，**禁止**编造本机路径。
2. **intensity**（用户口语优先）：单点/`tiny` → `tiny`；鉴权·协议/`strict`/要审查再归档 → `strict`；否则 `standard`。
3. `map-find`；单点先读 [tiny-example.md](references/tiny-example.md)。
4. 阶段 [phases.md](references/phases.md)：ANALYZE → PLAN → DELIVER → ACCEPT → ARCHIVE。优先 `gate`。  
   - DELIVER 每次 verify 后：`deliver-attempt`  
   - **strict** accept 前：`accept-layer --layer judgment --status PASS --mode review|recheck`
5. accept PASS 后默认 `finalize`（map-merge + 归档快照；之后仍可同 run 再改、再归档）。
6. 完成报告（中文、短）。

## 交接

真相源：`run.handoff`（非第二套流程）。

- 多端 / 已有 handoff / 用户要迁移：accept/finalize 可自动维护  
- 手动：`ralph_ops.mjs handoff --run-id … --targets 兑接识票,承载识票`  
- 字段：`ready` / `blocked_reasons` / `source_head` / `must` / `do_not_port` / `targets` / `mode`  
- 未提交：`ready=false`；用户只说「交接到 兑接 承载」→ `$jj-same`

## 脚本

```bash
node <resolved>/ralph_ops.mjs init --run-id RALPH-x --title "..." --goal "..." [--intensity tiny|standard|strict]
node <resolved>/ralph_ops.mjs deliver-attempt --run-id RALPH-x --improved true|false
node <resolved>/ralph_ops.mjs accept-layer --run-id RALPH-x --layer judgment --status PASS --mode review
node <resolved>/ralph_ops.mjs gate --run-id RALPH-x --gate accept --status PASS
node <resolved>/ralph_ops.mjs finalize --run-id RALPH-x --modules src/a.js --keywords a,b
node <resolved>/ralph_ops.mjs resume --run-id RALPH-x --reason "…"
node <resolved>/ralph_ops.mjs abandon --run-id RALPH-x --reason "…"
node <resolved>/ralph_ops.mjs rollback-phase --run-id RALPH-x --to DELIVER --reason "…"
node <resolved>/ralph_ops.mjs set-status --run-id RALPH-x --status PAUSED --reason "…"
node <resolved>/ralph_ops.mjs handoff --run-id RALPH-x --targets 兑接识票,承载识票
node <resolved>/ralph_ops.mjs commit-prep --run-id RALPH-x
```

解析：repo skill scripts → `$CODEX_HOME/skills/jj-ralph/scripts/` → `jj ralph`。  
细则：[phases.md](references/phases.md)、[rollback.md](references/rollback.md)、[post-complete-continue.md](references/post-complete-continue.md)。

## 回退与续作（摘要）

| 意图 | 动作 |
| --- | --- |
| 改 gate | `gate --status FAIL` |
| phase 回退 | 相邻边 `rollback-phase`（含 ARCHIVE→ACCEPT） |
| 暂停 / 阻塞 | `set-status PAUSED\|BLOCKED` |
| 归档后再做 | 同 run `resume` → 改 → 再验 → 可再 `finalize` |
| 一半不做 | `abandon`（禁 map；可 `resume`） |
| 真新需求 | 才 `init` 新 run |
| Git 收工 | `$jj-end` |

`close` 已弃用 → `abandon` 或 `finalize`。默认不 git revert。

## 硬约束

- 不做无关重构；单点 analyze/plan 宜短  
- 同操作最多失败 2 次；STAGNATION 时换策略或问用户  
- 未要求 commit/push/review/handoff/dispatch 不做  
- 控制项目不跑业务 ralph；`DEL-*` ≠ `RALPH-*`  
- 不得因「已归档 / COMPLETED」强制新 run  

## 完成报告

- `run_id` / phase / status / intensity  
- 验收结论；若刚归档，注明仍可同 run 续作  
- 交接：`ready` +「交接到 …」  
- 阻塞原因（含 STAGNATION / MAX_ITERATIONS）

## 示例

```text
$jj-ralph 先改承接：登录后密码过期提示
$jj-ralph tiny：兑接 tip 4px→6px
$jj-ralph 继续 RALPH-login-reminder-20260722：改文案
$jj-ralph 不做了 RALPH-xxx：需求取消
$jj-ralph 交接到 兑接 承载
```

见 [integrations.md](references/integrations.md)、[artifact-layout.md](references/artifact-layout.md)；用户向 [docs/commands/jj-ralph.md](../../../docs/commands/jj-ralph.md)。
