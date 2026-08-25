---
name: jj-ralph
description: "Single-repo requirement loop ANALYZE→PLAN→DELIVER→ACCEPT→ARCHIVE; artifacts under .workflow/ralph/RALPH-*/ + business-map; handoff in run.handoff. Same requirement → same run_id (resume after archive; abandon mid-flight recoverable). Triggers: $jj-ralph, /jj-ralph, 单仓闭环, resume, abandon, archive, tiny, strict, 投喂知识库. Cross-repo → jj-same; multi-project → jj-dispatch. Mechanical: ralph_ops.mjs."
---

# jj-ralph

Single repo: requirement → acceptance → archive. Durable state is written only under `.workflow/ralph/` and Git.

**Continue / resume:** same requirement → same `run_id`. Archive = snapshot + map merge, **not** discard; further edits use `resume`. Mid-flight stop → `abandon` (can `resume` later). New run **only** for a truly new requirement. `$jj-end` is Git-only.

**Users do not lead with run ids.** Real speech is like “nudge the tip a bit”, “change that one again”, “drop this for now”. You resolve/write `RALPH-…` in reports; **never** require the user to memorize a run_id first.

### Entry decision (route first)

```text
Same requirement (incl. COMPLETED/ABANDONED)? → resume
No matching run? → init
Mid-flight drop / product cut? → abandon (no map)
Truly new requirement only? → init new run_id
Cross-repo port? → handoff; if ready → $jj-same
Multi-project schedule? → $jj-dispatch (not this skill)
Git closeout only? → $jj-end (orthogonal to run status)
```

## Immediate actions

1. **Locate run (natural language first):**
   - User named `RALPH-…` → use that id (uncommon)
   - Else: session-linked run / latest `updated_at` / title·goal·scope semantic match (include COMPLETED/ABANDONED)
   - **Same requirement → `resume`/continue; never default to init**; `init` only when nothing matches
   - 🔴 **CHECKPOINT:** multiple candidates and no safe inference → list candidate titles in one sentence (run_id optional) for the user to pick — do not make them type the id from memory
   - Naming and map: `jj doctor` / `JJ_GLOBAL_CONFIG_DIR` or `DAJI_CONFIG_DIR` → `naming.json` + project map
   - 🔴 **CHECKPOINT · hard-stop:** missing naming/map config → stop and report how to set `JJ_GLOBAL_CONFIG_DIR` / `DAJI_CONFIG_DIR`; **do not invent** host-local paths
2. **intensity** (user speech first): single-point / `tiny` → `tiny`; auth·protocol / `strict` / review-before-archive → `strict`; else `standard`.
3. `map-find`; for single-point work read [tiny-example.md](references/tiny-example.md) first.
4. Phases [phases.md](references/phases.md): ANALYZE → PLAN → DELIVER → ACCEPT → ARCHIVE. **Default mechanical advance: `gate`** (`--no-advance` only flips the gate).
   - MUST/ACCEPT evidence shape: [must-evidence.md](references/must-evidence.md) (`evidence_class`; ban write-then-read false green via static diff only)
   - After every DELIVER verify: `deliver-attempt`
   - **strict** before accept: `accept-layer --layer judgment --status PASS --mode review|recheck`
   - 🔴 **CHECKPOINT (strict):** judgment layer not PASS → do not `gate accept PASS` / `finalize`; fix review or ask user
   - Once target files are known, go DELIVER; do not re-walk the tree for completeness theater
   - Task/approach/MUST change (incl. resume after archive): move live plan/acceptance/analyze **Current** → Landed or Superseded, then write new Current. If `plan.md` still has `## Tasks` and no `## Current`, that Tasks block is Current — rename it first, do not replace in place. Shape: [artifact-layout.md](references/artifact-layout.md)
5. After accept PASS, default `finalize` (L1 map-merge + archive + write `knowledge-contribution.json`). Process STAGNATION goes into `process_lessons`; durable lessons only with explicit `--lessons`.
6. Completion report (short): local CAP id, contribution package path, hook status.
7. User says **「投喂知识库 / 补充全局知识」** or “feed knowledge base / contribute global knowledge” → `knowledge-contribute --hook` (candidate only; config below).
8. 🔴 **CHECKPOINT (irreversible):** push / merge / release / delete data → prepare only (`commit-prep` / report); **do not execute** until the user explicitly asks.

### Step I/O

| Step | In | Out (durable) |
| --- | --- | --- |
| 1 Locate | user speech + `.workflow/ralph/*` | chosen `run_id` or “none → init” |
| 2 intensity | user speech | `tiny` \| `standard` \| `strict` on run |
| 3 map-find | title/goal/keywords | CAP hits (may be empty) |
| 4 phases | code + verify | phase arts + `deliver-attempt` + `gates.*` |
| 5 finalize | accept PASS | archive snapshot + map merge + `knowledge-contribution.json` |
| 6 report | run + CAP paths | short completion report |

