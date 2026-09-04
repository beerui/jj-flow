---
name: jj-ralph
description: "Single-repo requirement loop ANALYZE→PLAN→DELIVER→ACCEPT→ARCHIVE; artifacts under .workflow/ralph/<task_key>/ + business-map; handoff in run.handoff. Same requirement → same run_id (resume after archive; abandon mid-flight recoverable). Triggers: $jj-ralph, /jj-ralph, 单仓闭环, resume, abandon, archive, tiny, strict, 继续, 改坏了, 按审查改, 先不写代码, 投喂知识库. Cross-repo → jj-same; multi-project → jj-dispatch. Mechanical: ralph_ops.mjs. Conversational path never uses --lite."
---

# jj-ralph

Single repo: requirement → acceptance → archive. Durable state is written only under `.workflow/ralph/` and Git.

**Continue / resume:** same requirement → same `run_id`. Archive = in-place COMPLETED + inline sha256 ledger + map merge, **not** discard; further edits use `resume`. Mid-flight stop → `abandon` (can `resume` later). New run **only** for a truly new requirement. `$jj-end` is Git-only.

**Users do not lead with run ids.** Real speech is like “nudge the tip a bit”, “change that one again”, “drop this for now”. You resolve/write `task-…` in reports; **never** require the user to memorize a run_id first. Active leftover `RALPH-*` dirs need `jj ralph migrate` (or `adopt --task`) before load/gate/save.

### Entry decision (route first)

```text
「继续 / 修完 / 按审查改 / resume 按 review 修 / 改坏了」 → resume session-linked run (never init)
「审查修复 / N点修复 / review-fix」 → **not** a new requirement. Resume the live feature run. Never init `task-*-review-fix`.
Same requirement (incl. COMPLETED/ABANDONED)? → resume
Index `## 同需求提示` (same session or review-slice next to another live run) → ask; do **not** auto-merge / abandon. Same session includes `review.task_thread_id` and CLI `--thread-id` / `host.thread_id`.
No matching run? → init with the **requirement** title (not a review-slice slug)
「先不写代码 / 先理解需求 / 先分析」 → ANALYZE only; do not gate PASS / DELIVER
Mid-flight drop / 「撤回修改 / 本次不需要了 / 产品砍了」 → abandon (no map)
Truly new requirement only? → init new run_id
Cross-repo port? → handoff; if ready → $jj-same
Multi-project schedule? → $jj-dispatch (not this skill)
Git closeout only? → $jj-end (orthogonal to run status)
```

Conversational path **never** uses `--lite` / `gate brief` / `gate close`. Always the five gates. Ignore init `gate_set?` hints. `tiny` only shortens the plan, it does not drop gates.

## Immediate actions

1. **Locate run (natural language first):**
   - User named `task-…` (or leftover `RALPH-…`) → use that id (uncommon); leftover active dirs → migrate first
   - Else: read `.workflow/ralph/index.md` first (`## 活跃`; if `## 归档提示` is present, do **not** auto-archive — ask when uncertain). Then session-linked run / latest `updated_at` / title·goal·scope semantic match (include COMPLETED/ABANDONED). Index rows are candidates only; confirm goal/scope on `task_plan.md`
   - **Screenshot / `[Image]` / 「这里」:** read the image **before** searching. Treat visible UI (labels, placement, broken layout) as the spec. Bind to the session-linked run when one exists; do not ignore the image because locate is “speech-only”
   - **Same requirement → `resume`/continue; never default to init**; `init` only when nothing matches
   - **Review-slice is not a new run:** title / goal / slug containing `审查修复` / `按审查` / `三点修复` / `review-fix` must attach to the live feature task. Mechanical `init` refuses that slug. Field lesson: `task-h5-enter-review-fix` beside `task-enter-form-h5` was one requirement.
   - 🔴 **CHECKPOINT:** multiple candidates and no safe inference → list candidate titles in one sentence (run_id optional) for the user to pick — do not make them type the id from memory
   - Naming and map: product default `~/.jj-flow` (`naming.json`, `map.md`, `knowledge/`). Missing home → `jj home init`, then continue. Map join / first-time KB bootstrap → `$jj-init`. `jj doctor` to the user = the short Chinese `user_view`. Never paste doctor JSON.
