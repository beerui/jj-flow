import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runCli } from '../src/cli.mjs';
import {
  RALPH_MAP_SCHEMA_VERSION,
  RALPH_RUN_SCHEMA_VERSION,
  findInMap,
  initRun,
  loadMap,
  mapFind,
  mapMergeFromRun,
  saveRun,
  validateMap,
  recordReview,
  validateRun
} from '../src/ralph.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

test('ralph schemas, samples, skill and command assets exist with key markers', () => {
  for (const rel of [
    'schemas/ralph-run.schema.json',
    'schemas/ralph-business-map.schema.json',
    'examples/ralph/sample-run.json',
    'examples/ralph/sample-business-map.json',
    '.codex/skills/jj-ralph/SKILL.md',
    '.codex/skills/jj-ralph/references/artifact-layout.md',
    '.codex/skills/jj-ralph/references/phases.md',
    '.codex/skills/jj-ralph/references/business-map.md',
    '.codex/skills/jj-ralph/references/integrations.md',
    '.codex/skills/jj-ralph/references/ralph-run.schema.json',
    '.codex/skills/jj-ralph/references/business-map.schema.json',
    '.claude/commands/jj-ralph.md',
    'docs/commands/jj-ralph.md',
    'docs/design-docs/jj-ralph.md'
  ]) {
    assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
  }

  const skill = read('.codex/skills/jj-ralph/SKILL.md');
  for (const marker of [
    'ANALYZE',
    'PLAN',
    'DELIVER',
    'ACCEPT',
    'ARCHIVE',
    '.workflow/ralph',
    'business-map',
    'handoff',
    'jj-dispatch',
    'map-find'
  ]) {
    assert.match(skill, new RegExp(marker));
  }
  assert.doesNotMatch(skill, /[Mm]aestro/);

  const command = read('.claude/commands/jj-ralph.md');
  assert.match(command, /\.workflow\/ralph\/RALPH/);
  assert.match(command, /map-find/);
  assert.doesNotMatch(command, /[Mm]aestro/);

  const layout = read('.codex/skills/jj-ralph/references/artifact-layout.md');
  assert.match(layout, /\.workflow\/ralph\/RALPH/);
  assert.doesNotMatch(layout, /ralph\/ralphs\//);
  assert.doesNotMatch(layout, /ralphs\/RALPH/);
  assert.doesNotMatch(layout, /ralph\/runs\//);
});

test('sample run and business map validate', () => {
  const run = readJson('examples/ralph/sample-run.json');
  const map = readJson('examples/ralph/sample-business-map.json');
  assert.equal(run.schema_version, RALPH_RUN_SCHEMA_VERSION);
  assert.equal(map.schema_version, RALPH_MAP_SCHEMA_VERSION);
  assert.deepEqual(validateRun(run), []);
  assert.deepEqual(validateMap(map), []);
  assert.equal(run.artifact_refs.analyze, 'analyze.md');
  assert.ok(map.capabilities[0].run_refs.includes('RALPH-login-reminder-20260722'));
});

test('map-merge then map-find recovers historical capability and run paths', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-map-'));
  try {
    const runId = 'RALPH-login-reminder-20260722';
    initRun(
      {
        run_id: runId,
        title: '登录密码更新提醒',
        goal: '登录成功后提示更新过期密码',
        capability_ids: ['CAP-login-reminder']
      },
      cwd
    );
    const runPath = path.join(cwd, '.workflow', 'ralph', runId, 'run.json');
    const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
    run.phase = 'ACCEPT';
    run.gates = {
      analyze: 'PASS',
      plan: 'PASS',
      deliver: 'PASS',
      accept: 'PASS',
      archive: 'PENDING'
    };
    run.tasks = [
      {
        id: 'TASK-1',
        req: 'REQ-001',
        title: '识别 password_expired',
        status: 'DONE',
        evidence: ['src/api/auth.js']
      }
    ];
    saveRun(run, cwd);

    const merged = mapMergeFromRun(runId, {
      lessons: ['password_expired 只在登录成功响应读取'],
      keywords: ['password', '登录', '过期']
    }, cwd);
    assert.equal(merged.capability.id, 'CAP-login-reminder');

    const map = loadMap(cwd);
    assert.equal(map.capabilities.length, 1);

    const byTitle = findInMap(map, '登录密码更新提醒');
    assert.ok(byTitle.length >= 1);
    assert.equal(byTitle[0].id, 'CAP-login-reminder');
    assert.ok(byTitle[0].run_refs.includes(runId));
    assert.ok(byTitle[0].discover_paths.some((p) => p.includes(`.workflow/ralph/${runId}/run.json`)));

    const byKeyword = mapFind('password_expired 登录', { cwd });
    assert.ok(byKeyword.matches.some((item) => item.id === 'CAP-login-reminder'));
    assert.ok(byKeyword.matches[0].lessons.some((lesson) => lesson.includes('password_expired')));

    // Simulate a fresh model session: only map + discover_paths, no prior chat.
    const hit = byKeyword.matches[0];
    const recoveredRun = JSON.parse(
      fs.readFileSync(path.join(cwd, hit.discover_paths.find((p) => p.endsWith('run.json'))), 'utf8')
    );
    assert.equal(recoveredRun.run_id, runId);
    assert.equal(recoveredRun.title, '登录密码更新提醒');
    assert.ok(fs.existsSync(path.join(cwd, hit.discover_paths.find((p) => p.endsWith('progress.md')))));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('cli ralph archive, handoff, dispatch-snapshot and commit-prep work end-to-end', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-cli-'));
  const chunks = [];
  const stdout = { write: (text) => chunks.push(text) };
  try {
    const runId = 'RALPH-demo-20260722';
    assert.equal(
      runCli(
        [
          'ralph',
          'init',
          '--run-id',
          runId,
          '--title',
          '演示闭环',
          '--goal',
          '验证机械步骤',
          '--capability',
          'CAP-demo',
          '--json'
        ],
        { cwd, stdout }
      ),
      0
    );

    const runPath = path.join(cwd, '.workflow', 'ralph', runId, 'run.json');
    const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
    run.gates.accept = 'PASS';
    run.gates.analyze = 'PASS';
    run.gates.plan = 'PASS';
    run.gates.deliver = 'PASS';
    run.tasks = [{ id: 'TASK-1', req: 'REQ-001', status: 'DONE', evidence: ['src/demo.js'] }];
    fs.writeFileSync(runPath, `${JSON.stringify(run, null, 2)}\n`);

    chunks.length = 0;
    assert.equal(runCli(['ralph', 'map-merge', '--run-id', runId, '--json'], { cwd, stdout }), 0);
    assert.equal(runCli(['ralph', 'archive', '--run-id', runId, '--json'], { cwd, stdout }), 0);
    assert.equal(runCli(['ralph', 'handoff', '--run-id', runId, '--json'], { cwd, stdout }), 0);
    assert.equal(runCli(['ralph', 'dispatch-snapshot', '--run-id', runId, '--json'], { cwd, stdout }), 0);
    assert.equal(runCli(['ralph', 'commit-prep', '--run-id', runId, '--json'], { cwd, stdout }), 0);
    assert.equal(runCli(['ralph', 'map-find', '--query', '演示', '--json'], { cwd, stdout }), 0);

    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'business-map.json')));
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'archive')));
    const handoffDirs = fs.readdirSync(path.join(cwd, '.workflow', 'handoffs'));
    assert.ok(handoffDirs.length >= 1);
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'handoffs', handoffDirs[0], 'handoff.json')));
    assert.ok(
      fs.existsSync(
        path.join(cwd, '.workflow', 'dispatch', 'recommendations', `SNAP-demo-20260722`, 'snapshot.json')
      )
    );

    const mapFindOut = JSON.parse(chunks[chunks.length - 1]);
    assert.ok(mapFindOut.matches.some((item) => item.id === 'CAP-demo'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});


