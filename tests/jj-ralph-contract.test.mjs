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
  finalizeRun,
  extractLedgerPathRefs,
  extractPlanCurrentSection,
  collectClaimedImplementationPaths,
  findImplementationPathMismatch,
  computeRunMetrics,
  detectTestIntegrityViolation,
  INSTRUCTION_CORRECTION_REL,
  evaluateAcceptArchiveGate,
  inspectAcceptanceEvidence,
  evaluateAcceptJudgment,
  detectDeliverOutsideLedger,
  recordHostMeta,
  recordDeliverAttempt,
  fingerprintDeliverState,
  setAcceptLayer,
  addGateIssue,
  deriveAutoLessonsFromRun,
  INTENSITY_DEFAULTS,
  resolveReviewScope,
  rollbackPhase,
  setRunStatus,
  resumeRun,
  abandonRun,
  knowledgeContribute,
  suggestReopenAsNew,
  loadRun
} from '../src/ralph.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

function withEnv(envPatch, fn) {
  const prev = {};
  for (const key of Object.keys(envPatch)) {
    prev[key] = process.env[key];
    if (envPatch[key] === undefined) delete process.env[key];
    else process.env[key] = envPatch[key];
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(envPatch)) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  }
}

function withoutLocalPortfolio(fn) {
  return withEnv({
    JJ_GLOBAL_CONFIG_DIR: undefined,
    DAJI_CONFIG_DIR: undefined,
    RALPH_KNOWLEDGE_HOOK: undefined,
    RALPH_KNOWLEDGE_HOOK_CMD: undefined
  }, fn);
}

test('ralph schemas, samples, skill and command assets exist with key markers', () => {
  for (const rel of [
    'schemas/ralph-run.schema.json',
    'schemas/ralph-business-map.schema.json',
    'examples/ralph/sample-run.json',
    'examples/ralph/sample-business-map.json',
    'skills/jj-ralph/SKILL.md',
    'skills/jj-ralph/references/artifact-layout.md',
    'skills/jj-ralph/references/phases.md',
    'skills/jj-ralph/references/rollback.md',
    'skills/jj-ralph/references/business-map.md',
    'skills/jj-ralph/references/integrations.md',
    'skills/jj-ralph/references/ralph-run.schema.json',
    'skills/jj-ralph/references/business-map.schema.json',
    'skills/jj-review/references/review-policy.md',
    'examples/host-guardrails/README.md',
    'evals/regression/EP-20260828-jj-end-staging-not-dev.json',
    'claude-commands/jj-ralph.md',
    'docs/commands/jj-ralph.md',
    'docs/design-docs/jj-ralph.md'
  ]) {
    assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
  }

  const skill = read('skills/jj-ralph/SKILL.md');
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
    'finalize',
    'rollback',
    'rollback-phase',
    'intensity',
    'deliver-attempt',
    'accept-layer',
    'tiny',
    'strict',
    'intent.md',
    'instruction-correction',
    'metrics',
    '2–3',
    '~/.jj-flow',
    'Idle offer',
    'jj-init',
    'knowledge-confirm',
    'hot_memory'
  ]) {
    assert.match(skill, new RegExp(marker));
  }

  const userCmd = read('docs/commands/jj-ralph.md');
  for (const marker of [
    '项目A',
    '项目B',
    '项目C',
    '控制项目',
    'RALPH-login-reminder',
    'DEL-password',
    'CAP-login-reminder',
    'intensity',
    'tiny',
    'strict'
  ]) {
    assert.match(userCmd, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const phases = read('skills/jj-ralph/references/phases.md');
  // English SSOT: intensity tier section (was Chinese 「强度档」)
  assert.match(phases, /[Ii]ntensity|intensity tier|tiny\|standard\|strict/);
  assert.match(phases, /deliver-attempt/);
  assert.match(phases, /accept-layer|accept_layers/);

  const schema = read('schemas/ralph-run.schema.json');
  assert.match(schema, /"intensity"/);
  assert.match(schema, /STAGNATION/);
  assert.match(schema, /"intent"/);
  assert.match(schema, /"metrics"/);
  assert.equal(
    read('skills/jj-ralph/references/ralph-run.schema.json'),
    schema
  );
  assert.ok(fs.existsSync(path.join(root, 'skills/jj-ralph/scripts/ralph_ops.mjs')));
assert.ok(fs.existsSync(path.join(root, 'skills/jj-ralph/scripts/lib/ralph.mjs')));
  assert.ok(fs.existsSync(path.join(root, 'skills/jj-ralph/scripts/lib/namingConfig.mjs')));
assert.equal(
    fs.readFileSync(path.join(root, 'skills/jj-ralph/scripts/lib/ralph.mjs'), 'utf8'),
    fs.readFileSync(path.join(root, 'src/ralph.mjs'), 'utf8')
  );
  assert.ok(fs.existsSync(path.join(root, 'skills/jj-ralph/scripts/lib/portfolioKnowledge.mjs')));
  assert.equal(
    fs.readFileSync(path.join(root, 'skills/jj-ralph/scripts/lib/portfolioKnowledge.mjs'), 'utf8'),
    fs.readFileSync(path.join(root, 'src/portfolioKnowledge.mjs'), 'utf8')
  );
  assert.ok(fs.existsSync(path.join(root, 'skills/jj-ralph/scripts/lib/memoryRetrieve.mjs')));
  assert.equal(
    fs.readFileSync(path.join(root, 'skills/jj-ralph/scripts/lib/memoryRetrieve.mjs'), 'utf8'),
    fs.readFileSync(path.join(root, 'src/memoryRetrieve.mjs'), 'utf8')
  );
  assert.ok(fs.existsSync(path.join(root, 'skills/jj-ralph/scripts/lib/memoryExtract.mjs')));
  assert.equal(
    fs.readFileSync(path.join(root, 'skills/jj-ralph/scripts/lib/memoryExtract.mjs'), 'utf8'),
    fs.readFileSync(path.join(root, 'src/memoryExtract.mjs'), 'utf8')
  );
  for (const extra of ['homeLayout.mjs', 'projectMap.mjs', 'homeKnowledge.mjs', 'memoryHotLayer.mjs']) {
    assert.ok(fs.existsSync(path.join(root, 'skills/jj-ralph/scripts/lib', extra)), extra);
    assert.equal(
      fs.readFileSync(path.join(root, 'skills/jj-ralph/scripts/lib', extra), 'utf8'),
      fs.readFileSync(path.join(root, 'src', extra), 'utf8')
    );
  }
  assert.doesNotMatch(skill, /[Mm]aestro/);

  const command = read('claude-commands/jj-ralph.md');
  assert.match(command, /\.workflow\/ralph\/RALPH/);
  assert.match(command, /map-find/);
  assert.doesNotMatch(command, /[Mm]aestro/);

  const layout = read('skills/jj-ralph/references/artifact-layout.md');
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

test('initRun plan stub uses ## Current (legacy ## Tasks still valid in old files)', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-init-shape-'));
  try {
    const runId = 'RALPH-init-shape-20260825';
    initRun({ run_id: runId, title: 'init shape', goal: 'Current heading', capability_ids: ['CAP-init-shape'], attach_knowledge: false }, cwd);
    const plan = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, 'plan.md'), 'utf8');
    assert.match(plan, /^## Current$/m);
    assert.equal((plan.match(/^## Tasks$/m) || []).length, 0);
    const findings = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, 'findings.md'), 'utf8');
    assert.match(findings, /## 可复用结论/);
    const progress = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, 'progress.md'), 'utf8');
    assert.match(progress, /hot_memory:/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
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
    const handoffJson = path.join(cwd, '.workflow', 'ralph', runId, 'handoff', 'handoff.json');
    assert.ok(fs.existsSync(handoffJson));
    const handoffPkg = JSON.parse(fs.readFileSync(handoffJson, 'utf8'));
    assert.equal(handoffPkg.schema_version, 'jj-flow/ralph-handoff/1.1');
    assert.equal(typeof handoffPkg.ready, 'boolean');
    assert.ok(Array.isArray(handoffPkg.must));
    const runAfterHandoff = JSON.parse(fs.readFileSync(runPath, 'utf8'));
    assert.match(runAfterHandoff.artifact_refs.handoff_ref, /RALPH-demo-20260722\/handoff\/handoff\.json$/);
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

test('review-record persists source and host_review provenance', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-review-prov-'));
  const chunks = [];
  const stdout = { write: (text) => chunks.push(text) };
  try {
    const runId = 'RALPH-review-prov-20260730';
    assert.equal(runCli(['ralph', 'init', '--run-id', runId, '--title', 'review provenance', '--goal', 'keep host source', '--json'], { cwd, stdout }), 0);
    chunks.length = 0;
    const hostJson = JSON.stringify({
      method: 'skill',
      entry: 'review',
      artifact_paths: ['tmp/host-review.md'],
      note: 'mapped from host builtin'
    });
    assert.equal(runCli([
      'ralph', 'review-record',
      '--run-id', runId,
      '--outcome', 'PASS',
      '--reviewed-commit', 'abcdef1234567',
      '--summary', 'host mapped',
      '--source', 'host_builtin',
      '--host-review-json', hostJson,
      '--json'
    ], { cwd, stdout }), 0);
    const payload = JSON.parse(chunks[chunks.length - 1]);
    assert.equal(payload.report.source, 'host_builtin');
    assert.equal(payload.report.host_review.method, 'skill');
    assert.equal(payload.report.host_review.entry, 'review');
    assert.deepEqual(payload.report.host_review.artifact_paths, ['tmp/host-review.md']);
    const disk = JSON.parse(fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, 'reviews', 'REV-1.json'), 'utf8'));
    assert.equal(disk.source, 'host_builtin');
    assert.equal(disk.host_review.entry, 'review');
    const progress = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, 'progress.md'), 'utf8');
    assert.match(progress, /source=host_builtin/);
    const run = JSON.parse(fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, 'run.json'), 'utf8'));
    assert.equal(run.review.reviews[0].source, 'host_builtin');
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
    assert.match(handoff.path.replaceAll('\\', '/'), /\.workflow\/ralph\/RALPH-.*\/handoff$/);
    assert.match(handoff.path.replaceAll('\\', '/'), /\.workflow\/ralph\/RALPH-.*\/handoff$/);
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


