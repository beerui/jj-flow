---
name: jj-ralph
description: "在当前单一业务仓库完成需求到验收归档的 Ralph 闭环（ANALYZE→PLAN→DELIVER→ACCEPT→ARCHIVE）；产物写入 .workflow/ralph/RALPH-*/，维护 business-map.json，可选导出 handoff 或 dispatch 推荐快照。在用户要求 ralph/全流程/闭环/归档/能力地图/map-find/business-map/RALPH- 留痕，或单仓改动需要可追溯验收时使用。同源多仓迁移用 jj-same；多项目调度用 jj-dispatch。机械步骤用 skill 内 ralph_ops.mjs（自带 scripts/lib/ralph.mjs，业务仓无需安装 jj-flow 包）。"
---

# jj-ralph

完成单仓需求到验收归档。状态只写 `.workflow/ralph/` 与 Git，不靠聊天推进检查点。

默认最短路径：少检索、短产物、失败立刻换策略。

## 立即动作

1. 无 run 时优先跑 `ralph_ops.mjs init`（路径解析见下）。仅当 skill 损坏/缺 lib 时，才复制 [run.skeleton.json](references/run.skeleton.json) 手建。布局见 [artifact-layout.md](references/artifact-layout.md)。
2. 做 **map-find**：`ralph_ops.mjs map-find --query "…"`（或读 `.workflow/ralph/business-map.json`）；无命中继续，不补长叙事。规则见 [business-map.md](references/business-map.md)。
3. 用户已给 `@file:line` 或单点改动时：先读 [tiny-example.md](references/tiny-example.md)；只读目标文件 + 至多 1 个同模块参考。
4. 按 [phases.md](references/phases.md) 推进 ANALYZE → PLAN → DELIVER → ACCEPT → ARCHIVE；阶段 PASS 后自动进入下一阶段。优先 `gate` 更新门禁，避免手改 `run.json`。
5. accept PASS 后直接收口：
   - **finalize（推荐）**：`ralph_ops.mjs finalize --run-id … --modules … --keywords …`（= map-merge + archive）
   - 或分步：`map-merge` 再 `archive`
   - 需要迁移：`ralph_ops.mjs handoff --run-id …`
   - 需要分发：`ralph_ops.mjs dispatch-snapshot --run-id …`
   - 需要提交建议：`ralph_ops.mjs commit-prep --run-id …`（不自动 commit/push）
   - 需要审查：用 `$jj-review`，或 `ralph_ops.mjs review-record …`
6. 输出完成报告。

边界与集成见 [integrations.md](references/integrations.md)。仅在校验失败时读 [ralph-run.schema.json](references/ralph-run.schema.json)。

## 脚本路径解析（禁止字面量 path/to）

按序定位 `ralph_ops.mjs`，先确认文件存在再执行：

1. `<repo>/.codex/skills/jj-ralph/scripts/ralph_ops.mjs`
2. `$CODEX_HOME/skills/jj-ralph/scripts/ralph_ops.mjs`（Windows 常见 `%USERPROFILE%\.codex\skills\jj-ralph\scripts\ralph_ops.mjs`）
3. 本机有 `jj`：`jj ralph <cmd> --json …`（可选，与 skill 同一套逻辑）
4. **不要**因为业务仓没有 `jj-flow` 包就改手建；skill 自带 `scripts/lib/ralph.mjs`
5. 仅 skill 缺 lib / 脚本损坏时：复制 `references/*.skeleton.json`

脚本解析库顺序：`$JJ_FLOW_ROOT` → jj-flow 仓内 `src/ralph.mjs` → **skill 内 `scripts/lib/ralph.mjs`** → `node_modules/@shendu-sdt/jj-flow`。

## 机械步骤脚本（优先）

```bash
node <resolved>/ralph_ops.mjs init --run-id RALPH-x-20260723 --title "..." --goal "..."
node <resolved>/ralph_ops.mjs map-find --query "关键词"
node <resolved>/ralph_ops.mjs gate --run-id RALPH-x-20260723 --gate analyze --status PASS
node <resolved>/ralph_ops.mjs finalize --run-id RALPH-x-20260723 --modules src/a.js --keywords a,b --lessons "l1|l2"
node <resolved>/ralph_ops.mjs handoff --run-id RALPH-x-20260723
node <resolved>/ralph_ops.mjs dispatch-snapshot --run-id RALPH-x-20260723
node <resolved>/ralph_ops.mjs commit-prep --run-id RALPH-x-20260723
node <resolved>/ralph_ops.mjs status --run-id RALPH-x-20260723
```

业务仓**无需**安装 `@shendu-sdt/jj-flow`。jj-flow 维护者改 `src/ralph.mjs` 后执行 `npm run ralph:sync`。

## 硬约束

- 已定位改动不做额外重构与无关清理。
- 单点/单文件：`analyze.md` / `plan.md` 各约 ≤15 行；`progress.md` 只记变更与验证；`acceptance.md` 只对照 MUST。
- 同一操作最多失败 2 次；第 2 次必须换策略。禁止同策略空转与 shell 多行源码嵌套。
- 机械步骤优先 `ralph_ops.mjs`；**禁止**在 skill 正常时因“无 jj-flow”改手搓 JSON。
- accept PASS 收口默认 `finalize`；`map-merge` 默认要求 accept=PASS（草案用 `--force`）。
- 未要求 commit/push/review/handoff/dispatch 不做。commentary 只报 phase、关键动作、阻塞。

## 完成报告（中文）

- run_id、phase、status、产物路径
- 验收结论与证据
- 地图是否已 merge、可检索关键词
- handoff / dispatch-snapshot 路径（若有）
- commit-prep 建议（未要求则不提交）
- 阻塞与解除条件（若有）

## 调用示例

```text
$jj-ralph 目标=登录后密码过期提醒 范围=仅登录成功路径 验收=有提示且可跳转改密
$jj-ralph 继续 RALPH-login-reminder-20260722
$jj-ralph 查地图 密码过期
$jj-ralph @path/to/file.vue:19 把静态协议地址改为后端字段 zeroInterestBizAgreementUrl
```
