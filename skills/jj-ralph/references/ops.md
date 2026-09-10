# Ralph operations

Read this catalog only for command syntax or a conditional operation. The conversational commands in SKILL.md are a subset of this mechanical catalog; listing an operation here does not make it a default step or authorize Git/external writes.

## Resolution and compatibility

Run `node <resolved>/ralph_ops.mjs <command> ...` from the target business repo, or supply `--cwd DIR`. Resolve the repository skill, then the current host's installed skill. The wrapper loads `$JJ_FLOW_ROOT/src/ralph.mjs`, a jj-flow checkout, its bundled `scripts/lib/ralph.mjs`, then an installed npm package. Missing library → reinstall the skill; historical skeleton files are not the normal init path.

`jj ralph` is the mechanical CLI fallback. Its legacy controls remain available:

```bash
jj ralph init --run-id task-x --title "..." --goal "..." --intensity standard
jj ralph init --run-id task-y --title "..." --goal "..." --lite
jj ralph init --run-id task-z --title "..." --goal "..." --full
jj ralph gate --run-id task-y --gate brief --status PASS
jj ralph gate --run-id task-y --gate close --status PASS
jj ralph map-find --query "business term" --limit 5
jj ralph host-record --run-id task-x --host-id codex [--thread-id id] [--model-id id]
```

`brief` / `close` are mechanical aliases for existing lite runs, never the conversational chain. `ralph_ops` rejects `--lite` / `--full` / `--intensity` and `gate brief|close`; mechanical `jj ralph` retains them.

Conversational `gate --gate deliver --status PASS` must use `ralph_ops`. It checks real Goal / 验收 content, file backticks in every Step and unanswered `## 存疑`, then saves analyze/plan/deliver together. Blank checkbox stubs fail; empty 存疑 and checked answers are allowed. Check failures write zero gates. Retrying after an interrupted write fills only prerequisites that are not yet PASS; run/index/events are not one transaction.

If the wrapper is unavailable, `jj ralph gate --gate deliver` is **degraded unfold**: it changes only deliver, leaving analyze/plan unchanged. Do not finalize through this conversational fallback; restore the wrapper. Explicit mechanical analyze/plan remain supported.

Init/resume return `map_find` (cap 5, empty allowed). Init queries `knowledge_query || title || goal`; resume queries `reason || title || goal`. Results and inference explanations belong to responses/events, not `run.json`, including when a caller saves the returned run again. Manual `map-find` remains a maintenance tool.

## Current requirement

```bash
ralph_ops.mjs init --run-id task-x --title "..." --goal "..." [--in a,b] [--out c,d] [--capability CAP-x] [--project KEY] [--knowledge-query Q] [--intent|--no-intent]
ralph_ops.mjs resume --run-id task-x --reason "..."
ralph_ops.mjs locate [--run-id task-x] [--limit 8] [--details]
ralph_ops.mjs status [--run-id task-x] [--details]
ralph_ops.mjs context --run-id task-x [--review] [--review-scope working_tree|commit] [--base-commit sha] [--output .workflow/ralph/task-x/.state/review-context.json]
ralph_ops.mjs deliver-attempt --run-id task-x [--improved true|false|auto] [--signal "verify:..."]
ralph_ops.mjs gate --run-id task-x --gate analyze|plan|deliver|accept|archive --status PASS|FAIL|BLOCKED [--no-advance]
ralph_ops.mjs finalize --run-id task-x [--modules a,b] [--keywords a,b] [--lessons "rule one|rule two"]
ralph_ops.mjs abandon --run-id task-x --reason "..."
ralph_ops.mjs finding --run-id task-x --action "remedy" --scope "applies when..." [--phenomenon "..."] [--cause "..."] [--rule "..."]
ralph_ops.mjs commit-prep --run-id task-x
```

`deliver-attempt` without `--improved` compares the workspace fingerprint and signal. Record the verification actually run. A finding may prefill phenomenon/cause from progress, but 对策 (`--action`) and 适用范围 (`--scope`) must be real nonempty content. Never create empty finding shells.

`locate --run-id` resolves one task directly; without an id, compact output shows 8 candidates and the omitted count. `--details` restores all rows/full status including metrics. `context` does not advance gates: it gathers the current contract and phase hint without reading the full business map. Context output must be under `.workflow/` or outside the repo to avoid changing its own Git snapshot.

## Review and recovery (conditional)

```bash
ralph_ops.mjs review-record --run-id task-x --outcome PASS|NEEDS_CHANGES|BLOCKED [--review-scope working_tree|commit] [--reviewed-commit sha] [--fix-commit sha] [--summary "..."] [--findings-file path] [--source host_builtin|user_provided|fallback_inline] [--host-review-file path] [--context-file path]
ralph_ops.mjs rollback-phase --run-id task-x --to PLAN|DELIVER|ANALYZE|ACCEPT --reason "..."
ralph_ops.mjs set-status --run-id task-x --status PAUSED|BLOCKED|IN_PROGRESS|READY_FOR_USER_TEST --reason "..."
ralph_ops.mjs scope --run-id task-x [--in a,b] [--out c,d]
ralph_ops.mjs scope --run-id task-x --replace-in current.js,current.test.js --reason "current approach replaces the previous scope"
ralph_ops.mjs accept-layer --run-id task-x --layer mechanical|judgment --status PASS|FAIL|PENDING|SKIPPED [--mode review|recheck|adversarial_note] [--note "..."]
```

Review records must point to real findings/evidence. `review-record` follows a user request, `next=review` / `commit-scoped-review`, or a gate error requiring a passing review. It is not a mandatory conversational step. A PASS review sets judgment; `accept-layer` is a mechanical-only control. `next` never grants commit permission: use existing user authorization, otherwise give `commit-prep` and leave the missing archive evidence explicit. Detailed gates and recovery: [phases.md](phases.md), [rollback.md](rollback.md).

Prefer `--host-review-file` and `--findings-file` over inline JSON on PowerShell. UTF-8 BOM is accepted and paths resolve against `--cwd`. Supply `--context-file` for task-scoped persistence, gate accept and finalize: the CLI recomputes hashes and ownership rather than trusting edited `diff_paths`. Contract/code/index/HEAD changes invalidate the packet; metadata-only gate/review writes do not. Commit context must target HEAD and a real base, with no uncommitted task changes. The report stores `context_snapshot` including the visible out-of-task paths.

## Maintenance and integrations (mechanical only)

```bash
ralph_ops.mjs map-find --query "business term" [--limit 5]
ralph_ops.mjs map-merge --run-id task-x [--modules a,b] [--keywords a,b] [--lessons "..."]
ralph_ops.mjs archive --run-id task-x [--slug name]
ralph_ops.mjs handoff --run-id task-x --targets ProjectB,ProjectC
ralph_ops.mjs dispatch-snapshot --run-id task-x --targets ProjectB,ProjectC
ralph_ops.mjs metrics --run-id task-x [--persist]
ralph_ops.mjs migrate [--all-projects]
ralph_ops.mjs adopt --task task-x [--from RALPH-x] [--absorb task-y]
ralph_ops.mjs remediate [--yes]
ralph_ops.mjs knowledge-contribute --run-id task-x [--hook]
ralph_ops.mjs knowledge-confirm --needle "..." [--project KEY]
ralph_ops.mjs knowledge-prune [--project KEY]
```

Prefer `finalize` over manual map-merge/archive. `remediate` previews leftovers; `--yes` applies the reviewed finalize/migrate list. Force overrides are not part of the conversational whitelist. Handoff, hot memory and opt-in portfolio rules: [integrations.md](integrations.md).
