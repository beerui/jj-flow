import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultJjFlowHome, ensureJjFlowHome } from './homeLayout.mjs';

/** Expand leading ~ to os.homedir(). */
export function expandUserPath(input) {
  const raw = String(input || '').trim();
  if (!raw) return raw;
  if (raw === '~') return os.homedir();
  if (raw.startsWith('~/') || raw.startsWith('~\\')) {
    return path.join(os.homedir(), raw.slice(2));
  }
  return path.resolve(raw);
}

/** Product default: user-home coordination data (not machine-specific /portfolio). */
export function defaultDispatchControlRoot() {
  return defaultJjFlowHome();
}

/** Defaults; optional local portfolio machines override via naming.json. */
export const DEFAULT_NAMING_CONFIG = {
  schema_version: 'jj-flow/naming/1.0',
  project_map: '~/.jj-flow/map.md',
  branch: {
    pattern: '{type}/{role}-{release_date}[-{req_suffix}][-{developer}]',
    date_format: 'MMDD',
    developer: 'dev',
    role_map_source: '~/.jj-flow/map.md',
    derive_rule: 'replace_role_only'
  },
  ralph: {
    run_id_pattern: 'task-{slug}',
    run_id_regex: '^task-[a-z0-9][a-z0-9-]{1,80}$',
    slug_style: 'kebab-case',
    slug_regex: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
    task_dir_pattern: 'tasks/{task_key}',
    archive_dir_pattern: '{YYYY-MM-DD}-{slug}',
    archive_dir_regex: '^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$',
    completed_dirname: 'completed',
    layout: {
      root: '.workflow/ralph',
      active_run: '.workflow/ralph/tasks/{task_key}',
      completed_run: '.workflow/ralph/tasks/{task_key}',
      archive: '.workflow/ralph/archive/{YYYY-MM-DD}-{slug}',
      business_map: '.workflow/ralph/business-map.json',
      meta_archive_bucket: '.workflow/ralph/archive/_meta'
    },
    legacy_tolerance: {
      read_old_paths: true,
      create_must_follow_config: true,
      rename_existing_requires_explicit_cleanup: true
    },
    /** Archive elevation L2: package always; hook optional (none|cli). */
    knowledge_contribute: {
      hook: 'none',
      /** Template may use {package} absolute path to knowledge-contribution.json */
      cli: null,
      fail_open: true,
      timeout_ms: 30000,
      /** If true, finalize also runs hook when hook !== none */
      on_finalize: false
    }
  },
  /**
   * User-configurable directory layout (naming.json under config dir).
   *
   * Key paths (all optional except product default control_root):
   * - project_map: portfolio map file
   * - dispatch.portfolio_root: project-family top (map / knowledge / business repos)
   * - dispatch.control_root: coordination state root (default ~/.jj-flow)
   * - dispatch.knowledge_root: Portfolio KB root (default ~/.jj-flow/knowledge)
   *
   * Override order for control_root:
   *   explicit CLI > JJ_DISPATCH_CONTROL_ROOT > naming.json > ~/.jj-flow
   */
  dispatch: {
    portfolio_root: null,
    control_root: '~/.jj-flow',
    knowledge_root: '~/.jj-flow/knowledge',
    layout: {
      plane: 'control-plane.json',
      delivery_dir: '.workflow/dispatch/{delivery_id}',
      delivery_plane: '.workflow/dispatch/{delivery_id}/control-plane.json',
      tasks: '.workflow/tasks'
    },
    notes: [
      'Default state root is ~/.jj-flow under the user home directory',
      'Install scaffolds map.md + knowledge/ under ~/.jj-flow',
      'Users launch jj-dispatch from a business project workspace',
      'Configure directories in naming.json: dispatch.control_root / portfolio_root / knowledge_root',
      'Optional local portfolio may override control_root / knowledge_root / project_map',
      'Do not create a new control repo per delivery wave',
      'Override control_root with JJ_DISPATCH_CONTROL_ROOT or --control-root / --manifest'
    ]
  }
};

