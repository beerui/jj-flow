import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { checkHarnessRepository } from '../scripts/check-harness.mjs';
import { grokSkillInstalled, inspectGrokWave2Milestone } from './grokHostAdapter.mjs';
import { describePathConfig } from './namingConfig.mjs';
import { findProjectByCwd, parseProjectMap } from './projectMap.mjs';

export const DOCTOR_SCHEMA_VERSION = 'jj-flow/doctor/1.0';

const EMPTY_HARNESS_STATS = {
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
  maturity_models_checked: 0,
  skill_inventory_checked: 0
};

export function inspectHarnessRepository({ cwd = process.cwd(), runCommand = spawnSync } = {}) {
  const root = path.resolve(cwd);
  const manifestPath = path.join(root, 'harness-manifest.json');
  const isHarnessRepo = fs.existsSync(manifestPath);
  const pathConfig = describePathConfig();
  const git = inspectGit(root, runCommand);
  const hostCapabilities = ['git', 'codex', 'claude', 'grok'].map((command) => ({
    id: command,
    available: command === 'git' ? git.available : commandAvailable(command, runCommand)
  }));
  const grokSkill = grokSkillInstalled({ cwd: root, homedir: os.homedir() });
  const wave2 = inspectGrokWave2Milestone({ cwd: root });
  const packageJson = readJson(path.join(root, 'package.json'));

  if (!isHarnessRepo) {
    const pathsReady = Boolean(
      pathConfig?.control_root
      && pathConfig?.knowledge_root
      && pathConfig?.project_map
    );
    const findings = [];
    if (!pathsReady) {
      findings.push({
        rule_id: 'HNS-PATHS-001',
        path: pathConfig?.naming_config_path || '~/.jj-flow',
        reason: '未能解析 control_root / knowledge_root / project_map。',
        next_action: '运行 jj home init 或 jj install-skill，生成 ~/.jj-flow 空结构。'
      });
    }
    return withUserView({
      schema_version: DOCTOR_SCHEMA_VERSION,
      ok: pathsReady,
      status: pathsReady ? 'READY' : 'BLOCKED',
      mode: 'paths',
      repository: {
        root,
        package: packageJson?.name || null,
        version: packageJson?.version || null,
        git
      },
      harness: {
        status: 'SKIPPED',
        stats: { ...EMPTY_HARNESS_STATS }
      },
      paths: pathConfig,
      capabilities: [],
      host_capabilities: hostCapabilities,
      grok: {
        executable: hostCapabilities.find((item) => item.id === 'grok')?.available === true,
        skill_installed: grokSkill.installed,
        skill_paths: grokSkill.paths,
        wave2_closed: wave2.closed === true,
        wave2_status: wave2.status
      },
      autonomy: {
        declared_default: null,
        max_unattended: null,
        available_level: 'A0',
        external_writes_require_approval: true,
        grok_does_not_raise_level: true
      },
      findings,
      next_actions: unique(findings.map((finding) => finding.next_action).filter(Boolean))
    });
  }

  const harness = checkHarnessRepository({ cwd: root });
  const manifest = readJson(manifestPath);
  const findings = [...harness.findings];
  if (!git.available) {
    findings.push({
      rule_id: 'HNS-GIT-001',
      path: '.',
      reason: '无法确认当前目录属于 Git 仓库。',
      next_action: '从 jj-flow 的 Git working tree 运行 doctor，并确认 git 可执行文件在 PATH 中。'
    });
  }

  const ready = harness.ok && git.available;
  const declaredDefault = manifest?.autonomy?.default_level || null;
  const maxUnattended = manifest?.autonomy?.max_unattended_level || null;
  const availableLevel = ready ? maxUnattended : 'A0';
  const nextActions = unique(findings.map((finding) => finding.next_action).filter(Boolean));

  return withUserView({
    schema_version: DOCTOR_SCHEMA_VERSION,
    ok: ready,
    status: ready ? 'READY' : 'BLOCKED',
    mode: 'harness',
    repository: {
      root,
      package: packageJson?.name || null,
      version: packageJson?.version || null,
      git
    },
    harness: {
      status: harness.status,
      stats: harness.stats
    },
    paths: pathConfig,
    capabilities: Array.isArray(manifest?.capabilities)
      ? manifest.capabilities.map(({ id, command, mode, evidence }) => ({ id, command, mode, evidence }))
      : [],
    host_capabilities: hostCapabilities,
    grok: {
      executable: hostCapabilities.find((item) => item.id === 'grok')?.available === true,
      skill_installed: grokSkill.installed,
      skill_paths: grokSkill.paths,
      wave2_closed: wave2.closed === true,
      wave2_status: wave2.status
    },
    autonomy: {
      declared_default: declaredDefault,
      max_unattended: maxUnattended,
      available_level: availableLevel,
      external_writes_require_approval: true,
      grok_does_not_raise_level: true
    },
    findings,
    next_actions: nextActions
  });
}

