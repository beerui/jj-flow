# jj-flow 文档

`jj-flow` 是给 Codex 和 Claude Code 用的交付入口。你把需求、资料和必须拍板的决定写进对话，`$jj-delivery` 或 `/jj-delivery` 帮你把一次工作按“找资料、定范围、实现、审查、验证、沉淀”的顺序推进。

它解决的是一个很具体的问题：真实项目里资料通常散在 PRD、YApi、MasterGo、日志、截图和历史线程里。直接让模型写代码容易漏边界、漏接口、漏验证。`jj-*` 系列缩写命令的作用是先把这些东西整理清楚，再进入实现。

## 先从这里开始

第一次使用先看 [安装](installation.html)。确认 `jj-*` 命令生效后，打开你的项目，在 Codex 或 Claude Code 对话里直接发：

```text
$jj-delivery 按 PRD、接口文档和设计图完成这个需求
/jj-delivery 按 PRD、接口文档和设计图完成这个需求
```

如果资料比较多，可以这样写：

```text
$jj-delivery
需求：实现 AI 获客列表和详情。
资料：PRD 在 docs/v17.1，接口看 YApi 链接，设计图是 MasterGo 链接。
范围：本期不做导出。
验收：页面还原设计，接口字段真实，测试通过。
```

你不需要先把资料整理成固定参数。把线索放进对话即可。

## 你会得到什么

1. Agent 先确认它找到了哪些资料，还缺什么证据。
2. 任务边界清楚后，再给出执行计划。
3. 涉及接口、设计、日志或历史线程时，优先引用真实资料。
4. 能自动验证的地方会跑验证；不能自动确认的地方会明确标成待确认。
5. 只有范围、方案、权限或上线风险会改变结果时，才回头问你。

## 常用入口

```text
$jj-delivery <完整需求、资料和验收要求>
$jj-fix <线上现象、时间窗、日志或错误指纹>
$jj-review <要审查的 diff、计划或交付物>
$jj-knowhow <要沉淀的一次交付、问题或对话>
```

如果你在维护 `jj-flow` 这个项目本身，再使用：

```text
$jj-validate <检查项目状态或文档代码漂移>
$jj-evolve <基于自检结果推进项目升级>
```

## 文档结构

- [安装](installation.html)：如何把 `jj-*` 命令安装到 Codex skills 或 Claude commands 目录，以及如何确认生效。
- [使用说明](usage.html)：第一次怎么写需求、怎么提供资料、怎么处理追问。
- [命令参考](commands.html)：每个 `jj-*` 缩写命令什么时候用、要给什么、会得到什么。
- [术语与缩写](glossary.html)：不懂 `PRD`、`ARMS`、`YApi` 等缩写时查这里。
- [架构](architecture.html)：想了解它和 Maestro、Codex 的关系时再看。
- [项目规划](project-plan.html)：项目维护者查看长期路线图。
- [维护说明](maintenance.html)：项目维护者查看验证、发布和文档站规则。