2. **intensity** (user speech first): single-point / `tiny` / 文案两字 / 单像素 → `tiny`; auth·protocol / `strict` / review-before-archive → `strict`; else `standard`.
   - Optional intent is the Goal paragraph in `task_plan.md`. `tiny` skips `## 存疑` unless `--intent`. Analyze-hold answers open questions under `## 存疑`.
   - **No second tier.** Do not pass `--lite` / `--full`. Do not take `gate_set?` advisory. Five gates always.
3. `map-find` **CLI only** — do not Read `business-map.json`. Empty hits are fine. Single-point: [tiny-example.md](references/tiny-example.md).
4. Phases [phases.md](references/phases.md): ANALYZE → PLAN → DELIVER → ACCEPT → ARCHIVE. **Default mechanical advance: `gate`** (`--no-advance` only flips the gate), **except** analyze-hold below.
   - MUST/ACCEPT evidence shape: [must-evidence.md](references/must-evidence.md) (`evidence_class`; ban write-then-read false green via static diff only)
   - After every DELIVER verify: `deliver-attempt`. If `improved=false` or `rollback-phase`, the CLI may print a soft hint to record the failure with `ralph_ops.mjs finding` (does **not** block the gate). Prefill 现象/原因 from progress `failed_must` / `over_claimed`; you still write 对策 + 适用范围.
   - **strict** before accept: `accept-layer --layer judgment --status PASS --mode review|recheck`
   - 🔴 **CHECKPOINT (strict):** judgment layer not PASS → do not `gate accept PASS` / `finalize`; fix review or ask user
   - Once target files are known, go DELIVER; do not re-walk the tree for completeness theater
   - 🔴 **CHECKPOINT (analyze-hold):** user said 「先不写代码 / 先理解需求 / 先分析 / 先不改代码」 → write Goal + `## 存疑`; **do not** `gate analyze PASS`, **do not** PLAN/DELIVER, **do not** edit business files, until they say 「开始做吧 / 我认可 / 按这个做 / 继续改」
   - **Same-session continue** (never init): 「继续」 → next unfinished phase of the session-linked run; 「按审查改 / resume 按 review 修」 → DELIVER against latest `NEEDS_CHANGES` (do not re-analyze from scratch); 「改坏了」 → resume, rewrite Steps/验收, append a dated progress section, `deliver-attempt --improved false` (STAGNATION if the same strategy already failed twice); 「修完」 → finish current MUST / verify, do not start a new run
   - Task/approach change: rewrite live Goal / 验收 / Steps to the new contract; append `progress.md`. Do not grow REQ/TASK history in the plan. Shape: [artifact-layout.md](references/artifact-layout.md)
5. After accept PASS, follow **status `next`** (do not jump to a blocked command):
   - `next=review` → `$jj-review`; do **not** `gate accept`; wait for the user to say 「按审查改」 before DELIVER
   - `next=commit-scoped-review` → commit, then `review-record --review-scope commit`; do **not** `finalize` on a `working_tree` PASS
   - `next=finalize` → **MUST** `finalize` (L1 map-merge + archive + hot-memory promote from `findings.md`)
   - `next=check` → resume window or blocked/paused; ask if uncertain
   - Index `## 归档提示`: prompt only. Certain rows may suggest `finalize`; uncertain (PAUSED / BLOCKED / mid-flight) → **询问用户**. Never auto-archive.
   `knowledge-contribution.json` is **degraded** (hot layer replaced home ingest). Process STAGNATION goes into `process_lessons`; durable lessons only with explicit `--lessons`.
6. Completion report (short): local CAP id, hot-memory promote status.
7. **Idle offer (after the completion report, never during DELIVER):** archive already promoted `## 可复用结论` into `~/.jj-flow/memory/`. Ask **once** whether to also feed the opt-in portfolio KB. Write only after yes: `jj ralph knowledge-contribute --run-id … --hook` (current `project_key` only; P1b hook is skipped/degraded). User speech **「投喂知识库 / 补充全局知识」** also runs the hook. Map join / first-time KB bootstrap → `$jj-init`. Do not auto-write on finalize.
8. 🔴 **CHECKPOINT (irreversible):** push / merge / release / delete data → prepare only (`commit-prep` / report); **do not execute** until the user explicitly asks.

