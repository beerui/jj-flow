import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { previewEnd, executeEnd } from '../../src/end.mjs';
import { runEndCommand } from '../../src/endCli.mjs';
import { gitFixture, runGit } from '../helpers/git-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const preview = (f, extra = {}) => previewEnd({ cwd: f.cwd, paths: ['README.md'], message: 'feat(test): 更新文案', ...extra });
const remoteRef = (f, name) => runGit(f.bare, ['rev-parse', '--verify', `refs/heads/${name}`], { allowFailure: true });
const run = (f, plan) => executeEnd(plan, { cwd: f.cwd });

test('standalone installed end batches a Chinese rename and MM content, lands and returns without changing config', t => {
  const f = gitFixture(t, { remote: true });
  f.write('原 名.txt', 'rename content\n');
  f.git(['add', '--', '原 名.txt']);
  f.git(['commit', '-m', 'test: 准备文件']);
  f.git(['mv', '--', '原 名.txt', '新 名.txt']);
  f.write('README.md', 'staged\n');
  f.git(['add', '--', 'README.md']);
  f.write('README.md', 'staged plus unstaged\n');
  const config = fs.readFileSync(path.join(f.cwd, '.git/config'));
  const installed = path.join(f.dir, 'installed/jj-end');
  fs.cpSync(path.join(root, 'skills/jj-end'), installed, { recursive: true });
  const script = path.join(installed, 'scripts/end_ops.mjs');
  const planFile = path.join(f.dir, 'preview.json');
  const invoke = args => {
    const result = spawnSync(process.execPath, [script, ...args, '--cwd', f.cwd], {
      cwd: f.dir, encoding: 'utf8', env: { ...process.env, JJ_FLOW_ROOT: '' }, windowsHide: true
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  };
  const plan = invoke(['preview', '--path', 'README.md', '--path', '原 名.txt', '--path', '新 名.txt',
    '--message', 'feat(test): 更新中文文案和文件名', '--output', planFile]);
  assert.deepEqual(plan.blockers, []);
  const result = invoke(['execute', '--plan-file', planFile]);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.current_branch, 'work');
  assert.equal(result.pushed_work, true);
  assert.equal(result.pushed_integration, true);
  assert.equal(f.git(['show', 'HEAD:README.md']), 'staged plus unstaged');
  assert.equal(runGit(f.bare, ['show', 'main:新 名.txt']), 'rename content');
  assert.notEqual(runGit(f.bare, ['cat-file', '-e', 'main:原 名.txt'], { allowFailure: true }).status, 0);
  assert.equal(remoteRef(f, 'work').stdout.trim(), remoteRef(f, 'main').stdout.trim());
  assert.deepEqual(fs.readFileSync(path.join(f.cwd, '.git/config')), config);
  assert.equal(f.git(['status', '--porcelain']), '');
});

test('preview is read-only; unrelated staged/unstaged files are explicitly blocked and preserved', t => {
  const f = gitFixture(t, { remote: true });
  f.write('README.md', 'task\n');
  f.write('unrelated.txt', 'staged unrelated\n');
  f.git(['add', '--', 'unrelated.txt']);
  f.write('unrelated.txt', 'staged and unstaged unrelated\n');
  const index = fs.readFileSync(path.join(f.cwd, '.git/index'));
  const refs = f.git(['show-ref']);
  fs.utimesSync(path.join(f.cwd, 'README.md'), new Date(), new Date());
  const plan = preview(f);
  assert.match(plan.blockers.join('; '), /unselected dirty paths.*unrelated/);
  assert.deepEqual(fs.readFileSync(path.join(f.cwd, '.git/index')), index);
  assert.equal(f.git(['show-ref']), refs);
  const result = run(f, plan);
  assert.equal(result.status, 'blocked');
  assert.equal(result.steps.length, 0);
  assert.deepEqual(fs.readFileSync(path.join(f.cwd, '.git/index')), index);
  assert.equal(f.git(['show', ':unrelated.txt']), 'staged unrelated');
  assert.equal(fs.readFileSync(path.join(f.cwd, 'unrelated.txt'), 'utf8'), 'staged and unstaged unrelated\n');
  assert.equal(remoteRef(f, 'work').status, 128);
});

test('stale previews reject worktree, index, untracked, HEAD, branch, integration and remote changes before fetch', async t => {
  const mutations = {
    worktree: f => f.write('README.md', 'edited again\n'),
    index: f => f.git(['add', '--', 'README.md']),
    untracked: f => f.write('new.txt', 'new bytes\n'),
    head: f => { f.git(['add', '--', 'README.md']); f.git(['commit', '-m', 'test: 并发提交']); },
    branch: f => f.git(['switch', '-c', 'other-work']),
    integration: f => f.git(['update-ref', 'refs/heads/main', f.futureIntegration]),
    remote: f => f.git(['remote', 'set-url', 'origin', path.join(f.dir, 'different.git')])
  };
  for (const [name, mutate] of Object.entries(mutations)) await t.test(name, st => {
    const f = gitFixture(st, { remote: true });
    const base = f.git(['rev-parse', 'HEAD']);
    f.write('future.txt', 'future integration\n');
    f.git(['add', '--', 'future.txt']);
    f.git(['commit', '-m', 'test: 集成分支未来提交']);
    f.futureIntegration = f.git(['rev-parse', 'HEAD']);
    // Only the fixture rewinds its unpublished setup branch, before preview exists.
    f.git(['reset', '--hard', base]);
    f.write('README.md', 'task\n');
    f.write('new.txt', 'initial bytes\n');
    const plan = preview(f, { paths: ['README.md', 'new.txt'] });
    mutate(f);
    const before = f.git(['status', '--porcelain']);
    const result = run(f, plan);
    assert.equal(result.status, 'blocked', JSON.stringify(result));
    assert.match(result.error.message, /stale/);
    assert.equal(result.steps.length, 0);
    assert.equal(f.git(['status', '--porcelain']), before);
    assert.equal(remoteRef(f, 'work').status, 128);
  });
});

test('integration priority honors explicit documentation, remote-only targets, and missing/incorrect target guards', t => {
  const f = gitFixture(t, { remote: true });
  f.git(['branch', 'develop']);
  f.git(['push', 'origin', 'HEAD:refs/heads/dev']);
  f.write('AGENTS.md', '收尾合并到 develop。\n');
  f.git(['add', '--', 'AGENTS.md']);
  f.git(['commit', '-m', 'docs: 指定集成分支']);
  f.write('README.md', 'task\n');
  assert.equal(preview(f).integration.branch, 'dev');
  assert.equal(preview(f, { integration: 'main' }).integration.source, 'user');
  const convention = { branch: 'develop', source_path: 'AGENTS.md', excerpt: '收尾合并到 develop。' };
  assert.equal(preview(f, { convention }).integration.branch, 'develop');
  assert.match(preview(f, { convention: { ...convention, excerpt: 'pnpm build:develop' } }).blockers.join('; '), /explicit closeout/);
  assert.match(preview(f, { integration: 'absent' }).blockers.join('; '), /does not exist/);
  assert.match(preview(f, { work_branch: 'some-other-task' }).blockers.join('; '), /does not match/);
  fs.mkdirSync(path.join(f.cwd, 'subdir'));
  assert.throws(() => previewEnd({ cwd: path.join(f.cwd, 'subdir') }), /intended Git root/);
  const result = run(f, preview(f, { return_to: 'integration' }));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.current_branch, 'dev');
  assert.equal(f.git(['rev-parse', 'dev']), remoteRef(f, 'dev').stdout.trim());
});

