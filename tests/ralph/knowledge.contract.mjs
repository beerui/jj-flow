import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  KNOWLEDGE_CONTRIBUTION_DEGRADED_REASON,
  findInMap,
  initRun,
  loadMap,
  mapFind,
  mapMergeFromRun,
  saveRun,
  validateRun,
  finalizeRun,
  readRunEventsText,
  recordDeliverAttempt,
  deriveAutoLessonsFromRun,
  resumeRun,
  knowledgeContribute,
  loadRun
} from '../../src/ralph.mjs';
import { withoutLocalPortfolio, seedCapabilityMap } from './helpers.mjs';

test('map-merge then map-find recovers historical capability and run paths', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-map-'));
  try {
    const runId = 'task-login-reminder';
    initRun(
      {
        run_id: runId,
        title: '登录密码更新提醒',
        goal: '登录成功后提示更新过期密码',
        capability_ids: ['CAP-login-reminder']
      },
      cwd
    );
    const runPath = path.join(cwd, '.workflow', 'ralph', runId, '.state', 'run.json');
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
    assert.deepEqual(merged.capability.keywords.sort(), ['password', '登录', '过期'].sort());
    assert.equal(merged.capability.keywords.includes('登录成功后提示更新过期密码'), false);

    const map = loadMap(cwd);
    assert.equal(map.capabilities.length, 1);

    const byTitle = findInMap(map, '登录密码更新提醒');
    assert.ok(byTitle.length >= 1);
    assert.equal(byTitle[0].id, 'CAP-login-reminder');
    assert.ok(byTitle[0].run_refs.includes(runId));
    assert.ok(byTitle[0].discover_paths.some((p) => p.includes(`.workflow/ralph/${runId}/.state/run.json`)));

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

test('map-merge requires accept PASS unless force', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-merge-force-'));
  try {
    const runId = 'task-merge-guard';
    initRun({ run_id: runId, title: 'guard', goal: 'require accept', capability_ids: ['CAP-guard'] }, cwd);
    assert.throws(() => mapMergeFromRun(runId, {}, cwd), /accept=PASS/);
    const forced = mapMergeFromRun(runId, { force: true, modules: ['src/x.js'] }, cwd);
    assert.equal(forced.capability.id, 'CAP-guard');
    const runPath = path.join(cwd, '.workflow', 'ralph', runId, '.state', 'run.json');
    const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
    run.gates.accept = 'PASS';
    saveRun(run, cwd);
    const merged = mapMergeFromRun(runId, { modules: ['src/y.js'] }, cwd);
    assert.ok(merged.capability.modules.includes('src/y.js') || merged.map.capabilities[0].modules.includes('src/y.js'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('map-merge puts STAGNATION/strict into process_lessons by default', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-auto-lessons-'));
  try {
    const runId = 'task-auto-lessons';
    initRun({
      run_id: runId,
      title: 'lessons',
      goal: 'map pheromone',
      capability_ids: ['CAP-lessons'],
      attach_knowledge: false,
      intensity: 'strict'
    }, cwd);
    recordDeliverAttempt(runId, { improved: false, signal: 'test_fail:login', cwd });
    recordDeliverAttempt(runId, { improved: false, signal: 'test_fail:login', cwd });
    const run = loadRun(runId, cwd);
    assert.equal(run.intervention_needed?.kind, 'STAGNATION');
    const auto = deriveAutoLessonsFromRun(run, cwd);
    assert.ok(auto.some((l) => /STAGNATION/.test(l)));
    assert.ok(auto.some((l) => /intensity=strict/.test(l)));

    // force map-merge without accept for lesson path
    run.gates.accept = 'PASS';
    run.gates.analyze = 'PASS';
    run.gates.plan = 'PASS';
    run.gates.deliver = 'PASS';
    saveRun(run, cwd);
    const merged = mapMergeFromRun(runId, { force: true, modules: ['src/login.js'] }, cwd);
    assert.ok(!(merged.capability.lessons || []).some((l) => /STAGNATION/.test(l)));
    assert.ok(merged.capability.process_lessons.some((l) => /STAGNATION/.test(l)));
    assert.ok(merged.capability.process_lessons.some((l) => /intensity=strict/.test(l)));
    const found = mapFind('STAGNATION', { cwd, limit: 5 });
    assert.ok(found.matches.some((m) => m.id === 'CAP-lessons'));

    const withLegacy = mapMergeFromRun(runId, {
      force: true,
      modules: ['src/login.js'],
      include_process_lessons_in_map: true
    }, cwd);
    assert.ok(withLegacy.capability.lessons.some((l) => /STAGNATION/.test(l)));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('finalize skips knowledge-contribution.json (P1b degraded; durable lessons still elevate)', () => {
  withoutLocalPortfolio(() => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-contrib-'));
  try {
    const runId = 'task-contrib';
    initRun({
      run_id: runId,
      title: 'tip down',
      goal: 'move tip 6px',
      capability_ids: ['CAP-tip'],
      attach_knowledge: false,
      intensity: 'tiny'
    }, cwd);
    const run = loadRun(runId, cwd);
    run.gates = { analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PASS', archive: 'PENDING' };
    run.phase = 'ACCEPT';
    saveRun(run, cwd);
    const result = finalizeRun(runId, {
      cwd,
      modules: ['src/tip.vue'],
      lessons: ['tip bottom uses 6px not 8px'],
      force: true
    });
    assert.ok(result.capability.id === 'CAP-tip');
    assert.equal(result.contribution_path, null);
    assert.equal(result.contribution, null);
    assert.equal(result.contribute_hook.status, 'skipped');
    assert.equal(result.contribute_hook.reason, KNOWLEDGE_CONTRIBUTION_DEGRADED_REASON);
    assert.equal(result.elevation.durable_lessons.length, 1);
    assert.ok(result.capability.lessons.includes('tip bottom uses 6px not 8px'));
    assert.equal(
      fs.existsSync(path.join(cwd, '.workflow', 'ralph', runId, 'knowledge-contribution.json')),
      false
    );

    const again = knowledgeContribute(runId, { cwd, lessons: ['tip bottom uses 6px not 8px'], modules: ['src/tip.vue'] });
    assert.equal(again.status, 'degraded');
    assert.equal(again.path, null);
    assert.equal(again.hook.status, 'skipped');
    assert.equal(again.hook.reason, KNOWLEDGE_CONTRIBUTION_DEGRADED_REASON);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
  });
});

test('knowledge-contribute stays degraded even when a hook command is configured', () => {
  withoutLocalPortfolio(() => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-hook-'));
  const prevCmd = process.env.RALPH_KNOWLEDGE_HOOK_CMD;
  const prevMode = process.env.RALPH_KNOWLEDGE_HOOK;
  try {
    const runId = 'task-hook';
    initRun({
      run_id: runId,
      title: 'hook',
      goal: 'test hook',
      capability_ids: ['CAP-hook'],
      attach_knowledge: false
    }, cwd);
    const run = loadRun(runId, cwd);
    run.gates = { analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PASS', archive: 'PENDING' };
    run.phase = 'ACCEPT';
    saveRun(run, cwd);
    finalizeRun(runId, { cwd, modules: ['a.js'], lessons: ['durable'], force: true });

    process.env.RALPH_KNOWLEDGE_HOOK = 'cli';
    process.env.RALPH_KNOWLEDGE_HOOK_CMD = 'node -e "process.exit(0)"';
    const ok = knowledgeContribute(runId, { cwd, lessons: ['durable'], modules: ['a.js'], hook: true });
    assert.equal(ok.status, 'degraded');
    assert.equal(ok.hook.status, 'skipped');
    assert.equal(ok.path, null);

    process.env.RALPH_KNOWLEDGE_HOOK_CMD = 'node -e "process.exit(2)"';
    const bad = knowledgeContribute(runId, { cwd, lessons: ['durable'], modules: ['a.js'], hook: true });
    assert.equal(bad.status, 'degraded');
    assert.equal(bad.hook.status, 'skipped');
    assert.equal(bad.path, null);
  } finally {
    if (prevCmd === undefined) delete process.env.RALPH_KNOWLEDGE_HOOK_CMD;
    else process.env.RALPH_KNOWLEDGE_HOOK_CMD = prevCmd;
    if (prevMode === undefined) delete process.env.RALPH_KNOWLEDGE_HOOK;
    else process.env.RALPH_KNOWLEDGE_HOOK = prevMode;
    fs.rmSync(cwd, { recursive: true, force: true });
  }
  });
});

test('init and resume perform one capped CAP lookup and keep discovery out of the ledger', (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-cap-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  seedCapabilityMap(cwd);
  const mapFile = path.join(cwd, '.workflow', 'ralph', 'business-map.json');
  const readFile = fs.readFileSync;
  let mapReads = 0;
  const reader = t.mock.method(fs, 'readFileSync', function (file, ...args) {
    if (String(file) === mapFile) mapReads += 1;
    return readFile.call(this, file, ...args);
  });
  const run = initRun({
    run_id: 'task-cap-lookup', title: 'specialcap', goal: 'unrelated requirement',
    knowledge_query: 'catalog', attach_knowledge: false
  }, cwd);
  assert.equal(mapReads, 1, 'reuse and CAP output must share a lookup');
  assert.equal(run.map_find.query, 'catalog', 'explicit query precedes title');
  assert.equal(run.map_find.applied, true);
  assert.equal(run.map_find.matches.length, 5);
  assert.equal(run.map_find.matches[0].id, 'CAP-discovery-0');
  assert.ok(run.map_find.matches[0].discover_paths.some((p) => p.endsWith('task-history-0/.state/run.json')));
  assert.equal(run.reuse_suggestions.length, 5);
  assert.equal(new Set(run.reuse_suggestions.map((item) => item.run_id)).size, 5);
  assert.ok(run.reuse_suggestions.every((item) => item.source === 'map'));
  assert.match(readRunEventsText(run.run_id, cwd), /- map_find: CAP-discovery-0, CAP-discovery-1/);
  mapReads = 0;
  const resumed = resumeRun(run.run_id, { reason: ' specialcap ', cwd });
  assert.equal(mapReads, 1);
  assert.equal(resumed.map_find.query, 'specialcap', 'resume reason precedes title/goal');
  assert.deepEqual(resumed.map_find.matches.map((item) => item.id), ['CAP-discovery-6']);
  assert.ok(resumed.reuse_suggestions.some((item) => item.run_id === 'task-history-6'));
  assert.equal(resumed.run.intensity, run.intensity, 'resume never re-infers');
  reader.mock.restore();
  saveRun(run, cwd);
  saveRun(resumed.run, cwd);
  assert.equal(Object.hasOwn(loadRun(run.run_id, cwd), 'map_find'), false);
  const fromTitle = initRun({
    run_id: 'task-cap-title', title: 'specialcap', goal: 'catalog',
    new_requirement: true, attach_knowledge: false
  }, cwd);
  assert.deepEqual(fromTitle.map_find.matches.map((item) => item.id), ['CAP-discovery-6']);
});

test('CAP lookup tolerates missing, empty and invalid maps without padding results', (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-cap-empty-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const run = initRun({ run_id: 'task-no-cap', title: 'catalog', goal: 'lookup', attach_knowledge: false }, cwd);
  assert.deepEqual(run.map_find.matches, []);
  assert.equal(run.map_find.map_path, null);
  assert.equal(run.map_find.applied, true);
  assert.match(readRunEventsText(run.run_id, cwd), /- map_find: \(none\)/);
  seedCapabilityMap(cwd);
  const empty = initRun({
    run_id: 'task-empty-cap', title: 'catalog', goal: 'lookup', knowledge_query: '   ',
    new_requirement: true, attach_knowledge: false
  }, cwd);
  assert.equal(empty.map_find.query, '');
  assert.deepEqual(empty.map_find.matches, []);
  assert.deepEqual(resumeRun(run.run_id, { reason: 'unmatched-term', cwd }).map_find.matches, []);
  fs.writeFileSync(path.join(cwd, '.workflow', 'ralph', 'business-map.json'), '{invalid');
  const unavailable = resumeRun(run.run_id, { reason: 'catalog', cwd });
  assert.equal(unavailable.map_find.applied, false);
  assert.deepEqual(unavailable.map_find.matches, []);
  assert.ok(unavailable.map_find.error);
  assert.match(readRunEventsText(run.run_id, cwd), /map_find unavailable:/);
  const afterInvalid = initRun({
    run_id: 'task-invalid-cap', title: 'invalid map', goal: 'continue work', attach_knowledge: false
  }, cwd);
  assert.equal(afterInvalid.map_find.applied, false);
  assert.deepEqual(validateRun(loadRun(afterInvalid.run_id, cwd)), []);
});
