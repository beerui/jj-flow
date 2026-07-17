# jj-flow 文档

`jj-flow` 是给 Codex 和 Claude Code 用的项目交付入口。它先整理需求、资料、证据和边界，再把工作交给合适的 Maestro 流程，避免在真实项目里漏接口、漏场景、漏验证。全部流程禁止调用 `maestro explore`。

## 现在要做什么

- 第一次使用：先看 [安装](installation.html) 和 [使用说明](usage.html)。
- 要完整交付、明确功能、线上修复、交付前审查，或暂时不确定类型：用 [$jj-delivery](command-jj-delivery.html)。
- 要迁移同源项目：用 [$jj-same](command-jj-same.html)。
- 要统一调度多个项目：用 [$jj-dispatch](command-jj-dispatch.html)。
- 想浏览全部入口：打开 [命令总览](commands.html)。

## 先跑一个完整示例

```text
$jj-delivery
目标：完成 AI 获客列表和详情。
资料：PRD 在 docs/v17.1，接口看 YApi，设计图来自 MasterGo。
范围：本期不做导出。
关键决策：列表沿用现有分页交互，详情不新增编辑能力。
验收：页面还原设计，接口字段真实，目标测试和 review 通过。
```

你会看到 Agent：

1. 先说明找到了哪些资料，还缺哪些关键证据。
2. 收敛本次范围和不做范围。
3. 给出实现、审查和验证计划。
4. 在批准边界内完成改动。
5. 区分已验证、待确认和阻塞项。

## 按任务选择

### 交付与开发

- [$jj-delivery](command-jj-delivery.html)：从需求到验证的完整交付；也覆盖明确功能、线上最小修复、交付前审查与不确定意图。

### 协作与迁移

- [$jj-same](command-jj-same.html)：首次迁移、handoff 和持续同步。
- [$jj-dispatch](command-jj-dispatch.html)：多项目任务预览、批准、绑定和恢复。

### 维护 jj-flow

- [$jj-validate](command-jj-validate.html)：项目状态和漂移自检。
- [$jj-evolve](command-jj-evolve.html)：根据自检和反馈推进下一轮升级。
- [CLI 调度与自动化](command-cli.html)：通过 `jj` / `jj-flow` 生成 Markdown 或 JSON dispatch。

## 文档已经可以搜索

左侧搜索框会搜索所有命令页、指南和维护文档。可以输入命令、场景或状态词：

```text
验证码 登录
handoff
PENDING
quality-review
```

按 `/` 快速进入搜索，按 `Esc` 清空。

## 文档结构

- [安装](installation.html)：安装 Codex skills、Claude commands 和 agent profiles。
- [使用说明](usage.html)：第一次怎么写需求、怎么提供资料、怎么判断完成。
- [命令总览](commands.html)：按目标快速选择命令。
- 独立命令页：每个命令的输入模板、完整示例、过程和完成标准。
- [术语与缩写](glossary.html)：查询 `PRD`、`ARMS`、`YApi`、`PENDING` 等概念。
- [架构](architecture.html)：理解 jj-flow、Maestro 和 Codex 的边界。
- [维护说明](maintenance.html)：项目维护者使用的验证和发布规则。
