/** P1a split from src/ralph.mjs — move not rewrite.
 * archiveRun / finalizeRun / archive directory name.
 * P1c: in-place flip; sha256 ledger lives on run.archive (no copy, no archive-manifest.json).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { buildArchiveDirNameFromRunId, loadNamingConfig } from '../namingConfig.mjs';
import {
  RALPHS_DIR_REL,
  RALPH_COMPLETED_DIR_REL,
  RALPH_MAP_REL,
  appendProgressLine,
  loadRun,
  locateRalphRuns,
  moveRunToCompleted,
  nowIso,
  runDir,
  saveRun,
  writeRalphIndex
} from './state.mjs';
import { migrateRuns } from './migrate.mjs';
import {
  applyHandoffState,
  evaluateAcceptArchiveGate,
  persistRunMetrics,
  readGitSourceFacts,
  shouldMaintainHandoff
} from './gates.mjs';
import { mapMergeFromRun } from './map.mjs';
import {
  invokeKnowledgeContributeHook,
  promoteHotMemoryFromRun,
  resolveKnowledgeContributeHookConfig,
  writeKnowledgeContribution
} from './knowledge.mjs';

const ARCHIVE_HASH_SKIP = new Set(['archive-manifest.json']);

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function hashRunTree(dirAbs) {
  const files = [];
  function walk(dir, rel = '') {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ARCHIVE_HASH_SKIP.has(entry.name)) continue;
      const nextRel = rel ? rel + '/' + entry.name : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, nextRel);
      else files.push({
        path: nextRel.replaceAll(String.fromCharCode(92), String.fromCharCode(47)),
        sha256: sha256File(full)
      });
    }
  }
  walk(dirAbs);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

function archiveEventFrom(snapshot) {
  const files = Array.isArray(snapshot?.files) ? snapshot.files : [];
  return {
    archived_at: snapshot.archived_at,
    head: snapshot.head ?? null,
    manifest_hash: snapshot.manifest_hash || sha256Text(JSON.stringify(files))
  };
}

/** Prefer archive dir `YYYY-MM-DD-{name}` without duplicating trailing YYYYMMDD from run_id.
 * Kept for naming helpers and 1.0 snapshot folders; P1c no longer copies into it.
 */
export function defaultArchiveDirName(runId, now = new Date()) {
  return buildArchiveDirNameFromRunId(runId, now, loadNamingConfig());
}

/**
 * Soft archive event: in-place COMPLETED + inline sha256 ledger. Same run stays resumable.
 * Re-archive appends archive_history (time + git HEAD + manifest hash). No file copy.
 * `slug` is accepted for CLI compat and ignored (P1c zero-copy).
 */
export function archiveRun(runId, { cwd = process.cwd(), slug: _slug = null, force = false, diff_paths = null } = {}) {
  const run = loadRun(runId, cwd);
  if (run.status === 'ABANDONED') {
    throw new Error('archive forbidden for ABANDONED runs; resume first if work continues');
  }
  if (run.gates.accept !== 'PASS') throw new Error('archive requires gates.accept=PASS');
  const consistency = evaluateAcceptArchiveGate(run, { cwd, force, diff_paths, gate: 'archive' });
  if (!consistency.ok) throw new Error('archive blocked by product-consistency gate: ' + consistency.reasons.join('; '));
  const sourceAbs = runDir(runId, cwd);
  const liveRelBefore = path.relative(cwd, sourceAbs).split(path.sep).join('/');
  const archivedAt = nowIso();
  const git = readGitSourceFacts(cwd);
  const files = hashRunTree(sourceAbs);
  const manifest_hash = sha256Text(JSON.stringify(files));
  if (run.archive && run.archive.archived_at) {
    run.archive_history = [...(Array.isArray(run.archive_history) ? run.archive_history : []), archiveEventFrom(run.archive)];
  } else if (!Array.isArray(run.archive_history)) {
    run.archive_history = [];
  }
  run.phase = 'ARCHIVE';
  run.status = 'COMPLETED';
  run.gates.archive = 'PASS';
  run.last_archived_at = archivedAt;
  run.updated_at = archivedAt;
  run.archive = {
    archived_at: archivedAt,
    files,
    head: git.head || null,
    manifest_hash
  };
  saveRun(run, cwd);
  appendProgressLine(
    runId,
    cwd,
    '- ' + archivedAt + ' archive status=COMPLETED (moving to completed/) files=' + files.length
      + ' history=' + (run.archive_history || []).length
      + ' from=' + liveRelBefore
  );
  const moved = moveRunToCompleted(runId, cwd);
  const completedRel = path.join(RALPH_COMPLETED_DIR_REL, runId).replaceAll(String.fromCharCode(92), String.fromCharCode(47));
  const latest = loadRun(runId, cwd);
  latest.last_archive_path = completedRel;
  saveRun(latest, cwd);
  writeRalphIndex(cwd);
  let hot_memory = { status: 'skipped', added: 0 };
  try {
    hot_memory = promoteHotMemoryFromRun(latest, { cwd });
    appendProgressLine(
      runId,
      cwd,
      '- ' + nowIso() + ' hot_memory promote status=' + hot_memory.status
        + ' added=' + (hot_memory.added || 0)
        + ' skipped=' + (hot_memory.skipped || 0)
    );
  } catch (err) {
    hot_memory = { status: 'error', added: 0, reason: String(err.message || err) };
    appendProgressLine(runId, cwd, '- ' + nowIso() + ' hot_memory promote skipped: ' + hot_memory.reason);
  }
  return {
    run: loadRun(runId, cwd),
    archive_path: completedRel,
    moved,
    manifest: {
      schema_version: 'jj-flow/ralph-archive/1.1',
      run_id: runId,
      archived_at: archivedAt,
      archive_path: completedRel,
      files,
      head: git.head || null,
      manifest_hash
    },
    hot_memory
  };
}

