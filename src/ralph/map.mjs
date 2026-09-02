/** P1a split from src/ralph.mjs — move not rewrite.
 * business-map merge / elevation / map-find. Intentionally under 300 lines.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  RALPH_MAP_REL,
  RALPH_MAP_SCHEMA_VERSION,
  RALPHS_DIR_REL,
  loadMap,
  loadRun,
  mapPath,
  nowIso,
  saveMap,
  unique
} from './state.mjs';
import { readRunArtifactText } from './gates.mjs';

/**
 * Weak process "pheromone" lessons (stagnation / budget / intensity).
 * Default: stored in process_lessons, not durable lessons (archive elevation design).
 */
export function deriveAutoLessonsFromRun(run, cwd = process.cwd()) {
  if (!run || typeof run !== 'object') return [];
  const out = [];
  const kind = run.intervention_needed?.kind;
  if (kind === 'STAGNATION') {
    out.push(
      'STAGNATION on ' + run.run_id
      + ': deliver loop stalled'
      + (run.stagnation?.last_signal ? (' (signal=' + run.stagnation.last_signal + ')') : '')
      + '; change strategy or narrow scope'
    );
  }
  if (kind === 'MAX_ITERATIONS') {
    out.push('MAX_ITERATIONS on ' + run.run_id + ': raise budget or split scope');
  }
  if (run.intensity === 'strict') {
    out.push('intensity=strict on ' + run.run_id + ': required judgment layer before accept');
  }
  try {
    const progress = readRunArtifactText(run, 'progress', cwd);
    if (progress && /BLOCKED kind=STAGNATION|kind=STAGNATION/i.test(progress) && kind !== 'STAGNATION') {
      out.push('prior STAGNATION signals on ' + run.run_id + ': avoid repeating the same failed approach');
    }
  } catch {
    // progress optional
  }
  return unique(out);
}

/**
 * Build L1 capability + lesson buckets for map elevation / L2 contribution.
 * @param {object} options
 * @param {boolean} [options.include_process_lessons_in_map=false]
 */
export function buildElevationFromRun(run, {
  modules = [],
  lessons = [],
  keywords = [],
  acceptance = [],
  status = 'done',
  cwd = process.cwd(),
  include_process_lessons_in_map = false
} = {}) {
  const id = run.capability_ids?.[0] || ('CAP-' + run.run_id.replace(/^RALPH-/, '').toLowerCase());
  const defaultAcceptance = path.join(RALPHS_DIR_REL, run.run_id, 'acceptance.md').replaceAll(String.fromCharCode(92), String.fromCharCode(47));
  const processLessons = deriveAutoLessonsFromRun(run, cwd);
  const durableLessons = unique([...(lessons || [])]);
  const mainLessons = include_process_lessons_in_map
    ? unique([...durableLessons, ...processLessons])
    : durableLessons;
  const capability = {
    id,
    title: run.title,
    status,
    summary: run.goal,
    modules: unique(modules || []),
    lessons: mainLessons,
    process_lessons: processLessons,
    keywords: unique([...(keywords || []), ...tokenize(run.title), ...tokenize(run.goal)]),
    acceptance: unique([...(acceptance || []), defaultAcceptance]),
    run_refs: [run.run_id]
  };
  return {
    capability,
    durable_lessons: durableLessons,
    process_lessons: processLessons
  };
}

export function capabilityFromRun(run, options = {}) {
  return buildElevationFromRun(run, options).capability;
}

export function mergeCapabilityIntoMap(map, capability) {
  const next = { schema_version: RALPH_MAP_SCHEMA_VERSION, updated_at: nowIso(), capabilities: [...(map.capabilities || [])] };
  const index = next.capabilities.findIndex((item) => item.id === capability.id);
  if (index < 0) next.capabilities.push(normalizeCapability(capability));
  else {
    const existing = next.capabilities[index];
    next.capabilities[index] = normalizeCapability({
      ...existing,
      ...capability,
      modules: unique([...(existing.modules || []), ...(capability.modules || [])]),
      lessons: unique([...(existing.lessons || []), ...(capability.lessons || [])]),
      process_lessons: unique([...(existing.process_lessons || []), ...(capability.process_lessons || [])]).slice(-20),
      keywords: unique([...(existing.keywords || []), ...(capability.keywords || [])]),
      acceptance: unique([...(existing.acceptance || []), ...(capability.acceptance || [])]),
      run_refs: unique([...(existing.run_refs || []), ...(capability.run_refs || [])])
    });
  }
  return next;
}

function normalizeCapability(capability) {
  const out = {
    id: capability.id,
    title: capability.title,
    status: capability.status,
    summary: capability.summary || '',
    modules: unique(capability.modules || []),
    lessons: unique(capability.lessons || []),
    keywords: unique(capability.keywords || []),
    acceptance: unique(capability.acceptance || []),
    run_refs: unique(capability.run_refs || [])
  };
  const processLessons = unique(capability.process_lessons || []);
  if (processLessons.length) out.process_lessons = processLessons;
  return out;
}

export function mapMergeFromRun(runId, options = {}, cwd = process.cwd()) {
  const run = loadRun(runId, cwd);
  if (run.status === 'ABANDONED') {
    throw new Error('map-merge forbidden for ABANDONED runs (not a durable capability source)');
  }
  if (run.gates?.accept !== 'PASS' && !options.force) {
    throw new Error('map-merge requires gates.accept=PASS (pass force:true or --force to override)');
  }
  const map = loadMap(cwd);
  const elevation = buildElevationFromRun(run, { ...options, cwd });
  const next = mergeCapabilityIntoMap(map, elevation.capability);
  saveMap(next, cwd);
  return { map: next, capability: elevation.capability, elevation };
}

export function tokenize(text = '') {
  return String(text).toLowerCase().split(/[^a-z0-9\u4e00-\u9fff]+/i).map((item) => item.trim()).filter((item) => item.length >= 2);
}

export function findInMap(map, query, { limit = 10 } = {}) {
  const tokens = tokenize(query);
  const matches = [];
  for (const cap of map.capabilities || []) {
    const hay = [
      cap.id,
      cap.title,
      cap.summary,
      ...(cap.keywords || []),
      ...(cap.modules || []),
      ...(cap.lessons || []),
      ...(cap.process_lessons || []),
      ...(cap.run_refs || [])
    ].join(' ').toLowerCase();
    let score = 0;
    for (const token of tokens) if (hay.includes(token)) score += 1;
    if (!tokens.length && query && hay.includes(String(query).toLowerCase())) score = 1;
    if (score > 0) {
      const run_refs = cap.run_refs || [];
      const sep = String.fromCharCode(92);
      const discover_paths = [];
      for (const runId of run_refs) {
        for (const name of ['run.json', 'progress.md', 'analyze.md', 'plan.md', 'acceptance.md']) {
          discover_paths.push(path.join(RALPHS_DIR_REL, runId, name).split(sep).join('/'));
        }
      }
      matches.push({
        id: cap.id,
        title: cap.title,
        score,
        status: cap.status,
        run_refs,
        lessons: cap.lessons || [],
        process_lessons: cap.process_lessons || [],
        discover_paths
      });
    }
  }
  matches.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return matches.slice(0, limit);
}

export function mapFind(query, { cwd = process.cwd(), limit = 10 } = {}) {
  const map = loadMap(cwd);
  return { query, matches: findInMap(map, query, { limit }), map_path: fs.existsSync(mapPath(cwd)) ? RALPH_MAP_REL.replaceAll(String.fromCharCode(92), String.fromCharCode(47)) : null };
}
