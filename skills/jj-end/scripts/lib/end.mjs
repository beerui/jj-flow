import fs from 'node:fs';
import path from 'node:path';
import { assertSnapshot, digest, git, gitStatus, normalizeGitPath, resolveCommit, snapshotGit } from './gitSnapshot.mjs';

const SCHEMA = 'jj-flow/end-preview/1';
const redact = text => String(text).replace(/(https?:\/\/)[^/\s@]+@/gi, '$1[redacted]@');
const head = cwd => resolveCommit('HEAD', cwd);
const branch = cwd => git(['symbolic-ref', '--quiet', '--short', 'HEAD'], cwd, { optional: true })?.trim() || null;
const ref = (name, cwd) => git(['rev-parse', '--verify', '--end-of-options', name], cwd, { optional: true })?.trim() || null;
const gitPath = (name, cwd) => path.resolve(cwd, git(['rev-parse', '--git-path', name], cwd).trim());

function assertName(value, kind, cwd) {
  if (typeof value !== 'string' || !value || value.startsWith('-') || value === 'HEAD'
    || git(['check-ref-format', `refs/${kind}/${value}`], cwd, { optional: true }) === null) {
    throw new Error(`invalid ${kind} name: ${value}`);
  }
  return value;
}

function operations(cwd) {
  const stateDir = git(['rev-parse', '--absolute-git-dir'], cwd).trim();
  return ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'sequencer', 'BISECT_LOG']
    .filter(name => fs.existsSync(path.join(stateDir, name)));
}

function remoteInfo(name, cwd) {
  assertName(name, 'remotes', cwd);
  const fetch = git(['remote', 'get-url', '--all', name], cwd, { optional: true });
  const push = git(['remote', 'get-url', '--push', '--all', name], cwd, { optional: true });
  if (!fetch || !push) throw new Error('remote is missing: ' + name);
  if (fetch.trim().split(/\r?\n/).length !== 1 || push.trim().split(/\r?\n/).length !== 1) throw new Error('end requires a single fetch URL and push URL');
  if (git(['config', '--get', '--bool', `remote.${name}.mirror`], cwd, { optional: true })?.trim() === 'true') throw new Error('mirror remote is not supported by end');
  return { name, fetch_url: redact(fetch.trim()), push_url: redact(push.trim()), identity: digest(fetch + '\0' + push) };
}

function integrationFor(inputs, cwd) {
  const exists = name => ref(`refs/heads/${name}`, cwd) || ref(`refs/remotes/${inputs.remote}/${name}`, cwd);
  if (inputs.integration) {
    assertName(inputs.integration, 'heads', cwd);
    if (!exists(inputs.integration)) throw new Error('explicit integration branch does not exist: ' + inputs.integration);
    return { branch: inputs.integration, source: 'user' };
  }
  if (inputs.convention) {
    const { branch: name, source_path, excerpt } = inputs.convention;
    assertName(name, 'heads', cwd);
    if (!source_path || !excerpt || !excerpt.includes(name) || !/closeout|land|merge.target|integration|收尾|合入|合并到|合并目标|集成/i.test(excerpt)) {
      throw new Error('convention needs an explicit closeout branch sentence, its source_path and excerpt');
    }
    const source = fs.readFileSync(path.resolve(cwd, source_path), 'utf8');
    if (!source.includes(excerpt)) throw new Error('convention excerpt does not match its source');
    if (!exists(name)) throw new Error('documented integration branch does not exist: ' + name);
    return { branch: name, source: 'docs', source_path, excerpt, source_sha256: digest(source) };
  }
  const name = ['dev', 'develop', 'main'].find(exists);
  if (!name) throw new Error('no integration branch; specify an existing target');
  return { branch: name, source: 'heuristic' };
}

function refsFor(work, integration, remote, cwd) {
  return Object.fromEntries([
    `refs/heads/${work}`, `refs/heads/${integration}`,
    `refs/remotes/${remote}/${work}`, `refs/remotes/${remote}/${integration}`
  ].map(name => [name, ref(name, cwd)]));
}

function previewDigest(preview) {
  const { fingerprint, created_at, ...body } = preview;
  return digest(JSON.stringify(body));
}

