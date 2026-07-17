import fs from 'node:fs';
import path from 'node:path';
import { buildMaestroCompatibilityEvidence } from './maestroCompatibility.mjs';
import { RECIPES } from './recipes.mjs';

const REQUIRED_DOCS = [
  'docs/index.md',
  'docs/installation.md',
  'docs/usage.md',
  'docs/commands.md',
  'docs/commands/jj.md',
  'docs/commands/jj-same.md',
  'docs/commands/jj-dispatch.md',
  'docs/commands/cli.md',
  'docs/glossary.md',
  'docs/architecture.md',
  'docs/project-plan.md',
  'docs/maintenance.md',
  'docs/deployment.md',
  'docs/adr/0002-project-family-control-plane.md'
];

const REQUIRED_SOURCE = [
  'bin/jj.mjs',
  'src/cli.mjs',
  'src/dispatch.mjs',
  'src/recipes.mjs',
  'src/guards.mjs',
  'src/evidence.mjs',
  'src/evidenceProviders.mjs',
  'src/installSkill.mjs',
  'src/knowledgeLoop.mjs',
  'src/maestroCompatibility.mjs',
  'src/maestroExecution.mjs',
  'src/dispatchControlPlane.mjs',
  'src/projectValidation.mjs',
  '.codex/skills/jj/SKILL.md',
  '.codex/skills/jj-same/SKILL.md',
  '.codex/skills/jj-dispatch/SKILL.md',
  '.codex/skills/jj-dispatch/agents/openai.yaml',
  '.codex/agents/jj-workflow-reviewer.toml',
  '.codex/agents/jj-workflow-developer.toml',
  '.codex/skills/jj-dispatch/references/control-project.md',
  '.codex/skills/jj-dispatch/references/control-plane.schema.json',
  '.claude/commands/jj.md',
  '.claude/commands/jj-same.md'
];

const REQUIRED_TESTS = [
  'tests/dispatch.test.mjs',
  'tests/evidence-providers.test.mjs',
  'tests/guards.test.mjs',
  'tests/install-skill.test.mjs',
  'tests/knowledge-loop.test.mjs',
  'tests/maestro-compatibility.test.mjs',
  'tests/maestro-execution.test.mjs',
  'tests/project-validation.test.mjs',
  'tests/jj-dispatch-contract.test.mjs',
  'tests/fixtures/jj-dispatch-control-plane.json'
];

const REQUIRED_MODES = ['same'];
const COMMAND_REFERENCE_FILES = [
  'docs/architecture.md',
  'docs/commands.md',
  '.codex/skills/jj/SKILL.md',
  '.claude/commands/jj.md'
];