test('same-branch no-op completes without self-merge', t => {
  const f = gitFixture(t, { remote: true });
  f.git(['switch', 'main']);
  const result = run(f, preview(f, { paths: [], message: null }));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.current_branch, 'main');
  assert.equal(result.steps.some(step => step.name === 'merge-work'), false);
  assert.equal(result.steps.some(step => step.name === 'commit'), false);
});

test('commit hooks and whitespace failures stop before any push; hook-added content is not published', async t => {
  for (const mode of ['reject', 'extra-path', 'same-path', 'whitespace']) await t.test(mode, st => {
    const f = gitFixture(st, { remote: true });
    f.write('README.md', mode === 'whitespace' ? 'trailing space  \n' : 'task\n');
    if (mode === 'reject') f.hook('pre-commit', 'exit 1');
    if (mode === 'extra-path') f.hook('pre-commit', 'printf "hook content\\n" > extra.txt\ngit add -- extra.txt');
    if (mode === 'same-path') f.hook('pre-commit', 'printf "unexpected replacement\\n" > README.md\ngit add -- README.md');
    const main = remoteRef(f, 'main').stdout;
    const result = run(f, preview(f));
    assert.equal(result.ok, false);
    assert.equal(result.error.step, 'commit', JSON.stringify(result));
    assert.equal(result.pushed_work, false);
    assert.equal(result.current_branch, 'work');
    assert.equal(remoteRef(f, 'main').stdout, main);
    assert.equal(remoteRef(f, 'work').status, 128);
    if (mode === 'extra-path' || mode === 'same-path') assert.match(result.error.message, /hook changed/);
  });
});

