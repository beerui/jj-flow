#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import {
  REQUIRED_APP_CAPABILITIES,
  REVIEW_FINDING_STATUSES,
  REVIEW_OUTCOMES,
  TARGET_DIFFERENCE_DECISIONS
} from '../src/dispatchControlPlane.mjs';
import {
  describeHostAction,
  HOST_ACCESS_PROFILES,
  HOST_ACTION_POLICIES,
  HOST_ACTION_SCHEMA_VERSION,
  HOST_ACTION_TYPES,
  RECEIPT_KINDS,
  RECEIPT_STATUSES
} from '../src/dispatchHostContract.mjs';
import { TRACE_SCHEMA_VERSION } from '../src/dispatchTrace.mjs';
import { SCENARIO_IDS, SCENARIO_REPORT_VERSION } from '../src/scenarioRunner.mjs';
import { HOST_TRIAL_REPORT_VERSION } from '../src/hostTrialRunner.mjs';
import { hashNormalizedTextFile } from '../src/fileFingerprint.mjs';

export const HARNESS_SCHEMA_VERSION = 'jj-flow/harness/1.0';
const HARNESS_GC_REPORT_VERSION = 'jj-flow/harness-gc-report/1.0';

export function checkHarnessRepository({
  cwd = process.cwd(),
  manifestPath = path.join(cwd, 'harness-manifest.json')
} = {}) {
  const findings = [];
  const stats = {
    files_checked: 0,
    links_checked: 0,
    commands_checked: 0,
    forbidden_paths_checked: 0,
    protocols_checked: 0,
    scenarios_checked: 0,
    host_trials_checked: 0,
    gc_baselines_checked: 0,
    gardeners_checked: 0,
    docs_checked: 0,
    design_docs_checked: 0,
    adr_docs_checked: 0,
    exec_plans_checked: 0,
    maturity_models_checked: 0
  };

  const addFinding = (ruleId, targetPath, reason, nextAction) => {
    findings.push({
      rule_id: ruleId,
      path: displayPath(cwd, targetPath),
      reason,
      next_action: nextAction
    });
  };

  if (!fs.existsSync(manifestPath)) {
    addFinding(
      'HNS-MANIFEST-001',
      manifestPath,
      '缺少 Harness manifest。',
      '恢复 versioned harness-manifest.json，不要用本地隐藏状态替代。'
    );
    return buildResult(findings, stats);
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    addFinding('HNS-MANIFEST-002', manifestPath, `Manifest 无法解析：${error.message}`, '修复 JSON 语法后重试。');
    return buildResult(findings, stats);
  }

  if (manifest.schema_version !== HARNESS_SCHEMA_VERSION) {
    addFinding(
      'HNS-SCHEMA-001',
      manifestPath,
      `schema_version 必须为 ${HARNESS_SCHEMA_VERSION}。`,
      '同步 manifest、schema 和检查器的协议版本。'
    );
  }

  const schemaPath = resolveRepositoryPath(cwd, manifest.$schema, addFinding, 'HNS-SCHEMA-002');
  if (schemaPath) {
    if (!fs.existsSync(schemaPath)) {
      addFinding('HNS-SCHEMA-003', schemaPath, 'Manifest 声明的 schema 不存在。', '恢复 schema 文件或修正 $schema。');
    } else {
      stats.files_checked += 1;
      try {
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
        if (schema.properties?.schema_version?.const !== HARNESS_SCHEMA_VERSION) {
          addFinding(
            'HNS-SCHEMA-004',
            schemaPath,
            'Schema 与检查器的 Harness 版本不一致。',
            '把 schema_version.const 更新为当前协议版本。'
          );
        }
      } catch (error) {
        addFinding('HNS-SCHEMA-005', schemaPath, `Schema 无法解析：${error.message}`, '修复 schema JSON。');
      }
    }
  }

  const maps = arrayOrFinding(manifest.record_system?.maps, 'record_system.maps', manifestPath, addFinding);
  const authorities = arrayOrFinding(manifest.record_system?.authorities, 'record_system.authorities', manifestPath, addFinding);
  const historicalPaths = arrayOrFinding(manifest.record_system?.historical_paths, 'record_system.historical_paths', manifestPath, addFinding);
  const forbiddenPaths = arrayOrFinding(manifest.record_system?.forbidden_paths, 'record_system.forbidden_paths', manifestPath, addFinding);

  checkUniqueEntries([...maps, ...authorities], manifestPath, addFinding);
  for (const entry of [...maps, ...authorities]) {
    const target = resolveRepositoryPath(cwd, entry?.path, addFinding, 'HNS-PATH-001');
    if (!target) continue;
    stats.files_checked += 1;
    if (!fs.existsSync(target)) {
      addFinding('HNS-RECORD-001', target, `权威资产 ${entry?.id || '(unknown)'} 不存在。`, '恢复文件或从 manifest 移除失效条目。');
    }
  }

  for (const entry of historicalPaths) {
    const target = resolveRepositoryPath(cwd, entry?.path, addFinding, 'HNS-PATH-002');
    if (!target) continue;
    stats.files_checked += 1;
    if (!fs.existsSync(target)) {
      addFinding('HNS-RECORD-002', target, 'Manifest 声明的历史资料路径不存在。', '恢复历史资料或删除该索引。');
    }
    if (!isNonEmptyString(entry?.reason)) {
      addFinding('HNS-RECORD-003', target, '历史资料必须说明为何不具权威性。', '补充非权威原因。');
    }
  }

  for (const entry of maps) {
    const target = resolveRepositoryPath(cwd, entry?.path, addFinding, 'HNS-PATH-003');
    if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) continue;
    if (!Number.isInteger(entry.max_lines) || entry.max_lines < 1) {
      addFinding('HNS-MAP-001', target, '导航地图必须声明正整数 max_lines。', '在 manifest 中补充合理的行数上限。');
      continue;
    }
    const lineCount = fs.readFileSync(target, 'utf8').split(/\r?\n/).length;
    if (lineCount > entry.max_lines) {
      addFinding(
        'HNS-MAP-002',
        target,
        `导航地图共 ${lineCount} 行，超过上限 ${entry.max_lines}。`,
        '把细节下沉到 design、ADR 或 reference 文档，只保留地图和不变量。'
      );
    }
  }

  const requiredLinks = arrayOrFinding(manifest.required_links, 'required_links', manifestPath, addFinding);
  for (const link of requiredLinks) {
    const source = resolveRepositoryPath(cwd, link?.source, addFinding, 'HNS-PATH-004');
    if (!source) continue;
    stats.links_checked += 1;
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
      addFinding('HNS-LINK-001', source, 'Required link 的源文件不存在。', '恢复源文件或修正 required_links。');
      continue;
    }
    if (!isNonEmptyString(link?.contains) || !fs.readFileSync(source, 'utf8').includes(link.contains)) {
      addFinding(
        'HNS-LINK-002',
        source,
        `缺少 required link 文本：${link?.contains || '(empty)'}`,
        '补充导航入口或修正 manifest 中的目标文本。'
      );
    }
  }

  checkDocumentationPolicy({
    cwd,
    policy: manifest.documentation_policy,
    addFinding,
    stats,
    manifestPath
  });

  const protocolContracts = arrayOrFinding(manifest.protocol_contracts, 'protocol_contracts', manifestPath, addFinding);
  checkUniqueEntries(protocolContracts, manifestPath, addFinding);
  for (const protocol of protocolContracts) {
    stats.protocols_checked += 1;
    checkDispatchProtocolContract({ cwd, protocol, addFinding, stats });
  }

  checkScenarioRegistry({
    cwd,
    config: manifest.scenarios,
    addFinding,
    stats,
    manifestPath
  });
  checkHostTrial({
    cwd,
    config: manifest.host_trial,
    addFinding,
    stats,
    manifestPath
  });
  checkHarnessGc({
    cwd,
    config: manifest.maintenance?.gc,
    addFinding,
    stats,
    manifestPath
  });
  checkGardener({
    cwd,
    config: manifest.maintenance?.gardener,
    addFinding,
    stats,
    manifestPath
  });

  const packagePath = path.join(cwd, 'package.json');
  let packageJson = null;
  try {
    packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch (error) {
    addFinding('HNS-COMMAND-001', packagePath, `package.json 无法解析：${error.message}`, '修复 package.json。');
  }

  const capabilities = arrayOrFinding(manifest.capabilities, 'capabilities', manifestPath, addFinding);
  checkUniqueEntries(capabilities, manifestPath, addFinding);
  const capabilityIds = new Set();
  for (const capability of capabilities) {
    if (isNonEmptyString(capability?.id)) capabilityIds.add(capability.id);
    stats.commands_checked += 1;
    const scriptName = parseNpmRun(capability?.command);
    if (!scriptName) {
      addFinding('HNS-COMMAND-002', manifestPath, `不支持的 capability command：${capability?.command || '(empty)'}`, '使用 npm run <script> 形式。');
    } else if (!packageJson?.scripts?.[scriptName]) {
      addFinding('HNS-COMMAND-003', packagePath, `缺少 npm script：${scriptName}`, '在 package.json scripts 中实现该 capability。');
    }
  }
  if (packageJson?.scripts?.verify && !packageJson.scripts.verify.includes('npm run harness:check')) {
    addFinding(
      'HNS-COMMAND-004',
      packagePath,
      'npm run verify 未包含 Harness 检查。',
      '把 npm run harness:check 接入 verify 主验证链。'
    );
  }
  if (packageJson?.scripts?.verify && !packageJson.scripts.verify.includes('npm run scenario:check')) {
    addFinding(
      'HNS-COMMAND-005',
      packagePath,
      'npm run verify 未包含确定性场景检查。',
      '把 npm run scenario:check 接入 verify 主验证链。'
    );
  }
  if (packageJson?.scripts?.verify && !packageJson.scripts.verify.includes('npm run host:trial')) {
    addFinding(
      'HNS-COMMAND-006',
      packagePath,
      'npm run verify 未包含半真实 Host trial。',
      '把 npm run host:trial 接入 verify 主验证链。'
    );
  }
  if (packageJson?.scripts?.verify && !packageJson.scripts.verify.includes('npm run harness:gc')) {
    addFinding(
      'HNS-COMMAND-007',
      packagePath,
      'npm run verify 未包含持续熵清理检查。',
      '把 npm run harness:gc 接入 verify 主验证链。'
    );
  }

  const invariants = arrayOrFinding(manifest.invariants, 'invariants', manifestPath, addFinding);
  checkUniqueEntries(invariants, manifestPath, addFinding);
  for (const invariant of invariants) {
    if (!isNonEmptyString(invariant?.owner)) {
      addFinding('HNS-INVARIANT-003', manifestPath, `Invariant ${invariant?.id || '(unknown)'} 缺少 owner。`, '指定稳定责任域，避免规则长期无人维护。');
    }
    if (!isNonEmptyString(invariant?.description)) {
      addFinding('HNS-INVARIANT-001', manifestPath, `Invariant ${invariant?.id || '(unknown)'} 缺少描述。`, '说明需要机械保持的边界。');
    }
    for (const enforcer of Array.isArray(invariant?.enforced_by) ? invariant.enforced_by : []) {
      if (!capabilityIds.has(enforcer) && !authorities.some((entry) => entry?.id === enforcer)) {
        addFinding('HNS-INVARIANT-002', manifestPath, `Invariant ${invariant?.id || '(unknown)'} 引用了未知 enforcer：${enforcer}`, '引用已登记的 capability 或 authority。');
      }
    }
  }

  const levels = Array.isArray(manifest.autonomy?.levels) ? manifest.autonomy.levels : [];
  const levelIds = new Set(levels.map((level) => level?.id).filter(isNonEmptyString));
  for (const field of ['default_level', 'max_unattended_level']) {
    if (!levelIds.has(manifest.autonomy?.[field])) {
      addFinding('HNS-AUTONOMY-001', manifestPath, `${field} 必须引用已登记的 autonomy level。`, '修正 autonomy 配置。');
    }
  }
  for (const level of levels) {
    if (level?.external_writes && level?.approval !== 'required') {
      addFinding('HNS-AUTONOMY-002', manifestPath, `${level.id} 允许外部写入但未要求批准。`, '把 approval 设为 required。');
    }
  }

  for (const forbiddenPath of forbiddenPaths) {
    const target = resolveRepositoryPath(cwd, forbiddenPath, addFinding, 'HNS-PATH-005');
    if (!target) continue;
    stats.forbidden_paths_checked += 1;
    if (fs.existsSync(target)) {
      addFinding(
        'HNS-STATE-001',
        target,
        '出现 manifest 禁止的本地状态路径。',
        '移除该路径，并把需要保留的事实迁移到 versioned repository 资产。'
      );
    }
  }

  return buildResult(findings, stats);
}

