/** P1a split from src/ralph.mjs — move not rewrite.
 * archiveRun / finalizeRun / archive directory name.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { buildArchiveDirNameFromRunId, loadNamingConfig } from '../namingConfig.mjs';
import {
  RALPH_ARCHIVE_DIR_REL,
  RALPH_MAP_REL,
  appendProgressLine,
  loadRun,
  nowIso,
  runDir,
  saveRun,
  writeJson
} from './state.mjs';
import {
  applyHandoffState,
  evaluateAcceptArchiveGate,
  persistRunMetrics,
  shouldMaintainHandoff
} from './gates.mjs';
import { mapMergeFromRun } from './map.mjs';
import {
  invokeKnowledgeContributeHook,
  promoteHotMemoryFromRun,
  resolveKnowledgeContributeHookConfig,
  writeKnowledgeContribution
} from './knowledge.mjs';

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
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


/** Prefer archive dir `YYYY-MM-DD-{name}` without duplicating trailing YYYYMMDD from run_id. */
export function defaultArchiveDirName(runId, now = new Date()) {
  return buildArchiveDirNameFromRunId(runId, now, loadNamingConfig());
}

/**
 * Soft archive event: snapshot + COMPLETED display status. Same run stays resumable;
 * re-archive is allowed (timestamped folder when path already exists). Not a tombstone.
 */
export function archiveRun(runId, { cwd = process.cwd(), slug, force = false, diff_paths = null } = {}) {
  const run = loadRun(runId, cwd);
  if (run.status === 'ABANDONED') {
    throw new Error('archive forbidden for ABANDONED runs; resume first if work continues');
  }
  if (run.gates.accept !== 'PASS') throw new Error('archive requires gates.accept=PASS');
  const consistency = evaluateAcceptArchiveGate(run, { cwd, force, diff_paths, gate: 'archive' });
  if (!consistency.ok) throw new Error('archive blocked by product-consistency gate: ' + consistency.reasons.join('; '));
  let folder = slug || defaultArchiveDirName(run.run_id);
  let destRel = path.join(RALPH_ARCHIVE_DIR_REL, folder);
  let destAbs = path.join(cwd, destRel);
  // Re-archive: append UTC timestamp so prior snapshots remain; do not hard-fail.
  if (fs.existsSync(destAbs)) {
    const stamp = nowIso().replace(/[:.]/g, '-');
    folder = folder + '-' + stamp;
    destRel = path.join(RALPH_ARCHIVE_DIR_REL, folder);
    destAbs = path.join(cwd, destRel);
  }
  const sourceAbs = runDir(runId, cwd);
  // Soft closeout: COMPLETED is a display/compat alias after archive, not a freeze.
  const archivedAt = nowIso();
  const archivePathNorm = destRel.replaceAll(String.fromCharCode(92), String.fromCharCode(47));
  run.phase = 'ARCHIVE';
  run.status = 'COMPLETED';
  run.gates.archive = 'PASS';
  run.last_archived_at = archivedAt;
  run.last_archive_path = archivePathNorm;
  run.updated_at = archivedAt;
  saveRun(run, cwd);
  copyTree(sourceAbs, destAbs);
  const files = [];
  function walk(dir, rel = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const nextRel = rel ? rel + '/' + entry.name : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, nextRel);
      else files.push({ path: nextRel.replaceAll(String.fromCharCode(92), String.fromCharCode(47)), sha256: sha256File(full) });
    }
  }
  walk(destAbs);
  const manifest = {
    schema_version: 'jj-flow/ralph-archive/1.0',
    run_id: run.run_id,
    archived_at: archivedAt,
    archive_path: archivePathNorm,
    files
  };
  writeJson(path.join(sourceAbs, 'archive-manifest.json'), manifest);
  writeJson(path.join(destAbs, 'archive-manifest.json'), manifest);
  appendProgressLine(
    runId,
    cwd,
    '- ' + archivedAt + ' archive soft path=' + archivePathNorm + ' status=COMPLETED (resumable)'
  );
  // refresh in-memory run after manifest write (active tree now has manifest)
  const latest = loadRun(runId, cwd);
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
  return { run: latest, archive_path: archivePathNorm, manifest, hot_memory };
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
