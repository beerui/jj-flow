import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_DIR, '..');
const DEFAULT_CODEX_SOURCE_DIR = path.join(PROJECT_ROOT, '.codex', 'skills');
const DEFAULT_CODEX_AGENTS_SOURCE_DIR = path.join(PROJECT_ROOT, '.codex', 'agents');
const DEFAULT_CLAUDE_SOURCE_DIR = path.join(PROJECT_ROOT, '.claude', 'commands');
const PACKAGE_JSON = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));

export const INSTALL_MANIFEST_FILENAME = '.jj-flow-install.json';
export const INSTALL_MANIFEST_VERSION = 'jj-flow/install-manifest/1.0';

const RETIRED_ASSETS = Object.freeze({
  skills: Object.freeze([
    'jj-auto',
    'jj-delivery',
    'jj-evolve',
    'jj-feat',
    'jj-fix',
    'jj-knowhow',
    'jj-review',
    'jj-validate'
  ]),
  agents: Object.freeze([]),
  commands: Object.freeze([
    'jj-auto.md',
    'jj-delivery.md',
    'jj-evolve.md',
    'jj-feat.md',
    'jj-fix.md',
    'jj-knowhow.md',
    'jj-review.md',
    'jj-validate.md'
  ])
});

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
  const jobs = buildAssetJobs({
    platforms,
    targetDir,
    codexSourceDir,
    codexAgentsSourceDir,
    claudeSourceDir,
    codexTargetDir,
    codexAgentsTargetDir,
    claudeTargetDir,
    homeDir,
    codexHome,
    claudeHome
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
      writeInstallManifest(job);
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
    manifest_paths: jobs.map((job) => path.join(job.target, INSTALL_MANIFEST_FILENAME)),
    message: `${action} jj assets: ${details}`
  };
}