function checkDocumentationPolicy({ cwd, policy, addFinding, stats, manifestPath }) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    addFinding('HNS-DOC-001', manifestPath, 'documentation_policy 必须是对象。', '按 Harness schema 声明当前文档、排除路径和设计索引策略。');
    return;
  }

  const excluded = (Array.isArray(policy.excluded_paths) ? policy.excluded_paths : [])
    .map((entry) => resolveRepositoryPath(cwd, entry, addFinding, 'HNS-DOC-002'))
    .filter(Boolean);
  const documentFiles = new Set();
  for (const rootEntry of Array.isArray(policy.current_roots) ? policy.current_roots : []) {
    const root = resolveRepositoryPath(cwd, rootEntry, addFinding, 'HNS-DOC-003');
    if (!root || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
      if (root) addFinding('HNS-DOC-004', root, '当前文档根目录不存在。', '恢复文档目录或修正 documentation_policy.current_roots。');
      continue;
    }
    for (const file of listMarkdownFiles(root)) {
      if (!excluded.some((entry) => isWithin(file, entry))) documentFiles.add(file);
    }
  }
  for (const fileEntry of Array.isArray(policy.current_files) ? policy.current_files : []) {
    const file = resolveRepositoryPath(cwd, fileEntry, addFinding, 'HNS-DOC-005');
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      if (file) addFinding('HNS-DOC-006', file, '当前文档文件不存在。', '恢复文件或从 documentation_policy.current_files 移除。');
      continue;
    }
    documentFiles.add(file);
  }

  const removedEntrypoints = Array.isArray(policy.removed_entrypoints) ? policy.removed_entrypoints : [];
  const negativeMarkers = Array.isArray(policy.negative_context_markers) ? policy.negative_context_markers : [];
  const removedOutputs = Array.isArray(policy.removed_outputs) ? policy.removed_outputs : [];
  for (const file of documentFiles) {
    stats.docs_checked += 1;
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    let heading = '';
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (/^#{1,6}\s+/.test(line)) heading = line;
      for (const entrypoint of removedEntrypoints) {
        if (!line.includes(entrypoint)) continue;
        const context = `${heading}\n${line}`;
        if (!negativeMarkers.some((marker) => context.includes(marker))) {
          addFinding(
            'HNS-DOC-FRESHNESS-001',
            file,
            `第 ${index + 1} 行把已移除入口 ${entrypoint} 放在非否定语境中。`,
            '删除旧入口，或明确标记为“已移除/不再使用”，并指向当前命令。'
          );
        }
      }
    }
    for (const output of removedOutputs) {
      if (text.includes(output)) {
        addFinding('HNS-DOC-FRESHNESS-002', file, `仍链接已移除页面：${output}`, '移除旧页面链接并指向当前命令总览。');
      }
    }
  }

  const siteBuilder = resolveRepositoryPath(cwd, policy.site_builder, addFinding, 'HNS-DOC-007');
  const siteBuilderText = readTextSurface(siteBuilder, addFinding, 'HNS-DOC-008');
  checkIndexedDocumentSet({
    cwd,
    config: policy.design_docs,
    kind: 'design',
    addFinding,
    stats,
    siteBuilderText
  });
  checkIndexedDocumentSet({
    cwd,
    config: policy.adr_docs,
    kind: 'adr',
    addFinding,
    stats,
    siteBuilderText
  });
  checkExecPlanPolicy({
    cwd,
    config: policy.exec_plans,
    addFinding,
    stats,
    siteBuilderText,
    manifestPath
  });
  checkMaturityModels({
    cwd,
    models: policy.maturity_models,
    addFinding,
    stats,
    manifestPath
  });
}

