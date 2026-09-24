import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureJjFlowHome } from './homeLayout.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_DIR, '..');
/**
 * Universal skill SSOT for Codex / Qoder / Grok install.
 * Repo edit root is top-level `skills/` (not host-specific `.codex/skills`).
 * Install *targets* remain host dirs (~/.codex/skills, ~/.grok/skills, …).
 * Never edit .grok/skills or .qoder/skills as source.
 */
export const CANONICAL_SKILLS_ROOT_REL = 'skills';
/** Repo-tracked thin Claude slash entries (not host ~/.claude/commands). */
export const CLAUDE_COMMANDS_ROOT_REL = 'claude-commands';
const DEFAULT_CODEX_SOURCE_DIR = path.join(PROJECT_ROOT, 'skills');
const DEFAULT_CODEX_AGENTS_SOURCE_DIR = path.join(PROJECT_ROOT, 'agents');
const DEFAULT_CLAUDE_SOURCE_DIR = path.join(PROJECT_ROOT, 'claude-commands');
const PACKAGE_JSON = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));

export const INSTALL_MANIFEST_FILENAME = '.jj-flow-install.json';
export const INSTALL_MANIFEST_VERSION = 'jj-flow/install-manifest/1.0';

const PRODUCT_SKILL_ID = /^jj(-[a-z0-9]+)*$/;

export function isDistributedSkillName(name) {
  return PRODUCT_SKILL_ID.test(name);
}

