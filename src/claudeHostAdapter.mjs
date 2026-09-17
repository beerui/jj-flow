/**
 * Claude Code session-host adapter (Mode S skill path).
 * Reuses session BIND + attestation. Does not close Host Wave 2. Does not raise A2.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bindSessionTask } from './grokHostAdapter.mjs';

const PLACEHOLDER_SESSION = /^session-[a-z0-9-]+-\d{8}$/i;

export const CLAUDE_HOST_ID = 'claude-code';
export const CLAUDE_HANDLE_KIND = 'session';

/**
 * Resolve a real Claude Code conversation/session UUID.
 * Prefer an explicit id, then host env if present. Never invent placeholders.
 */
export function resolveClaudeSessionId({ sessionId = null, env = process.env } = {}) {
  const raw = String(
    sessionId
    || env?.CLAUDE_SESSION_ID
    || env?.CLAUDE_CODE_SESSION_ID
    || env?.CLAUDE_CONVERSATION_ID
    || ''
  ).trim();
  if (!raw) {
    return {
      ok: false,
      reason: 'Claude conversation/session id required (current Claude Code session UUID, or CLAUDE_SESSION_ID)'
    };
  }
  if (PLACEHOLDER_SESSION.test(raw)) {
    return { ok: false, reason: 'placeholder session-<slug>-YYYYMMDD cannot BIND' };
  }
  return {
    ok: true,
    session_id: raw,
    host_id: CLAUDE_HOST_ID,
    handle_kind: CLAUDE_HANDLE_KIND
  };
}

export function claudeDispatchInstalled({
  cwd = process.cwd(),
  homedir = os.homedir()
} = {}) {
  const candidates = [
    path.join(cwd, '.claude', 'skills', 'jj-dispatch', 'SKILL.md'),
    path.join(homedir, '.claude', 'skills', 'jj-dispatch', 'SKILL.md'),
    path.join(cwd, '.claude', 'commands', 'jj-dispatch.md'),
    path.join(homedir, '.claude', 'commands', 'jj-dispatch.md')
  ];
  const found = candidates.filter((file) => fs.existsSync(file));
  return { installed: found.length > 0, paths: found };
}

/**
 * Scriptable BIND for Claude Code. Mode S default: current conversation.
 * Does not close Wave 2.
 */
export function bindClaudeSessionTask(options = {}) {
  const resolved = resolveClaudeSessionId({
    sessionId: options.sessionId,
    env: options.env
  });
  if (!resolved.ok) {
    return { ok: false, reason: resolved.reason, plane: options.plane };
  }
  return bindSessionTask({
    ...options,
    sessionId: resolved.session_id,
    hostId: CLAUDE_HOST_ID
  });
}