/** Pure repository read. Saving this plan, if requested, happens outside the repo. */
export function previewEnd({ cwd = process.cwd(), work_branch = null, integration = null, convention = null,
  remote = 'origin', message = null, paths = [], return_to = 'work' } = {}) {
  const snapshot = snapshotGit(cwd);
  if (snapshot.root !== fs.realpathSync(cwd)) throw new Error('end cwd must be the intended Git root: ' + snapshot.root);
  if (!Array.isArray(paths)) throw new Error('paths must be an array of exact repository paths');
  const selected = [...new Set(paths.map(file => normalizeGitPath(file)))].sort();
  const inputs = { cwd: snapshot.root, work_branch, integration, convention, remote, message, paths: selected, return_to };
  const blockers = [];
  const overrides = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR'].filter(key => process.env[key]);
  if (overrides.length) blockers.push('Git environment overrides must be cleared for end: ' + overrides.join(', '));
  const work = snapshot.branch;
  if (!work || !snapshot.head) blockers.push('detached HEAD or repository without an initial commit');
  if (work_branch && work_branch !== work) blockers.push('working branch does not match the requested task branch: ' + work_branch);
  if (!['work', 'integration'].includes(return_to)) blockers.push('return_to must be work or integration');
  const pending = operations(snapshot.root);
  if (pending.length) blockers.push('unfinished Git operation: ' + pending.join(', '));
  if (snapshot.contents.some(item => item.kind === 'directory')) blockers.push('dirty submodules/directories require separate closeout');
  const other = snapshot.paths.filter(file => !selected.includes(file));
  if (other.length) blockers.push('unselected dirty paths must be handled before batch closeout: ' + other.join(', '));
  const unchanged = selected.filter(file => !snapshot.paths.includes(file));
  if (unchanged.length) blockers.push('selected paths are not dirty: ' + unchanged.join(', '));
  if (selected.length && !/^(?:feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(?:\([^\r\n)]+\))?!?: [^\r\n]*\p{Script=Han}/u.test(message || '')) {
    blockers.push('commit message must be a Chinese Conventional Commit');
  }
  let remoteFacts = null;
  let target = null;
  try { remoteFacts = remoteInfo(remote, snapshot.root); } catch (error) { blockers.push(redact(error.message)); }
  if (remoteFacts) {
    try { target = integrationFor(inputs, snapshot.root); } catch (error) { blockers.push(redact(error.message)); }
  }
  const preview = {
    schema_version: SCHEMA, created_at: new Date().toISOString(), inputs,
    root: snapshot.root, work_branch: work, integration: target, remote: remoteFacts,
    snapshot, refs: work && target ? refsFor(work, target.branch, remote, snapshot.root) : {},
    task_paths: selected, other_paths: other, blockers,
    actions: ['fetch', 'resolve', ...(selected.length ? ['commit'] : []), 'sync-work', 'push-work',
      ...(work === target?.branch ? [] : ['sync-integration', 'merge-work', 'push-integration']), 'return']
  };
  return { ...preview, fingerprint: previewDigest(preview) };
}

function isAncestor(ancestor, descendant, cwd) {
  try { git(['merge-base', '--is-ancestor', ancestor, descendant], cwd); return true; }
  catch (error) { if (error.exitCode === 1) return false; throw error; }
}

function assertClean(cwd) {
  const entries = gitStatus(cwd);
  if (entries.length) throw new Error('working tree/index changed during end: ' + entries.map(entry => entry.path).join(', '));
  if (operations(cwd).length) throw new Error('unfinished Git operation during end');
}

function conflictFacts(cwd, before, target) {
  const files = new Map();
  for (const field of git(['ls-files', '--unmerged', '-z'], cwd).split('\0').filter(Boolean)) {
    const match = /^(\d+) ([0-9a-f]+) ([123])\t([\s\S]+)$/.exec(field);
    if (!match) continue;
    const file = normalizeGitPath(match[4], { literal: true });
    const item = files.get(file) || { path: file, base: null, ours: null, theirs: null };
    item[{ 1: 'base', 2: 'ours', 3: 'theirs' }[match[3]]] = match[2];
    files.set(file, item);
  }
  return { branch: branch(cwd), ours_commit: before, theirs_commit: target, files: [...files.values()] };
}

function merge(cwd, target, result) {
  assertClean(cwd);
  const before = head(cwd);
  const targetSha = resolveCommit(target, cwd);
  if (isAncestor(targetSha, before, cwd)) return { skipped: true, head: before };
  const fastForward = isAncestor(before, targetSha, cwd);
  let expectedTree = fastForward ? ref(`${targetSha}^{tree}`, cwd) : null;
  if (!fastForward) {
    try { expectedTree = git(['merge-tree', '--write-tree', before, targetSha], cwd).split(/\r?\n/)[0]; }
    catch (error) { if (error.exitCode !== 1) throw error; } // Real merge below provides conflict stages.
  }
  try {
    git(['merge', ...(fastForward ? ['--ff-only'] : ['--no-edit']), targetSha], cwd);
  } catch (error) {
    if (fs.existsSync(gitPath('MERGE_HEAD', cwd))) {
      try { result.conflict = conflictFacts(cwd, before, targetSha); }
      finally {
        try { git(['merge', '--abort'], cwd); result.merge_aborted = true; }
        catch (abortError) { result.abort_error = redact(abortError.message); }
      }
    }
    throw error;
  }
  if (!expectedTree || ref('HEAD^{tree}', cwd) !== expectedTree || !isAncestor(before, head(cwd), cwd) || !isAncestor(targetSha, head(cwd), cwd)) {
    throw new Error('merge result differs from the computed tree; inspect hooks/local commit before pushing');
  }
  assertClean(cwd);
  return { head: head(cwd), fast_forward: fastForward };
}

