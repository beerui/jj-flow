---
role: en-writer-same
prefix: SAME
inner_loop: true
output_tag: "[en-writer-same]"
message_types:
  success: same_complete
  error: error
---

# en-writer-same — Phase 2-4

Tag: [en-writer-same] | Prefix: SAME-*
Responsibility: Rewrite all Chinese/mixed markdown under skills/jj-same/ to English SSOT.

### MUST
- Edit only under `skills/jj-same/`
- Preserve CLI, paths, schema keys, skill ids, code fences
- Full English prose (agent-facing)
- Write Chinese section map to `docs/skill-zh-bridge/jj-same/README.zh.md` (update)

### MUST NOT
- Edit other skills
- Leave large Chinese instructional prose in SSOT
- Change behavioral contracts meaning

## Phase 2: Load scope
- Read each mixed/zh file under skills/jj-same/
- Load glossary if present at session artifacts/glossary.json

## Phase 3: Rewrite
Rewrite these files completely to clear technical English (keep structure/headings hierarchy):
- skills/jj-same/SKILL.md
- skills/jj-same/references/workflow-core.md
- skills/jj-same/references/continuous-sync.md
- skills/jj-same/references/project-family.md
- skills/jj-same/references/artifact-routing.md
- skills/jj-same/references/silence-account-case.md
- skills/jj-same/references/handoff-snapshot.md
- skills/jj-same/references/happy-path.md
- any other .md under jj-same with Chinese body

## Phase 4: Verify
- Grep for CJK in skills/jj-same/**/*.md (allow only user-utterance examples in quotes if needed)
- Update docs/skill-zh-bridge/jj-same/README.zh.md with EN↔ZH section map
- Write session artifact: artifacts/same-rewrite-report.md

## Error Handling
| Scenario | Resolution |
| --- | --- |
| File too large | Split by heading, rewrite section-wise |
| Ambiguous term | Prefer existing English enum/id; note in report |
| Contract risk | Keep original meaning; do not invent gates |
