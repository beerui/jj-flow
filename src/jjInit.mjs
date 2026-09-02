import fs from 'node:fs';
import path from 'node:path';
import {
  defaultHomeMapMarkdown,
  defaultKnowledgeSearchIndex,
  ensureJjFlowHome
} from './homeLayout.mjs';
import { ingestContribution } from './homeKnowledge.mjs';
import {
  resolveDispatchControlRoot,
  resolveKnowledgeRoot,
  resolveProjectMapPath
} from './namingConfig.mjs';
import {
  appendProjectMapRow,
  findProjectByCwd,
  isGroupedFamily,
  loadProjectMap,
  projectKeyFromPath
} from './projectMap.mjs';

function readJson(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function firstHeading(file) {
  if (!file || !fs.existsSync(file)) return '';
  const md = fs.readFileSync(file, 'utf8');
  const match = md.match(/^#\s+(.+)$/m);
  if (!match) return '';
  const title = String(match[1] || '').replace(/[`#]/g, '').trim();
  if (!title || title.length > 48) return '';
  if (/agent rules|AGENTS\.md|执行规则/i.test(title)) return '';
  return title;
}

function packageName(projectPath) {
  const pkg = readJson(path.join(projectPath, 'package.json'));
  if (!pkg?.name) return '';
  return String(pkg.name).replace(/^@[^/]+\//, '').trim();
}

export function guessProjectName(projectPath) {
  const fromAgents = firstHeading(path.join(projectPath, 'AGENTS.md'))
    || firstHeading(path.join(projectPath, 'Agents.md'))
    || firstHeading(path.join(projectPath, 'AGENT.md'));
  if (fromAgents) return fromAgents;
  return packageName(projectPath) || path.basename(path.resolve(projectPath));
}

export function guessProjectAliases(projectPath) {
  const aliases = [];
  const base = path.basename(path.resolve(projectPath));
  if (base) aliases.push(base);
  const pkg = packageName(projectPath);
  if (pkg && pkg !== base) aliases.push(pkg);
  return [...new Set(aliases)];
}

function guessEntry(projectPath) {
  for (const file of ['AGENTS.md', 'Agents.md', 'ARCHITECTURE.md']) {
    if (fs.existsSync(path.join(projectPath, file))) return file;
  }
  return '';
}

export function looksLikeProjectDir(dir) {
  if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return false;
  return (
    fs.existsSync(path.join(dir, '.git'))
    || fs.existsSync(path.join(dir, 'package.json'))
    || fs.existsSync(path.join(dir, 'AGENTS.md'))
    || fs.existsSync(path.join(dir, 'Agents.md'))
  );
}

export function listScanTargets(cwd, root = null) {
  if (!root) return [path.resolve(cwd || '.')];
  const abs = path.resolve(root);
  const out = [];
  if (looksLikeProjectDir(abs)) out.push(abs);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return out;
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    if (!ent.isDirectory() || ent.name.startsWith('.')) continue;
    const child = path.join(abs, ent.name);
    if (looksLikeProjectDir(child)) out.push(child);
  }
  return [...new Set(out.map((p) => path.resolve(p)))];
}

function groupedFamily(project) {
  const raw = String(project?.family || project?.heading || '').trim();
  return isGroupedFamily(raw) ? raw : '';
}

function listFamilies(map) {
  const set = new Set();
  for (const project of map.projects || []) {
    const family = groupedFamily(project);
    if (family) set.add(family);
  }
  return [...set];
}

function ensureInitLayout() {
  const home = ensureJjFlowHome({ root: resolveDispatchControlRoot() });
  const mapPath = resolveProjectMapPath() || home.map_path;
  const knowledgeRoot = resolveKnowledgeRoot() || home.knowledge_root;
  if (!fs.existsSync(mapPath)) {
    fs.mkdirSync(path.dirname(mapPath), { recursive: true });
    fs.writeFileSync(mapPath, defaultHomeMapMarkdown(), 'utf8');
  }
  const searchPath = path.join(knowledgeRoot, 'index', 'search.json');
  if (!fs.existsSync(searchPath)) {
    fs.mkdirSync(path.dirname(searchPath), { recursive: true });
    fs.writeFileSync(searchPath, JSON.stringify(defaultKnowledgeSearchIndex(), null, 2) + '\n');
  }
  return { home, mapPath, knowledgeRoot };
}

function contributionTitles(contribution) {
  const titles = [];
  const cap = contribution?.capability_hint?.title;
  if (cap) titles.push(String(cap).trim());
  for (const cand of contribution?.candidates || []) {
    if (cand?.title) titles.push(String(cand.title).trim());
  }
  return titles.filter(Boolean);
}

function contributionIngested(items, projectKey, contribution) {
  const titles = contributionTitles(contribution);
  if (!titles.length) return false;
  return titles.every((title) => items.some((row) => (
    String(row.project_key || '') === projectKey
    && String(row.title || '') === title
  )));
}

export function listKnowledgePackages(projectPath) {
  const ralphRoot = path.join(projectPath, '.workflow', 'ralph');
  const files = [];
  function walk(dir) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name === 'knowledge-contribution.json') files.push(full);
    }
  }
  walk(ralphRoot);
  return files;
}

function describePackage(file, projectKey, items) {
  const contribution = readJson(file) || {};
  return {
    file,
    run_id: contribution.run_id || null,
    title: contribution.capability_hint?.title
      || contribution.intent?.title
      || path.basename(path.dirname(file)),
    ingested: contributionIngested(items, projectKey, contribution)
  };
}

export function formatInitPreviewView(payload) {
  const lines = ['jj-flow 接入提案'];
  lines.push(`主目录  ${payload?.home?.root || ''}`);
  lines.push(`地图    ${payload?.indexed_count ?? 0} 个已索引`);
  const families = payload?.families || [];
  if (families.length) lines.push(`现有家族  ${families.join('、')}`);
  for (const project of payload?.projects || []) {
    const status = project.status === 'indexed' ? '已在地图' : '待加入';
    const pending = (project.knowledge || []).filter((row) => !row.ingested);
    const aliasText = (project.aliases || []).filter(Boolean).join(',');
    const familyText = project.family ? `  家族=${project.family}` : '';
    const pendingText = pending.length
      ? `  待投喂=${pending.length}  ${pending.map((row) => row.title).filter(Boolean).join('；')}`
      : '  待投喂=0';
    lines.push(
      `  ${status}  ${project.name}  (${project.project_key})`
      + (aliasText ? `  aliases=${aliasText}` : '')
      + `  ${project.path}${familyText}${pendingText}`
    );
  }
  return lines.join('\n');
}

/**
 * Preview home + proposed map rows + pending knowledge packages.
 * Ensures empty ~/.jj-flow structure. Does not write map rows or knowledge.
 */
export function previewInit({ cwd = process.cwd(), root = null } = {}) {
  const { home, mapPath, knowledgeRoot } = ensureInitLayout();
  const map = loadProjectMap({ mapPath });
  const search = readJson(path.join(knowledgeRoot, 'index', 'search.json')) || { items: [] };
  const items = Array.isArray(search.items) ? search.items : [];
  const targets = listScanTargets(cwd, root);

  const projects = targets.map((projectPath) => {
    const hit = findProjectByCwd(projectPath, { map });
    const projectKey = hit?.project_key || projectKeyFromPath(projectPath);
    const knowledge = listKnowledgePackages(projectPath).map((file) => describePackage(file, projectKey, items));
    if (hit) {
      return {
        status: 'indexed',
        path: projectPath,
        name: hit.name,
        aliases: hit.aliases || [],
        family: groupedFamily(hit),
        project_key: projectKey,
        entry: hit.entry || '',
        knowledge
      };
    }
    return {
      status: 'proposed',
      path: projectPath,
      name: guessProjectName(projectPath),
      aliases: guessProjectAliases(projectPath),
      family: '',
      project_key: projectKey,
      entry: guessEntry(projectPath),
      knowledge
    };
  });

  const payload = {
    ok: true,
    action: 'preview',
    home: {
      root: home.root,
      map_path: mapPath,
      knowledge_root: knowledgeRoot,
      created: home.created
    },
    families: listFamilies(map),
    indexed_count: (map.projects || []).length,
    projects
  };
  payload.user_view = formatInitPreviewView(payload);
  return payload;
}

/** User-approved map write. */
export function joinInit({
  cwd = process.cwd(),
  projectPath = null,
  name = '',
  aliases = [],
  family = '',
  type = 'repo',
  host = '',
  entry = ''
} = {}) {
  const { mapPath } = ensureInitLayout();
  return appendProjectMapRow({
    mapPath,
    projectPath: projectPath || cwd,
    name,
    aliases,
    family,
    type,
    host,
    entry
  });
}

function resolveContributionFile({ cwd, runId, file }) {
  if (file) return path.resolve(file);
  if (!runId) return null;
  const live = path.join(cwd, '.workflow', 'ralph', runId, 'knowledge-contribution.json');
  if (fs.existsSync(live)) return live;
  return listKnowledgePackages(cwd).find((pkg) => readJson(pkg)?.run_id === runId) || null;
}

/** User-approved knowledge ingest for one contribution package. */
export function ingestInit({
  cwd = process.cwd(),
  runId = null,
  file = null,
  projectKey = null
} = {}) {
  ensureInitLayout();
  const contribFile = resolveContributionFile({ cwd, runId, file });
  if (!contribFile) {
    return { ok: false, status: 'error', reason: 'knowledge-contribution.json not found' };
  }
  const contribution = readJson(contribFile);
  if (!contribution) {
    return { ok: false, status: 'error', reason: 'invalid contribution file: ' + contribFile };
  }
  const result = ingestContribution(contribution, { cwd, projectKey });
  return { ...result, file: contribFile };
}
