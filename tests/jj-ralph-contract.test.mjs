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
  RALPH_RUN_SCHEMA_VERSION_LEGACY,
  TASK_PLAN_REL,
  KNOWLEDGE_CONTRIBUTION_DEGRADED_REASON,
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
  extractMarkdownSection,
  extractPlanCurrentSection,
  readRunArtifactText,
  readRunEventsText,
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
  loadRun,
  listRuns,
  locateRalphRuns,
  computeRalphNext,
  collectIndexArchiveHints,
  collectSameRequirementHints,
  writeRalphIndex,
  INDEX_ACTIVE_CAP,
  INDEX_STALE_MS,
  migrateRuns,
  adoptRun,
  getStatus,
  writeHandoffPackage,
  renderRalphStatusText,
  GATE_ALIASES,
  GATE_SET_HEURISTIC,
  LITE_MAX_DELIVER_LOOPS,
  createRunSkeleton,
  promoteGateSetToFull,
  suggestGateSet,
  updateRunScope,
  appendProgressRound,
  pruneArchive
} from '../src/ralph.mjs';
import * as ralphApi from '../src/ralph.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const RALPH_PUBLIC_EXPORTS = Object.freeze([
  'ACCEPT_LAYER_STATUSES',
  'EVENTS_JSONL_REL',
  'FINDINGS_REL',
  'FINDING_HINT',
  'FINDING_IMPORTANCE',
  'FINDING_PASSES',
  'GATE_ALIASES',
  'GATE_ISSUE_CLASSES',
  'GATE_SETS',
  'GATE_SET_HEURISTIC',
  'HANDOFF_ROOT_REL',
  'HOST_IDS',
  'HOST_REVIEW_METHODS',
  'INDEX_ACTIVE_CAP',
  'INDEX_MD_REL',
  'INDEX_STALE_MS',
  'INSTRUCTION_CORRECTION_REL',
  'INTENSITY_DEFAULTS',
  'JUDGMENT_MODES',
  'KNOWLEDGE_CONTRIBUTION_DEGRADED_REASON',
  'LITE_MAX_DELIVER_LOOPS',
  'PHASE_ROLLBACK_EDGES',
  'PROGRESS_REL',
  'RALPHS_DIR_REL',
  'RALPH_ARCHIVE_DIR_REL',
  'RALPH_COMPLETED_DIR_REL',
  'RALPH_HANDOFF_SCHEMA_VERSION',
  'RALPH_INTENSITIES',
  'RALPH_KNOWLEDGE_CONTRIBUTION_SCHEMA',
  'RALPH_MAP_REL',
  'RALPH_MAP_SCHEMA_VERSION',
  'RALPH_MIGRATED_DIR_REL',
  'RALPH_REVIEW_SCHEMA_VERSION',
  'RALPH_ROOT_REL',
  'RALPH_RUN_SCHEMA_VERSION',
  'RALPH_RUN_SCHEMA_VERSIONS',
  'RALPH_RUN_SCHEMA_VERSION_1_1',
  'RALPH_RUN_SCHEMA_VERSION_LEGACY',
  'RALPH_TASKS_DIR_REL',
  'REVIEW_NIT_CAP',
  'REVIEW_SCOPES',
  'REVIEW_SOURCES',
  'RUN_STATUSES',
  'SECTION_ACCEPT',
  'SECTION_ANALYZE',
  'SECTION_CURRENT',
  'SECTION_FLAGGED',
  'SECTION_GOAL',
  'SECTION_LANDED',
  'SECTION_MUST',
  'SECTION_OPEN_QUESTIONS',
  'SECTION_OUT',
  'SECTION_PLAN',
  'SECTION_SUPERSEDED',
  'SECTION_UNRESOLVED',
  'STATE_REL',
  'TASK_PLAN_REL',
  'abandonRun',
  'addGateIssue',
  'adoptRun',
  'appendEvent',
  'appendProgressLine',
  'appendProgressRound',
  'applyHandoffState',
  'applyLiteBudget',
  'archiveDir',
  'archiveRun',
  'assertStrictRalphRunId',
  'buildArchiveDirNameFromRunId',
  'buildBudgetForIntensity',
  'buildElevationFromRun',
  'buildKnowledgeContribution',
  'buildPlanComplianceFindings',
  'buildRalphRunId',
  'capabilityFromRun',
  'collectClaimedImplementationPaths',
  'collectGitDeletedPaths',
  'collectGitDiffPaths',
  'collectIndexArchiveHints',
  'collectSameRequirementHints',
  'commitPrep',
  'computeRalphNext',
  'computeRunMetrics',
  'compactKeywords',
  'confirmProjectHotMemory',
  'createEmptyAcceptLayers',
  'createEmptyMap',
  'createEmptyStagnation',
  'createRunSkeleton',
  'defaultArchiveDirName',
  'deriveAutoLessonsFromRun',
  'detectDeliverOutsideLedger',
  'detectTestIntegrityViolation',
  'effectiveGateSet',
  'evaluateAcceptArchiveGate',
  'evaluateAcceptJudgment',
  'extractLedgerPathRefs',
  'extractMarkdownSection',
  'extractPlanCurrentSection',
  'finalizeRun',
  'findImplementationPathMismatch',
  'findInMap',
  'findRalphInitConflict',
  'fingerprintDeliverState',
  'getLatestReviewRecord',
  'getStatus',
  'initRun',
  'inspectAcceptanceEvidence',
  'invokeKnowledgeContributeHook',
  'isLegacyRalphRunId',
  'isReviewSkipPath',
  'isReviewSliceText',
  'isTaskRunId',
  'isTestPath',
  'knowledgeContribute',
  'liftLegacyTasksLayout',
  'listRuns',
  'loadMap',
  'loadNamingConfig',
  'loadRun',
  'locateRalphRuns',
  'mapFind',
  'mapMergeFromRun',
  'mapPath',
  'mergeCapabilityIntoMap',
  'migrateHint',
  'migrateOneRun',
  'migrateRuns',
  'moveRunToActive',
  'moveRunToCompleted',
  'normalizeGateSet',
  'normalizeHostMeta',
  'normalizeHostReview',
  'normalizeIntensity',
  'normalizeRalphSlug',
  'nowIso',
  'persistRunMetrics',
  'promoteGateSetToFull',
  'promoteHotMemoryFromRun',
  'promotionProgressLine',
  'proposeTaskIdFromLegacy',
  'pruneArchive',
  'pruneProjectHotMemory',
  'ralphRoot',
  'ralphsDir',
  'readEvents',
  'readJson',
  'readRunArtifactText',
  'readRunEventsText',
  'recordDeliverAttempt',
  'recordFinding',
  'recordHostMeta',
  'recordReview',
  'renderRalphStatusText',
  'resolveGateKeys',
  'resolveKnowledgeContributeHookConfig',
  'resolveReviewScope',
  'resumeRun',
  'rollbackPhase',
  'runDir',
  'runJsonPath',
  'runStateDir',
  'saveMap',
  'saveRun',
  'setAcceptLayer',
  'setGate',
  'setRunStatus',
  'shelterDotMigrated',
  'stripRunIdPrefix',
  'suggestGateSet',
  'suggestReopenAsNew',
  'tokenize',
  'updateRunScope',
  'validateMap',
  'validateReviewReport',
  'validateRun',
  'writeDispatchSnapshot',
  'writeHandoffPackage',
  'writeInstructionCorrection',
  'writeJson',
  'writeKnowledgeContribution',
  'writeRalphIndex'
]);

