# jj-flow 文档

`jj-flow` 是面向 **项目族** 的 AI **编排工作流**。

在 Codex / Claude Code 里用对话入口完成：

- **同源迁移与持续同步** → `$jj-same` / `/jj-same`
- **多项目调度** → `$jj-dispatch`（Codex）

控制面、证据门禁和可恢复 `task_key` 是事实来源，不是会话记忆。Maestro 等工具可按需调用，但产品中心是 **项目编排**，不是 Maestro 适配层。

全部流程禁止调用 `maestro explore`。

## 3 步开始

1. **[安装](installation.html)** — 把 skill / slash command 装到 Codex 或 Claude  
2. **[使用说明](usage.html)** — 如何写一条好输入、如何判断完成  
3. **选入口做第一件事**  
   - 迁移/同步 → **[$jj-same](command-jj-same.html)**  
   - 多项目派发 → **[$jj-dispatch](command-jj-dispatch.html)**  

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
| 多项目预览、批准、绑定、恢复 | [$jj-dispatch](command-jj-dispatch.html) |
| 只说「用 jj-flow」 | [$jj](command-jj.html)（默认路由到 same） |
| 安装 / `dispatch-tick` / 半真实 Host 试跑 | [CLI](command-cli.html) · [安装](installation.html) |

## 维护与深入

- 本仓库维护：直接改代码并运行 `npm run verify`（见 [维护说明](maintenance.html)）
- 架构边界：[架构](architecture.html)
- Agent 可维护性演进：[Harness Engineering 设计](design-docs/harness-engineering.html)
- 已接受的长期决策：[ADR 索引](adr/index.html)
- M6 已关闭：[M6 验收](milestones/m6-acceptance.html)
- M7 半真实 Host 闭环已关闭：[M7 验收](milestones/m7-acceptance.html)；真实 Codex App thread/sandbox 联调仍属于部署环境验证
- H5 持续熵清理已关闭：[H5 验收](milestones/h5-acceptance.html)；`harness:gc` 只读评分并输出维护候选，不自动修复

## 搜索

左侧搜索可查 `handoff`、`sync_key`、`task_key`、`dispatch` 等。桌面按 `/` 聚焦搜索，`Esc` 清空。
