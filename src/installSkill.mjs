import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_DIR, '..');
const DEFAULT_SOURCE_DIR = path.join(PROJECT_ROOT, 'skills', 'jj');

export function defaultSkillTarget({ homeDir = os.homedir(), codexHome = process.env.CODEX_HOME } = {}) {
  const root = codexHome || path.join(homeDir, '.codex');
  return path.join(root, 'skills', 'jj');
}

export function projectSkillTarget({ cwd = process.cwd() } = {}) {
  return path.join(cwd, '.codex', 'skills', 'jj');
}

export function installSkill({
  sourceDir = DEFAULT_SOURCE_DIR,
  targetDir = defaultSkillTarget(),
  force = false,
  dryRun = false
} = {}) {
  const resolvedSource = path.resolve(sourceDir);
  const resolvedTarget = path.resolve(targetDir);
  const sourceSkill = path.join(resolvedSource, 'SKILL.md');
  const targetExists = fs.existsSync(resolvedTarget);

  if (!fs.existsSync(sourceSkill)) {
    return {
      ok: false,
      status: 'missing-source',
      source: resolvedSource,
      target: resolvedTarget,
      message: `Missing skill source: ${sourceSkill}`
    };
  }

  if (targetExists && !force) {
    return {
      ok: false,
      status: 'target-exists',
      source: resolvedSource,
      target: resolvedTarget,
      message: `Target already exists: ${resolvedTarget}. Re-run with --force to overwrite files.`
    };
  }

  if (!dryRun) {
    fs.mkdirSync(path.dirname(resolvedTarget), { recursive: true });
    fs.cpSync(resolvedSource, resolvedTarget, {
      recursive: true,
      force: true,
      errorOnExist: false
    });
  }

  return {
    ok: true,
    status: dryRun ? 'dry-run' : targetExists ? 'updated' : 'installed',
    source: resolvedSource,
    target: resolvedTarget,
    message: dryRun
      ? `Would install jj skill to ${resolvedTarget}`
      : `${targetExists ? 'Updated' : 'Installed'} jj skill at ${resolvedTarget}`
  };
}
