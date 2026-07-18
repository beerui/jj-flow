import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { checkHarnessRepository } from '../scripts/check-harness.mjs';
import { HOST_ACTION_TYPES } from './dispatchHostContract.mjs';

export const HARNESS_GC_REPORT_VERSION = 'jj-flow/harness-gc-report/1.0';

const SEVERITY_ORDER = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3 });

export function runHarnessGc({ cwd = process.cwd(), harnessCheck = checkHarnessRepository } = {}) {
  const findings = [];
  const add = (ruleId, severity, targetPath, reason, evidence, nextAction) => findings.push({
    rule_id: ruleId,
    severity,
    path: displayPath(cwd, targetPath),
    reason,
    evidence,
    next_action: nextAction,
    auto_fix_eligible: false
  });

  const manifestPath = path.join(cwd, 'harness-manifest.json');
  const manifest = readJson(manifestPath) || {};
  const harness = harnessCheck({ cwd, manifestPath });
  for (const finding of harness.findings || []) {
    add(
      `GC-${finding.rule_id}`,
      'P1',
      finding.path,
      finding.reason,
      { source: 'harness-check' },
      finding.next_action
    );
  }

  const builderPath = path.join(cwd, manifest.documentation_policy?.site_builder || 'scripts/build-docs.mjs');
  const builderText = readText(builderPath);
  const excluded = (manifest.documentation_policy?.excluded_paths || []).map((item) => normalize(item));
  const currentDocs = listFiles(path.join(cwd, 'docs'), (file) => file.endsWith('.md'))
    .map((file) => relative(cwd, file))
    .filter((file) => !excluded.some((entry) => file === entry || file.startsWith(`${entry}/`)));
  const orphanDocs = currentDocs.filter((file) => !builderText.includes(`source: '${file}'`));
  for (const file of orphanDocs) {
    add('GC-DOC-ORPHAN-001', 'P1', file, '当前文档未进入文档站构建清单。', { builder: relative(cwd, builderPath) }, '把文档加入站点导航，或将历史目录明确加入 excluded_paths。');
  }

  const schemaFiles = listFiles(path.join(cwd, 'schemas'), (file) => file.endsWith('.json'));
  const manifestText = readText(manifestPath);
  const unregisteredSchemas = schemaFiles.filter((file) => !manifestText.includes(relative(cwd, file)));
  for (const file of unregisteredSchemas) {
    add('GC-SCHEMA-ORPHAN-001', 'P1', file, 'Schema 未被 Harness manifest 登记。', {}, '登记 schema 的 authority 或消费契约，并补机械 parity 检查。');
  }

  const hostFixturePath = path.join(cwd, 'tests/fixtures/dispatch-host-actions.json');
  const hostFixture = readJson(hostFixturePath);
  const coveredHostActions = new Set((hostFixture?.actions || []).map((item) => item.type));
  const uncoveredHostActions = HOST_ACTION_TYPES.filter((type) => !coveredHostActions.has(type));
  for (const type of uncoveredHostActions) {
    add('GC-HOST-ACTION-UNUSED-001', 'P1', hostFixturePath, `Host action ${type} 缺少固定 fixture。`, { action_type: type }, '补 read/write fixture 和 runtime regression test。');
  }

  const invariantIds = new Set();
  const descriptions = new Map();
  for (const invariant of manifest.invariants || []) {
    if (!invariant.owner) {
      add('GC-INVARIANT-OWNER-001', 'P2', manifestPath, `Invariant ${invariant.id || '(unknown)'} 缺少 owner。`, {}, '指定稳定责任域，避免规则长期无人维护。');
    }
    if (invariantIds.has(invariant.id)) {
      add('GC-INVARIANT-DUPLICATE-001', 'P1', manifestPath, `Invariant id 重复：${invariant.id}`, {}, '合并重复规则或为不同边界使用唯一 id。');
    }
    invariantIds.add(invariant.id);
    const normalizedDescription = String(invariant.description || '').trim().replaceAll(/\s+/g, ' ');
    if (normalizedDescription && descriptions.has(normalizedDescription)) {
      add('GC-INVARIANT-DUPLICATE-002', 'P2', manifestPath, `Invariant ${invariant.id} 与 ${descriptions.get(normalizedDescription)} 描述重复。`, {}, '合并规则并保留一个权威 enforcer 集合。');
    } else if (normalizedDescription) {
      descriptions.set(normalizedDescription, invariant.id);
    }
  }

  const activePlansDir = path.join(cwd, 'docs/exec-plans/active');
  const activePlans = listFiles(activePlansDir, (file) => file.endsWith('.md'));
  let staleActivePlans = 0;
  for (const file of activePlans) {
    const text = readText(file);
    if (/^>\s*状态：\s*(completed|已完成)\s*$/im.test(text)) {
      staleActivePlans += 1;
      add('GC-EXEC-PLAN-STALE-001', 'P2', file, '已完成 exec plan 仍位于 active 目录。', {}, '移动到 docs/exec-plans/completed，并更新索引。');
    }
  }

  const codeFiles = [
    ...listFiles(path.join(cwd, 'src'), (file) => file.endsWith('.mjs')),
    ...listFiles(path.join(cwd, 'scripts'), (file) => file.endsWith('.mjs'))
  ];
  const helperDefinitions = collectHelperDefinitions(cwd, codeFiles);
  const repeatedHelpers = [...helperDefinitions.entries()]
    .filter(([, definitions]) => definitions.length >= 3)
    .sort(([left], [right]) => left.localeCompare(right));
  for (const [name, definitions] of repeatedHelpers) {
    add(
      'GC-REPEATED-HELPER-001',
      'P3',
      definitions[0].file,
      `局部 helper ${name} 在 ${definitions.length} 个位置重复定义。`,
      { helper: name, definitions },
      '仅在能减少真实维护成本时提取共享 helper；保持独立更清晰时记录为接受的局部重复。'
    );
  }

  findings.sort((left, right) => SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]
    || left.path.localeCompare(right.path)
    || left.rule_id.localeCompare(right.rule_id));

  const categories = [
    category('record-integrity', 30, count(findings, (item) => item.evidence?.source === 'harness-check') * 10),
    category('documentation-coverage', 20, orphanDocs.length * 5),
    category('protocol-coverage', 20, (unregisteredSchemas.length + uncoveredHostActions.length) * 5),
    category('rule-health', 15, count(findings, (item) => item.rule_id.startsWith('GC-INVARIANT-')) * 3),
    category('maintenance-hygiene', 15, staleActivePlans * 3 + repeatedHelpers.length)
  ];
  const score = categories.reduce((total, item) => total + item.score, 0);
  const blocking = findings.filter((item) => ['P0', 'P1'].includes(item.severity));
  const stableSurface = {
    score,
    categories,
    findings,
    scanned: {
      current_docs: currentDocs.length,
      schemas: schemaFiles.length,
      invariants: (manifest.invariants || []).length,
      active_exec_plans: activePlans.length,
      code_files: codeFiles.length,
      host_action_types: HOST_ACTION_TYPES.length
    }
  };
  return {
    schema_version: HARNESS_GC_REPORT_VERSION,
    scan_id: semanticHash(stableSurface),
    status: blocking.length ? 'FAIL' : 'PASS',
    score,
    grade: grade(score),
    read_only: true,
    auto_fix: false,
    runner_sha256: runnerHash(),
    ...stableSurface,
    summary: blocking.length
      ? `${blocking.length} 个阻断漂移需要处理。`
      : findings.length
        ? `无阻断漂移；${findings.length} 个低优先级维护候选。`
        : '未发现 Harness 漂移或维护候选。'
  };
}

