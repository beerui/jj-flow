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
   - Naming and map: product default `~/.jj-flow` (`naming.json`, `map.md`, `knowledge/`). Missing home → `jj home init`, then continue. Map join / first-time KB bootstrap → `$jj-init`. `jj doctor` to the user = the short Chinese `user_view`. Never paste doctor JSON.
2. **intensity** (user speech first): single-point / `tiny` → `tiny`; auth·protocol / `strict` / review-before-archive → `strict`; else `standard`.
   - Optional intent lives in `task_plan.md` `## 目标` (initiator words). `tiny` skips it unless `--intent`. ANALYZE must answer intent open questions under `### 存疑事项`.
3. `map-find`; for single-point work read [tiny-example.md](references/tiny-example.md) first.
4. Phases [phases.md](references/phases.md): ANALYZE → PLAN → DELIVER → ACCEPT → ARCHIVE. **Default mechanical advance: `gate`** (`--no-advance` only flips the gate).
   - MUST/ACCEPT evidence shape: [must-evidence.md](references/must-evidence.md) (`evidence_class`; ban write-then-read false green via static diff only)
   - After every DELIVER verify: `deliver-attempt`. If `improved=false` or `rollback-phase`, the CLI may print a soft hint to record the failure with `ralph_ops.mjs finding` (does **not** block the gate). Prefill 现象/原因 from progress `failed_must` / `over_claimed`; you still write 对策 + 适用范围.
   - **strict** before accept: `accept-layer --layer judgment --status PASS --mode review|recheck`
   - 🔴 **CHECKPOINT (strict):** judgment layer not PASS → do not `gate accept PASS` / `finalize`; fix review or ask user
   - Once target files are known, go DELIVER; do not re-walk the tree for completeness theater
   - Task/approach/MUST change (incl. resume after archive): move live `task_plan.md` **### 当前** → **### 已落地** or **### 已取代**, then write new 当前. Legacy English `## Current` / `## Tasks` still extract. Shape: [artifact-layout.md](references/artifact-layout.md)
5. After accept PASS, default `finalize` (L1 map-merge + archive + hot-memory promote from `findings.md`). `knowledge-contribution.json` is **degraded** (hot layer replaced home ingest). Process STAGNATION goes into `process_lessons`; durable lessons only with explicit `--lessons`.
6. Completion report (short): local CAP id, hot-memory promote status.
7. **Idle offer (after the completion report, never during DELIVER):** archive already promoted `## 可复用结论` into `~/.jj-flow/memory/`. Ask **once** whether to also feed the opt-in portfolio KB. Write only after yes: `jj ralph knowledge-contribute --run-id … --hook` (current `project_key` only; P1b hook is skipped/degraded). User speech **「投喂知识库 / 补充全局知识」** also runs the hook. Map join / first-time KB bootstrap → `$jj-init`. Do not auto-write on finalize.
8. 🔴 **CHECKPOINT (irreversible):** push / merge / release / delete data → prepare only (`commit-prep` / report); **do not execute** until the user explicitly asks.

### Step I/O