const RETIRED_ASSETS = Object.freeze({
  skills: Object.freeze([
    'jj-auto',
    'jj-delivery',
    'jj-evolve',
    'jj-feat',
    'jj-fix',
    'jj-knowhow',
    'jj-team',
    'jj-validate',
    'skill-en-zh-rewrite'
  ]),
  agents: Object.freeze([]),
  commands: Object.freeze([
    'jj-auto.md',
    'jj-delivery.md',
    'jj-evolve.md',
    'jj-feat.md',
    'jj-fix.md',
    'jj-knowhow.md',
    'jj-team.md',
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

/** Claude Code full skills install target (~/.claude/skills). */
export function defaultClaudeSkillsTarget({ homeDir = os.homedir(), claudeHome = process.env.CLAUDE_HOME } = {}) {
  const root = claudeHome || path.join(homeDir, '.claude');
  return path.join(root, 'skills');
}

export function projectClaudeSkillsTarget({ cwd = process.cwd() } = {}) {
  return path.join(cwd, '.claude', 'skills');
}

/** Claude Code slash-command thin wrappers (~/.claude/commands). */
export function defaultClaudeTarget({ homeDir = os.homedir(), claudeHome = process.env.CLAUDE_HOME } = {}) {
  const root = claudeHome || path.join(homeDir, '.claude');
  return path.join(root, 'commands');
}

export function projectClaudeTarget({ cwd = process.cwd() } = {}) {
  return path.join(cwd, '.claude', 'commands');
}

/** Claude Code custom agents (~/.claude/agents). Same jj-*.md as Grok. */
export function defaultClaudeAgentsTarget({ homeDir = os.homedir(), claudeHome = process.env.CLAUDE_HOME } = {}) {
  const root = claudeHome || path.join(homeDir, '.claude');
  return path.join(root, 'agents');
}

export function projectClaudeAgentsTarget({ cwd = process.cwd() } = {}) {
  return path.join(cwd, '.claude', 'agents');
}

/** If skill target is …/skills, place commands at sibling …/commands. */
export function inferClaudeCommandsTarget(skillTarget) {
  const base = path.basename(path.resolve(skillTarget));
  if (base === 'skills') return path.join(path.dirname(path.resolve(skillTarget)), 'commands');
  return null;
}

/** If skill or commands target is under .claude, place agents at sibling …/agents. */
export function inferClaudeAgentsTarget(skillOrCommandTarget) {
  const resolved = path.resolve(skillOrCommandTarget);
  const base = path.basename(resolved);
  if (base === 'skills' || base === 'commands') return path.join(path.dirname(resolved), 'agents');
  return path.join(path.dirname(resolved), 'agents');
}

export function defaultQoderTarget({ homeDir = os.homedir(), qoderHome = process.env.QODER_HOME } = {}) {
  const root = qoderHome || path.join(homeDir, '.qoder');
  return path.join(root, 'skills');
}

export function projectQoderTarget({ cwd = process.cwd() } = {}) {
  return path.join(cwd, '.qoder', 'skills');
}

export function defaultGrokTarget({ homeDir = os.homedir(), grokHome = process.env.GROK_HOME } = {}) {
  const root = grokHome || path.join(homeDir, '.grok');
  return path.join(root, 'skills');
}

export function projectGrokTarget({ cwd = process.cwd() } = {}) {
  return path.join(cwd, '.grok', 'skills');
}

export function defaultGrokAgentsTarget({ homeDir = os.homedir(), grokHome = process.env.GROK_HOME } = {}) {
  const root = grokHome || path.join(homeDir, '.grok');
  return path.join(root, 'agents');
}

export function projectGrokAgentsTarget({ cwd = process.cwd() } = {}) {
  return path.join(cwd, '.grok', 'agents');
}

/** AGENTS.md user-level discovery path (~/.agents/skills). */
export function defaultAgentsSkillsTarget({ homeDir = os.homedir(), agentsHome = process.env.AGENTS_HOME } = {}) {
  const root = agentsHome || path.join(homeDir, '.agents');
  return path.join(root, 'skills');
}

export function defaultAgentsCommandsTarget({ homeDir = os.homedir(), agentsHome = process.env.AGENTS_HOME } = {}) {
  const root = agentsHome || path.join(homeDir, '.agents');
  return path.join(root, 'commands');
}

export function projectAgentsSkillsTarget({ cwd = process.cwd() } = {}) {
  return path.join(cwd, '.agents', 'skills');
}

export function projectAgentsCommandsTarget({ cwd = process.cwd() } = {}) {
  return path.join(cwd, '.agents', 'commands');
}

/** Windows path comparison is case-insensitive; resolve and fold before comparing. */
function samePath(left, right) {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function oppositeScope(scope) {
  if (scope === 'user') return 'project';
  if (scope === 'project') return 'user';
  return null;
}

/**
 * The same asset's two official landing spots. Mirrors exactly the fallbacks each platform
 * branch in `buildAssetJobs` already uses, so classification can never invent a sibling the
 * branch itself would not have produced.
 */
function officialScopeTargets(platform, asset, {
  cwd, homeDir, codexHome, claudeHome, qoderHome, grokHome, agentsHome
}) {
  const table = {
    codex: {
      skills: [defaultCodexTarget({ homeDir, codexHome }), projectCodexTarget({ cwd })],
      agents: [defaultCodexAgentsTarget({ homeDir, codexHome }), projectCodexAgentsTarget({ cwd })]
    },
    qoder: {
      skills: [defaultQoderTarget({ homeDir, qoderHome }), projectQoderTarget({ cwd })]
    },
    grok: {
      skills: [defaultGrokTarget({ homeDir, grokHome }), projectGrokTarget({ cwd })],
      agents: [defaultGrokAgentsTarget({ homeDir, grokHome }), projectGrokAgentsTarget({ cwd })]
    },
    agents: {
      skills: [defaultAgentsSkillsTarget({ homeDir, agentsHome }), projectAgentsSkillsTarget({ cwd })],
      commands: [defaultAgentsCommandsTarget({ homeDir, agentsHome }), projectAgentsCommandsTarget({ cwd })]
    },
    claude: {
      skills: [defaultClaudeSkillsTarget({ homeDir, claudeHome }), projectClaudeSkillsTarget({ cwd })],
      commands: [defaultClaudeTarget({ homeDir, claudeHome }), projectClaudeTarget({ cwd })],
      agents: [defaultClaudeAgentsTarget({ homeDir, claudeHome }), projectClaudeAgentsTarget({ cwd })]
    }
  };
  const pair = table[platform]?.[asset];
  return pair ? { user: pair[0], project: pair[1] } : null;
}

/**
 * `cwd === homeDir` makes both scopes the same directory, and a sibling would then shadow its
 * own target — silently installing nothing. Treat that as no sibling.
 */
function safeSiblingTarget(sibling, target) {
  if (!sibling) return null;
  const resolved = path.resolve(sibling);
  return samePath(resolved, target) ? null : resolved;
}

/**
 * Path equality — not CLI intent — decides the scope, so `--target ~/.claude/skills` still
 * counts as the user scope and stays protected. A genuinely custom target gets no sibling,
 * which is what keeps `--target` installs and the direct-API tests on their old behavior.
 */
function classifyJobScope({ target, userTarget, projectTarget }) {
  const resolved = path.resolve(target);
  if (projectTarget && samePath(resolved, projectTarget)) {
    return { scope: 'project', siblingTarget: safeSiblingTarget(userTarget, resolved) };
  }
  if (userTarget && samePath(resolved, userTarget)) {
    return { scope: 'user', siblingTarget: safeSiblingTarget(projectTarget, resolved) };
  }
  return { scope: 'custom', siblingTarget: null };
}

function withJobScope(job, scopeContext) {
  const pair = officialScopeTargets(job.platform, job.asset, scopeContext);
  if (!pair) return { ...job, scope: 'custom', siblingTarget: null };
  return {
    ...job,
    ...classifyJobScope({ target: job.target, userTarget: pair.user, projectTarget: pair.project })
  };
}

export function installSkill({
  platform = 'codex',
  sourceDir,
  targetDir,
  codexSourceDir = sourceDir || DEFAULT_CODEX_SOURCE_DIR,
  codexAgentsSourceDir = DEFAULT_CODEX_AGENTS_SOURCE_DIR,
  claudeSourceDir = sourceDir || DEFAULT_CLAUDE_SOURCE_DIR,
  qoderSourceDir,
  grokSourceDir,
  codexTargetDir,
  codexAgentsTargetDir,
  claudeSkillsTargetDir,
  claudeTargetDir,
  claudeAgentsTargetDir,
  qoderTargetDir,
  grokTargetDir,
  grokAgentsTargetDir,
  agentsSkillsTargetDir,
  agentsCommandsTargetDir,
  homeDir,
  codexHome,
  claudeHome,
  qoderHome,
  grokHome,
  agentsHome,
  cwd = process.cwd(),
  force = false,
  dryRun = false
} = {}) {
  const platforms = normalizePlatforms(platform);
  const jobs = buildAssetJobs({
    platforms,
    cwd,
    targetDir,
    codexSourceDir,
    codexAgentsSourceDir,
    claudeSourceDir,
    qoderSourceDir,
    grokSourceDir,
    codexTargetDir,
    codexAgentsTargetDir,
    claudeSkillsTargetDir,
    claudeTargetDir,
    claudeAgentsTargetDir,
    qoderTargetDir,
    grokTargetDir,
    grokAgentsTargetDir,
    agentsSkillsTargetDir,
    agentsCommandsTargetDir,
    homeDir,
    codexHome,
    claudeHome,
    qoderHome,
    grokHome,
    agentsHome
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

  const planned = [];
  for (const job of jobs) {
    for (const entry of job.entries) {
      const dest = path.join(job.target, entry.targetName);
      planned.push({ job, entry, dest, exists: fs.existsSync(dest) });
    }
  }

  // Skip-and-report: a copy already present at the sibling scope suppresses a NEW write in
  // this scope. Never deletes. `--force` opts back into a second copy, so the whole scan is
  // skipped there. Already-present same-scope copies stay the plain `exists` case below, so
  // idempotent re-runs do not read as shadowed; they surface as `duplicates` instead, which
  // is report-only and never affects what gets written.
  const shadowed = [];
  const duplicates = [];
  if (!force) {
    const sourceDigests = new Map();
    for (const item of planned) {
      const siblingTarget = item.job.siblingTarget;
      if (!siblingTarget) continue;
      const siblingPath = path.join(siblingTarget, item.entry.targetName);
      if (!fs.existsSync(siblingPath)) continue;
      const record = {
        path: item.dest,
        sibling_path: siblingPath,
        target: item.job.target,
        sibling_target: siblingTarget,
        platform: item.job.platform,
        asset: item.job.asset,
        name: item.entry.name,
        target_name: item.entry.targetName,
        kind: item.entry.kind,
        scope: item.job.scope,
        sibling_scope: oppositeScope(item.job.scope)
      };
      if (item.exists) {
        duplicates.push({ ...record, reason: 'duplicate-existing' });
        continue;
      }
      if (!sourceDigests.has(item.entry.source)) {
        sourceDigests.set(item.entry.source, digestPath(item.entry.source));
      }
      const sourceDigest = sourceDigests.get(item.entry.source);
      const siblingDigest = digestPath(siblingPath);
      const siblingKind = fs.lstatSync(siblingPath).isDirectory() ? 'directory' : 'file';
      shadowed.push({
        ...record,
        sibling_kind: siblingKind,
        source_digest: sourceDigest,
        sibling_digest: siblingDigest,
        reason: sourceDigest === siblingDigest && siblingKind === item.entry.kind
          ? 'identical-elsewhere'
          : 'diverged-elsewhere'
      });
    }
  }

  const shadowedDests = new Set(shadowed.map((record) => record.path));
  const conflicts = planned.filter((item) => item.exists).map((item) => item.dest);
  const toWrite = force
    ? planned
    : planned.filter((item) => !item.exists && !shadowedDests.has(item.dest));
  const skipped = force ? [] : planned.filter((item) => item.exists).map((item) => item.dest);
  const added = toWrite.map((item) => item.dest);

  let home = null;
  if (!dryRun) {
    const writtenByJob = new Set();
    for (const item of toWrite) {
      fs.mkdirSync(item.job.target, { recursive: true });
      if (item.entry.kind === 'directory' && fs.existsSync(item.dest)) {
        fs.rmSync(item.dest, { recursive: true, force: true });
      }
      fs.cpSync(item.entry.source, item.dest, {
        recursive: item.entry.kind === 'directory',
        force: true,
        errorOnExist: false,
        // A snapshot's staleness stamp is a record of source mtimes, so a copy that
        // restamps "now" makes every stamped file read as newer. Some platforms do
        // that by default, so the requirement has to be stated here rather than
        // inherited from whatever the host's copy happens to do.
        preserveTimestamps: true
      });
      writtenByJob.add(item.job);
    }
    for (const job of jobs) {
      // A fully shadowed scope gets no empty directory and no phantom ownership manifest.
      // An existing manifest still gets rewritten so retired-asset cleanup keeps running.
      const manifestPath = path.join(job.target, INSTALL_MANIFEST_FILENAME);
      if (!writtenByJob.has(job) && !fs.existsSync(manifestPath)) continue;
      fs.mkdirSync(job.target, { recursive: true });
      writeInstallManifest(job);
      removeRetiredAssets(job.target, job.asset);
    }
    home = ensureJjFlowHome({ homeDir: homeDir || os.homedir() });
  }

  const status = dryRun
    ? 'dry-run'
    : force && conflicts.length
      ? 'updated'
      : toWrite.length && skipped.length
        ? 'added'
        : toWrite.length
          ? 'installed'
          : 'up-to-date';
  const details = jobs.map((job) => {
    const names = job.entries.map((entry) => entry.targetName).join(', ');
    return `${job.label} at ${job.target}: ${names}`;
  }).join('; ');
  const addedNames = [...new Set(toWrite.map((item) => item.entry.targetName))].join(', ');
  const skipHint = skipped.length ? '; skipped existing (use --force to overwrite)' : '';
  let action;
  if (dryRun && toWrite.length && skipped.length) action = `Would install missing jj assets: ${addedNames}`;
  else if (dryRun && toWrite.length) action = `Would install jj assets: ${details}`;
  else if (dryRun) action = 'Would skip existing jj assets (use --force to overwrite)';
  else if (status === 'updated') action = `Updated jj assets: ${details}`;
  else if (status === 'added') action = `Added missing jj assets: ${addedNames}`;
  else if (status === 'up-to-date') action = 'Already installed';
  else action = `Installed jj assets: ${details}`;

  const showSkip = skipped.length && (
    status === 'added' || status === 'up-to-date' || (dryRun && toWrite.length)
  );
  const shadowRoots = [...new Set(shadowed.map((record) => record.sibling_target))].sort();
  const diverged = shadowed.filter((record) => record.reason === 'diverged-elsewhere').length;
  const shadowHint = shadowed.length
    ? `; ${shadowed.length} asset(s) already present at ${shadowRoots.join(', ')}`
      + (diverged ? ` (${diverged} differ from this package — verify which copy you want)` : '')
      + ' — skipped to avoid duplicate host entries; use --force to install a second copy'
    : '';
  const duplicateScopes = [...new Set(duplicates.map((record) => record.scope))].sort();
  const duplicatePlatforms = [...new Set(duplicates.map((record) => record.platform))].sort();
  const duplicateHint = duplicates.length
    ? `; ${duplicates.length} asset(s) are already installed in BOTH scopes`
      + ` (${duplicatePlatforms.join(', ')}${duplicateScopes.length ? `: ${duplicateScopes.join(' + ')}` : ''})`
      + ` — preview removing one with \`jj uninstall-skill --platform ${duplicatePlatforms[0]}`
      + `${duplicateScopes.includes('project') ? ' --project' : ''} --dry-run\``
    : '';
  return {
    ...summary,
    ok: true,
    status,
    conflicts,
    added,
    skipped,
    shadowed,
    duplicates,
    manifest_paths: jobs.map((job) => path.join(job.target, INSTALL_MANIFEST_FILENAME)),
    jj_flow_home: home ? home.root : null,
    map_path: home ? home.map_path : null,
    knowledge_root: home ? home.knowledge_root : null,
    message: `${action}${showSkip ? skipHint : ''}${shadowHint}${duplicateHint}`
      + (home ? `; home ${home.root}` : '')
  };
}

export function uninstallSkill({
  platform = 'codex',
  sourceDir,
  targetDir,
  codexSourceDir = sourceDir || DEFAULT_CODEX_SOURCE_DIR,
  codexAgentsSourceDir = DEFAULT_CODEX_AGENTS_SOURCE_DIR,
  claudeSourceDir = sourceDir || DEFAULT_CLAUDE_SOURCE_DIR,
  qoderSourceDir,
  grokSourceDir,
  codexTargetDir,
  codexAgentsTargetDir,
  claudeSkillsTargetDir,
  claudeTargetDir,
  claudeAgentsTargetDir,
  qoderTargetDir,
  grokTargetDir,
  grokAgentsTargetDir,
  agentsSkillsTargetDir,
  agentsCommandsTargetDir,
  homeDir,
  codexHome,
  claudeHome,
  qoderHome,
  grokHome,
  agentsHome,
  cwd = process.cwd(),
  force = false,
  dryRun = false
} = {}) {
  const platforms = normalizePlatforms(platform);
  const jobs = buildAssetJobs({
    platforms,
    cwd,
    targetDir,
    codexSourceDir,
    codexAgentsSourceDir,
    claudeSourceDir,
    qoderSourceDir,
    grokSourceDir,
    codexTargetDir,
    codexAgentsTargetDir,
    claudeSkillsTargetDir,
    claudeTargetDir,
    claudeAgentsTargetDir,
    qoderTargetDir,
    grokTargetDir,
    grokAgentsTargetDir,
    agentsSkillsTargetDir,
    agentsCommandsTargetDir,
    homeDir,
    codexHome,
    claudeHome,
    qoderHome,
    grokHome,
    agentsHome
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

function resolveClaudeInstallTargets({
  targetDir,
  claudeSkillsTargetDir,
  claudeTargetDir,
  claudeAgentsTargetDir,
  homeDir,
  claudeHome
}) {
  const defaultSkills = defaultClaudeSkillsTarget({ homeDir, claudeHome });
  const defaultCommands = defaultClaudeTarget({ homeDir, claudeHome });
  const defaultAgents = defaultClaudeAgentsTarget({ homeDir, claudeHome });

  let skillTarget;
  let commandTarget;
  let agentsTarget;

  if (claudeSkillsTargetDir) {
    skillTarget = path.resolve(claudeSkillsTargetDir);
  }
  if (claudeTargetDir) {
    commandTarget = path.resolve(claudeTargetDir);
    // If only commands dir was passed, co-locate skills as sibling …/skills
    if (!skillTarget && path.basename(commandTarget) === 'commands') {
      skillTarget = path.join(path.dirname(commandTarget), 'skills');
    }
  }
  if (claudeAgentsTargetDir) {
    agentsTarget = path.resolve(claudeAgentsTargetDir);
  }

  if (targetDir) {
    const resolved = path.resolve(targetDir);
    const base = path.basename(resolved);
    if (base === 'commands') {
      commandTarget = commandTarget || resolved;
      skillTarget = skillTarget || path.join(path.dirname(resolved), 'skills');
    } else if (base === 'skills') {
      skillTarget = skillTarget || resolved;
      commandTarget = commandTarget || inferClaudeCommandsTarget(resolved) || defaultCommands;
    } else if (base === 'agents') {
      agentsTarget = agentsTarget || resolved;
      skillTarget = skillTarget || path.join(path.dirname(resolved), 'skills');
      commandTarget = commandTarget || path.join(path.dirname(resolved), 'commands');
    } else {
      // Treat generic --target like other platforms: skills root
      skillTarget = skillTarget || resolved;
      commandTarget = commandTarget || inferClaudeCommandsTarget(resolved) || defaultCommands;
    }
  }

  skillTarget = skillTarget || defaultSkills;
  commandTarget = commandTarget || inferClaudeCommandsTarget(skillTarget) || defaultCommands;
  agentsTarget = agentsTarget || inferClaudeAgentsTarget(skillTarget) || defaultAgents;
  return { skillTarget, commandTarget, agentsTarget };
}

function buildAssetJobs({
  platforms,
  cwd = process.cwd(),
  targetDir,
  codexSourceDir,
  codexAgentsSourceDir,
  claudeSourceDir,
  qoderSourceDir,
  grokSourceDir,
  codexTargetDir,
  codexAgentsTargetDir,
  claudeSkillsTargetDir,
  claudeTargetDir,
  claudeAgentsTargetDir,
  qoderTargetDir,
  grokTargetDir,
  grokAgentsTargetDir,
  agentsSkillsTargetDir,
  agentsCommandsTargetDir,
  homeDir,
  codexHome,
  claudeHome,
  qoderHome,
  grokHome,
  agentsHome
}) {
  const scopeContext = { cwd, homeDir, codexHome, claudeHome, qoderHome, grokHome, agentsHome };
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

    if (name === 'qoder') {
      const skillSource = path.resolve(qoderSourceDir || codexSourceDir);
      const skillTarget = path.resolve(qoderTargetDir || targetDir || defaultQoderTarget({ homeDir, qoderHome }));
      return [{
        platform: 'qoder',
        asset: 'skills',
        source: skillSource,
        target: skillTarget,
        entries: collectCodexSkillSources(skillSource),
        label: 'Qoder skills'
      }];
    }

    if (name === 'grok') {
      const skillSource = path.resolve(grokSourceDir || codexSourceDir);
      const skillTarget = path.resolve(grokTargetDir || targetDir || defaultGrokTarget({ homeDir, grokHome }));
      const agentSource = path.resolve(codexAgentsSourceDir);
      const agentTarget = path.resolve(
        grokAgentsTargetDir || inferCodexAgentsTarget(skillTarget) || defaultGrokAgentsTarget({ homeDir, grokHome })
      );
      return [
        {
          platform: 'grok',
          asset: 'skills',
          source: skillSource,
          target: skillTarget,
          entries: collectCodexSkillSources(skillSource),
          label: 'Grok skills'
        },
        {
          platform: 'grok',
          asset: 'agents',
          source: agentSource,
          target: agentTarget,
          entries: collectGrokAgentSources(agentSource),
          label: 'Grok agents'
        }
      ];
    }

    if (name === 'agents') {
      const skillSource = path.resolve(codexSourceDir);
      const commandSource = path.resolve(claudeSourceDir);
      const skillTarget = path.resolve(
        agentsSkillsTargetDir || targetDir || defaultAgentsSkillsTarget({ homeDir, agentsHome })
      );
      const commandTarget = path.resolve(
        agentsCommandsTargetDir
        || inferClaudeCommandsTarget(skillTarget)
        || defaultAgentsCommandsTarget({ homeDir, agentsHome })
      );
      return [
        {
          platform: 'agents',
          asset: 'skills',
          source: skillSource,
          target: skillTarget,
          entries: collectCodexSkillSources(skillSource),
          label: 'AGENTS skills'
        },
        {
          platform: 'agents',
          asset: 'commands',
          source: commandSource,
          target: commandTarget,
          entries: collectClaudeCommandSources(commandSource),
          label: 'AGENTS commands'
        }
      ];
    }

    // Claude Code: full skills (~/.claude/skills) + thin slash commands (~/.claude/commands)
    // + exclusive-assignment agents (~/.claude/agents), same jj-*.md as Grok.
    const skillSource = path.resolve(codexSourceDir);
    const commandSource = path.resolve(claudeSourceDir);
    const agentSource = path.resolve(codexAgentsSourceDir);
    const { skillTarget, commandTarget, agentsTarget } = resolveClaudeInstallTargets({
      targetDir,
      claudeSkillsTargetDir,
      claudeTargetDir,
      claudeAgentsTargetDir,
      homeDir,
      claudeHome
    });
    return [
      {
        platform: 'claude',
        asset: 'skills',
        source: skillSource,
        target: skillTarget,
        entries: collectCodexSkillSources(skillSource),
        label: 'Claude skills'
      },
      {
        platform: 'claude',
        asset: 'commands',
        source: commandSource,
        target: commandTarget,
        entries: collectClaudeCommandSources(commandSource),
        label: 'Claude commands'
      },
      {
        platform: 'claude',
        asset: 'agents',
        source: agentSource,
        target: agentsTarget,
        entries: collectGrokAgentSources(agentSource),
        label: 'Claude agents'
      }
    ];
  });
  return jobs.map((job) => withJobScope(job, scopeContext));
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
  if (normalized === 'all') return ['codex', 'claude', 'qoder', 'grok', 'agents'];
  if (normalized === 'codex' || normalized === 'claude' || normalized === 'qoder' || normalized === 'grok' || normalized === 'agents') {
    return [normalized];
  }
  throw new Error(`Unknown install platform: ${platform}`);
}

function removeRetiredAssets(target, asset) {
  for (const name of RETIRED_ASSETS[asset] || []) {
    const dest = resolveTargetEntry(target, name);
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  }
}

function collectCodexSkillSources(sourceDir) {
  if (fs.existsSync(path.join(sourceDir, 'SKILL.md'))) {
    const name = path.basename(sourceDir);
    if (!isDistributedSkillName(name)) return [];
    return [{
      kind: 'directory',
      name,
      targetName: name,
      source: sourceDir
    }];
  }

  if (!fs.existsSync(sourceDir)) return [];

  return fs.readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isDistributedSkillName(entry.name))
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

function collectGrokAgentSources(sourceDir) {
  if (!fs.existsSync(sourceDir)) return [];

  return fs.readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^jj-[a-z0-9-]+\.md$/.test(entry.name))
    .map((entry) => ({
      kind: 'file',
      name: path.basename(entry.name, '.md'),
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
