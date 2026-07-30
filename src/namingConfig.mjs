import fs from 'node:fs';
import path from 'node:path';

/** Defaults mirror D:/a/config/naming.json; file overrides when present. */
export const DEFAULT_NAMING_CONFIG = {
  schema_version: 'jj-flow/naming/1.0',
  project_map: 'D:/a/map.md',
  branch: {
    pattern: '{type}/{role}-{release_date}[-{req_suffix}][-{developer}]',
    date_format: 'MMDD',
    developer: 'lyj',
    role_map_source: 'D:/a/map.md',
    derive_rule: 'replace_role_only'
  },
  ralph: {
    run_id_pattern: 'RALPH-{slug}-{YYYYMMDD}',
    run_id_regex: '^RALPH-[a-z0-9]+(?:-[a-z0-9]+)*-[0-9]{8}$',
    slug_style: 'kebab-case',
    slug_regex: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
    archive_dir_pattern: '{YYYY-MM-DD}-{slug}',
    archive_dir_regex: '^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$',
    completed_dirname: 'completed',
    layout: {
      root: '.workflow/ralph',
      active_run: '.workflow/ralph/RALPH-{slug}-{YYYYMMDD}',
      completed_run: '.workflow/ralph/completed/RALPH-{slug}-{YYYYMMDD}',
      archive: '.workflow/ralph/archive/{YYYY-MM-DD}-{slug}',
      business_map: '.workflow/ralph/business-map.json',
      meta_archive_bucket: '.workflow/ralph/archive/_meta'
    },
    legacy_tolerance: {
      read_old_paths: true,
      create_must_follow_config: true,
      rename_existing_requires_explicit_cleanup: true
    }
  },
  /**
   * Portfolio root is D:/a (all managed projects live under it).
   * dispatch.control_root is only state storage under that portfolio, not the user workspace.
   */
  dispatch: {
    portfolio_root: 'D:/a',
    control_root: 'D:/a/dispatch-control',
    layout: {
      plane: 'control-plane.json',
      delivery_dir: '.workflow/dispatch/{delivery_id}',
      delivery_plane: '.workflow/dispatch/{delivery_id}/control-plane.json',
      tasks: '.workflow/tasks'
    },
    notes: [
      'Portfolio top-level is D:/a; all controlled business projects are children of D:/a',
      'Users launch jj-dispatch from a business project under D:/a (e.g. cj-web / dj-web)',
      'dispatch.control_root stores coordination state only; not a required IDE cwd',
      'Do not create a new control repo per delivery wave',
      'Override control_root with JJ_DISPATCH_CONTROL_ROOT or explicit --manifest path'
    ]
  }
};

export function resolveGlobalConfigDir() {
  const fromEnv = process.env.JJ_GLOBAL_CONFIG_DIR || process.env.DAJI_CONFIG_DIR;
  if (fromEnv) return path.resolve(fromEnv);
  if (process.platform === 'win32') return 'D:\\a\\config';
  return null;
}

export function namingConfigPath(configDir = resolveGlobalConfigDir()) {
  if (!configDir) return null;
  return path.join(configDir, 'naming.json');
}

