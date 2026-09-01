# Exec plan — Grok Host Adapter Phase 2 / Wave 2

> 状态：completed
>
> 负责人：jj-flow dispatch
>
> 开始日期：2026-09-01
>
> 完成日期：2026-09-01
>
> 关联设计：[Grok Host Adapter](../../design-docs/grok-host-adapter.md)
>
> 边界：Phase 2 宿主边界脚手架 + Phase 3 真 Grok 试跑 + 人工审查升 A2。不得用 labs / `lab-harness` / Mode S / Mode W / `host:trial` 充数。未升 A3/A4。

## 目标

把 Grok 路径的可脚本化 adapter 写进宿主边界，跑通真会话试跑，并在人工审查后关闭 Wave 2、升 A2。

## Checklist

- [x] 项目注册表：`inspectProjectRegistry` / `inspectGitIdentity`
- [x] `bindGrokSessionTask` / `reconcileGrokSession`
- [x] doctor：检测 `grok` 可执行文件与 skill 安装；**不**因此把等级抬到 manifest 之上
- [x] `evaluateGrokWave2Evidence` fail-closed：lab-harness / semi-real / skill-only / placeholder 不得 PASS；JSON 不得自关
- [x] Phase 3：真实 Grok 会话试跑 + `docs/milestones/real-host-trial-grok.json`
- [x] 人工审查清单 1–4 PASS；`real-host-acceptance` **completed**；`max_unattended_level=A2`

## 验收

```bash
node --test tests/grok-host-adapter.test.mjs tests/harness-doctor.test.mjs tests/grok-host-contract.test.mjs tests/grok-host-trial.test.mjs
npm run doctor
```

`jj doctor`：`available_level=A2`，`declared_default=A1`，`grok.wave2_closed=true`，`wave2_status=completed`。

## 残留

Codex App 并列试跑仍缺。A3 自动返工与 A4 集成仍关闭。Mode P 见 Mode S exec plan。
