/**
 * Mode W exclusive-worktree lifecycle (host boundary; real git).
 *
 * Create / inspect / cleanup only. Does not write control-plane status,
 * does not delete attestation/receipt evidence, and does not close Wave 2.
 *
 * Landing rule: named branch tip; forbid silent detached HEAD.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeWorkspacePath, workspacePathsEqual } from './dispatchWorkspaceMode.mjs';

export function createExclusiveWorktree({
  repoPath,
  worktreePath,
  branch,
  startPoint = 'HEAD',
  runCommand = execFileSync
} = {}) {
  const repo = requirePath(repoPath, 'repoPath');
  const target = requirePath(worktreePath, 'worktreePath');
  const namedBranch = requireNamedBranch(branch);

  if (workspacePathsEqual(repo, target)) {
    return fail('exclusive worktree path must differ from repo path');
  }
  if (fs.existsSync(target)) {
    return fail(`worktree path already exists: ${target}`);
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    git(repo, ['worktree', 'add', '-b', namedBranch, target, startPoint], runCommand);
  } catch (error) {
    return fail(gitError(error, `git worktree add -b ${namedBranch} failed`));
  }

  const landing = inspectWorktreeLanding({ worktreePath: target, runCommand });
  if (!landing.ok) return landing;
  const named = assertNamedBranchTip({
    worktreePath: target,
    intendedBranch: namedBranch,
    runCommand,
    landing
  });
  if (!named.ok) {
    try {
      cleanupExclusiveWorktree({ repoPath: repo, worktreePath: target, runCommand });
    } catch {
      // Cleanup is best-effort; landing failure is the reported error.
    }
    return named;
  }
  return {
    ok: true,
    worktree: normalizeWorkspacePath(target),
    branch: named.branch,
    head: named.head,
    detached: false
  };
}

export function inspectWorktreeLanding({ worktreePath, runCommand = execFileSync } = {}) {
  const target = requirePath(worktreePath, 'worktreePath');
  if (!fs.existsSync(target)) {
    return fail(`worktree path does not exist: ${target}`);
  }
  let abbrev;
  let head;
  try {
    abbrev = git(target, ['rev-parse', '--abbrev-ref', 'HEAD'], runCommand);
    head = git(target, ['rev-parse', 'HEAD'], runCommand);
  } catch (error) {
    return fail(gitError(error, 'unable to inspect worktree HEAD'));
  }
  const detached = !abbrev || abbrev === 'HEAD';
  if (detached) {
    return {
      ok: false,
      detached: true,
      branch: null,
      head: head || null,
      worktree: normalizeWorkspacePath(target),
      reason: 'silent detached HEAD is forbidden; Mode W must land on a named branch tip'
    };
  }
  return {
    ok: true,
    detached: false,
    branch: abbrev,
    head,
    worktree: normalizeWorkspacePath(target),
    reason: null
  };
}

export function assertNamedBranchTip({
  worktreePath,
  intendedBranch,
  runCommand = execFileSync,
  landing = null
} = {}) {
  const inspected = landing && typeof landing === 'object'
    ? landing
    : inspectWorktreeLanding({ worktreePath, runCommand });
  if (!inspected.ok) return inspected;
  const expected = requireNamedBranch(intendedBranch);
  if (inspected.branch !== expected) {
    return fail(
      `worktree HEAD is ${inspected.branch}, expected named branch ${expected}`
    );
  }
  return inspected;
}

/**
 * Remove the exclusive worktree. Never deletes control-plane evidence.
 * Failure to remove the tree must still report evidence_preserved=true.
 */
export function cleanupExclusiveWorktree({
  repoPath,
  worktreePath,
  force = false,
  runCommand = execFileSync
} = {}) {
  const repo = requirePath(repoPath, 'repoPath');
  const target = requirePath(worktreePath, 'worktreePath');
  const args = force ? ['worktree', 'remove', '--force', target] : ['worktree', 'remove', target];
  try {
    if (fs.existsSync(target)) {
      git(repo, args, runCommand);
    } else {
      git(repo, ['worktree', 'prune'], runCommand);
    }
    return {
      ok: true,
      removed: true,
      evidence_preserved: true,
      worktree: normalizeWorkspacePath(target)
    };
  } catch (error) {
    return {
      ok: false,
      removed: false,
      evidence_preserved: true,
      worktree: normalizeWorkspacePath(target),
      reason: gitError(error, 'git worktree remove failed; evidence left intact')
    };
  }
}

function git(cwd, args, runCommand) {
  const result = runCommand('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const stdout = typeof result === 'string' ? result : result?.stdout || '';
  return String(stdout).trim();
}

function gitError(error, fallback) {
  const stderr = error?.stderr ? String(error.stderr).trim() : '';
  return stderr || error?.message || fallback;
}

function requirePath(value, name) {
  if (!value || typeof value !== 'string') throw new Error(`${name} must be a non-empty string`);
  return path.resolve(value);
}

function requireNamedBranch(branch) {
  if (!branch || typeof branch !== 'string' || !branch.trim()) {
    throw new Error('named branch is required');
  }
  const name = branch.trim();
  if (name === 'HEAD' || name.startsWith('refs/')) {
    throw new Error('Mode W forbids detached or raw-ref landing; use a named branch');
  }
  return name;
}

function fail(reason) {
  return { ok: false, reason };
}
