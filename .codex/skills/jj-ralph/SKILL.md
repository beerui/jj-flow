---
name: jj-ralph
description: "在当前单一业务仓库完成需求到验收归档的 Ralph 闭环（ANALYZE→PLAN→DELIVER→ACCEPT→ARCHIVE）；产物写入 .workflow/ralph/RALPH-*/，维护 business-map.json；交接状态集成在 run.handoff（精简）。跨仓入口用 jj-same（用户只说「交接到…」）；调度用 jj-dispatch。机械步骤用 skill 内 ralph_ops.mjs。"
---

# jj-ralph

单仓需求 → 验收归档。状态只写 `.workflow/ralph/` 与 Git。

## 立即动作

1. 无 run 时 `ralph_ops.mjs init`。命名读 `D:/a/config/naming.json`；定位读 `D:/a/map.md`。
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
```

解析：repo skill scripts → `$CODEX_HOME/skills/jj-ralph/scripts/ralph_ops.mjs` → `jj ralph`。

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
