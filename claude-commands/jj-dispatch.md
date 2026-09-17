---
name: jj-dispatch
description: 多项目调度：先预览、批准 task_keys，再派发；中断可继续。状态写在 ~/.jj-flow，不靠聊天。
argument-hint: "<预览、批准、分发到哪些项目、继续、回退、TASK-ID>"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Skill
  - AskUserQuestion
---

# /jj-dispatch

User: $ARGUMENTS

Authoritative procedure: `skills/jj-dispatch/SKILL.md` (multi-host SSOT). This file is a thin Claude entry only.

host_id=`claude-code`, handle_kind=`session`. Default **Mode S**: current Claude conversation, serial, project-branch. Isolation → Mode W. Subagents are not BIND identity.

1. **PREVIEW** first; do not write intent until the user approves this round’s `task_keys`.
2. **BIND** the current Claude session UUID (`CLAUDE_SESSION_ID` / `CLAUDE_CODE_SESSION_ID` if present). No `session-*-YYYYMMDD`.
3. Write attestation/receipt under `~/.jj-flow`. VERIFIED needs commit + review + attestation file.
4. After DISPATCH, hand implementation to `/jj-same` (ASSIGNMENT + 人设提示词). Do not parent-edit business code.
5. Chat does not TICK / BIND / VERIFIED.

Do not expand this file into full gates — keep logic in the SSOT skill.