export function buildProjectValidationEvidence({ cwd = process.cwd() } = {}) {
  const packageJson = readJson(path.join(cwd, 'package.json'));
  const workflowState = readJson(path.join(cwd, '.workflow', 'state.json'));
  const roadmapState = auditRoadmapState(cwd, workflowState);
  const docs = collectFileSet(cwd, REQUIRED_DOCS);
  const source = collectFileSet(cwd, REQUIRED_SOURCE);
  const tests = collectFileSet(cwd, REQUIRED_TESTS);
  const maestroCompatibility = buildMaestroCompatibilityEvidence();
  const recipeModes = Object.keys(RECIPES);
  const missingRecipes = REQUIRED_MODES.filter((mode) => !recipeModes.includes(mode));
  const missingDocs = docs.missing;
  const missingSource = source.missing;
  const missingTests = tests.missing;
  const docsWithoutModes = COMMAND_REFERENCE_FILES.filter((file) => fs.existsSync(path.join(cwd, file))).filter((file) => {
    const text = fs.readFileSync(path.join(cwd, file), 'utf8');
    return REQUIRED_MODES.some((mode) => !text.includes(mode));
  });
  const scripts = packageJson?.scripts || {};
  const missingScripts = ['test', 'check', 'docs:check', 'verify'].filter((name) => !scripts[name]);
  const nextPhase = findNextPhase(workflowState);
  const roadmapComplete = Boolean(workflowState && allPhasesCompleted(workflowState));
  const phaseReadiness = buildPhaseReadiness(cwd, workflowState, nextPhase);
  const failures = [
    ...missingDocs.map((file) => `缺少文档 ${file}`),
    ...missingSource.map((file) => `缺少源码 ${file}`),
    ...missingTests.map((file) => `缺少测试 ${file}`),
    ...missingRecipes.map((mode) => `缺少 recipe ${mode}`),
    ...missingScripts.map((name) => `缺少 npm script ${name}`),
    ...roadmapState.errors
  ];
  const warnings = [
    ...docsWithoutModes.map((file) => `文档未覆盖全部核心命令：${file}`),
    ...roadmapState.warnings
  ];

  const evidence = [
    {
      id: 'project-state',
      source: 'jj-flow-check',
      artifact_type: 'project_state',
      path: '.',
      summary: packageJson
        ? `项目 ${packageJson.name || '(unknown)'} 当前版本 ${packageJson.version || '(unknown)'}。`
        : '缺少 package.json，无法读取项目包信息。',
      evidence: {
        package_name: packageJson?.name || null,
        version: packageJson?.version || null,
        scripts: Object.keys(scripts)
      }
    },
    {
      id: 'workflow-state',
      source: 'jj-flow-check',
      artifact_type: workflowState ? 'workflow_state' : 'validation_failure',
      path: '.workflow/state.json',
      summary: workflowState
        ? `workflow 状态为 ${workflowState.status || '(unknown)'}，当前 milestone 为 ${workflowState.current_milestone || '(unknown)'}。`
        : '缺少或无法解析 .workflow/state.json。',
      evidence: {
        status: workflowState?.status || null,
        current_milestone: workflowState?.current_milestone || null,
        next_phase: nextPhase,
        roadmap_state: roadmapState
      }
    },
    {
      id: 'docs-reference',
      source: 'jj-flow-check',
      artifact_type: missingDocs.length || docsWithoutModes.length ? 'validation_failure' : 'docs_reference',
      path: 'docs/',
      summary: missingDocs.length
        ? `文档缺失 ${missingDocs.length} 个必需文件。`
        : docsWithoutModes.length
          ? `文档存在但有 ${docsWithoutModes.length} 个页面未覆盖全部核心命令。`
          : '文档入口、安装、使用、命令总览、独立命令页、术语、架构、规划、维护和部署说明齐备。',
      evidence: {
        required: REQUIRED_DOCS,
        missing: missingDocs,
        docs_without_all_modes: docsWithoutModes
      }
    },
    {
      id: 'recipe-registry',
      source: 'jj-flow-check',
      artifact_type: missingRecipes.length || missingSource.length ? 'validation_failure' : 'recipe_registry',
      path: 'src/recipes.mjs',
      summary: missingRecipes.length
        ? `recipe registry 缺少 ${missingRecipes.join(', ')}。`
        : '核心 recipe 已在 registry 中注册。',
      evidence: {
        required_modes: REQUIRED_MODES,
        recipe_modes: recipeModes,
        missing_source: missingSource
      }
    },
    {
      id: 'test-coverage',
      source: 'jj-flow-check',
      artifact_type: missingTests.length ? 'validation_failure' : 'test_coverage',
      path: 'tests/',
      summary: missingTests.length
        ? `测试缺失 ${missingTests.length} 个必需文件。`
        : 'dispatch、guard、install-skill 和 project validation 测试文件齐备。',
      evidence: {
        required: REQUIRED_TESTS,
        missing: missingTests
      }
    },
    {
      id: 'verification-command',
      source: 'jj-flow-check',
      artifact_type: missingScripts.length ? 'validation_failure' : 'verification_command',
      path: 'package.json',
      summary: missingScripts.length
        ? `验证脚本缺失：${missingScripts.join(', ')}。`
        : '`npm run verify` 已覆盖测试、项目检查和文档检查。',
      evidence: {
        required_scripts: ['test', 'check', 'docs:check', 'verify'],
        missing: missingScripts
      }
    },
    {
      id: 'phase-readiness',
      source: 'jj-flow-check',
      artifact_type: 'phase_readiness',
      path: '.workflow/state.json',
      summary: phaseReadiness
        ? phaseReadiness.phase
          ? `${phaseReadiness.phase.milestone_id}/${phaseReadiness.phase.id} ${phaseReadiness.phase.name} 成功标准 ${phaseReadiness.status}。`
          : '路线图所有 phase 已完成。'
        : '未能识别当前 phase 成功标准。需要人工确认下一步。',
      evidence: phaseReadiness
    },
    maestroCompatibility,
    {
      id: 'next-recommendation',
      source: 'jj-flow-check',
      artifact_type: nextPhase || roadmapComplete ? 'next_recommendation' : 'validation_failure',
      path: '.workflow/state.json',
      summary: nextPhase
        ? phaseReadiness?.status === 'PASS'
          ? `下一步建议完成 ${nextPhase.milestone_id}/${nextPhase.id} ${nextPhase.name}，再推进依赖阶段。`
          : `下一步建议推进 ${nextPhase.milestone_id}/${nextPhase.id} ${nextPhase.name}。`
        : roadmapComplete
          ? '路线图所有 phase 已完成，建议进入维护和真实项目试运行。'
          : '未能从 workflow state 中推导下一步 phase。',
      evidence: {
        next_phase: nextPhase,
        roadmap_complete: roadmapComplete,
        phase_readiness: phaseReadiness,
        warnings
      },
      next_steps: nextPhase ? nextPhase.success_criteria || [] : []
    }
  ];

  if (failures.length) {
    evidence.push({
      id: 'validation-failures',
      source: 'jj-flow-check',
      artifact_type: 'validation_failure',
      summary: `发现 ${failures.length} 个项目自检失败项。`,
      evidence: { failures }
    });
  }

  return evidence;
}