function checkIndexedDocumentSet({ cwd, config, kind, addFinding, stats, siteBuilderText }) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    addFinding(`HNS-${kind.toUpperCase()}-001`, cwd, `${kind} 文档策略必须是对象。`, `在 documentation_policy 中声明 ${kind} directory 和 index。`);
    return;
  }
  const directory = resolveRepositoryPath(cwd, config.directory, addFinding, `HNS-${kind.toUpperCase()}-002`);
  const indexPath = resolveRepositoryPath(cwd, config.index, addFinding, `HNS-${kind.toUpperCase()}-003`);
  if (!directory || !indexPath || !fs.existsSync(directory) || !fs.existsSync(indexPath)) {
    if (directory && !fs.existsSync(directory)) addFinding(`HNS-${kind.toUpperCase()}-004`, directory, `${kind} 文档目录不存在。`, '恢复目录或修正 Manifest。');
    if (indexPath && !fs.existsSync(indexPath)) addFinding(`HNS-${kind.toUpperCase()}-005`, indexPath, `${kind} index 不存在。`, '创建版本化索引并登记现有文档。');
    return;
  }
  const indexText = fs.readFileSync(indexPath, 'utf8');
  const documents = listMarkdownFiles(directory).filter((file) => path.resolve(file) !== path.resolve(indexPath));
  for (const file of documents) {
    if (kind === 'design') stats.design_docs_checked += 1;
    else stats.adr_docs_checked += 1;
    const source = fs.readFileSync(file, 'utf8');
    const htmlName = `${path.basename(file, '.md')}.html`;
    if (!indexText.includes(htmlName)) {
      addFinding(`HNS-${kind.toUpperCase()}-INDEX-001`, indexPath, `${displayPath(cwd, file)} 未登记到索引。`, `在索引中添加指向 ${htmlName} 的链接。`);
    }
    const repositoryPath = displayPath(cwd, file);
    if (siteBuilderText !== null && !siteBuilderText.includes(repositoryPath)) {
      addFinding(`HNS-${kind.toUpperCase()}-BUILD-001`, file, '文档未进入站点构建清单。', `在 documentation_policy.site_builder 中登记 source: '${repositoryPath}'。`);
    }

    if (kind === 'design') {
      checkDesignStatus(source, file, config, addFinding);
    } else if (!/^## 状态\s*$/m.test(source)) {
      addFinding('HNS-ADR-STATUS-001', file, 'ADR 缺少“## 状态”章节。', '补充 Accepted、Superseded 或 Deprecated 状态。');
    }
  }
  const indexRepositoryPath = displayPath(cwd, indexPath);
  if (siteBuilderText !== null && !siteBuilderText.includes(indexRepositoryPath)) {
    addFinding(`HNS-${kind.toUpperCase()}-BUILD-002`, indexPath, '索引未进入站点构建清单。', `在 documentation_policy.site_builder 中登记 source: '${indexRepositoryPath}'。`);
  }
}

