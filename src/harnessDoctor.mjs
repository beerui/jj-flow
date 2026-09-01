import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { checkHarnessRepository } from '../scripts/check-harness.mjs';
import { grokSkillInstalled, inspectGrokWave2Milestone } from './grokHostAdapter.mjs';
import { describePathConfig } from './namingConfig.mjs';

export const DOCTOR_SCHEMA_VERSION = 'jj-flow/doctor/1.0';

export function inspectHarnessRepository({ cwd = process.cwd(), runCommand = spawnSync } = {}) {
  const root = path.resolve(cwd);
  const harness = checkHarnessRepository({ cwd: root });
  const manifest = readJson(path.join(root, 'harness-manifest.json'));
  const packageJson = readJson(path.join(root, 'package.json'));
  const git = inspectGit(root, runCommand);
  const pathConfig = describePathConfig();
  const hostCapabilities = ['git', 'codex', 'claude', 'grok'].map((command) => ({
    id: command,
    available: command === 'git' ? git.available : commandAvailable(command, runCommand)
  }));
  const grokSkill = grokSkillInstalled({ cwd: root, homedir: os.homedir() });
  const wave2 = inspectGrokWave2Milestone({ cwd: root });

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

  return {
    schema_version: DOCTOR_SCHEMA_VERSION,
    ok: ready,
    status: ready ? 'READY' : 'BLOCKED',
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
  };
}

export function renderDoctorText(result) {
  const lines = [
    `jj doctor: ${result.status}`,
    `repository: ${result.repository.root}`,
    `version: ${result.repository.version || 'unknown'}`,
    `git: ${renderGit(result.repository.git)}`,
    `autonomy: ${result.autonomy.available_level}`
  ];
  if (result.paths) {
    lines.push(`control_root: ${result.paths.control_root}${result.paths.control_root_exists ? '' : ' (missing)'}`);
    lines.push(`portfolio_root: ${result.paths.portfolio_root || '(none)'}`);
    lines.push(`knowledge_root: ${result.paths.knowledge_root || '(none)'}`);
    lines.push(`project_map: ${result.paths.project_map || '(none)'}`);
    lines.push(`naming_config: ${result.paths.naming_config_path || '(defaults)'} [${result.paths.naming_config_source}]`);
  }
  if (result.grok) {
    lines.push(`grok: executable=${result.grok.executable} skill=${result.grok.skill_installed} wave2=${result.grok.wave2_status} closed=${result.grok.wave2_closed} (skill/executable do not raise autonomy)`);
  }
  if (result.findings.length) {
    lines.push('findings:');
    for (const finding of result.findings) {
      lines.push(`- [${finding.rule_id}] ${finding.path}: ${finding.reason}`);
      lines.push(`  next: ${finding.next_action}`);
    }
  }
  return `${lines.join('\n')}\n`;
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