export function renderHarnessGcText(report) {
  const lines = [
    `harness gc: ${report.status}`,
    `quality score: ${report.score}/100 (${report.grade})`,
    `read only: ${report.read_only}`
  ];
  for (const finding of report.findings || []) {
    lines.push(`- [${finding.severity}] ${finding.rule_id} ${finding.path}: ${finding.reason}`);
    lines.push(`  next: ${finding.next_action}`);
  }
  return `${lines.join('\n')}\n`;
}

function collectHelperDefinitions(cwd, files) {
  const result = new Map();
  const pattern = /^function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
  for (const file of files) {
    const text = readText(file);
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1];
      const line = text.slice(0, match.index).split('\n').length;
      const definitions = result.get(name) || [];
      definitions.push({ file: relative(cwd, file), line });
      result.set(name, definitions);
    }
  }
  return result;
}

function listFiles(directory, predicate) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile() && predicate(target)) files.push(target);
    }
  };
  visit(directory);
  return files.sort();
}

function category(id, maximum, deduction) {
  return { id, score: Math.max(0, maximum - deduction), maximum };
}

function count(items, predicate) {
  return items.filter(predicate).length;
}

function grade(score) {
  if (score >= 95) return 'A';
  if (score >= 85) return 'B';
  if (score >= 70) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

function semanticHash(value) {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function runnerHash() {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex')}`;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function displayPath(cwd, targetPath) {
  if (!targetPath) return '.';
  if (!path.isAbsolute(targetPath)) return normalize(targetPath);
  return relative(cwd, targetPath);
}

function relative(cwd, file) {
  return normalize(path.relative(cwd, file));
}

function normalize(value) {
  return String(value).replaceAll('\\', '/');
}
