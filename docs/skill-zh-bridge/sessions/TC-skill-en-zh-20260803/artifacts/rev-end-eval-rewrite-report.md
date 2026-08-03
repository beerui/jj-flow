# Rewrite report — jj-review / jj-end / jj-evaluated

**Worker:** en-writer-review-end-eval  
**Session:** TC-skill-en-zh-20260803  
**Date:** 2026-08-03  
**Glossary:** `docs/skill-zh-bridge/sessions/TC-skill-en-zh-20260803/artifacts/glossary.json`

## Scope

| Tree | Action |
| --- | --- |
| `skills/jj-review/` | Full EN SSOT rewrite (was Chinese-dominant) |
| `skills/jj-end/` | Full EN SSOT rewrite (was mixed CN/EN) |
| `skills/jj-evaluated/` | Residual CN cleanup (body already mostly EN) |
| `docs/skill-zh-bridge/jj-review/README.zh.md` | Human bridge pack updated |
| `docs/skill-zh-bridge/jj-end/README.zh.md` | Human bridge pack updated |
| `docs/skill-zh-bridge/jj-evaluated/README.zh.md` | Human bridge pack updated |

## Files changed

### jj-review

| Path | Change |
| --- | --- |
| `skills/jj-review/SKILL.md` | EN rewrite; preserve outcomes `PASS`/`NEEDS_CHANGES`/`BLOCKED`, CLI `jj ralph review-record`, paths |
| `skills/jj-review/references/host-review.md` | EN rewrite; discovery order, host matrix, severity/outcome maps |
| `skills/jj-review/references/report-layout.md` | EN rewrite; REV schema and run.json write-back |
| `skills/jj-review/references/review-report.skeleton.json` | `summary` placeholder → English |
| `skills/jj-review/agents/openai.yaml` | short_description + default_prompt → English |

### jj-end

| Path | Change |
| --- | --- |
| `skills/jj-end/SKILL.md` | EN rewrite; keep Chinese Conventional Commit **subject** product rule; Chinese trigger phrases moved to bridge pack |
| `skills/jj-end/agents/openai.yaml` | short_description → English |

### jj-evaluated

| Path | Change |
| --- | --- |
| `skills/jj-evaluated/SKILL.md` | description/prose clarifying product role tokens |
| `skills/jj-evaluated/references/episode-contract.md` | role field note: do not rename `项目A/B/C` |
| `skills/jj-evaluated/references/source-evidence-map.md` | pure-CN phrase → EN; dual form for 承载 |
| `skills/jj-evaluated/scripts/evaluated_ops.mjs` | report skeleton role comment clarified (ALLOWED_ROLES unchanged) |
| `skills/jj-evaluated/scripts/episode-validate.mjs` | **unchanged** (contract: `ALLOWED_ROLES = 项目A\|项目B\|项目C`) |
| `skills/jj-evaluated/references/optimization-loop.md` | **unchanged** (already EN) |

### Human bridge

| Path | Change |
| --- | --- |
| `docs/skill-zh-bridge/jj-review/README.zh.md` | EN SSOT = done; Chinese summary of immediate actions / hard rules |
| `docs/skill-zh-bridge/jj-end/README.zh.md` | EN SSOT = done; Chinese triggers + pipeline summary |
| `docs/skill-zh-bridge/jj-evaluated/README.zh.md` | EN SSOT = done; 9-step + role-token note |

## Preserved contracts

- Review outcomes: `PASS` / `NEEDS_CHANGES` / `BLOCKED`
- Paths: `.workflow/ralph/<run_id>/reviews/REV-n.json`, `run.json.review`, `progress.md`
- CLI: `jj ralph review-record`, `ralph_ops.mjs review-record`
- Closeout order: fetch → commit → sync work → push work → sync integration → merge → push integration → return
- Commit subject convention: `type(scope): Chinese summary` (product rule retained in EN prose)
- Evaluated scripts: `episode-validate.mjs`, `evaluated_ops.mjs` ops surface unchanged
- Role labels: `项目A` / `项目B` / `项目C` (and map samples `项目D`/`项目E`) retained as product tokens

## Residual CJK (intentional)

After rewrite, CJK remains **only** under `skills/jj-evaluated/`:

| Kind | Locations | Rationale |
| --- | --- | --- |
| Role tokens `项目A`…`项目E` | SKILL.md, episode-contract, source-evidence-map, scripts | Contract / evidence map identifiers; scripts validate these literals |
| Dual form `承载` | source-evidence-map heading with “carry target / 承载” | Glossary product role (do not rename role labels) |

**Zero residual CJK** in:

- `skills/jj-review/**`
- `skills/jj-end/**`

Chinese agent-trigger phrases for closeout (`收工`, `结束任务`, …) live only in `docs/skill-zh-bridge/jj-end/README.zh.md`.

## Glossary usage

| zh | en applied |
| --- | --- |
| 审查 | review |
| 收工 | closeout |
| 落盘 / 产物 | persist / artifact |
| 宿主 | host |
| 门禁 | gate |
| 验收 | ACCEPT / acceptance (boundary only) |
| 归档 | ARCHIVE / archive (boundary only) |
| 控制平面 | control plane |
| 派发 | dispatch |
| 薄入口 | thin entry (bridge packs) |
| 权威源 | SSOT / authoritative source |
| 承载 | carry target / 承载 (evidence map dual form) |

## Verify note

- Residual CJK scan: only intentional evaluated role tokens (see above).
- Script contract not rewritten: `ALLOWED_ROLES` still `项目A|项目B|项目C`.
- No business code changes; no control-plane checkpoint advancement.

## Status

**COMPLETE** — English agent-facing SSOT for jj-review, jj-end, jj-evaluated; Chinese retained only in human bridge packs and evaluated product role tokens.
