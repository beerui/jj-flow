import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import {
  assertNamedBranchTip,
  cleanupExclusiveWorktree,
  createExclusiveWorktree,
  inspectWorktreeLanding
} from '../src/dispatchWorktree.mjs';

test('Mode W creates exclusive worktree on a named branch tip', () => {
  const { repo, temp } = makeRepo();
  try {
    const worktree = path.join(temp, 'worktrees', 'feat-mode-w');
    const created = createExclusiveWorktree({
      repoPath: repo,
      worktreePath: worktree,
      branch: 'feat/mode-w-named',
      startPoint: 'main'
    });
    assert.equal(created.ok, true, created.reason);
    assert.equal(created.detached, false);
    assert.equal(created.branch, 'feat/mode-w-named');
    assert.ok(created.head);
    assert.equal(workspacePathsDiffer(repo, worktree), true);

    const landing = inspectWorktreeLanding({ worktreePath: worktree });
    assert.equal(landing.ok, true, landing.reason);
    assert.equal(landing.branch, 'feat/mode-w-named');

    const named = assertNamedBranchTip({
      worktreePath: worktree,
      intendedBranch: 'feat/mode-w-named'
    });
    assert.equal(named.ok, true);

    const evidenceDir = path.join(temp, 'control', '.workflow', 'dispatch', 'DEL-w', 'attestations');
    fs.mkdirSync(evidenceDir, { recursive: true });
    const evidenceFile = path.join(evidenceDir, 'task.json');
    fs.writeFileSync(evidenceFile, '{"execution_mode":"W"}\n');

    const cleaned = cleanupExclusiveWorktree({ repoPath: repo, worktreePath: worktree });
    assert.equal(cleaned.ok, true, cleaned.reason);
    assert.equal(cleaned.evidence_preserved, true);
    assert.equal(fs.existsSync(worktree), false);
    assert.equal(fs.existsSync(evidenceFile), true);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('Mode W refuses to bind the main repo path as exclusive worktree', () => {
  const { repo, temp } = makeRepo();
  try {
    const created = createExclusiveWorktree({
      repoPath: repo,
      worktreePath: repo,
      branch: 'feat/nope',
      startPoint: 'main'
    });
    assert.equal(created.ok, false);
    assert.match(created.reason, /differ from repo path/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('inspectWorktreeLanding fail-closes on detached HEAD', () => {
  const { repo, temp } = makeRepo();
  try {
    const worktree = path.join(temp, 'worktrees', 'detached');
    execFileSync('git', ['-C', repo, 'worktree', 'add', '--detach', worktree, 'main'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const landing = inspectWorktreeLanding({ worktreePath: worktree });
    assert.equal(landing.ok, false);
    assert.equal(landing.detached, true);
    assert.match(landing.reason, /detached/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('cleanup reports evidence preserved when remove fails', () => {
  const result = cleanupExclusiveWorktree({
    repoPath: path.join(os.tmpdir(), 'jj-missing-repo'),
    worktreePath: path.join(os.tmpdir(), 'jj-missing-wt'),
    runCommand() {
      const error = new Error('git missing');
      error.stderr = 'not a git repository';
      throw error;
    }
  });
  assert.equal(result.ok, false);
  assert.equal(result.evidence_preserved, true);
  assert.equal(result.removed, false);
});

function makeRepo() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-mode-w-'));
  const repo = path.join(temp, 'repo');
  fs.mkdirSync(repo, { recursive: true });
  git(repo, ['init', '--initial-branch=main']);
  git(repo, ['config', 'user.name', 'jj-flow mode-w']);
  git(repo, ['config', 'user.email', 'mode-w@jj-flow.invalid']);
  git(repo, ['config', 'core.autocrlf', 'false']);
  fs.writeFileSync(path.join(repo, 'README.md'), 'mode w\n');
  git(repo, ['add', 'README.md']);
  git(repo, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'chore: seed']);
  return { repo, temp };
}

function git(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function workspacePathsDiffer(left, right) {
  return path.resolve(left) !== path.resolve(right);
}