function checkDesignStatus(source, file, config, addFinding) {
  const prefix = String(config.status_prefix || '');
  const statusLine = source.split(/\r?\n/).find((line) => line.startsWith(prefix));
  if (!statusLine) {
    addFinding('HNS-DESIGN-STATUS-001', file, `设计文档缺少状态行：${prefix}`, '在标题后声明受支持的设计状态。');
    return;
  }
  const status = statusLine.slice(prefix.length).trim();
  const allowedStatuses = Array.isArray(config.allowed_statuses) ? config.allowed_statuses : [];
  if (!allowedStatuses.includes(status)) {
    addFinding('HNS-DESIGN-STATUS-002', file, `未知设计状态：${status}`, `使用：${allowedStatuses.join(', ')}`);
  }
  if (status === 'Implemented') {
    const evidencePrefix = String(config.implemented_evidence_prefix || '');
    const evidenceLine = source.split(/\r?\n/).find((line) => line.startsWith(evidencePrefix));
    const evidence = evidenceLine?.slice(evidencePrefix.length).trim() || '';
    if (!evidence || !(/`[^`]+`/.test(evidence) || /\[[^\]]+\]\([^)]+\)/.test(evidence))) {
      addFinding('HNS-DESIGN-EVIDENCE-001', file, 'Implemented 设计缺少可追溯测试或验收证据。', `补充 ${evidencePrefix}\`tests/...\` 或版本化验收产物链接。`);
    }
  }
}

function checkExecPlanPolicy({ cwd, config, addFinding, stats, siteBuilderText, manifestPath }) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    addFinding('HNS-EXEC-PLAN-001', manifestPath, 'exec plan 文档策略必须是对象。', '声明 exec plan 根目录、索引、active/completed 目录和状态。');
    return;
  }

  const paths = {};
  for (const field of ['directory', 'index', 'active_directory', 'completed_directory']) {
    paths[field] = resolveRepositoryPath(cwd, config[field], addFinding, 'HNS-EXEC-PLAN-002');
  }
  if (Object.values(paths).some((entry) => !entry)) return;

  for (const field of ['directory', 'active_directory', 'completed_directory']) {
    if (!fs.existsSync(paths[field]) || !fs.statSync(paths[field]).isDirectory()) {
      addFinding('HNS-EXEC-PLAN-003', paths[field], `${field} 目录不存在。`, '恢复版本化 exec plan 目录。');
    }
  }
  if (!fs.existsSync(paths.index) || !fs.statSync(paths.index).isFile()) {
    addFinding('HNS-EXEC-PLAN-004', paths.index, 'exec plan 索引不存在。', '创建索引并登记 active/completed 计划。');
    return;
  }
  if (Object.values(paths).some((entry) => !fs.existsSync(entry))) return;

  const indexText = fs.readFileSync(paths.index, 'utf8');
  const prefix = String(config.status_prefix || '');
  const activeStatuses = new Set(Array.isArray(config.active_statuses) ? config.active_statuses : []);
  const completedStatus = String(config.completed_status || '');
  const planSets = [
    { directory: paths.active_directory, allowed: activeStatuses, location: 'active' },
    { directory: paths.completed_directory, allowed: new Set([completedStatus]), location: 'completed' }
  ];

  for (const planSet of planSets) {
    for (const file of listMarkdownFiles(planSet.directory)) {
      stats.exec_plans_checked += 1;
      const repositoryPath = displayPath(cwd, file);
      const relativeHtml = path.relative(paths.directory, file).replaceAll('\\', '/').replace(/\.md$/i, '.html');
      if (!indexText.includes(relativeHtml)) {
        addFinding('HNS-EXEC-PLAN-INDEX-001', paths.index, `${repositoryPath} 未登记到 exec plan 索引。`, `在索引中添加指向 ${relativeHtml} 的链接。`);
      }
      if (siteBuilderText !== null && !siteBuilderText.includes(repositoryPath)) {
        addFinding('HNS-EXEC-PLAN-BUILD-001', file, 'exec plan 未进入站点构建清单。', `在 documentation_policy.site_builder 中登记 source: '${repositoryPath}'。`);
      }

      const source = fs.readFileSync(file, 'utf8');
      const statusLine = source.split(/\r?\n/).find((line) => line.startsWith(prefix));
      const status = statusLine?.slice(prefix.length).trim() || '';
      if (!statusLine) {
        addFinding('HNS-EXEC-PLAN-STATUS-001', file, `exec plan 缺少状态行：${prefix}`, '声明 active、blocked 或 completed。');
      } else if (!planSet.allowed.has(status)) {
        addFinding('HNS-EXEC-PLAN-STATUS-002', file, `${planSet.location} 目录中的状态 ${status} 无效。`, `使用：${[...planSet.allowed].join(', ')}`);
      }
    }
  }

  const indexRepositoryPath = displayPath(cwd, paths.index);
  if (siteBuilderText !== null && !siteBuilderText.includes(indexRepositoryPath)) {
    addFinding('HNS-EXEC-PLAN-BUILD-002', paths.index, 'exec plan 索引未进入站点构建清单。', `在 documentation_policy.site_builder 中登记 source: '${indexRepositoryPath}'。`);
  }
}

function checkMaturityModels({ cwd, models, addFinding, stats, manifestPath }) {
  const entries = arrayOrFinding(models, 'documentation_policy.maturity_models', manifestPath, addFinding);
  checkUniqueEntries(entries, manifestPath, addFinding);
  for (const model of entries) {
    stats.maturity_models_checked += 1;
    const target = resolveRepositoryPath(cwd, model?.path, addFinding, 'HNS-MATURITY-001');
    if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
      if (target) addFinding('HNS-MATURITY-002', target, '成熟度模型文档不存在。', '恢复文档或修正 maturity_models.path。');
      continue;
    }
    const minimum = model.minimum;
    const maximum = model.maximum;
    if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum < 0 || maximum < minimum) {
      addFinding('HNS-MATURITY-003', manifestPath, `成熟度模型 ${model?.id || '(unknown)'} 的范围无效。`, '声明满足 0 <= minimum <= maximum 的整数范围。');
      continue;
    }

    const rows = parseMarkdownScoreRows(fs.readFileSync(target, 'utf8'));
    const dimensions = Array.isArray(model.dimensions) ? model.dimensions : [];
    const seenLabels = new Set();
    for (const dimension of dimensions) {
      const label = String(dimension?.label || '').trim();
      const score = dimension?.score;
      if (!label || seenLabels.has(label)) {
        addFinding('HNS-MATURITY-004', manifestPath, `成熟度维度缺失或重复：${label || '(empty)'}`, '每个维度使用唯一非空 label。');
        continue;
      }
      seenLabels.add(label);
      if (!Number.isInteger(score) || score < minimum || score > maximum) {
        addFinding('HNS-MATURITY-SCORE-001', manifestPath, `维度 ${label} 的分数 ${score} 超出 ${minimum}-${maximum}。`, '修正 manifest 中的成熟度分数。');
        continue;
      }
      if (!rows.has(label)) {
        addFinding('HNS-MATURITY-ROW-001', target, `成熟度表缺少维度：${label}`, '补充与 manifest 一致的成熟度表行。');
      } else {
        const documentedScore = rows.get(label);
        if (documentedScore < minimum || documentedScore > maximum) {
          addFinding('HNS-MATURITY-SCORE-002', target, `维度 ${label} 的文档分数 ${documentedScore} 超出 ${minimum}-${maximum}。`, '修正文档中的成熟度分数。');
        }
        if (documentedScore !== score) {
          addFinding('HNS-MATURITY-ROW-002', target, `维度 ${label} 的文档分数 ${documentedScore} 与 manifest ${score} 不一致。`, '更新文档或 manifest，使版本化事实一致。');
        }
      }
    }
  }
}

