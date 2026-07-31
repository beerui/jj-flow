---
name: jj-ralph
description: "在当前单一业务仓库完成需求到验收归档的 Ralph 闭环（ANALYZE→PLAN→DELIVER→ACCEPT→ARCHIVE）；产物写入 .workflow/ralph/RALPH-*/，维护 business-map.json；交接状态集成在 run.handoff（精简）。跨仓入口用 jj-same（用户只说「交接到…」）；调度用 jj-dispatch。机械步骤用 skill 内 ralph_ops.mjs。"
---

# jj-ralph

单仓需求 → 验收归档。状态只写 `.workflow/ralph/` 与 Git。

## 立即动作

1. 无 run 时 `ralph_ops.mjs init`。解析命名与项目 map（**禁止写死本机路径**，如 `D:/a/...`）：
   | 档 | 来源 | 用途 |
   | --- | --- | --- |
   | ① | `jj doctor` / env `JJ_GLOBAL_CONFIG_DIR` 或 `DAJI_CONFIG_DIR` → `naming.json` | 命名规则 |
   | ② | 配置内已解析的 project map 路径（如 map.md / portfolio map） | 定位模块 |
   | ③ | 以上缺失 | **hard-stop**：报告缺失路径与如何配置；**禁止**编造 portfolio 根 |
2. `map-find`；单点改动先读 [tiny-example.md](references/tiny-example.md)。
3. 按 [phases.md](references/phases.md)：ANALYZE → PLAN → DELIVER → ACCEPT → ARCHIVE。优先 `gate`。
4. accept PASS 后默认 `finalize`。
5. 完成报告（中文、短）。

## 交接（集成在 run 里）

**真相源是 `run.handoff`**，不是第二套流程。

- 多端范围 / 已有 handoff / 用户要迁移：accept/finalize **自动**维护
- 也可手动：`ralph_ops.mjs handoff --run-id … --targets 兑接识票,承载识票`
- 字段精简：`ready` / `blocked_reasons` / `source_head` / `must` / `do_not_port` / `targets` / `mode`
- 可选镜像文件：`.workflow/ralph/<run_id>/handoff/handoff.json`（same 可读）
- **用户不填路径**。报告只提示：`交接到 兑接 承载`
- 未提交：`ready=false`；提交后再交接
- 跨仓实施走 `$jj-same`（读当前会话 run.handoff）

## 脚本

```bash
node <resolved>/ralph_ops.mjs init --run-id RALPH-x-20260723 --title "..." --goal "..."
node <resolved>/ralph_ops.mjs gate --run-id RALPH-x-20260723 --gate accept --status PASS
node <resolved>/ralph_ops.mjs finalize --run-id RALPH-x-20260723 --modules src/a.js --keywords a,b
node <resolved>/ralph_ops.mjs handoff --run-id RALPH-x-20260723 --targets 兑接识票,承载识票
node <resolved>/ralph_ops.mjs commit-prep --run-id RALPH-x-20260723
node <resolved>/ralph_ops.mjs rollback-phase --run-id RALPH-x-20260723 --to DELIVER --reason "验收证据不足"
node <resolved>/ralph_ops.mjs set-status --run-id RALPH-x-20260723 --status PAUSED --reason "等 UAT"
```

解析：repo skill scripts → `$CODEX_HOME/skills/jj-ralph/scripts/ralph_ops.mjs` → `jj ralph`。

阶段细则与回退边见 [phases.md](references/phases.md)、[rollback.md](references/rollback.md)。

## 回退（rollback）

用户说「撤销验收 / 退回 DELIVER / 暂停 / 阻塞」时读 [rollback.md](references/rollback.md)。

| 意图 | 动作 |
| --- | --- |
| 改 gate | `ralph_ops gate --status FAIL`（或 PASS） |
| phase 回退 | 仅相邻边：`rollback-phase --to DELIVER`（ACCEPT→DELIVER 等）；**ARCHIVE 不可回** |
| 暂停 / 阻塞 | `set-status --status PAUSED\|BLOCKED` |
| COMPLETED 再做 | **新 run** + 链 `supersedes`；不 un-archive 覆盖 |

续作「改错 / 加子需求」（关账前同 run / 关账后链）见 [post-complete-continue.md](references/post-complete-continue.md)（用户向：`docs/commands/jj-ralph.md` §1）。

默认不自动 git revert。实现：`src/ralph.mjs` 的 `rollbackPhase` / `setRunStatus` / `setGate`。

## 硬约束

- 不做无关重构；单点 analyze/plan 约 ≤15 行
- 同操作最多失败 2 次
- 未要求 commit/push/review/handoff/dispatch 不做

## 完成报告

- run_id / phase / status
- 验收结论
- 若有交接：`ready` + 下一步人话（`交接到 …`）
- 阻塞原因

## 调用示例

```text
$jj-ralph 开始 先改承接
$jj-ralph 继续 RALPH-login-reminder-20260722
```

见 [integrations.md](references/integrations.md)、[artifact-layout.md](references/artifact-layout.md)。
