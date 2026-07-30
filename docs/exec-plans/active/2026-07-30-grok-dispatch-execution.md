# Exec plan — Grok dispatch Mode S execution

> 状态：active
>
> 负责人：jj-flow dispatch
>
> 开始日期：2026-07-30
>
> 关联设计：[Grok Host Adapter](../../design-docs/grok-host-adapter.md)
>
> Spec SSOT：`.codex/skills/jj-dispatch/references/grok-dispatch-execution.md`
>
> 边界：Phase 2a skill MVP（Mode S + agent artifacts）；不关闭 Host Wave 2；不要求用户 CLI

## 目标

Make Grok `/jj-dispatch` **repeatable** without forcing multi-session or user CLI: default **Mode S**, honest control-plane artifacts, then optional W/P and Host Wave 2.

## Architecture decision

| Option | Decision |
| --- | --- |
| Multi Grok session as default | **No** (Mode P later) |
| Grok Workflow (Rhai) as checkpoint authority | **No** (assist only) |
| Mode S single coordinator session | **Yes — default** |
| User must run CLI | **No** |

## Checklist

### Phase 2a (skill MVP)

- [x] Spec in `.codex/skills/jj-dispatch/references/grok-dispatch-execution.md`
- [x] SKILL.md Grok section + gate 5 Mode S degrade
- [x] `agents/openai.yaml` Mode S prompt
- [x] `docs/commands/jj-dispatch.md` wording
- [x] `plane-self-check.mjs` (synthetic session / VERIFIED without commit)
- [ ] Live Grok delivery: PREFLIGHT source commit + real session + receipt + VERIFIED green on self-check
- [x] Thin indexes under portfolio `knowledge/` and `dispatch-control/docs` point at jj-flow SSOT

### Phase 2b Mode W

- [ ] Isolation worktree bind/cleanup

### Phase 2c Mode P

- [ ] Child session 1:1 + RECONCILE

### Phase 3

- [ ] `docs/milestones/real-host-trial-grok.json`
- [ ] Revert-remerge land warning exercised

## Non-goals this plan

- Raising autonomy A2 solely because skill installed
- Teaching users `dispatch-tick`