| Step | In | Out (durable) |
| --- | --- | --- |
| 1 Locate | user speech + `.workflow/ralph/*` | chosen `run_id` or “none → init” |
| 2 intensity | user speech | `tiny` \| `standard` \| `strict` on run |
| 3 map-find | title/goal/keywords | CAP hits (may be empty). Portfolio attach uses CJK lexical retrieve (min related 5, cap 5); empty is valid — do not pad with unrelated same-project rows. Init/resume also inject up to 5 hot-memory one-liners from `~/.jj-flow/memory/<project_key>.md` into progress (`hot_memory:`); empty is valid |
| 4 phases | code + verify | phase arts + `deliver-attempt` + `gates.*` |
| 5 finalize | accept PASS | archive snapshot + map merge + hot-memory promote (`knowledge-contribution.json` degraded) |
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
| Missing `~/.jj-flow` map / naming | `jj home init`; continue | Do not invent `/portfolio` paths |
| Current repo not in global map | Continue the task unindexed | Join / bootstrap → `$jj-init` |
| Script resolve fails (`ralph_ops.mjs` not found) | Try: repo skill scripts → `$CODEX_HOME/skills/jj-ralph/scripts/` → `jj ralph <cmd>` | Report resolve chain; stop mechanical steps |
| Same tool/strategy fails twice / `STAGNATION` | Change approach; `deliver-attempt --improved false`; ralph writes `instruction-correction.md` | `set-status BLOCKED` + ask user; no third identical attempt; Reviewer does **not** write `AGENTS.md` |
| `gate` / product-consistency reject | Fix evidence / paths / review; or `gate --status FAIL` + progress log | Adjacent `rollback-phase` only; no force on conversational path |
| `finalize` / archive reject | Fix accept gates, paths, or review scope; re-`gate accept` | Report blockers; no conversational `--force` |
| `map-find` empty | Continue with scope from user speech + repo search | Do not block init/resume solely because map is empty |
| Portfolio attach empty / unrelated | Leave `knowledge_refs` empty; do not invent or dump same-project history | Do not pad to 5/12; local `map-find` is the same-repo lookup |
| Verify FAIL under `max_iterations` | Stay DELIVER; rework; append progress | On ceiling: `intervention_needed.kind=MAX_ITERATIONS`; stop and report |
| Uncommitted dirty would overwrite user edits | 🔴 stop; show status; ask how to proceed | Do not clobber; no silent stash/reset |
| User wants cross-repo port with uncommitted work | `handoff` → `ready=false`; list blockers | Do not call `$jj-same` as if ready |
| `close` spoken | Map to `abandon` (drop) or `finalize` (archive) | Never invent a `close` command |
| User changes approach / MUST / plan (mid-run or after archive) | Move `task_plan.md` `### 当前` → `### 已落地` or `### 已取代`; write new 当前; append `progress.md` (`failed_must` / `over_claimed` if a claim is retracted). Legacy `## Tasks` without Current is Current — rename first | Do not replace `## Tasks` in place; do not wipe `task_plan.md` to only this loop ([artifact-layout.md](references/artifact-layout.md)) |

Full gate rules and intensity budgets: [phases.md](references/phases.md). Rollback edges: [rollback.md](references/rollback.md).

## Handoff

Source of truth: `run.handoff` (not a second workflow).

- Multi-host / existing handoff / user wants port: accept/finalize may maintain automatically
- Manual: `ralph_ops.mjs handoff --run-id … --targets ProjectB,ProjectD`
- Fields: `ready` / `blocked_reasons` / `source_head` / `must` / `do_not_port` / `targets` / `mode`
- Uncommitted: `ready=false`; user only says 「交接到 项目B 项目C」 / “hand off to ProjectB ProjectC” → `$jj-same`

## Scripts

