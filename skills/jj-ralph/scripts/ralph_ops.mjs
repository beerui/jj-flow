#!/usr/bin/env node
/**
 * Portable CLI for jj-ralph mechanical steps.
 *
 * Source of truth for library logic: jj-flow `src/ralph.mjs` (façade) + `src/ralph/*.mjs`
 * Portable copy shipped with skill: `scripts/lib/ralph.mjs` + `scripts/lib/ralph/` (npm run ralph:sync)
 *
 * Resolve order:
 *   1) $JJ_FLOW_ROOT/src/ralph.mjs
 *   2) monorepo checkout: ../../../src/ralph.mjs (skills/<id>/scripts; legacy ../../../../ for .codex/skills)
 *   3) skill-bundled scripts/lib/ralph.mjs  ← business repos without jj-flow
 *   4) walk cwd for package root / node_modules/@brewer/jj-flow (legacy @shendu-sdt/jj-flow)
 *   5) else exit 2 (skill incomplete; skeleton last resort)
 *
 * Usage:
 *   node ralph_ops.mjs <init|status|archive|finalize|map-merge|knowledge-contribute|finding|knowledge-confirm|knowledge-prune|gate|scope|deliver-attempt|accept-layer|rollback-phase|set-status|resume|abandon|map-find|handoff|dispatch-snapshot|commit-prep|review-record|migrate|adopt> [options]
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
  4. cwd package / node_modules/@brewer/jj-flow (legacy @shendu-sdt/jj-flow)
  5. else skill is incomplete — reinstall skill or copy references/*.skeleton.json

Commands:
  init --run-id task-x --title "..." --goal "..." [--intensity tiny|standard|strict] [--lite|--full] [--max-iterations N] [--force] [--capability CAP-x] [--in a,b] [--out c,d] [--project KEY] [--knowledge-query Q] [--intent|--no-intent] [--cwd DIR]
                 (gate_set defaults to full; --lite = brief→deliver→close with max_deliver_loops≤3, auto-promotes to full on FAIL/BLOCKED or scope growth)
  status [--run-id task-x] [--cwd DIR]
  metrics --run-id task-x [--persist] [--cwd DIR]
  archive --run-id task-x [--slug name] [--cwd DIR]
  finalize --run-id task-x [--slug name] [--modules p1,p2] [--keywords a,b] [--lessons "l1|l2"] [--force] [--include-process-lessons] [--no-contribution-package] [--cwd DIR]
  map-merge --run-id task-x [--modules p1,p2] [--keywords a,b] [--lessons "l1|l2"] [--force] [--include-process-lessons] [--cwd DIR]
  knowledge-contribute --run-id task-x [--modules p1,p2] [--lessons "l1|l2"] [--hook] [--cwd DIR]
  finding --run-id task-x --action "…" --scope "…" [--phenomenon "…"] [--cause "…"] [--rule "…"] [--title "…"] [--cost "…"] [--evidence "…"] [--cwd DIR]
  knowledge-confirm --needle "…" [--project KEY] [--cwd DIR]
  knowledge-prune [--project KEY] [--cwd DIR]
  gate --run-id task-x --gate analyze|plan|deliver|accept|archive|brief|close --status PASS|FAIL|... [--no-advance] [--cwd DIR]
                 (brief/close are lite-only aliases; they still write the five ledger keys and close runs the accept/archive evidence gates)
  scope --run-id task-x [--in a,b] [--out c,d] [--cwd DIR]
                 (append scope entries; new --in paths on a lite run promote gate_set to full)
  deliver-attempt --run-id task-x [--improved true|false|auto] [--signal text] [--cwd DIR]
                 (omit --improved or use auto: compare workspace fingerprint)
  accept-layer --run-id task-x --layer mechanical|judgment --status PASS|FAIL|PENDING|SKIPPED [--mode none|review|recheck|adversarial_note] [--note text] [--cwd DIR]
  rollback-phase --run-id task-x --to PLAN|DELIVER|ANALYZE|ACCEPT --reason "..." [--cwd DIR]
  set-status --run-id task-x --status IN_PROGRESS|READY_FOR_USER_TEST|BLOCKED|PAUSED|ABANDONED|COMPLETED --reason "..." [--cwd DIR]
  resume --run-id task-x --reason "..." [--cwd DIR]
  abandon --run-id task-x --reason "..." [--cwd DIR]
  map-find --query "keyword" [--limit N] [--cwd DIR]
  handoff --run-id task-x [--handoff-id HOF-x] [--targets a,b] [--cwd DIR]
  dispatch-snapshot --run-id task-x [--targets a,b] [--cwd DIR]
  commit-prep --run-id task-x [--cwd DIR]
  review-record --run-id task-x --outcome PASS|NEEDS_CHANGES|BLOCKED [--reviewed-commit sha] [--fix-commit sha] [--review-scope working_tree|commit] [--task-thread id] [--review-thread id] [--summary text] [--finding-json json] [--findings-file path] [--source host_builtin|user_provided|fallback_inline] [--host-review-json json] [--cwd DIR]
  migrate [--all-projects] [--cwd DIR]
  adopt --task task-x [--from RALPH-x] [--absorb task-y] [--cwd DIR]
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
  // skills/<id>/scripts → ../../../src (top-level skills SSOT)
  // legacy .codex/skills/<id>/scripts → ../../../../src
  push(path.resolve(__dirname, '../../../src/ralph.mjs'));
  push(path.resolve(__dirname, '../../../../src/ralph.mjs'));

  // Portable copy shipped with the skill (business repos without jj-flow).
  push(BUNDLED_LIB);

  const PACKAGE_NAMES = new Set(['@brewer/jj-flow', '@shendu-sdt/jj-flow']);
  let dir = path.resolve(cwd || process.cwd());
  for (let i = 0; i < 12; i += 1) {
    push(path.join(dir, 'src', 'ralph.mjs'));
    push(path.join(dir, 'node_modules', '@brewer', 'jj-flow', 'src', 'ralph.mjs'));
    // Legacy npm scope (deprecated); keep resolving until installs migrate.
    push(path.join(dir, 'node_modules', '@shendu-sdt', 'jj-flow', 'src', 'ralph.mjs'));
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (PACKAGE_NAMES.has(pkg.name)) push(path.join(dir, 'src', 'ralph.mjs'));
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
    rollbackPhase,
    setRunStatus,
    resumeRun,
    abandonRun,
    knowledgeContribute,
    recordDeliverAttempt,
    setAcceptLayer,
    recordFinding,
    confirmProjectHotMemory,
    pruneProjectHotMemory,
    migrateRuns,
    adoptRun,
    RALPH_MAP_REL,
  } = mod;

  try {
    if (cmd === 'init') {
      const runId = args['run-id'];
      const title = args.title;
      const goal = args.goal;
      if (!runId || !title || !goal) die('init needs --run-id --title --goal');
      const initOpts = {
        run_id: runId,
        title,
        goal,
        force: Boolean(args.force),
        scope: { in: splitList(args.in), out: splitList(args.out) },
        capability_ids: splitList(args.capability),
      };
      if (args.intensity) initOpts.intensity = args.intensity;
      if (args.lite && args.full) die('init: use --lite or --full, not both');
      if (args.lite) initOpts.gate_set = 'lite';
      if (args.full) initOpts.gate_set = 'full';
      if (args['max-iterations'] != null && args['max-iterations'] !== true) {
        initOpts.max_iterations = Number(args['max-iterations']);
      }
      if (args['no-intent']) initOpts.write_intent = false;
      if (args.intent && args.intent !== true && args['no-intent']) {
        die('init: use --intent or --no-intent, not both');
      }
      if (args.intent === true) initOpts.write_intent = true;
      if (args.project && args.project !== true) initOpts.project = String(args.project);
      if (args['knowledge-query'] && args['knowledge-query'] !== true) {
        initOpts.knowledge_query = String(args['knowledge-query']);
      }
      const run = initRun(initOpts, cwd);
      printJson({
        ok: true,
        action: 'init',
        run_id: run.run_id,
        intensity: run.intensity || 'standard',
        gate_set: run.gate_set || 'full',
        max_iterations: run.max_iterations,
        max_deliver_loops: run.budget?.max_deliver_loops ?? null,
        path: path.relative(cwd, path.join(cwd, '.workflow', 'ralph', 'tasks', run.run_id)).replaceAll('\\', '/'),
        reuse_suggestions: run.reuse_suggestions || [],
        resolved,
      });
      return;
    }

    if (cmd === 'status') {
      const payload = getStatus({ runId: args['run-id'], cwd });
      printJson({ ok: true, action: 'status', ...payload, resolved });
      return;
    }

    if (cmd === 'metrics') {
      const runId = args['run-id'];
      if (!runId) die('metrics needs --run-id');
      const persist = Boolean(args.persist);
      const persistFn = mod.persistRunMetrics;
      const result = persist && typeof persistFn === 'function'
        ? persistFn(runId, cwd)
        : getStatus({ runId, cwd });
      printJson({ ok: true, action: 'metrics', run_id: runId, metrics: result.metrics, resolved });
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
          include_process_lessons_in_map: Boolean(args['include-process-lessons']),
        },
        cwd
      );
      printJson({
        ok: true,
        action: 'map-merge',
        run_id: runId,
        capability_id: result.capability.id,
        map_path: (RALPH_MAP_REL || '.workflow/ralph/business-map.json').replaceAll('\\', '/'),
        process_lessons: result.capability.process_lessons || [],
        resolved,
      });
      return;
    }

    if (cmd === 'knowledge-contribute') {
      const runId = args['run-id'];
      if (!runId) die('knowledge-contribute needs --run-id');
      if (typeof knowledgeContribute !== 'function') {
        die('resolved ralph.mjs has no knowledgeContribute; upgrade jj-ralph skill / npm run ralph:sync');
      }
      const result = knowledgeContribute(runId, {
        cwd,
        modules: splitList(args.modules),
        keywords: splitList(args.keywords),
        lessons: splitPipe(args.lessons),
        acceptance: splitList(args.acceptance),
        status: args.status || 'done',
        include_process_lessons_in_map: Boolean(args['include-process-lessons']),
        hook: Boolean(args.hook),
      });
      printJson({
        ok: true,
        action: 'knowledge-contribute',
        run_id: runId,
        path: result.path,
        candidates: result.contribution?.candidates?.length || 0,
        hook: result.hook,
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
        include_process_lessons_in_map: Boolean(args['include-process-lessons']),
        contribution_package: args['no-contribution-package'] ? false : true,
      });
      printJson({
        ok: true,
        action: 'finalize',
        run_id: runId,
        archive_path: result.archive_path,
        capability_id: result.capability?.id,
        map_path: result.map_path,
        contribution_path: result.contribution_path || null,
        elevation: result.elevation || null,
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
        gates_written: result.gates_written || [gate],
        gate_set: result.gate_set || result.run?.gate_set || 'full',
        promotion: result.promotion || null,
        phase: result.phase,
        run_status: result.run?.status,
        resolved,
      });
      return;
    }

    if (cmd === 'scope') {
      const runId = args['run-id'];
      if (!runId) die('scope needs --run-id');
      const addIn = splitList(args.in);
      const addOut = splitList(args.out);
      if (!addIn.length && !addOut.length) die('scope needs --in and/or --out');
      const updateScope = mod.updateRunScope;
      if (typeof updateScope !== 'function') die('resolved ralph.mjs has no updateRunScope; upgrade jj-ralph skill / npm run ralph:sync');
      const result = updateScope(runId, { add_in: addIn, add_out: addOut, cwd });
      printJson({
        ok: true,
        action: 'scope',
        run_id: runId,
        added_in: result.added_in,
        added_out: result.added_out,
        gate_set: result.gate_set,
        promotion: result.promotion,
        scope: result.run?.scope,
        resolved,
      });
      return;
    }

    if (cmd === 'deliver-attempt') {
      const runId = args['run-id'];
      if (!runId) die('deliver-attempt needs --run-id');
      if (typeof recordDeliverAttempt !== 'function') {
        die('resolved ralph.mjs has no recordDeliverAttempt; upgrade jj-ralph skill / npm run ralph:sync');
      }
      let improved;
      if (args.improved == null || args.improved === true) {
        // omit or bare --improved → auto fingerprint
        improved = undefined;
      } else {
        const raw = String(args.improved).toLowerCase();
        if (raw === 'true' || raw === '1' || raw === 'yes') improved = true;
        else if (raw === 'false' || raw === '0' || raw === 'no') improved = false;
        else if (raw === 'auto') improved = undefined;
        else die('--improved must be true|false|auto');
      }
      const result = recordDeliverAttempt(runId, {
        improved,
        signal: args.signal && args.signal !== true ? String(args.signal) : null,
        score: args.score != null && args.score !== true ? Number(args.score) : null,
        cwd,
      });
      printJson({
        ok: true,
        action: 'deliver-attempt',
        run_id: runId,
        improved: result.improved,
        improved_source: result.improved_source,
        fingerprint: result.fingerprint,
        iteration: result.iteration,
        blocked: result.blocked,
        status: result.status,
        stagnation: result.stagnation,
        intervention_needed: result.intervention_needed,
        finding_hint: result.finding_hint || null,
        resolved,
      });
      return;
    }

    if (cmd === 'accept-layer') {
      const runId = args['run-id'];
      const layer = args.layer;
      const status = args.status;
      if (!runId || !layer || !status) die('accept-layer needs --run-id --layer --status');
      if (typeof setAcceptLayer !== 'function') {
        die('resolved ralph.mjs has no setAcceptLayer; upgrade jj-ralph skill / npm run ralph:sync');
      }
      const result = setAcceptLayer(runId, {
        layer,
        status,
        mode: args.mode && args.mode !== true ? args.mode : null,
        note: args.note && args.note !== true ? String(args.note) : null,
        cwd,
      });
      printJson({
        ok: true,
        action: 'accept-layer',
        run_id: runId,
        layer,
        status,
        accept_layers: result.accept_layers,
        resolved,
      });
      return;
    }

    if (cmd === 'rollback-phase') {
      const runId = args['run-id'];
      const toPhase = args.to || args.phase || args['to-phase'];
      const reason = args.reason;
      if (!runId || !toPhase || !reason) die('rollback-phase needs --run-id --to --reason');
      if (typeof rollbackPhase !== 'function') {
        die('resolved ralph.mjs has no rollbackPhase; upgrade jj-ralph skill / npm run ralph:sync');
      }
      const result = rollbackPhase(runId, { toPhase, reason, cwd });
      printJson({
        ok: true,
        action: 'rollback-phase',
        run_id: runId,
        from_phase: result.fromPhase,
        to_phase: result.toPhase,
        status: result.status,
        reason: result.reason,
        finding_hint: result.finding_hint || null,
        resolved,
      });
      return;
    }

    if (cmd === 'set-status') {
      const runId = args['run-id'];
      const status = args.status;
      const reason = args.reason;
      if (!runId || !status || !reason) die('set-status needs --run-id --status --reason');
      if (typeof setRunStatus !== 'function') {
        die('resolved ralph.mjs has no setRunStatus; upgrade jj-ralph skill / npm run ralph:sync');
      }
      const result = setRunStatus(runId, { status, reason, cwd });
      printJson({
        ok: true,
        action: 'set-status',
        run_id: runId,
        from: result.from,
        status: result.status,
        reason: result.reason,
        resolved,
      });
      return;
    }

    if (cmd === 'resume' || cmd === 'continue') {
      const runId = args['run-id'];
      const reason = args.reason;
      if (!runId || !reason) die('resume needs --run-id --reason');
      if (typeof resumeRun !== 'function') {
        die('resolved ralph.mjs has no resumeRun; upgrade jj-ralph skill / npm run ralph:sync');
      }
      const result = resumeRun(runId, { reason, cwd });
      printJson({
        ok: true,
        action: 'resume',
        run_id: runId,
        from: result.from,
        status: result.status,
        reason: result.reason,
        hot_memory: result.hot_memory || null,
        resolved,
      });
      return;
    }

    if (cmd === 'abandon') {
      const runId = args['run-id'];
      const reason = args.reason;
      if (!runId || !reason) die('abandon needs --run-id --reason');
      if (typeof abandonRun !== 'function') {
        die('resolved ralph.mjs has no abandonRun; upgrade jj-ralph skill / npm run ralph:sync');
      }
      const result = abandonRun(runId, { reason, cwd });
      printJson({
        ok: true,
        action: 'abandon',
        run_id: runId,
        from: result.from,
        status: result.status,
        reason: result.reason,
        resolved,
      });
      return;
    }

    if (cmd === 'close') {
      die('close is deprecated; use abandon (half-done discard) or archive/finalize (soft archive snapshot). Same run remains resumable.');
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
      let hostReview = null;
      if (args['host-review-json']) {
        try {
          hostReview = JSON.parse(args['host-review-json']);
        } catch {
          die('--host-review-json must be valid JSON object');
        }
        if (hostReview == null || typeof hostReview !== 'object' || Array.isArray(hostReview)) {
          die('--host-review-json must be a JSON object');
        }
      }
      let findings = [];
      if (args['finding-json']) {
        try {
          findings.push(JSON.parse(args['finding-json']));
        } catch {
          die('--finding-json must be valid JSON object');
        }
      }
      if (args['findings-file']) {
        const payload = JSON.parse(fs.readFileSync(args['findings-file'], 'utf8'));
        if (!Array.isArray(payload)) die('--findings-file must contain a JSON array');
        findings.push(...payload);
      }
      const result = recordReview(runId, {
        cwd,
        outcome,
        reviewed_commit: args['reviewed-commit'] || null,
        fix_commit: args['fix-commit'] || null,
        review_scope: args['review-scope'] || null,
        task_thread_id: args['task-thread'] || null,
        review_thread_id: args['review-thread'] || null,
        summary: args.summary || '',
        findings,
        source: args.source || null,
        host_review: hostReview,
      });
      printJson({
        ok: true,
        action: 'review-record',
        run_id: runId,
        review_id: result.report.review_id,
        outcome: result.report.outcome,
        source: result.report.source || null,
        path: result.path,
        resolved,
      });
      return;
    }

    if (cmd === 'finding') {
      const runId = args['run-id'];
      if (!runId) die('finding needs --run-id');
      if (typeof recordFinding !== 'function') {
        die('resolved ralph.mjs has no recordFinding; upgrade jj-ralph skill / npm run ralph:sync');
      }
      const result = recordFinding(runId, {
        title: args.title && args.title !== true ? String(args.title) : '',
        phenomenon: args.phenomenon && args.phenomenon !== true ? String(args.phenomenon) : '',
        cause: args.cause && args.cause !== true ? String(args.cause) : '',
        action: args.action && args.action !== true ? String(args.action) : '',
        scope: args.scope && args.scope !== true ? String(args.scope) : '',
        cost: args.cost && args.cost !== true ? String(args.cost) : '',
        evidence: args.evidence && args.evidence !== true ? String(args.evidence) : '',
        rule: args.rule && args.rule !== true ? String(args.rule) : ''
      }, cwd);
      printJson({
        ok: true,
        action: 'finding',
        run_id: runId,
        id: result.id,
        path: result.path,
        resolved,
      });
      return;
    }

    if (cmd === 'knowledge-confirm') {
      const needle = args.needle;
      if (!needle || needle === true) die('knowledge-confirm needs --needle');
      if (typeof confirmProjectHotMemory !== 'function') {
        die('resolved ralph.mjs has no confirmProjectHotMemory; upgrade jj-ralph skill / npm run ralph:sync');
      }
      const result = confirmProjectHotMemory(String(needle), {
        cwd,
        projectKey: args.project && args.project !== true ? String(args.project) : null
      });
      printJson({
        ok: true,
        action: 'knowledge-confirm',
        ...result,
        resolved,
      });
      return;
    }

    if (cmd === 'knowledge-prune') {
      if (typeof pruneProjectHotMemory !== 'function') {
        die('resolved ralph.mjs has no pruneProjectHotMemory; upgrade jj-ralph skill / npm run ralph:sync');
      }
      const result = pruneProjectHotMemory({
        cwd,
        projectKey: args.project && args.project !== true ? String(args.project) : null
      });
      printJson({
        ok: true,
        action: 'knowledge-prune',
        ...result,
        resolved,
      });
      return;
    }

    if (cmd === 'migrate') {
      if (typeof migrateRuns !== 'function') {
        die('resolved ralph.mjs has no migrateRuns; upgrade jj-ralph skill / npm run ralph:sync');
      }
      const result = migrateRuns({ cwd, all_projects: Boolean(args['all-projects']) });
      printJson({ ok: true, ...result, resolved });
      return;
    }

    if (cmd === 'adopt') {
      if (typeof adoptRun !== 'function') {
        die('resolved ralph.mjs has no adoptRun; upgrade jj-ralph skill / npm run ralph:sync');
      }
      const result = adoptRun({
        cwd,
        task: args.task && args.task !== true ? String(args.task) : null,
        from: args.from && args.from !== true ? String(args.from) : null,
        absorb: args.absorb && args.absorb !== true ? String(args.absorb) : (args.absorb ? true : null)
      });
      printJson({ ...result, resolved });
      if (result.ok === false) process.exitCode = 1;
      return;
    }

    die('unknown command: ' + cmd);
  } catch (err) {
    die(err && err.message ? err.message : String(err));
  }
}

main();
