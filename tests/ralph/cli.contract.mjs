import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { runCli } from '../../src/cli.mjs';
import { initRun, INTENSITY_DEFAULTS, loadRun, listRuns } from '../../src/ralph.mjs';
import { root, writeConversationPlan, seedCapabilityMap } from './helpers.mjs';

test('cli ralph archive, handoff, dispatch-snapshot and commit-prep work end-to-end', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-cli-'));
  const chunks = [];
  const stdout = { write: (text) => chunks.push(text) };
  try {
    const runId = 'task-demo';
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

    const runPath = path.join(cwd, '.workflow', 'ralph', runId, '.state', 'run.json');
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
    assert.ok(!fs.existsSync(path.join(cwd, '.workflow', 'ralph', runId, 'archive-manifest.json')));
    const completedRunPath = path.join(cwd, '.workflow', 'ralph', 'completed', runId, '.state', 'run.json');
    assert.ok(fs.existsSync(completedRunPath));
    const liveAfterArchive = JSON.parse(fs.readFileSync(completedRunPath, 'utf8'));
    assert.equal(liveAfterArchive.status, 'COMPLETED');
    assert.equal(liveAfterArchive.last_archive_path, '.workflow/ralph/completed/' + runId);
    assert.ok(liveAfterArchive.archive && Array.isArray(liveAfterArchive.archive.files));
    const handoffJson = path.join(cwd, '.workflow', 'ralph', 'completed', runId, '.state', 'handoff.json');
    assert.ok(fs.existsSync(handoffJson));
    const handoffPkg = JSON.parse(fs.readFileSync(handoffJson, 'utf8'));
    assert.equal(handoffPkg.schema_version, 'jj-flow/ralph-handoff/1.1');
    assert.equal(typeof handoffPkg.ready, 'boolean');
    assert.ok(Array.isArray(handoffPkg.must));
    const runAfterHandoff = JSON.parse(fs.readFileSync(completedRunPath, 'utf8'));
    assert.match(runAfterHandoff.artifact_refs.handoff_ref, /(?:completed\/)?task-demo\/\.state\/handoff\.json$/);
    assert.ok(
      fs.existsSync(
        path.join(cwd, '.workflow', 'dispatch', 'recommendations', `SNAP-demo`, 'snapshot.json')
      )
    );

    const mapFindOut = JSON.parse(chunks[chunks.length - 1]);
    assert.ok(mapFindOut.matches.some((item) => item.id === 'CAP-demo'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('skill ralph_ops.mjs thin-wrap resolves src/ralph and supports finalize + map-find', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-ops-'));
  const ops = path.join(root, 'skills/jj-ralph/scripts/ralph_ops.mjs');
  const runNode = (args) => {
    const result = spawnSync(process.execPath, [ops, ...args, '--cwd', cwd], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  };
  try {
    const runId = 'task-ops-wrapper';
    const init = runNode([
      'init',
      '--run-id',
      runId,
      '--title',
      'ops wrapper',
      '--goal',
      'single source',
      '--capability',
      'CAP-ops',
      '--project',
      'ops-hot-proj'
    ]);
    assert.equal(init.ok, true);
    assert.match(String(init.resolved).replaceAll('\\', '/'), /src\/ralph\.mjs$/);

    const runPath = path.join(cwd, '.workflow', 'ralph', runId, '.state', 'run.json');
    const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
    assert.equal(run.project_key, 'ops-hot-proj');
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
    assert.equal(finalized.archive_path, '.workflow/ralph/completed/' + runId);
    assert.ok(!fs.existsSync(path.join(cwd, '.workflow', 'ralph', runId, 'archive-manifest.json')));

    const found = runNode(['map-find', '--query', 'thin-wrap']);
    assert.ok(found.matches.some((item) => item.id === 'CAP-ops'));
    const hit = found.matches.find((item) => item.id === 'CAP-ops');
    assert.ok(hit.discover_paths.some((p) => p.includes(`${runId}/.state/run.json`)));
    assert.ok(hit.lessons.includes('thin-wrap'));

    const handoff = runNode(['handoff', '--run-id', runId]);
    assert.ok(fs.existsSync(path.join(cwd, handoff.path, 'handoff.json')));
    assert.match(handoff.path.replaceAll('\\', '/'), /\.workflow\/ralph\/(?:completed\/)?task-.*\/\.state$/);
    assert.match(handoff.path.replaceAll('\\', '/'), /\.workflow\/ralph\/(?:completed\/)?task-.*\/\.state$/);
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
      path.join(root, 'skills/jj-ralph/scripts/ralph_ops.mjs'),
      path.join(scriptsDir, 'ralph_ops.mjs')
    );
    fs.copyFileSync(
      path.join(root, 'skills/jj-ralph/scripts/lib/ralph.mjs'),
      path.join(scriptsDir, 'lib', 'ralph.mjs')
    );
    fs.mkdirSync(path.join(scriptsDir, 'lib', 'ralph'), { recursive: true });
    for (const name of ['state.mjs', 'gates.mjs', 'map.mjs', 'knowledge.mjs', 'archive.mjs', 'migrate.mjs']) {
      const src = path.join(root, 'skills/jj-ralph/scripts/lib/ralph', name);
      assert.ok(fs.existsSync(src), `portable lib missing ralph/${name}; run npm run ralph:sync`);
      fs.copyFileSync(src, path.join(scriptsDir, 'lib', 'ralph', name));
    }
    fs.copyFileSync(
      path.join(root, 'skills/jj-ralph/scripts/lib/namingConfig.mjs'),
      path.join(scriptsDir, 'lib', 'namingConfig.mjs')
    );
    fs.copyFileSync(
      path.join(root, 'skills/jj-ralph/scripts/lib/portfolioKnowledge.mjs'),
      path.join(scriptsDir, 'lib', 'portfolioKnowledge.mjs')
    );
    fs.copyFileSync(
      path.join(root, 'skills/jj-ralph/scripts/lib/memoryRetrieve.mjs'),
      path.join(scriptsDir, 'lib', 'memoryRetrieve.mjs')
    );
    fs.copyFileSync(
      path.join(root, 'skills/jj-ralph/scripts/lib/memoryExtract.mjs'),
      path.join(scriptsDir, 'lib', 'memoryExtract.mjs')
    );
    for (const extra of ['homeLayout.mjs', 'projectMap.mjs', 'homeKnowledge.mjs', 'memoryHotLayer.mjs']) {
      const src = path.join(root, 'skills/jj-ralph/scripts/lib', extra);
      assert.ok(fs.existsSync(src), `portable lib missing ${extra}; run npm run ralph:sync`);
      fs.copyFileSync(src, path.join(scriptsDir, 'lib', extra));
    }
    const ops = path.join(scriptsDir, 'ralph_ops.mjs');
    const runNode = (args) => {
      const result = spawnSync(process.execPath, [ops, ...args, '--cwd', businessCwd], {
        encoding: 'utf8',
        env: { ...process.env, JJ_FLOW_ROOT: '' }
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      return JSON.parse(result.stdout);
    };
    const runId = 'task-portable';
    const init = runNode(['init', '--run-id', runId, '--title', 'portable', '--goal', 'no jj-flow dep']);
    assert.equal(init.ok, true);
    assert.match(String(init.resolved).replaceAll('\\', '/'), /scripts\/lib\/ralph\.mjs$/);
    assert.deepEqual(init.map_find.matches, []);
    assert.ok(fs.existsSync(path.join(businessCwd, init.path, '.state', 'run.json')));

    const runPath = path.join(businessCwd, '.workflow', 'ralph', runId, '.state', 'run.json');
    writeConversationPlan(businessCwd, runId, { steps: '1. Update `src/a.vue`' });
    runNode(['deliver-attempt', '--run-id', runId, '--improved', 'true', '--signal', 'portable verification:PASS']);
    const delivered = runNode(['gate', '--run-id', runId, '--gate', 'deliver', '--status', 'PASS']);
    assert.equal(delivered.folded, true);
    assert.deepEqual(delivered.gates_written, ['analyze', 'plan', 'deliver']);
    runNode(['gate', '--run-id', runId, '--gate', 'accept', '--status', 'PASS']);
    assert.deepEqual(JSON.parse(fs.readFileSync(runPath, 'utf8')).gates, {
      analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PASS', archive: 'PENDING'
    });

    const finalized = runNode(['finalize', '--run-id', runId, '--modules', 'src/a.vue', '--keywords', 'portable']);
    assert.equal(finalized.action, 'finalize');
    assert.equal(finalized.status, 'COMPLETED');
    assert.ok(fs.existsSync(path.join(businessCwd, '.workflow/ralph/business-map.json')));
    const resumed = runNode(['resume', '--run-id', runId, '--reason', 'portable follow-up']);
    assert.equal(resumed.map_find.matches[0].id, finalized.capability_id);
    assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(runPath, 'utf8')), 'map_find'), false);
  } finally {
    fs.rmSync(businessCwd, { recursive: true, force: true });
    fs.rmSync(skillDir, { recursive: true, force: true });
  }
});

test('skill ralph_ops.mjs fails clearly when library candidates are all missing', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-ops-miss-'));
  const ops = path.join(root, 'skills/jj-ralph/scripts/ralph_ops.mjs');
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

test('cli gate and ops finalize path stay de-duplicated', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-cli-gate-'));
  const chunks = [];
  const stdout = { write: (text) => chunks.push(text) };
  try {
    const runId = 'task-cli-gate';
    assert.equal(runCli(['ralph', 'init', '--run-id', runId, '--title', 'cli gate', '--goal', 'gates', '--capability', 'CAP-cli-gate', '--json'], { cwd, stdout }), 0);
    assert.equal(runCli(['ralph', 'gate', '--run-id', runId, '--gate', 'analyze', '--status', 'PASS', '--json'], { cwd, stdout }), 0);
    assert.equal(runCli(['ralph', 'gate', '--run-id', runId, '--gate', 'plan', '--status', 'PASS', '--json'], { cwd, stdout }), 0);
    assert.equal(runCli(['ralph', 'gate', '--run-id', runId, '--gate', 'deliver', '--status', 'PASS', '--json'], { cwd, stdout }), 0);
    assert.equal(runCli(['ralph', 'gate', '--run-id', runId, '--gate', 'accept', '--status', 'PASS', '--json'], { cwd, stdout }), 0);
    chunks.length = 0;
    assert.equal(runCli(['ralph', 'finalize', '--run-id', runId, '--modules', 'src/cli-gate.js', '--keywords', 'gate', '--json'], { cwd, stdout }), 0);
    const payload = JSON.parse(chunks[chunks.length - 1]);
    assert.equal(payload.archive_path, '.workflow/ralph/completed/task-cli-gate');
    assert.equal(payload.run.status, 'COMPLETED');
    const archived = JSON.parse(fs.readFileSync(path.join(cwd, payload.archive_path, '.state', 'run.json'), 'utf8'));
    assert.equal(archived.status, 'COMPLETED');
    assert.ok(archived.archive && Array.isArray(archived.archive.files));
    assert.ok(!fs.existsSync(path.join(cwd, '.workflow', 'ralph', runId, 'archive-manifest.json')));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('cli deliver-attempt and accept-layer wire through', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-cli-layer-'));
  try {
    const runId = 'task-cli-layer';
    assert.equal(
      runCli([
        'ralph', 'init',
        '--run-id', runId,
        '--title', 'cli',
        '--goal', 'cli wire',
        '--intensity', 'tiny',
        '--no-knowledge-refs',
        '--json'
      ], { cwd, stdout: { write: () => {} } }),
      0
    );
    const run = loadRun(runId, cwd);
    assert.equal(run.intensity, 'tiny');
    assert.equal(run.max_iterations, INTENSITY_DEFAULTS.tiny.max_iterations);

    assert.equal(
      runCli([
        'ralph', 'deliver-attempt',
        '--run-id', runId,
        '--improved', 'false',
        '--signal', 'lint',
        '--json'
      ], { cwd, stdout: { write: () => {} } }),
      0
    );
    assert.equal(loadRun(runId, cwd).stagnation.unchanged_count, 1);

    assert.equal(
      runCli([
        'ralph', 'accept-layer',
        '--run-id', runId,
        '--layer', 'judgment',
        '--status', 'PASS',
        '--mode', 'recheck',
        '--json'
      ], { cwd, stdout: { write: () => {} } }),
      0
    );
    assert.equal(loadRun(runId, cwd).accept_layers.judgment, 'PASS');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('conversational wrapper rejects legacy knobs and aliases without mutating a run', (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-ops-boundary-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const ops = path.join(root, 'skills/jj-ralph/scripts/ralph_ops.mjs');
  const invoke = (args) => spawnSync(process.execPath, [ops, ...args, '--cwd', cwd], { encoding: 'utf8' });
  for (const flags of [['--lite'], ['--full'], ['--intensity', 'tiny'], ['--intensity=strict'], ['--lite=false'], ['--full=']]) {
    const result = invoke(['init', '--run-id', 'task-rejected-knob', '--title', '文案', '--goal', '改两字', ...flags]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /对话包装不接受/);
    assert.equal(listRuns(cwd).length, 0);
  }
  const runId = 'task-existing-lite';
  initRun({ run_id: runId, title: 'existing', goal: 'old record', gate_set: 'lite', attach_knowledge: false }, cwd);
  const diskPath = path.join(cwd, '.workflow', 'ralph', runId, '.state', 'run.json');
  const before = fs.readFileSync(diskPath, 'utf8');
  for (const gate of ['brief', 'close']) {
    const result = invoke(['gate', '--run-id', runId, '--gate', gate, '--status', 'PASS']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /只接受.*五键/);
    assert.equal(fs.readFileSync(diskPath, 'utf8'), before);
  }
  const help = invoke(['--help']);
  assert.equal(help.status, 0);
  assert.doesNotMatch(help.stdout, /--intensity|--lite|--full|brief\|close/);
});

test('wrapper and CLI expose automatic CAP results and the actual task directory', (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-cap-cli-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  seedCapabilityMap(cwd);
  const ops = path.join(root, 'skills/jj-ralph/scripts/ralph_ops.mjs');
  const invoke = (args) => {
    const result = spawnSync(process.execPath, [ops, ...args, '--cwd', cwd], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  };
  const initial = invoke(['init', '--run-id', 'task-cap-wrapper', '--title', 'wrapper', '--goal', 'lookup', '--knowledge-query', 'specialcap']);
  assert.equal(initial.map_find.matches[0].id, 'CAP-discovery-6');
  assert.ok(fs.existsSync(path.join(cwd, initial.path, '.state', 'run.json')));
  assert.ok(initial.reuse_suggestions.some((item) => item.run_id === 'task-history-6'));
  const resumed = invoke(['resume', '--run-id', initial.run_id, '--reason', 'catalog']);
  assert.equal(resumed.map_find.matches.length, 5);
  const chunks = [];
  const stdout = { write: (value) => chunks.push(value) };
  assert.equal(runCli(['ralph', 'init', '--run-id', 'task-cap-cli', '--title', 'specialcap', '--goal', 'cli lookup', '--no-knowledge-refs'], { cwd, stdout }), 0);
  assert.match(chunks.join(''), /map_find: CAP-discovery-6/);
  chunks.length = 0;
  assert.equal(runCli(['ralph', 'resume', '--run-id', 'task-cap-cli', '--reason', 'catalog', '--json'], { cwd, stdout }), 0);
  assert.equal(JSON.parse(chunks.join('')).map_find.matches.length, 5);
  chunks.length = 0;
  assert.equal(runCli(['ralph', 'resume', '--run-id', 'task-cap-cli', '--reason', 'unmatched'], { cwd, stdout }), 0);
  assert.match(chunks.join(''), /map_find: \(none\)/);
});
