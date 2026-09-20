# Claude Code dispatch execution (Mode S)

> **Status**: Skill MVP (Mode S). Not Host Wave 2. Does not raise A2/A3/A4.
> **Host**: `host_id=claude-code`, `handle_kind=session`
> **Shared Mode S/W/P rules**: [grok-dispatch-execution.md](grok-dispatch-execution.md)

Claude Code uses the same session-host Mode S path as Grok. Control-plane schema, PREVIEW → approve → DISPATCH, attestation files, and VERIFIED evidence are unchanged.

## What is different from Grok

| Item | Claude Code |
| --- | --- |
| Slash | `/jj-dispatch` (Claude command in `claude-commands/jj-dispatch.md`) |
| `host_id` | `claude-code` |
| Session handle | Current Claude Code conversation UUID |
| Env fallbacks | `CLAUDE_SESSION_ID` / `CLAUDE_CODE_SESSION_ID` / `CLAUDE_CONVERSATION_ID` if the host exposes them |
| Missing multi-session APIs | **Degrade Mode S** (same as Grok gate 5). Do not BLOCK the whole wave. |
| Subagents / Task tool | Not BIND identity. Mode S may share one coordinator session across `task_key`s. Independent-project `$jj-same` writes may be parallel; same-project writes stay serial. |
| Wave 2 / A2 | **Not closed** on this path. Skill install is not real-host acceptance. |

## BIND minimum

Same attestation file path as Grok Mode S:

```text
{control_root}/.workflow/dispatch/{DELIVERY_ID}/attestations/{task_key_safe}.json
```

Required: `host_id=claude-code`, `handle_kind=session`, real session UUID in `session_id` / intent `thread_id`, `sandbox_evidence_ref` pointing at that file. Forbid `session-<slug>-YYYYMMDD`.

Helpers: `src/claudeHostAdapter.mjs` (`resolveClaudeSessionId`, `bindClaudeSessionTask`).

## MUST NOT

- Do not invent Codex thread APIs on Claude
- Do not treat a subagent id as the bound session
- Do not claim Wave 2 / A2 because `/jj-dispatch` is installed
- Do not skip attestation files for VERIFIED
