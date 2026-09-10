import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const digest = value => crypto.createHash('sha256').update(value).digest('hex');

/** Argument arrays work in PowerShell, Bash and installed skills without shell quoting. */
export function git(args, cwd, { optional = false } = {}) {
  const result = spawnSync('git', ['--literal-pathspecs', ...args], {
    cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' }
  });
  if (result.error || result.status !== 0) {
    if (optional) return null;
    const error = new Error(`git ${args[0]} failed: ${result.error?.message || result.stderr?.trim() || result.stdout?.trim() || result.status}`);
    error.exitCode = result.status;
    error.stdout = result.stdout;
    throw error;
  }
  return result.stdout;
}

export function normalizeGitPath(value, { literal = false } = {}) {
  if (typeof value !== 'string' || !value || /[\0\r\n]/.test(value)) throw new Error('invalid repository path');
  const normalized = (literal ? value : value.replaceAll('\\', '/')).replace(/^\.\//, '');
  if (path.posix.isAbsolute(normalized) || /^[a-zA-Z]:/.test(normalized)
    || normalized.split('/').some(part => part === '..' || part.toLowerCase() === '.git') || normalized === '.') {
    throw new Error(`path must stay inside the repository: ${value}`);
  }
  return normalized;
}

export function gitStatus(cwd) {
  const fields = git(['-c', 'core.fsmonitor=false', 'status', '--porcelain=v1', '-z', '--untracked-files=all'], cwd).split('\0');
  const entries = [];
  for (let i = 0; i < fields.length; i += 1) {
    if (!fields[i]) continue;
    const status = fields[i].slice(0, 2);
    const entry = { status, path: normalizeGitPath(fields[i].slice(3), { literal: true }) };
    if (/[RC]/.test(status)) entry.original_path = normalizeGitPath(fields[++i], { literal: true });
    entries.push(entry);
  }
  return entries;
}

export function snapshotGit(cwd, { include = () => true } = {}) {
  const root = fs.realpathSync(git(['rev-parse', '--show-toplevel'], cwd).trim());
  const head = git(['rev-parse', '--verify', 'HEAD'], root, { optional: true })?.trim() || null;
  const branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], root, { optional: true })?.trim() || null;
  const entries = gitStatus(root).filter(entry => include(entry.path) || (entry.original_path && include(entry.original_path)));
  const paths = [...new Set(entries.flatMap(entry => [entry.path, entry.original_path].filter(Boolean)))].sort();
  const contents = paths.map(file => {
    const absolute = path.join(root, file);
    let stat;
    try { stat = fs.lstatSync(absolute); } catch (error) {
      if (error.code === 'ENOENT') return { path: file, kind: 'deleted' };
      throw error;
    }
    if (stat.isSymbolicLink()) return { path: file, kind: 'symlink', sha256: digest(fs.readlinkSync(absolute)) };
    if (stat.isFile()) return { path: file, kind: 'file', sha256: digest(fs.readFileSync(absolute)), mode: stat.mode & 0o777 };
    return { path: file, kind: 'directory', head: git(['-C', absolute, 'rev-parse', 'HEAD'], root, { optional: true })?.trim() || null };
  });
  const diff = extra => paths.length ? git(['diff', ...extra, '--binary', '--no-ext-diff', '--no-textconv', '--', ...paths], root) : '';
  const state = {
    root, head, branch, entries, contents,
    staged_sha256: digest(diff(['--cached'])), worktree_sha256: digest(diff([]))
  };
  const finalEntries = gitStatus(root).filter(entry => include(entry.path) || (entry.original_path && include(entry.original_path)));
  if (JSON.stringify(entries) !== JSON.stringify(finalEntries)
    || head !== (git(['rev-parse', '--verify', 'HEAD'], root, { optional: true })?.trim() || null)
    || branch !== (git(['symbolic-ref', '--quiet', '--short', 'HEAD'], root, { optional: true })?.trim() || null)) {
    throw new Error('workspace changed while collecting snapshot; retry when stable');
  }
  return { ...state, paths, fingerprint: digest(JSON.stringify(state)) };
}

export function assertSnapshot(expected, actual) {
  if (!expected?.fingerprint || expected.root !== actual.root || expected.fingerprint !== actual.fingerprint) {
    throw new Error('workspace snapshot is stale; regenerate the preview/context before continuing');
  }
}

export function resolveCommit(ref, cwd) {
  if (typeof ref !== 'string' || !ref || /[\0\r\n]/.test(ref)) throw new Error('commit reference required');
  return git(['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`], cwd).trim();
}

/** Compare real commit trees. Renames are represented by both endpoints. */
export function snapshotCommit(cwd, { reviewed_commit = 'HEAD', base_commit = null, include = () => true } = {}) {
  const reviewed = resolveCommit(reviewed_commit, cwd);
  const base = base_commit ? resolveCommit(base_commit, cwd)
    : git(['rev-parse', '--verify', `${reviewed}^`], cwd, { optional: true })?.trim() || null;
  const command = base ? ['diff', base, reviewed] : ['diff-tree', '--root', '--no-commit-id', '-r', reviewed];
  const fields = git([...command, '--name-status', '--no-renames', '-z', '--'], cwd).split('\0');
  const entries = [];
  for (let i = 0; i < fields.length - 1; i += 2) {
    const file = normalizeGitPath(fields[i + 1], { literal: true });
    if (include(file)) entries.push({ status: fields[i], path: file });
  }
  const paths = entries.map(entry => entry.path).sort();
  const binary = paths.length ? git([...command, '--binary', '--no-renames', '--no-ext-diff', '--no-textconv', '--', ...paths], cwd) : '';
  return { reviewed_commit: reviewed, base_commit: base, paths, entries, sha256: digest(binary) };
}
