# jj-review

Single-repo **read-only review adapter** linked to an existing ralph run.

审查引擎优先用**当前宿主内置** review / code-review；本命令负责绑定 ralph run、映射 findings，并落盘 `reviews/REV-*.json`。

## Flow

```text
locate existing run
  → prefer host built-in review (or user-provided results)
  → map verdict + findings to jj-flow schema
  → write reviews/REV-n.json
  → update run.json / progress.md
```

Run selection: explicit `run_id`, else latest by `run.json.updated_at` desc then `run_id` desc.

No run → BLOCKED. Do not init. Do not change business code. Does not replace dispatch VERIFIED gate.

## Host-first rule

1. Discover and invoke the host’s review / code-review entry when available.
2. Map severity and outcome into the REV schema (`source=host_builtin`).
3. Fallback to minimal inline review only when host review is unavailable (`source=fallback_inline`), or map user-pasted results (`source=user_provided`).
4. Do not run a second parallel self-review that overrides a completed host review unless the user asks to re-review.

Skill references (installed with the package):

- `.codex/skills/jj-review/references/host-review.md`
- `.codex/skills/jj-review/references/report-layout.md`

## Report

Copy the skill skeleton `review-report.skeleton.json`.

Rules:

- PASS / NEEDS_CHANGES require `reviewed_commit`
- PASS has no OPEN findings
- NEEDS_CHANGES has ≥1 OPEN finding
- BLOCKED when evidence is insufficient
- Recommended: `source` + `host_review` for provenance

## Optional maintenance CLI

```bash
jj ralph review-record --run-id RALPH-… --outcome PASS|NEEDS_CHANGES|BLOCKED \
  --reviewed-commit <sha> \
  --source host_builtin|user_provided|fallback_inline \
  --host-review-json '{"method":"skill","entry":"review","artifact_paths":[],"note":null}' \
  [--summary text] [--json]
```

`--source` / `--host-review-json` persist provenance (same schema as direct file writes). Conversation path may still write `REV-*.json` directly after mapping host results.
