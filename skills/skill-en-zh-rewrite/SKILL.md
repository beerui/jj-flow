---
name: skill-en-zh-rewrite
description: >
  Rewrite project skills and skill-owned docs into English SSOT while producing
  Chinese对照 artifacts for human review (not agent runtime). Use to migrate
  mixed-language skill trees (e.g. jj-flow `skills`) without overfitting
  business domain text into protocol. Triggers on "skill-en-zh-rewrite",
  "skill english rewrite", "skill 中英文对照", "skill EN/ZH migrate",
  "rewrite skills to English with Chinese对照".
---

# Skill EN/ZH Rewrite Workflow

Migrate skill packages so **agent-facing skill content is English-only SSOT**,
while **Chinese对照** is generated as a sidecar review pack for humans.
Does not invent business APIs; preserves identifiers, paths, scripts, and
mechanical contracts.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  skill-en-zh-rewrite Orchestrator (SKILL.md)                    │
│  → Preferences → progressive phase load → validate → install    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
    ┌───────────┬───────────────┼───────────────┬───────────────┐
    ↓           ↓               ↓               ↓               │
┌─────────┐ ┌─────────┐   ┌─────────┐   ┌─────────┐            │
│ Phase 1 │ │ Phase 2 │   │ Phase 3 │   │ Phase 4 │            │
│ Scope & │ │ Segment │   │ Apply   │   │ Validate│            │
│Inventory│ │ Map     │   │ Rewrite │   │& Install│            │
└─────────┘ └─────────┘   └─────────┘   └─────────┘            │
 inventory    segment-map   EN SSOT files   gate report          │
              + draft对照    + zh-bridge/    install-skill