test('P1b façade export set includes layout constants', () => {
  assert.deepEqual(Object.keys(ralphApi).sort(), [...RALPH_PUBLIC_EXPORTS].sort());
  assert.equal('unique' in ralphApi, false);
});

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function ledgerText(cwd, runId) {
  return readRunEventsText(runId, cwd);
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
    'task_plan.md',
    'instruction-correction',
    'metrics',
    '2–3',
    '~/.jj-flow',
    'Idle offer',
    'jj-init',
    'knowledge-confirm',
    'hot_memory',
    // conversational path: never --lite; screenshot / analyze-hold / same-session continue
    'Conversational path never uses --lite',
    'gate brief',
    'gate close',
    '先不写代码',
    '按审查改',
    '改坏了',
    'gate_set?',
    'Tool use (speed)',
    'Goal / 验收 / Steps',
    'MasterGo',
    'offset',
    'commit-scoped-review',
    '归档提示',
    '.workflow/ralph/index.md',
    '询问用户',
    '审查修复',
    'review-fix',
    '同需求提示',
    'host.thread_id',
    'wait for the user to say'
  ]) {
    assert.match(skill, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(skill, /`tiny` only shortens the plan/);
  assert.match(skill, /Screenshot \/ `\[Image\]` \/ 「这里」/);
  assert.doesNotMatch(skill, /顺手修/);
  assert.doesNotMatch(skill, /完整走一遍/);

  const userCmd = read('docs/commands/jj-ralph.md');
  for (const marker of [
    '项目A',
    '项目B',
    '项目C',
    '控制项目',
    'task-login-reminder',
    'DEL-password',
    'CAP-login-reminder',
    'intensity',
    'tiny',
    'strict',
    '先不写代码',
    '按审查改',
    '改坏了',
    '这里',
    '仍走五步',
    '归档提示',
    '审查修复'
  ]) {
    assert.match(userCmd, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(userCmd, /轻量档（lite）/);
  assert.doesNotMatch(userCmd, /顺手修/);

  const phases = read('skills/jj-ralph/references/phases.md');
  // English SSOT: intensity tier section (was Chinese 「强度档」)
  assert.match(phases, /[Ii]ntensity|intensity tier|tiny\|standard\|strict/);
  assert.match(phases, /deliver-attempt/);
  assert.match(phases, /accept-layer|accept_layers/);
  assert.match(phases, /archive_history/);
  assert.match(phases, /## Gate set \(deprecated\)/);
  assert.match(phases, /\*\*never\*\* uses `--lite`/);
  assert.match(phases, /先不写代码/);
  assert.match(phases, /commit-scoped-review/);
  assert.match(phases, /归档提示/);
  assert.match(read('claude-commands/jj-ralph.md'), /不要.*`--lite`/);
  assert.match(read('skills/jj-ralph/references/tiny-example.md'), /does \*\*not\*\* drop gates/);

  const schema = read('schemas/ralph-run.schema.json');
  assert.match(schema, /"intensity"/);
  assert.match(schema, /STAGNATION/);
  assert.match(schema, /"intent"/);
  assert.match(schema, /"metrics"/);
  assert.match(schema, /"archive_history"/);
  assert.match(schema, /"manifest_hash"/);
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
  for (const name of ['state.mjs', 'gates.mjs', 'map.mjs', 'knowledge.mjs', 'archive.mjs', 'migrate.mjs']) {
    const dest = path.join(root, 'skills/jj-ralph/scripts/lib/ralph', name);
    assert.ok(fs.existsSync(dest), `portable lib missing ralph/${name}; run npm run ralph:sync`);
    assert.equal(
      fs.readFileSync(dest, 'utf8'),
      fs.readFileSync(path.join(root, 'src/ralph', name), 'utf8'),
      `ralph/${name} out of sync`
    );
  }
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
  assert.match(command, /\.workflow\/ralph\/(?:tasks\/)?(?:task-|<task)/);
  assert.match(command, /map-find/);
  assert.doesNotMatch(command, /[Mm]aestro/);

  const layout = read('skills/jj-ralph/references/artifact-layout.md');
  assert.match(layout, /\.workflow\/ralph\/(?:tasks\/)?(?:task-|<task)/);
  assert.doesNotMatch(layout, /ralph\/ralphs\//);
  assert.doesNotMatch(layout, /ralphs\/RALPH/);
  assert.doesNotMatch(layout, /ralph\/runs\//);
});

test('sample run and business map validate', () => {
  const run = readJson('examples/ralph/sample-run.json');
  const map = readJson('examples/ralph/sample-business-map.json');
  assert.equal(run.schema_version, RALPH_RUN_SCHEMA_VERSION_LEGACY);
  assert.equal(map.schema_version, RALPH_MAP_SCHEMA_VERSION);
  assert.deepEqual(validateRun(run), []);
  assert.deepEqual(validateMap(map), []);
  assert.equal(run.artifact_refs.analyze, 'analyze.md');
  assert.ok(map.capabilities[0].run_refs.includes('RALPH-login-reminder-20260722'));
});

test('initRun writes lean Goal/验收/Steps task_plan and schema 1.2 task-* layout', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-init-shape-'));
  try {
    const runId = 'task-init-shape';
    const run = initRun({ run_id: runId, title: 'init shape', goal: 'Current heading', capability_ids: ['CAP-init-shape'], attach_knowledge: false }, cwd);
    assert.equal(run.schema_version, RALPH_RUN_SCHEMA_VERSION);
    assert.equal(run.artifact_refs.analyze, TASK_PLAN_REL);
    assert.equal(run.artifact_refs.plan, TASK_PLAN_REL);
    assert.equal(run.artifact_refs.acceptance, TASK_PLAN_REL);
    assert.equal(run.artifact_refs.findings, 'findings.md');
    assert.equal(run.gate_set, 'full');
    const dir = path.join(cwd, '.workflow', 'ralph', runId);
    const plan = fs.readFileSync(path.join(dir, TASK_PLAN_REL), 'utf8');
    assert.match(plan, /^## Goal$/m);
    assert.match(plan, /^## 验收$/m);
    assert.match(plan, /^## Steps$/m);
    assert.match(plan, /^## 存疑$/m);
    assert.equal((plan.match(/^## 分析$/m) || []).length, 0);
    assert.equal((plan.match(/^## 计划$/m) || []).length, 0);
    assert.equal((plan.match(/^### 当前$/m) || []).length, 0);
    assert.equal((plan.match(/^## Tasks$/m) || []).length, 0);
    assert.equal(fs.existsSync(path.join(dir, 'analyze.md')), false);
    assert.equal(fs.existsSync(path.join(dir, 'plan.md')), false);
    assert.equal(fs.existsSync(path.join(dir, 'acceptance.md')), false);
    assert.equal(fs.existsSync(path.join(dir, 'intent.md')), false);
    assert.equal(fs.existsSync(path.join(dir, 'knowledge-attach.json')), false);
    const findings = fs.readFileSync(path.join(dir, 'findings.md'), 'utf8');
    assert.match(findings, /## 可复用结论/);
    assert.match(findings, /## 改动摘要/);
    const progress = fs.readFileSync(path.join(dir, 'progress.md'), 'utf8');
    assert.match(progress, /^## \d{4}-\d{2}-\d{2}$/m);
    assert.doesNotMatch(progress, /failed_must:/);
    assert.doesNotMatch(progress, /hot_memory:/);
    assert.match(ledgerText(cwd, runId), /hot_memory:/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

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


test('review-record associates task/review threads on ralph run', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-review-'));
  const chunks = [];
  const stdout = { write: (text) => chunks.push(text) };
  try {
    const runId = 'task-review-demo';
    assert.equal(runCli(['ralph', 'init', '--run-id', runId, '--title', 'review demo', '--goal', 'link sessions', '--json'], { cwd, stdout }), 0);
    chunks.length = 0;
    assert.equal(runCli(['ralph', 'review-record', '--run-id', runId, '--outcome', 'PASS', '--reviewed-commit', 'abcdef1234567', '--task-thread', '019f8c85-8c32-72c3-b62b-ee9f0753a9e7', '--review-thread', '019f8cb8-14e9-79b3-bf40-30ba6c89ef2c', '--summary', 'ok', '--json'], { cwd, stdout }), 0);
    const payload = JSON.parse(chunks[chunks.length - 1]);
    assert.equal(payload.report.review_id, 'REV-1');
    assert.equal(payload.report.outcome, 'PASS');
    assert.equal(payload.report.task_thread_id, '019f8c85-8c32-72c3-b62b-ee9f0753a9e7');
    assert.equal(payload.report.review_thread_id, '019f8cb8-14e9-79b3-bf40-30ba6c89ef2c');
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', runId, '.state', 'reviews', 'REV-1.json')));
    const run = JSON.parse(fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, '.state', 'run.json'), 'utf8'));
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
    const runId = 'task-review-prov';
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
    const disk = JSON.parse(fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, '.state', 'reviews', 'REV-1.json'), 'utf8'));
    assert.equal(disk.source, 'host_builtin');
    assert.equal(disk.host_review.entry, 'review');
    const progress = ledgerText(cwd, runId);
    assert.match(progress, /source=host_builtin/);
    const run = JSON.parse(fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, '.state', 'run.json'), 'utf8'));
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

    const runPath = path.join(businessCwd, '.workflow', 'ralph', runId, '.state', 'run.json');
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

test('archive soft-completes in place with inline ledger; leftover archive/ snapshot is read-only', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-arch-'));
  try {
    const runId = 'task-freeze';
    const liveRel = '.workflow/ralph/' + runId;
    const completedRel = '.workflow/ralph/completed/' + runId;
    initRun({ run_id: runId, title: 'freeze', goal: 'archive completed copy', capability_ids: ['CAP-freeze'] }, cwd);
    const runPath = path.join(cwd, '.workflow', 'ralph', runId, '.state', 'run.json');
    const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
    run.gates = { analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PASS', archive: 'PENDING' };
    saveRun(run, cwd);
    const leftoverDir = path.join(cwd, '.workflow', 'ralph', 'archive', 'old-snap');
    fs.mkdirSync(leftoverDir, { recursive: true });
    const leftoverFile = path.join(leftoverDir, 'marker.txt');
    fs.writeFileSync(leftoverFile, 'historical-snapshot\n');
    const result = archiveRun(runId, { cwd, slug: 'ignored-slug' });
    assert.equal(result.archive_path, completedRel);
    assert.equal(result.manifest.schema_version, 'jj-flow/ralph-archive/1.1');
    assert.equal(result.manifest.archive_path, completedRel);
    assert.ok(!fs.existsSync(path.join(cwd, '.workflow', 'ralph', runId, 'archive-manifest.json')));
    const archivedRun = JSON.parse(fs.readFileSync(path.join(cwd, result.archive_path, '.state', 'run.json'), 'utf8'));
    assert.equal(archivedRun.status, 'COMPLETED');
    assert.equal(archivedRun.phase, 'ARCHIVE');
    assert.equal(archivedRun.gates.archive, 'PASS');
    assert.ok(archivedRun.archive && archivedRun.archive.archived_at);
    assert.ok(Array.isArray(archivedRun.archive.files));
    assert.ok(archivedRun.archive.files.some((file) => file.path === '.state/run.json'));
    assert.ok(archivedRun.archive.manifest_hash);
    assert.deepEqual(archivedRun.archive_history, []);
    const active = loadRun(runId, cwd);
    assert.equal(active.status, 'COMPLETED');
    assert.ok(active.last_archived_at);
    assert.equal(active.last_archive_path, completedRel);
    assert.equal(fs.readFileSync(leftoverFile, 'utf8'), 'historical-snapshot\n');
    // Soft archive is not a freeze: same run can resume and re-archive in place.
    resumeRun(runId, { reason: 'more work after archive', cwd });
    assert.equal(loadRun(runId, cwd).status, 'IN_PROGRESS');
    assert.ok(fs.existsSync(path.join(cwd, liveRel, '.state', 'run.json')));
    const re = archiveRun(runId, { cwd });
    assert.equal(re.archive_path, completedRel);
    assert.equal(re.archive_path, result.archive_path);
    assert.ok(fs.existsSync(path.join(cwd, re.archive_path, '.state', 'run.json')));
    const reloaded = loadRun(runId, cwd);
    assert.equal(reloaded.status, 'COMPLETED');
    assert.equal(reloaded.last_archive_path, completedRel);
    assert.equal(reloaded.archive_history.length, 1);
    assert.equal(reloaded.archive_history[0].archived_at, result.run.archive.archived_at);
    assert.equal(reloaded.archive_history[0].manifest_hash, result.run.archive.manifest_hash);
    assert.ok(!fs.existsSync(path.join(cwd, '.workflow', 'ralph', runId, 'archive-manifest.json')));
    assert.equal(fs.readFileSync(leftoverFile, 'utf8'), 'historical-snapshot\n');
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

test('setGate advances phase on PASS and can block', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-gate-'));
  try {
    const runId = 'task-gate';
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
    const runId = 'task-rollback';
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
    const progress = ledgerText(cwd, runId);
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

    const suggestion = suggestReopenAsNew(run, { newRunId: 'task-rollback-reopen' });
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
    const runId = 'task-gate-fail';
    initRun({ run_id: runId, title: 'gate fail', goal: 'fail gate', capability_ids: ['CAP-gf'] }, cwd);
    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    const failed = setGate(runId, { gate: 'plan', status: 'FAIL', cwd, advance: false });
    assert.equal(failed.run.gates.plan, 'FAIL');
    assert.equal(failed.phase, 'DELIVER');
    const progress = ledgerText(cwd, runId);
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
    const runId = 'task-consistency';
    initRun({ run_id: runId, title: 'consistency', goal: 'block false complete', capability_ids: ['CAP-consistency'] }, cwd);
    const runDirPath = path.join(cwd, '.workflow', 'ralph', runId);
    const bt = String.fromCharCode(96);
    fs.writeFileSync(
      path.join(runDirPath, TASK_PLAN_REL),
      ['## 计划', '### 当前', `- TASK: ${bt}publish-dialog.vue${bt} blur`].join('\n'),
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
      path.join(runDirPath, TASK_PLAN_REL),
      ['## 计划', '### 当前', `- TASK: ${bt}InventoryManager.vue${bt} focus-visible`].join('\n'),
      'utf8'
    );
    recordReview(runId, {
      cwd,
      outcome: 'NEEDS_CHANGES',
      summary: 'ledger/code still inconsistent historically',
      findings: [{
        id: 'F-1',
        severity: 'medium',
        file: TASK_PLAN_REL,
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
    const runPath = path.join(runDirPath, '.state', 'run.json');
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
    const runId = 'task-evidence-class';
    initRun({
      run_id: runId,
      title: 'evidence class',
      goal: 'block false green',
      attach_knowledge: false
    }, cwd);
    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    setGate(runId, { gate: 'deliver', status: 'PASS', cwd });
    const acceptancePath = path.join(cwd, '.workflow', 'ralph', runId, TASK_PLAN_REL);
    fs.writeFileSync(acceptancePath, [
      '## 验收',
      '',
      '### 当前',
      '',
      '| 项 | must_id | evidence_class | 结果 | 证据 |',
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
      '## 验收',
      '',
      '### 当前',
      '',
      '| 项 | must_id | evidence_class | 结果 | 证据 |',
      '| --- | --- | --- | --- | --- |',
      '| title persist | REQ-001 | write-then-read | PASS | write_then_read:mock_ok |',
      ''
    ].join('\n'), 'utf8');
    const run = loadRun(runId, cwd);
    run.gates.accept = 'PENDING';
    saveRun(run, cwd);
    const ok = setGate(runId, { gate: 'accept', status: 'PASS', cwd });
    assert.equal(ok.run.gates.accept, 'PASS');

    run.gates.accept = 'PENDING';
    saveRun(run, cwd);
    fs.writeFileSync(acceptancePath, [
      '# ' + runId,
      '',
      '## Goal',
      '',
      'lean checkbox',
      '',
      '## 验收',
      '',
      '1. [x] After save, reopen shows title persist 证据: static',
      '',
      '## Steps',
      '',
      '1. [x] `src/a.js`',
      ''
    ].join('\n'), 'utf8');
    const checkbox = inspectAcceptanceEvidence(loadRun(runId, cwd), cwd);
    assert.equal(checkbox.weak_evidence_pass, true);
    assert.throws(
      () => setGate(runId, { gate: 'accept', status: 'PASS', cwd }),
      /evidence_class over-claim/
    );
    fs.writeFileSync(acceptancePath, [
      '# ' + runId,
      '',
      '## 验收',
      '',
      '1. [x] After save, reopen shows title  evidence_class: write-then-read  证据: write_then_read:mock_ok',
      ''
    ].join('\n'), 'utf8');
    const checkboxOk = setGate(runId, { gate: 'accept', status: 'PASS', cwd });
    assert.equal(checkboxOk.run.gates.accept, 'PASS');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('archive blocks working_tree PASS review without fix commit (v2)', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-v2-'));
  try {
    const runId = 'task-review-scope';
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
    const runId = 'task-deliver-drift';
    initRun({ run_id: runId, title: 'drift', goal: 'deliver outside ledger', capability_ids: ['CAP-drift'], attach_knowledge: false }, cwd);
    const runDirPath = path.join(cwd, '.workflow', 'ralph', runId);
    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    setGate(runId, { gate: 'plan', status: 'PASS', cwd });
    fs.appendFileSync(path.join(runDirPath, 'progress.md'), '- 2026-07-29 DELIVER: changed account.vue\n', 'utf8');
    const drift = detectDeliverOutsideLedger(
      JSON.parse(fs.readFileSync(path.join(runDirPath, '.state', 'run.json'), 'utf8')),
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
    const runId = 'task-host-meta';
    initRun({
      run_id: runId,
      title: 'host',
      goal: 'bind host',
      capability_ids: ['CAP-host'],
      attach_knowledge: false,
      host: { host_id: 'grok-build', thread_id: 'thread-1', model_id: 'grok-x' }
    }, cwd);
    let run = JSON.parse(fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, '.state', 'run.json'), 'utf8'));
    assert.equal(run.host.host_id, 'grok-build');
    assert.equal(run.host.thread_id, 'thread-1');
    const updated = recordHostMeta(runId, { export_path: '.workflow/exports/thread-1.jsonl', session_handle: 'sess-9' }, cwd);
    assert.equal(updated.host.export_path, '.workflow/exports/thread-1.jsonl');
    assert.equal(updated.host.session_handle, 'sess-9');
    const stdout = { write: () => {} };
    assert.equal(runCli(['ralph', 'host-record', '--run-id', runId, '--host-id', 'codex', '--thread-id', '019f', '--json'], { cwd, stdout }), 0);
    run = JSON.parse(fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, '.state', 'run.json'), 'utf8'));
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
      const runId = 'task-intensity-' + intensity;
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
        run_id: 'task-intensity-bad',
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
      run_id: 'task-intensity-default',
      title: 'default',
      goal: 'default',
      capability_ids: ['CAP-intensity'],
      attach_knowledge: false
    }, cwd);
    assert.equal(loadRun('task-intensity-default', cwd).intensity, 'standard');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('recordDeliverAttempt stagnates then BLOCKED with STAGNATION', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-stag-'));
  try {
    const runId = 'task-stagnation';
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
    const runId = 'task-auto-fp';
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
    const strictId = 'task-strict-accept';
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

    const stdId = 'task-std-accept';
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

    const errId = 'task-gate-issue';
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
    const warnId = 'task-gate-warn';
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
    const runId = 'task-review-judgment';
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

test('init writes Goal into task_plan.md except tiny skips 存疑', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-intent-'));
  try {
    const standardId = 'task-intent-std';
    initRun({ run_id: standardId, title: 'intent std', goal: 'write intent', attach_knowledge: false }, cwd);
    const stdDir = path.join(cwd, '.workflow', 'ralph', standardId);
    assert.equal(loadRun(standardId, cwd).artifact_refs.intent, TASK_PLAN_REL);
    assert.equal(fs.existsSync(path.join(stdDir, 'intent.md')), false);
    const stdPlan = fs.readFileSync(path.join(stdDir, TASK_PLAN_REL), 'utf8');
    assert.match(stdPlan, /^## Goal$/m);
    assert.match(stdPlan, /^## 存疑$/m);

    const tinyId = 'task-intent-tiny';
    initRun({ run_id: tinyId, title: 'intent tiny', goal: 'skip intent', intensity: 'tiny', attach_knowledge: false }, cwd);
    assert.equal(loadRun(tinyId, cwd).artifact_refs.intent, null);
    assert.equal(fs.existsSync(path.join(cwd, '.workflow', 'ralph', tinyId, 'intent.md')), false);
    const tinyPlan = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', tinyId, TASK_PLAN_REL), 'utf8');
    assert.match(tinyPlan, /^## Goal$/m);
    assert.doesNotMatch(tinyPlan, /^## 存疑$/m);

    const forcedId = 'task-intent-force';
    initRun({ run_id: forcedId, title: 'intent force', goal: 'tiny with intent', intensity: 'tiny', write_intent: true, attach_knowledge: false }, cwd);
    assert.equal(loadRun(forcedId, cwd).artifact_refs.intent, TASK_PLAN_REL);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('extractPlanCurrentSection ignores Landed and claimed paths use 当前 only', () => {
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
  assert.deepEqual(extractLedgerPathRefs(extractPlanCurrentSection(withCurrent)), []);
  assert.ok(extractLedgerPathRefs(withCurrent).includes('old-panel.vue'));

  const chinese = [
    '## 计划',
    '### 当前',
    `- TASK-2 ${bt}tip.vue${bt}`,
    '### 已落地',
    `- TASK-1 ${bt}old-panel.vue${bt}`,
    '### 已取代',
    `- TASK-0 ${bt}legacy.vue${bt}`,
    '## 验收',
    '### 当前',
    `- ${bt}should-not-count.vue${bt}`
  ].join('\n');
  assert.match(extractMarkdownSection(chinese, '计划', 2), /tip\.vue/);
  assert.match(extractMarkdownSection(chinese, '计划', 2), /old-panel\.vue/);
  assert.deepEqual(extractLedgerPathRefs(extractPlanCurrentSection(chinese)), ['tip.vue']);

  const steps = [
    '## Goal',
    'do the thing',
    '## Steps',
    `- TASK-2 ${bt}tip.vue${bt}`,
    '## 验收',
    `- ${bt}should-not-count.vue${bt}`
  ].join('\n');
  assert.deepEqual(extractLedgerPathRefs(extractPlanCurrentSection(steps)), ['tip.vue']);
  const emptyCurrent = [
    '## 计划',
    '### 当前',
    '',
    '### 已落地',
    `- TASK-1 ${bt}old-panel.vue${bt}`
  ].join('\n');
  assert.deepEqual(extractLedgerPathRefs(extractPlanCurrentSection(emptyCurrent)), []);

  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-current-'));
  try {
    const runId = 'task-current-paths';
    initRun({ run_id: runId, title: 'current paths', goal: 'current only', attach_knowledge: false }, cwd);
    const dir = path.join(cwd, '.workflow', 'ralph', runId);
    const planOnly = [
      '## 计划',
      '### 当前',
      `- TASK-2 ${bt}tip.vue${bt}`,
      '### 已落地',
      `- TASK-1 ${bt}old-panel.vue${bt}`,
      '### 已取代',
      `- TASK-0 ${bt}legacy.vue${bt}`
    ].join('\n');
    fs.writeFileSync(path.join(dir, TASK_PLAN_REL), planOnly, 'utf8');
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
    const runId = 'task-twostrike';
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
    const runId = 'task-testint';
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

    const tinyId = 'task-testint-tiny';
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
    const runId = 'task-review-policy';
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

    const capId = 'task-review-nitcap';
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

    const flipId = 'task-review-important-pass';
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

    const planId = 'task-review-plan-file';
    initRun({ run_id: planId, title: 'plan finding', goal: 'keep task_plan.md', attach_knowledge: false }, cwd);
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
        file: TASK_PLAN_REL,
        line: 1,
        description: 'diff misses Current',
        status: 'OPEN',
        acceptance: 'align Current'
      }]
    });
    assert.equal(planFinding.report.findings.some((item) => item.file === TASK_PLAN_REL && item.status === 'OPEN'), true);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('computeRunMetrics derives clocks as null when timestamps missing quality', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-metrics-'));
  try {
    const runId = 'task-metrics';
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

test('validateRun accepts 1.0 and 1.1; fragments and missing refs fail closed', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-refs-'));
  try {
    const runId = 'task-refs';
    const run = initRun({ run_id: runId, title: 'refs', goal: 'bare filenames', attach_knowledge: false }, cwd);
    assert.deepEqual(validateRun(run), []);
    const legacy = { ...run, schema_version: RALPH_RUN_SCHEMA_VERSION_LEGACY, artifact_refs: { ...run.artifact_refs } };
    delete legacy.artifact_refs.findings;
    assert.deepEqual(validateRun(legacy), []);
    const withFragment = {
      ...run,
      artifact_refs: { ...run.artifact_refs, plan: TASK_PLAN_REL + '#计划' }
    };
    assert.ok(validateRun(withFragment).some((err) => /fragment/.test(err)));
    assert.throws(
      () => readRunArtifactText(withFragment, 'plan', cwd),
      /bare filename/
    );
    const missing = {
      ...run,
      artifact_refs: { ...run.artifact_refs, plan: 'missing.md' }
    };
    assert.throws(
      () => readRunArtifactText(missing, 'plan', cwd),
      /missing file/
    );
    const emptyRef = { ...run, artifact_refs: { ...run.artifact_refs, plan: null } };
    assert.equal(readRunArtifactText(emptyRef, 'plan', cwd), '');
    assert.ok(readRunArtifactText(run, 'plan', cwd).includes('## Steps'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

function writeLegacyActive(cwd, runId, extra = {}) {
  const dir = path.join(cwd, '.workflow', 'ralph', runId);
  fs.mkdirSync(dir, { recursive: true });
  const sample = JSON.parse(fs.readFileSync(path.join(root, 'examples/ralph/sample-run.json'), 'utf8'));
  const run = { ...sample, run_id: runId, title: extra.title || sample.title };
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify(run, null, 2));
  fs.writeFileSync(path.join(dir, 'analyze.md'), '## Analyze\n\nmust login\n');
  fs.writeFileSync(path.join(dir, 'plan.md'), '## Plan\n\n## Current\n- `src/a.js`\n');
  fs.writeFileSync(path.join(dir, 'acceptance.md'), '## Acceptance\n\nok\n');
  fs.writeFileSync(path.join(dir, 'progress.md'), '- init\n');
  return dir;
}

test('listRuns marks active RALPH-* as needs_migrate and does not hide them (B8)', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-b8-'));
  try {
    writeLegacyActive(cwd, 'RALPH-login-reminder-20260722');
    const rows = listRuns(cwd);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].run_id, 'RALPH-login-reminder-20260722');
    assert.equal(rows[0].needs_migrate, true);
    assert.equal(rows[0].layout, 'legacy-active');
    assert.throws(() => loadRun('RALPH-login-reminder-20260722', cwd), /jj ralph migrate/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('locateRalphRuns finds new layout and leftover archive each once', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-locate-'));
  try {
    initRun({ run_id: 'task-login-reminder', title: 'new layout', goal: 'task dir', attach_knowledge: false }, cwd);
    const leftoverDir = path.join(cwd, '.workflow', 'ralph', 'archive', '2026-07-22-login-reminder');
    fs.mkdirSync(leftoverDir, { recursive: true });
    const sample = JSON.parse(fs.readFileSync(path.join(root, 'examples/ralph/sample-run.json'), 'utf8'));
    fs.writeFileSync(path.join(leftoverDir, 'run.json'), JSON.stringify(sample, null, 2));
    const located = locateRalphRuns(cwd);
    const fresh = located.filter((row) => row.run_id === 'task-login-reminder' && (row.layout === 'task' || row.layout === 'active' || row.layout === 'live'));
    const archived = located.filter((row) => row.layout === 'archive' && row.readonly);
    assert.equal(fresh.length, 1);
    assert.equal(archived.length, 1);
    const leftover = loadRun('RALPH-login-reminder-20260722', cwd);
    assert.ok(leftover._readonly_archive_path);
    assert.throws(() => saveRun(leftover, cwd), /read-only archive/);
    fs.writeFileSync(path.join(leftoverDir, 'progress.md'), '- init leftover\n');
    fs.writeFileSync(path.join(leftoverDir, 'plan.md'), '## 计划\n\n### 当前\n- `src/a.js`\n');
    fs.writeFileSync(path.join(leftoverDir, 'analyze.md'), '## 分析\n');
    fs.writeFileSync(path.join(leftoverDir, 'acceptance.md'), '## 验收\n');
    assert.match(readRunArtifactText(leftover, 'progress', cwd), /init leftover/);
    const status = getStatus({ runId: leftover.run_id, cwd });
    assert.match(String(status.path || '').replaceAll('\\', '/'), /archive\//);
    assert.throws(() => writeHandoffPackage(leftover.run_id, { cwd }), /read-only archive/);
    assert.equal(fs.existsSync(path.join(cwd, '.workflow', 'ralph', leftover.run_id)), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('ralph migrate 1:1 moves RALPH-* into tasks/task-* and leaves archive leftover', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-migrate-'));
  try {
    writeLegacyActive(cwd, 'RALPH-login-reminder-20260722');
    const leftoverDir = path.join(cwd, '.workflow', 'ralph', 'archive', '2026-07-22-login-reminder');
    fs.mkdirSync(leftoverDir, { recursive: true });
    fs.writeFileSync(path.join(leftoverDir, 'marker.txt'), 'keep-me\n');
    const result = migrateRuns({ cwd });
    assert.equal(result.count, 1);
    assert.equal(result.runs[0].to, 'task-login-reminder');
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'task-login-reminder', '.state', 'run.json')));
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'task-login-reminder', 'task_plan.md')));
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'migrated', 'RALPH-login-reminder-20260722')) || fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'migrated', 'login-reminder-20260722')));
    assert.equal(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'RALPH-login-reminder-20260722')), false);
    const live = loadRun('task-login-reminder', cwd);
    assert.equal(live.schema_version, RALPH_RUN_SCHEMA_VERSION);
    assert.match(fs.readFileSync(path.join(cwd, '.workflow', 'ralph', 'task-login-reminder', 'task_plan.md'), 'utf8'), /## 分析/);
    assert.equal(fs.readFileSync(path.join(leftoverDir, 'marker.txt'), 'utf8'), 'keep-me\n');
    const listed = listRuns(cwd);
    assert.equal(listed.some((row) => row.needs_migrate), false);
    assert.equal(listed.some((row) => String(row.run_id).startsWith('.migrated-') || String(row.path || '').includes('/migrated/')), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('migrate shelters leftover .migrated-* and parks COMPLETED out of leftover tasks/', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-migrate-tidy-'));
  try {
    const leftover = path.join(cwd, '.workflow', 'ralph', '.migrated-RALPH-old-form-20260825');
    fs.mkdirSync(leftover, { recursive: true });
    fs.writeFileSync(path.join(leftover, 'run.json'), '{}\n');

    const liveId = 'task-live-form';
    initRun({ run_id: liveId, title: 'live', goal: 'keep active', attach_knowledge: false }, cwd);
    const liveRoot = path.join(cwd, '.workflow', 'ralph', liveId);
    const liveNested = path.join(cwd, '.workflow', 'ralph', 'tasks', liveId);
    fs.mkdirSync(path.dirname(liveNested), { recursive: true });
    fs.renameSync(liveRoot, liveNested);

    const doneId = 'task-done-form';
    initRun({ run_id: doneId, title: 'done', goal: 'park me', attach_knowledge: false }, cwd);
    const done = loadRun(doneId, cwd);
    done.status = 'COMPLETED';
    done.phase = 'ARCHIVE';
    saveRun(done, cwd);
    const doneRoot = path.join(cwd, '.workflow', 'ralph', doneId);
    const doneNested = path.join(cwd, '.workflow', 'ralph', 'tasks', doneId);
    fs.renameSync(doneRoot, doneNested);

    const result = migrateRuns({ cwd });
    assert.equal(result.sheltered.length, 1);
    assert.equal(result.sheltered[0].to.replaceAll('\\', '/'), '.workflow/ralph/migrated/RALPH-old-form-20260825');
    assert.equal(fs.existsSync(leftover), false);
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'migrated', 'RALPH-old-form-20260825', 'run.json')));
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', liveId, '.state', 'run.json')));
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'completed', doneId, '.state', 'run.json')));
    assert.equal(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'tasks')), false);
    assert.equal(loadRun(doneId, cwd).last_archive_path.replaceAll('\\', '/'), '.workflow/ralph/completed/' + doneId);
    assert.equal(result.parked.some((row) => row.run_id === doneId), true);
    const listed = listRuns(cwd);
    assert.equal(listed.some((row) => String(row.path || '').includes('.migrated-') || String(row.path || '').includes('/migrated/')), false);
    assert.equal(listed.find((row) => row.run_id === liveId).layout, 'active');
    assert.equal(listed.find((row) => row.run_id === doneId).layout, 'completed');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('init same task_key resumes; adopt --absorb is refused', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-adopt-'));
  try {
    initRun({ run_id: 'task-enter-form-dynamic', title: 'form', goal: 'schema', attach_knowledge: false }, cwd);
    assert.throws(
      () => initRun({ run_id: 'task-enter-form-dynamic', title: 'form', goal: 'schema', attach_knowledge: false }, cwd),
      /resume the same task_key/
    );
    const refused = adoptRun({ cwd, task: 'task-enter-form-dynamic', absorb: 'task-other' });
    assert.equal(refused.ok, false);
    assert.equal(refused.status, 'refused');
    assert.match(refused.example, /jj ralph adopt --task task-enter-form-dynamic --absorb/);
    writeLegacyActive(cwd, 'RALPH-enter-form-20260901', { title: 'legacy form' });
    const adopted = adoptRun({ cwd, task: 'task-enter-form-legacy', from: 'RALPH-enter-form-20260901' });
    assert.equal(adopted.ok, true);
    assert.equal(adopted.to, 'task-enter-form-legacy');
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'task-enter-form-legacy', '.state', 'run.json')));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('adopt --task refuses to clobber a live dest; leftover archive status is readonly', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-adopt-guard-'));
  try {
    initRun({ run_id: 'task-enter-form-dynamic', title: 'form', goal: 'schema', attach_knowledge: false }, cwd);
    const livePath = path.join(cwd, '.workflow', 'ralph', 'task-enter-form-dynamic', '.state', 'run.json');
    const before = fs.readFileSync(livePath, 'utf8');
    writeLegacyActive(cwd, 'RALPH-enter-form-20260901', { title: 'legacy form' });
    const clobber = adoptRun({ cwd, task: 'task-enter-form-dynamic', from: 'RALPH-enter-form-20260901' });
    assert.equal(clobber.ok, false);
    assert.equal(clobber.status, 'refused');
    assert.equal(clobber.dest, 'task-enter-form-dynamic');
    assert.equal(fs.readFileSync(livePath, 'utf8'), before);
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'RALPH-enter-form-20260901', 'run.json')));
    const listed = getStatus({ cwd });
    assert.match(renderRalphStatusText(listed), /needs_migrate/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// P2+a lite path (BRIEF→DELIVER→CLOSE) + promote-to-full fallback
// ---------------------------------------------------------------------------

function liteAcceptanceTable(evidence) {
  return [
    '## 验收',
    '',
    '### 当前',
    '',
    '| 项 | must_id | evidence_class | 结果 | 证据 |',
    '| --- | --- | --- | --- | --- |',
    '| title persist | REQ-001 | write-then-read | PASS | ' + evidence + ' |',
    ''
  ].join('\n');
}

test('P2+a init --lite sets gate_set=lite and caps max_deliver_loops; default and tiny stay full', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-lite-init-'));
  try {
    assert.equal(LITE_MAX_DELIVER_LOOPS, 3);
    assert.deepEqual(GATE_ALIASES, { brief: ['analyze', 'plan'], close: ['accept', 'archive'] });

    const lite = initRun({ run_id: 'task-lite-std', title: 'lite std', goal: 'small fix', attach_knowledge: false, gate_set: 'lite' }, cwd);
    assert.equal(lite.gate_set, 'lite');
    assert.equal(lite.schema_version, RALPH_RUN_SCHEMA_VERSION);
    assert.equal(lite.phase, 'ANALYZE');
    assert.deepEqual(Object.keys(lite.gates).sort(), ['accept', 'analyze', 'archive', 'deliver', 'plan']);
    assert.ok(lite.budget.max_deliver_loops <= 3);
    assert.equal(lite.budget.max_deliver_loops, Math.min(INTENSITY_DEFAULTS.standard.budget.max_deliver_loops, 3));
    assert.equal(lite.budget.max_accept_rechecks, INTENSITY_DEFAULTS.standard.budget.max_accept_rechecks);
    assert.equal(lite.max_iterations, INTENSITY_DEFAULTS.standard.max_iterations);
    assert.equal(lite.stagnation.patience, INTENSITY_DEFAULTS.standard.stagnation_patience);
    assert.deepEqual(validateRun(loadRun('task-lite-std', cwd)), []);
    const liteDir = path.join(cwd, '.workflow', 'ralph', 'task-lite-std');
    const progress = ledgerText(cwd, 'task-lite-std');
    assert.match(progress, /gate_set: lite/);
    const plan = fs.readFileSync(path.join(liteDir, TASK_PLAN_REL), 'utf8');
    assert.match(plan, /^## Goal$/m);
    assert.match(plan, /^## Steps$/m);
    assert.match(plan, /^## 验收$/m);
    assert.deepEqual(fs.readdirSync(liteDir).sort(), ['.state', 'findings.md', 'progress.md', 'task_plan.md']);

    // no flag → full; tiny without --lite → still full (intensity ⟂ gate_set)
    const plain = initRun({ run_id: 'task-lite-plain', title: 'plain', goal: 'default', attach_knowledge: false }, cwd);
    assert.equal(plain.gate_set, 'full');
    assert.equal(plain.budget.max_deliver_loops, INTENSITY_DEFAULTS.standard.budget.max_deliver_loops);
    const tiny = initRun({ run_id: 'task-lite-tiny', title: 'tiny', goal: 'tiny stays full', attach_knowledge: false, intensity: 'tiny' }, cwd);
    assert.equal(tiny.gate_set, 'full');
    assert.equal(tiny.budget.max_deliver_loops, INTENSITY_DEFAULTS.tiny.budget.max_deliver_loops);
    // explicit --full is a no-op override; tiny + --lite caps too
    const full = initRun({ run_id: 'task-lite-full', title: 'full', goal: 'explicit', attach_knowledge: false, gate_set: 'full' }, cwd);
    assert.equal(full.gate_set, 'full');
    const tinyLite = initRun({ run_id: 'task-lite-tiny-lite', title: 'tiny lite', goal: 'both', attach_knowledge: false, intensity: 'tiny', gate_set: 'lite' }, cwd);
    assert.equal(tinyLite.gate_set, 'lite');
    assert.equal(tinyLite.intensity, 'tiny');
    assert.equal(tinyLite.budget.max_deliver_loops, 3);
    // budget override below cap is kept as-is
    const skeleton = createRunSkeleton({ run_id: 'task-lite-skel', title: 's', goal: 'g', gate_set: 'lite', budget: { max_deliver_loops: 2 } });
    assert.equal(skeleton.budget.max_deliver_loops, 2);
    assert.throws(() => createRunSkeleton({ run_id: 'task-lite-bad', title: 's', goal: 'g', gate_set: 'medium' }), /gate_set must be one of full\|lite/);

    // CLI --lite / --full / both
    const chunks = [];
    const stdout = { write: (text) => chunks.push(text) };
    assert.equal(runCli(['ralph', 'init', '--run-id', 'task-lite-cli', '--title', 'cli', '--goal', 'lite via cli', '--no-knowledge-refs', '--lite', '--json'], { cwd, stdout }), 0);
    const cliRun = JSON.parse(chunks[chunks.length - 1]).run;
    assert.equal(cliRun.gate_set, 'lite');
    assert.equal(cliRun.budget.max_deliver_loops, 3);
    assert.equal(loadRun('task-lite-cli', cwd).gate_set, 'lite');
    assert.equal(runCli(['ralph', 'init', '--run-id', 'task-full-cli', '--title', 'cli', '--goal', 'full via cli', '--no-knowledge-refs', '--full', '--json'], { cwd, stdout }), 0);
    assert.equal(loadRun('task-full-cli', cwd).gate_set, 'full');
    assert.throws(
      () => runCli(['ralph', 'init', '--run-id', 'task-both-cli', '--title', 'cli', '--goal', 'both', '--no-knowledge-refs', '--lite', '--full'], { cwd, stdout }),
      /--lite or --full, not both/
    );
    assert.equal(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'task-both-cli')), false);
    chunks.length = 0;
    assert.equal(runCli(['ralph', 'status', '--run-id', 'task-lite-cli'], { cwd, stdout }), 0);
    assert.match(chunks.join(''), /gate_set: lite/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('P2+a setGate brief PASS writes analyze+plan PASS and lands in DELIVER; aliases are lite-only', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-lite-brief-'));
  try {
    const runId = 'task-lite-brief';
    initRun({ run_id: runId, title: 'brief', goal: 'merge analyze+plan', attach_knowledge: false, gate_set: 'lite' }, cwd);
    const result = setGate(runId, { gate: 'brief', status: 'PASS', cwd });
    assert.equal(result.alias, 'brief');
    assert.deepEqual(result.gates_written, ['analyze', 'plan']);
    assert.equal(result.phase, 'DELIVER');
    assert.equal(result.promotion.promoted, false);
    let run = loadRun(runId, cwd);
    assert.equal(run.gates.analyze, 'PASS');
    assert.equal(run.gates.plan, 'PASS');
    assert.equal(run.gates.deliver, 'PENDING');
    assert.equal(run.phase, 'DELIVER');
    assert.equal(run.gate_set, 'lite');
    assert.equal(run.status, 'IN_PROGRESS');
    assert.deepEqual(validateRun(run), []);
    assert.equal(Object.hasOwn(run.gates, 'brief'), false);
    assert.equal(Object.hasOwn(run.gates, 'close'), false);
    // progress keeps five-key gate lines (metrics parser) tagged with the alias
    const progress = ledgerText(cwd, runId);
    assert.match(progress, /gate analyze=PASS phase=DELIVER status=IN_PROGRESS via=brief/);
    assert.match(progress, /gate plan=PASS phase=DELIVER status=IN_PROGRESS via=brief/);
    assert.doesNotMatch(progress, /gate brief=/);
    const metrics = computeRunMetrics(run, cwd);
    assert.equal(metrics.analyze_to_plan_hours, 0);

    // deliver is shared: same key, phase → ACCEPT
    const delivered = setGate(runId, { gate: 'deliver', status: 'PASS', cwd });
    assert.equal(delivered.alias, null);
    assert.equal(delivered.phase, 'ACCEPT');
    run = loadRun(runId, cwd);
    assert.equal(run.gate_set, 'lite');

    // aliases refused on a full run
    initRun({ run_id: 'task-full-noalias', title: 'full', goal: 'no alias', attach_knowledge: false }, cwd);
    assert.throws(
      () => setGate('task-full-noalias', { gate: 'brief', status: 'PASS', cwd }),
      /gate alias brief requires gate_set=lite \(current=full\); use analyze then plan/
    );
    assert.equal(loadRun('task-full-noalias', cwd).gates.analyze, 'PENDING');
    assert.throws(() => setGate('task-full-noalias', { gate: 'nope', status: 'PASS', cwd }), /invalid gate: nope .*lite aliases brief\|close/);

    // CLI gate alias round-trip
    initRun({ run_id: 'task-lite-cli-brief', title: 'cli brief', goal: 'cli alias', attach_knowledge: false, gate_set: 'lite' }, cwd);
    const chunks = [];
    const stdout = { write: (text) => chunks.push(text) };
    assert.equal(runCli(['ralph', 'gate', '--run-id', 'task-lite-cli-brief', '--gate', 'brief', '--status', 'PASS'], { cwd, stdout }), 0);
    assert.match(chunks.join(''), /gate brief=PASS phase=DELIVER .*writes=analyze,plan/);
    assert.equal(loadRun('task-lite-cli-brief', cwd).gates.plan, 'PASS');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('P2+a close PASS still runs accept/archive evidence gates; weak write-then-read evidence blocks', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-lite-close-'));
  try {
    const runId = 'task-lite-close';
    initRun({ run_id: runId, title: 'close', goal: 'accept+archive merged', attach_knowledge: false, gate_set: 'lite' }, cwd);
    // close before deliver PASS → blocked by the existing consistency gate
    assert.throws(() => setGate(runId, { gate: 'close', status: 'PASS', cwd }), /requires gates\.deliver=PASS/);
    setGate(runId, { gate: 'brief', status: 'PASS', cwd });
    setGate(runId, { gate: 'deliver', status: 'PASS', cwd });
    const planPath = path.join(cwd, '.workflow', 'ralph', runId, TASK_PLAN_REL);

    fs.writeFileSync(planPath, liteAcceptanceTable('static'), 'utf8');
    assert.throws(() => setGate(runId, { gate: 'close', status: 'PASS', cwd }), /evidence_class over-claim/);
    let run = loadRun(runId, cwd);
    assert.equal(run.gates.accept, 'PENDING');
    assert.equal(run.gates.archive, 'PENDING');
    assert.equal(run.phase, 'ACCEPT');
    assert.equal(run.status, 'IN_PROGRESS');
    assert.equal(run.gate_set, 'lite');
    const progressWeak = ledgerText(cwd, runId);
    assert.doesNotMatch(progressWeak, /gate accept=PASS/);
    assert.doesNotMatch(progressWeak, /promoted lite→full/);

    // strong evidence → close PASS = accept PASS + archive PASS, COMPLETED, still lite
    fs.writeFileSync(planPath, liteAcceptanceTable('write_then_read:mock_ok'), 'utf8');
    const closed = setGate(runId, { gate: 'close', status: 'PASS', cwd });
    assert.equal(closed.alias, 'close');
    assert.deepEqual(closed.gates_written, ['accept', 'archive']);
    assert.equal(closed.phase, 'ARCHIVE');
    run = loadRun(runId, cwd);
    assert.equal(run.gates.accept, 'PASS');
    assert.equal(run.gates.archive, 'PASS');
    assert.equal(run.accept_layers.mechanical, 'PASS');
    assert.equal(run.status, 'COMPLETED');
    assert.equal(run.gate_set, 'lite');
    assert.deepEqual(validateRun(run), []);
    const progress = ledgerText(cwd, runId);
    assert.match(progress, /gate accept=PASS phase=ARCHIVE status=COMPLETED via=close/);
    assert.match(progress, /gate archive=PASS phase=ARCHIVE status=COMPLETED via=close/);

    // existing finalize still applies on top (in-place ledger, no copy)
    const finalized = withoutLocalPortfolio(() => finalizeRun(runId, { cwd, modules: ['src/lite.js'], keywords: ['lite'] }));
    assert.equal(finalized.archive_path, '.workflow/ralph/completed/' + runId);
    assert.equal(finalized.run.status, 'COMPLETED');
    assert.ok(Array.isArray(finalized.run.archive.files) && finalized.run.archive.files.length > 0);

    // strict lite: close PASS also needs the judgment layer (no shortcut around evaluateAcceptJudgment)
    const strictId = 'task-lite-strict';
    initRun({ run_id: strictId, title: 'strict lite', goal: 'judgment still required', attach_knowledge: false, gate_set: 'lite', intensity: 'strict' }, cwd);
    setGate(strictId, { gate: 'brief', status: 'PASS', cwd });
    setGate(strictId, { gate: 'deliver', status: 'PASS', cwd });
    fs.writeFileSync(path.join(cwd, '.workflow', 'ralph', strictId, TASK_PLAN_REL), liteAcceptanceTable('write_then_read:mock_ok'), 'utf8');
    assert.throws(() => setGate(strictId, { gate: 'close', status: 'PASS', cwd }), /accept judgment layer blocked PASS/);
    assert.equal(loadRun(strictId, cwd).gates.accept, 'PENDING');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('P2+a lite FAIL/BLOCKED or scope.in growth promotes to full in place (same run_id, dir, evidence)', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-lite-promote-'));
  try {
    const dirOf = (id) => path.join(cwd, '.workflow', 'ralph', id);
    const progressOf = (id) => ledgerText(cwd, id);

    // (a) gate FAIL on lite → full; budget restored to intensity default; BRIEF evidence kept
    const failId = 'task-lite-fail';
    initRun({ run_id: failId, title: 'fail', goal: 'promote on fail', attach_knowledge: false, gate_set: 'lite' }, cwd);
    setGate(failId, { gate: 'brief', status: 'PASS', cwd });
    const beforeFiles = fs.readdirSync(dirOf(failId)).sort();
    const failed = setGate(failId, { gate: 'deliver', status: 'FAIL', cwd, advance: false });
    assert.equal(failed.promotion.promoted, true);
    assert.match(failed.promotion.reason, /gate deliver=FAIL/);
    assert.deepEqual(failed.promotion.max_deliver_loops, { from: 3, to: INTENSITY_DEFAULTS.standard.budget.max_deliver_loops });
    let run = loadRun(failId, cwd);
    assert.equal(run.run_id, failId);
    assert.equal(run.gate_set, 'full');
    assert.equal(run.budget.max_deliver_loops, INTENSITY_DEFAULTS.standard.budget.max_deliver_loops);
    assert.equal(run.gates.analyze, 'PASS');
    assert.equal(run.gates.plan, 'PASS');
    assert.equal(run.gates.deliver, 'FAIL');
    assert.equal(run.gates.accept, 'PENDING');
    assert.equal(run.phase, 'DELIVER');
    assert.deepEqual(validateRun(run), []);
    assert.deepEqual(fs.readdirSync(dirOf(failId)).sort(), beforeFiles);
    assert.equal(listRuns(cwd).filter((row) => row.run_id === failId).length, 1);
    assert.match(progressOf(failId), /gate deliver=FAIL phase=DELIVER status=IN_PROGRESS\n- \S+ promoted lite→full reason=gate deliver=FAIL max_deliver_loops=3→20/);
    // promoted run must now walk the five gates; aliases are refused
    assert.throws(() => setGate(failId, { gate: 'close', status: 'PASS', cwd }), /requires gate_set=lite \(current=full\)/);
    // a second FAIL on full does not write another promotion line
    setGate(failId, { gate: 'deliver', status: 'FAIL', cwd, advance: false });
    assert.equal((progressOf(failId).match(/promoted lite→full/g) || []).length, 1);

    // (b) BLOCKED on a lite alias → both keys BLOCKED, status BLOCKED, promoted
    const blockId = 'task-lite-block';
    initRun({ run_id: blockId, title: 'block', goal: 'promote on blocked', attach_knowledge: false, gate_set: 'lite', intensity: 'tiny' }, cwd);
    const blocked = setGate(blockId, { gate: 'brief', status: 'BLOCKED', cwd });
    assert.equal(blocked.promotion.promoted, true);
    run = loadRun(blockId, cwd);
    assert.equal(run.gate_set, 'full');
    assert.equal(run.status, 'BLOCKED');
    assert.equal(run.gates.analyze, 'BLOCKED');
    assert.equal(run.gates.plan, 'BLOCKED');
    assert.equal(run.phase, 'ANALYZE');
    assert.equal(run.budget.max_deliver_loops, INTENSITY_DEFAULTS.tiny.budget.max_deliver_loops);
    assert.match(progressOf(blockId), /promoted lite→full reason=gate brief=BLOCKED/);

    // (c) restored cap is never below iterations already used
    const usedId = 'task-lite-used';
    initRun({ run_id: usedId, title: 'used', goal: 'floor at used', attach_knowledge: false, gate_set: 'lite' }, cwd);
    run = loadRun(usedId, cwd);
    run.iteration = INTENSITY_DEFAULTS.standard.budget.max_deliver_loops + 5;
    saveRun(run, cwd);
    setGate(usedId, { gate: 'brief', status: 'FAIL', cwd, advance: false });
    assert.equal(loadRun(usedId, cwd).budget.max_deliver_loops, INTENSITY_DEFAULTS.standard.budget.max_deliver_loops + 5);

    // (d) scope.in growth via updateRunScope → promoted; scope.out growth or duplicates do not promote
    const scopeId = 'task-lite-scope';
    initRun({ run_id: scopeId, title: 'scope', goal: 'promote on growth', attach_knowledge: false, gate_set: 'lite', scope: { in: ['src/a.js'], out: ['src/b.js'] } }, cwd);
    setGate(scopeId, { gate: 'brief', status: 'PASS', cwd });
    let scoped = updateRunScope(scopeId, { add_out: ['docs/'], cwd });
    assert.equal(scoped.promotion.promoted, false);
    assert.deepEqual(scoped.added_out, ['docs/']);
    scoped = updateRunScope(scopeId, { add_in: ['src/a.js'], cwd });
    assert.equal(scoped.promotion.promoted, false);
    assert.deepEqual(scoped.added_in, []);
    assert.equal(loadRun(scopeId, cwd).gate_set, 'lite');
    scoped = updateRunScope(scopeId, { add_in: ['src/new-module.js', ' src/a.js '], cwd });
    assert.equal(scoped.promotion.promoted, true);
    assert.deepEqual(scoped.added_in, ['src/new-module.js']);
    run = loadRun(scopeId, cwd);
    assert.equal(run.run_id, scopeId);
    assert.equal(run.gate_set, 'full');
    assert.deepEqual(run.scope, { in: ['src/a.js', 'src/new-module.js'], out: ['src/b.js', 'docs/'] });
    assert.equal(run.gates.analyze, 'PASS');
    assert.equal(run.gates.plan, 'PASS');
    assert.equal(run.phase, 'DELIVER');
    assert.equal(run.budget.max_deliver_loops, INTENSITY_DEFAULTS.standard.budget.max_deliver_loops);
    assert.deepEqual(validateRun(run), []);
    assert.match(progressOf(scopeId), /scope in\+=\[src\/new-module\.js\] out\+=\[\] gate_set=full\n- \S+ promoted lite→full reason=scope\.in expanded: src\/new-module\.js/);
    assert.throws(() => updateRunScope(scopeId, { cwd }), /needs add_in and\/or add_out/);

    // (d2) rollbackPhase writes the leaving gate FAIL → same fallback; stagnation fingerprint still runs on lite
    const rbId = 'task-lite-rollback';
    initRun({ run_id: rbId, title: 'rollback', goal: 'promote on rollback', attach_knowledge: false, gate_set: 'lite' }, cwd);
    setGate(rbId, { gate: 'brief', status: 'PASS', cwd });
    const first = recordDeliverAttempt(rbId, { improved: true, signal: 'tests 1/3', cwd });
    assert.equal(first.blocked, false);
    assert.equal(first.iteration, 1);
    assert.ok(first.fingerprint);
    assert.equal(loadRun(rbId, cwd).stagnation.last_fingerprint, first.fingerprint);
    setGate(rbId, { gate: 'deliver', status: 'PASS', cwd });
    const rolled = rollbackPhase(rbId, { toPhase: 'DELIVER', reason: '验收证据不足', cwd });
    assert.equal(rolled.promotion.promoted, true);
    run = loadRun(rbId, cwd);
    assert.equal(run.gate_set, 'full');
    assert.equal(run.gates.deliver, 'FAIL');
    assert.equal(run.phase, 'DELIVER');
    assert.equal(run.budget.max_deliver_loops, INTENSITY_DEFAULTS.standard.budget.max_deliver_loops);
    assert.match(progressOf(rbId), /rollbackPhase ACCEPT→DELIVER reason=验收证据不足\n- \S+ promoted lite→full reason=rollbackPhase ACCEPT→DELIVER deliver=FAIL/);

    // (d3) lite budget: third deliver attempt hits max_deliver_loops=3 → BLOCKED with the lite escape hint (no auto-promotion)
    const budgetId = 'task-lite-budget';
    initRun({ run_id: budgetId, title: 'budget', goal: 'cap at 3', attach_knowledge: false, gate_set: 'lite' }, cwd);
    setGate(budgetId, { gate: 'brief', status: 'PASS', cwd });
    recordDeliverAttempt(budgetId, { improved: true, signal: 'a', cwd });
    recordDeliverAttempt(budgetId, { improved: true, signal: 'b', cwd });
    const third = recordDeliverAttempt(budgetId, { improved: true, signal: 'c', cwd });
    assert.equal(third.blocked, true);
    assert.equal(third.intervention_needed.kind, 'MAX_ITERATIONS');
    assert.match(third.intervention_needed.reason, /budget\.max_deliver_loops 3/);
    assert.match(third.intervention_needed.unblock, /lite run: gate deliver FAIL/);
    assert.equal(loadRun(budgetId, cwd).gate_set, 'lite');
    assert.equal(loadRun(budgetId, cwd).status, 'BLOCKED');
    // taking the documented exit lifts the budget stop: the cap is gone, so is the stale MAX_ITERATIONS block
    const escaped = setGate(budgetId, { gate: 'deliver', status: 'FAIL', cwd, advance: false });
    assert.equal(escaped.promotion.promoted, true);
    assert.equal(escaped.promotion.unblocked, true);
    assert.deepEqual(escaped.promotion.max_deliver_loops, { from: 3, to: INTENSITY_DEFAULTS.standard.budget.max_deliver_loops });
    run = loadRun(budgetId, cwd);
    assert.equal(run.budget.max_deliver_loops, INTENSITY_DEFAULTS.standard.budget.max_deliver_loops);
    assert.equal(run.status, 'IN_PROGRESS');
    assert.equal(run.intervention_needed, null);
    assert.equal(run.gates.deliver, 'FAIL');
    assert.match(progressOf(budgetId), /promoted lite→full reason=gate deliver=FAIL max_deliver_loops=3→20 status=BLOCKED→IN_PROGRESS/);
    const fourth = recordDeliverAttempt(budgetId, { improved: true, signal: 'd', cwd });
    assert.equal(fourth.blocked, false);
    assert.equal(fourth.iteration, 4);
    // (d4) a gate written BLOCKED at the lite cap promotes but stays BLOCKED (the gate itself is blocked)
    const stayId = 'task-lite-stay-blocked';
    initRun({ run_id: stayId, title: 'stay', goal: 'blocked gate keeps block', attach_knowledge: false, gate_set: 'lite' }, cwd);
    setGate(stayId, { gate: 'brief', status: 'PASS', cwd });
    for (const s of ['a', 'b', 'c']) recordDeliverAttempt(stayId, { improved: true, signal: s, cwd });
    assert.equal(loadRun(stayId, cwd).status, 'BLOCKED');
    const stayed = setGate(stayId, { gate: 'deliver', status: 'BLOCKED', cwd, advance: false });
    assert.equal(stayed.promotion.promoted, true);
    assert.equal(stayed.promotion.unblocked, false);
    run = loadRun(stayId, cwd);
    assert.equal(run.gate_set, 'full');
    assert.equal(run.status, 'BLOCKED');
    assert.equal(run.intervention_needed?.kind, 'MAX_ITERATIONS');
    assert.doesNotMatch(progressOf(stayId), /status=BLOCKED→IN_PROGRESS/);
    // (d5) scope growth at the lite cap also lifts the budget stop; a STAGNATION block never does
    const scopeCapId = 'task-lite-scope-cap';
    initRun({ run_id: scopeCapId, title: 'scope cap', goal: 'growth lifts cap stop', attach_knowledge: false, gate_set: 'lite', scope: { in: ['src/a.js'], out: [] } }, cwd);
    setGate(scopeCapId, { gate: 'brief', status: 'PASS', cwd });
    for (const s of ['a', 'b', 'c']) recordDeliverAttempt(scopeCapId, { improved: true, signal: s, cwd });
    const grown = updateRunScope(scopeCapId, { add_in: ['src/b.js'], cwd });
    assert.equal(grown.promotion.unblocked, true);
    assert.equal(loadRun(scopeCapId, cwd).status, 'IN_PROGRESS');
    assert.equal(loadRun(scopeCapId, cwd).intervention_needed, null);
    const stagId = 'task-lite-stagnation';
    initRun({ run_id: stagId, title: 'stagnation', goal: 'stagnation block stands', attach_knowledge: false, gate_set: 'lite' }, cwd);
    setGate(stagId, { gate: 'brief', status: 'PASS', cwd });
    recordDeliverAttempt(stagId, { improved: false, signal: 'same', cwd });
    const stalled = recordDeliverAttempt(stagId, { improved: false, signal: 'same', cwd });
    assert.equal(stalled.intervention_needed?.kind, 'STAGNATION');
    const stagPromoted = setGate(stagId, { gate: 'deliver', status: 'FAIL', cwd, advance: false });
    assert.equal(stagPromoted.promotion.promoted, true);
    assert.equal(stagPromoted.promotion.unblocked, false);
    assert.equal(loadRun(stagId, cwd).status, 'BLOCKED');
    assert.equal(loadRun(stagId, cwd).intervention_needed?.kind, 'STAGNATION');

    // (e) promoteGateSetToFull is a no-op on full; scope growth on a full run never touches gate_set
    const fullId = 'task-full-scope';
    initRun({ run_id: fullId, title: 'full scope', goal: 'no promotion', attach_knowledge: false }, cwd);
    const noop = promoteGateSetToFull(loadRun(fullId, cwd), { reason: 'x' });
    assert.equal(noop.promoted, false);
    const fullScoped = updateRunScope(fullId, { add_in: ['src/z.js'], cwd });
    assert.equal(fullScoped.promotion.promoted, false);
    assert.equal(loadRun(fullId, cwd).gate_set, 'full');
    assert.doesNotMatch(progressOf(fullId), /promoted lite→full/);

    // (f) CLI scope + ralph_ops init --lite / scope wire through
    const chunks = [];
    const stdout = { write: (text) => chunks.push(text) };
    const cliId = 'task-lite-cli-scope';
    initRun({ run_id: cliId, title: 'cli scope', goal: 'cli', attach_knowledge: false, gate_set: 'lite' }, cwd);
    assert.equal(runCli(['ralph', 'scope', '--run-id', cliId, '--in', 'src/extra.js'], { cwd, stdout }), 0);
    assert.match(chunks.join(''), /scope in\+=\[src\/extra\.js\] out\+=\[\] gate_set=full/);
    assert.match(chunks.join(''), /promoted lite→full: scope\.in expanded: src\/extra\.js/);
    assert.equal(loadRun(cliId, cwd).gate_set, 'full');
    assert.throws(() => runCli(['ralph', 'scope', '--run-id', cliId], { cwd, stdout }), /at least one --in or --out/);

    const ops = path.join(root, 'skills/jj-ralph/scripts/ralph_ops.mjs');
    const runNode = (args) => {
      const result = spawnSync(process.execPath, [ops, ...args, '--cwd', cwd], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      return JSON.parse(result.stdout);
    };
    const opsId = 'task-lite-ops';
    const opsInit = runNode(['init', '--run-id', opsId, '--title', 'ops lite', '--goal', 'thin wrap', '--lite', '--project', 'ops-lite-proj']);
    assert.equal(opsInit.gate_set, 'lite');
    assert.equal(opsInit.max_deliver_loops, 3);
    assert.equal(loadRun(opsId, cwd).gate_set, 'lite');
    const opsBrief = runNode(['gate', '--run-id', opsId, '--gate', 'brief', '--status', 'PASS']);
    assert.deepEqual(opsBrief.gates_written, ['analyze', 'plan']);
    assert.equal(opsBrief.phase, 'DELIVER');
    const opsScope = runNode(['scope', '--run-id', opsId, '--in', 'src/x.js,src/y.js']);
    assert.deepEqual(opsScope.added_in, ['src/x.js', 'src/y.js']);
    assert.equal(opsScope.gate_set, 'full');
    assert.equal(opsScope.promotion.promoted, true);
    assert.equal(loadRun(opsId, cwd).gate_set, 'full');
    const both = spawnSync(process.execPath, [ops, 'init', '--run-id', 'task-lite-ops-both', '--title', 't', '--goal', 'g', '--lite', '--full', '--cwd', cwd], { encoding: 'utf8' });
    assert.notEqual(both.status, 0);
    assert.match(both.stderr, /--lite or --full, not both/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// P2+b tier heuristic: advisory only (no flag → gate_set stays full)
// ---------------------------------------------------------------------------

test('P2+b suggestGateSet reads title/goal/scope/capability_ids only; lite needs every signal small, else full', () => {
  assert.equal(GATE_SET_HEURISTIC.max_scope_in, 2);
  const lite = suggestGateSet({ title: 'tip 位置', goal: 'tip bottom 4px 改成 6px', scope: { in: ['src/tip.css'], out: [] } });
  assert.equal(lite.gate_set, 'lite');
  assert.equal(lite.applied, false);
  assert.deepEqual(lite.signals, { surface: 'small', scope_in: 1, architecture_terms: [], acceptance_items: 1 });
  assert.deepEqual(lite.reasons, ['surface:small (scope.in=1 concrete file)', 'architecture:none', 'acceptance:single']);
  assert.match(lite.hint, /advisory only.*--lite --force/);

  // 改动面小 via the user's own wording when scope.in is empty
  const wording = suggestGateSet({ title: '顺手修', goal: '顺手把登录页 typo 改了' });
  assert.equal(wording.gate_set, 'lite');
  assert.equal(wording.signals.surface, 'small');
  assert.match(wording.reasons[0], /small-change wording/);

  // 拿不准 → full: no scope, no small-change wording
  const unknown = suggestGateSet({ title: '登录提醒', goal: '登录后密码过期要提示' });
  assert.equal(unknown.gate_set, 'full');
  assert.equal(unknown.signals.surface, 'unknown');
  assert.equal(unknown.hint, null);

  // 改动面宽: >2 files, or dir / glob / extension-less entries
  assert.equal(suggestGateSet({ goal: 'small fix', scope: { in: ['src/a.js', 'src/b.js', 'src/c.js'] } }).signals.surface, 'wide');
  assert.equal(suggestGateSet({ goal: 'small fix', scope: { in: ['src/a.js', 'src/b.js'] } }).gate_set, 'lite');
  for (const entry of ['src/', 'src/**/*.js', 'src/lib', 'Dockerfile']) {
    const wide = suggestGateSet({ goal: 'small fix', scope: { in: [entry] } });
    assert.equal(wide.gate_set, 'full', entry);
    assert.match(wide.reasons[0], /surface:wide/);
  }

  // 架构词 anywhere in title / goal / scope.in → full even with one file and small wording
  const arch = suggestGateSet({ title: '顺手重构', goal: '顺手重构鉴权协议', scope: { in: ['src/auth.js'] } });
  assert.equal(arch.gate_set, 'full');
  assert.deepEqual(arch.signals.architecture_terms, ['重构', '鉴权', '协议', 'auth']);
  assert.equal(suggestGateSet({ goal: 'add api field', scope: { in: ['src/a.js'] } }).gate_set, 'full');
  assert.equal(suggestGateSet({ goal: 'bump schema description', scope: { in: ['schemas/x.json'] } }).gate_set, 'full');
  // \bauth\b does not catch "author"
  assert.equal(suggestGateSet({ goal: 'show author name', scope: { in: ['src/a.js'] } }).gate_set, 'lite');

  // 多验收项: separators / list markers / conjunctions / capability_ids
  for (const goal of ['改 tip 文案；把 close 挪一点', '1. 改 A\n2. 改 B', '① 改 A ② 改 B', '- 改 A\n- 改 B', '改 A 并且改 B', 'fix A and also B']) {
    const multi = suggestGateSet({ goal, scope: { in: ['src/a.js'] } });
    assert.equal(multi.gate_set, 'full', goal);
    assert.ok(multi.signals.acceptance_items > 1, goal);
    assert.match(multi.reasons[2], /acceptance:multiple/);
  }
  assert.equal(suggestGateSet({ goal: 'small fix 3.5px', scope: { in: ['src/a.css'] } }).signals.acceptance_items, 1);
  const caps = suggestGateSet({ goal: 'small fix', scope: { in: ['src/a.js'] }, capability_ids: ['CAP-a', 'CAP-b'] });
  assert.equal(caps.gate_set, 'full');
  assert.match(caps.reasons[2], /capability_ids=2/);

  // intensity is not an input: the same wording yields the same suggestion regardless of tier
  const asTiny = suggestGateSet({ goal: 'small fix', scope: { in: ['src/a.js'] }, intensity: 'tiny' });
  const asStrict = suggestGateSet({ goal: 'small fix', scope: { in: ['src/a.js'] }, intensity: 'strict' });
  assert.deepEqual(asTiny, asStrict);
  assert.equal(suggestGateSet().gate_set, 'full');
});

test('P2+b init without --lite/--full stays full; heuristic only advises (returned object + progress), never the ledger', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-lite-hint-'));
  try {
    const dirOf = (id) => path.join(cwd, '.workflow', 'ralph', id);
    const progressOf = (id) => ledgerText(cwd, id);
    const diskOf = (id) => JSON.parse(fs.readFileSync(path.join(dirOf(id), '.state', 'run.json'), 'utf8'));

    // (a) small change, no flag → run.json full + standard budget; suggestion lite only on the returned object
    const smallId = 'task-hint-small';
    const small = initRun({ run_id: smallId, title: 'tip 位置', goal: 'tip bottom 4px 改成 6px', attach_knowledge: false, scope: { in: ['src/tip.css'], out: [] } }, cwd);
    assert.equal(small.gate_set, 'full');
    assert.equal(small.budget.max_deliver_loops, INTENSITY_DEFAULTS.standard.budget.max_deliver_loops);
    assert.equal(small.gate_set_suggestion.gate_set, 'lite');
    assert.equal(small.gate_set_suggestion.applied, false);
    assert.match(small.gate_set_suggestion.hint, /run\.json keeps gate_set=full/);
    const disk = diskOf(smallId);
    assert.equal(disk.gate_set, 'full');
    assert.equal(Object.hasOwn(disk, 'gate_set_suggestion'), false);
    assert.equal(Object.hasOwn(disk, 'reuse_suggestions'), false);
    assert.deepEqual(validateRun(loadRun(smallId, cwd)), []);
    assert.equal(loadRun(smallId, cwd).gate_set_suggestion, undefined);
    assert.match(progressOf(smallId), /^- gate_set: full\n- gate_set_suggestion: lite \(advisory; run\.json stays full — explicit --lite only\) reasons=surface:small \(scope\.in=1 concrete file\); architecture:none; acceptance:single$/m);
    // aliases still refused: the suggestion changed nothing in the ledger
    assert.throws(() => setGate(smallId, { gate: 'brief', status: 'PASS', cwd }), /requires gate_set=lite \(current=full\)/);
    // taking the hint = explicit --lite (re-init --force before any gate); no other path flips gate_set
    const taken = initRun({ run_id: smallId, title: 'tip 位置', goal: 'tip bottom 4px 改成 6px', attach_knowledge: false, scope: { in: ['src/tip.css'], out: [] }, gate_set: 'lite', force: true }, cwd);
    assert.equal(taken.gate_set, 'lite');
    assert.equal(taken.budget.max_deliver_loops, LITE_MAX_DELIVER_LOOPS);
    assert.equal(taken.gate_set_suggestion, undefined);
    assert.equal(diskOf(smallId).gate_set, 'lite');
    assert.match(progressOf(smallId), /gate_set: lite \(brief→deliver→close; max_deliver_loops=3\)/);
    assert.doesNotMatch(
      fs.readFileSync(path.join(dirOf(smallId), 'progress.md'), 'utf8'),
      /gate_set_suggestion/
    );

    // (b) intensity ⟂ gate_set: tiny never flips gate_set and never feeds the heuristic
    const tinyArch = initRun({ run_id: 'task-hint-tiny-arch', title: '重构鉴权', goal: '重构鉴权协议', attach_knowledge: false, intensity: 'tiny' }, cwd);
    assert.equal(tinyArch.gate_set, 'full');
    assert.equal(tinyArch.gate_set_suggestion.gate_set, 'full');
    assert.match(tinyArch.gate_set_suggestion.reasons.join(';'), /architecture:重构,鉴权,协议/);
    assert.doesNotMatch(progressOf('task-hint-tiny-arch'), /gate_set_suggestion/);
    const tinySmall = initRun({ run_id: 'task-hint-tiny-small', title: 'tiny', goal: 'small fix', attach_knowledge: false, intensity: 'tiny', scope: { in: ['src/a.js'], out: [] } }, cwd);
    assert.equal(tinySmall.gate_set, 'full');
    assert.equal(tinySmall.intensity, 'tiny');
    assert.equal(tinySmall.budget.max_deliver_loops, INTENSITY_DEFAULTS.tiny.budget.max_deliver_loops);
    assert.equal(tinySmall.gate_set_suggestion.gate_set, 'lite');
    assert.equal(diskOf('task-hint-tiny-small').gate_set, 'full');
    const strictSmall = initRun({ run_id: 'task-hint-strict-small', title: 'strict', goal: 'small fix', attach_knowledge: false, intensity: 'strict', scope: { in: ['src/a.js'], out: [] } }, cwd);
    assert.deepEqual(strictSmall.gate_set_suggestion.signals, tinySmall.gate_set_suggestion.signals);
    assert.equal(strictSmall.gate_set, 'full');

    // (c) 拿不准 → full suggestion, no progress line
    const unknown = initRun({ run_id: 'task-hint-unknown', title: '登录提醒', goal: '登录后密码过期要提示', attach_knowledge: false }, cwd);
    assert.equal(unknown.gate_set, 'full');
    assert.equal(unknown.gate_set_suggestion.gate_set, 'full');
    assert.equal(unknown.gate_set_suggestion.signals.surface, 'unknown');
    assert.doesNotMatch(progressOf('task-hint-unknown'), /gate_set_suggestion/);

    // (d) explicit flag = user decided: no suggestion at all
    const explicitFull = initRun({ run_id: 'task-hint-full', title: 'tip 位置', goal: 'tip bottom 4px 改成 6px', attach_knowledge: false, scope: { in: ['src/tip.css'], out: [] }, gate_set: 'full' }, cwd);
    assert.equal(explicitFull.gate_set, 'full');
    assert.equal(explicitFull.gate_set_suggestion, undefined);
    assert.doesNotMatch(progressOf('task-hint-full'), /gate_set_suggestion/);
    const explicitLite = initRun({ run_id: 'task-hint-lite', title: '大改', goal: '重构鉴权协议', attach_knowledge: false, gate_set: 'lite' }, cwd);
    assert.equal(explicitLite.gate_set, 'lite');
    assert.equal(explicitLite.gate_set_suggestion, undefined);

    // (e) CLI text / --json / --full
    const chunks = [];
    const stdout = { write: (text) => chunks.push(text) };
    assert.equal(runCli(['ralph', 'init', '--run-id', 'task-hint-cli', '--title', 'cli tip', '--goal', 'tip bottom 4px 改成 6px', '--in', 'src/tip.css', '--no-knowledge-refs'], { cwd, stdout }), 0);
    assert.match(chunks.join(''), /^initialized task-hint-cli\n/);
    assert.match(chunks.join(''), /^gate_set\? lite \(advisory; gate_set stays full — pass --lite explicitly to take it\) · surface:small \(scope\.in=1 concrete file\); architecture:none; acceptance:single$/m);
    assert.equal(loadRun('task-hint-cli', cwd).gate_set, 'full');
    chunks.length = 0;
    assert.equal(runCli(['ralph', 'init', '--run-id', 'task-hint-cli-json', '--title', 'cli tip json', '--goal', 'tip bottom 4px 改成 6px', '--in', 'src/tip.css', '--no-knowledge-refs', '--json'], { cwd, stdout }), 0);
    const jsonRun = JSON.parse(chunks.join('')).run;
    assert.equal(jsonRun.gate_set, 'full');
    assert.equal(jsonRun.gate_set_suggestion.gate_set, 'lite');
    assert.equal(jsonRun.gate_set_suggestion.applied, false);
    assert.equal(diskOf('task-hint-cli-json').gate_set, 'full');
    chunks.length = 0;
    assert.equal(runCli(['ralph', 'init', '--run-id', 'task-hint-cli-full', '--title', 'cli tip full', '--goal', 'tip bottom 4px 改成 6px', '--in', 'src/tip.css', '--no-knowledge-refs', '--full'], { cwd, stdout }), 0);
    assert.match(chunks.join(''), /^initialized task-hint-cli-full\n/);
    assert.doesNotMatch(chunks.join(''), /gate_set\?/);
    chunks.length = 0;
    assert.equal(runCli(['ralph', 'init', '--run-id', 'task-hint-cli-unknown', '--title', 'cli 登录提醒', '--goal', '登录后密码过期要提示', '--no-knowledge-refs'], { cwd, stdout }), 0);
    assert.match(chunks.join(''), /^initialized task-hint-cli-unknown\n/);
    assert.doesNotMatch(chunks.join(''), /gate_set\?/);
    assert.equal(loadRun('task-hint-cli-unknown', cwd).gate_set, 'full');

    // (f) ralph_ops passes the advisory through; run.json stays full
    const ops = path.join(root, 'skills/jj-ralph/scripts/ralph_ops.mjs');
    const runNode = (args) => {
      const result = spawnSync(process.execPath, [ops, ...args, '--cwd', cwd], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      return JSON.parse(result.stdout);
    };
    const opsHint = runNode(['init', '--run-id', 'task-hint-ops', '--title', 'tip 位置', '--goal', 'tip bottom 4px 改成 6px', '--in', 'src/tip.css', '--project', 'ops-hint-proj']);
    assert.equal(opsHint.gate_set, 'full');
    assert.equal(opsHint.max_deliver_loops, INTENSITY_DEFAULTS.standard.budget.max_deliver_loops);
    assert.equal(opsHint.gate_set_suggestion.gate_set, 'lite');
    assert.equal(opsHint.gate_set_suggestion.applied, false);
    assert.equal(diskOf('task-hint-ops').gate_set, 'full');
    const opsFull = runNode(['init', '--run-id', 'task-hint-ops-full', '--title', 'tip 位置', '--goal', 'tip bottom 4px 改成 6px', '--in', 'src/tip.css', '--full', '--project', 'ops-hint-proj']);
    assert.equal(opsFull.gate_set, 'full');
    assert.equal(opsFull.gate_set_suggestion, null);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('Scheme A: events.jsonl is machine SSOT; progress rounds append; abandon parks under completed/', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-scheme-a-'));
  try {
    const runId = 'task-scheme-a-events';
    initRun({ run_id: runId, title: 'scheme a', goal: 'jsonl + completed', capability_ids: ['CAP-a'], attach_knowledge: false }, cwd);
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', runId, '.state', 'run.json')));
    assert.ok(!fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'tasks', runId)));

    setGate(runId, { gate: 'analyze', status: 'PASS', cwd });
    const eventsPath = path.join(cwd, '.workflow', 'ralph', runId, '.state', 'events.jsonl');
    assert.ok(fs.existsSync(eventsPath));
    const rows = fs.readFileSync(eventsPath, 'utf8').trim().split(/\n/).map((line) => JSON.parse(line));
    assert.ok(rows.some((row) => row.type === 'gate' || /gate/i.test(row.message || row.line || '')));

    appendProgressRound(runId, cwd, { title: '用户纠正', goal: '第二轮', result: '进行中' });
    const progress = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', runId, 'progress.md'), 'utf8');
    assert.match(progress, /## \d{4}-\d{2}-\d{2} — 用户纠正/);
    assert.doesNotMatch(progress, /gate analyze=PASS/);

    const abandoned = abandonRun(runId, { reason: 'park incomplete work', cwd });
    assert.equal(abandoned.status, 'ABANDONED');
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'completed', runId, '.state', 'run.json')));
    assert.ok(!fs.existsSync(path.join(cwd, '.workflow', 'ralph', runId, '.state', 'run.json')));
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'index.md')));
    const index = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', 'index.md'), 'utf8');
    assert.match(index, /completed|已完成/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('migrate --prune-archive dry-run by default; --yes deletes 1.0 archive/ snapshots', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-prune-'));
  try {
    const snap = path.join(cwd, '.workflow', 'ralph', 'archive', '2026-01-01-old');
    fs.mkdirSync(snap, { recursive: true });
    fs.writeFileSync(path.join(snap, 'marker.txt'), 'keep-until-yes\n');
    const dry = pruneArchive({ cwd, confirm: false });
    assert.equal(dry.dry_run, true);
    assert.equal(dry.count, 1);
    assert.ok(fs.existsSync(path.join(snap, 'marker.txt')));
    const viaMigrate = migrateRuns({ cwd, prune_archive: true, yes: false });
    assert.equal(viaMigrate.prune_archive.dry_run, true);
    assert.ok(fs.existsSync(path.join(snap, 'marker.txt')));
    const deleted = migrateRuns({ cwd, prune_archive: true, yes: true });
    assert.equal(deleted.prune_archive.dry_run, false);
    assert.equal(deleted.prune_archive.count, 1);
    assert.ok(!fs.existsSync(snap));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

function makeNextRun(patch = {}) {
  return {
    run_id: 'task-next-sample',
    status: 'IN_PROGRESS',
    phase: 'ACCEPT',
    gates: { analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PENDING', archive: 'PENDING' },
    review: null,
    archive: null,
    ...patch
  };
}

test('computeRalphNext: review / commit-scoped-review / finalize / completed empty / resume window', () => {
  assert.equal(INDEX_ACTIVE_CAP, 5);
  assert.equal(INDEX_STALE_MS, 5 * 24 * 60 * 60 * 1000);
  assert.equal(computeRalphNext(makeNextRun({
    review: { latest_review_id: 'REV-1', reviews: [{ review_id: 'REV-1', outcome: 'NEEDS_CHANGES' }] }
  })), 'review');
  assert.equal(computeRalphNext(makeNextRun({
    gates: { analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PASS', archive: 'PENDING' },
    review: { latest_review_id: 'REV-2', reviews: [{ review_id: 'REV-2', outcome: 'PASS', review_scope: 'working_tree' }] }
  })), 'commit-scoped-review');
  assert.equal(computeRalphNext(makeNextRun({
    gates: { analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PASS', archive: 'PENDING' },
    review: { latest_review_id: 'REV-3', reviews: [{ review_id: 'REV-3', outcome: 'PASS', review_scope: 'commit', reviewed_commit: 'abc1234' }] }
  })), 'finalize');
  assert.equal(computeRalphNext(makeNextRun({
    status: 'COMPLETED',
    phase: 'ARCHIVE',
    gates: { analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PASS', archive: 'PASS' },
    archive: { archived_at: '2026-09-01T00:00:00.000Z' }
  }), { layout: 'completed' }), null);
  assert.equal(computeRalphNext(makeNextRun({
    status: 'IN_PROGRESS',
    phase: 'DELIVER',
    gates: { analyze: 'PASS', plan: 'PASS', deliver: 'PASS', accept: 'PASS', archive: 'PASS' },
    archive: { archived_at: '2026-09-01T00:00:00.000Z' }
  })), 'check');
  assert.equal(computeRalphNext(makeNextRun({ status: 'PAUSED' })), 'check');
  assert.equal(computeRalphNext(makeNextRun({ needs_migrate: true, run_id: 'RALPH-old' })), 'migrate');
});

test('init same-session guard matches CLI --thread-id / host.thread_id', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-host-sess-'));
  const stdout = { write: () => {} };
  try {
    assert.equal(runCli([
      'ralph', 'init',
      '--run-id', 'task-host-sess-a',
      '--title', 'first in session',
      '--goal', 'do the first thing',
      '--thread-id', 'sess-1',
      '--no-knowledge-refs'
    ], { cwd, stdout }), 0);
    const listed = listRuns(cwd);
    assert.equal(listed.find((row) => row.run_id === 'task-host-sess-a')?.host_thread_id, 'sess-1');
    assert.throws(
      () => runCli([
        'ralph', 'init',
        '--run-id', 'task-host-sess-b',
        '--title', 'unrelated title here',
        '--goal', 'unrelated goal here',
        '--thread-id', 'sess-1',
        '--no-knowledge-refs'
      ], { cwd, stdout }),
      /same session already has live Ralph task-host-sess-a/
    );
    initRun({
      run_id: 'task-host-sess-b',
      title: 'second forced',
      goal: 'forced sibling',
      attach_knowledge: false,
      force: true,
      host: { thread_id: 'sess-1' }
    }, cwd);
    const hints = collectSameRequirementHints(listRuns(cwd));
    assert.equal(hints.triggered, true);
    assert.ok(hints.items.some((item) => item.kind === 'same-session' && item.thread_id === 'sess-1'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('init refuses review-slice slug; index prompts when it sits beside another live run', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-review-slice-'));
  try {
    assert.throws(
      () => initRun({
        run_id: 'task-h5-enter-review-fix',
        title: '供应商H5入驻审查三点修复',
        goal: '按审查修三点',
        attach_knowledge: false
      }, cwd),
      /review-fix \/ 审查修复 is not a new requirement/
    );
    initRun({
      run_id: 'task-enter-form-h5',
      title: '动态入驻表单交接到供应商端H5',
      goal: 'H5 交接',
      attach_knowledge: false
    }, cwd);
    initRun({
      run_id: 'task-h5-enter-review-fix',
      title: '供应商H5入驻审查三点修复',
      goal: '按审查修三点',
      attach_knowledge: false,
      force: true
    }, cwd);
    const index = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', 'index.md'), 'utf8');
    assert.match(index, /## 同需求提示/);
    assert.match(index, /审查切片不是新任务/);
    assert.match(index, /不自动合并/);
    const listed = getStatus({ cwd });
    assert.equal(listed.same_requirement_hints.triggered, true);
    assert.match(renderRalphStatusText(listed), /同需求提示/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('index.md archive hints: overflow / stale trigger; uncertain asks; never auto-archive', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ralph-index-hints-'));
  try {
    const fresh = initRun({
      run_id: 'task-hint-fresh-a',
      title: 'fresh a',
      goal: 'two live runs stay quiet',
      attach_knowledge: false
    }, cwd);
    initRun({
      run_id: 'task-hint-fresh-b',
      title: 'fresh b',
      goal: 'two live runs stay quiet',
      attach_knowledge: false
    }, cwd);
    let index = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', 'index.md'), 'utf8');
    assert.doesNotMatch(index, /## 归档提示/);
    const quiet = collectIndexArchiveHints([
      { run_id: fresh.run_id, status: 'IN_PROGRESS', updated_at: fresh.updated_at },
      { run_id: 'task-hint-fresh-b', status: 'IN_PROGRESS', updated_at: new Date().toISOString() }
    ]);
    assert.equal(quiet.triggered, false);
    assert.equal(quiet.auto_archive, false);

    const staleAt = new Date(Date.now() - INDEX_STALE_MS - 60_000).toISOString();
    const paused = loadRun('task-hint-fresh-a', cwd);
    paused.status = 'PAUSED';
    paused.updated_at = staleAt;
    saveRun(paused, cwd);
    index = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', 'index.md'), 'utf8');
    assert.match(index, /## 归档提示/);
    assert.match(index, /5天未更新/);
    assert.match(index, /询问用户/);
    assert.match(index, /不自动 finalize \/ abandon/);
    assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', 'task-hint-fresh-a', '.state', 'run.json')));

    const ready = loadRun('task-hint-fresh-b', cwd);
    ready.gates.accept = 'PASS';
    ready.gates.deliver = 'PASS';
    ready.updated_at = staleAt;
    saveRun(ready, cwd);
    index = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', 'index.md'), 'utf8');
    assert.match(index, /`task-hint-fresh-b` \| 5天未更新 \| finalize/);

    for (let i = 0; i < 4; i += 1) {
      initRun({
        run_id: 'task-hint-overflow-' + i,
        title: 'overflow ' + i,
        goal: 'push active count over cap',
        attach_knowledge: false
      }, cwd);
    }
    const listed = listRuns(cwd).filter((row) => row.layout === 'active');
    assert.ok(listed.length > INDEX_ACTIVE_CAP);
    const written = writeRalphIndex(cwd);
    assert.equal(written.hints.triggered, true);
    assert.equal(written.hints.auto_archive, false);
    assert.equal(written.hints.overflow, true);
    index = fs.readFileSync(path.join(cwd, '.workflow', 'ralph', 'index.md'), 'utf8');
    assert.match(index, /活跃超过5条/);
    for (const row of listed) {
      assert.ok(fs.existsSync(path.join(cwd, '.workflow', 'ralph', row.run_id, '.state', 'run.json')));
    }

    const status = getStatus({ runId: 'task-hint-fresh-b', cwd });
    assert.equal(status.next, 'finalize');
    assert.match(renderRalphStatusText(status), /next: finalize/);
    const listedStatus = getStatus({ cwd });
    assert.equal(listedStatus.index_hints.triggered, true);
    assert.match(renderRalphStatusText(listedStatus), /归档提示/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