function parseMarkdownScoreRows(source) {
  const rows = new Map();
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) continue;
    const cells = trimmed.slice(1, -1).split('|').map((cell) => cell.trim());
    if (cells.length < 2 || !/^-?\d+$/.test(cells[1])) continue;
    rows.set(cells[0].replaceAll('`', ''), Number(cells[1]));
  }
  return rows;
}

function listMarkdownFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listMarkdownFiles(target));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(target);
  }
  return files;
}

function isWithin(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function checkDispatchProtocolContract({ cwd, protocol, addFinding, stats }) {
  const paths = {};
  for (const field of ['contract', 'schema', 'runtime', 'control_plane_schema', 'receipt_schema', 'skill', 'fixture']) {
    paths[field] = resolveRepositoryPath(cwd, protocol?.[field], addFinding, 'HNS-PROTOCOL-001');
    if (paths[field]) stats.files_checked += 1;
  }

  const contract = readJsonSurface(paths.contract, addFinding, 'HNS-PROTOCOL-002');
  const contractSchema = readJsonSurface(paths.schema, addFinding, 'HNS-PROTOCOL-003');
  const controlPlaneSchema = readJsonSurface(paths.control_plane_schema, addFinding, 'HNS-PROTOCOL-004');
  const receiptSchema = readJsonSurface(paths.receipt_schema, addFinding, 'HNS-PROTOCOL-005');
  const fixture = readJsonSurface(paths.fixture, addFinding, 'HNS-PROTOCOL-006');
  const skillText = readTextSurface(paths.skill, addFinding, 'HNS-PROTOCOL-007');
  const runtimeText = readTextSurface(paths.runtime, addFinding, 'HNS-PROTOCOL-008');
  if (!contract) return;

  checkEqual(contract.schema_version, HOST_ACTION_SCHEMA_VERSION, paths.contract, 'host action schema version', addFinding);
  checkArrayParity(contract.required_app_capabilities, REQUIRED_APP_CAPABILITIES, paths.contract, 'required app capabilities', addFinding);
  checkArrayParity(contract.action_types, HOST_ACTION_TYPES, paths.contract, 'host action types', addFinding);
  checkArrayParity(contract.receipt_contract?.kinds, RECEIPT_KINDS, paths.contract, 'receipt kinds', addFinding);
  checkArrayParity(contract.receipt_contract?.statuses, RECEIPT_STATUSES, paths.contract, 'receipt statuses', addFinding);
  checkArrayParity(contract.receipt_contract?.review_outcomes, REVIEW_OUTCOMES, paths.contract, 'review outcomes', addFinding);
  checkArrayParity(
    contract.control_plane_contract?.target_difference_decisions,
    TARGET_DIFFERENCE_DECISIONS,
    paths.contract,
    'target difference decisions',
    addFinding
  );
  checkArrayParity(
    contract.control_plane_contract?.review_finding_statuses,
    REVIEW_FINDING_STATUSES,
    paths.contract,
    'review finding statuses',
    addFinding
  );

  checkEqual(contract.access_profiles, HOST_ACCESS_PROFILES, paths.contract, 'host access profiles', addFinding);
  const contractPolicies = Object.fromEntries((contract.actions || []).map((item) => [item.type, {
    mode: item.mode,
    required_capabilities: item.required_capabilities,
    write_access_capabilities: item.write_access_capabilities
  }]));
  checkEqual(contractPolicies, HOST_ACTION_POLICIES, paths.contract, 'host action policies', addFinding);

  if (contractSchema) {
    checkEqual(contractSchema.properties?.schema_version?.const, HOST_ACTION_SCHEMA_VERSION, paths.schema, 'contract schema version', addFinding);
    checkArrayParity(contractSchema.properties?.action_types?.items?.enum, HOST_ACTION_TYPES, paths.schema, 'contract schema action types', addFinding);
    checkArrayParity(contractSchema.properties?.receipt_contract?.properties?.kinds?.items?.enum, RECEIPT_KINDS, paths.schema, 'contract schema receipt kinds', addFinding);
    checkArrayParity(contractSchema.properties?.receipt_contract?.properties?.statuses?.items?.enum, RECEIPT_STATUSES, paths.schema, 'contract schema receipt statuses', addFinding);
    checkArrayParity(contractSchema.properties?.receipt_contract?.properties?.review_outcomes?.items?.enum, REVIEW_OUTCOMES, paths.schema, 'contract schema review outcomes', addFinding);
    checkArrayParity(contractSchema.properties?.control_plane_contract?.properties?.target_difference_decisions?.items?.enum, TARGET_DIFFERENCE_DECISIONS, paths.schema, 'contract schema target decisions', addFinding);
    checkArrayParity(contractSchema.properties?.control_plane_contract?.properties?.review_finding_statuses?.items?.enum, REVIEW_FINDING_STATUSES, paths.schema, 'contract schema review finding statuses', addFinding);
  }

  if (controlPlaneSchema) {
    checkArrayParity(controlPlaneSchema.$defs?.target_analysis?.properties?.decision?.enum, TARGET_DIFFERENCE_DECISIONS, paths.control_plane_schema, 'control-plane target decisions', addFinding);
    checkArrayParity(controlPlaneSchema.$defs?.review_finding?.properties?.status?.enum, REVIEW_FINDING_STATUSES, paths.control_plane_schema, 'control-plane review finding statuses', addFinding);
    checkArrayParity(controlPlaneSchema.$defs?.review?.properties?.outcome?.enum, REVIEW_OUTCOMES, paths.control_plane_schema, 'control-plane review outcomes', addFinding);
  }

  if (receiptSchema) {
    checkArrayParity(receiptSchema.properties?.kind?.enum, RECEIPT_KINDS, paths.receipt_schema, 'receipt schema kinds', addFinding);
    checkArrayParity(receiptSchema.properties?.status?.enum, RECEIPT_STATUSES, paths.receipt_schema, 'receipt schema statuses', addFinding);
    checkArrayParity(receiptSchema.properties?.outcome?.enum, REVIEW_OUTCOMES, paths.receipt_schema, 'receipt schema review outcomes', addFinding);
  }

  if (skillText !== null) {
    const requiredTokens = [path.basename(protocol.contract), ...HOST_ACTION_TYPES, ...REQUIRED_APP_CAPABILITIES];
    for (const token of requiredTokens) {
      if (!skillText.includes(token)) {
        addFinding(
          'HNS-SKILL-PARITY-001',
          paths.skill,
          `Skill contract 缺少协议 token：${token}`,
          '引用结构化 host action contract，并同步 host action 与 capability 名称。'
        );
      }
    }
  }

  if (runtimeText !== null) {
    for (const token of ['HOST_ACTION_TYPES', 'RECEIPT_KINDS', 'RECEIPT_STATUSES', 'describeHostAction']) {
      if (!runtimeText.includes(token)) {
        addFinding('HNS-RUNTIME-PARITY-001', paths.runtime, `Runtime contract 缺少 export：${token}`, '从 dispatchHostContract 导出并消费统一协议常量。');
      }
    }
  }

  if (fixture) checkHostActionFixture(fixture, paths.fixture, addFinding);
}

function checkScenarioRegistry({ cwd, config, addFinding, stats, manifestPath }) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    addFinding('HNS-SCENARIO-001', manifestPath, 'scenarios 必须是对象。', '按 Harness schema 登记 scenario runtime、schemas、fixture、test 和 entries。');
    return;
  }

  const paths = {};
  for (const field of ['runner', 'trace_runtime', 'handoff_runtime', 'report_schema', 'trace_schema', 'fixture', 'test']) {
    paths[field] = resolveRepositoryPath(cwd, config[field], addFinding, 'HNS-SCENARIO-002');
    if (!paths[field]) continue;
    if (!fs.existsSync(paths[field])) {
      addFinding('HNS-SCENARIO-003', paths[field], `Scenario ${field} 文件不存在。`, '恢复 manifest 声明的场景协议文件。');
    } else {
      stats.files_checked += 1;
    }
  }

  const entries = arrayOrFinding(config.entries, 'scenarios.entries', manifestPath, addFinding);
  checkUniqueEntries(entries, manifestPath, addFinding);
  stats.scenarios_checked = entries.length;
  const manifestIds = entries.map((entry) => entry?.id).filter(isNonEmptyString);
  checkArrayParity(manifestIds, SCENARIO_IDS, manifestPath, 'scenario registry ids', addFinding);

  for (const entry of entries) {
    const expectedCommand = `node bin/jj.mjs scenario run ${entry?.id} --json`;
    if (entry?.command !== expectedCommand) {
      addFinding('HNS-SCENARIO-004', manifestPath, `Scenario ${entry?.id || '(unknown)'} command 与 CLI 不一致。`, `使用：${expectedCommand}`);
    }
    if (entry?.expected_status !== 'PASS') {
      addFinding('HNS-SCENARIO-005', manifestPath, `Scenario ${entry?.id || '(unknown)'} 的 expected_status 必须为 PASS。`, '修复场景后再把它登记为 Harness 验收能力。');
    }
    if (entry?.isolated !== true || entry?.side_effects !== 'none') {
      addFinding('HNS-SCENARIO-006', manifestPath, `Scenario ${entry?.id || '(unknown)'} 必须隔离且无外部副作用。`, '使用固定 fixture 和纯状态转换，不执行 host actions。');
    }
  }

  const reportSchema = readJsonSurface(paths.report_schema, addFinding, 'HNS-SCENARIO-007');
  if (reportSchema) {
    checkEqual(reportSchema.$defs?.report?.properties?.schema_version?.const, SCENARIO_REPORT_VERSION, paths.report_schema, 'scenario report schema version', addFinding);
  }
  const traceSchema = readJsonSurface(paths.trace_schema, addFinding, 'HNS-SCENARIO-008');
  if (traceSchema) {
    checkEqual(traceSchema.properties?.schema_version?.const, TRACE_SCHEMA_VERSION, paths.trace_schema, 'trace schema version', addFinding);
  }
}

