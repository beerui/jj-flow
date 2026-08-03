# dispatch-rewrite-report — en-writer-dispatch

| Field | Value |
| --- | --- |
| Worker | en-writer-dispatch |
| Session | TC-skill-en-zh-20260803 |
| Date | 2026-08-03 |
| Scope | `skills/jj-dispatch/**` + `docs/skill-zh-bridge/jj-dispatch/README.zh.md` |
| Glossary | `artifacts/glossary.json` |
| Result | **COMPLETE** — English SSOT; residual CJK = 0 |

## Goal

Rewrite all Chinese/mixed agent-facing markdown under `skills/jj-dispatch/` into clear technical English SSOT without inventing protocol rules.

## Files rewritten (English SSOT)

| Path | Notes |
| --- | --- |
| `skills/jj-dispatch/SKILL.md` | Full EN; description frontmatter; gates table; config; four actions; Mode S; CLI; out of scope |
| `skills/jj-dispatch/references/happy-path.md` | Gates 1–8; decision table; EP-20260803 base freshness |
| `skills/jj-dispatch/references/agent-write-plane.md` | A–D ceilings/C4–C6/T-task-result-sync |
| `skills/jj-dispatch/references/control-project.md` | dirs, intake, recovery, Review loop, schema keys |
| `skills/jj-dispatch/references/rollback.md` | reopen matrix; Mode S soft; G-menu; rollbackPrep; closeDelivery |
| `skills/jj-dispatch/references/grok-dispatch-execution.md` | Mode S/W/P; preflight; attestation/receipt; phases |
| `skills/jj-dispatch/agents/openai.yaml` | `short_description` only (default_prompt already EN) |

## Files not rewritten (already non-CJK prose / machine assets)

| Path | Reason |
| --- | --- |
| `references/control-plane.schema.json` | JSON schema; no Chinese prose |
| `references/host-action-contract.json` | JSON contract |
| `references/host-action-contract.schema.json` | JSON schema |
| `references/task-receipt.schema.json` | JSON schema |
| `scripts/plane-self-check.mjs` | JS; no CJK |

## Bridge / human-only updates

| Path | Change |
| --- | --- |
| `docs/skill-zh-bridge/jj-dispatch/README.zh.md` | EN status → done; full section map EN→中文要点; glossary alignment |
| `docs/skill-zh-bridge/sessions/TC-skill-en-zh-20260803/artifacts/dispatch-rewrite-report.md` | this report |

## Preservation checks

- Paths, CLI (`jj doctor`, `jj dispatch-tick`, `plane-self-check.mjs`, etc.) unchanged
- Schema / status keys preserved: `PREVIEW_ONLY`, `PENDING_THREAD`, `BOUND`, `UNKNOWN`, `VERIFIED`, `EVIDENCE_READY`, `NO_CHANGE_REQUIRED`, `task_key`, `delivery_id`, `produced_commit`, `sandbox_evidence_ref`, host_ids (`grok-build`, `codex-app`), Mode S/W/P, C3–C6, T-task-result-sync, EP ids
- Code fences / JSON / bash / js samples kept structurally; only human-facing strings inside examples translated where Chinese (e.g. reopen `reason`)
- No new protocol rules invented

## Glossary application (sample)

| Term used in EN body | Source |
| --- | --- |
| control plane | 控制平面 |
| gate | 门禁 |
| artifact | 产物 |
| dispatch | 派发 |
| SSOT / authoritative | 权威源 |
| closeout | 收工 (jj-end) |
| abandon | 废弃 |
| resume | 续作 |
| handoff | 交接 |
| VERIFIED / acceptance | 验收 |

Product role labels (承接/兑接/承载) do not appear as rewrite targets in jj-dispatch prose; left to glossary notes for other skills.

## Verification

```text
rg '[\p{Han}]' skills/jj-dispatch
→ No matches found
```

(Equivalent workspace scan: pattern `[\u4e00-\u9fff]` over `skills/jj-dispatch` → 0 hits.)

## Follow-ups (out of this worker scope)

- Host reinstall of skill copy if needed: `node src/cli.mjs install-skill --platform all --force`
- Other skills still mixed: jj-ralph, jj-same, jj-review, jj-end, jj-evaluated, jj router (separate writers)
- Optional: refresh SEZ path-migrate language-report inventory counts for jj-dispatch