test('remote ahead/divergence is synchronized once and keeps destination-only changes off work', t => {
  const f = gitFixture(t, { remote: true });
  f.git(['push', 'origin', 'work']);
  const peer = f.peer();
  runGit(peer, ['switch', 'work']);
  fs.writeFileSync(path.join(peer, 'peer.txt'), 'remote work behavior\n');
  runGit(peer, ['add', '--', 'peer.txt']);
  runGit(peer, ['commit', '-m', 'feat: 远程工作分支新增行为']);
  runGit(peer, ['push', 'origin', 'work']);
  runGit(peer, ['switch', 'main']);
  fs.writeFileSync(path.join(peer, 'destination.txt'), 'destination behavior\n');
  runGit(peer, ['add', '--', 'destination.txt']);
  runGit(peer, ['commit', '-m', 'feat: 集成分支新增行为']);
  runGit(peer, ['push', 'origin', 'main']);
  f.write('README.md', 'local work behavior\n');
  const result = run(f, preview(f));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.steps.find(step => step.name === 'sync-work').fast_forward, false);
  assert.equal(result.steps.find(step => step.name === 'sync-integration').fast_forward, true);
  assert.equal(runGit(f.bare, ['show', 'main:destination.txt']), 'destination behavior');
  assert.equal(runGit(f.bare, ['show', 'main:peer.txt']), 'remote work behavior');
  assert.equal(runGit(f.bare, ['show', 'main:README.md']), 'local work behavior');
  assert.notEqual(runGit(f.bare, ['cat-file', '-e', 'work:destination.txt'], { allowFailure: true }).status, 0);
});

test('fetch failure stops without treating network failure as divergence or staging files', t => {
  const f = gitFixture(t, { remote: true });
  f.git(['remote', 'set-url', 'origin', path.join(f.dir, 'missing.git')]);
  f.write('README.md', 'task\n');
  const index = fs.readFileSync(path.join(f.cwd, '.git/index'));
  const before = f.git(['rev-parse', 'HEAD']);
  const result = run(f, preview(f));
  assert.equal(result.error.step, 'fetch');
  assert.equal(result.commit, null);
  assert.equal(f.git(['rev-parse', 'HEAD']), before);
  assert.deepEqual(fs.readFileSync(path.join(f.cwd, '.git/index')), index);
  assert.equal(result.steps.length, 1);
});

