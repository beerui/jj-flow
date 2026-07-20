# 设计文档

这里保存影响多个模块、需要长期维护的系统设计。设计文档说明目标状态、边界和验收标准；当前实现事实仍以 `ARCHITECTURE.md`、代码、schema 和测试为准。

## 状态约定

| 状态 | 含义 |
| --- | --- |
| Proposed | 设计已形成，尚未全部实现 |
| Accepted | 关键决策已接受，可以进入执行计划 |
| Implemented | 验收标准已有代码和测试证据 |
| Superseded | 已被新的设计或 ADR 替代 |

## 当前设计

- [Agent Harness 系统设计](harness-engineering.html)：把仓库真相源、机械门禁、可重放反馈、自主等级和熵清理组成一套 Agent 可读、可验证的工程系统。
- [任务分配与反馈的轻量展示设计](task-assignment-ux.html)：以任务主标题驱动快速分配，隐藏文档正文和冗余过程输出。

复杂实施过程进入 [版本化执行计划](../exec-plans/index.html)，不写入 `AGENTS.md`、聊天或本机隐藏状态。

设计实施时，大任务应另建版本化 exec plan，记录进度、决策和验收证据，不把执行历史塞回 `AGENTS.md`。
