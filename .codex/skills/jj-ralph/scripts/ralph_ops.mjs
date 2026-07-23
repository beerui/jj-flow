#!/usr/bin/env node
/**
 * Deterministic Ralph ops for Codex.
 * Usage:
 *   node ralph_ops.mjs init --run-id RALPH-x-20260723 --title "..." --goal "..." [--cwd DIR] [--force]
 *   node ralph_ops.mjs archive --run-id RALPH-x-20260723 [--cwd DIR] [--slug name]
 *   node ralph_ops.mjs map-merge --run-id RALPH-x-20260723 [--cwd DIR] [--keywords a,b] [--lessons "l1|l2"] [--modules p1,p2]
 *   node ralph_ops.mjs handoff --run-id RALPH-x-20260723 [--cwd DIR] [--handoff-id HOF-x]
 *   node ralph_ops.mjs dispatch-snapshot --run-id RALPH-x-20260723 [--cwd DIR]
 *   node ralph_ops.mjs status [--run-id RALPH-x] [--cwd DIR]
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REFS = path.join(__dirname, '..', 'references');
const RUN_SCHEMA = 'jj-flow/ralph-run/1.0';
const MAP_SCHEMA = 'jj-flow/ralph-business-map/1.0';

function nowIso() { return new Date().toISOString(); }
function unique(items) { return [...new Set((items || []).filter(Boolean))]; }
function die(msg) { console.error(msg); process.exit(1); }
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, v) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n', 'utf8');
}
function rel(cwd, ...parts) { return path.join(cwd, ...parts); }
function ralphRoot(cwd) { return rel(cwd, '.workflow', 'ralph'); }
function runDir(cwd, runId) { return path.join(ralphRoot(cwd), runId); }
function runJsonPath(cwd, runId) { return path.join(runDir(cwd, runId), 'run.json'); }
function mapPath(cwd) { return path.join(ralphRoot(cwd), 'business-map.json'); }

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i += 1; }
    } else out._.push(a);
  }
  return out;
}

function loadSkeleton(name) {
  const p = path.join(REFS, name);
  if (!fs.existsSync(p)) return null;
  return readJson(p);
}

function loadRun(cwd, runId) {
  const p = runJsonPath(cwd, runId);
  if (!fs.existsSync(p)) die('run not found: ' + runId + ' (' + p + ')');
  return readJson(p);
}

function saveRun(cwd, run) {
  run.updated_at = nowIso();
  writeJson(runJsonPath(cwd, run.run_id), run);
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else fs.copyFileSync(from, to);
  }
}

function cmdInit(args) {
  const cwd = path.resolve(args.cwd || process.cwd());
  const runId = args['run-id'];
  const title = args.title;
  const goal = args.goal;
  if (!runId || !/^RALPH-[A-Za-z0-9][A-Za-z0-9_-]{1,80}$/.test(runId)) die('need --run-id RALPH-...');
  if (!title) die('need --title');
  if (!goal) die('need --goal');
  const dir = runDir(cwd, runId);
  if (fs.existsSync(dir) && !args.force) die('run exists: ' + runId + ' (use --force)');
  fs.mkdirSync(dir, { recursive: true });
  const sk = loadSkeleton('run.skeleton.json') || {};
  const created = nowIso();
  const run = {
    ...sk,
    schema_version: RUN_SCHEMA,
    run_id: runId,
    title,
    goal,
    phase: 'ANALYZE',
    status: 'IN_PROGRESS',
    scope: { in: splitList(args.in), out: splitList(args.out) },
    assumptions: [],
    iteration: 0,
    max_iterations: Number(args['max-iterations'] || 20),
    tasks: [],
    gates: { analyze: 'PENDING', plan: 'PENDING', deliver: 'PENDING', accept: 'PENDING', archive: 'PENDING' },
    intervention_needed: null,
    capability_ids: splitList(args.capability || args.capabilities),
    artifact_refs: {
      analyze: 'analyze.md',
      plan: 'plan.md',
      acceptance: 'acceptance.md',
      progress: 'progress.md',
      handoff_ref: null,
      dispatch_snapshot_ref: null,
      latest_review_ref: null
    },
    review: null,
    handoff: null,
    dispatch_recommendation: null,
    created_at: created,
    updated_at: created
  };
  if (!run.capability_ids.length) run.capability_ids = ['CAP-' + runId.replace(/^RALPH-/, '').toLowerCase()];
  writeJson(runJsonPath(cwd, runId), run);
  const nl = '\n';
  const stubs = {
    'analyze.md': '# ANALYZE' + nl + nl + 'run_id: ' + runId + nl + nl + '## MUST' + nl + nl + '## OUT' + nl + nl + '## Acceptance' + nl + nl + '## UNRESOLVED' + nl,
    'plan.md': '# PLAN' + nl + nl + 'run_id: ' + runId + nl + nl + '## Tasks' + nl + nl + '## Out of scope' + nl,
    'progress.md': '# Progress' + nl + nl + '- ' + created + ' init ' + runId + nl,
    'acceptance.md': '# Acceptance' + nl + nl + 'run_id: ' + runId + nl + nl + '| item | result | evidence |' + nl + '| --- | --- | --- |' + nl
  };
  for (const [name, body] of Object.entries(stubs)) {
    const fp = path.join(dir, name);
    if (!fs.existsSync(fp) || args.force) fs.writeFileSync(fp, body, 'utf8');
  }
  console.log(JSON.stringify({ ok: true, action: 'init', run_id: runId, path: path.relative(cwd, dir).replaceAll('\\', '/') }, null, 2));
}

function cmdArchive(args) {
  const cwd = path.resolve(args.cwd || process.cwd());
  const runId = args['run-id'];
  if (!runId) die('need --run-id');
  const run = loadRun(cwd, runId);
  if (run.gates?.accept !== 'PASS') die('archive requires gates.accept=PASS');
  const date = nowIso().slice(0, 10);
  const slug = args.slug || runId.replace(/^RALPH-/, '').toLowerCase();
  const destRel = path.join('.workflow', 'ralph', 'archive', date + '-' + slug);
  const destAbs = rel(cwd, destRel);
  if (fs.existsSync(destAbs)) die('archive exists: ' + destRel);
  const sourceAbs = runDir(cwd, runId);
  copyTree(sourceAbs, destAbs);
  const files = [];
  (function walk(dir, prefix = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const next = prefix ? prefix + '/' + entry.name : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, next);
      else files.push({ path: next.replaceAll('\\', '/'), sha256: sha256File(full) });
    }
  })(destAbs);
  const manifest = {
    schema_version: 'jj-flow/ralph-archive/1.0',
    run_id: runId,
    archived_at: nowIso(),
    archive_path: destRel.replaceAll('\\', '/'),
    files
  };
  writeJson(path.join(sourceAbs, 'archive-manifest.json'), manifest);
  writeJson(path.join(destAbs, 'archive-manifest.json'), manifest);
  run.phase = 'ARCHIVE';
  run.status = 'COMPLETED';
  run.gates.archive = 'PASS';
  saveRun(cwd, run);
  console.log(JSON.stringify({ ok: true, action: 'archive', run_id: runId, archive_path: manifest.archive_path }, null, 2));
}

function tokenize(text = '') {
  return String(text).toLowerCase().split(/[^a-z0-9\u4e00-\u9fff]+/i).map((x) => x.trim()).filter((x) => x.length >= 2);
}

function cmdMapMerge(args) {
  const cwd = path.resolve(args.cwd || process.cwd());
  const runId = args['run-id'];
  if (!runId) die('need --run-id');
  const run = loadRun(cwd, runId);
  const mp = mapPath(cwd);
  const map = fs.existsSync(mp) ? readJson(mp) : { schema_version: MAP_SCHEMA, updated_at: nowIso(), capabilities: [] };
  const sk = loadSkeleton('capability.skeleton.json') || {};
  const id = run.capability_ids?.[0] || ('CAP-' + runId.replace(/^RALPH-/, '').toLowerCase());
  const capability = {
    ...sk,
    id,
    title: run.title,
    status: args.status || 'done',
    summary: run.goal,
    reqs: splitList(args.reqs),
    modules: splitList(args.modules),
    lessons: splitPipe(args.lessons),
    keywords: unique([...splitList(args.keywords), ...tokenize(run.title), ...tokenize(run.goal)]),
    acceptance: unique([
      ...splitList(args.acceptance),
      path.join('.workflow', 'ralph', runId, 'acceptance.md').replaceAll('\\', '/')
    ]),
    run_refs: [runId],
    depends_on: splitList(args['depends-on']),
    handoff_refs: splitList(args['handoff-refs'])
  };
  const idx = (map.capabilities || []).findIndex((c) => c.id === id);
  if (idx < 0) map.capabilities = [...(map.capabilities || []), capability];
  else {
    const old = map.capabilities[idx];
    map.capabilities[idx] = {
      ...old,
      ...capability,
      modules: unique([...(old.modules || []), ...(capability.modules || [])]),
      lessons: unique([...(old.lessons || []), ...(capability.lessons || [])]),
      keywords: unique([...(old.keywords || []), ...(capability.keywords || [])]),
      acceptance: unique([...(old.acceptance || []), ...(capability.acceptance || [])]),
      run_refs: unique([...(old.run_refs || []), ...(capability.run_refs || [])]),
      handoff_refs: unique([...(old.handoff_refs || []), ...(capability.handoff_refs || [])])
    };
  }
  map.schema_version = MAP_SCHEMA;
  map.updated_at = nowIso();
  writeJson(mp, map);
  console.log(JSON.stringify({ ok: true, action: 'map-merge', run_id: runId, capability_id: id, map_path: path.relative(cwd, mp).replaceAll('\\', '/') }, null, 2));
}

function cmdHandoff(args) {
  const cwd = path.resolve(args.cwd || process.cwd());
  const runId = args['run-id'];
  if (!runId) die('need --run-id');
  const run = loadRun(cwd, runId);
  const id = args['handoff-id'] || ('HOF-' + runId.replace(/^RALPH-/, ''));
  const relDir = path.join('.workflow', 'handoffs', id);
  const abs = rel(cwd, relDir);
  fs.mkdirSync(abs, { recursive: true });
  const handoff = {
    schema_version: 'jj-flow/handoff/1.0',
    handoff_id: id,
    run_id: runId,
    title: run.title,
    goal: run.goal,
    scope: run.scope,
    capability_ids: run.capability_ids || [],
    targets_hint: splitList(args.targets),
    created_at: nowIso()
  };
  writeJson(path.join(abs, 'handoff.json'), handoff);
  const nl = '\n';
  const md = [
    '# Handoff ' + id, '',
    'run_id: ' + runId,
    'title: ' + run.title, '',
    '## Goal', run.goal, '',
    '## Scope in', ...(run.scope?.in || []).map((x) => '- ' + x), '',
    '## Scope out', ...(run.scope?.out || []).map((x) => '- ' + x), ''
  ].join(nl);
  fs.writeFileSync(path.join(abs, 'source.md'), md, 'utf8');
  run.handoff = { handoff_id: id, path: relDir.replaceAll('\\', '/'), status: 'READY' };
  run.artifact_refs = { ...(run.artifact_refs || {}), handoff_ref: path.join(relDir, 'handoff.json').replaceAll('\\', '/') };
  saveRun(cwd, run);
  console.log(JSON.stringify({ ok: true, action: 'handoff', run_id: runId, path: run.handoff.path }, null, 2));
}

function cmdDispatchSnapshot(args) {
  const cwd = path.resolve(args.cwd || process.cwd());
  const runId = args['run-id'];
  if (!runId) die('need --run-id');
  const run = loadRun(cwd, runId);
  const snapId = 'SNAP-' + runId.replace(/^RALPH-/, '');
  const relDir = path.join('.workflow', 'dispatch', 'recommendations', snapId);
  const abs = rel(cwd, relDir);
  fs.mkdirSync(abs, { recursive: true });
  const snapshot = {
    schema_version: 'jj-flow/dispatch-recommendation/1.0',
    snapshot_id: snapId,
    run_id: runId,
    title: run.title,
    goal: run.goal,
    targets_hint: splitList(args.targets),
    created_at: nowIso()
  };
  const snapPath = path.join(relDir, 'snapshot.json').replaceAll('\\', '/');
  writeJson(path.join(abs, 'snapshot.json'), snapshot);
  run.dispatch_recommendation = { snapshot_path: snapPath, targets_hint: snapshot.targets_hint };
  run.artifact_refs = { ...(run.artifact_refs || {}), dispatch_snapshot_ref: snapPath };
  saveRun(cwd, run);
  console.log(JSON.stringify({ ok: true, action: 'dispatch-snapshot', run_id: runId, path: snapPath }, null, 2));
}

function cmdStatus(args) {
  const cwd = path.resolve(args.cwd || process.cwd());
  if (args['run-id']) {
    const run = loadRun(cwd, args['run-id']);
    console.log(JSON.stringify({ ok: true, run, path: path.relative(cwd, runDir(cwd, args['run-id'])).replaceAll('\\', '/') }, null, 2));
    return;
  }
  const root = ralphRoot(cwd);
  const runs = [];
  if (fs.existsSync(root)) {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('RALPH-')) continue;
      const p = path.join(root, entry.name, 'run.json');
      if (!fs.existsSync(p)) { runs.push({ run_id: entry.name }); continue; }
      try {
        const run = readJson(p);
        runs.push({ run_id: run.run_id, phase: run.phase, status: run.status, title: run.title, updated_at: run.updated_at });
      } catch {
        runs.push({ run_id: entry.name });
      }
    }
  }
  runs.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  console.log(JSON.stringify({ ok: true, runs, map_exists: fs.existsSync(mapPath(cwd)) }, null, 2));
}

function splitList(v) {
  if (!v || v === true) return [];
  return String(v).split(',').map((x) => x.trim()).filter(Boolean);
}
function splitPipe(v) {
  if (!v || v === true) return [];
  return String(v).split('|').map((x) => x.trim()).filter(Boolean);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (!cmd || args.help) {
    console.log(`ralph_ops.mjs <init|status|archive|map-merge|handoff|dispatch-snapshot> [options]
  --cwd DIR
  init: --run-id --title --goal [--force] [--capability CAP-x] [--in a,b] [--out c,d]
  archive: --run-id [--slug name]
  map-merge: --run-id [--keywords a,b] [--lessons "l1|l2"] [--modules p1,p2]
  handoff: --run-id [--handoff-id HOF-x] [--targets a,b]
  dispatch-snapshot: --run-id [--targets a,b]
  status: [--run-id]
`);
    process.exit(cmd ? 1 : 0);
  }
  if (cmd === 'init') return cmdInit(args);
  if (cmd === 'archive') return cmdArchive(args);
  if (cmd === 'map-merge') return cmdMapMerge(args);
  if (cmd === 'handoff') return cmdHandoff(args);
  if (cmd === 'dispatch-snapshot') return cmdDispatchSnapshot(args);
  if (cmd === 'status') return cmdStatus(args);
  die('unknown command: ' + cmd);
}

main();