function checkHostTrial({ cwd, config, addFinding, stats, manifestPath }) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    addFinding('HNS-HOST-TRIAL-001', manifestPath, 'host_trial 必须是对象。', '按 Harness schema 登记 runner、schema、版本化证据和 test。');
    return;
  }
  stats.host_trials_checked += 1;
  const paths = {};
  for (const field of ['runner', 'report_schema', 'evidence', 'test']) {
    paths[field] = resolveRepositoryPath(cwd, config[field], addFinding, 'HNS-HOST-TRIAL-002');
    if (!paths[field]) continue;
    if (!fs.existsSync(paths[field])) {
      addFinding('HNS-HOST-TRIAL-003', paths[field], `Host trial ${field} 文件不存在。`, '恢复 manifest 声明的 H4/M7 资产。');
    } else {
      stats.files_checked += 1;
    }
  }
  if (config.command !== 'node bin/jj.mjs host-trial run --json'
    || config.expected_status !== 'PASS'
    || config.mode !== 'semi-real'
    || config.side_effects !== 'temporary-git-only') {
    addFinding('HNS-HOST-TRIAL-004', manifestPath, 'Host trial 命令、状态、模式或副作用策略不符合 H4 契约。', '使用半真实临时 Git trial，并要求 PASS 和 temporary-git-only。');
  }

  const schema = readJsonSurface(paths.report_schema, addFinding, 'HNS-HOST-TRIAL-005');
  if (schema) {
    checkEqual(schema.properties?.schema_version?.const, HOST_TRIAL_REPORT_VERSION, paths.report_schema, 'host trial report schema version', addFinding);
  }
  const evidence = readJsonSurface(paths.evidence, addFinding, 'HNS-HOST-TRIAL-006');
  if (!evidence) return;
  const expectedRunnerHash = paths.runner && fs.existsSync(paths.runner)
    ? hashNormalizedTextFile(paths.runner)
    : null;
  if (evidence.schema_version !== HOST_TRIAL_REPORT_VERSION
    || evidence.status !== 'PASS'
    || evidence.mode !== 'semi-real'
    || evidence.side_effects !== 'temporary-git-only') {
    addFinding('HNS-HOST-TRIAL-007', paths.evidence, '版本化 Host trial evidence 的版本或验收状态无效。', '重新运行 host trial，并只在完整 PASS 后更新证据。');
  }
  if (!expectedRunnerHash || evidence.runner_sha256 !== expectedRunnerHash) {
    addFinding('HNS-HOST-TRIAL-008', paths.evidence, '版本化 Host trial evidence 与当前 runner 不匹配。', '重新运行 npm run host:trial，并审查后更新版本化证据。');
  }
  if (evidence.host?.codex_app_threads !== false
    || evidence.host?.real_git !== true
    || evidence.host?.real_worktree !== true
    || evidence.recovery?.resume_action !== 'RECONCILE_THREAD'
    || evidence.recovery?.duplicate_create_count !== 0
    || !sameJson(evidence.review_loop?.outcomes, ['NEEDS_CHANGES', 'PASS'])
    || evidence.cleanup?.status !== 'PASS') {
    addFinding('HNS-HOST-TRIAL-009', paths.evidence, 'Host trial evidence 未证明 Git/worktree、恢复、返工或清理闭环。', '完成 A2/A3 半真实试跑并保留结构化证明。');
  }
  if (!Number.isInteger(evidence.attention?.approval_points) || evidence.attention.approval_points < 2) {
    addFinding('HNS-HOST-TRIAL-010', paths.evidence, 'Host trial 未记录初次批准与返工重批两个 attention point。', '记录 approval points、异常升级和未决决策。');
  }
}