export function resolveGlobalConfigDir() {
  const fromEnv = process.env.JJ_GLOBAL_CONFIG_DIR || process.env.DAJI_CONFIG_DIR;
  if (fromEnv) return path.resolve(fromEnv);
  return defaultJjFlowHome();
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
      // P2 identity is a hard cut: stale naming.json must not keep RALPH-{slug}-{date}.
      run_id_pattern: DEFAULT_NAMING_CONFIG.ralph.run_id_pattern,
      run_id_regex: DEFAULT_NAMING_CONFIG.ralph.run_id_regex,
      task_dir_pattern: DEFAULT_NAMING_CONFIG.ralph.task_dir_pattern,
      layout: {
        ...DEFAULT_NAMING_CONFIG.ralph.layout,
        ...((raw.ralph && raw.ralph.layout) || {}),
        active_run: DEFAULT_NAMING_CONFIG.ralph.layout.active_run,
        completed_run: DEFAULT_NAMING_CONFIG.ralph.layout.completed_run
      },
      legacy_tolerance: {
        ...DEFAULT_NAMING_CONFIG.ralph.legacy_tolerance,
        ...((raw.ralph && raw.ralph.legacy_tolerance) || {})
      },
      knowledge_contribute: {
        ...DEFAULT_NAMING_CONFIG.ralph.knowledge_contribute,
        ...((raw.ralph && raw.ralph.knowledge_contribute) || {})
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
 * Resolve where jj-dispatch stores coordination state.
 *
 * Order:
 * 1. explicit path (--control-root / API)
 * 2. JJ_DISPATCH_CONTROL_ROOT
 * 3. naming.json dispatch.control_root (expanded; product default ~/.jj-flow)
 */
export function resolveDispatchControlRoot({
  explicit = null,
  configDir = resolveGlobalConfigDir()
} = {}) {
  if (explicit && String(explicit).trim()) return expandUserPath(String(explicit).trim());
  const fromEnv = process.env.JJ_DISPATCH_CONTROL_ROOT;
  if (fromEnv && String(fromEnv).trim()) return expandUserPath(String(fromEnv).trim());

  const cfg = loadNamingConfig({ configDir, required: false });
  const configured = cfg?.dispatch?.control_root || DEFAULT_NAMING_CONFIG.dispatch.control_root;
  if (configured && String(configured).trim()) {
    return expandUserPath(String(configured).trim());
  }
  return defaultDispatchControlRoot();
}

/**
 * Resolve portfolio top-level directory (business repos / map / optional knowledge).
 *
 * Order:
 * 1. explicit
 * 2. JJ_PORTFOLIO_ROOT
 * 3. naming.json dispatch.portfolio_root
 * 4. null (no portfolio — single-repo / home-only install)
 */
export function resolvePortfolioRoot({
  explicit = null,
  configDir = resolveGlobalConfigDir()
} = {}) {
  if (explicit && String(explicit).trim()) return expandUserPath(String(explicit).trim());
  const fromEnv = process.env.JJ_PORTFOLIO_ROOT;
  if (fromEnv && String(fromEnv).trim()) return expandUserPath(String(fromEnv).trim());

  const cfg = loadNamingConfig({ configDir, required: false });
  const configured = cfg?.dispatch?.portfolio_root || cfg?.portfolio_root || null;
  if (configured && String(configured).trim()) {
    return expandUserPath(String(configured).trim());
  }
  return null;
}

/**
 * Resolve global KB root.
 *
 * Order:
 * 1. explicit
 * 2. PORTFOLIO_KB_ROOT
 * 3. naming.json dispatch.knowledge_root
 * 4. {control_root}/knowledge
 * 5. ~/.jj-flow/knowledge
 */
export function resolveKnowledgeRoot({
  explicit = null,
  configDir = resolveGlobalConfigDir()
} = {}) {
  if (explicit && String(explicit).trim()) return expandUserPath(String(explicit).trim());
  const fromEnv = process.env.PORTFOLIO_KB_ROOT;
  if (fromEnv && String(fromEnv).trim()) return expandUserPath(String(fromEnv).trim());

  const cfg = loadNamingConfig({ configDir, required: false });
  const configured = cfg?.dispatch?.knowledge_root || cfg?.knowledge_root || null;
  if (configured && String(configured).trim()) {
    return expandUserPath(String(configured).trim());
  }
  const control = resolveDispatchControlRoot({ configDir });
  if (control) return path.join(control, 'knowledge');
  return path.join(defaultJjFlowHome(), 'knowledge');
}

/**
 * Resolve project map path (map.md).
 *
 * Order: explicit > JJ_PROJECT_MAP > naming.json project_map > {control_root}/map.md > ~/.jj-flow/map.md
 */
export function resolveProjectMapPath({
  explicit = null,
  configDir = resolveGlobalConfigDir()
} = {}) {
  if (explicit && String(explicit).trim()) return expandUserPath(String(explicit).trim());
  const fromEnv = process.env.JJ_PROJECT_MAP;
  if (fromEnv && String(fromEnv).trim()) return expandUserPath(String(fromEnv).trim());

  const cfg = loadNamingConfig({ configDir, required: false });
  const configured = cfg?.project_map || null;
  if (configured && String(configured).trim()) {
    return expandUserPath(String(configured).trim());
  }
  const control = resolveDispatchControlRoot({ configDir });
  if (control) return path.join(control, 'map.md');
  return path.join(defaultJjFlowHome(), 'map.md');
}

/**
 * Default control-plane.json path for a delivery under the resolved control root.
 */
export function resolveDeliveryManifestPath(deliveryId, options = {}) {
  if (!deliveryId || !String(deliveryId).trim()) {
    throw new Error('delivery_id is required to resolve control-plane path');
  }
  const root = options.ensure
    ? ensureDispatchControlRoot(options)
    : resolveDispatchControlRoot(options);
  const id = String(deliveryId).trim();
  return path.join(root, '.workflow', 'dispatch', id, 'control-plane.json');
}

/**
 * Snapshot of configured directories for doctor / agent diagnostics.
 */
export function describePathConfig({ configDir = resolveGlobalConfigDir() } = {}) {
  const cfg = loadNamingConfig({ configDir, required: false });
  const controlRoot = resolveDispatchControlRoot({ configDir });
  const portfolioRoot = resolvePortfolioRoot({ configDir });
  const knowledgeRoot = resolveKnowledgeRoot({ configDir });
  const projectMap = resolveProjectMapPath({ configDir });
  return {
    config_dir: configDir || null,
    naming_config_path: namingConfigPath(configDir),
    naming_config_source: cfg.source || 'defaults',
    control_root: controlRoot,
    control_root_exists: fs.existsSync(controlRoot),
    portfolio_root: portfolioRoot,
    knowledge_root: knowledgeRoot,
    project_map: projectMap,
    defaults: {
      control_root: DEFAULT_NAMING_CONFIG.dispatch.control_root,
      portfolio_root: null,
      knowledge_root: DEFAULT_NAMING_CONFIG.dispatch.knowledge_root,
      project_map: DEFAULT_NAMING_CONFIG.project_map
    },
    env: {
      JJ_GLOBAL_CONFIG_DIR: process.env.JJ_GLOBAL_CONFIG_DIR || process.env.DAJI_CONFIG_DIR || null,
      JJ_DISPATCH_CONTROL_ROOT: process.env.JJ_DISPATCH_CONTROL_ROOT || null,
      JJ_PORTFOLIO_ROOT: process.env.JJ_PORTFOLIO_ROOT || null,
      PORTFOLIO_KB_ROOT: process.env.PORTFOLIO_KB_ROOT || null,
      JJ_PROJECT_MAP: process.env.JJ_PROJECT_MAP || null
    }
  };
}

/**
 * Ensure the control root directory exists (mkdir -p).
 * Call before first write of control-plane / task assets.
 */
export function ensureDispatchControlRoot(options = {}) {
  const root = resolveDispatchControlRoot(options);
  const defaultHome = defaultJjFlowHome();
  if (path.resolve(root) === path.resolve(defaultHome)) {
    ensureJjFlowHome({ root });
    return root;
  }
  fs.mkdirSync(root, { recursive: true });
  const readme = path.join(root, 'README.md');
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(
      readme,
      [
        '# jj-flow dispatch control data',
        '',
        'Default location: `~/.jj-flow` (user home).',
        '',
        'This directory holds dispatch state, `map.md`, and `knowledge/`.',
        'Agents ask before adding a map row or feeding knowledge.',
        '',
        'Override in `naming.json` only when a local portfolio must live elsewhere.',
        '',
        'Config file: `~/.jj-flow/naming.json` (or `$JJ_GLOBAL_CONFIG_DIR/naming.json`).',
        'Env overrides: `JJ_DISPATCH_CONTROL_ROOT`, `JJ_PORTFOLIO_ROOT`, `PORTFOLIO_KB_ROOT`, `JJ_PROJECT_MAP`.',
        '',
        'Layout:',
        '`map.md`, `knowledge/index/search.json`, `.workflow/dispatch/<DELIVERY_ID>/control-plane.json`, `.workflow/tasks/…`',
        '',
        'Business source code does not belong here.',
        ''
      ].join('\n'),
      'utf8'
    );
  }
  const workflow = path.join(root, '.workflow', 'dispatch');
  fs.mkdirSync(workflow, { recursive: true });
  const tasks = path.join(root, '.workflow', 'tasks');
  fs.mkdirSync(tasks, { recursive: true });
  return root;
}

export function normalizeRalphSlug(input) {
  return String(input || '')
    .trim()
    .replace(/^(?:RALPH|task)-/i, '')
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
  void date;
  const normalized = normalizeRalphSlug(slug);
  if (!normalized) throw new Error('slug is required');
  const slugRe = new RegExp(config.ralph.slug_regex);
  if (!slugRe.test(normalized)) throw new Error('slug must be kebab-case: ' + normalized);
  const runId = 'task-' + normalized;
  const runRe = new RegExp(config.ralph.run_id_regex);
  if (!runRe.test(runId)) throw new Error('built run_id failed config regex: ' + runId);
  return runId;
}

export function isStrictRalphRunId(runId, config = loadNamingConfig()) {
  return new RegExp(config.ralph.run_id_regex).test(String(runId || ''));
}

export function assertStrictRalphRunId(runId, config = loadNamingConfig()) {
  if (!isStrictRalphRunId(runId, config)) {
    throw new Error('run_id must match ' + config.ralph.run_id_pattern + ' (task-<slug>), got: ' + runId);
  }
  return runId;
}

export function buildArchiveDirNameFromRunId(runId, now = new Date(), config = loadNamingConfig()) {
  const raw = String(runId || '').replace(/^(?:RALPH|task)-/, '');
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
