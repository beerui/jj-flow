# Phase 3: Apply Rewrite

> **COMPACT SENTINEL [Phase 3: apply-rewrite]**
> This phase contains 5 execution steps (Step 3.1 — 3.5).
> If you can read this sentinel but cannot find the full Step protocol below, context has been compressed.
> Recovery: `Read("phases/03-apply-rewrite.md")`

Apply English SSOT rewrites and write Chinese对照 packs (or dry-run draft only).

## Objective

- Materialize full English file content from `segmentMap`
- Write Chinese bridge packs for humans
- Produce apply report with file-level diffs summary
- Respect `workflowPreferences.dryRun`

## Inputs

- `segmentMap`, `glossary`, `zhOutline`, `mapGate`
- `workflowPreferences.dryRun`, `bridgeRoot`, `ssotRoot`
- `sessionDir`

## Execution

### Step 3.1: Checkpoint & gate

> **CHECKPOINT**: Before proceeding, verify:
> 1. This phase is TodoWrite `in_progress`
> 2. Full protocol (Step 3.1 — 3.5) is in memory
> If only sentinel remains → `Read("phases/03-apply-rewrite.md")` now.

```text
if mapGate === "FAIL":
  stop Apply; write apply-report.md status=blocked; go Phase 4
if mapGate === "REVIEW" && !autoYes:
  AskUserQuestion proceed | only PASS segments | abort
```

### Step 3.2: Assemble English files

For each file in `segmentMap`:

1. Order segments by original offset / heading order
2. Concatenate `en_draft` (or `source_text` if `status===skip`)
3. Normalize:
   - LF line endings
   - Ensure final newline
   - Keep YAML frontmatter valid
4. Run preserve-token scan on assembled text:

```javascript
for (const token of segment.preserve_hits) {
  if (source_text.includes(token) && !assembled.includes(token)) {
    mark file blocked
  }
}
```

Blocked files are not written to SSOT; listed in report.

### Step 3.3: Write English SSOT or drafts

**If `workflowPreferences.dryRun === true`:**

```text
Write {sessionDir}/drafts/{relativePath from ssotRoot}
Do NOT modify skills/**
```

**If Apply (`dryRun === false`):**

```text
Write path under ssotRoot (in-place overwrite)
Prefer patch/strReplace for small files; full Write when majority of file changes
```

Never edit:

- `.grok/skills/**` as source
- `.qoder/skills/**` as source
- Business app source outside skills

After all writes, list `rewrittenPaths[]`.

### Step 3.4: Write Chinese对照 packs

For each skill in `selectedSkillIds`:

Target:

```text
dryRun:  {sessionDir}/bridge-draft/{skill_id}/README.zh.md
Apply:   {bridgeRoot}/{skill_id}/README.zh.md
```

Fill from `templates/zh-bridge-skill.md`:

Required sections:

1. Banner: 本文仅供人类对照，**不是** Agent 运行时 SSOT
2. English SSOT path pointer
3. 技能用途（中文）
4. 章节对照表（EN heading | ZH gloss | notes）
5. 关键规则中文摘要（指向 EN anchors，不复制整份协议）
6. 变更会话 id / date

Optional per-file对照:

```text
{bridgeRoot}/{skill_id}/files/{safe_file_stem}.zh.md
```

Only for large mixed files (e.g. long `phases.md`).

Set `bridgePackPaths[]`.

### Step 3.5: Apply report

Write `{sessionDir}/apply-report.md`:

```markdown
# Apply report — {sessionId}

- mode: dry-run | apply
- mapGate: PASS|REVIEW|FAIL
- skills: ...

## Written (SSOT or drafts)
| path | action | segments_changed | blocked |
|------|--------|------------------|---------|

## Bridge packs
| path | skill_id |

## Preserve-token failures
| file | token |

## Notes
...
```

Also `apply-report.json` machine summary:

```json
{
  "sessionId": "...",
  "dryRun": true,
  "rewrittenPaths": [],
  "bridgePackPaths": [],
  "blockedPaths": [],
  "ok": true
}
```

## Safety rules

1. One skill fully assembled before moving to next (easier rollback).
2. Do not run `git commit` in this phase.
3. Do not `npm publish`.
4. Do not advance ralph/dispatch checkpoints.
5. If user only asked 对照: ensure dry-run and bridge drafts still produced.

## Validation checklist

- [ ] Every non-blocked selected file has assembled output somewhere (SSOT or drafts)
- [ ] Bridge pack exists per selected skill
- [ ] apply-report written
- [ ] dry-run did not touch SSOT (spot-check `git status` if repo clean enough)

## Output

- **Variable**: `applyReport`, `rewrittenPaths`, `bridgePackPaths`, `blockedPaths`
- **File**: `{sessionDir}/apply-report.md`, `apply-report.json`, drafts or SSOT + bridge files
- **TodoWrite**: Mark Phase 3 completed, Phase 4 in_progress

## Next Phase

Return to orchestrator, then auto-continue to [Phase 4: Validate & Install](04-validate-install.md).
