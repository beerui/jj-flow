import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { RALPH_MAP_SCHEMA_VERSION, RALPH_RUN_SCHEMA_VERSION_LEGACY, validateMap, validateRun } from '../../src/ralph.mjs';
import * as ralphApi from '../../src/ralph.mjs';
import { root, read, readJson } from './helpers.mjs';

const RALPH_PUBLIC_EXPORTS = Object.freeze([
  'contextGateOptions',
  'getRalphContext',
  'getRalphSummary',
  'readJsonInput',
  'validateRalphContext',
  'writeRalphContext',
  'ACCEPT_LAYER_STATUSES',
  'ARCHIVE_CLOSEOUT_WARNING',
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
  'INTENSITY_HEURISTIC',
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
  'beginAssignmentRound',
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
  'inspectAnalyzePlanArtifacts',
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
  'passDeliverGates',
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
  'remediateCloseout',
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
  'suggestIntensity',
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

test('ralph schemas, samples, skill and command assets exist with key markers', () => {
  for (const rel of [
    'schemas/ralph-run.schema.json',
    'schemas/ralph-business-map.schema.json',
    'examples/ralph/sample-run.json',
    'examples/ralph/sample-business-map.json',
    'skills/jj-ralph/SKILL.md',
    'skills/jj-ralph/references/artifact-layout.md',
    'skills/jj-ralph/references/phases.md',
    'skills/jj-ralph/references/ops.md',
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
    'ralph_ops.mjs',
    'finalize',
    'rollback',
    'deliver-attempt',
    'task_plan.md',
    '~/.jj-flow',
    'jj-init',
    // conversational path: never --lite; screenshot / analyze-hold / same-session continue
    'Conversational path never uses --lite',
    'gate brief',
    'gate close',
    '先不写代码',
    '按审查改',
    '改坏了',
    'commit-scoped-review',
    'review-record',
    '归档提示',
    '.workflow/ralph/index.md',
    '询问用户',
    '审查修复',
    'review-fix',
    '同需求提示',
    'host.thread_id',
    'wait for the user to say',
    'MUST finalize',
    'jj ralph locate',
    'CHECKPOINT (unconfirmed requirement)',
    'ask first',
    'Golden Q&A — G-ralph-1',
    'next unchecked Step'
  ]) {
    assert.match(skill, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(skill, /Screenshot \/ `\[Image\]` \/ 「这里」/);
  assert.doesNotMatch(skill, /顺手修/);
  assert.doesNotMatch(skill, /完整走一遍/);
  assert.ok(skill.trimEnd().split(/\r?\n/).length <= 100, 'Ralph entry must stay within 100 lines');
  for (const forbidden of [/\bintensity\b/, /accept-layer/, /CHECKPOINT \(strict\)/, /init must infer/, /init infers/, /--intensity/, /tiny,\s*strict/, /map-find/]) {
    assert.doesNotMatch(skill, forbidden);
  }
  const conversational = skill.split('## Conversational commands')[1].split('## Read when needed')[0];
  assert.deepEqual([...conversational.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]), [
    'init', 'resume', 'locate', 'status', 'context', 'deliver-attempt', 'gate', 'finalize', 'abandon', 'finding', 'commit-prep'
  ]);
  for (const [, rel] of skill.matchAll(/\]\((references\/[^)]+)\)/g)) {
    assert.ok(fs.existsSync(path.join(root, 'skills/jj-ralph', rel)), `missing skill reference ${rel}`);
  }
  assert.match(skill, /read \[phases\.md\].*DELIVER/);
  assert.match(skill, /empty CAP hits are valid/);
  const happyPath = skill.split('## Happy path')[1].split('## Red checkpoints')[0];
  assert.match(happyPath, /gate deliver PASS.*folds analyze \+ plan/);
  assert.match(happyPath, /degraded unfold/);
  assert.match(happyPath, /do not finalize/);
  assert.match(happyPath, /gate accept PASS → MUST finalize/);
  assert.doesNotMatch(happyPath, /\$jj-end/);

  const userCmd = read('docs/commands/jj-ralph.md');
  for (const marker of [
    '项目A',
    '项目B',
    '项目C',
    '控制项目',
    'task-login-reminder',
    'DEL-password',
    'CAP-login-reminder',
    '先不写代码',
    '按审查改',
    '改坏了',
    '这里',
    '仍走五步',
    '归档提示',
    '审查修复',
    'MUST finalize',
    '未完成收尾',
    'jj ralph locate',
    'jj ralph remediate',
    '确认不了',
    '不要猜着做'
  ]) {
    assert.match(userCmd, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(userCmd, /轻量档（lite）/);
  assert.doesNotMatch(userCmd, /顺手修/);
  for (const forbidden of [/### 强度档/, /\$jj-ralph tiny/, /\$jj-ralph strict/, /口语里点名即可/, /\bintensity\b/]) {
    assert.doesNotMatch(userCmd, forbidden);
  }

  const phases = read('skills/jj-ralph/references/phases.md');
  // English SSOT: intensity tier section (was Chinese 「强度档」)
  assert.match(phases, /[Ii]ntensity|intensity tier|tiny\|standard\|strict/);
  assert.match(phases, /deliver-attempt/);
  assert.match(phases, /accept-layer|accept_layers/);
  assert.match(phases, /archive_history/);
  assert.match(phases, /## Gate set \(deprecated\)/);
  assert.match(phases, /\*\*never\*\* uses `--lite`/);
  assert.match(phases, /先不写代码/);
  assert.match(phases, /Unconfirmed requirement/);
  assert.match(phases, /ask first/);
  assert.match(phases, /commit-scoped-review/);
  assert.match(phases, /归档提示/);
  assert.doesNotMatch(phases, /prefer `?intensity=tiny/);
  for (const marker of ['rollback-phase', 'instruction-correction', 'process/agent limit', 'offset', '未完成收尾', 'jj ralph remediate', 'product-consistency']) {
    assert.ok(phases.includes(marker), `phases owns ${marker}`);
  }
  const integrations = read('skills/jj-ralph/references/integrations.md');
  for (const marker of ['Idle offer', 'knowledge-confirm', 'hot_memory', 'MasterGo', 'blocked_reasons', 'do_not_port']) {
    assert.ok(integrations.includes(marker), `integrations owns ${marker}`);
  }
  const ops = read('skills/jj-ralph/references/ops.md');
  assert.match(ops, /degraded unfold/);
  assert.match(ops, /Do not finalize/);
  for (const marker of ['map-find', 'accept-layer', 'metrics', 'migrate', 'adopt', 'dispatch-snapshot', 'knowledge-contribute', 'rollback-phase', '--intensity']) {
    assert.ok(ops.includes(marker), `ops owns ${marker}`);
  }
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
  assert.doesNotMatch(command, /map-find/);
  assert.match(command, /不要.*`--intensity`/);
  assert.doesNotMatch(command, /只有 intensity|tiny\/standard\/strict/);
  assert.match(command, /未要求 commit\/push\/review\/handoff\/dispatch 不做/);
  assert.doesNotMatch(command, /finalize.*→.*\$jj-end/);
  assert.doesNotMatch(command, /[Mm]aestro/);

  const layout = read('skills/jj-ralph/references/artifact-layout.md');
  assert.match(layout, /Goal \/ 验收 \/ Steps/);
  assert.match(layout, /\.workflow\/ralph\/(?:tasks\/)?(?:task-|<task)/);
  assert.doesNotMatch(layout, /ralph\/ralphs\//);
  assert.doesNotMatch(layout, /ralphs\/RALPH/);
  assert.doesNotMatch(layout, /ralph\/runs\//);
});

test('ralph asks first when requirement cannot be confirmed', () => {
  const skill = read('skills/jj-ralph/SKILL.md');
  const phases = read('skills/jj-ralph/references/phases.md');
  const layout = read('skills/jj-ralph/references/artifact-layout.md');
  const tiny = read('skills/jj-ralph/references/tiny-example.md');
  const command = read('claude-commands/jj-ralph.md');
  const userCmd = read('docs/commands/jj-ralph.md');
  const usage = read('docs/usage.md');
  assert.match(skill, /CHECKPOINT \(unconfirmed requirement\)/);
  assert.match(skill, /ask first/);
  assert.match(phases, /and the requirement is confirmed/);
  assert.match(phases, /cannot be confirmed/);
  assert.match(phases, /stay in the current phase \(or BLOCKED\)/);
  assert.match(phases, /ACCEPT\/ARCHIVE the guess/);
  assert.match(phases, /Unconfirmed requirement/);
  assert.match(phases, /ask first/);
  assert.match(phases, /Do not invent, do not pick a side/);
  assert.match(phases, /do not treat a guess as the spec/);
  assert.match(phases, /do not rollback-phase to ANALYZE/);
  assert.match(phases, /gate` analyze\/plan\/deliver\/accept\/archive/);
  assert.doesNotMatch(skill, /cannot be safely inferred/);
  assert.doesNotMatch(phases, /cannot be safely inferred/);
  assert.match(layout, /tiny` skips empty `## 存疑` at init/);
  assert.match(layout, /unconfirmed requirement \(ask first; do not invent\)/);
  assert.doesNotMatch(layout, /`tiny` skips `## 存疑`\./);
  assert.match(tiny, /No empty `## 存疑` at init/);
  assert.match(tiny, /tiny is not exempt/);
  assert.doesNotMatch(tiny, /\*\*No `## 存疑`\*\*/);
  assert.match(command, /需求确认不了先问/);
  assert.match(userCmd, /确认不了（先问，不要猜着做）/);
  assert.match(userCmd, /MUST \/ 范围 \/ 验收事后仍确认不了/);
  assert.match(usage, /MUST \/ 范围 \/ 验收事后仍确认不了/);
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