/**
 * map-merge + archive + elevation package (L1 map, L2 contribution).
 * @param {object} [options]
 * @param {boolean} [options.contribution_package=true] attempt contribution package (P1b writes none; status=degraded)
 * @param {boolean} [options.include_process_lessons_in_map=false] put process lessons into main lessons[]
 */
export function finalizeRun(runId, {
  cwd = process.cwd(),
  slug,
  modules = [],
  lessons = [],
  keywords = [],
  acceptance = [],
  status = 'done',
  force = false,
  diff_paths = null,
  contribution_package = true,
  include_process_lessons_in_map = false
} = {}) {
  const runBefore = loadRun(runId, cwd);
  if (shouldMaintainHandoff(runBefore)) {
    applyHandoffState(runBefore, { cwd, write_file: true });
    saveRun(runBefore, cwd);
  }
  const elevOpts = { modules, lessons, keywords, acceptance, status, force, include_process_lessons_in_map };
  const merged = mapMergeFromRun(runId, elevOpts, cwd);
  persistRunMetrics(runId, cwd);
  const archived = archiveRun(runId, { cwd, slug, force, diff_paths });
  let contribution = null;
  let contribution_path = null;
  let contribute_hook = { status: 'skipped', reason: 'contribution package disabled' };
  if (contribution_package !== false) {
    const written = writeKnowledgeContribution(runId, {
      cwd,
      modules,
      lessons,
      keywords,
      acceptance,
      status,
      include_process_lessons_in_map,
      capability: merged.capability
    });
    contribution = written.contribution;
    contribution_path = written.path;
    if (written.status === 'degraded') {
      contribute_hook = { status: 'skipped', reason: written.reason };
    } else {
      const hookCfg = resolveKnowledgeContributeHookConfig({ hook: false, cwd });
      if (hookCfg.on_finalize && hookCfg.mode && hookCfg.mode !== 'none') {
        contribute_hook = invokeKnowledgeContributeHook(written.abs, contribution, { cwd, ...hookCfg });
        appendProgressLine(
          runId,
          cwd,
          '- ' + nowIso() + ' knowledge-contribute hook on_finalize status=' + contribute_hook.status
            + (contribute_hook.reason ? (' reason=' + contribute_hook.reason) : '')
        );
      } else {
        contribute_hook = { status: 'skipped', reason: 'hook not enabled on finalize (say 投喂知识库 or --hook)' };
      }
    }
  }
  return {
    run: archived.run,
    archive_path: archived.archive_path,
    manifest: archived.manifest,
    capability: merged.capability,
    map_path: RALPH_MAP_REL.replaceAll(String.fromCharCode(92), String.fromCharCode(47)),
    handoff: archived.run.handoff || null,
    contribution,
    contribution_path,
    contribute_hook,
    metrics: archived.run.metrics || null,
    elevation: {
      durable_lessons: merged.elevation?.durable_lessons || [],
      process_lessons: merged.elevation?.process_lessons || []
    }
  };
}

/**
 * List leftover closeouts. Default dry-run.
 * --yes: migrate layout leftovers, then finalize runs whose next is finalize.
 * closeout=check (resume window) is never auto-applied.
 */
export function remediateCloseout({ cwd = process.cwd(), yes = false, force = false } = {}) {
  const located = locateRalphRuns(cwd);
  const items = located.filter((row) => row.closeout === 'finalize' || row.closeout === 'migrate');
  if (!yes) {
    return {
      ok: true,
      action: 'remediate',
      dry_run: true,
      count: items.length,
      items
    };
  }
  let migrated = null;
  if (items.some((row) => row.closeout === 'migrate')) {
    migrated = migrateRuns({ cwd });
  }
  const finalized = [];
  for (const row of items.filter((item) => item.closeout === 'finalize')) {
    try {
      const result = finalizeRun(row.run_id, { cwd, force });
      finalized.push({ run_id: row.run_id, ok: true, archive_path: result.archive_path });
    } catch (err) {
      finalized.push({ run_id: row.run_id, ok: false, error: String(err.message || err) });
    }
  }
  writeRalphIndex(cwd);
  return {
    ok: finalized.every((row) => row.ok),
    action: 'remediate',
    dry_run: false,
    count: items.length,
    items,
    migrated,
    finalized
  };
}
