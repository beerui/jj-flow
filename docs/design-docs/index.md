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
| [Agent Harness](harness-engineering.html) | Implemented（H0–H5；无真 Host） |
| [jj-ralph](jj-ralph.html) | Implemented |
| [任务分配 UX](task-assignment-ux.html) | Implemented |
| [Portfolio Knowledge](portfolio-knowledge.html) | Implemented |
| [Ralph → 知识库贡献](ralph-knowledge-contribute.html) | Proposed（归档投喂全局 KB） |
| [Ralph 归档提升](ralph-archive-elevation.html) | Accepted |
| [jj-evaluated](jj-evaluated.html) | Implemented（MVP runner） |
| [Grok Host Adapter](grok-host-adapter.html) | Proposed（Wave 2） |
| [jj-team-coordinate](jj-team-coordinate.html) | Proposed（P0/P1 文档：skill + 透明协议 + Codex 兼容；bridge CLI 未关闭） |
| [jj-team-lifecycle](jj-team-lifecycle.html) | Proposed（P0：TLV4 vendor + 固定 SDLC + Codex degraded；bridge CLI 未关闭） |
| [jj-team-swarm](jj-team-swarm.html) | Proposed（P0：TAS vendor + 透明协议 + Workflow 降级说明） |

实施进度：[执行计划](../exec-plans/index.html)
