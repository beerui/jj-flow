import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_DIR, '..');
const DEFAULT_CODEX_SOURCE_DIR = path.join(PROJECT_ROOT, '.codex', 'skills');
const DEFAULT_CODEX_AGENTS_SOURCE_DIR = path.join(PROJECT_ROOT, '.codex', 'agents');
const DEFAULT_CLAUDE_SOURCE_DIR = path.join(PROJECT_ROOT, '.claude', 'commands');

export function defaultSkillTarget({ homeDir = os.homedir(), codexHome = process.env.CODEX_HOME } = {}) {
  return defaultCodexTarget({ homeDir, codexHome });
}

export function projectSkillTarget({ cwd = process.cwd() } = {}) {
  return projectCodexTarget({ cwd });
}

export function defaultCodexTarget({ homeDir = os.homedir(), codexHome = process.env.CODEX_HOME } = {}) {
  const root = codexHome || path.join(homeDir, '.codex');
  return path.join(root, 'skills');
}

export function defaultCodexAgentsTarget({ homeDir = os.homedir(), codexHome = process.env.CODEX_HOME } = {}) {
  const root = codexHome || path.join(homeDir, '.codex');
  return path.join(root, 'agents');
}

export function projectCodexTarget({ cwd = process.cwd() } = {}) {
  return path.join(cwd, '.codex', 'skills');
}

export function projectCodexAgentsTarget({ cwd = process.cwd() } = {}) {
  return path.join(cwd, '.codex', 'agents');
}

export function defaultClaudeTarget({ homeDir = os.homedir(), claudeHome = process.env.CLAUDE_HOME } = {}) {
  const root = claudeHome || path.join(homeDir, '.claude');
  return path.join(root, 'commands');
}

export function projectClaudeTarget({ cwd = process.cwd() } = {}) {
  return path.join(cwd, '.claude', 'commands');
}

export function installSkill({
  platform = 'codex',
  sourceDir,
  targetDir,
  codexSourceDir = sourceDir || DEFAULT_CODEX_SOURCE_DIR,
  codexAgentsSourceDir = DEFAULT_CODEX_AGENTS_SOURCE_DIR,
  claudeSourceDir = sourceDir || DEFAULT_CLAUDE_SOURCE_DIR,
  codexTargetDir,
  codexAgentsTargetDir,
  claudeTargetDir,
  homeDir,
  codexHome,
  claudeHome,
  force = false,
  dryRun = false
} = {}) {
  const platforms = normalizePlatforms(platform);
  const jobs = platforms.flatMap((name) => {
    if (name === 'codex') {
      const skillSource = path.resolve(codexSourceDir);
      const skillTarget = path.resolve(codexTargetDir || targetDir || defaultCodexTarget({ homeDir, codexHome }));
      const agentSource = path.resolve(codexAgentsSourceDir);
      const agentTarget = path.resolve(codexAgentsTargetDir || inferCodexAgentsTarget(skillTarget));
      return [
        {
          platform: 'codex',
          asset: 'skills',
          source: skillSource,
          target: skillTarget,
          entries: collectCodexSkillSources(skillSource),
          label: 'Codex skills'
        },
        {
          platform: 'codex',
          asset: 'agents',
          source: agentSource,
          target: agentTarget,
          entries: collectCodexAgentSources(agentSource),
          label: 'Codex agents'
        }
      ];
    }

    const commandSource = path.resolve(claudeSourceDir);
    return [{
      platform: 'claude',
      asset: 'commands',
      source: commandSource,
      target: path.resolve(claudeTargetDir || targetDir || defaultClaudeTarget({ homeDir, claudeHome })),
      entries: collectClaudeCommandSources(commandSource),
      label: 'Claude commands'
    }];
  });
  const summary = summarizeInstallJobs(jobs, platforms);

  const missingJobs = jobs.filter((job) => !job.entries.length);
  if (missingJobs.length) {
    return {
      ...summary,
      ok: false,
      status: 'missing-source',
      message: `Missing install assets: ${missingJobs.map((job) => job.source).join(', ')}`
    };
  }

  const conflicts = jobs
    .flatMap((job) => job.entries.map((entry) => path.join(job.target, entry.targetName)))
    .filter((target) => fs.existsSync(target));

  if (conflicts.length && !force && !dryRun) {
    return {
      ...summary,
      ok: false,
      status: 'target-exists',
      conflicts,
      message: `Target jj asset already exists: ${conflicts.join(', ')}. Re-run with --force to overwrite files.`
    };
  }

  if (!dryRun) {
    for (const job of jobs) {
      fs.mkdirSync(job.target, { recursive: true });
      for (const entry of job.entries) {
        fs.cpSync(entry.source, path.join(job.target, entry.targetName), {
          recursive: entry.kind === 'directory',
          force: true,
          errorOnExist: false
        });
      }
    }
  }

  const action = dryRun ? 'Would install' : conflicts.length ? 'Updated' : 'Installed';
  const details = jobs.map((job) => {
    const names = job.entries.map((entry) => entry.targetName).join(', ');
    return `${job.label} at ${job.target}: ${names}`;
  }).join('; ');

  return {
    ...summary,
    ok: true,
    status: dryRun ? 'dry-run' : conflicts.length ? 'updated' : 'installed',
    conflicts,
    message: `${action} jj assets: ${details}`
  };
}