test('conflicts return both parent blobs, abort only the new merge, and resume after host resolution', t => {
  const f = gitFixture(t, { remote: true });
  const peer = f.peer();
  fs.writeFileSync(path.join(peer, 'README.md'), 'destination behavior\n');
  runGit(peer, ['add', '--', 'README.md']);
  runGit(peer, ['commit', '-m', 'feat: 集成分支行为']);
  runGit(peer, ['push', 'origin', 'main']);
  f.write('README.md', 'work behavior\n');
  const failed = run(f, preview(f));
  assert.equal(failed.ok, false);
  assert.equal(failed.error.step, 'merge-work', JSON.stringify(failed));
  assert.equal(failed.pushed_work, true);
  assert.equal(failed.pushed_integration, false);
  assert.equal(failed.merge_aborted, true);
  assert.equal(failed.merge_in_progress, false);
  assert.equal(failed.current_branch, 'work');
  assert.equal(failed.conflict.files[0].path, 'README.md');
  assert.equal(f.git(['cat-file', '-p', failed.conflict.files[0].ours]), 'destination behavior');
  assert.equal(f.git(['cat-file', '-p', failed.conflict.files[0].theirs]), 'work behavior');
  f.git(['switch', 'main']);
  assert.equal(runGit(f.cwd, ['merge', '--no-edit', failed.work_commit], { allowFailure: true }).status, 1);
  const pending = run(f, preview(f, { paths: [], message: null }));
  assert.equal(pending.status, 'blocked');
  assert.equal(pending.steps.length, 0);
  assert.equal(pending.merge_in_progress, true, 'pre-existing merge must not be aborted by the runner');
  f.write('README.md', 'destination behavior\nwork behavior\n');
  f.git(['add', '--', 'README.md']);
  f.git(['commit', '-m', 'fix(merge): 保留双方行为']);
  f.git(['switch', 'work']);
  const resumed = run(f, preview(f, { paths: [], message: null }));
  assert.equal(resumed.ok, true, JSON.stringify(resumed));
  assert.equal(runGit(f.bare, ['show', 'main:README.md']), 'destination behavior\nwork behavior');
});

test('remote rejection stops at the correct push and a fresh preview recovers partial closeout', async t => {
  for (const rejected of ['work', 'main']) await t.test(rejected, st => {
    const f = gitFixture(st, { remote: true });
    const hook = f.hook('pre-receive', `while read old new ref; do\n  if [ "$ref" = "refs/heads/${rejected}" ]; then exit 1; fi\ndone\nexit 0`, f.bare);
    f.write('README.md', 'task\n');
    const main = remoteRef(f, 'main').stdout;
    const result = run(f, preview(f));
    assert.equal(result.ok, false);
    assert.equal(result.error.step, rejected === 'work' ? 'push-work' : 'push-integration', JSON.stringify(result));
    assert.equal(result.pushed_work, rejected !== 'work');
    assert.equal(result.pushed_integration, false);
    assert.equal(result.current_branch, 'work');
    assert.equal(remoteRef(f, 'main').stdout, main);
    if (rejected === 'work') assert.equal(result.steps.some(step => step.name === 'sync-integration'), false);
    fs.unlinkSync(hook);
    const resumed = run(f, preview(f, { paths: [], message: null }));
    assert.equal(resumed.ok, true, JSON.stringify(resumed));
    assert.equal(runGit(f.bare, ['show', 'main:README.md']), 'task');
  });
});

test('CLI JSON inputs are shell independent and preview output cannot mutate its own repository', t => {
  const f = gitFixture(t, { remote: true });
  f.write('README.md', 'task\n');
  const paths = path.join(f.dir, 'paths.json');
  const message = path.join(f.dir, 'message.txt');
  fs.writeFileSync(paths, '\uFEFF["README.md"]');
  fs.writeFileSync(message, '\uFEFFfeat(label): 更新文案\n\n保留 "引号" 和 $()。\n');
  const chunks = [];
  const options = { cwd: f.cwd, stdout: { write: text => chunks.push(text) } };
  assert.equal(runEndCommand(['preview', '--paths-file', paths, '--message-file', message], options), 0);
  assert.match(JSON.parse(chunks.join('')).inputs.message, /\$\(\)/);
  assert.throws(() => runEndCommand(['preview', '--path', 'README.md', '--message', 'feat: 更新', '--output', '.git/preview.json'], options), /outside the repository/);
  const edited = preview(f);
  edited.task_paths = [];
  assert.equal(run(f, edited).status, 'blocked');
});