### Step I/O

| Step | In | Out (durable) |
| --- | --- | --- |
| 1 Locate | user speech + images + `.workflow/ralph/index.md` + `.workflow/ralph/*` | chosen `run_id` or “none → init” |
| 2 intensity | user speech | `tiny` \| `standard` \| `strict` on run — never `--lite` |
| 3 map-find | title/goal/keywords | Short CAP hits from the CLI (may be empty). Do not Read or paste `business-map.json`. Hot-memory inject is events.jsonl only (`hot_memory:`); 0 hits stay empty |
| 4 phases | code + verify | phase arts + `deliver-attempt` + `gates.*` |
| 5 finalize | accept PASS | in-place archive + map merge + hot-memory promote (`knowledge-contribution.json` degraded) |
| 6 report | run + CAP paths | short completion report |

### Happy path (default command chain)

```text
map-find → init | resume
→ short analyze/plan (tiny: see tiny-example) → edit files
→ deliver-attempt → gate deliver PASS
→ review (working_tree ok) → commit → review-record --review-scope commit
→ gate accept PASS → MUST finalize → $jj-end
# strict only: accept-layer judgment PASS before gate accept
# stop only at 🔴 CHECKPOINT or failure table
# 「先不写代码」: write ANALYZE then STOP (do not auto-advance)
```

After a phase PASS, auto-advance to the next phase by default; do not ask “continue?”. Only stop at 🔴 CHECKPOINTs or the failure table below. Analyze-hold is a CHECKPOINT.

## Tool use (speed)

Batch independent reads in one turn. Target ~15–20 rounds, not 40 serial hops.

- Do **not** re-read files already in this turn (skill, `run.json`, `task_plan.md`, last 30 lines of `progress.md`, user images).
- `read_file` with `offset`/`limit`. `progress.md`: last ~30 lines. Source: the function/block, not the whole file.
- Do **not** Read `business-map.json`. `map-find` CLI only.
- Grok: MasterGo MCP is off by default. Do not `search_tool` / `use_tool` it unless the user pasted a MasterGo URL.

## Failure modes (if X → first fix → still fails)

| Trigger | First fix | Still fails |
| --- | --- | --- |
| Missing `~/.jj-flow` map / naming | `jj home init`; continue | Do not invent `/portfolio` paths |
| Current repo not in global map | Continue the task unindexed | Join / bootstrap → `$jj-init` |
| Script resolve fails (`ralph_ops.mjs` not found) | Try: repo skill scripts → `$CODEX_HOME/skills/jj-ralph/scripts/` → `jj ralph <cmd>` | Report resolve chain; stop mechanical steps |
| Same tool/strategy fails twice / `STAGNATION` | Change approach; `deliver-attempt --improved false`; ralph writes `instruction-correction.md` | `set-status BLOCKED` + ask user; no third identical attempt; Reviewer does **not** write `AGENTS.md` |
| `gate` / product-consistency reject | Fix evidence / paths / review; or `gate --status FAIL` + progress log | Adjacent `rollback-phase` only; no force on conversational path |
| `finalize` / archive reject | If `next=commit-scoped-review`, commit + `review-record --review-scope commit` first; else fix accept gates / paths | Report blockers; no conversational `--force` |
| `map-find` empty | Continue with scope from user speech + repo search | Do not block init/resume solely because map is empty |
| Portfolio attach empty / unrelated | Leave `knowledge_refs` empty; do not invent or dump same-project history | Do not pad to 5/12; local `map-find` is the same-repo lookup |
| Verify FAIL under `max_iterations` | Stay DELIVER; rework; append progress | On ceiling: `intervention_needed.kind=MAX_ITERATIONS`; stop and report |
| Uncommitted dirty would overwrite user edits | 🔴 stop; show status; ask how to proceed | Do not clobber; no silent stash/reset |
| User wants cross-repo port with uncommitted work | `handoff` → `ready=false`; list blockers | Do not call `$jj-same` as if ready |
| `close` spoken | Map to `abandon` (drop) or `finalize` (archive) | Never invent a conversational `close` command; never `gate --gate close` |
| User said 先不写代码 / 先理解需求 / 先分析 | Stay ANALYZE; keep `## 存疑` open; no `gate analyze PASS` | Do not auto-advance into PLAN/DELIVER |
| Screenshot / 「这里」 present but files still unknown | Read the image; use visible labels as search keys; bind session-linked run | Do not ask the user to retype what the image already shows |
| 「继续 / 按审查改 / 改坏了」 with a session-linked run | `resume`; do not init | If several candidates, 🔴 list titles — still never demand a typed run_id |
| Review `NEEDS_CHANGES` / OPEN findings in a write session | Same-turn DELIVER against those findings | Do not wait for the user to say 「修」 |
| Want to open `task-*-review-fix` / 「审查修复」 | Resume the live feature run; rewrite Steps if the review changed the contract | Never init a second live task for findings |
| User changes approach / MUST / plan (mid-run or after archive) | Rewrite Goal / 验收 / Steps; append a dated `progress.md` section | Do not dump REQ/TASK history into the live plan ([artifact-layout.md](references/artifact-layout.md)) |