test('review-record associates task/review threads on ralph run', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-review-'));
  const chunks = [];
  const stdout = { write: (text) => chunks.push(text) };
  try {
    const runId = 'RALPH-review-demo-20260723';
    assert.equal(runCli(['ralph', 'init', '--run-id', runId, '--title', 'review demo', '--goal', 'link sessions', '--json'], { cwd, stdout }), 0);
    chunks.length = 0;
    assert.equal(runCli(['ralph', 'review-record', '--run-id', runId, '--outcome', 'PASS', '--reviewed-commit', 'abcdef1234567', '--task-thread', '019f8c85-8c32-72c3-b62b-ee9f0753a9e7', '--review-thread', '019f8cb8-14e9-79b3-bf40-30ba6c89ef2c', '--summary', 'ok', '--json'], { cwd, stdout }), 0);
    const payload = JSON.parse(chunks[chunks.length - 1]);
    assert.equal(payload.report.review_id, 'REV-1');
    assert.equal(payload.report.outcome, 'PASS');
    assert.equal(payload.report.task_thread_id, '019f8c85-8c32-72c3-b62b-ee9f0753a9e7');
    assert.equal(payload.report.review_thread_id, '019f8cb8-14e9-79b3-bf40-30ba6c89ef2c');
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', runId, 'reviews', 'REV-1.json')));
    const run = JSON.parse(fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, 'run.json'), 'utf8'));
    assert.equal(run.review.latest_review_id, 'REV-1');
    assert.equal(run.artifact_refs.latest_review_ref, 'reviews/REV-1.json');
    assert.deepEqual(validateRun(run), []);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
