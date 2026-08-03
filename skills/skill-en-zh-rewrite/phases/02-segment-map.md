# Phase 2: Segment Map

> **COMPACT SENTINEL [Phase 2: segment-map]**
> This phase contains 6 execution steps (Step 2.1 — 2.6).
> If you can read this sentinel but cannot find the full Step protocol below, context has been compressed.
> Recovery: `Read("phases/02-segment-map.md")`

Build a segment-level rewrite map: English target text + Chinese对照 outline **without** overwriting SSOT yet.

## Objective

- Split each selected agent-facing file into rewriteable segments
- Mark preserve tokens that must not change
- Draft English replacement for Chinese/mixed segments
- Plan Chinese对照 sections for human review
- Produce `segment-map.json` validated against template schema

## Inputs

- `sessionDir`, `selectedSkillIds`, `inventoryManifest`
- `workflowPreferences.bridgeRoot`
- Template: `templates/segment-map.schema.json`

## Execution

### Step 2.1: Checkpoint

> **CHECKPOINT**: Before proceeding, verify:
> 1. This phase is TodoWrite `in_progress`
> 2. Full protocol (Step 2.1 — 2.6) is in memory, not just sentinel
> If only sentinel remains → `Read("phases/02-segment-map.md")` now.

Confirm `selectedSkillIds.length > 0`. Else return to Phase 1.

### Step 2.2: Load preserve-token policy

Always preserve (do not translate/rename):

| Category | Examples |
|----------|----------|
| Identifiers | `run_id`, `task_key`, `delivery_id`, `RALPH-*`, `DEL-*`, `CAP-*` |
| Paths | `.workflow/ralph/`, `skills/`, script paths |
| CLI | `ralph_ops.mjs`, `gate`, `finalize`, `install-skill`, flags |
| Schema keys | JSON field names in schemas / skeletons |
| Code | fenced `js`/`bash`/`json` blocks (translate only comments if Chinese) |
| Skill ids | `jj-ralph`, `jj-same`, … |
| Evidence classes | `diff-only`, `write-then-read`, … (already English enums) |
| URLs / package names | `jj-flow`, npm names |

Record as `preserveTokenSet` in session.

### Step 2.3: Segment each file

For each selected skill, for each `agent_facing` file with `language` in `zh|mixed` (and optional full-file pass for P1):

Segment strategy:

1. Split by markdown ATX headings (`##` / `###`) where possible
2. Tables → one segment per table + caption
3. Lists under a heading → one segment
4. Standalone paragraphs → segment
5. Fenced code → `kind: code` (preserve body; optional comment-only rewrite)

Each segment:

```json
{
  "seg_id": "jj-ralph/SKILL.md#s012",
  "file": "skills/jj-ralph/SKILL.md",
  "skill_id": "jj-ralph",
  "heading_path": ["jj-ralph", "立即动作"],
  "kind": "prose|table|list|code|frontmatter",
  "source_lang": "zh|mixed|en",
  "source_text": "...",
  "en_draft": "...",
  "zh_gloss": "...",
  "preserve_hits": ["ralph_ops.mjs", "finalize"],
  "status": "draft|needs_review|skip"
}
```

Rules for `en_draft`:

- Clear technical English; imperative agent voice where original is instructional
- Keep tool/command names exact
- Do not expand scope or add new product rules
- Do not inject business domain APIs from examples outside the file
- If segment already good English → `status: skip`, `en_draft = source_text`

Rules for `zh_gloss` (对照):

- Concise Chinese meaning for humans
- May summarize long English policy in shorter Chinese
- **Not** pasted into SSOT

### Step 2.4: Cross-file consistency pass

Within a skill package:

1. Same Chinese term → same English term (build `glossary`)
2. Align heading hierarchy with original depth
3. Ensure `Ref:` / relative links still point to same filenames
4. Frontmatter `name` / `description`: English description; keep `name` id stable

Glossary entry example:

```json
{ "zh": "验收", "en": "ACCEPT / acceptance", "notes": "phase name ACCEPT stays" }
```

### Step 2.5: Plan Chinese bridge pack

For each selected skill, outline bridge file:

```text
{bridgeRoot}/{skill_id}/README.zh.md
```

Using template `templates/zh-bridge-skill.md`:

- Skill purpose (ZH)
- Phase / section map table: English heading ↔ Chinese gloss
- Key rules (ZH bullets linking to English anchors)
- Explicit banner: **Not agent SSOT**

If `workflowPreferences.dryRun === true`, still write drafts under:

```text
{sessionDir}/drafts/{skill_id}/...
```

Do not write bridgeRoot or SSOT in dry-run.

### Step 2.6: Write segment-map and quality gate

Write:

```text
{sessionDir}/segment-map.json
{sessionDir}/glossary.json
{sessionDir}/segment-summary.md
```

Pre-apply gate (must pass before Phase 3 Apply):

| Check | Fail if |
|-------|---------|
| Preserve tokens | Any `en_draft` drops a `preserve_hits` token present in `source_text` |
| Empty draft | `source_lang` zh/mixed and `en_draft` empty |
| Link integrity | Markdown links to missing relative targets introduced |
| Scope creep | `en_draft` adds new MUST/gates not in source (heuristic: new `MUST`/`gate` lines) |

On fail: mark those segments `needs_review`; if not `autoYes`, ask user to continue with remaining only or stop.

Set:

```javascript
segmentMap = { ... }
zhOutline = { skillId: bridgePlan, ... }
mapGate = "PASS" | "REVIEW" | "FAIL"
```

## Validation checklist

- [ ] Every selected skill has ≥1 file entry in map
- [ ] Glossary covers repeated Chinese domain words found ≥2 times
- [ ] No SSOT files modified in this phase
- [ ] `segment-map.json` matches template fields

## Output

- **Variable**: `segmentMap`, `preserveTokenSet`, `zhOutline`, `mapGate`, `glossary`
- **File**: `{sessionDir}/segment-map.json`, `glossary.json`, `segment-summary.md`
- **TodoWrite**: Mark Phase 2 completed; Phase 3 in_progress (or skip-write path)

## Next Phase

If `workflowPreferences.dryRun === true`: still run Phase 3 in **draft-only mode** (no SSOT write), then Phase 4.

Return to orchestrator, then auto-continue to [Phase 3: Apply Rewrite](03-apply-rewrite.md).