function collectFileSet(cwd, files) {
  const existing = [];
  const missing = [];

  for (const file of files) {
    if (fs.existsSync(path.join(cwd, file))) {
      existing.push(file);
    } else {
      missing.push(file);
    }
  }

  return { existing, missing };
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function findNextPhase(workflowState) {
  if (!workflowState?.milestones?.length) return null;

  for (const milestone of workflowState.milestones) {
    for (const phase of milestone.phases || []) {
      if (phase.status !== 'completed') {
        return {
          milestone_id: milestone.id,
          milestone_name: milestone.name,
          id: phase.id,
          slug: phase.slug,
          name: phase.name,
          status: phase.status,
          success_criteria: phase.success_criteria || []
        };
      }
    }
  }

  return null;
}

function buildPhaseReadiness(cwd, workflowState, phase) {
  if (!workflowState) return null;
  if (!phase) {
    return allPhasesCompleted(workflowState)
      ? { status: 'PASS', phase: null, criteria: [], incomplete: [], complete: true }
      : null;
  }

  const criteria = (phase.success_criteria || []).map((criterion) => {
    const audit = auditCriterion(cwd, criterion);
    return {
      criterion,
      status: audit.status,
      evidence: audit.evidence,
      reason: audit.reason
    };
  });
  const status = criteria.length && criteria.every((item) => item.status === 'PASS') ? 'PASS' : 'PENDING';

  return {
    status,
    phase,
    criteria,
    incomplete: criteria.filter((item) => item.status !== 'PASS').map((item) => item.criterion)
  };
}

function allPhasesCompleted(workflowState) {
  return Boolean(workflowState?.milestones?.length)
    && workflowState.milestones.every((milestone) => {
      return (milestone.phases || []).every((phase) => phase.status === 'completed');
    });
}

function auditRoadmapState(cwd, workflowState) {
  const roadmapPath = path.join(cwd, '.workflow', 'roadmap.md');
  const projectPath = path.join(cwd, '.workflow', 'project.md');
  if (!workflowState || !fs.existsSync(roadmapPath) || !fs.existsSync(projectPath)) {
    return { ok: false, errors: ['缺少 project、roadmap 或 workflow state，无法核对进度。'], warnings: [] };
  }
  const roadmap = fs.readFileSync(roadmapPath, 'utf8');
  const project = fs.readFileSync(projectPath, 'utf8');
  const rows = new Map();
  const rowCounts = new Map();
  for (const match of roadmap.matchAll(/^\|\s*M\d+\s*\|\s*P(\d+)[^|]*\|\s*([a-z_]+)\s*\|/gm)) {
    rows.set(match[1], match[2]);
    rowCounts.set(match[1], (rowCounts.get(match[1]) || 0) + 1);
  }
  const requirementRows = new Map();
  for (const match of roadmap.matchAll(/^\|\s*(REQ-[A-Z0-9-]+)\s*\|[^|]*\|\s*P(\d+)\s*\|/gm)) {
    const [, requirementId, phaseId] = match;
    const existing = requirementRows.get(requirementId) || [];
    existing.push(phaseId);
    requirementRows.set(requirementId, existing);
  }
  const errors = [];
  const warnings = [];
  const stateRequirements = new Map();
  for (const milestone of workflowState.milestones || []) {
    for (const phase of milestone.phases || []) {
      const phaseId = String(phase.id).replace(/^P/i, '');
      for (const requirement of phase.requirements || []) {
        const existing = stateRequirements.get(requirement) || [];
        existing.push(phaseId);
        stateRequirements.set(requirement, existing);
      }
      const roadmapStatus = rows.get(phaseId);
      if (!roadmapStatus) {
        errors.push('roadmap 缺少 P' + phaseId + ' 进度行。');
        continue;
      }
      if ((rowCounts.get(phaseId) || 0) !== 1) {
        errors.push('roadmap P' + phaseId + ' 进度行必须唯一。');
      }
      if (roadmapStatus !== phase.status) {
        errors.push('roadmap P' + phaseId + '=' + roadmapStatus + ' 与 state=' + phase.status + ' 不一致。');
      }
    }
  }
  for (const [requirementId, phases] of stateRequirements) {
    const mapped = requirementRows.get(requirementId) || [];
    if (phases.length !== 1) errors.push(`state requirement ${requirementId} 必须只归属一个 phase。`);
    if (mapped.length !== 1) errors.push(`roadmap requirement ${requirementId} 必须只映射一个 phase。`);
    if (!project.includes(requirementId)) errors.push(`project.md 缺少 requirement ${requirementId}。`);
    if (mapped.length === 1 && phases.length === 1 && mapped[0] !== phases[0]) {
      errors.push(`requirement ${requirementId} 映射到 P${mapped[0]}，但 state 属于 P${phases[0]}。`);
    }
  }
  for (const requirementId of requirementRows.keys()) {
    if (!stateRequirements.has(requirementId)) errors.push(`roadmap 包含未知 requirement ${requirementId}。`);
  }
  return { ok: errors.length === 0, errors, warnings };
}

function auditCriterion(cwd, criterion) {
  if (criterion.includes('控制项目可以独立') && criterion.includes('动态变化')) {
    return auditFilesContain(cwd, [
      'src/dispatchControlPlane.mjs',
      '.codex/skills/jj-dispatch/SKILL.md',
      'docs/adr/0002-project-family-control-plane.md'
    ], ['control_project', 'origin_project', 'requirement_owner', 'lead_project', 'targets']);
  }

  if (criterion.includes('UNKNOWN') && criterion.includes('stale attempt')) {
    return auditFilesContain(cwd, [
      'src/dispatchControlPlane.mjs',
      'tests/jj-dispatch-contract.test.mjs'
    ], ['assertCurrentAttempt', 'host_id', 'sandbox_mode', 'stale UNKNOWN attempt']);
  }

  if (criterion.includes('同步 checkpoint') && criterion.includes('成功证据')) {
    return auditFilesContain(cwd, [
      'src/dispatchControlPlane.mjs',
      '.codex/skills/jj-dispatch/references/control-plane.schema.json'
    ], ['snapshot_ref', 'snapshot_hash', 'handoff_ref', 'freshness', 'source_branch', 'target_branch', 'difference_ref', 'checkpoint']);
  }

  if (criterion.includes('Reviewer 只读') && criterion.includes('NEEDS_CHANGES')) {
    return auditFilesContain(cwd, [
      '.codex/agents/jj-workflow-reviewer.toml',
      '.codex/agents/jj-workflow-developer.toml',
      'src/dispatchControlPlane.mjs',
      'tests/jj-dispatch-contract.test.mjs'
    ], ['read-only', 'PASS', 'NEEDS_CHANGES', 'recordReviewResult']);
  }

  if (criterion.includes('NEEDS_CHANGES') && criterion.includes('attempt')) {
    return auditFilesContain(cwd, [
      'src/dispatchControlPlane.mjs',
      'tests/jj-dispatch-contract.test.mjs'
    ], ['requestRework', 'attempt', 'REWORK_REQUESTED']);
  }

  if (criterion.includes('Review PASS') && criterion.includes('VERIFIED')) {
    return auditFilesContain(cwd, [
      'src/dispatchControlPlane.mjs',
      '.codex/skills/jj-dispatch/SKILL.md',
      'tests/jj-dispatch-contract.test.mjs'
    ], ['assertReviewPassForTarget', 'PASS', 'VERIFIED']);
  }

  if (criterion.includes('架构 spec') && criterion.includes('薄适配边界')) {
    return auditFilesContain(cwd, [
      'docs/architecture.md',
      'docs/adr/0001-thin-maestro-adapter.md'
    ], ['项目族编排', '不 fork Maestro core', '不把 /jj-* 做成重型编排引擎']);
  }

  if (criterion.includes('CLI 模式') && criterion.includes('recipe 契约')) {
    return auditFilesContain(cwd, [
      'docs/commands.md',
      'docs/architecture.md',
      'src/recipes.mjs',
      'src/dispatch.mjs'
    ], ['same', 'jj-same', 'jj-dispatch']);
  }

  if (criterion.includes('GitHub Pages') && criterion.includes('docs/')) {
    return auditFilesContain(cwd, [
      'scripts/build-docs.mjs',
      '.github/workflows/pages.yml',
      'package.json'
    ], ['docs:build', 'docs:check', 'pages']);
  }

  if (criterion.includes('安装方式') && criterion.includes('命令参数')) {
    return auditFilesContain(cwd, [
      'docs/installation.md',
      'docs/commands.md',
      'docs/usage.md',
      'docs/maintenance.md'
    ], ['安装', '你需要给什么', '使用方案', '你会得到什么']);
  }

  if (criterion.includes('未文档化的 Maestro core 行为')) {
    return auditFilesContain(cwd, [
      'docs/architecture.md',
      'docs/project-plan.md',
      'docs/adr/0001-thin-maestro-adapter.md'
    ], ['不 fork Maestro core', '项目族编排', '可选']);
  }

  if (criterion.includes('npm run verify') && criterion.includes('schema 检查')) {
    return auditFilesContain(cwd, [
      'package.json',
      'scripts/check-project.mjs',
      'tests/project-validation.test.mjs'
    ], ['verify', 'check', 'docs:check', 'project validation']);
  }

  if (criterion.includes('npm run verify') && criterion.includes('文档站构建检查')) {
    return auditFilesContain(cwd, [
      'package.json',
      'scripts/build-docs.mjs',
      'docs/maintenance.md'
    ], ['docs:check', 'build-docs', 'docs site']);
  }

  if (criterion.includes('release workflow') && criterion.includes('验证契约')) {
    return auditFilesContain(cwd, [
      '.github/workflows/ci.yml',
      '.github/workflows/release-please.yml',
      'release-please-config.json',
      '.release-please-manifest.json'
    ], ['npm run verify', 'release-please', 'release-please-config.json']);
  }

  if (criterion.includes('缺失 evidence') && criterion.includes('PASS')) {
    return auditFilesContain(cwd, [
      'src/guards.mjs',
      'tests/guards.test.mjs',
      'src/evidence.mjs'
    ], ['PENDING', 'validation_failure', 'missing evidence', 'PASS']);
  }

  if (criterion.includes('本机用户') && criterion.includes('安装或刷新 jj skill')) {
    return auditFilesContain(cwd, [
      'src/installSkill.mjs',
      'bin/jj.mjs',
      'docs/installation.md',
      'tests/install-skill.test.mjs'
    ], ['installSkill', 'install-skill', '--force', '.codex/skills', '.claude/commands']);
  }

  if (criterion.includes('npm 包内容') && criterion.includes('files 声明')) {
    return auditFilesContain(cwd, [
      'package.json',
      'tests/install-skill.test.mjs'
    ], ['files', 'bin/', 'src/', '.codex/skills/', '.codex/agents/', '.claude/commands/', 'docs/']);
  }

  if (criterion.includes('安装错误可诊断') && criterion.includes('测试覆盖')) {
    return auditFilesContain(cwd, [
      'src/installSkill.mjs',
      'docs/commands.md',
      'tests/install-skill.test.mjs'
    ], ['target-exists', '--force', '--dry-run', 'exits non-zero']);
  }

  if (criterion.includes('jj 能报告 Maestro') && criterion.includes('兼容')) {
    return auditFilesContain(cwd, [
      'src/maestroCompatibility.mjs',
      'src/projectValidation.mjs',
      'docs/architecture.md'
    ], ['maestro_compatibility', 'MIN_MAESTRO_VERSION', 'Maestro 兼容']);
  }

  if (criterion.includes('Maestro 缺失或不兼容')) {
    return auditFilesContain(cwd, [
      'src/maestroCompatibility.mjs',
      'tests/maestro-compatibility.test.mjs'
    ], ['missing', 'incompatible', 'next_steps']);
  }

  if (criterion.includes('测试覆盖可用、缺失、不兼容')) {
    return auditFilesContain(cwd, [
      'tests/maestro-compatibility.test.mjs'
    ], ['compatible', 'missing', 'incompatible']);
  }

  if (criterion.includes('每个适配器') && criterion.includes('标准化 evidence JSON')) {
    return auditFilesContain(cwd, [
      'src/evidenceProviders.mjs',
      'src/evidence.mjs',
      'tests/evidence-providers.test.mjs',
      'tests/fixtures/evidence-providers.json'
    ], ['PROVIDER_SPECS', 'validateEvidence', 'normalizeEvidenceList', 'yapi_contract', 'arms_sls', 'zentao_task']);
  }

  if (criterion.includes('工具失败') && criterion.includes('PENDING 或 FAIL')) {
    return auditFilesContain(cwd, [
      'src/evidenceProviders.mjs',
      'tests/evidence-providers.test.mjs'
    ], ['provider_partial', 'provider_failure', 'PENDING', 'FAIL']);
  }

  if (criterion.includes('fixtures 覆盖成功') && criterion.includes('工具失败')) {
    return auditFilesContain(cwd, [
      'tests/fixtures/evidence-providers.json',
      'tests/evidence-providers.test.mjs'
    ], ['success', 'missingFields', 'partial', 'failure']);
  }

  if (criterion.includes('功能交付') && criterion.includes('YApi、设计、测试 evidence')) {
    return auditFilesContain(cwd, [
      'src/recipes.mjs',
      'src/guards.mjs',
      'tests/guards.test.mjs'
    ], ['same', 'tests-planned', 'source-materials-discovered']);
  }

  if (criterion.includes('故障修复') && criterion.includes('ARMS/SLS') && criterion.includes('root-cause')) {
    return auditFilesContain(cwd, [
      'src/recipes.mjs',
      'src/guards.mjs',
      'tests/guards.test.mjs'
    ], ['same', 'evidence-not-guessed', 'tests-planned']);
  }

  if (criterion.includes('知识沉淀') && criterion.includes('交付审查') && criterion.includes('追溯')) {
    return auditFilesContain(cwd, [
      'src/recipes.mjs',
      'src/guards.mjs',
      'src/knowledgeLoop.mjs',
      'tests/knowledge-loop.test.mjs'
    ], ['same', 'knowhow', 'spec', 'workflow_recipe']);
  }

  if (criterion.includes('intent') && criterion.includes('evidence 上下文选择 Maestro 链路')) {
    return auditFilesContain(cwd, [
      'src/dispatch.mjs',
      'src/maestroExecution.mjs',
      'tests/maestro-execution.test.mjs'
    ], ['buildExecutionDecision', 'execution_decision', 'maestro_calls']);
  }

  if (criterion.includes('evidence 不足') && criterion.includes('disabled 或 blocked')) {
    return auditFilesContain(cwd, [
      'src/maestroExecution.mjs',
      'tests/maestro-execution.test.mjs'
    ], ['disabled', 'blocked', 'PENDING', 'FAIL']);
  }

  if (criterion.includes('适配层仍保持轻薄') && criterion.includes('Maestro 负责')) {
    return auditFilesContain(cwd, [
      'docs/architecture.md',
      'src/maestroExecution.mjs'
    ], ['项目族编排', '不 fork Maestro core', 'maestro_calls']);
  }

  if (criterion.includes('完成的交付') && criterion.includes('knowhow、spec 或 workflow recipe')) {
    return auditFilesContain(cwd, [
      'src/knowledgeLoop.mjs',
      'src/dispatch.mjs',
      'tests/knowledge-loop.test.mjs'
    ], ['capture_targets', 'knowhow', 'spec', 'workflow_recipe']);
  }

  if (criterion.includes('团队协作者') && criterion.includes('guard 状态') && criterion.includes('下一步动作')) {
    return auditFilesContain(cwd, [
      'src/knowledgeLoop.mjs',
      'src/dispatch.mjs',
      'tests/knowledge-loop.test.mjs'
    ], ['team_context', 'guard_status', 'next_actions', 'evidence']);
  }

  if (criterion.includes('闭环不需要修改 Maestro core')) {
    return auditFilesContain(cwd, [
      'docs/architecture.md',
      'src/knowledgeLoop.mjs'
    ], ['不修改 Maestro core', 'Maestro core remains unchanged']);
  }

  return {
    status: 'PENDING',
    evidence: [],
    reason: '当前没有该成功标准的自动审计规则。'
  };
}

function auditFilesContain(cwd, files, terms) {
  const evidence = [];
  const missing = [];
  let combinedText = '';

  for (const file of files) {
    const fullPath = path.join(cwd, file);
    if (!fs.existsSync(fullPath)) {
      missing.push(`${file}: missing`);
      continue;
    }

    const text = fs.readFileSync(fullPath, 'utf8');
    combinedText += `\n${text.replace(/`/g, '')}`;
    evidence.push(file);
  }

  const missingTerms = terms.filter((term) => !combinedText.includes(term));
  missing.push(...missingTerms.map((term) => `term: ${term}`));

  return {
    status: missing.length ? 'PENDING' : 'PASS',
    evidence,
    reason: missing.length
      ? `缺少可证明文本：${missing.join('; ')}`
      : '成功标准可追溯到文档或源码。'
  };
}
