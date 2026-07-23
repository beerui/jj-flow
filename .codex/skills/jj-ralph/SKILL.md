---
name: jj-ralph
description: "在当前单一业务仓库完成需求到验收归档的 Ralph 闭环（ANALYZE→PLAN→DELIVER→ACCEPT→ARCHIVE）；产物写入 .workflow/ralph/RALPH-*/，维护 business-map.json，可选导出 handoff 或 dispatch 推荐快照。在用户要求 ralph/全流程/闭环/归档/能力地图留痕，或单仓改动需要可追溯验收时使用。同源多仓迁移用 jj-same；多项目调度用 jj-dispatch。全部由 Codex 直接读写约定路径完成，不依赖 jj ralph CLI。"
---

# jj-ralph

完成单仓需求到验收归档。状态只写 `.workflow/ralph/` 与 Git，不靠聊天推进检查点。全部由 Codex 直接读写约定路径。

默认最短路径：少检索、短产物、失败立刻换策略。

## 立即动作

1. 无 run 时优先 `scripts/ralph_ops.mjs init --run-id RALPH-{slug}-{YYYYMMDD} --title "…" --goal "…"`。脚本不可用时，复制 [run.skeleton.json](references/run.skeleton.json) 手建。布局见 [artifact-layout.md](references/artifact-layout.md)。
2. 做 **map-find**：读 `.workflow/ralph/business-map.json`，按标题/关键词/模块检索；无命中继续，不补长叙事。规则见 [business-map.md](references/business-map.md)。
3. 用户已给 `@file:line` 或单点改动时：先读 [tiny-example.md](references/tiny-example.md)；只读目标文件 + 至多 1 个同模块参考。
4. 按 [phases.md](references/phases.md) 推进 ANALYZE → PLAN → DELIVER → ACCEPT → ARCHIVE；阶段 PASS 后自动进入下一阶段。
5. accept PASS 后直接收口：
   - archive：`scripts/ralph_ops.mjs archive --run-id …`
   - map-merge：`scripts/ralph_ops.mjs map-merge --run-id … --modules … --keywords …`
   - 需要迁移：`scripts/ralph_ops.mjs handoff --run-id …`
   - 需要分发：`scripts/ralph_ops.mjs dispatch-snapshot --run-id …`
   - 需要提交建议：在完成报告或 `progress.md` 写 commit-prep（不自动 commit/push）
   - 需要审查：用 `$jj-review`，结论写入 `reviews/REV-*.json` 并回写 `run.json`
6. 输出完成报告。

边界与集成见 [integrations.md](references/integrations.md)。`run.json` 契约见 [ralph-run.schema.json](references/ralph-run.schema.json)。


## 机械步骤脚本（优先）

优先运行 skill 内脚本，避免手搓 JSON：

```bash
node path/to/jj-ralph/scripts/ralph_ops.mjs init --run-id RALPH-x-20260723 --title "..." --goal "..."
node path/to/jj-ralph/scripts/ralph_ops.mjs map-merge --run-id RALPH-x-20260723 --modules src/a.vue --keywords a,b
node path/to/jj-ralph/scripts/ralph_ops.mjs archive --run-id RALPH-x-20260723
node path/to/jj-ralph/scripts/ralph_ops.mjs handoff --run-id RALPH-x-20260723
node path/to/jj-ralph/scripts/ralph_ops.mjs dispatch-snapshot --run-id RALPH-x-20260723
node path/to/jj-ralph/scripts/ralph_ops.mjs status --run-id RALPH-x-20260723
```

脚本不可用时，再复制 references 下 skeleton 手写。

## 硬约束

- 已定位改动不做额外重构与无关清理。
- 单点/单文件：`analyze.md` / `plan.md` 各约 ≤15 行；`progress.md` 只记变更与验证；`acceptance.md` 只对照 MUST。
- 同一操作最多失败 2 次；第 2 次必须换策略（如 `apply_patch` → 脚本落盘）。禁止同策略空转与 shell 多行源码嵌套。
- 机械步骤优先 `scripts/ralph_ops.mjs`；不可用时再复制 skeleton，不要从零编 schema。
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