Full gate rules and intensity budgets: [phases.md](references/phases.md). Rollback edges: [rollback.md](references/rollback.md).

## Handoff

Source of truth: `run.handoff` (not a second workflow).

- Multi-host / existing handoff / user wants port: accept/finalize may maintain automatically
- Manual: `ralph_ops.mjs handoff --run-id … --targets ProjectB,ProjectD`
- Fields: `ready` / `blocked_reasons` / `source_head` / `must` / `do_not_port` / `targets` / `mode`
- Uncommitted: `ready=false`; user only says 「交接到 项目B 项目C」 / “hand off to ProjectB ProjectC” → `$jj-same`

## Scripts

```bash
node <resolved>/ralph_ops.mjs init --run-id task-x --title "..." --goal "..." [--intensity tiny|standard|strict] [--in a,b] [--project KEY] [--knowledge-query Q] [--intent|--no-intent]
node <resolved>/ralph_ops.mjs deliver-attempt --run-id task-x --improved true|false
node <resolved>/ralph_ops.mjs accept-layer --run-id task-x --layer judgment --status PASS --mode review
node <resolved>/ralph_ops.mjs gate --run-id task-x --gate analyze|plan|deliver|accept|archive --status PASS
node <resolved>/ralph_ops.mjs scope --run-id task-x --in src/extra.js
node <resolved>/ralph_ops.mjs metrics --run-id task-x [--persist]
node <resolved>/ralph_ops.mjs finalize --run-id task-x --modules src/a.js --keywords a,b --lessons "durable rule"
node <resolved>/ralph_ops.mjs knowledge-contribute --run-id task-x [--hook]
node <resolved>/ralph_ops.mjs finding --run-id task-x --action "…" --scope "…" [--phenomenon "…"] [--cause "…"] [--rule "…"]
node <resolved>/ralph_ops.mjs knowledge-confirm --needle "…" [--project KEY]
node <resolved>/ralph_ops.mjs knowledge-prune [--project KEY]
node <resolved>/ralph_ops.mjs resume --run-id task-x --reason "…"
node <resolved>/ralph_ops.mjs abandon --run-id task-x --reason "…"
node <resolved>/ralph_ops.mjs rollback-phase --run-id task-x --to DELIVER --reason "…"
node <resolved>/ralph_ops.mjs set-status --run-id task-x --status PAUSED --reason "…"
node <resolved>/ralph_ops.mjs handoff --run-id task-x --targets ProjectB,ProjectD
node <resolved>/ralph_ops.mjs commit-prep --run-id task-x
node <resolved>/ralph_ops.mjs migrate
node <resolved>/ralph_ops.mjs adopt --task task-x [--from RALPH-x]
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

Conversational `close` is deprecated → use `abandon` or `finalize`. Do not git-revert by default. Do not pass `--lite`.

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
| DELIVER | Real pitfalls only: `ralph_ops.mjs finding` when there is a 对策. Update 改动摘要 / 验证. `## 可复用结论` one-liners must point at a pitfall id |
| ARCHIVE | `archive` / `finalize` appends `## 可复用结论` into the hot layer (missing findings.md → silent skip) |
| init / resume | Lexical inject, cap 5, confirmed `[x]` first; record as `hot_memory:` in events.jsonl. 0 hits stay empty |
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
| 7 | Run business ralph inside the control project | Business repo only; `DEL-*` ≠ `task-*` |
| 8 | Unrelated refactors; long analyze/plan for single-point work | Short MUST + file list; use `tiny` for single-point |
| 9 | Ingest/promote global knowledge without user yes | This-run idle offer / 「投喂知识库」; first-time bootstrap `$jj-init`; no auto-hook on finalize |
| 10 | `git revert` / force gate on conversational path by default | Suggest revert; no `--force` unless user overrides |
| 11 | Treat chat/memory as checkpoint advance | Only `run.json` + artifacts + Git evidence |
| 12 | Call `$jj-same` when handoff `ready=false` as if portable | Fix blockers or report `blocked_reasons` |
| 13 | Treat `$jj-end` as ralph archive / phase advance | `$jj-end` is Git-only; archive via `finalize` |
| 14 | Grow `task_plan.md` with REQ-001…N / 已落地 / ISO gate lines | Current contract only (Goal / 验收 / Steps). History → dated `progress.md`. Machine log → events.jsonl |
| 15 | Pad init `knowledge_refs` or hot_memory with unrelated same-project history to fill a quota | Lexical retrieve only; 0 hits → empty; cap 5 |
| 16 | Delete or empty tests while fixing a failed MUST / `NEEDS_CHANGES` | Add or strengthen tests; `tiny` presentational without those signals is exempt |
| 17 | Invent metrics clocks or block ACCEPT because timestamps are missing | `jj ralph metrics` is derived; null stays null |
| 18 | Open a 4th parallel stream when review cannot keep up | One person, 2–3 independent streams; `$jj-review` reports only |
| 19 | Pass `--lite` / `gate brief` / `gate close`, or follow `gate_set?` advisory | Conversational path: five gates only; ignore the hint; `tiny` only shortens the plan |
| 20 | Auto-advance ANALYZE when the user said 先不写代码 / 先理解需求 / 先分析 | Write Goal + 存疑; wait for 「开始做吧 / 我认可 / 继续改」 |
| 21 | Init a new run on 「继续 / 按审查改 / 改坏了 / 修完」 in the same session | `resume` the session-linked run; 改坏了 → rewrite Steps/验收 and append progress |
| 22 | Ignore `[Image]` / 「这里」 and ask the user to restate the screenshot | Read the image first; use visible UI as the spec |
| 23 | Serial one-file reads, re-read injected content, or slurp whole files | Batch reads; `offset`/`limit`; last 30 lines of progress |
| 24 | Read `business-map.json` or pad keywords with title/goal sentences | `map-find` CLI; empty is valid |
| 25 | Call MasterGo MCP on Grok without a MasterGo URL | Skip it. Enable only when the user pasted a MasterGo link |
| 26 | Write empty F-00N shells (对策/适用范围 blank) | Skip, or write one pitfall with a 对策 |

## Completion report

- `run_id` / phase / status / intensity
- Acceptance outcome; if just archived, note same-run continue is still allowed
- Handoff: `ready` + “hand off to …”
- Blockers (including STAGNATION / MAX_ITERATIONS)

## Examples (user speech; agent resolves the run)

```text
$jj-ralph 先改项目A：登录后密码过期提示
$jj-ralph 文案修改 点击拨打改成拨打电话
$jj-ralph [Image #1] 这里要改一下：放到列表对应列的下面，标题去掉
$jj-ralph 改坏了 都没有办法改成一行两列了
$jj-ralph 先不写代码 先分析怎么做
$jj-ralph 我认可你的方案和推荐实现 开始做吧
$jj-ralph 按审查改
$jj-ralph 继续
$jj-ralph 这个先不做了，产品砍了
$jj-ralph 交接到 项目B 项目C
```

See [integrations.md](references/integrations.md), [artifact-layout.md](references/artifact-layout.md); user-facing [docs/commands/jj-ralph.md](../../../docs/commands/jj-ralph.md).
