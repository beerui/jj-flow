# Phase 4: Validate & Install

> **COMPACT SENTINEL [Phase 4: validate-install]**
> This phase contains 6 execution steps (Step 4.1 — 4.6).
> If you can read this sentinel but cannot find the full Step protocol below, context has been compressed.
> Recovery: `Read("phases/04-validate-install.md")`

Validate language/contract gates; reinstall skills when Apply succeeded; report to human in Chinese-friendly summary with English artifact paths.

## Objective

- Verify English-SSOT language gate on rewritten files
- Verify preserve tokens and link integrity
- Run inventory / harness checks when available
- Install from **local repo** when Apply
- Produce final validation report

## Inputs

- `applyReport`, `rewrittenPaths`, `bridgePackPaths`, `blockedPaths`
- `workflowPreferences.dryRun`
- `selectedSkillIds`, `sessionDir`

## Execution

### Step 4.1: Checkpoint

> **CHECKPOINT**: Verify TodoWrite `in_progress` and full Step 4.1—4.6 protocol present.
> Else `Read("phases/04-validate-install.md")`.

### Step 4.2: Language gate

For each path in `rewrittenPaths` (SSOT or drafts):

```javascript
const lang = classifyProse(read(path)); // same heuristic as Phase 1
// Expect: en (allow code-only)
// Fail: zh or mixed with han_chars >= 20 in non-example regions
```

Allow Chinese only inside:

- Explicitly marked examples of user utterances (quote lines)
- Bridge packs (not in SSOT)

If SSOT file still `mixed`/`zh` after Apply → `languageGate = FAIL` for that file.

### Step 4.3: Contract & structure gate

Per rewritten skill:

| Check | Method |
|-------|--------|
| `SKILL.md` exists | fs |
| Frontmatter `name` unchanged | compare to inventory / pre-image if stored |
| Relative links | targets exist |
| Schema/scripts untouched unless intentional | path list vs apply report |
| No bridge content merged into SSOT | scan for banner string `不是 Agent 运行时` should be **absent** in SSOT |

Optional: if `tests/jj-*-contract.test.mjs` exists and skill contracts changed in meaning (not just language), run relevant tests — language-only rewrites usually need no test change.

### Step 4.4: Inventory consistency

If skill list or ids changed (should not in normal rewrite):

- Update `skill-inventory.json` only when user requested structural inventory change
- Default rewrite: **no** inventory id changes

Warn if inventory lists skill missing `SKILL.md`.

### Step 4.5: Install (Apply only)

**Skip** if `dryRun === true` or `languageGate === FAIL` or any `blockedPaths` for selected set.

Use **local** installer (not stale global package):

```bash
node src/cli.mjs install-skill --platform all --force
```

Verify one sample:

```text
Test-Path ~/.grok/skills/{skill_id}/SKILL.md
# optional: rg for a distinctive new English phrase
```

Record `installStatus`: `ok` | `skipped-dry-run` | `skipped-gate` | `failed`

### Step 4.6: Final report & human summary

Write `{sessionDir}/validation-report.md`:

```markdown
# Validation report — {sessionId}

Gate: PASS | REVIEW | FAIL
Mode: dry-run | apply
Install: ...

## Language
| file | class | result |

## Structure
...

## Install
...

## Artifacts
- segment-map: ...
- apply-report: ...
- bridge packs: ...
```

Quality gate:

```text
PASS   = no errors
REVIEW = warnings only (e.g. residual user-utterance Chinese)
FAIL   = language/contract errors
```

**Chat summary to user (Chinese OK):**

1. 做了什么（dry-run / apply）
2. 改了哪些 skill
3. 英文 SSOT 路径
4. 中文对照路径
5. 安装是否成功
6. 未处理 / blocked 文件
7. 建议下一步（人工审对照 → Apply → commit）

Do **not** claim control-plane or ralph checkpoints advanced.

## Validation checklist

- [ ] validation-report written
- [ ] Gate decided
- [ ] Install attempted or skip reason recorded
- [ ] User-facing summary lists both EN and ZH paths

## Output

- **Variable**: `validationReport`, `gate`, `installStatus`
- **File**: `{sessionDir}/validation-report.md`
- **TodoWrite**: Mark Phase 4 completed (workflow done)

## Next Phase

None. Workflow complete.

### Suggested human follow-ups

1. Review `{bridgeRoot}/{skill}/README.zh.md` against English SSOT
2. If dry-run looks good, re-run skill with Mode=Apply
3. Commit SSOT + bridge docs separately if desired
4. Do not promote Chinese packs into agent runtime