function checkHarnessGc({ cwd, config, addFinding, stats, manifestPath }) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    addFinding('HNS-GC-001', manifestPath, 'maintenance.gc 必须是对象。', '登记只读 runner、report schema、版本化 baseline 和 test。');
    return;
  }
  stats.gc_baselines_checked += 1;
  const paths = {};
  for (const field of ['runner', 'report_schema', 'baseline', 'test']) {
    paths[field] = resolveRepositoryPath(cwd, config[field], addFinding, 'HNS-GC-002');
    if (!paths[field]) continue;
    if (!fs.existsSync(paths[field])) {
      addFinding('HNS-GC-003', paths[field], `Harness GC ${field} 文件不存在。`, '恢复 manifest 声明的 H5 资产。');
    } else {
      stats.files_checked += 1;
    }
  }

  if (config.command !== 'node bin/jj.mjs harness-gc --json'
    || config.expected_status !== 'PASS'
    || !Number.isInteger(config.minimum_score)
    || config.minimum_score < 95
    || config.read_only !== true
    || config.auto_fix !== false) {
    addFinding('HNS-GC-004', manifestPath, 'Harness GC 命令、阈值或只读策略不符合 H5 契约。', '要求 PASS、minimum_score >= 95、read_only=true 且 auto_fix=false。');
  }

  const schema = readJsonSurface(paths.report_schema, addFinding, 'HNS-GC-005');
  if (schema) {
    checkEqual(schema.properties?.schema_version?.const, HARNESS_GC_REPORT_VERSION, paths.report_schema, 'Harness GC report schema version', addFinding);
  }

  const baseline = readJsonSurface(paths.baseline, addFinding, 'HNS-GC-006');
  if (!baseline) return;
  const expectedRunnerHash = paths.runner && fs.existsSync(paths.runner)
    ? hashNormalizedTextFile(paths.runner)
    : null;
  if (baseline.schema_version !== HARNESS_GC_REPORT_VERSION
    || baseline.status !== 'PASS'
    || baseline.read_only !== true
    || baseline.auto_fix !== false
    || !Number.isInteger(baseline.score)
    || baseline.score < config.minimum_score) {
    addFinding('HNS-GC-007', paths.baseline, '版本化 GC baseline 的版本、状态、分数或只读策略无效。', '重新运行 harness-gc，并只在达到阈值且 PASS 后更新 baseline。');
  }
  if (expectedRunnerHash && baseline.runner_sha256 !== expectedRunnerHash) {
    addFinding('HNS-GC-008', paths.baseline, 'GC baseline 与当前 runner fingerprint 不一致。', '重新运行 node bin/jj.mjs harness-gc --json 并更新版本化 baseline。');
  }
}

function checkGardener({ cwd, config, addFinding, stats, manifestPath }) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    addFinding('HNS-GARDENER-001', manifestPath, 'maintenance.gardener 必须是对象。', '登记定时只读工作流、报告 artifact 和阻断 issue 策略。');
    return;
  }
  stats.gardeners_checked += 1;
  const workflow = resolveRepositoryPath(cwd, config.workflow, addFinding, 'HNS-GARDENER-002');
  if (!workflow || !fs.existsSync(workflow) || !fs.statSync(workflow).isFile()) {
    if (workflow) addFinding('HNS-GARDENER-003', workflow, 'Gardener workflow 不存在。', '恢复定时只读 Harness GC 工作流。');
    return;
  }
  stats.files_checked += 1;

  if (config.command !== 'node bin/jj.mjs harness-gc --json'
    || !isNonEmptyString(config.schedule)
    || config.artifact !== 'harness-gc-report'
    || config.permissions?.contents !== 'read'
    || config.permissions?.issues !== 'write'
    || Object.keys(config.permissions || {}).length !== 2
    || config.issue_on_blocking !== true
    || config.auto_fix !== false) {
    addFinding('HNS-GARDENER-004', manifestPath, 'Gardener 命令、schedule、artifact、权限或只读策略无效。', '要求定时运行 Harness GC、上传固定 artifact、仅授予 contents: read 和 issues: write，且 auto_fix=false。');
  }

  const source = fs.readFileSync(workflow, 'utf8');
  const requiredFragments = [
    config.schedule,
    config.command,
    `name: ${config.artifact}`,
    'actions/upload-artifact@',
    'actions/github-script@'
  ];
  for (const fragment of requiredFragments) {
    if (!source.includes(fragment)) {
      addFinding('HNS-GARDENER-005', workflow, `Gardener workflow 缺少契约片段：${fragment}`, '同步 workflow 与 maintenance.gardener 契约。');
    }
  }
  const workflowPermissions = parseWorkflowPermissions(source);
  const expectedPermissions = config.permissions || {};
  if (!workflowPermissions
    || Object.keys(workflowPermissions).length !== Object.keys(expectedPermissions).length
    || Object.entries(expectedPermissions).some(([name, access]) => workflowPermissions[name] !== access)) {
    addFinding('HNS-GARDENER-006', workflow, 'Gardener workflow 权限超出或偏离 manifest allowlist。', '顶层 permissions 只能声明 contents: read 和 issues: write，且禁止 job 级权限覆盖。');
  }
}