export function uninstallSkill({
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
  const jobs = buildAssetJobs({
    platforms,
    targetDir,
    codexSourceDir,
    codexAgentsSourceDir,
    claudeSourceDir,
    codexTargetDir,
    codexAgentsTargetDir,
    claudeTargetDir,
    homeDir,
    codexHome,
    claudeHome
  });
  const summary = summarizeInstallJobs(jobs, platforms);
  const scans = jobs.map(scanUninstallJob);
  const invalidManifests = scans.filter((scan) => scan.manifest_error);
  if (invalidManifests.length) {
    const conflicts = invalidManifests.map((scan) => scan.manifest_path);
    return {
      ...summary,
      ok: false,
      status: 'invalid-manifest',
      conflicts,
      conflict_details: invalidManifests.map((scan) => ({
        path: scan.manifest_path,
        reason: scan.manifest_error
      })),
      removed: [],
      message: `Invalid jj-flow ownership manifest: ${conflicts.join(', ')}. Inspect or remove the manifest before retrying.`
    };
  }

  const candidates = scans.flatMap((scan) => scan.candidates);
  const conflicts = candidates.filter((candidate) => !candidate.safe);
  const manifests = scans.filter((scan) => scan.manifest_exists).map((scan) => scan.manifest_path);
  const wouldRemove = [...candidates.map((candidate) => candidate.path), ...manifests];

  if (dryRun) {
    return {
      ...summary,
      ok: true,
      status: 'dry-run',
      conflicts: conflicts.map((candidate) => candidate.path),
      conflict_details: conflicts.map(toConflictDetail),
      requires_force: conflicts.length > 0,
      would_remove: wouldRemove,
      removed: [],
      message: wouldRemove.length
        ? `Would uninstall ${candidates.length} jj assets${conflicts.length ? `; ${conflicts.length} require --force` : ''}.`
        : 'No installed jj assets found.'
    };
  }

  if (conflicts.length && !force) {
    return {
      ...summary,
      ok: false,
      status: 'modified-assets',
      conflicts: conflicts.map((candidate) => candidate.path),
      conflict_details: conflicts.map(toConflictDetail),
      requires_force: true,
      would_remove: wouldRemove,
      removed: [],
      message: `Refusing to uninstall modified or ownership-unverified jj assets: ${conflicts.map((candidate) => candidate.path).join(', ')}. Re-run with --force after review.`
    };
  }

  for (const candidate of candidates) {
    fs.rmSync(candidate.path, { recursive: candidate.actualKind === 'directory', force: false });
  }
  for (const manifestPath of manifests) {
    fs.rmSync(manifestPath, { force: false });
  }

  if (!wouldRemove.length) {
    return {
      ...summary,
      ok: true,
      status: 'not-installed',
      conflicts: [],
      conflict_details: [],
      requires_force: false,
      would_remove: [],
      removed: [],
      message: 'No installed jj assets found.'
    };
  }

  return {
    ...summary,
    ok: true,
    status: 'uninstalled',
    conflicts: conflicts.map((candidate) => candidate.path),
    conflict_details: conflicts.map(toConflictDetail),
    requires_force: false,
    would_remove: wouldRemove,
    removed: wouldRemove,
    message: `Uninstalled jj assets: ${wouldRemove.join(', ')}`
  };
}

function buildAssetJobs({
  platforms,
  targetDir,
  codexSourceDir,
  codexAgentsSourceDir,
  claudeSourceDir,
  codexTargetDir,
  codexAgentsTargetDir,
  claudeTargetDir,
  homeDir,
  codexHome,
  claudeHome
}) {
  return platforms.flatMap((name) => {
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
}

function writeInstallManifest(job) {
  const manifest = {
    schema_version: INSTALL_MANIFEST_VERSION,
    package: PACKAGE_JSON.name,
    package_version: PACKAGE_JSON.version,
    platform: job.platform,
    asset: job.asset,
    entries: job.entries.map((entry) => ({
      target_name: entry.targetName,
      kind: entry.kind,
      digest: digestPath(entry.source)
    }))
  };
  fs.writeFileSync(
    path.join(job.target, INSTALL_MANIFEST_FILENAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );
}

function scanUninstallJob(job) {
  const manifestPath = path.join(job.target, INSTALL_MANIFEST_FILENAME);
  const manifestExists = fs.existsSync(manifestPath);
  let manifest = null;
  if (manifestExists) {
    try {
      manifest = validateInstallManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')), job);
    } catch (error) {
      return {
        manifest_path: manifestPath,
        manifest_exists: true,
        manifest_error: error.message,
        candidates: []
      };
    }
  }

  const expected = new Map();
  for (const entry of job.entries) {
    expected.set(entry.targetName, {
      targetName: entry.targetName,
      kind: entry.kind,
      expectedDigest: digestPath(entry.source),
      provenance: 'current-package'
    });
  }
  for (const entry of manifest?.entries || []) {
    expected.set(entry.target_name, {
      targetName: entry.target_name,
      kind: entry.kind,
      expectedDigest: entry.digest,
      provenance: 'ownership-manifest'
    });
  }
  for (const targetName of RETIRED_ASSETS[job.asset] || []) {
    if (!expected.has(targetName)) {
      expected.set(targetName, {
        targetName,
        kind: job.asset === 'skills' ? 'directory' : 'file',
        expectedDigest: null,
        provenance: 'retired-unverified'
      });
    }
  }

  const candidates = [];
  for (const entry of expected.values()) {
    const targetPath = resolveTargetEntry(job.target, entry.targetName);
    if (!fs.existsSync(targetPath)) continue;
    const actualKind = fs.lstatSync(targetPath).isDirectory() ? 'directory' : 'file';
    const actualDigest = digestPath(targetPath);
    const safe = entry.expectedDigest !== null
      && actualKind === entry.kind
      && actualDigest === entry.expectedDigest;
    candidates.push({
      ...entry,
      path: targetPath,
      actualKind,
      actualDigest,
      safe,
      reason: entry.expectedDigest === null
        ? 'ownership-unverified'
        : actualKind !== entry.kind
          ? 'asset-kind-changed'
          : actualDigest !== entry.expectedDigest
            ? 'content-modified'
            : null
    });
  }

  return {
    manifest_path: manifestPath,
    manifest_exists: manifestExists,
    manifest_error: null,
    candidates
  };
}

function validateInstallManifest(value, job) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('manifest must be an object');
  if (value.schema_version !== INSTALL_MANIFEST_VERSION) throw new Error('unsupported schema_version');
  if (value.package !== PACKAGE_JSON.name) throw new Error('package owner mismatch');
  if (value.platform !== job.platform || value.asset !== job.asset) throw new Error('target type mismatch');
  if (!Array.isArray(value.entries)) throw new Error('entries must be an array');
  const allowedTargets = new Set([
    ...job.entries.map((entry) => entry.targetName),
    ...(RETIRED_ASSETS[job.asset] || [])
  ]);
  const seen = new Set();
  for (const entry of value.entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('entry must be an object');
    if (!isSafeTargetName(entry.target_name) || seen.has(entry.target_name)) throw new Error('entry target_name is invalid or duplicated');
    if (!allowedTargets.has(entry.target_name)) throw new Error('entry target_name is not a known jj-flow asset');
    if (!['file', 'directory'].includes(entry.kind)) throw new Error('entry kind is invalid');
    if (!/^sha256:[a-f0-9]{64}$/.test(entry.digest || '')) throw new Error('entry digest is invalid');
    seen.add(entry.target_name);
  }
  return value;
}

function resolveTargetEntry(targetRoot, targetName) {
  if (!isSafeTargetName(targetName)) throw new Error(`Unsafe jj asset target: ${targetName}`);
  const root = path.resolve(targetRoot);
  const target = path.resolve(root, targetName);
  if (path.dirname(target) !== root) throw new Error(`Unsafe jj asset target: ${targetName}`);
  return target;
}

function isSafeTargetName(value) {
  return typeof value === 'string'
    && value.length > 0
    && value !== '.'
    && value !== '..'
    && path.basename(value) === value;
}

function digestPath(target) {
  const hash = crypto.createHash('sha256');
  visitDigestPath(target, target, hash);
  return `sha256:${hash.digest('hex')}`;
}

function visitDigestPath(root, current, hash) {
  const stat = fs.lstatSync(current);
  const relative = path.relative(root, current).replaceAll('\\', '/') || '.';
  if (stat.isDirectory()) {
    hash.update(`directory\0${relative}\0`);
    const entries = fs.readdirSync(current).sort((left, right) => left.localeCompare(right));
    for (const entry of entries) visitDigestPath(root, path.join(current, entry), hash);
    return;
  }
  if (stat.isFile()) {
    hash.update(`file\0${relative}\0${stat.size}\0`);
    hash.update(fs.readFileSync(current));
    return;
  }
  if (stat.isSymbolicLink()) {
    hash.update(`symlink\0${relative}\0${fs.readlinkSync(current)}\0`);
    return;
  }
  hash.update(`other\0${relative}\0${stat.mode}\0`);
}

function toConflictDetail(candidate) {
  return {
    path: candidate.path,
    reason: candidate.reason,
    provenance: candidate.provenance,
    expected_digest: candidate.expectedDigest,
    actual_digest: candidate.actualDigest
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
