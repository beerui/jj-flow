import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
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
  validateRun,
  defaultArchiveDirName,
  archiveRun,
  setGate,
  finalizeRun
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
    'map-find',
    'ralph_ops.mjs',
    'finalize'
  ]) {
    assert.match(skill, new RegExp(marker));
  }
  assert.ok(fs.existsSync(path.join(root, '.codex/skills/jj-ralph/scripts/ralph_ops.mjs')));
  assert.ok(fs.existsSync(path.join(root, '.codex/skills/jj-ralph/scripts/lib/ralph.mjs')));
  assert.equal(
    fs.readFileSync(path.join(root, '.codex/skills/jj-ralph/scripts/lib/ralph.mjs'), 'utf8'),
    fs.readFileSync(path.join(root, 'src/ralph.mjs'), 'utf8')
  );
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


test('skill ralph_ops.mjs thin-wrap resolves src/ralph and supports finalize + map-find', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-ops-'));
  const ops = path.join(root, '.codex/skills/jj-ralph/scripts/ralph_ops.mjs');
  const runNode = (args) => {
    const result = spawnSync(process.execPath, [ops, ...args, '--cwd', cwd], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  };
  try {
    const runId = 'RALPH-ops-wrapper-20260723';
    const init = runNode(['init', '--run-id', runId, '--title', 'ops wrapper', '--goal', 'single source', '--capability', 'CAP-ops']);
    assert.equal(init.ok, true);
    assert.match(String(init.resolved).replaceAll('\\', '/'), /src\/ralph\.mjs$/);

    const runPath = path.join(cwd, '.workflow', 'ralph', runId, 'run.json');
    const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
    run.gates = { analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PASS', archive: 'PENDING' };
    fs.writeFileSync(runPath, `${JSON.stringify(run, null, 2)}\n`);

    const emptyFind = runNode(['map-find', '--query', 'wrapper']);
    assert.equal(emptyFind.action, 'map-find');
    assert.equal(emptyFind.matches.length, 0);

    const finalized = runNode([
      'finalize',
      '--run-id',
      runId,
      '--modules',
      'src/ops.js',
      '--keywords',
      'wrapper,ops',
      '--lessons',
      'thin-wrap|single-source'
    ]);
    assert.equal(finalized.action, 'finalize');
    assert.equal(finalized.capability_id, 'CAP-ops');
    assert.equal(finalized.status, 'COMPLETED');
    assert.ok(finalized.archive_path.includes('.workflow/ralph/archive/'));

    const found = runNode(['map-find', '--query', 'thin-wrap']);
    assert.ok(found.matches.some((item) => item.id === 'CAP-ops'));
    const hit = found.matches.find((item) => item.id === 'CAP-ops');
    assert.ok(hit.discover_paths.some((p) => p.includes(`${runId}/run.json`)));
    assert.ok(hit.lessons.includes('thin-wrap'));

    const handoff = runNode(['handoff', '--run-id', runId]);
    assert.ok(fs.existsSync(path.join(cwd, handoff.path, 'handoff.json')));
    const snap = runNode(['dispatch-snapshot', '--run-id', runId]);
    assert.ok(fs.existsSync(path.join(cwd, snap.path)));
    const prep = runNode(['commit-prep', '--run-id', runId]);
    assert.ok(prep.suggested_message.includes(runId));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('skill portable lib works without jj-flow in business cwd', () => {
  const businessCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-biz-'));
  const skillDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-skill-'));
  try {
    // Simulate installed skill only: ops + bundled lib, no jj-flow package nearby.
    const scriptsDir = path.join(skillDir, 'scripts');
    fs.mkdirSync(path.join(scriptsDir, 'lib'), { recursive: true });
    fs.copyFileSync(
      path.join(root, '.codex/skills/jj-ralph/scripts/ralph_ops.mjs'),
      path.join(scriptsDir, 'ralph_ops.mjs')
    );
    fs.copyFileSync(
      path.join(root, '.codex/skills/jj-ralph/scripts/lib/ralph.mjs'),
      path.join(scriptsDir, 'lib', 'ralph.mjs')
    );
    const ops = path.join(scriptsDir, 'ralph_ops.mjs');
    const runNode = (args) => {
      const result = spawnSync(process.execPath, [ops, ...args, '--cwd', businessCwd], {
        encoding: 'utf8',
        env: { ...process.env, JJ_FLOW_ROOT: '' }
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      return JSON.parse(result.stdout);
    };
    const runId = 'RALPH-portable-20260723';
    const init = runNode(['init', '--run-id', runId, '--title', 'portable', '--goal', 'no jj-flow dep']);
    assert.equal(init.ok, true);
    assert.match(String(init.resolved).replaceAll('\\', '/'), /scripts\/lib\/ralph\.mjs$/);

    const runPath = path.join(businessCwd, '.workflow', 'ralph', runId, 'run.json');
    const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
    run.gates = { analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PASS', archive: 'PENDING' };
    fs.writeFileSync(runPath, `${JSON.stringify(run, null, 2)}\n`);

    const finalized = runNode(['finalize', '--run-id', runId, '--modules', 'src/a.vue', '--keywords', 'portable']);
    assert.equal(finalized.action, 'finalize');
    assert.equal(finalized.status, 'COMPLETED');
    assert.ok(fs.existsSync(path.join(businessCwd, '.workflow/ralph/business-map.json')));
  } finally {
    fs.rmSync(businessCwd, { recursive: true, force: true });
    fs.rmSync(skillDir, { recursive: true, force: true });
  }
});

test('skill ralph_ops.mjs fails clearly when library candidates are all missing', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-ops-miss-'));
  const ops = path.join(root, '.codex/skills/jj-ralph/scripts/ralph_ops.mjs');
  const isolated = path.join(cwd, 'ralph_ops.mjs');
  const original = fs.readFileSync(ops, 'utf8');
  const forced = original.replace(
    'function candidateRalphModules(cwd) {',
    "function candidateRalphModules(cwd) {\n  return [path.join(cwd, 'missing-ralph.mjs')];"
  );
  fs.writeFileSync(isolated, forced);
  try {
    const result = spawnSync(process.execPath, [isolated, 'status', '--cwd', cwd], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr || '', /Could not resolve ralph library/);
    assert.match(result.stderr || '', /scripts[\\/]+lib[\\/]+ralph\.mjs|skill-bundled|reinstall/i);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});


test('defaultArchiveDirName avoids duplicated YYYYMMDD in archive folder', () => {
  assert.equal(defaultArchiveDirName('RALPH-smoke-20260723'), '2026-07-23-smoke');
  assert.equal(defaultArchiveDirName('RALPH-login-reminder-20260722'), '2026-07-22-login-reminder');
  assert.equal(defaultArchiveDirName('RALPH-demo', '2026-07-23T00:00:00.000Z'), '2026-07-23-demo');
});

test('archive freezes COMPLETED run.json and uses de-duplicated slug folder', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-arch-'));
  try {
    const runId = 'RALPH-freeze-20260723';
    initRun({ run_id: runId, title: 'freeze', goal: 'archive completed copy', capability_ids: ['CAP-freeze'] }, cwd);
    const runPath = path.join(cwd, '.workflow', 'ralph', runId, 'run.json');
    const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
    run.gates = { analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PASS', archive: 'PENDING' };
    saveRun(run, cwd);
    const result = archiveRun(runId, { cwd });
    assert.equal(result.archive_path, '.workflow/ralph/archive/2026-07-23-freeze');
    const archivedRun = JSON.parse(fs.readFileSync(path.join(cwd, result.archive_path, 'run.json'), 'utf8'));
    assert.equal(archivedRun.status, 'COMPLETED');
    assert.equal(archivedRun.phase, 'ARCHIVE');
    assert.equal(archivedRun.gates.archive, 'PASS');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('map-merge requires accept PASS unless force', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-merge-force-'));
  try {
    const runId = 'RALPH-merge-guard-20260723';
    initRun({ run_id: runId, title: 'guard', goal: 'require accept', capability_ids: ['CAP-guard'] }, cwd);
    assert.throws(() => mapMergeFromRun(runId, {}, cwd), /accept=PASS/);
    const forced = mapMergeFromRun(runId, { force: true, modules: ['src/x.js'] }, cwd);
    assert.equal(forced.capability.id, 'CAP-guard');
    const runPath = path.join(cwd, '.workflow', 'ralph', runId, 'run.json');
    const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
    run.gates.accept = 'PASS';
    saveRun(run, cwd);
    const merged = mapMergeFromRun(runId, { modules: ['src/y.js'] }, cwd);
    assert.ok(merged.capability.modules.includes('src/y.js') || merged.map.capabilities[0].modules.includes('src/y.js'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('setGate advances phase on PASS and can block', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-gate-'));
  try {
    const runId = 'RALPH-gate-20260723';
    initRun({ run_id: runId, title: 'gate', goal: 'advance', capability_ids: ['CAP-gate'] }, cwd);
    let result = setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    assert.equal(result.phase, 'PLAN');
    assert.equal(result.run.gates.analyze, 'PASS');
    result = setGate(runId, { gate: 'plan', status: 'BLOCKED', cwd });
    assert.equal(result.run.status, 'BLOCKED');
    result = setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    assert.equal(result.phase, 'DELIVER');
    assert.equal(result.run.status, 'IN_PROGRESS');
    result = setGate(runId, { gate: 'deliver', status: 'PASS', cwd, advance: false });
    assert.equal(result.run.gates.deliver, 'PASS');
    assert.equal(result.phase, 'DELIVER');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('cli gate and ops finalize path stay de-duplicated', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-cli-gate-'));
  const chunks = [];
  const stdout = { write: (text) => chunks.push(text) };
  try {
    const runId = 'RALPH-cli-gate-20260723';
    assert.equal(runCli(['ralph', 'init', '--run-id', runId, '--title', 'cli gate', '--goal', 'gates', '--capability', 'CAP-cli-gate', '--json'], { cwd, stdout }), 0);
    assert.equal(runCli(['ralph', 'gate', '--run-id', runId, '--gate', 'analyze', '--status', 'PASS', '--json'], { cwd, stdout }), 0);
    assert.equal(runCli(['ralph', 'gate', '--run-id', runId, '--gate', 'plan', '--status', 'PASS', '--json'], { cwd, stdout }), 0);
    assert.equal(runCli(['ralph', 'gate', '--run-id', runId, '--gate', 'deliver', '--status', 'PASS', '--json'], { cwd, stdout }), 0);
    assert.equal(runCli(['ralph', 'gate', '--run-id', runId, '--gate', 'accept', '--status', 'PASS', '--json'], { cwd, stdout }), 0);
    chunks.length = 0;
    assert.equal(runCli(['ralph', 'finalize', '--run-id', runId, '--modules', 'src/cli-gate.js', '--keywords', 'gate', '--json'], { cwd, stdout }), 0);
    const payload = JSON.parse(chunks[chunks.length - 1]);
    assert.equal(payload.archive_path, '.workflow/ralph/archive/2026-07-23-cli-gate');
    assert.equal(payload.run.status, 'COMPLETED');
    const archived = JSON.parse(fs.readFileSync(path.join(cwd, payload.archive_path, 'run.json'), 'utf8'));
    assert.equal(archived.status, 'COMPLETED');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
