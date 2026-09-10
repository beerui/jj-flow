import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function runGit(cwd, args, { allowFailure = false } = {}) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' };
  for (const key of Object.keys(env)) {
    if (key.startsWith('GIT_TRACE') || ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR'].includes(key)) delete env[key];
  }
  env.GIT_TRACE2_EVENT = '0';
  const result = spawnSync('git', ['--literal-pathspecs', ...args], { cwd, env, encoding: 'utf8', windowsHide: true });
  if (allowFailure) return result;
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr || result.error || result.stdout}`);
  return result.stdout.trim();
}

export function configureGit(cwd) {
  for (const [key, value] of Object.entries({
    'user.name': 'jj-flow test', 'user.email': 'jj-flow@example.invalid',
    'commit.gpgsign': 'false', 'tag.gpgsign': 'false', 'core.autocrlf': 'false',
    'core.fsmonitor': 'false', 'maintenance.auto': 'false', 'gc.auto': '0',
    'core.hooksPath': path.join(cwd, '.git', 'hooks')
  })) runGit(cwd, ['config', key, value]);
}

export function gitFixture(t, { remote = false } = {}) {
  const tracing = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('GIT_TRACE')));
  for (const key of Object.keys(tracing)) delete process.env[key];
  process.env.GIT_TRACE2_EVENT = '0';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-flow-git-'));
  t.after(() => {
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
    finally { delete process.env.GIT_TRACE2_EVENT; Object.assign(process.env, tracing); }
  });
  const cwd = path.join(dir, '业务 work');
  fs.mkdirSync(cwd);
  runGit(cwd, ['init', '-b', 'main']);
  configureGit(cwd);
  const write = (file, text = 'initial\n') => {
    const absolute = path.join(cwd, file);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, text);
  };
  write('README.md');
  runGit(cwd, ['add', '--', 'README.md']);
  runGit(cwd, ['commit', '-m', 'chore(test): 初始化']);
  const bare = path.join(dir, 'remote.git');
  if (remote) {
    runGit(dir, ['init', '--bare', '-b', 'main', bare]);
    runGit(cwd, ['remote', 'add', 'origin', bare]);
    runGit(cwd, ['push', '-u', 'origin', 'main']);
    runGit(cwd, ['switch', '-c', 'work']);
  }
  const hook = (name, script, target = cwd) => {
    const hookPath = path.join(target, target === bare ? 'hooks' : '.git/hooks', name);
    fs.writeFileSync(hookPath, '#!/bin/sh\n' + script + '\n', { mode: 0o755 });
    fs.chmodSync(hookPath, 0o755);
    return hookPath;
  };
  const peer = () => {
    const peerCwd = path.join(dir, 'peer');
    runGit(dir, ['clone', bare, peerCwd]);
    configureGit(peerCwd);
    return peerCwd;
  };
  return { dir, cwd, bare, write, hook, peer, git: args => runGit(cwd, args) };
}
