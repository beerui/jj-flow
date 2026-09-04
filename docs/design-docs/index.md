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
| [Agent Harness](harness-engineering.md) | Implemented（H0–H5；Grok Wave 2 / A2 已关闭） |
| [jj-ralph](jj-ralph.md) | Implemented |
| [任务分配 UX](task-assignment-ux.md) | Implemented |
| [Portfolio Knowledge](portfolio-knowledge.md) | Implemented |
| [Ralph → 知识库贡献](ralph-knowledge-contribute.md) | Proposed（归档投喂全局 KB） |
| [Ralph 工作区布局（方案 A）](ralph-workspace-layout.md) | Implemented（扁平 live + `completed/` + `events.jsonl` + `--prune-archive`；finding 软提示） |
| [Ralph 自动结案](ralph-auto-closeout.md) | Implemented（accept PASS 后 MUST finalize；`status`/`locate` 带 `next`；`~/.agents` 分发与存量 `remediate`。修订 10 原文未入库，本文为补录） |
| [Ralph 任务工作区 .plans 化改造](ralph-plans-workspace.md) | Implemented（P0 热层 / P1 布局与归档 / P2 `task-*` 身份 / [P2+ lite](../exec-plans/completed/2026-09-03-ralph-plans-workspace-p2-lite.md) 均已落地；schema 1.2） |
| [Ralph 多轮任务内容预览](ralph-plans-workspace.preview.md) | Proposed（§3.2/§3.4 目标布局示例，非运行输出） |
| [Ralph 工作区目录对齐 exec-plans 与 progress 双轨](ralph-workspace-layout.md) | Proposed（规划草案：`index.md` + `tasks/`≡active + `completed/` + `migrated/`；progress 人读轨 / `.state/events.log` 机器轨分离；Phase 0–2 待开 exec plan） |
| [Ralph 归档提升](ralph-archive-elevation.md) | Accepted |
| [jj-evaluated](jj-evaluated.md) | Implemented（MVP runner） |
| [Grok Host Adapter](grok-host-adapter.md) | Implemented（Grok Wave 2 completed；`max_unattended_level=A2`） |
| [jj-team-coordinate](jj-team-coordinate.md) | Proposed（P0/P1 文档：skill + 透明协议 + Codex 兼容；bridge CLI 未关闭） |
| [jj-team-lifecycle](jj-team-lifecycle.md) | Proposed（P0：TLV4 vendor + 固定 SDLC + Codex degraded；bridge CLI 未关闭） |
| [jj-team-swarm](jj-team-swarm.md) | Proposed（P0：TAS vendor + 透明协议 + Workflow 降级说明） |
| [AI-native SDLC 对齐](ai-native-sdlc.md) | Implemented（切片 0–7；三条主路径内翻译） |
| [实验场 Loop gym / Family gym](jj-flow-labs.md) | Implemented（机械实验场；Live Agent 仍为手册 / evaluated） |
| [文档站迁移 VitePress 与使用文档改版](docs-site-vitepress.md) | Implemented（VitePress 站点、旧地址跳转、侧栏覆盖校验与新手使用文档已完成；证据见设计文档头部） |

实施进度：[执行计划](../exec-plans/index.md)
