# SAME rewrite report — TC-skill-en-zh-20260803

- **Worker**: en-writer-same
- **Date**: 2026-08-03
- **Scope**: `skills/jj-same/**` → English agent-facing SSOT
- **Bridge**: `docs/skill-zh-bridge/jj-same/README.zh.md`

## Files rewritten

| Path | Action | Notes |
| --- | --- | --- |
| `skills/jj-same/SKILL.md` | Full rewrite EN | Kept Chinese natural-language invocation examples as user-utterance samples |
| `skills/jj-same/references/happy-path.md` | Full rewrite EN | Dual gates, self-check, closeout |
| `skills/jj-same/references/workflow-core.md` | Full rewrite EN | Lifecycle, evidence, workflows 1–7 |
| `skills/jj-same/references/continuous-sync.md` | Full rewrite EN | Contracts, checkpoints, deferral |
| `skills/jj-same/references/project-family.md` | Full rewrite EN | Matrix, roles, branch derivation |
| `skills/jj-same/references/artifact-routing.md` | Full rewrite EN | Ownership + canonical routes |
| `skills/jj-same/references/handoff-snapshot.md` | Full rewrite EN | Prepare/consume/update snapshot |
| `skills/jj-same/references/silence-account-case.md` | Full rewrite EN | Case study; paths/commits preserved |
| `skills/jj-same/references/branch-purpose-preflight.md` | Partial EN polish | Already mostly EN; Chinese in G2/G5/task example localized; one user-utterance CN kept in parens |
| `skills/jj-same/agents/openai.yaml` | `short_description` → EN | Host display string |
| `skills/jj-same/scripts/README.md` | No change | Already English |

## Bridge / session artifacts

| Path | Action |
| --- | --- |
| `docs/skill-zh-bridge/jj-same/README.zh.md` | Updated EN↔ZH section map + EN SSOT status |
| `docs/skill-zh-bridge/sessions/TC-skill-en-zh-20260803/artifacts/same-rewrite-report.md` | This file |

## Protocol preservation

- Kept IDs/enums: `EXECUTION_READY`, `HANDOFF_READY`, `EXECUTE_NOW`, `DIRECT/ADAPT/EXTEND/BLOCKED/N/A`, freshness `FRESH/PARTIAL/STALE/BROKEN`, actions `REUSE/REFRESH_SOURCES/REBASELINE`, `sync_key`, `RALPH-*`, `BLP/REQ/ANL/PLN/EXC/VRF/REV`, EP ids.
- No new gates invented; dual-gate semantics unchanged.
- Paths, CLI script names, schema field names, JSON keys preserved.
- Chinese skill-step labels (e.g. historical “源/目标分析”) rendered as English step names; not skill package ids.

## Residual CJK (intentional)

Search: Han characters under `skills/jj-same/**/*.md` after rewrite.

| File | CJK-bearing lines | Reason |
| --- | --- | --- |
| `SKILL.md` | 7 | User natural-language invocation examples (`交接到…`, `$jj-same 会话=…`, `交接=@…`) |
| `references/project-family.md` | 5 | Map match-key examples (`项目A` / `项目A 管理端`) as live portfolio map names |
| `references/handoff-snapshot.md` | 3 | Quoted CN user forms: `准备交接`, `交接=@…`, `更新交接 …` |
| `references/continuous-sync.md` | 1 | Parenthetical user form `同步 <sync_key>` |
| `references/branch-purpose-preflight.md` | 1 | Parenthetical user utterance `开始迁移项目D` |
| **Total residual CJK lines (md)** | **17** | All non-instructional or quoted user/map keys |

No residual instructional Chinese prose in agent-facing body.  
Non-md: `agents/openai.yaml` short_description translated; scripts remain EN.

## Glossary application

Applied terms from `artifacts/glossary.json` (handoff, gate, artifact, control plane, dispatch, review, SSOT, etc.). Project roles rendered as Project A/B/C (+ Admin) in prose; map Chinese names retained only as map-key examples.

## Verify commands (worker)

```text
rg -n "[\u4e00-\u9fff]" skills/jj-same --glob "*.md"
```

Result: residual limited to user-utterance / map-name examples listed above.