### Happy path (default command chain)

```text
map-find → init | resume
→ short analyze/plan (tiny: see tiny-example) → edit files
→ deliver-attempt → gate deliver PASS → gate accept PASS
→ finalize → completion report
# strict only: accept-layer judgment PASS before gate accept
# stop only at 🔴 CHECKPOINT or failure table
```

After a phase PASS, auto-advance to the next phase by default; do not ask “continue?”. Only stop at 🔴 CHECKPOINTs or the failure table below.

## Failure modes (if X → first fix → still fails)

| Trigger | First fix | Still fails |
| --- | --- | --- |
| Missing `naming.json` / project map | 🔴 hard-stop; tell user to set `JJ_GLOBAL_CONFIG_DIR` or `DAJI_CONFIG_DIR` and run `jj doctor` | Do not invent paths; do not init a run |
| Script resolve fails (`ralph_ops.mjs` not found) | Try: repo skill scripts → `$CODEX_HOME/skills/jj-ralph/scripts/` → `jj ralph <cmd>` | Report resolve chain; stop mechanical steps |
| Same tool/strategy fails twice / `STAGNATION` | Change approach; `deliver-attempt --improved false`; record signal | `set-status BLOCKED` + ask user; no third identical attempt |
| `gate` / product-consistency reject | Fix evidence / paths / review; or `gate --status FAIL` + progress log | Adjacent `rollback-phase` only; no force on conversational path |
| `finalize` / archive reject | Fix accept gates, paths, or review scope; re-`gate accept` | Report blockers; no conversational `--force` |
| `map-find` empty | Continue with scope from user speech + repo search | Do not block init/resume solely because map is empty |
| Verify FAIL under `max_iterations` | Stay DELIVER; rework; append progress | On ceiling: `intervention_needed.kind=MAX_ITERATIONS`; stop and report |
| Uncommitted dirty would overwrite user edits | 🔴 stop; show status; ask how to proceed | Do not clobber; no silent stash/reset |
| User wants cross-repo port with uncommitted work | `handoff` → `ready=false`; list blockers | Do not call `$jj-same` as if ready |
| `close` spoken | Map to `abandon` (drop) or `finalize` (archive) | Never invent a `close` command |
| User changes approach / MUST / plan (mid-run or after archive) | If plan has `## Tasks` and no `## Current`, rename Tasks→Current first; then move Current → Landed or Superseded; write new Current; append `progress.md` (`failed_must` / `over_claimed` if a claim is retracted) | Do not replace `## Tasks` in place; do not wipe plan/acceptance to only this loop ([artifact-layout.md](references/artifact-layout.md)) |

Full gate rules and intensity budgets: [phases.md](references/phases.md). Rollback edges: [rollback.md](references/rollback.md).

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

## 反例黑名单（不要做什么）

| # | Do not | Do instead |
| --- | --- | --- |
| 1 | Default `init` because status is COMPLETED/ABANDONED/archived | Same requirement → `resume` |
| 2 | Require the user to memorize/type `run_id` first | Resolve from speech; report id yourself |
| 3 | Invent host-local config paths when map/naming missing | 🔴 hard-stop + `jj doctor` guidance |
| 4 | Commit / push / review / handoff / dispatch / merge unless asked | Prep only (`commit-prep`); wait for user |
| 5 | PASS write-then-read / cross-path MUST on static diff alone | Match `evidence_class`; see [must-evidence.md](references/must-evidence.md) |
| 6 | Third identical failed tool/strategy attempt | Change approach or 🔴 ask user (STAGNATION) |
| 7 | Run business ralph inside the control project | Business repo only; `DEL-*` ≠ `RALPH-*` |
| 8 | Unrelated refactors; long analyze/plan for single-point work | Short MUST + file list; use `tiny` for single-point |
| 9 | Auto-promote knowledge hook results to active KB | Candidate package only; fail-open |
| 10 | `git revert` / force gate on conversational path by default | Suggest revert; no `--force` unless user overrides |
| 11 | Treat chat/memory as checkpoint advance | Only `run.json` + artifacts + Git evidence |
| 12 | Call `$jj-same` when handoff `ready=false` as if portable | Fix blockers or report `blocked_reasons` |
| 13 | Treat `$jj-end` as ralph archive / phase advance | `$jj-end` is Git-only; archive via `finalize` |
| 14 | Silently replace live `plan.md` / `acceptance.md` / `analyze.md` so prior Current text is gone (incl. replacing `## Tasks` in place) | If no `## Current`, rename `## Tasks`→Current first; then move Current → Landed/Superseded. Unarchived revisions stay in the live files |

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
