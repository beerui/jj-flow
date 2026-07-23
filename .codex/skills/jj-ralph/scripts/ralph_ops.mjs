#!/usr/bin/env node
/**
 * Portable CLI for Codex $jj-ralph mechanical steps.
 *
 * Source of truth for library logic: jj-flow `src/ralph.mjs`
 * Portable copy shipped with skill: `scripts/lib/ralph.mjs` (npm run ralph:sync)
 *
 * Resolve order:
 *   1) $JJ_FLOW_ROOT/src/ralph.mjs
 *   2) monorepo checkout: ../../../../src/ralph.mjs (when skill lives under jj-flow)
 *   3) skill-bundled scripts/lib/ralph.mjs  ← business repos without jj-flow
 *   4) walk cwd for package root / node_modules/@shendu-sdt/jj-flow
 *   5) else exit 2 (skill incomplete; skeleton last resort)
 *
 * Usage:
 *   node ralph_ops.mjs <init|status|archive|finalize|map-merge|gate|map-find|handoff|dispatch-snapshot|commit-prep|review-record> [options]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SKILL_ROOT = path.resolve(__dirname, '..');
const REFS = path.join(SKILL_ROOT, 'references');
const BUNDLED_LIB = path.join(__dirname, 'lib', 'ralph.mjs');

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) out[key] = true;
      else {
        out[key] = next;
        i += 1;
      }
    } else out._.push(a);
  }
  return out;
}

function splitList(v) {
  if (!v || v === true) return [];
  return String(v).split(',').map((x) => x.trim()).filter(Boolean);
}

function splitPipe(v) {
  if (!v || v === true) return [];
  return String(v).split('|').map((x) => x.trim()).filter(Boolean);
}

function printHelp() {
  console.log(`ralph_ops.mjs — portable wrapper over ralph library

Resolve library:
  1. $JJ_FLOW_ROOT/src/ralph.mjs
  2. jj-flow checkout ../../../../src/ralph.mjs
  3. skill-bundled scripts/lib/ralph.mjs (no jj-flow install required)
  4. cwd package / node_modules/@shendu-sdt/jj-flow
  5. else skill is incomplete — reinstall skill or copy references/*.skeleton.json

Commands:
  init --run-id RALPH-x --title "..." --goal "..." [--force] [--capability CAP-x] [--in a,b] [--out c,d] [--cwd DIR]
  status [--run-id RALPH-x] [--cwd DIR]
  archive --run-id RALPH-x [--slug name] [--cwd DIR]
  finalize --run-id RALPH-x [--slug name] [--modules p1,p2] [--keywords a,b] [--lessons "l1|l2"] [--force] [--cwd DIR]
  map-merge --run-id RALPH-x [--modules p1,p2] [--keywords a,b] [--lessons "l1|l2"] [--force] [--cwd DIR]
  gate --run-id RALPH-x --gate analyze|plan|deliver|accept|archive --status PASS|FAIL|... [--no-advance] [--cwd DIR]
  map-find --query "keyword" [--limit N] [--cwd DIR]
  handoff --run-id RALPH-x [--handoff-id HOF-x] [--targets a,b] [--cwd DIR]
  dispatch-snapshot --run-id RALPH-x [--targets a,b] [--cwd DIR]
  commit-prep --run-id RALPH-x [--cwd DIR]
  review-record --run-id RALPH-x --outcome PASS|NEEDS_CHANGES|BLOCKED [--reviewed-commit sha] [--task-thread id] [--review-thread id] [--summary text] [--cwd DIR]
`);
}

function candidateRalphModules(cwd) {
  const out = [];
  const seen = new Set();
  const push = (p) => {
    const abs = path.resolve(p);
    if (seen.has(abs)) return;
    seen.add(abs);
    out.push(abs);
  };

  if (process.env.JJ_FLOW_ROOT) {
    push(path.join(process.env.JJ_FLOW_ROOT, 'src', 'ralph.mjs'));
  }

  // When skill is inside jj-flow checkout, prefer live source.
  push(path.resolve(__dirname, '../../../../src/ralph.mjs'));

  // Portable copy shipped with the skill (business repos without jj-flow).
  push(BUNDLED_LIB);

  let dir = path.resolve(cwd || process.cwd());
  for (let i = 0; i < 12; i += 1) {
    push(path.join(dir, 'src', 'ralph.mjs'));
    push(path.join(dir, 'node_modules', '@shendu-sdt', 'jj-flow', 'src', 'ralph.mjs'));
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name === '@shendu-sdt/jj-flow') push(path.join(dir, 'src', 'ralph.mjs'));
      } catch {
        // ignore
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return out;
}

async function loadRalph(cwd) {
  const candidates = candidateRalphModules(cwd);
  const tried = [];
  for (const file of candidates) {
    tried.push(file);
    if (!fs.existsSync(file)) continue;
    try {
      const mod = await import(pathToFileURL(file).href);
      return { mod, resolved: file };
    } catch (err) {
      tried.push(`# import failed: ${file}: ${err.message}`);
    }
  }
  const hint = [
    'Could not resolve ralph library for ralph_ops.mjs.',
    'Tried:',
    ...tried.map((t) => `  - ${t}`),
    '',
    'Expected skill-bundled lib at:',
    `  ${BUNDLED_LIB}`,
    '',
    'Fix:',
    '  - reinstall/update jj-ralph skill (must include scripts/lib/ralph.mjs)',
    '  - or in jj-flow checkout: npm run ralph:sync',
    '  - last resort: copy references/*.skeleton.json by hand',
    `      ${path.join(REFS, 'run.skeleton.json')}`,
  ].join('\n');
  die(hint, 2);
}

function printJson(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (!cmd || args.help || args.h) {
    printHelp();
    process.exit(cmd ? 1 : 0);
  }

  const cwd = path.resolve(args.cwd || process.cwd());
  const { mod, resolved } = await loadRalph(cwd);
  const {
    initRun,
    getStatus,
    archiveRun,
    finalizeRun,
    mapMergeFromRun,
    mapFind,
    writeHandoffPackage,
    writeDispatchSnapshot,
    commitPrep,
    recordReview,
    setGate,
    RALPH_MAP_REL,
  } = mod;

  try {
    if (cmd === 'init') {
      const runId = args['run-id'];
      const title = args.title;
      const goal = args.goal;
      if (!runId || !title || !goal) die('init needs --run-id --title --goal');
      const run = initRun(
        {
          run_id: runId,
          title,
          goal,
          force: Boolean(args.force),
          scope: { in: splitList(args.in), out: splitList(args.out) },
          capability_ids: splitList(args.capability),
        },
        cwd
      );
      printJson({
        ok: true,
        action: 'init',
        run_id: run.run_id,
        path: path.relative(cwd, path.join(cwd, '.workflow', 'ralph', run.run_id)).replaceAll('\\', '/'),
        resolved,
      });
      return;
    }

    if (cmd === 'status') {
      const payload = getStatus({ runId: args['run-id'], cwd });
      printJson({ ok: true, action: 'status', ...payload, resolved });
      return;
    }

    if (cmd === 'archive') {
      const runId = args['run-id'];
      if (!runId) die('archive needs --run-id');
      const result = archiveRun(runId, { cwd, slug: args.slug });
      printJson({
        ok: true,
        action: 'archive',
        run_id: runId,
        archive_path: result.archive_path,
        resolved,
      });
      return;
    }

    if (cmd === 'map-merge') {
      const runId = args['run-id'];
      if (!runId) die('map-merge needs --run-id');
      const result = mapMergeFromRun(
        runId,
        {
          modules: splitList(args.modules),
          keywords: splitList(args.keywords),
          lessons: splitPipe(args.lessons),
          acceptance: splitList(args.acceptance),
          status: args.status || 'done',
          force: Boolean(args.force),
        },
        cwd
      );
      printJson({
        ok: true,
        action: 'map-merge',
        run_id: runId,
        capability_id: result.capability.id,
        map_path: (RALPH_MAP_REL || '.workflow/ralph/business-map.json').replaceAll('\\', '/'),
        resolved,
      });
      return;
    }

    if (cmd === 'finalize') {
      const runId = args['run-id'];
      if (!runId) die('finalize needs --run-id');
      if (typeof finalizeRun !== 'function') {
        die('resolved ralph.mjs has no finalizeRun; upgrade jj-ralph skill / npm run ralph:sync');
      }
      const result = finalizeRun(runId, {
        cwd,
        slug: args.slug,
        modules: splitList(args.modules),
        keywords: splitList(args.keywords),
        lessons: splitPipe(args.lessons),
        acceptance: splitList(args.acceptance),
        status: args.status || 'done',
        force: Boolean(args.force),
      });
      printJson({
        ok: true,
        action: 'finalize',
        run_id: runId,
        archive_path: result.archive_path,
        capability_id: result.capability?.id,
        map_path: result.map_path,
        phase: result.run?.phase,
        status: result.run?.status,
        resolved,
      });
      return;
    }

    if (cmd === 'gate') {
      const runId = args['run-id'];
      const gate = args.gate || args.phase;
      const status = args.status;
      if (!runId || !gate || !status) die('gate needs --run-id --gate --status');
      if (typeof setGate !== 'function') die('resolved ralph.mjs has no setGate; upgrade jj-ralph skill / npm run ralph:sync');
      const result = setGate(runId, {
        gate,
        status,
        cwd,
        advance: args['no-advance'] ? false : true,
      });
      printJson({
        ok: true,
        action: 'gate',
        run_id: runId,
        gate,
        status,
        phase: result.phase,
        run_status: result.run?.status,
        resolved,
      });
      return;
    }

    if (cmd === 'map-find') {
      const query = args.query || args._[1];
      if (!query) die('map-find needs --query');
      const result = mapFind(query, { cwd, limit: args.limit ? Number(args.limit) : 10 });
      printJson({ ok: true, action: 'map-find', ...result, resolved });
      return;
    }

    if (cmd === 'handoff') {
      const runId = args['run-id'];
      if (!runId) die('handoff needs --run-id');
      const result = writeHandoffPackage(runId, {
        cwd,
        handoff_id: args['handoff-id'],
        targets_hint: splitList(args.targets),
      });
      printJson({ ok: true, action: 'handoff', run_id: runId, path: result.path, resolved });
      return;
    }

    if (cmd === 'dispatch-snapshot') {
      const runId = args['run-id'];
      if (!runId) die('dispatch-snapshot needs --run-id');
      const result = writeDispatchSnapshot(runId, {
        cwd,
        targets_hint: splitList(args.targets),
      });
      printJson({ ok: true, action: 'dispatch-snapshot', run_id: runId, path: result.path, resolved });
      return;
    }

    if (cmd === 'commit-prep') {
      const runId = args['run-id'];
      if (!runId) die('commit-prep needs --run-id');
      const result = commitPrep(runId, cwd);
      printJson({ ok: true, action: 'commit-prep', ...result, resolved });
      return;
    }

    if (cmd === 'review-record') {
      const runId = args['run-id'];
      const outcome = args.outcome;
      if (!runId || !outcome) die('review-record needs --run-id --outcome');
      const result = recordReview(runId, {
        cwd,
        outcome,
        reviewed_commit: args['reviewed-commit'] || null,
        task_thread_id: args['task-thread'] || null,
        review_thread_id: args['review-thread'] || null,
        summary: args.summary || '',
      });
      printJson({
        ok: true,
        action: 'review-record',
        run_id: runId,
        review_id: result.report.review_id,
        outcome: result.report.outcome,
        path: result.path,
        resolved,
      });
      return;
    }

    die('unknown command: ' + cmd);
  } catch (err) {
    die(err && err.message ? err.message : String(err));
  }
}

main();