```bash
node <resolved>/ralph_ops.mjs init --run-id RALPH-x --title "..." --goal "..." [--intensity tiny|standard|strict] [--project KEY] [--knowledge-query Q] [--intent|--no-intent]
node <resolved>/ralph_ops.mjs deliver-attempt --run-id RALPH-x --improved true|false
node <resolved>/ralph_ops.mjs accept-layer --run-id RALPH-x --layer judgment --status PASS --mode review
node <resolved>/ralph_ops.mjs gate --run-id RALPH-x --gate accept --status PASS
node <resolved>/ralph_ops.mjs metrics --run-id RALPH-x [--persist]
node <resolved>/ralph_ops.mjs finalize --run-id RALPH-x --modules src/a.js --keywords a,b --lessons "durable rule"
node <resolved>/ralph_ops.mjs knowledge-contribute --run-id RALPH-x [--hook]
node <resolved>/ralph_ops.mjs finding --run-id RALPH-x --action "…" --scope "…" [--phenomenon "…"] [--cause "…"] [--rule "…"]
node <resolved>/ralph_ops.mjs knowledge-confirm --needle "…" [--project KEY]
node <resolved>/ralph_ops.mjs knowledge-prune [--project KEY]
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
| After archive | Hot memory already promoted from `findings.md`; `knowledge-contribution.json` is not written (P1b degraded) |
| Lesson gate | Durable lessons pass Gate B **and** future-reuse: 换一张卡还得遵守才收录. Human-locked keep/drop: `tests/fixtures/extract-future-reuse.golden.json`. Process narration / 仅本次 / task restatement / this-change nits / field-howto memos without 必须/不要/勿/协议 → `extract_audit`. Prefer 0 over dirty. |
| User speech | 「投喂知识库」「补充全局知识」 / “feed knowledge base”; also the idle offer after archive |
| Mechanical | `ralph_ops knowledge-contribute --run-id … --hook` → built-in `~/.jj-flow/knowledge` ingest for the **current** `project_key` (`{project}` if a custom CLI is set) |
| Config | `naming.json` → `ralph.knowledge_contribute`: `hook: none\|cli`, `cli` may use `{package}` `{project}` `{run_id}`; or env `RALPH_KNOWLEDGE_HOOK` / `RALPH_KNOWLEDGE_HOOK_CMD` |
| Default | Hook is **fail-open**; **no** auto-write on finalize; user yes is the gate |

### Hot memory (P0 default loop)

User-level append-only rules at `~/.jj-flow/memory/<project_key>.md`. Not a business-repo instruction file. Do **not** write AGENTS.md / CLAUDE.md.

| Step | Action |
| --- | --- |
| DELIVER | Increment `findings.md` with `ralph_ops.mjs finding` (five fields: 现象/原因/对策/适用范围/证据). `## 可复用结论` one-liners must point at `F-00N` |
| ARCHIVE | `archive` / `finalize` appends `## 可复用结论` into the hot layer (missing findings.md → silent skip) |
| init / resume | Lexical inject, cap 5, confirmed `[x]` first; record as `hot_memory:` in `progress.md`. 0 hits stay empty |
| Confirm / prune | `knowledge-confirm --needle …` marks `[x]`; `knowledge-prune` drops oldest unconfirmed over the per-project cap |
| Portfolio KB | Still opt-in overlay. Unavailable → skip. Do not pad either layer |

## 反例黑名单（不要做什么）

| # | Do not | Do instead |
| --- | --- | --- |
| 1 | Default `init` because status is COMPLETED/ABANDONED/archived | Same requirement → `resume` |
| 2 | Require the user to memorize/type `run_id` first | Resolve from speech; report id yourself |
| 3 | Invent `/portfolio` paths or silent-add a repo to the global map | `jj home init` if missing; join via `$jj-init` |
| 4 | Commit / push / review / handoff / dispatch / merge unless asked | Prep only (`commit-prep`); wait for user |
| 5 | PASS write-then-read / cross-path MUST on static diff alone | Match `evidence_class`; see [must-evidence.md](references/must-evidence.md) |
| 6 | Third identical failed tool/strategy attempt | Change approach or 🔴 ask user (STAGNATION) |
| 7 | Run business ralph inside the control project | Business repo only; `DEL-*` ≠ `RALPH-*` |
| 8 | Unrelated refactors; long analyze/plan for single-point work | Short MUST + file list; use `tiny` for single-point |
| 9 | Ingest/promote global knowledge without user yes | This-run idle offer / 「投喂知识库」; first-time bootstrap `$jj-init`; no auto-hook on finalize |
| 10 | `git revert` / force gate on conversational path by default | Suggest revert; no `--force` unless user overrides |
| 11 | Treat chat/memory as checkpoint advance | Only `run.json` + artifacts + Git evidence |
| 12 | Call `$jj-same` when handoff `ready=false` as if portable | Fix blockers or report `blocked_reasons` |
| 13 | Treat `$jj-end` as ralph archive / phase advance | `$jj-end` is Git-only; archive via `finalize` |
| 14 | Silently replace live `task_plan.md` so prior `### 当前` text is gone (incl. replacing `## Tasks` in place) | Move `### 当前` → `### 已落地` / `### 已取代` first. Legacy: if no Current, rename `## Tasks`→Current then move. Unarchived revisions stay in the live file |
| 15 | Pad init `knowledge_refs` or hot_memory with unrelated same-project history to fill a quota | Lexical retrieve only; 0 hits → empty; cap 5 |
| 16 | Delete or empty tests while fixing a failed MUST / `NEEDS_CHANGES` | Add or strengthen tests; `tiny` presentational without those signals is exempt |
| 17 | Invent metrics clocks or block ACCEPT because timestamps are missing | `jj ralph metrics` is derived; null stays null |
| 18 | Open a 4th parallel stream when review cannot keep up | One person, 2–3 independent streams; `$jj-review` reports only |

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
