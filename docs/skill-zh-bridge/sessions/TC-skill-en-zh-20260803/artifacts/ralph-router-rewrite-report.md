# ralph-router rewrite report

- **Worker:** en-writer-ralph-router  
- **Session:** TC-skill-en-zh-20260803  
- **Date:** 2026-08-03  
- **Mode:** apply (English SSOT in place)  
- **Scope:** `skills/jj-ralph/**`, `skills/jj/**`, zh-bridge packs for both  

## Outcome

| Area | Status |
| --- | --- |
| `skills/jj-ralph/` EN SSOT | **PASS** |
| `skills/jj/` EN SSOT | **PASS** |
| Protocol tokens preserved | **PASS** |
| No new gates | **PASS** |
| product-consistency meaning | **PASS** (unchanged) |
| zh-bridge section maps | **PASS** |
| Residual instructional CJK | **PASS** (none; user-utterance examples only) |

## Written (SSOT)

| Path | Action | Notes |
| --- | --- | --- |
| `skills/jj-ralph/SKILL.md` | full rewrite EN | description + body; user speech examples kept |
| `skills/jj-ralph/references/phases.md` | full rewrite EN | phase table, intensity, gate, product-consistency |
| `skills/jj-ralph/references/post-complete-continue.md` | full rewrite EN | resume/abandon/anti-patterns |
| `skills/jj-ralph/references/tiny-example.md` | full rewrite EN | sample artifact bodies EN |
| `skills/jj-ralph/references/artifact-layout.md` | full rewrite EN | layout tree comments EN |
| `skills/jj-ralph/references/business-map.md` | full rewrite EN | CAP map |
| `skills/jj-ralph/references/rollback.md` | full rewrite EN | adjacent edges |
| `skills/jj-ralph/references/integrations.md` | full rewrite EN | same/dispatch identity |
| `skills/jj-ralph/references/must-evidence.md` | keep (already EN) | consistency only; no content change |
| `skills/jj-ralph/references/run.skeleton.json` | placeholder EN | title/goal samples |
| `skills/jj-ralph/references/capability.skeleton.json` | placeholder EN | title/summary/keywords/lessons |
| `skills/jj-ralph/agents/openai.yaml` | EN short_description / prompt | |
| `skills/jj/SKILL.md` | full rewrite EN | router priority preserved |
| `skills/jj/agents/openai.yaml` | EN short_description | |

Schemas (`*.schema.json`) and script sources under `scripts/` were out of prose scope (field names already English).

## Bridge packs

| Path | skill_id |
| --- | --- |
| `docs/skill-zh-bridge/jj-ralph/README.zh.md` | jj-ralph |
| `docs/skill-zh-bridge/jj/README.zh.md` | jj |

Both packs now include EN↔ZH section maps, phase/intensity gloss tables, key-rule summaries, and session revision row for TC-skill-en-zh-20260803.

## Preserve-token checklist

| Token class | Result |
| --- | --- |
| Phases `ANALYZE`/`PLAN`/`DELIVER`/`ACCEPT`/`ARCHIVE` | preserved |
| Intensity `tiny`/`standard`/`strict` | preserved |
| `evidence_class` enums | preserved |
| `ralph_ops.mjs` subcommands (`init`, `gate`, `finalize`, `resume`, `abandon`, `deliver-attempt`, `accept-layer`, `knowledge-contribute`, …) | preserved |
| Status enums `IN_PROGRESS`/`COMPLETED`/`ABANDONED`/… | preserved |
| product-consistency rules (deliver ledger, review NEEDS_CHANGES, path sets, commit-scoped archive review) | preserved meaning |
| Skill ids / host slash matrix for `jj` | preserved |
| Paths `.workflow/ralph/`, `run.handoff`, `business-map.json` | preserved |

## Residual CJK (intentional)

Only **user-utterance recognition examples** remain Chinese (plus bilingual gloss where useful). Instructional prose is English.

| File | Why kept |
| --- | --- |
| `skills/jj-ralph/SKILL.md` | Examples: tip/login/handoff/abandon speech; trigger phrases 「投喂知识库」「交接到 …」 |
| `skills/jj-ralph/references/post-complete-continue.md` | Continue/abandon speech signals + knowledge-feed phrases |
| `skills/jj-ralph/references/integrations.md` | Handoff speech 「交接到 项目B …」 |

`skills/jj/**` has **zero** CJK after rewrite.

## Glossary usage

Applied from `artifacts/glossary.json` where relevant:

| zh | en used |
| --- | --- |
| 交接 | handoff |
| 验收 | ACCEPT / acceptance |
| 归档 | ARCHIVE / archive |
| 需求分析 / 计划实施 / 实施验证 | ANALYZE / PLAN / DELIVER |
| 能力地图 | business-map / capability map |
| 续作 | continue / resume same run |
| 废弃 | abandon |
| 门禁 | gate |
| 产物 | artifact |
| 控制平面 | control plane |
| 派发 | dispatch |
| 收工 | closeout (jj-end) |
| 薄入口 | thin entry |
| 权威源 | SSOT |

## Notes / non-goals

- Did **not** edit `docs/commands/jj-ralph.md` (user-facing Chinese docs outside skill SSOT scope for this worker).
- Did **not** invent new gates or change product-consistency mechanics.
- Completion-report language guidance: was “中文、短” → now short English fields; user-facing command docs may still be Chinese.
- Host install trees (`~/.codex/skills` etc.) not edited; SSOT remains top-level `skills/`.

## Verify command (local)

```text
rg -n "[\p{Han}]" skills/jj-ralph skills/jj --glob "*.{md,yaml,yml,json}"
```

Expected: only intentional user-utterance lines under jj-ralph; none under jj.
