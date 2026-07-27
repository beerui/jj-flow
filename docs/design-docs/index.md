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
- [jj-ralph 单仓全流程闭环](jj-ralph.html)
- [Portfolio Knowledge](portfolio-knowledge.html)：跨项目顶层知识库；extract / review / promote；ralph 硬接线挂载 `knowledge_refs`；与 same/dispatch 通过 handoff / 快照衔接。使用者文档见 [记忆与知识库](../memory-knowledge-guide.html)。
- [`/jj-evaluated` 真实工作流评估与泛化学习](jj-evaluated.html)：用真实项目 episode、trace、holdout 和 regression 评估承接/兑接/承载工作流，并在人工批准后演进 skill 与 recipe。
- [Grok Host Adapter](grok-host-adapter.html)：把 Grok Build 定义为 Wave 2 可选第二宿主；session/worktree attestation 与 Codex 路径并列，skill 安装不推进 A2。
- 顶层知识库 / 记忆系统（portfolio，外置）：`D:/a/knowledge`（Web 管理 + extract/review/agent knowledge_refs；见该目录 README 与 docs/jj-flow-integration.md）。

复杂实施过程进入 [版本化执行计划](../exec-plans/index.html)，不写入 `AGENTS.md`、聊天或本机隐藏状态。

设计实施时，大任务应另建版本化 exec plan，记录进度、决策和验收证据，不把执行历史塞回 `AGENTS.md`。
