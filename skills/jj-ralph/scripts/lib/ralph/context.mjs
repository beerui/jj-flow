import fs from 'node:fs';
import path from 'node:path';
import { assertSnapshot, digest, normalizeGitPath, resolveCommit, snapshotCommit, snapshotGit } from '../gitSnapshot.mjs';
import {
  computeRalphNext, isLegacyRalphRunId, isTaskRunId, loadRun, locateRalphRuns, nowIso, readRunEventsText,
  runLayoutOf, runWorkspaceDir, writeJson
} from './state.mjs';
import {
  collectClaimedImplementationPaths, extractAcceptanceActiveText, extractLedgerPathRefs, extractMarkdownSection,
  extractPlanCurrentSection, getLatestReviewRecord, inspectAnalyzePlanArtifacts,
  isWorkflowNoisePath, readRalphContract, readRunArtifactText
} from './gates.mjs';

const SCHEMA = 'jj-flow/ralph-context/1';
const tail = (text, count) => text.trim().split(/\r?\n/).slice(-count).join('\n');
const relative = (cwd, target) => path.relative(cwd, target).replaceAll('\\', '/');

function compactRow(row) {
  const keys = ['run_id', 'title', 'phase', 'status', 'layout', 'path', 'next', 'warning', 'closeout', 'readonly', 'needs_migrate', 'host_thread_id', 'task_thread_id'];
  return Object.fromEntries(keys.filter(key => row[key] != null || ['next', 'warning', 'closeout'].includes(key)).map(key => [key, row[key] ?? null]));
}

/** No metrics or business-map load on the conversational entry path. */
export function getRalphSummary({ runId = null, cwd = process.cwd(), limit = 8, details = false } = {}) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('limit must be an integer >= 1');
  const rows = locateRalphRuns(cwd, { runId });
  const shown = details ? rows : rows.slice(0, limit).map(compactRow);
  return { run_id: runId, runs: shown, total: rows.length, omitted: rows.length - shown.length };
}

function pathClaim(value) {
  try { return normalizeGitPath(value); } catch { return null; }
}

// Ownership needs repository-relative paths, never a coincidentally equal basename.
function covers(claim, file) {
  return claim === file || (claim.endsWith('/') && file.startsWith(claim));
}

function partition(entries, claims) {
  const task = new Set();
  const other = new Set();
  for (const entry of entries) {
    const paths = [entry.path, entry.original_path].filter(Boolean);
    const selected = paths.some(file => claims.some(claim => covers(claim, file)));
    for (const file of paths) (selected ? task : other).add(file);
  }
  return { task_paths: [...task].sort(), other_paths: [...other].sort() };
}

