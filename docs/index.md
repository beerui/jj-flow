# jj-flow 文档

`jj-flow` 是面向 **项目族** 的 AI **编排工作流**。

在 Codex / Claude Code 里用对话入口完成：

- **同源迁移与持续同步** → `$jj-same` / `/jj-same`
- **单仓全流程闭环** → `$jj-ralph` / `/jj-ralph`
- **单仓轻量审查** → `$jj-review` / `/jj-review`
- **多项目调度** → `$jj-dispatch`（Codex）

控制面、ralph run ledger、证据门禁和可恢复 `task_key` 是事实来源，不是会话记忆。产品中心是 **项目编排**。

## 3 步开始

1. **[安装](installation.html)** — 把 skill / slash command 装到 Codex 或 Claude
2. **[使用说明](usage.html)** — 如何写一条好输入、如何判断完成
3. **建立心智模型**
   - **[Loop 与 Graph 上手](loop-graph-guide.html)** — 外层 Graph 管秩序，内层 Loop 管做对
   - **[记忆与知识库](memory-knowledge-guide.html)** — 顶层 Portfolio KB、ralph 自动挂载、聊天不算记住
4. **选入口做第一件事**
   - 迁移/同步 → **[$jj-same](command-jj-same.html)**
   - 单仓闭环 → **[$jj-ralph](command-jj-ralph.html)**
   - 多项目派发 → **[$jj-dispatch](command-jj-dispatch.html)** / [交互演示](dispatch-demo.html)

不确定时打开 **[命令总览](commands.html)**。

## 先跑同源迁移

```text
$jj-same
会话=019f...
当前需求=保留密码入口
源=承接前台
目标=兑接前台,承载前台
```

你会看到 Agent：先核对证据 → 收敛范围 → 迁移矩阵 → 在边界内改目标仓 → 区分已验证 / 待确认 / 阻塞。

## 按任务选择

| 你想做什么 | 入口 |
|------------|------|
| 同源迁移、handoff、持续同步 | [$jj-same](command-jj-same.html) |
| 单仓分析→计划→验收→归档、能力地图 | [$jj-ralph](command-jj-ralph.html) |
| 单仓轻量审查、会话关联、reviews 报告 | [$jj-review](command-jj-review.html) |
| 多项目预览、批准、绑定、恢复 | [$jj-dispatch](command-jj-dispatch.html) |
| 跨项目知识与记忆怎么用 | [记忆与知识库](memory-knowledge-guide.html) |
| 只说「用 jj-flow」 | [$jj](command-jj.html)（按路由优先级） |
| 安装 / `ralph *` / `dispatch-tick` / Host 试跑 | [CLI](command-cli.html) · [安装](installation.html) |

## 维护与深入

- 本仓库维护：直接改代码并运行 `npm run verify`（见 [维护说明](maintenance.html)）
- 架构边界：[架构](architecture.html)
- 记忆与顶层知识库：[记忆与知识库](memory-knowledge-guide.html) · [Portfolio Knowledge 设计](design-docs/portfolio-knowledge.html)
- Agent 可维护性演进：[Harness Engineering 设计](design-docs/harness-engineering.html)
- 真实工作流评估与泛化学习：[`/jj-evaluated`](design-docs/jj-evaluated.html)
- 跨模块实施进度：[执行计划](exec-plans/index.html)
- 已接受的长期决策：[ADR 索引](adr/index.html)
- M6 已关闭：[M6 验收](milestones/m6-acceptance.html)
- M7 半真实 Host 闭环已关闭：[M7 验收](milestones/m7-acceptance.html)
- 真实 Host 仍为 PENDING：[真实 Host 验收](milestones/real-host-acceptance.html)（Codex App 或 [Grok Host Adapter](design-docs/grok-host-adapter.html) 等价路径；不得用半真实报告关闭；`max_unattended_level` 保持 A1）
- H5 持续熵清理已关闭：[H5 验收](milestones/h5-acceptance.html)；`harness:gc` 只读评分并输出维护候选，不自动修复
- Harness 仓库侧收口已完成：[执行计划](exec-plans/completed/2026-07-18-harness-hardening.html)

## 搜索

左侧搜索可查 `handoff`、`sync_key`、`task_key`、`dispatch`、`knowledge_refs` 等。桌面按 `/` 聚焦搜索，`Esc` 清空。
