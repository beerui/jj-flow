# Exec plan — Grok Host Adapter Phase 2

> 状态：active
>
> 负责人：jj-flow dispatch
>
> 开始日期：2026-09-01
>
> 关联设计：[Grok Host Adapter](../../design-docs/grok-host-adapter.md)
>
> 边界：Phase 2 宿主边界脚手架（项目注册表 / 可脚本化 create-bind-reconcile / doctor grok）。**不**关闭 Host Wave 2；**不**升 A2；**不得**用 labs / `lab-harness` / Mode S / Mode W / `host:trial` 充数。
>
> worktree 生命周期已由 Mode W Phase 2b 落地（`src/dispatchWorktree.mjs`），本计划复用，不重做。

## 目标

把 Grok 路径的 **可脚本化 adapter** 写进宿主边界，使 create/bind/reconcile 不依赖私有 API，并为 Phase 3 真试跑留 fail-closed 评估器。

## 非目标

- 写入 `docs/milestones/real-host-trial-grok.json` 并声称 PASS
- 修改 `autonomy.max_unattended_level`
- 把 `host:trial` 改成 Grok 真实验收
- Mode P

## Checklist

- [x] 项目注册表：`inspectProjectRegistry` / `inspectGitIdentity`（path + git remote/HEAD，无网络）
- [x] `bindGrokSessionTask` / `reconcileGrokSession`（复用 `CREATE_THREAD` / `RECONCILE_THREAD` 类型名）
- [x] doctor：检测 `grok` 可执行文件与 skill 安装；**不**因此报告 A2 / 不关闭 Wave 2
- [x] `evaluateGrokWave2Evidence` fail-closed：lab-harness / semi-real / skill-only / placeholder session 不得 PASS
- [x] Phase 3：真实 Grok 会话试跑 + versioned trial JSON（evaluable；**不**关 Wave 2 / **不**升 A2）

## 验收

```bash
node --test tests/grok-host-adapter.test.mjs tests/harness-doctor.test.mjs tests/grok-host-contract.test.mjs
npm run doctor
```

`jj doctor` 的 `available_level` 仍为 manifest `max_unattended_level`（A1）。`grok.wave2_closed` 必须为 false。

## 残留

`docs/milestones/real-host-trial-grok.json` 已 evaluable，`real-host-acceptance` 为 `in_progress`。Wave 2 **未**关闭；`max_unattended_level` 仍为 A1。升 A2 需要单独人工审查。