function inferCodexAgentsTarget(skillTarget) {
  return path.join(path.dirname(skillTarget), 'agents');
}

function summarizeInstallJobs(jobs, platforms) {
  const primaryJobs = jobs.filter((job) => job.asset !== 'agents');
  const agentJob = jobs.find((job) => job.asset === 'agents');
  return {
    platform: platforms.length === 1 ? platforms[0] : 'all',
    source: primaryJobs.length === 1 ? primaryJobs[0].source : primaryJobs.map((job) => job.source),
    target: primaryJobs.length === 1 ? primaryJobs[0].target : primaryJobs.map((job) => job.target),
    agent_source: agentJob?.source || null,
    agent_target: agentJob?.target || null,
    asset_sources: jobs.map((job) => job.source),
    asset_targets: jobs.map((job) => job.target),
    skills: jobs
      .filter((job) => job.asset === 'skills')
      .flatMap((job) => job.entries.map((entry) => entry.name)),
    agents: jobs
      .filter((job) => job.asset === 'agents')
      .flatMap((job) => job.entries.map((entry) => entry.name)),
    commands: jobs
      .filter((job) => job.asset === 'commands')
      .flatMap((job) => job.entries.map((entry) => entry.name))
  };
}

function normalizePlatforms(platform) {
  const normalized = String(platform || 'codex').trim().toLowerCase();
  if (normalized === 'all') return ['codex', 'claude'];
  if (normalized === 'codex' || normalized === 'claude') return [normalized];
  throw new Error(`Unknown install platform: ${platform}`);
}

function collectCodexSkillSources(sourceDir) {
  if (fs.existsSync(path.join(sourceDir, 'SKILL.md'))) {
    return [{
      kind: 'directory',
      name: path.basename(sourceDir),
      targetName: path.basename(sourceDir),
      source: sourceDir
    }];
  }

  if (!fs.existsSync(sourceDir)) return [];

  return fs.readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      kind: 'directory',
      name: entry.name,
      targetName: entry.name,
      source: path.join(sourceDir, entry.name)
    }))
    .filter((entry) => fs.existsSync(path.join(entry.source, 'SKILL.md')))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function collectCodexAgentSources(sourceDir) {
  if (!fs.existsSync(sourceDir)) return [];

  return fs.readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.toml'))
    .map((entry) => ({
      kind: 'file',
      name: path.basename(entry.name, '.toml'),
      targetName: entry.name,
      source: path.join(sourceDir, entry.name)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function collectClaudeCommandSources(sourceDir) {
  if (!fs.existsSync(sourceDir)) return [];

  return fs.readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => ({
      kind: 'file',
      name: path.basename(entry.name, '.md'),
      targetName: entry.name,
      source: path.join(sourceDir, entry.name)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
