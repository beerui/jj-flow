import fs from 'node:fs';
import path from 'node:path';
import { expandUserPath, resolveProjectMapPath } from './namingConfig.mjs';

export const UNGROUPED_FAMILY_IDS = new Set(['', '-', 'ungrouped', '未分组', 'other', '其他']);

function stripTicks(value) {
  return String(value || '').trim().replace(/^`+|`+$/g, '').trim();
}

/** Markdown table placeholder `-` is not a value. */
function cellValue(value) {
  const s = stripTicks(value);
  return !s || s === '-' ? '' : s;
}

function parseAliases(raw) {
  return stripTicks(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function projectKeyFromPath(p) {
  const clean = stripTicks(p).replace(/\\/g, '/').replace(/\/$/, '');
  const parts = clean.split('/').filter(Boolean);
  if (!parts.length) return '';
  return parts[parts.length - 1].toLowerCase();
}

export function isGroupedFamily(family) {
  const id = String(family || '').trim().toLowerCase();
  return Boolean(id) && !UNGROUPED_FAMILY_IDS.has(id) && !UNGROUPED_FAMILY_IDS.has(String(family || '').trim());
}

function normalizePath(p) {
  const expanded = expandUserPath(stripTicks(p));
  if (!expanded) return '';
  return expanded.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase();
}

function parseTableRows(lines, start, familyFromHeading) {
  const header = lines[start].split('|').map((c) => c.trim()).filter(Boolean);
  let i = start + 1;
  if (i < lines.length && /^\|?\s*-+/.test(lines[i])) i += 1;
  const rows = [];
  for (; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) break;
    if (/^\|?\s*-+/.test(line)) continue;
    const cells = line.split('|').map((c) => c.trim());
    const body = cells.filter((_, idx) => !(idx === 0 && cells[idx] === '') && !(idx === cells.length - 1 && cells[idx] === ''));
    if (body.length < 2) continue;
    const row = {};
    header.forEach((h, idx) => { row[h] = body[idx] || ''; });
    const name = stripTicks(row['中文名称'] || row.name || row.Name || '');
    const aliases = parseAliases(row.aliases || row.Aliases || '');
    const projectPath = stripTicks(row.path || row.Path || '');
    const familyCell = cellValue(row.family || row.Family);
    const family = familyCell || (isGroupedFamily(familyFromHeading) ? stripTicks(familyFromHeading) : '');
    if (!name && !projectPath) continue;
    rows.push({
      name,
      aliases,
      path: projectPath,
      type: cellValue(row.type || row.Type) || 'repo',
      host: cellValue(row.host || row.Host) || null,
      family,
      entry: cellValue(row.entry || row.Entry),
      project_key: projectKeyFromPath(projectPath) || (aliases[0] || name).toLowerCase().replace(/\s+/g, '-'),
      heading: familyFromHeading || ''
    });
  }
  return { rows, next: i };
}

export function parseProjectMap(mapPath) {
  const file = mapPath ? path.resolve(mapPath) : resolveProjectMapPath();
  if (!file || !fs.existsSync(file)) {
    return { path: file || null, exists: false, projects: [] };
  }
  const md = fs.readFileSync(file, 'utf8');
  const lines = md.split(/\r?\n/);
  const projects = [];
  let heading = '';
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const h = line.match(/^##\s+(.+)$/);
    if (h) {
      heading = h[1].trim();
      continue;
    }
    if (line.startsWith('|') && /aliases/i.test(line) && /path/i.test(line)) {
      const parsed = parseTableRows(lines, i, heading);
      projects.push(...parsed.rows);
      i = parsed.next - 1;
    }
  }
  return { path: file, exists: true, projects };
}

export function loadProjectMap(options = {}) {
  return parseProjectMap(options.mapPath || resolveProjectMapPath(options));
}

export function findProjectByCwd(cwd = process.cwd(), options = {}) {
  const map = options.map || loadProjectMap(options);
  const cwdN = normalizePath(cwd);
  if (!cwdN || !map.projects.length) return null;
  let best = null;
  let bestScore = 0;
  for (const project of map.projects) {
    const pPath = normalizePath(project.path);
    const host = project.host ? normalizePath(project.host) : '';
    let score = 0;
    if (pPath && cwdN === pPath) score = 200 + Math.min(pPath.length, 80);
    else if (pPath && cwdN.startsWith(pPath + '/')) score = 150 + Math.min(pPath.length, 80);
    else if (host && (cwdN === host || cwdN.startsWith(host + '/'))) score = 40;
    if (score > bestScore) {
      bestScore = score;
      best = project;
    }
  }
  return best;
}

export function resolveProjectKeyFromCwd(cwd = process.cwd(), options = {}) {
  const hit = findProjectByCwd(cwd, options);
  if (hit?.project_key) return hit.project_key;
  const base = path.basename(path.resolve(cwd || '.')).toLowerCase();
  if (!base || base === 'a' || base === 'knowledge') return null;
  return base;
}

export function familyProjectKeys(family, options = {}) {
  if (!isGroupedFamily(family)) return [];
  const map = options.map || loadProjectMap(options);
  const want = String(family).trim().toLowerCase();
  return map.projects
    .filter((p) => String(p.family || p.heading || '').trim().toLowerCase() === want)
    .map((p) => p.project_key)
    .filter(Boolean);
}

export function familyOfProjectKey(projectKey, options = {}) {
  const map = options.map || loadProjectMap(options);
  const key = String(projectKey || '').trim().toLowerCase();
  if (!key) return '';
  const hit = map.projects.find((p) => String(p.project_key || '').toLowerCase() === key);
  if (!hit) return '';
  const raw = String(hit.family || hit.heading || '').trim();
  return isGroupedFamily(raw) ? raw : '';
}

function tableHasFamilyColumn(headerLine) {
  return /\bfamily\b/i.test(headerLine);
}

/**
 * Append a project row. Caller must have user approval.
 * Returns { ok, status: added|exists|error, project }.
 */
export function appendProjectMapRow({
  mapPath = resolveProjectMapPath(),
  name,
  aliases = [],
  projectPath,
  type = 'repo',
  host = '',
  family = '',
  entry = ''
} = {}) {
  if (!mapPath) return { ok: false, status: 'error', reason: 'project map path not resolved' };
  const abs = path.resolve(mapPath);
  if (!fs.existsSync(abs)) {
    return { ok: false, status: 'error', reason: 'project map not found: ' + abs };
  }
  const wantedPath = stripTicks(projectPath);
  if (!wantedPath) return { ok: false, status: 'error', reason: 'path is required' };
  const map = parseProjectMap(abs);
  const pathN = normalizePath(wantedPath);
  const existing = map.projects.find((p) => normalizePath(p.path) === pathN);
  if (existing) {
    return { ok: true, status: 'exists', project: existing, map_path: abs };
  }

  const displayName = stripTicks(name) || path.basename(wantedPath);
  const aliasText = (Array.isArray(aliases) ? aliases : parseAliases(aliases)).join(', ');
  const familyText = stripTicks(family);
  const rowCells = [displayName, aliasText, wantedPath, type || 'repo', host || '-', familyText || '-', entry || '-'];

  let md = fs.readFileSync(abs, 'utf8');
  const lines = md.split(/\r?\n/);
  const headingWanted = familyText || 'Ungrouped';
  let headerIdx = -1;
  let currentHeading = '';
  for (let i = 0; i < lines.length; i += 1) {
    const h = lines[i].trim().match(/^##\s+(.+)$/);
    if (h) currentHeading = h[1].trim();
    if (lines[i].trim().startsWith('|') && /aliases/i.test(lines[i]) && /path/i.test(lines[i])) {
      if (familyText) {
        if (currentHeading.toLowerCase() === headingWanted.toLowerCase()) {
          headerIdx = i;
          break;
        }
      } else if (!isGroupedFamily(currentHeading)) {
        headerIdx = i;
        break;
      }
    }
  }

  const rowLine = '| ' + rowCells.join(' | ') + ' |';
  if (headerIdx >= 0) {
    let insertAt = headerIdx + 1;
    if (insertAt < lines.length && /^\|?\s*-+/.test(lines[insertAt].trim())) insertAt += 1;
    while (insertAt < lines.length && lines[insertAt].trim().startsWith('|')) insertAt += 1;
    const headerLine = lines[headerIdx];
    const cells = tableHasFamilyColumn(headerLine) ? rowCells : rowCells.slice(0, 5).concat(rowCells[6] || '-');
    const fitted = '| ' + cells.join(' | ') + ' |';
    lines.splice(insertAt, 0, fitted);
    md = lines.join('\n');
  } else {
    const block = [
      '',
      '## ' + headingWanted,
      '',
      '| 中文名称 | aliases | path | type | host | family | entry |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      rowLine,
      ''
    ].join('\n');
    md = md.replace(/\s*$/, '') + '\n' + block;
  }
  fs.writeFileSync(abs, md.endsWith('\n') ? md : md + '\n', 'utf8');
  const project = {
    name: displayName,
    aliases: parseAliases(aliasText),
    path: wantedPath,
    type: type || 'repo',
    host: host || null,
    family: familyText,
    entry,
    project_key: projectKeyFromPath(wantedPath)
  };
  return { ok: true, status: 'added', project, map_path: abs };
}