test('defaultArchiveDirName avoids duplicated YYYYMMDD in archive folder', () => {
  assert.equal(defaultArchiveDirName('RALPH-smoke-20260723'), '2026-07-23-smoke');
  assert.equal(defaultArchiveDirName('RALPH-login-reminder-20260722'), '2026-07-22-login-reminder');
  assert.equal(defaultArchiveDirName('RALPH-demo', '2026-07-23T00:00:00.000Z'), '2026-07-23-demo');
});

test('archive soft-completes run.json and uses de-duplicated slug folder; re-archive allowed', () => {
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
    const active = loadRun(runId, cwd);
    assert.equal(active.status, 'COMPLETED');
    assert.ok(active.last_archived_at);
    assert.equal(active.last_archive_path, result.archive_path);
    // Soft archive is not a freeze: same run can resume and re-archive.
    resumeRun(runId, { reason: 'more work after archive', cwd });
    assert.equal(loadRun(runId, cwd).status, 'IN_PROGRESS');
    const re = archiveRun(runId, { cwd });
    assert.ok(re.archive_path.startsWith('.workflow/ralph/archive/2026-07-23-freeze-'));
    assert.notEqual(re.archive_path, result.archive_path);
    assert.ok(fs.existsSync(path.join(cwd, re.archive_path, 'run.json')));
    assert.equal(loadRun(runId, cwd).status, 'COMPLETED');
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

test('rollbackPhase allows apbacent edges and writes progress; COMPLETED/ARCHIVE/ABANDONED resumable', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-rollback-'));
  try {
    const runId = 'RALPH-rollback-20260731';
    initRun({ run_id: runId, title: 'rollback', goal: 'phase back', capability_ids: ['CAP-rb'] }, cwd);
    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    setGate(runId, { gate: 'deliver', status: 'PASS', cwd });
    let run = loadRun(runId, cwd);
    assert.equal(run.phase, 'ACCEPT');
    assert.equal(run.gates.deliver, 'PASS');

    const rolled = rollbackPhase(runId, { toPhase: 'DELIVER', reason: '验收证据不足', cwd });
    assert.equal(rolled.toPhase, 'DELIVER');
    assert.equal(rolled.fromPhase, 'ACCEPT');
    run = loadRun(runId, cwd);
    assert.equal(run.phase, 'DELIVER');
    assert.equal(run.gates.deliver, 'FAIL');
    assert.equal(run.gates.accept, 'PENDING');
    const progress = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, 'progress.md'), 'utf8');
    assert.match(progress, /rollbackPhase ACCEPT→DELIVER/);

    assert.throws(
      () => rollbackPhase(runId, { toPhase: 'ANALYZE', reason: 'skip not allowed', cwd }),
      /apbacent/
    );

    setRunStatus(runId, { status: 'PAUSED', reason: '等 UAT', cwd });
    run = loadRun(runId, cwd);
    assert.equal(run.status, 'PAUSED');
    setRunStatus(runId, { status: 'IN_PROGRESS', reason: '继续实施', cwd });
    run = loadRun(runId, cwd);
    assert.equal(run.status, 'IN_PROGRESS');

    // COMPLETED / ARCHIVE are soft — same-run resume + ARCHIVE→ACCEPT rollback allowed
    run.status = 'COMPLETED';
    run.phase = 'ARCHIVE';
    run.gates.archive = 'PASS';
    run.gates.accept = 'PASS';
    saveRun(run, cwd);
    const resumedStatus = setRunStatus(runId, { status: 'IN_PROGRESS', reason: 'same-run continue after archive', cwd });
    assert.equal(resumedStatus.status, 'IN_PROGRESS');
    assert.equal(loadRun(runId, cwd).status, 'IN_PROGRESS');

    // re-apply COMPLETED+ARCHIVE for rollback path
    run = loadRun(runId, cwd);
    run.status = 'COMPLETED';
    run.phase = 'ARCHIVE';
    run.gates.archive = 'PASS';
    run.gates.accept = 'PASS';
    saveRun(run, cwd);
    const fromArchive = rollbackPhase(runId, { toPhase: 'ACCEPT', reason: 'resume deliver after soft archive', cwd });
    assert.equal(fromArchive.fromPhase, 'ARCHIVE');
    assert.equal(fromArchive.toPhase, 'ACCEPT');
    assert.equal(fromArchive.status, 'IN_PROGRESS');
    run = loadRun(runId, cwd);
    assert.equal(run.phase, 'ACCEPT');
    assert.equal(run.status, 'IN_PROGRESS');
    assert.equal(run.gates.archive, 'PENDING');

    // ABANDONED → resume same run
    const abandoned = abandonRun(runId, { reason: 'half-done drop for now', cwd });
    assert.equal(abandoned.status, 'ABANDONED');
    assert.throws(
      () => mapMergeFromRun(runId, { force: true }, cwd),
      /ABANDONED/
    );
    const resumed = resumeRun(runId, { reason: 'pick abandoned work back up', cwd });
    assert.equal(resumed.status, 'IN_PROGRESS');
    assert.equal(resumed.from, 'ABANDONED');
    assert.equal(loadRun(runId, cwd).status, 'IN_PROGRESS');

    const suggestion = suggestReopenAsNew(run, { newRunId: 'RALPH-rollback-reopen-20260731' });
    assert.equal(suggestion.supersedes_run_id, runId);
    assert.match(suggestion.note, /same-run resume|Prefer same-run/i);
    assert.match(suggestion.note, /progress\.md/i);
    assert.match(suggestion.note, /not family/i);
    assert.doesNotMatch(suggestion.note, /progress\/family/i);
    assert.doesNotMatch(suggestion.note, /Do not un-archive|cannot.*reopen/i);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('setGate FAIL covers prior PASS without forging COMPLETED reopen', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-gate-fail-'));
  try {
    const runId = 'RALPH-gate-fail-20260731';
    initRun({ run_id: runId, title: 'gate fail', goal: 'fail gate', capability_ids: ['CAP-gf'] }, cwd);
    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    const failed = setGate(runId, { gate: 'plan', status: 'FAIL', cwd, advance: false });
    assert.equal(failed.run.gates.plan, 'FAIL');
    assert.equal(failed.phase, 'DELIVER');
    const progress = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, 'progress.md'), 'utf8');
    assert.match(progress, /gate plan=FAIL/);
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

test('product-consistency extracts ledger paths and detects EP-04-style drift', () => {
  const bt = String.fromCharCode(96);
  const plan = [
    '# Plan',
    `- TASK-1: ${bt}publish-dialog.vue${bt} @closed blur`,
    `- TASK-2: ${bt}batch-publish-dialog.vue${bt}`
  ].join('\n');
  const claimed = extractLedgerPathRefs(plan);
  assert.deepEqual(claimed, ['publish-dialog.vue', 'batch-publish-dialog.vue']);
  const mismatch = findImplementationPathMismatch(claimed, [
    'src/views/pages/draft-manage/InventoryManager.vue'
  ]);
  assert.match(mismatch, /InventoryManager\.vue/);
  assert.equal(
    findImplementationPathMismatch(['inquiry-card.vue'], [
      'src/views/components/inquiry-card.vue'
    ]),
    null
  );
});

test('accept/archive PASS blocked by NEEDS_CHANGES review and path drift', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-consistency-'));
  try {
    const runId = 'RALPH-consistency-20260729';
    initRun({ run_id: runId, title: 'consistency', goal: 'block false complete', capability_ids: ['CAP-consistency'] }, cwd);
    const runDirPath = path.join(cwd, '.workflow', 'ralph', runId);
    const bt = String.fromCharCode(96);
    fs.writeFileSync(
      path.join(runDirPath, 'plan.md'),
      ['# Plan', `- TASK: ${bt}publish-dialog.vue${bt} blur`].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(runDirPath, 'acceptance.md'),
      ['# Acceptance', `| blur | PASS | ${bt}publish-dialog.vue${bt} |`].join('\n'),
      'utf8'
    );

    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    setGate(runId, { gate: 'deliver', status: 'PASS', cwd });

    assert.throws(
      () => setGate(runId, {
        gate: 'accept',
        status: 'PASS',
        cwd,
        diff_paths: ['src/views/pages/draft-manage/InventoryManager.vue']
      }),
      /product-consistency gate blocked accept PASS/
    );

    // Align ledger and diff first, then record a failing review.
    fs.writeFileSync(
      path.join(runDirPath, 'plan.md'),
      ['# Plan', `- TASK: ${bt}InventoryManager.vue${bt} focus-visible`].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(runDirPath, 'acceptance.md'),
      ['# Acceptance', `| css | PASS | ${bt}InventoryManager.vue${bt} |`].join('\n'),
      'utf8'
    );
    recordReview(runId, {
      cwd,
      outcome: 'NEEDS_CHANGES',
      summary: 'ledger/code still inconsistent historically',
      findings: [{
        id: 'F-1',
        severity: 'medium',
        file: 'acceptance.md',
        line: 1,
        description: 'OPEN drift',
        status: 'OPEN',
        acceptance: 'sync ledger'
      }]
    });

    assert.throws(
      () => setGate(runId, {
        gate: 'accept',
        status: 'PASS',
        cwd,
        diff_paths: ['src/views/pages/draft-manage/InventoryManager.vue']
      }),
      /latest review REV-1 is NEEDS_CHANGES/
    );

    // Direct archive must also refuse when review is NEEDS_CHANGES even if accept was forced earlier.
    const runPath = path.join(runDirPath, 'run.json');
    const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
    run.gates.accept = 'PASS';
    saveRun(run, cwd);
    assert.throws(() => archiveRun(runId, { cwd }), /archive blocked by product-consistency gate/)

    // force escapes the gate for operator override.
    const forced = setGate(runId, {
      gate: 'accept',
      status: 'PASS',
      cwd,
      force: true,
      diff_paths: ['src/views/pages/draft-manage/InventoryManager.vue']
    });
    assert.equal(forced.run.gates.accept, 'PASS');
    const archived = archiveRun(runId, { cwd, force: true });
    assert.equal(archived.run.status, 'COMPLETED');

    const evalOk = evaluateAcceptArchiveGate(run, {
      cwd,
      force: true,
      diff_paths: ['src/views/pages/draft-manage/InventoryManager.vue']
    });
    assert.equal(evalOk.ok, true);
    assert.equal(evalOk.forced, true);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});


test('accept PASS blocked when write-then-read evidence_class is only static', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-evclass-'));
  try {
    const runId = 'RALPH-evidence-class-20260901';
    initRun({
      run_id: runId,
      title: 'evidence class',
      goal: 'block false green',
      attach_knowledge: false
    }, cwd);
    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    setGate(runId, { gate: 'deliver', status: 'PASS', cwd });
    const acceptancePath = path.join(cwd, '.workflow', 'ralph', runId, 'acceptance.md');
    fs.writeFileSync(acceptancePath, [
      '# Acceptance',
      '',
      '| item | must_id | evidence_class | result | evidence |',
      '| --- | --- | --- | --- | --- |',
      '| title persist | REQ-001 | write-then-read | PASS | static |',
      ''
    ].join('\n'), 'utf8');
    const inspected = inspectAcceptanceEvidence(loadRun(runId, cwd), cwd);
    assert.equal(inspected.header_has_class, true);
    assert.equal(inspected.weak_evidence_pass, true);
    assert.throws(
      () => setGate(runId, { gate: 'accept', status: 'PASS', cwd }),
      /evidence_class over-claim/
    );
    const forced = setGate(runId, { gate: 'accept', status: 'PASS', cwd, force: true });
    assert.equal(forced.run.gates.accept, 'PASS');

    fs.writeFileSync(acceptancePath, [
      '# Acceptance',
      '',
      '| item | must_id | evidence_class | result | evidence |',
      '| --- | --- | --- | --- | --- |',
      '| title persist | REQ-001 | write-then-read | PASS | write_then_read:mock_ok |',
      ''
    ].join('\n'), 'utf8');
    const run = loadRun(runId, cwd);
    run.gates.accept = 'PENDING';
    saveRun(run, cwd);
    const ok = setGate(runId, { gate: 'accept', status: 'PASS', cwd });
    assert.equal(ok.run.gates.accept, 'PASS');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('archive blocks working_tree PASS review without fix commit (v2)', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-v2-'));
  try {
    const runId = 'RALPH-review-scope-20260729';
    initRun({ run_id: runId, title: 'scope', goal: 'working tree review cannot archive', capability_ids: ['CAP-scope'], attach_knowledge: false }, cwd);
    const runDirPath = path.join(cwd, '.workflow', 'ralph', runId);
    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    setGate(runId, { gate: 'deliver', status: 'PASS', cwd });
    recordReview(runId, {
      cwd,
      outcome: 'PASS',
      review_scope: 'working_tree',
      summary: 'looks ok in tree'
    });
    setGate(runId, {
      gate: 'accept',
      status: 'PASS',
      cwd,
      diff_paths: []
    });
    assert.throws(
      () => archiveRun(runId, { cwd, diff_paths: [] }),
      /review_scope=commit/
    );
    recordReview(runId, {
      cwd,
      outcome: 'PASS',
      review_scope: 'commit',
      fix_commit: 'abcdef1234567',
      reviewed_commit: 'abcdef1234567',
      summary: 'landed'
    });
    const archived = archiveRun(runId, { cwd, diff_paths: [] });
    assert.equal(archived.run.status, 'COMPLETED');
    const latest = archived.run.review.reviews.at(-1);
    assert.equal(latest.review_scope, 'commit');
    assert.equal(latest.fix_commit, 'abcdef1234567');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('accept blocked when deliver pending despite progress DELIVER (v4)', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-v4-'));
  try {
    const runId = 'RALPH-deliver-drift-20260729';
    initRun({ run_id: runId, title: 'drift', goal: 'deliver outside ledger', capability_ids: ['CAP-drift'], attach_knowledge: false }, cwd);
    const runDirPath = path.join(cwd, '.workflow', 'ralph', runId);
    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    fs.appendFileSync(path.join(runDirPath, 'progress.md'), '- 2026-07-29 DELIVER: changed account.vue\n', 'utf8');
    const drift = detectDeliverOutsideLedger(
      JSON.parse(fs.readFileSync(path.join(runDirPath, 'run.json'), 'utf8')),
      cwd,
      { diff_paths: ['src/views/account.vue'] }
    );
    assert.equal(drift.observed, true);
    assert.ok(drift.signals.includes('progress_mentions_deliver'));
    assert.throws(
      () => setGate(runId, {
        gate: 'accept',
        status: 'PASS',
        cwd,
        diff_paths: ['src/views/account.vue']
      }),
      /gates\.deliver=PASS|deliver work observed/
    );
    setGate(runId, { gate: 'deliver', status: 'PASS', cwd });
    const ok = setGate(runId, {
      gate: 'accept',
      status: 'PASS',
      cwd,
      diff_paths: ['src/views/account.vue']
    });
    assert.equal(ok.run.gates.accept, 'PASS');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('host-record and init host metadata persist on run', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-host-'));
  try {
    const runId = 'RALPH-host-meta-20260729';
    initRun({
      run_id: runId,
      title: 'host',
      goal: 'bind host',
      capability_ids: ['CAP-host'],
      attach_knowledge: false,
      host: { host_id: 'grok-build', thread_id: 'thread-1', model_id: 'grok-x' }
    }, cwd);
    let run = JSON.parse(fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, 'run.json'), 'utf8'));
    assert.equal(run.host.host_id, 'grok-build');
    assert.equal(run.host.thread_id, 'thread-1');
    const updated = recordHostMeta(runId, { export_path: '.workflow/exports/thread-1.jsonl', session_handle: 'sess-9' }, cwd);
    assert.equal(updated.host.export_path, '.workflow/exports/thread-1.jsonl');
    assert.equal(updated.host.session_handle, 'sess-9');
    const stdout = { write: () => {} };
    assert.equal(runCli(['ralph', 'host-record', '--run-id', runId, '--host-id', 'codex', '--thread-id', '019f', '--json'], { cwd, stdout }), 0);
    run = JSON.parse(fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, 'run.json'), 'utf8'));
    assert.equal(run.host.host_id, 'codex');
    assert.equal(run.host.thread_id, '019f');
    assert.equal(resolveReviewScope({ reviewed_commit: 'abcdef1' }), 'commit');
    assert.equal(resolveReviewScope({}), 'working_tree');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('init intensity tiers set budget and accept_layers defaults', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-intensity-'));
  try {
    for (const intensity of ['tiny', 'standard', 'strict']) {
      const runId = 'RALPH-intensity-' + intensity + '-20260731';
      initRun({
        run_id: runId,
        title: 'intensity ' + intensity,
        goal: 'tier defaults',
        capability_ids: ['CAP-intensity'],
        attach_knowledge: false,
        intensity
      }, cwd);
      const run = loadRun(runId, cwd);
      assert.equal(run.intensity, intensity);
      assert.equal(run.max_iterations, INTENSITY_DEFAULTS[intensity].max_iterations);
      assert.equal(run.budget.max_deliver_loops, INTENSITY_DEFAULTS[intensity].budget.max_deliver_loops);
      assert.equal(run.stagnation.patience, INTENSITY_DEFAULTS[intensity].stagnation_patience);
      assert.equal(run.stagnation.unchanged_count, 0);
      if (intensity === 'strict') {
        assert.equal(run.accept_layers.judgment, 'PENDING');
      } else {
        assert.equal(run.accept_layers.judgment, 'SKIPPED');
      }
      assert.deepEqual(validateRun(run), []);
    }
    assert.throws(
      () => initRun({
        run_id: 'RALPH-intensity-bad-20260731',
        title: 'bad',
        goal: 'bad',
        capability_ids: ['CAP-intensity'],
        attach_knowledge: false,
        intensity: 'ludicrous'
      }, cwd),
      /intensity must be/
    );
    // default standard
    initRun({
      run_id: 'RALPH-intensity-default-20260731',
      title: 'default',
      goal: 'default',
      capability_ids: ['CAP-intensity'],
      attach_knowledge: false
    }, cwd);
    assert.equal(loadRun('RALPH-intensity-default-20260731', cwd).intensity, 'standard');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('recordDeliverAttempt stagnates then BLOCKED with STAGNATION', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-stag-'));
  try {
    const runId = 'RALPH-stagnation-20260731';
    initRun({
      run_id: runId,
      title: 'stag',
      goal: 'stop spinning',
      capability_ids: ['CAP-stag'],
      attach_knowledge: false,
      intensity: 'tiny'
    }, cwd);
    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });

    let r = recordDeliverAttempt(runId, { improved: false, signal: 'test_fail:foo', cwd });
    assert.equal(r.blocked, false);
    assert.equal(r.stagnation.unchanged_count, 1);
    assert.equal(r.iteration, 1);

    r = recordDeliverAttempt(runId, { improved: false, signal: 'test_fail:foo', cwd });
    assert.equal(r.blocked, true);
    assert.equal(r.status, 'BLOCKED');
    assert.equal(r.intervention_needed.kind, 'STAGNATION');
    assert.equal(r.stagnation.unchanged_count, 2);

    // improvement resets counter when unblocked
    setRunStatus(runId, { status: 'IN_PROGRESS', reason: 'retry with new strategy', cwd });
    r = recordDeliverAttempt(runId, { improved: true, signal: 'tests_green', cwd });
    assert.equal(r.blocked, false);
    assert.equal(r.stagnation.unchanged_count, 0);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('recordDeliverAttempt auto fingerprint detects no-change stagnation', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-auto-fp-'));
  try {
    const runId = 'RALPH-auto-fp-20260731';
    initRun({
      run_id: runId,
      title: 'auto fp',
      goal: 'fingerprint',
      capability_ids: ['CAP-fp'],
      attach_knowledge: false,
      intensity: 'tiny'
    }, cwd);
    const samePaths = ['src/a.js'];
    const r1 = recordDeliverAttempt(runId, {
      signal: 'fail',
      paths: samePaths,
      cwd
    });
    assert.equal(r1.improved_source, 'auto');
    assert.equal(r1.improved, true); // baseline
    assert.ok(r1.fingerprint);

    const r2 = recordDeliverAttempt(runId, {
      signal: 'fail',
      paths: samePaths,
      cwd
    });
    assert.equal(r2.improved, false);
    assert.equal(r2.blocked, false);

    const r3 = recordDeliverAttempt(runId, {
      signal: 'fail',
      paths: samePaths,
      cwd
    });
    assert.equal(r3.improved, false);
    assert.equal(r3.blocked, true);
    assert.equal(r3.intervention_needed.kind, 'STAGNATION');

    // path change → improved
    setRunStatus(runId, { status: 'IN_PROGRESS', reason: 'new diff', cwd });
    const r4 = recordDeliverAttempt(runId, {
      signal: 'fail',
      paths: ['src/a.js', 'src/b.js'],
      cwd
    });
    assert.equal(r4.improved, true);
    assert.equal(r4.stagnation.unchanged_count, 0);

    const fp = fingerprintDeliverState(cwd, { signal: 'x', paths: ['src/z.js'] });
    assert.equal(fp.fingerprint.length, 16);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('strict accept requires judgment layer; error gate_issues block; standard can skip', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-accept-layer-'));
  try {
    const strictId = 'RALPH-strict-accept-20260731';
    initRun({
      run_id: strictId,
      title: 'strict accept',
      goal: 'judgment required',
      capability_ids: ['CAP-strict'],
      attach_knowledge: false,
      intensity: 'strict'
    }, cwd);
    setGate(strictId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(strictId, { gate: 'plan', status: 'PASS', cwd });
    setGate(strictId, { gate: 'deliver', status: 'PASS', cwd });

    // Without judgment PASS, strict accept is blocked (force would bypass — not used here).
    assert.throws(
      () => setGate(strictId, { gate: 'accept', status: 'PASS', cwd }),
      /judgment/
    );

    setAcceptLayer(strictId, { layer: 'judgment', status: 'PASS', mode: 'review', note: 'REV ok', cwd });
    const passed = setGate(strictId, { gate: 'accept', status: 'PASS', cwd });
    assert.equal(passed.run.gates.accept, 'PASS');
    assert.equal(passed.run.accept_layers.mechanical, 'PASS');
    assert.equal(passed.run.accept_layers.judgment, 'PASS');

    const stdId = 'RALPH-std-accept-20260731';
    initRun({
      run_id: stdId,
      title: 'standard accept',
      goal: 'skip judgment',
      capability_ids: ['CAP-std'],
      attach_knowledge: false,
      intensity: 'standard'
    }, cwd);
    setGate(stdId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(stdId, { gate: 'plan', status: 'PASS', cwd });
    setGate(stdId, { gate: 'deliver', status: 'PASS', cwd });
    const stdPass = setGate(stdId, { gate: 'accept', status: 'PASS', cwd });
    assert.equal(stdPass.run.gates.accept, 'PASS');
    assert.equal(stdPass.run.accept_layers.judgment, 'SKIPPED');

    const errId = 'RALPH-gate-issue-20260731';
    initRun({
      run_id: errId,
      title: 'gate issue',
      goal: 'error blocks',
      capability_ids: ['CAP-issue'],
      attach_knowledge: false,
      intensity: 'standard'
    }, cwd);
    setGate(errId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(errId, { gate: 'plan', status: 'PASS', cwd });
    setGate(errId, { gate: 'deliver', status: 'PASS', cwd });
    addGateIssue(errId, { class: 'error', code: 'SEC-1', message: 'secret in code', cwd });
    assert.equal(evaluateAcceptJudgment(loadRun(errId, cwd)).ok, false);
    assert.throws(() => setGate(errId, { gate: 'accept', status: 'PASS', cwd }), /gate_issue error/);
    // warning does not block
    const warnId = 'RALPH-gate-warn-20260731';
    initRun({
      run_id: warnId,
      title: 'warn',
      goal: 'warn ok',
      capability_ids: ['CAP-warn'],
      attach_knowledge: false
    }, cwd);
    setGate(warnId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(warnId, { gate: 'plan', status: 'PASS', cwd });
    setGate(warnId, { gate: 'deliver', status: 'PASS', cwd });
    addGateIssue(warnId, { class: 'warning', message: 'style nits', cwd });
    assert.equal(setGate(warnId, { gate: 'accept', status: 'PASS', cwd }).run.gates.accept, 'PASS');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('recordReview PASS sets accept_layers.judgment for strict accept path', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-review-judgment-'));
  try {
    const runId = 'RALPH-review-judgment-20260731';
    initRun({
      run_id: runId,
      title: 'review judgment',
      goal: 'auto judgment from review',
      capability_ids: ['CAP-rj'],
      attach_knowledge: false,
      intensity: 'strict'
    }, cwd);
    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    setGate(runId, { gate: 'deliver', status: 'PASS', cwd });
    assert.equal(loadRun(runId, cwd).accept_layers.judgment, 'PENDING');
    recordReview(runId, { cwd, outcome: 'PASS', summary: 'ok', findings: [] });
    const after = loadRun(runId, cwd);
    assert.equal(after.accept_layers.judgment, 'PASS');
    assert.equal(after.accept_layers.judgment_mode, 'review');
    const accepted = setGate(runId, { gate: 'accept', status: 'PASS', cwd });
    assert.equal(accepted.run.gates.accept, 'PASS');

    recordReview(runId, {
      cwd,
      outcome: 'NEEDS_CHANGES',
      summary: 'fix',
      findings: [{
        id: 'F-1',
        severity: 'high',
        file: 'src/a.js',
        line: 1,
        description: 'bug',
        status: 'OPEN',
        acceptance: 'fix it'
      }]
    });
    assert.equal(loadRun(runId, cwd).accept_layers.judgment, 'FAIL');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('map-merge puts STAGNATION/strict into process_lessons by default', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-auto-lessons-'));
  try {
    const runId = 'RALPH-auto-lessons-20260731';
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

test('finalize writes knowledge-contribution with durable lessons only by default', () => {
  withoutLocalPortfolio(() => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-contrib-'));
  try {
    const runId = 'RALPH-contrib-20260801';
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
    assert.ok(result.contribution_path);
    assert.equal(result.elevation.durable_lessons.length, 1);
    assert.ok(result.capability.lessons.includes('tip bottom uses 6px not 8px'));
    const contribAbs = path.join(cwd, result.contribution_path);
    assert.ok(fs.existsSync(contribAbs));
    const contrib = JSON.parse(fs.readFileSync(contribAbs, 'utf8'));
    assert.equal(contrib.schema_version, 'jj-flow/ralph-knowledge-contribution/0.1');
    assert.ok(contrib.candidates.some((c) => c.type === 'capability'));
    assert.ok(contrib.candidates.some((c) => c.type === 'lesson' && /6px/.test(c.summary)));
    assert.equal(contrib.policy.auto_promote, false);
    // process lessons should not appear as lesson candidates
    assert.ok(!contrib.candidates.some((c) => /STAGNATION/.test(c.summary || '')));

    const again = knowledgeContribute(runId, { cwd, lessons: ['tip bottom uses 6px not 8px'], modules: ['src/tip.vue'] });
    assert.ok(again.path);
    assert.equal(again.hook.status, 'skipped');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
  });
});

test('knowledge-contribute hook ok / failed fail-open via RALPH_KNOWLEDGE_HOOK_CMD', () => {
  withoutLocalPortfolio(() => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-hook-'));
  const prevCmd = process.env.RALPH_KNOWLEDGE_HOOK_CMD;
  const prevMode = process.env.RALPH_KNOWLEDGE_HOOK;
  try {
    const runId = 'RALPH-hook-20260801';
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
    // cross-platform no-op success
    process.env.RALPH_KNOWLEDGE_HOOK_CMD = process.platform === 'win32'
      ? 'node -e "process.exit(0)"'
      : 'node -e "process.exit(0)"';
    const ok = knowledgeContribute(runId, { cwd, lessons: ['durable'], modules: ['a.js'], hook: true });
    assert.equal(ok.hook.status, 'ok');

    process.env.RALPH_KNOWLEDGE_HOOK_CMD = 'node -e "process.exit(2)"';
    const bad = knowledgeContribute(runId, { cwd, lessons: ['durable'], modules: ['a.js'], hook: true });
    assert.equal(bad.hook.status, 'failed');
    // fail-open: still returns package path
    assert.ok(bad.path);
  } finally {
    if (prevCmd === undefined) delete process.env.RALPH_KNOWLEDGE_HOOK_CMD;
    else process.env.RALPH_KNOWLEDGE_HOOK_CMD = prevCmd;
    if (prevMode === undefined) delete process.env.RALPH_KNOWLEDGE_HOOK;
    else process.env.RALPH_KNOWLEDGE_HOOK = prevMode;
    fs.rmSync(cwd, { recursive: true, force: true });
  }
  });
});

test('cli deliver-attempt and accept-layer wire through', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-cli-layer-'));
  try {
    const runId = 'RALPH-cli-layer-20260731';
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

test('init writes intent.md except tiny; analyze has Flagged concerns', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-intent-'));
  try {
    const standardId = 'RALPH-intent-std-20260831';
    initRun({ run_id: standardId, title: 'intent std', goal: 'write intent', attach_knowledge: false }, cwd);
    const stdDir = path.join(cwd, '.workflow', 'ralph', standardId);
    assert.equal(loadRun(standardId, cwd).artifact_refs.intent, 'intent.md');
    assert.ok(fs.existsSync(path.join(stdDir, 'intent.md')));
    assert.match(fs.readFileSync(path.join(stdDir, 'analyze.md'), 'utf8'), /## Flagged concerns/);

    const tinyId = 'RALPH-intent-tiny-20260831';
    initRun({ run_id: tinyId, title: 'intent tiny', goal: 'skip intent', intensity: 'tiny', attach_knowledge: false }, cwd);
    assert.equal(loadRun(tinyId, cwd).artifact_refs.intent, null);
    assert.equal(fs.existsSync(path.join(cwd, '.workflow', 'ralph', tinyId, 'intent.md')), false);

    const forcedId = 'RALPH-intent-force-20260831';
    initRun({ run_id: forcedId, title: 'intent force', goal: 'tiny with intent', intensity: 'tiny', write_intent: true, attach_knowledge: false }, cwd);
    assert.equal(loadRun(forcedId, cwd).artifact_refs.intent, 'intent.md');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('extractPlanCurrentSection ignores Landed and claimed paths use Current only', () => {
  const bt = String.fromCharCode(96);
  const withCurrent = [
    '# Plan',
    '## Current',
    `- TASK-2 ${bt}tip.vue${bt}`,
    '## Landed',
    `- TASK-1 ${bt}old-panel.vue${bt}`,
    '## Superseded',
    `- TASK-0 ${bt}legacy.vue${bt}`
  ].join('\n');
  assert.deepEqual(extractLedgerPathRefs(extractPlanCurrentSection(withCurrent)), ['tip.vue']);
  assert.ok(extractLedgerPathRefs(withCurrent).includes('old-panel.vue'));

  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-current-'));
  try {
    const runId = 'RALPH-current-paths-20260831';
    initRun({ run_id: runId, title: 'current paths', goal: 'current only', attach_knowledge: false }, cwd);
    const dir = path.join(cwd, '.workflow', 'ralph', runId);
    fs.writeFileSync(path.join(dir, 'plan.md'), withCurrent, 'utf8');
    const claimed = collectClaimedImplementationPaths(loadRun(runId, cwd), cwd);
    assert.deepEqual(claimed, ['tip.vue']);
    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    setGate(runId, { gate: 'deliver', status: 'PASS', cwd });
    const ok = setGate(runId, {
      gate: 'accept',
      status: 'PASS',
      cwd,
      diff_paths: ['src/views/tip.vue']
    });
    assert.equal(ok.run.gates.accept, 'PASS');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('second unchanged deliver-attempt writes instruction-correction', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-twostrike-'));
  try {
    const runId = 'RALPH-twostrike-20260831';
    initRun({ run_id: runId, title: 'two strike', goal: 'stagnation correction', attach_knowledge: false }, cwd);
    recordDeliverAttempt(runId, { cwd, improved: false, signal: 'same-tool' });
    const second = recordDeliverAttempt(runId, { cwd, improved: false, signal: 'same-tool' });
    assert.equal(second.blocked, true);
    const correction = path.join(cwd, '.workflow', 'ralph', runId, INSTRUCTION_CORRECTION_REL);
    assert.ok(fs.existsSync(correction));
    assert.match(fs.readFileSync(correction, 'utf8'), /Proposed rule/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('bugfix cannot delete tests; tiny presentational does not trip', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-testint-'));
  try {
    const runId = 'RALPH-testint-20260831';
    initRun({ run_id: runId, title: 'test integrity', goal: 'protect tests', attach_knowledge: false }, cwd);
    fs.appendFileSync(
      path.join(cwd, '.workflow', 'ralph', runId, 'progress.md'),
      '- 2026-08-31T00:00:00.000Z failed_must REQ-1\n',
      'utf8'
    );
    const hit = detectTestIntegrityViolation(loadRun(runId, cwd), cwd, {
      diff_paths: ['src/app.js'],
      deleted_paths: ['tests/app.test.js']
    });
    assert.equal(hit.violated, true);

    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    setGate(runId, { gate: 'deliver', status: 'PASS', cwd });
    assert.throws(
      () => setGate(runId, {
        gate: 'accept',
        status: 'PASS',
        cwd,
        diff_paths: ['src/app.js'],
        deleted_paths: ['tests/app.test.js']
      }),
      /must not delete or empty tests/
    );

    const tinyId = 'RALPH-testint-tiny-20260831';
    initRun({ run_id: tinyId, title: 'tiny css', goal: 'color', intensity: 'tiny', attach_knowledge: false }, cwd);
    const skip = detectTestIntegrityViolation(loadRun(tinyId, cwd), cwd, {
      diff_paths: ['src/a.css'],
      deleted_paths: ['tests/a.test.js']
    });
    assert.equal(skip.violated, false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('review findings support pass/importance, nit cap, and skip generated paths', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-review-policy-'));
  try {
    const runId = 'RALPH-review-policy-20260831';
    initRun({ run_id: runId, title: 'review policy', goal: 'nits', attach_knowledge: false }, cwd);
    const nits = [];
    for (let i = 1; i <= 7; i += 1) {
      nits.push({
        id: 'F-N' + i,
        severity: 'info',
        importance: 'nit',
        file: 'src/a.js',
        line: i,
        description: 'style ' + i,
        status: 'OPEN',
        acceptance: 'optional'
      });
    }
    nits.push({
      id: 'F-GEN',
      severity: 'low',
      file: 'src/gen/types.js',
      line: 1,
      description: 'generated',
      status: 'OPEN',
      acceptance: 'skip'
    });
    const result = recordReview(runId, {
      cwd,
      outcome: 'PASS',
      summary: 'nits only',
      findings: nits,
      include_compliance: false
    });
    const waived = result.report.findings.filter((item) => item.status === 'WAIVED');
    const open = result.report.findings.filter((item) => item.status === 'OPEN');
    assert.equal(open.length, 0);
    assert.equal(waived.length, 7);
    assert.equal(result.report.findings.some((item) => item.file === 'src/gen/types.js'), false);
    assert.equal(result.report.outcome, 'PASS');

    const capId = 'RALPH-review-nitcap-20260831';
    initRun({ run_id: capId, title: 'nit cap', goal: 'cap', attach_knowledge: false }, cwd);
    const cap = recordReview(capId, {
      cwd,
      outcome: 'NEEDS_CHANGES',
      summary: 'nits plus important',
      include_compliance: false,
      findings: [
        ...nits,
        {
          id: 'F-IMP',
          severity: 'high',
          pass: 'bugs',
          importance: 'important',
          file: 'src/a.js',
          line: 9,
          description: 'broken',
          status: 'OPEN',
          acceptance: 'fix'
        }
      ]
    });
    assert.equal(cap.report.findings.filter((item) => item.importance === 'nit' && item.status === 'OPEN').length, 5);
    assert.equal(cap.report.findings.filter((item) => item.importance === 'nit' && item.status === 'WAIVED').length, 2);

    const flipId = 'RALPH-review-important-pass-20260831';
    initRun({ run_id: flipId, title: 'important pass', goal: 'flip', attach_knowledge: false }, cwd);
    const flip = recordReview(flipId, {
      cwd,
      outcome: 'PASS',
      summary: 'important still open',
      include_compliance: false,
      findings: [{
        id: 'F-IMP-PASS',
        severity: 'high',
        pass: 'bugs',
        importance: 'important',
        file: 'src/a.js',
        line: 1,
        description: 'broken',
        status: 'OPEN',
        acceptance: 'fix'
      }]
    });
    assert.equal(flip.report.outcome, 'NEEDS_CHANGES');

    const planId = 'RALPH-review-plan-file-20260831';
    initRun({ run_id: planId, title: 'plan finding', goal: 'keep plan.md', attach_knowledge: false }, cwd);
    const planFinding = recordReview(planId, {
      cwd,
      outcome: 'NEEDS_CHANGES',
      summary: 'compliance vs Current',
      include_compliance: false,
      findings: [{
        id: 'F-COMPLIANCE-PLAN',
        severity: 'high',
        pass: 'compliance',
        importance: 'important',
        file: 'plan.md',
        line: 1,
        description: 'diff misses Current',
        status: 'OPEN',
        acceptance: 'align Current'
      }]
    });
    assert.equal(planFinding.report.findings.some((item) => item.file === 'plan.md' && item.status === 'OPEN'), true);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('computeRunMetrics derives clocks as null when timestamps missing quality', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-metrics-'));
  try {
    const runId = 'RALPH-metrics-20260831';
    initRun({ run_id: runId, title: 'metrics', goal: 'derived', attach_knowledge: false }, cwd);
    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    const metrics = computeRunMetrics(loadRun(runId, cwd), cwd);
    assert.equal(metrics.clock_quality, 'derived');
    assert.equal(metrics.deliver_rework_cycles, 0);
    assert.equal(typeof metrics.analyze_to_plan_hours === 'number' || metrics.analyze_to_plan_hours === null, true);
    const chunks = [];
    assert.equal(runCli(['ralph', 'metrics', '--run-id', runId, '--json'], { cwd, stdout: { write: (t) => chunks.push(t) } }), 0);
    const payload = JSON.parse(chunks[chunks.length - 1]);
    assert.equal(payload.metrics.clock_quality, 'derived');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
