import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_DIR, '..');
const DEFAULT_CODEX_SOURCE_DIR = path.join(PROJECT_ROOT, '.codex', 'skills');
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

export function projectCodexTarget({ cwd = process.cwd() } = {}) {
  return path.join(cwd, '.codex', 'skills');
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
  claudeSourceDir = sourceDir || DEFAULT_CLAUDE_SOURCE_DIR,
  codexTargetDir,
  claudeTargetDir,
  force = false,
  dryRun = false
} = {}) {
  const platforms = normalizePlatforms(platform);
  const jobs = platforms.map((name) => {
    if (name === 'codex') {
      return {
        platform: 'codex',
        source: path.resolve(codexSourceDir),
        target: path.resolve(codexTargetDir || targetDir || defaultCodexTarget()),
        entries: collectCodexSkillSources(path.resolve(codexSourceDir)),
        label: 'Codex skills'
      };
    }

    return {
      platform: 'claude',
      source: path.resolve(claudeSourceDir),
      target: path.resolve(claudeTargetDir || targetDir || defaultClaudeTarget()),
      entries: collectClaudeCommandSources(path.resolve(claudeSourceDir)),
      label: 'Claude commands'
    };
  });

  const missingJobs = jobs.filter((job) => !job.entries.length);
  if (missingJobs.length) {
    return {
      ok: false,
      status: 'missing-source',
      platform: platforms.length === 1 ? platforms[0] : 'all',
      source: missingJobs.map((job) => job.source),
      target: jobs.map((job) => job.target),
      skills: jobs.flatMap((job) => job.platform === 'codex' ? job.entries.map((entry) => entry.name) : []),
      commands: jobs.flatMap((job) => job.platform === 'claude' ? job.entries.map((entry) => entry.name) : []),
      message: `Missing install assets: ${missingJobs.map((job) => job.source).join(', ')}`
    };
  }

  const conflicts = jobs
    .flatMap((job) => job.entries.map((entry) => path.join(job.target, entry.targetName)))
    .filter((target) => fs.existsSync(target));

  if (conflicts.length && !force && !dryRun) {
    return {
      ok: false,
      status: 'target-exists',
      platform: platforms.length === 1 ? platforms[0] : 'all',
      source: jobs.map((job) => job.source),
      target: jobs.map((job) => job.target),
      skills: jobs.flatMap((job) => job.platform === 'codex' ? job.entries.map((entry) => entry.name) : []),
      commands: jobs.flatMap((job) => job.platform === 'claude' ? job.entries.map((entry) => entry.name) : []),
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
  const skills = jobs.flatMap((job) => job.platform === 'codex' ? job.entries.map((entry) => entry.name) : []);
  const commands = jobs.flatMap((job) => job.platform === 'claude' ? job.entries.map((entry) => entry.name) : []);
  const details = jobs.map((job) => {
    const names = job.entries.map((entry) => entry.targetName).join(', ');
    return `${job.label} at ${job.target}: ${names}`;
  }).join('; ');

  return {
    ok: true,
    status: dryRun ? 'dry-run' : conflicts.length ? 'updated' : 'installed',
    platform: platforms.length === 1 ? platforms[0] : 'all',
    source: jobs.length === 1 ? jobs[0].source : jobs.map((job) => job.source),
    target: jobs.length === 1 ? jobs[0].target : jobs.map((job) => job.target),
    skills,
    commands,
    conflicts,
    message: `${action} jj assets: ${details}`
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
