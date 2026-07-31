# 执行计划

复杂、跨模块的改造必须在这里留下版本化执行记录。计划只记录目标、边界、进度、决策和验收证据，不替代代码、schema 或测试事实。

## 状态约定

| 目录 | 状态 | 规则 |
| --- | --- | --- |
| `active/` | `active` 或 `blocked` | 尚有未完成工作，必须记录下一步和阻塞原因 |
| `completed/` | `completed` | 验收命令已运行，结果和剩余风险已记录 |

## 活跃计划

- [Dispatch / Mode S 升级 backlog（存档·留待）](active/2026-07-31-dispatch-upgrade-backlog.html)（**blocked**：C4/C5/C6 等；恢复时改 active；默认下一刀 U1 Review attestation）
- [Dispatch / Ralph 任务回退](active/2026-07-31-dispatch-ralph-rollback.html)（下一阶段：规格 → reopen/rework → Ralph phase/gate → 可选 git prep）
- [Grok dispatch Mode S 执行](active/2026-07-30-grok-dispatch-execution.html)（Phase 2a live 已验收；仍 open Mode W/P / Host Wave 2）

## 已完成计划

- [Grok Host Adapter Phase 1 — 契约扩展](completed/2026-07-27-grok-host-adapter.html)（契约与纯状态测试完成；Phase 2/3 与设计 Implemented 未启动）
- [Harness Engineering 收口与真实 Host 路径](completed/2026-07-18-harness-hardening.html)（仓库侧收口完成；真实 Codex App Host 见 [PENDING 里程碑](../milestones/real-host-acceptance.html)）