/** A read-only phase packet; --review additionally carries the prior review checklist. */
export function getRalphContext(runId, {
  cwd = process.cwd(), review = false, review_scope = 'working_tree', reviewed_commit = null, base_commit = null
} = {}) {
  if (!isTaskRunId(runId) && !isLegacyRalphRunId(runId)) throw new Error('invalid run_id: ' + runId);
  if (!['working_tree', 'commit'].includes(review_scope)) throw new Error('review scope must be working_tree or commit');
  if (review_scope === 'working_tree' && base_commit) throw new Error('base-commit requires commit scope');
  const run = loadRun(runId, cwd);
  if (run.run_id !== runId) throw new Error('run identity does not match its directory');
  const contract = readRalphContract(run, cwd);
  const layout = run._readonly_archive_path ? 'archive' : runLayoutOf(runId, cwd);
  const next = computeRalphNext(run, { layout });
  const packet = {
    schema_version: SCHEMA, run_id: runId, generated_at: nowIso(),
    title: run.title, goal: run.goal, phase: run.phase, status: run.status, layout,
    path: relative(cwd, runWorkspaceDir(run, cwd)), gates: run.gates, ...next,
    contract: {
      goal: extractMarkdownSection(contract.plan, 'Goal'),
      questions: extractMarkdownSection(contract.plan, '存疑'),
      steps: extractPlanCurrentSection(contract.plan),
      acceptance: extractAcceptanceActiveText(contract.acceptance)
    },
    contract_sha256: digest(JSON.stringify(contract)),
    plan_preflight: inspectAnalyzePlanArtifacts(run, cwd),
    verification: {
      progress_tail: tail(readRunArtifactText(run, 'progress', cwd), 30),
      events_tail: tail(readRunEventsText(runId, cwd), 15)
    },
    reference: /review/.test(next.next || '') ? 'jj-review/SKILL.md'
      : 'jj-ralph/references/phases.md#' + ({ ANALYZE: 'user-intervention-only-these', PLAN: 'lean-execution', DELIVER: 'lean-execution', ACCEPT: 'gate', ARCHIVE: 'closeout' }[run.phase] || 'closeout')
  };
  let snapshot;
  try { snapshot = snapshotGit(cwd, { include: file => !isWorkflowNoisePath(file) }); }
  catch (error) {
    if (review) throw error;
    return { ...packet, diff: null, scope_preflight: { ok: false, reasons: [error.message] } };
  }
  if (snapshot.root !== fs.realpathSync(cwd)) throw new Error('Ralph context cwd must be the intended Git root: ' + snapshot.root);
  const claims = [...new Set(collectClaimedImplementationPaths(run, cwd).map(pathClaim).filter(Boolean))].sort();
  const working = partition(snapshot.entries, claims);
  const commit = review_scope === 'commit' ? snapshotCommit(cwd, {
    reviewed_commit: reviewed_commit || 'HEAD', base_commit, include: file => !isWorkflowNoisePath(file)
  }) : null;
  if (reviewed_commit && review_scope === 'working_tree' && resolveCommit(reviewed_commit, cwd) !== snapshot.head) {
    throw new Error('working_tree context reviewed_commit must match HEAD');
  }
  const selected = commit ? partition(commit.entries, claims) : working;
  const missing = claims.filter(claim => !selected.task_paths.some(file => covers(claim, file)));
  const unplanned = selected.task_paths.filter(file => !claims.some(claim => covers(claim, file)));
  const excluded = (run.scope?.out || []).map(pathClaim).filter(Boolean);
  const overlap = selected.task_paths.filter(file => excluded.some(claim => covers(claim, file)));
  const reasons = [];
  if (!claims.length) reasons.push('no repository paths in the current contract');
  if (!selected.task_paths.length) reasons.push('no reviewable task diff; choose a commit range for already committed work');
  if (missing.length) reasons.push('planned missing from diff: ' + missing.join(', '));
  if (unplanned.length) reasons.push('rename endpoints missing from plan: ' + unplanned.join(', '));
  if (overlap.length) reasons.push('scope.in/plan conflicts with scope.out: ' + overlap.join(', '));
  if (commit && working.task_paths.length) reasons.push('commit scope has uncommitted task changes: ' + working.task_paths.join(', '));
  if (commit && commit.reviewed_commit !== snapshot.head) reasons.push('commit context must review current HEAD');
  if (snapshot.contents.some(item => item.kind === 'directory')) reasons.push('dirty submodule/directory needs a separate review snapshot');
  packet.diff = {
    review_scope,
    reviewed_commit: commit?.reviewed_commit || snapshot.head,
    base_commit: commit?.base_commit || null,
    snapshot: { root: snapshot.root, head: snapshot.head, branch: snapshot.branch, fingerprint: snapshot.fingerprint },
    commit_sha256: commit?.sha256 || null,
    claimed_paths: claims,
    plan_paths: extractLedgerPathRefs(packet.contract.steps),
    scope_in: run.scope?.in || [], scope_out: run.scope?.out || [],
    ...selected,
    working_tree_other_paths: working.other_paths,
    deleted_paths: (commit?.entries || snapshot.entries).filter(entry => entry.status.includes('D') && selected.task_paths.includes(entry.path)).map(entry => entry.path).sort(),
    missing_claims: missing
  };
  packet.scope_preflight = { ok: reasons.length === 0, reasons };
  if (review) packet.review_handoff = {
    role: 'read-only', latest_review: getLatestReviewRecord(run, cwd),
    instructions: 'Review task_paths against the current contract and verification. Other paths are visible but outside this task. Recheck prior OPEN findings. Do not change code or advance gates.',
    scope_note: commit ? 'Review base_commit..reviewed_commit (null base means root commit).' : 'Review staged, unstaged and untracked task_paths; reviewed_commit identifies the base HEAD, not an immutable review of dirty files.'
  };
  return packet;
}

export function writeRalphContext(file, packet, cwd = process.cwd()) {
  const absolute = path.resolve(cwd, file);
  const rel = relative(cwd, absolute);
  if (!rel.startsWith('../') && !path.isAbsolute(rel) && !isWorkflowNoisePath(rel)) {
    throw new Error('write context under .workflow/ or outside the repository so it cannot change its own snapshot');
  }
  writeJson(absolute, packet);
  return absolute;
}

export function readJsonInput(file, cwd = process.cwd(), shape = 'object') {
  if (typeof file !== 'string' || !file) throw new Error('JSON input file path required');
  const value = JSON.parse(fs.readFileSync(path.resolve(cwd, file), 'utf8').replace(/^\uFEFF/, ''));
  if (shape === 'array' ? !Array.isArray(value) : !value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`JSON input file must contain an ${shape}: ${file}`);
  }
  return value;
}

/** Recompute ownership as well as hashes; a caller-supplied file list is not evidence. */
export function validateRalphContext(runId, context, { cwd = process.cwd(), require_ready = false } = {}) {
  if (context?.schema_version !== SCHEMA || context.run_id !== runId || !context.diff) throw new Error('invalid or mismatched Ralph context');
  const current = getRalphContext(runId, {
    cwd, review: true, review_scope: context.diff.review_scope,
    reviewed_commit: context.diff.reviewed_commit, base_commit: context.diff.base_commit
  });
  assertSnapshot(context.diff.snapshot, current.diff.snapshot);
  if (context.contract_sha256 !== current.contract_sha256 || JSON.stringify(context.diff) !== JSON.stringify(current.diff)) {
    throw new Error('Ralph contract or diff selection changed; regenerate context and review the delta');
  }
  if (require_ready && !current.scope_preflight.ok) throw new Error('scope preflight: ' + current.scope_preflight.reasons.join('; '));
  return current;
}

export function contextGateOptions(runId, file, cwd = process.cwd()) {
  if (!file) return {};
  const context = validateRalphContext(runId, readJsonInput(file, cwd), { cwd, require_ready: true });
  return { diff_paths: context.diff.task_paths, deleted_paths: context.diff.deleted_paths };
}
