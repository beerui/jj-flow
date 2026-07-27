# 执行计划

复杂、跨模块的改造必须在这里留下版本化执行记录。计划只记录目标、边界、进度、决策和验收证据，不替代代码、schema 或测试事实。

## 状态约定

| 目录 | 状态 | 规则 |
| --- | --- | --- |
| `active/` | `active` 或 `blocked` | 尚有未完成工作，必须记录下一步和阻塞原因 |
| `completed/` | `completed` | 验收命令已运行，结果和剩余风险已记录 |

## 活跃计划

（当前无）

## 已完成计划

- [Grok Host Adapter Phase 1 — 契约扩展](completed/2026-07-27-grok-host-adapter.html)（契约与纯状态测试完成；Phase 2/3 与设计 Implemented 未启动）
- [Harness Engineering 收口与真实 Host 路径](completed/2026-07-18-harness-hardening.html)（仓库侧收口完成；真实 Codex App Host 见 [PENDING 里程碑](../milestones/real-host-acceptance.html)）
