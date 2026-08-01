---
name: jj-ralph
description: "在当前单一业务仓库完成需求到验收归档的 Ralph 闭环（ANALYZE→PLAN→DELIVER→ACCEPT→ARCHIVE）；产物写入 .workflow/ralph/RALPH-*/，维护 business-map.json；交接状态集成在 run.handoff（精简）。无终态冻结：归档/COMPLETED 后可同 run resume；ABANDONED 可救回。跨仓入口用 jj-same（用户只说「交接到…」）；调度用 jj-dispatch。机械步骤用 skill 内 ralph_ops.mjs。"
---

# jj-ralph

单仓需求 → 验收归档。状态只写 `.workflow/ralph/` 与 Git。

**无终态冻结：** 归档是沉淀事件（快照 + map），不是墓碑；`COMPLETED` 可 continue 同 `run_id`；一半不做用 `ABANDONED`（可 resume）。新 RALPH 仅真新需求。`$jj-end` 只做 Git。

## 立即动作

1. 无 run 时 `ralph_ops.mjs init`（选强度，见下表）。**已有同需求 run（含 COMPLETED/归档/ABANDONED）→ 优先 resume 同 run，禁止默认新 init。** 解析命名与项目 map（**禁止写死本机路径**，如 `D:/a/...`）：
   | 档 | 来源 | 用途 |
   | --- | --- | --- |
   | ① | `jj doctor` / env `JJ_GLOBAL_CONFIG_DIR` 或 `DAJI_CONFIG_DIR` → `naming.json` | 命名规则 |
   | ② | 配置内已解析的 project map 路径（如 map.md / portfolio map） | 定位模块（承接/兑接/承载等） |
   | ③ | 以上缺失 | **hard-stop**：报告缺失路径与如何配置；**禁止**编造 portfolio 根 |
2. **选 intensity**（写入 `run.intensity`；用户口语优先）：
   | 信号 | intensity |
   | --- | --- |
   | 单点 / tiny / `@file:line` / 像素 | `tiny` |
   | 鉴权·协议 / strict / 明确要审查再归档 / 做完要交接到兑接·承载且怕迁歪 | `strict` |
   | 其它（先改承接完整能力等） | `standard`（默认） |
3. `map-find`；单点改动先读 [tiny-example.md](references/tiny-example.md)。
4. 按 [phases.md](references/phases.md)：ANALYZE → PLAN → DELIVER → ACCEPT → ARCHIVE。优先 `gate`。
   - DELIVER 每次 verify 后：`deliver-attempt --improved true|false [--signal …]`
   - **strict** accept 前：`accept-layer --layer judgment --status PASS --mode review|recheck`
5. accept PASS 后默认 `finalize`（soft archive；可再改、再归档）。
6. 完成报告（中文、短）。

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
node <resolved>/ralph_ops.mjs init --run-id RALPH-x-20260723 --title "..." --goal "..." [--intensity tiny|standard|strict]
node <resolved>/ralph_ops.mjs deliver-attempt --run-id RALPH-x-20260723 --improved true|false [--signal "verify:…"]
node <resolved>/ralph_ops.mjs accept-layer --run-id RALPH-x-20260723 --layer judgment --status PASS --mode review
node <resolved>/ralph_ops.mjs gate --run-id RALPH-x-20260723 --gate accept --status PASS
node <resolved>/ralph_ops.mjs finalize --run-id RALPH-x-20260723 --modules src/a.js --keywords a,b
node <resolved>/ralph_ops.mjs resume --run-id RALPH-x-20260723 --reason "归档后续改"
node <resolved>/ralph_ops.mjs abandon --run-id RALPH-x-20260723 --reason "需求取消"
node <resolved>/ralph_ops.mjs handoff --run-id RALPH-x-20260723 --targets 兑接识票,承载识票
node <resolved>/ralph_ops.mjs commit-prep --run-id RALPH-x-20260723
node <resolved>/ralph_ops.mjs rollback-phase --run-id RALPH-x-20260723 --to DELIVER --reason "验收证据不足"
node <resolved>/ralph_ops.mjs set-status --run-id RALPH-x-20260723 --status PAUSED --reason "等 UAT"
```

强度档（速度×质量）：`tiny` 短预算；`standard` 默认；`strict` 要求 accept 判断层 PASS。细则见 [phases.md](references/phases.md)#强度档intensity。

解析：repo skill scripts → `$CODEX_HOME/skills/jj-ralph/scripts/ralph_ops.mjs` → `jj ralph`。

阶段细则与回退边见 [phases.md](references/phases.md)、[rollback.md](references/rollback.md)。

## 回退与续作

用户说「撤销验收 / 退回 DELIVER / 暂停 / 阻塞 / 继续已归档 / 不做了」时读 [rollback.md](references/rollback.md)、[post-complete-continue.md](references/post-complete-continue.md)。

| 意图 | 动作 |
| --- | --- |
| 改 gate | `ralph_ops gate --status FAIL`（或 PASS） |
| phase 回退 | 仅相邻边：`rollback-phase --to DELIVER`（ACCEPT→DELIVER）；**ARCHIVE→ACCEPT** 合法 |
| 暂停 / 阻塞 | `set-status --status PAUSED\|BLOCKED` |
| 归档后 / COMPLETED 再做 | **同 run** `resume`（或 rollback + 再验）；可 re-archive；**禁止**默认新 run |
| 一半不做 | `abandon` → `ABANDONED`（禁 map；可再 resume） |
| 真新需求 | 才 `init` 新 run；可选 progress 链 |
| `close` | **deprecated** → 用 abandon 或 archive/finalize |
| Git 收工 | `$jj-end`（与 run 生死正交） |

默认不自动 git revert。实现：`src/ralph.mjs` 的 `rollbackPhase` / `setRunStatus` / `resumeRun` / `abandonRun` / `setGate` / `archiveRun`。

## 硬约束

- 不做无关重构；单点 analyze/plan 约 ≤15 行
- 同操作最多失败 2 次；连续 `deliver-attempt improved=false` 达 patience → 尊重 STAGNATION，换策略或升级用户
- 未要求 commit/push/review/handoff/dispatch 不做
- **控制项目** 不跑业务 ralph 实现；多仓派工是 `DEL-*`（dispatch），单仓账本是 `RALPH-*`（勿混 id）
- **无终态冻结**：不得以「已 COMPLETED / 已归档」拒绝同 run 续作；不得把新 run 当作归档后唯一路径

## 完成报告

- run_id / phase / status / **intensity**
- accept_layers（mechanical / judgment）摘要（若有）
- 验收结论；若已 soft-archive：注明可 resume 同 run
- 若有交接：`ready` + 下一步人话（`交接到 兑接 承载`）
- 阻塞原因（含 `STAGNATION` / `MAX_ITERATIONS` 时写明）

## 调用示例

```text
$jj-ralph 先改承接：登录后密码过期要提示，只做登录成功那条路
$jj-ralph tiny：兑接 tip bottom 4px→6px
$jj-ralph strict：承接鉴权刷新失败重登，审查后再归档
$jj-ralph 继续 RALPH-login-reminder-20260722
$jj-ralph 继续 RALPH-login-reminder-20260722：归档后再改文案
$jj-ralph 不做了 RALPH-login-reminder-20260722：需求取消
$jj-ralph 交接到 兑接 承载
```

见 [integrations.md](references/integrations.md)、[artifact-layout.md](references/artifact-layout.md)；用户向示例 [docs/commands/jj-ralph.md](../../../docs/commands/jj-ralph.md)。