export function loadNamingConfig({ configDir = resolveGlobalConfigDir(), required = false } = {}) {
  const filePath = namingConfigPath(configDir);
  if (!filePath || !fs.existsSync(filePath)) {
    if (required) throw new Error('naming config not found: ' + (filePath || '(no config dir)'));
    return {
      ...DEFAULT_NAMING_CONFIG,
      source: 'defaults',
      path: filePath
    };
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return {
    ...DEFAULT_NAMING_CONFIG,
    ...raw,
    branch: { ...DEFAULT_NAMING_CONFIG.branch, ...(raw.branch || {}) },
    ralph: {
      ...DEFAULT_NAMING_CONFIG.ralph,
      ...(raw.ralph || {}),
      layout: { ...DEFAULT_NAMING_CONFIG.ralph.layout, ...((raw.ralph && raw.ralph.layout) || {}) },
      legacy_tolerance: {
        ...DEFAULT_NAMING_CONFIG.ralph.legacy_tolerance,
        ...((raw.ralph && raw.ralph.legacy_tolerance) || {})
      }
    },
    dispatch: {
      ...DEFAULT_NAMING_CONFIG.dispatch,
      ...(raw.dispatch || {}),
      layout: {
        ...DEFAULT_NAMING_CONFIG.dispatch.layout,
        ...((raw.dispatch && raw.dispatch.layout) || {})
      }
    },
    source: 'file',
    path: filePath
  };
}

/**
 * Resolve the portfolio-level dispatch control root.
 * Order: explicit arg → JJ_DISPATCH_CONTROL_ROOT → naming.json dispatch.control_root → default.
 */
export function resolveDispatchControlRoot({
  explicit = null,
  configDir = resolveGlobalConfigDir()
} = {}) {
  if (explicit && String(explicit).trim()) return path.resolve(String(explicit).trim());
  const fromEnv = process.env.JJ_DISPATCH_CONTROL_ROOT;
  if (fromEnv && String(fromEnv).trim()) return path.resolve(String(fromEnv).trim());
  const cfg = loadNamingConfig({ configDir, required: false });
  const root = cfg?.dispatch?.control_root || DEFAULT_NAMING_CONFIG.dispatch.control_root;
  return path.resolve(root);
}

export function normalizeRalphSlug(input) {
  return String(input || '')
    .trim()
    .replace(/^RALPH-/i, '')
    .replace(/[-_]?(\d{8})$/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function formatYyyymmdd(date = new Date()) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return String(y) + m + day;
}

export function formatYyyyMmDd(date = new Date()) {
  const ymd = formatYyyymmdd(date);
  return ymd.slice(0, 4) + '-' + ymd.slice(4, 6) + '-' + ymd.slice(6, 8);
}

export function buildRalphRunId(slug, date = new Date(), config = loadNamingConfig()) {
  const normalized = normalizeRalphSlug(slug);
  if (!normalized) throw new Error('slug is required');
  const slugRe = new RegExp(config.ralph.slug_regex);
  if (!slugRe.test(normalized)) throw new Error('slug must be kebab-case: ' + normalized);
  const ymd = typeof date === 'string' && /^\d{8}$/.test(date) ? date : formatYyyymmdd(date);
  const runId = 'RALPH-' + normalized + '-' + ymd;
  const runRe = new RegExp(config.ralph.run_id_regex);
  if (!runRe.test(runId)) throw new Error('built run_id failed config regex: ' + runId);
  return runId;
}

export function isStrictRalphRunId(runId, config = loadNamingConfig()) {
  return new RegExp(config.ralph.run_id_regex).test(String(runId || ''));
}

export function assertStrictRalphRunId(runId, config = loadNamingConfig()) {
  if (!isStrictRalphRunId(runId, config)) {
    throw new Error('run_id must match ' + config.ralph.run_id_pattern + ' (kebab slug + YYYYMMDD), got: ' + runId);
  }
  return runId;
}

export function buildArchiveDirNameFromRunId(runId, now = new Date(), config = loadNamingConfig()) {
  const raw = String(runId || '').replace(/^RALPH-/, '');
  const m = raw.match(/^(.*?)[-_]?([0-9]{8})$/);
  if (m && m[1]) {
    const ymd = m[2];
    const date = ymd.slice(0, 4) + '-' + ymd.slice(4, 6) + '-' + ymd.slice(6, 8);
    const name = normalizeRalphSlug(m[1]) || normalizeRalphSlug(raw);
    const folder = date + '-' + name;
    const re = new RegExp(config.ralph.archive_dir_regex);
    if (!re.test(folder)) throw new Error('archive dir failed config regex: ' + folder);
    return folder;
  }
  const iso = formatYyyyMmDd(typeof now === 'string' ? new Date(now) : now);
  const name = normalizeRalphSlug(raw) || 'run';
  return iso + '-' + name;
}

export function completedDirRel(config = loadNamingConfig()) {
  return path.join('.workflow', 'ralph', config.ralph.completed_dirname || 'completed');
}
