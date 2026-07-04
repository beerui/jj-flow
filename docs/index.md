# jj-flow 文档

`jj-flow` 是 Maestro 上层的交付编排协议。它面向 Codex 内的真实交付：用户给需求、资料和关键决策，`$jj` 负责整理上下文、证据、guard 状态和 Maestro 调用链。

## 先从这里开始

第一次使用先看 [安装](installation.html)，确认 `$jj` skill 已放到 Codex 可读取的位置。然后在 Codex 对话里直接发：

```text
$jj delivery 按 PRD、接口文档和设计图完成这个需求
```

如果你已经知道要做哪类任务，可以直接看 [命令参考](commands.html)。那里按 `delivery`、`validate`、`evolve`、`feat`、`fix`、`review`、`knowhow` 分别说明了参数、适用场景、输入示例和交付产物。

## 文档结构

- [安装](installation.html)：如何把 `$jj` 安装到 Codex skill 目录，以及如何确认生效。
- [使用说明](usage.html)：日常在 Codex 内使用 `$jj delivery`、提供证据和处理关键决策。
- [命令参考](commands.html)：每个 `$jj` 命令的参数、使用方案、输入示例和输出期望。
- [架构](architecture.html)：薄适配层、recipe、evidence、guard 和 Maestro 调用链的关系。
- [项目规划](project-plan.html)：长期路线图、当前不做范围和后续阶段。
- [维护说明](maintenance.html)：新增能力、验证、发布和文档站维护规则。
- [GitHub Pages 部署](deployment.html)：静态站点构建、CI 检查和 Pages 发布流程。

## 常用命令

```text
$jj delivery <需求 + 资料 + 关键决策>
$jj validate <项目状态、自检范围或升级目标>
$jj evolve <项目自身迭代目标或修正优先级>
$jj fix <现象 + 时间窗 + 日志或错误指纹>
$jj review <目标 + diff 或交付物>
$jj knowhow <要沉淀的流程、问题或对话>
```

`$jj delivery` 是默认入口。除非你明确只想修 bug、审查或沉淀经验，否则从 `delivery` 开始。

## 长期维护原则

1. 文档是交付协议的一部分。用户可见能力必须先写清使用方式，再实现代码。
2. 文档站必须能从仓库源码稳定生成，不能依赖手工复制网页内容。
3. 所有长期入口都要能追到源码、测试、workflow 或架构约束。
4. `jj-flow` 保持 Maestro 上层协议定位，不把文档站变成另一个执行引擎。

## 维护命令

```bash
npm run verify
npm run docs:build
```

这些命令只用于维护本仓库和发布文档站。普通交付入口是 Codex 内的 `$jj delivery`。
