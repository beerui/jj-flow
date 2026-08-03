# Phase 1: Scope & Inventory

> **COMPACT SENTINEL [Phase 1: scope-inventory]**
> This phase contains 5 execution steps (Step 1.1 — 1.5).
> If you can read this sentinel but cannot find the full Step protocol below, context has been compressed.
> Recovery: `Read("phases/01-scope-inventory.md")`

Discover skill packages under SSOT, classify language mix, and select rewrite targets.

## Objective

- Resolve `ssotRoot` and `skill-inventory.json`
- Enumerate skill packages and agent-facing files
- Classify each file as `en` | `zh` | `mixed` | `code-only`
- Produce `selectedSkillIds` and `languageReport`
- Do **not** rewrite content in this phase

## Inputs

- `workflowPreferences` from orchestrator
- Optional user SCOPE (skill id list)

## Execution

### Step 1.1: Resolve roots

```text
repoRoot     = process.cwd() (jj-flow root expected)
ssotRoot     = workflowPreferences.ssotRoot || "skills"
inventoryPath= workflowPreferences.inventoryPath || "skill-inventory.json"
sessionId    = "SEZ-" + YYYYMMDD + "-" + shortRandom
# In jj-flow repo, prefer docs/skill-zh-bridge/sessions/ (top-level .workflow is harness-forbidden).
# In business repos, .workflow/skill-en-zh-rewrite/ is fine.
sessionDir   = workflowPreferences.sessionRoot
               || (repoHasHarnessForbiddenWorkflow ? "docs/skill-zh-bridge/sessions/" : ".workflow/skill-en-zh-rewrite/")
               + sessionId
bridgeRoot   = workflowPreferences.bridgeRoot
```

Create `sessionDir`. Write `preferences.json` snapshot of `workflowPreferences`.

Hard-stop if `ssotRoot` does not exist.

### Step 1.2: Load inventory (if present)

If `inventoryPath` exists:

1. Parse `skills[].id`
2. Mark each id `in_inventory: true`
3. Note platforms and claude_command for later install notes

If missing and `scopeMode === all`:

- Warn and fall back to directory listing under `ssotRoot`

Directory scan:

```text
For each child of ssotRoot that contains SKILL.md:
  skillId = directory name
  files = recursive list of .md / .json / .mjs / .yaml under skill (exclude node_modules)
```

### Step 1.3: Classify language per file

For each agent-facing file (priority order):

1. `SKILL.md`
2. `references/**/*.md`
3. `phases/**/*.md` (if any)
4. Other `.md` under skill root

**Skip rewrite classification for** (still inventory, mark `code-only`):

- `scripts/**`
- `**/*.schema.json`
- `**/*.skeleton.json`
- pure machine YAML for agents (`agents/openai.yaml`) unless it embeds Chinese prose

Classification heuristic (deterministic, good enough for ranking):

```javascript
function classifyProse(text) {
  const sample = text.slice(0, 20000);
  const han = (sample.match(/[\u4e00-\u9fff]/g) || []).length;
  const latin = (sample.match(/[A-Za-z]/g) || []).length;
  if (han === 0) return latin > 0 ? "en" : "code-only";
  if (han > 0 && latin === 0) return "zh";
  // mixed if significant Chinese in headings/body
  if (han >= 20) return "mixed";
  return "en"; // incidental CJK tokens only
}
```

Record per file:

```json
{
  "path": "skills/jj-ralph/SKILL.md",
  "skill_id": "jj-ralph",
  "kind": "skill-md",
  "language": "mixed",
  "han_chars": 1200,
  "bytes": 4096,
  "agent_facing": true
}
```

### Step 1.4: Select targets

Build skill rollup:

| Priority | Rule |
|----------|------|
| P0 | `language` in `zh` or `mixed` on `SKILL.md` or any `references/*.md` |
| P1 | Only incidental Chinese in examples |
| P2 | Already `en` — optional polish only |

Selection by `workflowPreferences.scopeMode`:

| Mode | Action |
|------|--------|
| Inventory first | Rank P0 first; if `autoYes`, select all P0; else AskUserQuestion multi-select of skill ids |
| Single skill | Use user-provided id; error if missing |
| All product skills | Intersection of inventory ids and existing dirs |

**Do not select** by default:

- This skill itself (`skill-en-zh-rewrite`) unless user forces
- Install outputs under `.grok/skills` / `.qoder/skills`

If interactive and not `autoYes`:

```javascript
AskUserQuestion({
  questions: [{
    question: "Which skills to include in this rewrite session?",
    header: "Targets",
    multiSelect: true,
    options: p0Skills.map(id => ({
      label: id,
      description: languageSummary[id]
    }))
  }]
});
```

### Step 1.5: Write inventory artifacts

Write:

```text
{sessionDir}/inventory.json
{sessionDir}/language-report.md
```

`language-report.md` structure (English file name; **table headers English**; optional Chinese notes only in a `## Human notes` section at bottom — keep body English for tooling):

```markdown
# Language report — {sessionId}

| skill_id | p0_files | mixed | zh | en | selected |
|----------|----------|-------|----|----|----------|
| jj-ralph | 5 | 4 | 0 | 2 | yes |

## Selected
- jj-ralph
- jj-same

## Excluded
- skill-en-zh-rewrite (self)
```

Also set in-memory:

```javascript
inventoryManifest = { sessionId, sessionDir, skills: [...], files: [...] }
selectedSkillIds = [...]
languageReportPath = `${sessionDir}/language-report.md`
```

## Validation checklist

- [ ] `sessionDir` exists
- [ ] Every selected skill has `SKILL.md`
- [ ] No selected path outside `ssotRoot`
- [ ] Self-skill excluded unless forced

## Output

- **Variable**: `sessionId`, `sessionDir`, `inventoryManifest`, `selectedSkillIds`
- **File**: `{sessionDir}/inventory.json`, `{sessionDir}/language-report.md`, `{sessionDir}/preferences.json`
- **TodoWrite**: Mark Phase 1 completed, Phase 2 in_progress

## Next Phase

Return to orchestrator, then auto-continue to [Phase 2: Segment Map](02-segment-map.md).