function parseWorkflowPermissions(source) {
  const lines = source.split(/\r?\n/);
  const declarations = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)permissions\s*:\s*(.*?)\s*$/);
    if (match) declarations.push({ index, indent: match[1].length, value: match[2] });
  }
  if (declarations.length !== 1 || declarations[0].indent !== 0 || declarations[0].value) return null;

  const permissions = {};
  for (let index = declarations[0].index + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) break;
    const entry = line.match(/^ {2}([A-Za-z][A-Za-z0-9-]*):\s*(read|write|none)\s*(?:#.*)?$/);
    if (!entry || Object.hasOwn(permissions, entry[1])) return null;
    permissions[entry[1]] = entry[2];
  }
  return permissions;
}

function checkHostActionFixture(fixture, fixturePath, addFinding) {
  checkEqual(fixture.schema_version, HOST_ACTION_SCHEMA_VERSION, fixturePath, 'fixture schema version', addFinding);
  const actions = Array.isArray(fixture.actions) ? fixture.actions : [];
  const covered = new Set(actions.map((action) => `${action.type}:${action.access}`));
  for (const type of HOST_ACTION_TYPES) {
    for (const access of Object.keys(HOST_ACCESS_PROFILES)) {
      if (!covered.has(`${type}:${access}`)) {
        addFinding('HNS-FIXTURE-PARITY-001', fixturePath, `Fixture 未覆盖 ${type}:${access}。`, '为每种 host action 和 access profile 添加固定样例。');
      }
    }
  }
  for (const action of actions) {
    if (!HOST_ACTION_TYPES.includes(action.type) || !HOST_ACCESS_PROFILES[action.access]) {
      addFinding('HNS-FIXTURE-PARITY-002', fixturePath, `Fixture 包含未知 host action：${action.type}:${action.access}`, '删除未知样例或先更新结构化 contract。');
      continue;
    }
    const expected = describeHostAction(action.type, action.access);
    const actual = Object.fromEntries(Object.keys(expected).map((field) => [field, action[field]]));
    if (!sameJson(actual, expected)) {
      addFinding('HNS-FIXTURE-PARITY-003', fixturePath, `${action.type}:${action.access} 与 runtime policy 不一致。`, '按 runtime contract 更新 fixture 的 capability、sandbox 和 worktree policy。');
    }
    if (action.access === 'read' && action.worktree !== null) {
      addFinding('HNS-HOST-ACTION-001', fixturePath, '只读 host action 不得携带 worktree。', '把 read action 的 worktree 设为 null。');
    }
  }
}

function checkArrayParity(actual, expected, targetPath, label, addFinding) {
  if (!sameJson(actual, [...expected])) {
    addFinding('HNS-PROTOCOL-PARITY-001', targetPath, `${label} 与 runtime 不一致。`, `同步为：${JSON.stringify([...expected])}`);
  }
}

function checkEqual(actual, expected, targetPath, label, addFinding) {
  if (!sameJson(actual, expected)) {
    addFinding('HNS-PROTOCOL-PARITY-002', targetPath, `${label} 与 runtime 不一致。`, '同步结构化 contract、schema、runtime 和 fixtures。');
  }
}

function readJsonSurface(file, addFinding, ruleId) {
  if (!file || !fs.existsSync(file)) {
    if (file) addFinding(ruleId, file, '协议文件不存在。', '恢复 manifest 声明的协议文件。');
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    addFinding(ruleId, file, `协议 JSON 无法解析：${error.message}`, '修复 JSON 语法后重试。');
    return null;
  }
}

function readTextSurface(file, addFinding, ruleId) {
  if (!file || !fs.existsSync(file)) {
    if (file) addFinding(ruleId, file, '协议文件不存在。', '恢复 manifest 声明的协议文件。');
    return null;
  }
  return fs.readFileSync(file, 'utf8');
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildResult(findings, stats) {
  return {
    ok: findings.length === 0,
    status: findings.length === 0 ? 'PASS' : 'FAIL',
    findings,
    stats
  };
}

function arrayOrFinding(value, field, manifestPath, addFinding) {
  if (Array.isArray(value)) return value;
  addFinding('HNS-MANIFEST-003', manifestPath, `${field} 必须是数组。`, '按 schema 修复 manifest。');
  return [];
}

function checkUniqueEntries(entries, manifestPath, addFinding) {
  const ids = new Set();
  for (const entry of entries) {
    if (!isNonEmptyString(entry?.id)) {
      addFinding('HNS-MANIFEST-004', manifestPath, 'Manifest entry 缺少 id。', '为每个 entry 添加稳定 id。');
      continue;
    }
    if (ids.has(entry.id)) {
      addFinding('HNS-MANIFEST-005', manifestPath, `重复 id：${entry.id}`, '为 entry 使用唯一 id。');
    }
    ids.add(entry.id);
  }
}

function resolveRepositoryPath(cwd, value, addFinding, ruleId) {
  if (!isNonEmptyString(value)) {
    addFinding(ruleId, cwd, '仓库路径不能为空。', '在 manifest 中填写相对仓库路径。');
    return null;
  }
  if (path.isAbsolute(value) || value.split(/[\\/]/).includes('..')) {
    addFinding(ruleId, value, '只允许不包含 .. 的仓库相对路径。', '把路径改为仓库内相对路径。');
    return null;
  }
  return path.join(cwd, value);
}

function parseNpmRun(command) {
  const match = /^npm run ([a-z0-9:_-]+)$/.exec(String(command || ''));
  return match?.[1] || null;
}

function displayPath(cwd, targetPath) {
  if (!targetPath) return '.';
  const absolute = path.resolve(targetPath);
  const relative = path.relative(cwd, absolute);
  return relative && !relative.startsWith('..') ? relative.replaceAll('\\', '/') : String(targetPath).replaceAll('\\', '/');
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function renderText(result) {
  if (result.ok) {
    return `harness check passed (${result.stats.files_checked} files, ${result.stats.links_checked} links, ${result.stats.commands_checked} commands, ${result.stats.protocols_checked} protocols, ${result.stats.scenarios_checked} scenarios, ${result.stats.host_trials_checked} host trials, ${result.stats.gc_baselines_checked} GC baselines, ${result.stats.docs_checked} docs)\n`;
  }
  const lines = ['harness check failed'];
  for (const finding of result.findings) {
    lines.push(`- [${finding.rule_id}] ${finding.path}: ${finding.reason}`);
    lines.push(`  next: ${finding.next_action}`);
  }
  return `${lines.join('\n')}\n`;
}

const isDirect = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirect) {
  const result = checkHarnessRepository();
  if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else process.stdout.write(renderText(result));
  if (!result.ok) process.exitCode = 1;
}
