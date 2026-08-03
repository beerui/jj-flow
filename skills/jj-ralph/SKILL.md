---
name: jj-ralph
description: "Single-repo requirement loop ANALYZE→PLAN→DELIVER→ACCEPT→ARCHIVE; artifacts under .workflow/ralph/RALPH-*/ + business-map; handoff lives in run.handoff. Same requirement always prefers the same run_id (resume after archive; abandon mid-flight is recoverable). Cross-repo → jj-same; multi-project schedule → jj-dispatch. Mechanical steps: ralph_ops.mjs."
---

# jj-ralph

Single repo: requirement → acceptance → archive. Durable state is written only under `.workflow/ralph/` and Git.

**Continue / resume:** same requirement → same `run_id`. Archive = snapshot + map merge, **not** discard; further edits use `resume`. Mid-flight stop → `abandon` (can `resume` later). New run **only** for a truly new requirement. `$jj-end` is Git-only.

**Users do not lead with run ids.** Real speech is like “nudge the tip a bit”, “change that one again”, “drop this for now”. You resolve/write `RALPH-…` in reports; **never** require the user to memorize a run_id first.

## Immediate actions

1. **Locate run (natural language first):**
   - User named `RALPH-…` → use that id (uncommon)
   - Else: session-linked run / latest `updated_at` / title·goal·scope semantic match (include COMPLETED/ABANDONED)
   - **Same requirement → `resume`/continue; never default to init**; `init` only when nothing matches
   - Multiple candidates and no safe inference → list candidate titles in one sentence (run_id optional) for the user to pick — do not make them type the id from memory
   Naming and map: `jj doctor` / `JJ_GLOBAL_CONFIG_DIR` or `DAJI_CONFIG_DIR` → `naming.json` + project map; missing config is hard-stop — **do not invent** host-local paths.
2. **intensity** (user speech first): single-point / `tiny` → `tiny`; auth·protocol / `strict` / review-before-archive → `strict`; else `standard`.
3. `map-find`; for single-point work read [tiny-example.md](references/tiny-example.md) first.
4. Phases [phases.md](references/phases.md): ANALYZE → PLAN → DELIVER → ACCEPT → ARCHIVE. Prefer `gate`.
   - MUST/ACCEPT evidence shape: [must-evidence.md](references/must-evidence.md) (`evidence_class`; ban write-then-read false green via static diff only)
   - After every DELIVER verify: `deliver-attempt`
   - **strict** before accept: `accept-layer --layer judgment --status PASS --mode review|recheck`
5. After accept PASS, default `finalize` (L1 map-merge + archive + write `knowledge-contribution.json`). Process STAGNATION goes into `process_lessons`; durable lessons only with explicit `--lessons`.
6. Completion report (short): local CAP id, contribution package path, hook status.
7. User says **「投喂知识库 / 补充全局知识」** or “feed knowledge base / contribute global knowledge” → `knowledge-contribute --hook` (candidate only; config below).

## Handoff

Source of truth: `run.handoff` (not a second workflow).

- Multi-host / existing handoff / user wants port: accept/finalize may maintain automatically
- Manual: `ralph_ops.mjs handoff --run-id … --targets ProjectB,ProjectD`
- Fields: `ready` / `blocked_reasons` / `source_head` / `must` / `do_not_port` / `targets` / `mode`
- Uncommitted: `ready=false`; user only says 「交接到 项目B 项目C」 / “hand off to ProjectB ProjectC” → `$jj-same`

## Scripts

```bash
node <resolved>/ralph_ops.mjs init --run-id RALPH-x --title "..." --goal "..." [--intensity tiny|standard|strict]
node <resolved>/ralph_ops.mjs deliver-attempt --run-id RALPH-x --improved true|false
node <resolved>/ralph_ops.mjs accept-layer --run-id RALPH-x --layer judgment --status PASS --mode review
node <resolved>/ralph_ops.mjs gate --run-id RALPH-x --gate accept --status PASS
node <resolved>/ralph_ops.mjs finalize --run-id RALPH-x --modules src/a.js --keywords a,b --lessons "durable rule"
node <resolved>/ralph_ops.mjs knowledge-contribute --run-id RALPH-x [--hook]
node <resolved>/ralph_ops.mjs resume --run-id RALPH-x --reason "…"
node <resolved>/ralph_ops.mjs abandon --run-id RALPH-x --reason "…"
node <resolved>/ralph_ops.mjs rollback-phase --run-id RALPH-x --to DELIVER --reason "…"
node <resolved>/ralph_ops.mjs set-status --run-id RALPH-x --status PAUSED --reason "…"
node <resolved>/ralph_ops.mjs handoff --run-id RALPH-x --targets ProjectB,ProjectD
node <resolved>/ralph_ops.mjs commit-prep --run-id RALPH-x
```

Resolve: repo skill scripts → `$CODEX_HOME/skills/jj-ralph/scripts/` → `jj ralph`.  
Details: [phases.md](references/phases.md), [rollback.md](references/rollback.md), [post-complete-continue.md](references/post-complete-continue.md).

## Rollback & continue (summary)

| Intent | Action |
| --- | --- |
| Flip a gate | `gate --status FAIL` |
| Phase rollback | Adjacent edges only via `rollback-phase` (includes ARCHIVE→ACCEPT) |
| Pause / block | `set-status PAUSED\|BLOCKED` |
| Work after archive | Same run `resume` → edit → re-verify → may `finalize` again |
| Drop mid-flight | `abandon` (no map; can `resume`) |
| Truly new requirement | Only then `init` a new run |
| Git closeout | `$jj-end` |

`close` is deprecated → use `abandon` or `finalize`. Do not git-revert by default.

### Knowledge contribute (L2)

| Step | Action |
| --- | --- |
| After archive | `knowledge-contribution.json` already present (finalize writes it) |
| User speech | 「投喂知识库」「补充全局知识」 / “feed knowledge base” |
| Mechanical | `ralph_ops knowledge-contribute --run-id …` or add `--hook` to call extract |
| Config | `naming.json` → `ralph.knowledge_contribute`: `hook: none\|cli`, `cli` template includes `{package}`; or env `RALPH_KNOWLEDGE_HOOK` / `RALPH_KNOWLEDGE_HOOK_CMD` |
| Default | Hook is **fail-open**; **no** auto-promote to active |

## Hard constraints

- No unrelated refactors; single-point analyze/plan should stay short
- Same tool/strategy fails at most twice; on STAGNATION change approach or ask the user
- Do not commit/push/review/handoff/dispatch unless asked
- Do not run business ralph in the control project; `DEL-*` ≠ `RALPH-*`
- Never force a new run just because status is archived / `COMPLETED`

## Completion report

- `run_id` / phase / status / intensity
- Acceptance outcome; if just archived, note same-run continue is still allowed
- Handoff: `ready` + “hand off to …”
- Blockers (including STAGNATION / MAX_ITERATIONS)

## Examples (user speech; agent resolves the run)

```text
$jj-ralph 先改项目A：登录后密码过期提示
$jj-ralph tiny：tip bottom 4px→6px
$jj-ralph tip 应是 6px 不是 8px
$jj-ralph close 也跟着下移
$jj-ralph 这个先不做了，产品砍了
$jj-ralph 登录提醒还要，文案改一下
$jj-ralph 交接到 项目B 项目C
```

See [integrations.md](references/integrations.md), [artifact-layout.md](references/artifact-layout.md); user-facing [docs/commands/jj-ralph.md](../../../docs/commands/jj-ralph.md).
