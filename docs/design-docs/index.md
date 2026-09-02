# 设计文档

跨模块目标设计。实现事实以 `ARCHITECTURE.md`、代码、schema、测试为准。

## 状态

| 状态 | 含义 |
|------|------|
| Proposed | 未全部实现 |
| Accepted | 可进入 exec plan |
| Implemented | 有代码/测试/验收证据 |
| Superseded | 已替代 |

## 索引

| 设计 | 状态 |
|------|------|
| [Agent Harness](harness-engineering.html) | Implemented（H0–H5；Grok Wave 2 / A2 已关闭） |
| [jj-ralph](jj-ralph.html) | Implemented |
| [任务分配 UX](task-assignment-ux.html) | Implemented |
| [Portfolio Knowledge](portfolio-knowledge.html) | Implemented |
| [Ralph → 知识库贡献](ralph-knowledge-contribute.html) | Proposed（归档投喂全局 KB） |
| [Ralph 任务工作区 .plans 化改造](ralph-plans-workspace.html) | Proposed（P0/P1 已落地；P2 exec-plan active；lite 档未开） |
| [Ralph 多轮任务内容预览](ralph-plans-workspace.preview.html) | Proposed（§3.2/§3.4 目标布局示例，非运行输出） |
| [Ralph 归档提升](ralph-archive-elevation.html) | Accepted |
| [jj-evaluated](jj-evaluated.html) | Implemented（MVP runner） |
| [Grok Host Adapter](grok-host-adapter.html) | Implemented（Grok Wave 2 completed；`max_unattended_level=A2`） |
| [jj-team-coordinate](jj-team-coordinate.html) | Proposed（P0/P1 文档：skill + 透明协议 + Codex 兼容；bridge CLI 未关闭） |
| [jj-team-lifecycle](jj-team-lifecycle.html) | Proposed（P0：TLV4 vendor + 固定 SDLC + Codex degraded；bridge CLI 未关闭） |
| [jj-team-swarm](jj-team-swarm.html) | Proposed（P0：TAS vendor + 透明协议 + Workflow 降级说明） |
| [AI-native SDLC 对齐](ai-native-sdlc.html) | Implemented（切片 0–7；三条主路径内翻译） |
| [实验场 Loop gym / Family gym](jj-flow-labs.html) | Implemented（机械实验场；Live Agent 仍为手册 / evaluated） |

实施进度：[执行计划](../exec-plans/index.html)