export function buildUserDoctorView(result) {
  const paths = result?.paths || {};
  const cwd = result?.repository?.root || '';
  const mapPath = paths.project_map || '';
  const knowledgeRoot = paths.knowledge_root || '';
  const home = paths.control_root || paths.config_dir || '';
  const map = mapPath ? parseProjectMap(mapPath) : { exists: false, projects: [] };
  const mapCount = map.projects?.length || 0;
  const knowledgeCount = countKnowledgeItems(knowledgeRoot);
  const hit = cwd ? findProjectByCwd(cwd, { map }) : null;
  const ready = result?.ok === true;

  const lines = [
    ready ? 'jj-flow：就绪' : 'jj-flow：还没准备好'
  ];
  if (!home) {
    lines.push('还没有主目录。先安装：npx @brewer/jj-flow@latest install-skill');
    return lines.join('\n');
  }
  lines.push(`主目录  ${home}`);
  lines.push(`地图    ${mapPath || '(无)'}  ${map.exists ? `${mapCount} 个项目` : '文件不存在'}`);
  lines.push(`知识    ${knowledgeRoot || '(无)'}  ${knowledgeCount} 条`);
  if (hit) {
    const family = hit.family || hit.heading || '';
    lines.push(`当前项目  ${hit.name || hit.project_key}  (${hit.project_key})${family ? `  家族=${family}` : ''}`);
  } else if (cwd) {
    lines.push(`当前目录  ${cwd}  未加入地图（加入前会先问你）`);
  }
  if (!ready && Array.isArray(result?.findings) && result.findings.length) {
    lines.push(result.findings[0].next_action || result.findings[0].reason);
  }
  return lines.join('\n');
}

export function renderDoctorText(result) {
  const user = result?.user_view || buildUserDoctorView(result);
  if (result?.mode !== 'harness') return `${user}\n`;

  const lines = [user, '', '源码仓检查：' + (result.ok ? '通过' : '未通过')];
  lines.push(`Git: ${renderGit(result.repository?.git)}`);
  if (result.harness?.status) lines.push(`Harness: ${result.harness.status}`);
  if (result.findings?.length) {
    for (const finding of result.findings) {
      lines.push(`- [${finding.rule_id}] ${finding.path}: ${finding.reason}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function withUserView(result) {
  result.user_view = buildUserDoctorView(result);
  return result;
}

function countKnowledgeItems(knowledgeRoot) {
  if (!knowledgeRoot) return 0;
  const searchPath = path.join(knowledgeRoot, 'index', 'search.json');
  const catalogPath = path.join(knowledgeRoot, 'catalog.json');
  const search = readJson(searchPath);
  if (Array.isArray(search?.items)) return search.items.length;
  const catalog = readJson(catalogPath);
  const n = catalog?.counts?.items;
  return Number.isInteger(n) ? n : 0;
}

function inspectGit(cwd, runCommand) {
  const rootResult = runGit(runCommand, cwd, ['rev-parse', '--show-toplevel']);
  if (!rootResult.ok) {
    return {
      available: false,
      root: null,
      branch: null,
      head: null,
      dirty: null,
      changed_files: null
    };
  }

  const branch = runGit(runCommand, cwd, ['branch', '--show-current']);
  const head = runGit(runCommand, cwd, ['rev-parse', '--short=12', 'HEAD']);
  const status = runGit(runCommand, cwd, ['status', '--porcelain']);
  const changedFiles = status.ok && status.stdout ? status.stdout.split(/\r?\n/).filter(Boolean).length : null;
  return {
    available: true,
    root: rootResult.stdout,
    branch: branch.ok && branch.stdout ? branch.stdout : null,
    head: head.ok && head.stdout ? head.stdout : null,
    dirty: changedFiles === null ? null : changedFiles > 0,
    changed_files: changedFiles
  };
}

function runGit(runCommand, cwd, args) {
  const result = runCommand('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 3000
  });
  return {
    ok: !result.error && result.status === 0,
    stdout: String(result.stdout || '').trim()
  };
}

function commandAvailable(command, runCommand) {
  const result = runCommand(command, ['--version'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 3000,
    stdio: 'ignore'
  });
  return !result.error && result.status === 0;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function renderGit(git) {
  if (!git.available) return 'unavailable';
  const ref = git.branch || git.head || 'unknown';
  const state = git.dirty ? `dirty (${git.changed_files} changed)` : 'clean';
  return `${ref}, ${state}`;
}

function unique(values) {
  return [...new Set(values)];
}
