import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const HOME_NAMING_FILENAME = 'naming.json';
export const HOME_MAP_FILENAME = 'map.md';
export const HOME_KNOWLEDGE_DIRNAME = 'knowledge';

export function defaultJjFlowHome(homeDir = os.homedir()) {
  if (process.env.JJ_FLOW_HOME && String(process.env.JJ_FLOW_HOME).trim()) {
    return path.resolve(String(process.env.JJ_FLOW_HOME).trim());
  }
  return path.join(homeDir || os.homedir(), '.jj-flow');
}

export function defaultHomeNamingJson(root = defaultJjFlowHome()) {
  const rootPosix = String(root).replaceAll('\\', '/');
  return {
    schema_version: 'jj-flow/naming/1.0',
    project_map: path.join(root, HOME_MAP_FILENAME).replaceAll('\\', '/'),
    dispatch: {
      portfolio_root: null,
      control_root: rootPosix,
      knowledge_root: path.join(root, HOME_KNOWLEDGE_DIRNAME).replaceAll('\\', '/')
    },
    ralph: {
      knowledge_contribute: {
        hook: 'none',
        cli: null,
        fail_open: true,
        timeout_ms: 30000,
        on_finalize: false
      }
    }
  };
}

export function defaultHomeMapMarkdown() {
  return [
    '# Project map (global)',
    '',
    '> Default location: `~/.jj-flow/map.md`.',
    '> Match a row by Chinese name / aliases / directory name / package name / remote repo name; `path` is the work target.',
    '> New projects are **not** indexed until the user agrees.',
    '> `##` headings are families. Same-family repos may share knowledge on retrieve; ungrouped rows stay same-project only.',
    '',
    '## Ungrouped',
    '',
    '| 中文名称 | aliases | path | type | host | family | entry |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ''
  ].join('\n');
}

export function defaultKnowledgeCatalog() {
  return {
    schema_version: 'portfolio/catalog/1.0',
    updated_at: new Date().toISOString(),
    root: 'knowledge',
    counts: { items: 0, active: 0, candidate: 0 }
  };
}

export function defaultKnowledgeSearchIndex() {
  return {
    schema_version: 'portfolio/search/1.0',
    updated_at: new Date().toISOString(),
    items: []
  };
}

function writeIfMissing(filePath, body) {
  if (fs.existsSync(filePath)) return false;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body, 'utf8');
  return true;
}

function writeJsonIfMissing(filePath, value) {
  return writeIfMissing(filePath, JSON.stringify(value, null, 2) + '\n');
}

/**
 * Create the product-default user home layout (map + knowledge + dispatch dirs).
 * Never overwrites an existing naming.json / map.md / search index.
 */
export function ensureJjFlowHome({
  homeDir = os.homedir(),
  root = null
} = {}) {
  const home = root ? path.resolve(root) : defaultJjFlowHome(homeDir);
  fs.mkdirSync(home, { recursive: true });

  const created = {
    naming: writeJsonIfMissing(path.join(home, HOME_NAMING_FILENAME), defaultHomeNamingJson(home)),
    map: writeIfMissing(path.join(home, HOME_MAP_FILENAME), defaultHomeMapMarkdown()),
    catalog: false,
    search: false,
    readme: false
  };

  const knowledgeRoot = path.join(home, HOME_KNOWLEDGE_DIRNAME);
  fs.mkdirSync(path.join(knowledgeRoot, 'index'), { recursive: true });
  created.catalog = writeJsonIfMissing(path.join(knowledgeRoot, 'catalog.json'), defaultKnowledgeCatalog());
  created.search = writeJsonIfMissing(
    path.join(knowledgeRoot, 'index', 'search.json'),
    defaultKnowledgeSearchIndex()
  );

  const readme = path.join(home, 'README.md');
  created.readme = writeIfMissing(
    readme,
    [
      '# jj-flow user home',
      '',
      'Product default: `~/.jj-flow` (this directory).',
      '',
      '| Path | Role |',
      '| --- | --- |',
      '| `naming.json` | Directory SSOT |',
      '| `map.md` | Global project index (user-approved rows only) |',
      '| `knowledge/` | Global knowledge index (`index/search.json`) |',
      '| `.workflow/dispatch/` | Multi-project dispatch state |',
      '| `.workflow/tasks/` | Task index |',
      '',
      'Do not put business source code here.',
      'Join the map and bootstrap knowledge via `$jj-init` after the user agrees.',
      ''
    ].join('\n')
  );

  fs.mkdirSync(path.join(home, '.workflow', 'dispatch'), { recursive: true });
  fs.mkdirSync(path.join(home, '.workflow', 'tasks'), { recursive: true });

  return {
    root: home,
    naming_path: path.join(home, HOME_NAMING_FILENAME),
    map_path: path.join(home, HOME_MAP_FILENAME),
    knowledge_root: knowledgeRoot,
    created
  };
}