```

## Key Design Principles

1. **English SSOT for agents**: Anything loaded as skill runtime (`SKILL.md`,
   `references/*` used by agents, phase docs agents execute) must be English.
2. **Chinese对照 is human-only**: Write under `docs/skill-zh-bridge/` (or
   configured path). Never put full dual-language bodies into agent SSOT files.
3. **Preserve contracts**: Keep IDs, paths, CLI flags, schema fields, script
   names, gate names, and test hooks bit-stable unless a rename is explicit.
4. **Progressive loading**: Read phase files only when that phase runs (`Ref:`).
5. **jj-flow discipline**: Edit under `skills/` SSOT; after apply run
   local `install-skill --force`; do not treat `.grok/skills` as edit source.
6. **No domain overfit**: Generic translation/rewrite rules only; product-specific
   lessons stay in business repos.

## Interactive Preference Collection

Collect preferences **before** Phase 1. Pass as `workflowPreferences`.

```javascript
const prefResponse = AskUserQuestion({
  questions: [
    {
      question: "Run mode for this rewrite session?",
      header: "Mode",
      multiSelect: false,
      options: [
        { label: "Dry-run (Recommended)", description: "Map + draft only; no SSOT overwrite" },
        { label: "Apply", description: "Write English SSOT + Chinese对照" }
      ]
    },
    {
      question: "Which skill packages to process?",
      header: "Scope",
      multiSelect: false,
      options: [
        { label: "Inventory first (Recommended)", description: "Scan all, then pick in Phase 1" },
        { label: "Single skill", description: "User names one skill id" },
        { label: "All product skills", description: "skill-inventory.json skills[]" }
      ]
    },
    {
      question: "Where should Chinese对照 packs live?",
      header: "BridgeRoot",
      multiSelect: false,
      options: [
        { label: "docs/skill-zh-bridge (Recommended)", description: "Human docs tree in repo" },
        { label: ".workflow/skill-zh-bridge", description: "Local workflow artifacts" }
      ]
    },
    {
      question: "Skip confirmations after preferences?",
      header: "Auto Mode",
      multiSelect: false,
      options: [
        { label: "Interactive (Recommended)", description: "Confirm inventory selection and apply gate" },
        { label: "Auto", description: "Use recommended defaults and continue" }
      ]
    }
  ]
});

workflowPreferences = {
  dryRun: prefResponse.mode !== "Apply",
  scopeMode: prefResponse.scope, // inventory | single | all
  bridgeRoot: prefResponse.bridgeRoot.includes(".workflow")
    ? ".workflow/skill-zh-bridge"
    : "docs/skill-zh-bridge",
  autoYes: prefResponse.autoMode === "Auto",
  ssotRoot: "skills", // top-level repo SSOT; install targets remain host dirs
  inventoryPath: "skill-inventory.json"
};
```

### Auto Mode Defaults

When `workflowPreferences.autoYes === true`:

- Accept inventory ranking recommendations (mixed-language files first).
- Proceed phase-to-phase without re-asking.
- Still **block Apply** if Phase 4 structural gate fails.
- Dry-run remains default unless Mode was Apply.

## Execution Flow

> **COMPACT DIRECTIVE**: Context compression MUST check TodoWrite phase status.
> The phase marked `in_progress` keeps FULL content. Compress only `completed` /
> `pending` phase bodies.

```
Input Parsing:
   └─ GOAL / SCOPE / CONTEXT + workflowPreferences

Phase 1: Scope & Inventory
   └─ Ref: phases/01-scope-inventory.md
      ├─ Tasks: resolve SSOT → scan skills → classify language → select targets
      └─ Output: inventory.json, selectedSkillIds, languageReport

Phase 2: Segment Map
   └─ Ref: phases/02-segment-map.md
      ├─ Tasks: split files → preserve tokens → EN draft map → ZH对照 plan
      └─ Output: segment-map.json, draft rows per skill

Phase 3: Apply Rewrite
   └─ Decision (workflowPreferences.dryRun === false):
      ├─ condition met → Ref: phases/03-apply-rewrite.md
      │   ├─ Tasks: write English SSOT → write zh-bridge → diff summary
      │   └─ Output: rewritten files, bridge packs, apply-report.md
      └─ condition not met → Skip write; keep drafts; go Phase 4 with dryRun=true

Phase 4: Validate & Install
   └─ Ref: phases/04-validate-install.md
      ├─ Tasks: structure/language gate → inventory consistency → install → report
      └─ Output: validation-report.md, install result
```

**Phase Reference Documents** (read on-demand when phase executes):

| Phase | Document | Purpose | Compact |
|-------|----------|---------|---------|
| 1 | [phases/01-scope-inventory.md](phases/01-scope-inventory.md) | Inventory SSOT skills and select rewrite targets | TodoWrite-driven |
| 2 | [phases/02-segment-map.md](phases/02-segment-map.md) | Build EN rewrite map + ZH对照 plan without writing SSOT | TodoWrite-driven + sentinel |
| 3 | [phases/03-apply-rewrite.md](phases/03-apply-rewrite.md) | Apply English SSOT and Chinese bridge packs | TodoWrite-driven + sentinel |
| 4 | [phases/04-validate-install.md](phases/04-validate-install.md) | Validate language/contract gates and reinstall skills | TodoWrite-driven + sentinel |

**Compact Rules**:

1. TodoWrite `in_progress` → keep full phase protocol
2. TodoWrite `completed` → may compress to summary
3. Sentinel fallback → if only sentinel remains, `Read("phases/0N-….md")` before continuing

## Core Rules

1. **Start with preferences**, then TodoWrite, then Phase 1. Do not rewrite files first.
2. **Edit SSOT only under** `workflowPreferences.ssotRoot` (default `skills`).
3. **Never** make Chinese the agent runtime language for skill bodies after rewrite.
4. **Never** delete scripts/schemas “because they are not prose.”
5. **Preserve** code fences, JSON keys, CLI names, path strings, and test IDs.
6. **对照 is not promotion**: Chinese packs are review aids; English SSOT wins on conflict.
7. **Progressive load**: one phase file at a time via `Ref:`.
8. **Direct handoff**: inter-phase uses `Read("phases/…")`, not Skill() re-entry.
9. **jj-flow install**: after Apply, use **local repo** `node src/cli.mjs install-skill --platform all --force` (published global `jj` may lag).
10. **Do not** add this maintenance skill to product distribution unless inventory is updated intentionally.

## Input Processing

Convert free text to:

```text
GOAL: Rewrite selected skills to English SSOT + Chinese对照 for humans
SCOPE: skill ids | all inventory | single path
CONTEXT: repo root, ssotRoot=skills, bridgeRoot=docs/skill-zh-bridge
CONSTRAINTS: no business API overfit; keep mechanical contracts; dry-run unless Apply
```

Examples:

| User says | Structured |
|-----------|------------|
| 把 jj-ralph 改成英文，给我中文对照 | SCOPE=jj-ralph; Mode=Apply or Dry-run |
| 扫一遍哪些 skill 还是中文 | SCOPE=inventory; Mode=Dry-run |
| 全量改写 product skills | SCOPE=all; Mode=Apply |

## Data Flow

```
User input + workflowPreferences
    ↓
Phase 1: Scope & Inventory
    ↓ Output: inventoryManifest, selectedSkillIds, languageReport
    ↓
Phase 2: Segment Map
    ↓ Input: selectedSkillIds + inventoryManifest
    ↓ Output: segmentMap, preserveTokenSet, zhOutline
    ↓
Phase 3: Apply Rewrite  (skipped writes if dryRun)
    ↓ Input: segmentMap + dryRun flag
    ↓ Output: applyReport, bridgePackPaths, rewrittenPaths
    ↓
Phase 4: Validate & Install
    ↓ Input: applyReport | dryRun drafts
    ↓ Output: validationReport, installStatus
    ↓
Human summary (Chinese OK in chat) + artifact paths
```

## TodoWrite Pattern

**Attachment / collapse**

1. Phase starts → mark phase `in_progress`; attach sub-tasks when listed.
2. Phase ends → collapse sub-tasks; mark phase `completed`; next `in_progress`.

### Phase 1 attached

```json
[
  {"content": "Phase 1: Scope & Inventory", "status": "in_progress"},
  {"content": "  → Resolve SSOT + inventory", "status": "in_progress"},
  {"content": "  → Scan and classify language", "status": "pending"},
  {"content": "  → Select target skills/files", "status": "pending"},
  {"content": "Phase 2: Segment Map", "status": "pending"},
  {"content": "Phase 3: Apply Rewrite", "status": "pending"},
  {"content": "Phase 4: Validate & Install", "status": "pending"}
]
```

### Phase 1 collapsed

```json
[
  {"content": "Phase 1: Scope & Inventory", "status": "completed"},
  {"content": "Phase 2: Segment Map", "status": "in_progress"},
  {"content": "Phase 3: Apply Rewrite", "status": "pending"},
  {"content": "Phase 4: Validate & Install", "status": "pending"}
]
```

## Post-Phase Updates

After each phase, write session notes under:

```text
# Default session root (jj-flow repo forbids top-level .workflow/)
docs/skill-zh-bridge/sessions/{sessionId}/
  preferences.json
  inventory.json
  segment-map.json
  apply-report.md
  validation-report.md
  progress.md

# Business repos may use .workflow/skill-en-zh-rewrite/{sessionId}/ instead
```

Append one progress line:

```text
- {ISO_TIME} phase={N} status={done|blocked} dryRun={bool} skills={ids}
```

Pass only the variables listed in Data Flow into the next phase (do not reload all raw skill bodies unless needed).

## Error Handling

| Failure | Action |
|---------|--------|
| SSOT root missing | Stop; report path; do not invent skills |
| Inventory missing when Scope=all | Fall back to directory scan; warn |
| Preserve-token changed in draft | Block Apply for that file; keep dry-run artifact |
| Language gate fail after Apply | Do not install; mark gate FAIL; offer rollback via git |
| Install fails | Report; SSOT files may still be valid; do not force publish |
| Parse/map failure | Retry once; then BLOCKED with file path |

## Coordinator Checklist

**Before any phase**

- [ ] `workflowPreferences` set
- [ ] TodoWrite initialized
- [ ] Only active phase file loaded

**After each phase**

- [ ] Outputs written under session dir
- [ ] Required variables extracted
- [ ] TodoWrite collapsed / advanced
- [ ] Next phase `Read` only when starting it

**Before Apply (Phase 3)**

- [ ] `dryRun === false` explicit
- [ ] segment-map complete for selected skills
- [ ] preserve tokens listed

**Before finish**

- [ ] validation-report written
- [ ] If Apply: local install attempted or reason recorded
- [ ] Chat summary in Chinese for human; paths to EN + ZH artifacts

## Related Commands

| Need | Use |
|------|-----|
| Product skill SSOT edit | This workflow or direct edit under `skills/` |
| Install after rewrite | `node src/cli.mjs install-skill --platform all --force` |
| Inventory audit | `skill-inventory.json` + `npm run harness:check` (if available) |
| Design new workflow skills | `workflow-skill-designer` |
| Runtime ralph/same/dispatch | `$jj-ralph` / `$jj-same` / `$jj-dispatch` (unchanged) |

## Templates

- [templates/zh-bridge-skill.md](templates/zh-bridge-skill.md) — Chinese对照 pack skeleton
- [templates/segment-map.schema.json](templates/segment-map.schema.json) — segment map shape

## Non-Goals

- Translating business application UI copy in product apps
- Auto-promoting Chinese对照 into agent runtime
- Changing control-plane checkpoints via chat
- Shipping this skill on npm unless explicitly inventoried