function remoteHeads(remote, names, cwd) {
  const output = git(['ls-remote', '--heads', '--refs', remote, ...names.map(name => `refs/heads/${name}`)], cwd);
  return Object.fromEntries(output.trim().split(/\r?\n/).filter(Boolean).map(line => {
    const [sha, name] = line.split(/\s+/);
    return [name.slice('refs/heads/'.length), sha];
  }));
}

/** Execute only the exact, still-current preview. No force, stash, rebase or branch deletion. */
export function executeEnd(preview, { cwd = process.cwd() } = {}) {
  const result = { ok: false, status: 'blocked', steps: [], pushed_work: false, pushed_integration: false, commit: null };
  let stepName = 'preflight';
  let lock = null;
  let lockFile = null;
  let started = false;
  let root = cwd;
  const step = (name, fn) => {
    stepName = name;
    const start = Date.now();
    try {
      const value = fn();
      result.steps.push({ name, status: 'done', duration_ms: Date.now() - start, ...(value || {}) });
      return value;
    } catch (error) {
      result.steps.push({ name, status: 'failed', duration_ms: Date.now() - start });
      throw error;
    }
  };
  try {
    if (preview?.schema_version !== SCHEMA || previewDigest(preview) !== preview.fingerprint) throw new Error('invalid or edited end preview');
    if (fs.realpathSync(cwd) !== preview.root) throw new Error('end cwd differs from the preview root');
    root = preview.root;
    const current = previewEnd({ ...preview.inputs, cwd: root });
    if (preview.fingerprint !== current.fingerprint) throw new Error('end preview is stale; regenerate it before executing');
    if (current.blockers.length) throw new Error(current.blockers.join('; '));
    const work = preview.work_branch;
    const integration = preview.integration.branch;
    const remote = preview.remote.name;
    result.work_branch = work;
    result.integration = integration;
    lockFile = gitPath('jj-end.lock', root);
    lock = fs.openSync(lockFile, 'wx');
    fs.writeFileSync(lock, String(process.pid));
    started = true;
    step('fetch', () => git(['fetch', '--no-tags', '--no-recurse-submodules', remote, `+refs/heads/*:refs/remotes/${remote}/*`], root) && null);
    const fetched = step('resolve', () => {
      assertSnapshot(preview.snapshot, snapshotGit(root));
      if (remoteInfo(remote, root).identity !== preview.remote.identity) throw new Error('remote URL changed during fetch');
      const resolved = integrationFor(preview.inputs, root);
      if (JSON.stringify(resolved) !== JSON.stringify(preview.integration)) throw new Error('integration target changed after fetch; regenerate preview');
      for (const name of new Set([work, integration])) {
        if (ref(`refs/heads/${name}`, root) !== preview.refs[`refs/heads/${name}`]) throw new Error('local branch changed during fetch: ' + name);
      }
      const heads = remoteHeads(remote, [...new Set([work, integration])], root);
      for (const name of new Set([work, integration])) {
        if (!heads[name] && preview.refs[`refs/remotes/${remote}/${name}`]) throw new Error('remote branch disappeared: ' + name);
        if (heads[name] && heads[name] !== ref(`refs/remotes/${remote}/${name}`, root)) throw new Error('remote changed during fetch: ' + name);
      }
      return { remote_heads: heads };
    }).remote_heads;
    if (preview.task_paths.length) step('commit', () => {
      assertSnapshot(preview.snapshot, snapshotGit(root));
      git(['diff', '--check'], root);
      const indexed = new Set(git(['ls-files', '-z'], root).split('\0').filter(Boolean));
      // An already-staged deletion/rename source no longer matches `git add`.
      const stageable = preview.task_paths.filter(file => indexed.has(file)
        || preview.snapshot.contents.some(item => item.path === file && item.kind !== 'deleted'));
      if (stageable.length) git(['add', '--', ...stageable], root);
      git(['diff', '--cached', '--check'], root);
      const afterStage = snapshotGit(root);
      if (afterStage.head !== preview.snapshot.head || afterStage.branch !== work
        || JSON.stringify(afterStage.contents) !== JSON.stringify(preview.snapshot.contents)) {
        throw new Error('working files changed while staging; inspect the index and regenerate preview');
      }
      const staged = git(['diff', '--cached', '--name-only', '--no-renames', '-z'], root).split('\0').filter(Boolean);
      if (staged.some(file => !preview.task_paths.includes(file))) throw new Error('index contains paths outside the preview');
      const tree = git(['write-tree'], root).trim();
      const before = head(root);
      git(['commit', '-m', preview.inputs.message], root);
      result.commit = head(root);
      const committed = git(['diff-tree', '--no-commit-id', '--name-only', '--no-renames', '-r', '-z', before, result.commit], root).split('\0').filter(Boolean);
      if (branch(root) !== work || ref('HEAD^', root) !== before || ref('HEAD^{tree}', root) !== tree
        || committed.some(file => !preview.task_paths.includes(file))) {
        throw new Error('commit/hook changed the expected tree or branch; local commit requires review before push');
      }
      assertClean(root);
      return { commit: result.commit };
    });
    step('sync-work', () => {
      assertClean(root);
      if (branch(root) !== work) throw new Error('working branch changed before sync');
      return fetched[work] ? merge(root, fetched[work], result) : { skipped: true };
    });
    step('push-work', () => {
      assertClean(root);
      const sha = head(root);
      if (branch(root) !== work || remoteInfo(remote, root).identity !== preview.remote.identity) throw new Error('branch/remote changed before push');
      git(['push', '--porcelain', '--no-follow-tags', remote, `${sha}:refs/heads/${work}`], root);
      result.pushed_work = true;
      result.work_commit = sha;
      if (head(root) !== sha || branch(root) !== work) throw new Error('HEAD/branch changed in push hook');
      assertClean(root);
      return { commit: sha };
    });
    if (work !== integration) {
      step('sync-integration', () => {
        assertClean(root);
        if (ref(`refs/heads/${integration}`, root) !== preview.refs[`refs/heads/${integration}`]) throw new Error('integration branch changed concurrently');
        if (ref(`refs/heads/${integration}`, root)) git(['switch', '--no-guess', integration], root);
        else git(['switch', '-c', integration, '--no-track', fetched[integration]], root);
        if (branch(root) !== integration) throw new Error('integration checkout changed unexpectedly');
        return fetched[integration] ? merge(root, fetched[integration], result) : { skipped: true };
      });
      step('merge-work', () => {
        if (branch(root) !== integration || ref(`refs/heads/${work}`, root) !== result.work_commit) throw new Error('work/integration branch changed before merge');
        return merge(root, result.work_commit, result);
      });
      step('push-integration', () => {
        assertClean(root);
        const sha = head(root);
        if (branch(root) !== integration || remoteInfo(remote, root).identity !== preview.remote.identity) throw new Error('branch/remote changed before integration push');
        git(['push', '--porcelain', '--no-follow-tags', remote, `${sha}:refs/heads/${integration}`], root);
        result.pushed_integration = true;
        if (head(root) !== sha || branch(root) !== integration) throw new Error('HEAD/branch changed in push hook');
        assertClean(root);
        return { commit: sha };
      });
    } else result.pushed_integration = result.pushed_work;
    step('return', () => {
      const target = preview.inputs.return_to === 'integration' ? integration : work;
      assertClean(root);
      if (branch(root) !== target) git(['switch', '--no-guess', target], root);
      if (branch(root) !== target) throw new Error('return branch changed unexpectedly');
    });
    result.ok = true;
    result.status = 'landed';
  } catch (error) {
    result.error = { step: stepName, message: redact(error.message) };
    result.status = result.pushed_integration ? 'landed_return_failed' : started ? 'stopped' : 'blocked';
    if (started && branch(root) !== result.work_branch) {
      try {
        assertClean(root);
        git(['switch', '--no-guess', result.work_branch], root);
      } catch (returnError) { result.return_error = redact(returnError.message); }
    }
    if (result.conflict) result.recovery = 'Inspect both parent blobs, resolve on the recorded branch, verify and commit the merge, then regenerate preview and execute. This aborted batch is not a completed closeout.';
    else if (started) result.recovery = 'Inspect the reported local Git state, fix the failure, then regenerate preview and execute; completed pushes are safe to repeat.';
  } finally {
    if (lock !== null) {
      fs.closeSync(lock);
      if (fs.existsSync(lockFile) && fs.readFileSync(lockFile, 'utf8') === String(process.pid)) fs.unlinkSync(lockFile);
    }
    result.current_branch = branch(root);
    result.merge_in_progress = fs.existsSync(path.resolve(root, git(['rev-parse', '--git-path', 'MERGE_HEAD'], root, { optional: true })?.trim() || '.git/MERGE_HEAD'));
  }
  return result;
}
