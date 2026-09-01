# Exec plan — Dispatch / Mode S 升级 backlog

> 状态：active
>
> 备注：U1–U3（C4–C6）已在 2026-07-31 收尾实现；Mode W 机械路径 2026-09-01；Mode P / Host Wave 2 仍后置。
>
> 负责人：jj-flow dispatch
>
> 开始日期：2026-07-31
>
> 关联：
> - `docs/evaluations/2026-07-31-readme-pnpm-dispatch.md`
> - `docs/evaluations/2026-07-31-readme-pnpm-rollback.md`
> - `docs/exec-plans/completed/2026-07-31-dispatch-ralph-rollback.md`（R1–R4 done；Ralph 无终态冻结 2026-08-01）

## 1. 已落地（勿重复）

| ID | 项 | 状态 | 证据 |
| --- | --- | --- | --- |
| C1 | project-branch 默认 | promoted | skill + host-action-contract |
| C2 | 分支/workspace 不确定先问 | promoted | PREVIEW NEEDS_CONFIRM |
| C3 | VERIFIED 需 produced_commit；plane-self-check | promoted | beta.38 + skill |
| Mode S 2a | Grok 单会话 + attestation/receipt | live OK | readme-pnpm |
| R1–R4 | 回退规格/API/G-menu/prep | done | rollback exec plan |
| **C4** | Review/read 也写 attestation **文件** | **promoted** | self-check + `dispatchAttestation.mjs` + skill 硬门禁 C + sample |
| **C5** | `integrity_grade` ok\|degraded\|fail | **promoted** | grade API + schema + setIntegrityGrade + tests |
| **C6** | `remote_closeout` 可选标注 | **promoted** | setRemoteCloseout + schema + 用户文档 |

## 2. 仍后置

| ID | 项 | 说明 |
| --- | --- | --- |
| Mode W | exclusive-worktree 完整 bind/cleanup | **promoted** 2026-09-01（机械；非 Wave 2） |
| Mode P | 多 session 1:1 | Phase 2c |
| Host Wave 2 | real-host-trial-grok | Proposed |
| acceptor-tag 历史 plane | 勿回写变绿；可用 reopen 另线 | 负例保留 |

## 3. 完成定义

U1–U3（C4–C6）**已完成**。本文件可在 Mode W/P 仍 open 时保持 active 作指针，或待 Host Wave 2 时再归档 completed。

## 4. 决策日志

| 日期 | 决策 | 原因 |
| --- | --- | --- |
| 2026-07-31 | 会话进化项整包存档为 blocked | 金样已闭环 |
| 2026-07-31 | 收尾窗口实现 C4–C6 + R4 + delivery closeout | 用户要求继续收尾工作流开发 |
| 2026-07-31 | C4 仅对 **BOUND** intent 强制文件 ref | 不误伤历史 COMPLETED 软 plane |
