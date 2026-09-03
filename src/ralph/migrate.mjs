/** P2c: 1:1 ralph migrate + adopt bind. Does not auto-merge dual runs. */
import fs from 'node:fs';
import path from 'node:path';
import { normalizeRalphSlug } from '../namingConfig.mjs';
import {
  FINDINGS_REL,
  PROGRESS_REL,
  RALPH_ROOT_REL,
  RALPH_RUN_SCHEMA_VERSION,
  RALPH_TASKS_DIR_REL,
  STATE_REL,
  TASK_PLAN_REL,
  archiveDir,
  isTaskRunId,
  legacyTasksDir,
  listRuns,
  migratedDir,
  nowIso,
  ralphRoot,
  readJson,
  runDir,
  runJsonPath,
  runStateDir,
  stripRunIdPrefix,
  writeJson,
  writeRalphIndex
} from './state.mjs';
import { defaultFindingsStub } from '../memoryHotLayer.mjs';

const HEADING_MAP = [
  [/^#{1,2}\s+Analyze\s*$/im, '## 分析'],
  [/^#{1,2}\s+Plan\s*$/im, '## 计划'],
  [/^#{1,2}\s+Acceptance\s*$/im, '## 验收'],
  [/^#{1,2}\s+Current\s*$/im, '### 当前'],
  [/^#{1,2}\s+Landed\s*$/im, '### 已落地'],
  [/^#{1,2}\s+Superseded\s*$/im, '### 已取代'],
  [/^#{1,2}\s+MUST\s*$/im, '### 必须项'],
  [/^#{1,2}\s+OUT\s*$/im, '### 范围外'],
  [/^#{1,2}\s+Out of scope\s*$/im, '### 范围外'],
  [/^#{1,2}\s+Flagged concerns\s*$/im, '### 存疑事项'],
  [/^#{1,2}\s+UNRESOLVED\s*$/im, '### 未解决'],
  [/^#{1,2}\s+Tasks\s*$/im, '### 当前'],
  [/^#{1,2}\s+Lessons(?:\s*\(durable\))?\s*$/im, '## 可复用结论']
];

function translateHeadings(text) {
  let out = String(text || '');
  for (const [re, dest] of HEADING_MAP) out = out.replace(re, dest);
  return out;
}

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function uniqueTaskId(slug, cwd, taken) {
  let id = 'task-' + slug;
  if (!taken.has(id) && !fs.existsSync(runDir(id, cwd))) return id;
  let n = 2;
  while (taken.has(id + '-' + n) || fs.existsSync(runDir(id + '-' + n, cwd))) n += 1;
  return id + '-' + n;
}

function buildTaskPlanFromLegacy(srcDir, taskId) {
  const existing = readIfExists(path.join(srcDir, TASK_PLAN_REL));
  if (existing.trim()) return translateHeadings(existing);
  const nl = String.fromCharCode(10);
  const intent = readIfExists(path.join(srcDir, 'intent.md'));
  const analyze = translateHeadings(readIfExists(path.join(srcDir, 'analyze.md')));
  const plan = translateHeadings(readIfExists(path.join(srcDir, 'plan.md')));
  const accept = translateHeadings(readIfExists(path.join(srcDir, 'acceptance.md')));
  const parts = ['# ' + taskId, ''];
  if (intent.trim()) {
    parts.push('## 目标', '', intent.trim(), '');
  } else {
    parts.push('## 目标', '');
  }
  parts.push(analyze.trim() ? analyze.trim() : '## 分析', '');
  parts.push(plan.trim() ? plan.trim() : '## 计划', '');
  parts.push(accept.trim() ? accept.trim() : '## 验收', '');
  return parts.join(nl);
}

function extractFindingsSkeleton(progress) {
  const groups = [];
  const lines = String(progress || '').split(/\r?\n/);
  let current = {};
  for (const line of lines) {
    const must = line.match(/failed_must:\s*(.+)/i);
    const over = line.match(/over_claimed:\s*(.+)/i);
    if (must) current.phenomenon = must[1].trim();
    if (over) current.cause = over[1].trim();
    if (current.phenomenon && current.cause) {
      groups.push(current);
      current = {};
    }
  }
  if (!groups.length) return null;
  const nl = String.fromCharCode(10);
  const body = ['# 踩坑与因果', '', '> 迁移生成，对策与适用范围待补', ''];
  groups.forEach((g, i) => {
    const n = String(i + 1).padStart(3, '0');
    body.push('### F-' + n, '', '- 现象：' + g.phenomenon, '- 原因：' + g.cause, '- 对策：', '- 适用范围：', '- 证据：', '');
  });
  return body.join(nl);
}

function inlineArchiveManifest(run, srcDir) {
  const manifestPath = path.join(srcDir, 'archive-manifest.json');
  if (!fs.existsSync(manifestPath)) return run;
  try {
    const manifest = readJson(manifestPath);
    if (!run.archive) {
      run.archive = {
        archived_at: manifest.archived_at || run.last_archived_at || nowIso(),
        files: Array.isArray(manifest.files) ? manifest.files : [],
        head: manifest.head || null,
        manifest_hash: manifest.manifest_hash || null
      };
    }
  } catch { /* leftover unreadable manifest is not fatal */ }
  return run;
}

export function proposeTaskIdFromLegacy(runId, cwd = process.cwd(), taken = new Set()) {
  const slug = normalizeRalphSlug(stripRunIdPrefix(runId)) || 'run';
  return uniqueTaskId(slug, cwd, taken);
}

export function migrateOneRun(legacyId, { cwd = process.cwd(), taken = new Set(), taskId = null } = {}) {
  const srcDir = path.join(ralphRoot(cwd), legacyId);
  if (!fs.existsSync(srcDir)) throw new Error('legacy run directory not found: ' + legacyId);
  const destId = taskId || proposeTaskIdFromLegacy(legacyId, cwd, taken);
  if (!isTaskRunId(destId)) throw new Error('invalid task id: ' + destId);
  if (fs.existsSync(runJsonPath(destId, cwd))) {
    throw new Error('destination already has a live run: ' + destId + '; pick another --task or omit --task to get -2');
  }
  const destDir = runDir(destId, cwd);
  const stateDir = runStateDir(destId, cwd);
  fs.mkdirSync(stateDir, { recursive: true });
  const oldJson = path.join(srcDir, 'run.json');
  if (!fs.existsSync(oldJson)) throw new Error('legacy run.json missing: ' + legacyId);
  const run = readJson(oldJson);
  run.run_id = destId;
  run.schema_version = RALPH_RUN_SCHEMA_VERSION;
  if (!run.artifact_refs || typeof run.artifact_refs !== 'object') run.artifact_refs = {};
  run.artifact_refs.analyze = TASK_PLAN_REL;
  run.artifact_refs.plan = TASK_PLAN_REL;
  run.artifact_refs.acceptance = TASK_PLAN_REL;
  run.artifact_refs.progress = PROGRESS_REL;
  run.artifact_refs.findings = FINDINGS_REL;
  if (run.artifact_refs.intent) run.artifact_refs.intent = TASK_PLAN_REL;
  inlineArchiveManifest(run, srcDir);
  run.last_archive_path = path.join(RALPH_ROOT_REL, destId).replaceAll(String.fromCharCode(92), String.fromCharCode(47));
  run.updated_at = nowIso();
  writeJson(runJsonPath(destId, cwd), run);

  const taskPlan = buildTaskPlanFromLegacy(srcDir, destId);
  fs.writeFileSync(path.join(destDir, TASK_PLAN_REL), taskPlan.endsWith('\n') ? taskPlan : taskPlan + '\n', 'utf8');

  let progress = readIfExists(path.join(srcDir, PROGRESS_REL));
  if (progress && !/轮次索引/.test(progress)) {
    progress = '# 轮次索引' + String.fromCharCode(10) + String.fromCharCode(10) + progress;
  }
  if (progress) fs.writeFileSync(path.join(destDir, PROGRESS_REL), progress, 'utf8');

  const findings = readIfExists(path.join(srcDir, FINDINGS_REL)) || extractFindingsSkeleton(progress);
  fs.writeFileSync(
    path.join(destDir, FINDINGS_REL),
    findings && findings.trim() ? findings : defaultFindingsStub({ taskKey: destId }),
    'utf8'
  );

  const reviewsSrc = path.join(srcDir, 'reviews');
  if (fs.existsSync(reviewsSrc)) copyDir(reviewsSrc, path.join(stateDir, 'reviews'));
  const handoffFile = path.join(srcDir, 'handoff', 'handoff.json');
  const handoffFlat = path.join(srcDir, 'handoff.json');
  if (fs.existsSync(handoffFile)) fs.copyFileSync(handoffFile, path.join(stateDir, 'handoff.json'));
  else if (fs.existsSync(handoffFlat)) fs.copyFileSync(handoffFlat, path.join(stateDir, 'handoff.json'));
  if (run.handoff) {
    run.handoff.path = path.join(RALPH_ROOT_REL, destId, STATE_REL).replaceAll(String.fromCharCode(92), String.fromCharCode(47));
    if (run.artifact_refs) {
      run.artifact_refs.handoff_ref = path.join(run.handoff.path, 'handoff.json').replaceAll(String.fromCharCode(92), String.fromCharCode(47));
    }
    writeJson(runJsonPath(destId, cwd), run);
  }

  for (const extra of ['instruction-correction.md']) {
    const from = path.join(srcDir, extra);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(destDir, extra));
  }

  for (const drop of ['knowledge-attach.json', 'knowledge-contribution.json', 'archive-manifest.json']) {
    const victim = path.join(destDir, drop);
    if (fs.existsSync(victim)) fs.rmSync(victim, { force: true });
  }

  const migratedAbs = path.join(migratedDir(cwd), legacyId);
  fs.mkdirSync(path.dirname(migratedAbs), { recursive: true });
  if (fs.existsSync(migratedAbs)) fs.rmSync(migratedAbs, { recursive: true, force: true });
  fs.renameSync(srcDir, migratedAbs);
  taken.add(destId);
  return {
    from: legacyId,
    to: destId,
    path: path.join(RALPH_ROOT_REL, destId).replaceAll(String.fromCharCode(92), String.fromCharCode(47)),
    migrated: path.join(RALPH_ROOT_REL, 'migrated', legacyId).replaceAll(String.fromCharCode(92), String.fromCharCode(47))
  };
}

export function liftLegacyTasksLayout(cwd = process.cwd()) {
  const legacyRoot = legacyTasksDir(cwd);
  const lifted = [];
  if (!fs.existsSync(legacyRoot)) return { lifted };
  for (const entry of fs.readdirSync(legacyRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !isTaskRunId(entry.name)) continue;
    const from = path.join(legacyRoot, entry.name);
    const to = path.join(ralphRoot(cwd), entry.name);
    if (fs.existsSync(to)) {
      throw new Error('cannot lift ' + entry.name + ': already exists at ralph root');
    }
    fs.renameSync(from, to);
    lifted.push({
      from: path.join(RALPH_TASKS_DIR_REL, entry.name).replaceAll('\\', '/'),
      to: path.join(RALPH_ROOT_REL, entry.name).replaceAll('\\', '/')
    });
  }
  try {
    if (fs.existsSync(legacyRoot) && fs.readdirSync(legacyRoot).length === 0) fs.rmdirSync(legacyRoot);
  } catch { /* keep empty tasks/ if busy */ }
  return { lifted };
}

export function shelterDotMigrated(cwd = process.cwd()) {
  const root = ralphRoot(cwd);
  const moved = [];
  if (!fs.existsSync(root)) return { moved };
  fs.mkdirSync(migratedDir(cwd), { recursive: true });
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('.migrated-')) continue;
    const bare = entry.name.slice('.migrated-'.length) || entry.name;
    const from = path.join(root, entry.name);
    const to = path.join(migratedDir(cwd), bare);
    if (fs.existsSync(to)) fs.rmSync(to, { recursive: true, force: true });
    fs.renameSync(from, to);
    moved.push({
      from: path.join(RALPH_ROOT_REL, entry.name).replaceAll('\\', '/'),
      to: path.join(RALPH_ROOT_REL, 'migrated', bare).replaceAll('\\', '/')
    });
  }
  return { moved };
}

/**
 * Remove 1.0 archive/ snapshot dirs. Default dry-run; require confirm=true (CLI --yes) to delete.
 */
export function pruneArchive({ cwd = process.cwd(), confirm = false } = {}) {
  const root = archiveDir(cwd);
  const entries = [];
  if (fs.existsSync(root)) {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      entries.push(path.join(RALPH_ROOT_REL, 'archive', entry.name).replaceAll('\\', '/'));
    }
  }
  if (!confirm) {
    return {
      ok: true,
      action: 'prune-archive',
      dry_run: true,
      count: entries.length,
      paths: entries,
      note: 'pass --yes to delete; jj-review may still want one old+one new sample'
    };
  }
  for (const rel of entries) {
    fs.rmSync(path.join(cwd, rel), { recursive: true, force: true });
  }
  if (fs.existsSync(root) && fs.readdirSync(root).length === 0) {
    try { fs.rmdirSync(root); } catch { /* ignore */ }
  }
  return { ok: true, action: 'prune-archive', dry_run: false, count: entries.length, paths: entries };
}

export function migrateRuns({ cwd = process.cwd(), all_projects = false, prune_archive = false, yes = false } = {}) {
  if (all_projects) {
    throw new Error('--all-projects walks ~/.jj-flow map; not implemented in this slice — run migrate per repo cwd');
  }
  const lift = liftLegacyTasksLayout(cwd);
  const shelter = shelterDotMigrated(cwd);
  const pending = listRuns(cwd).filter((row) => row.needs_migrate);
  const taken = new Set(listRuns(cwd).filter((row) => !row.needs_migrate).map((row) => row.run_id));
  const results = [];
  for (const row of pending) {
    results.push(migrateOneRun(row.run_id, { cwd, taken }));
  }
  const prune = prune_archive ? pruneArchive({ cwd, confirm: yes }) : null;
  writeRalphIndex(cwd);
  return {
    ok: true,
    action: 'migrate',
    count: results.length,
    runs: results,
    lifted: lift.lifted,
    sheltered: shelter.moved,
    prune_archive: prune
  };
}

export function adoptRun({ cwd = process.cwd(), task, from = null, absorb = null } = {}) {
  if (absorb) {
    return {
      ok: false,
      action: 'adopt',
      status: 'refused',
      reason: 'adopt --absorb is not automatic (REQ/TASK/REV must be re-numbered by hand)',
      example: 'jj ralph adopt --task task-enter-form-dynamic --absorb <other-task-id>'
    };
  }
  if (!task || !isTaskRunId(task)) throw new Error('adopt requires --task matching task-<slug>');
  const pending = listRuns(cwd).filter((row) => row.needs_migrate);
  const sourceId = from || (pending.length === 1 ? pending[0].run_id : null);
  if (sourceId && pending.some((row) => row.run_id === sourceId)) {
    if (fs.existsSync(runJsonPath(task, cwd))) {
      return {
        ok: false,
        action: 'adopt',
        status: 'refused',
        reason: 'destination already has a live run; adopt --absorb is not automatic',
        dest: task,
        from: sourceId,
        example: 'jj ralph adopt --task ' + task + ' --absorb ' + sourceId
      };
    }
    const taken = new Set(listRuns(cwd).filter((row) => !row.needs_migrate).map((row) => row.run_id));
    return { ok: true, action: 'adopt', ...migrateOneRun(sourceId, { cwd, taken, taskId: task }) };
  }
  if (fs.existsSync(runJsonPath(task, cwd)) || fs.existsSync(runDir(task, cwd))) {
    return { ok: true, action: 'adopt', to: task, path: path.join(RALPH_ROOT_REL, task).replaceAll('\\', '/'), note: 'already on canonical task dir' };
  }
  throw new Error('adopt could not find a legacy run to bind; pass --from RALPH-…');
}
