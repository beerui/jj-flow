/** P1a split from src/ralph.mjs — move not rewrite.
 * Over 600 lines because hot-memory, contribution, and review writeback share one module.
 * Contribution calls map.buildElevationFromRun; gates must not import this file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { assertStrictRalphRunId, loadNamingConfig } from '../namingConfig.mjs';
import { attachKnowledgeRefs, formatKnowledgeRefsMarkdown, resolvePortfolioKbRoot } from '../portfolioKnowledge.mjs';
import { INJECT_SOFT_CAP } from '../memoryRetrieve.mjs';
import { gateLesson } from '../memoryExtract.mjs';
import { ingestContribution } from '../homeKnowledge.mjs';
import { resolveProjectKeyFromCwd } from '../projectMap.mjs';
import {
  appendFindingsEntry,
  appendHotMemoryEntries,
  confirmHotMemoryEntry,
  defaultFindingsStub,
  extractReusableRulesFromFindings,
  formatHotMemoryMarkdown,
  formatHotMemoryProgressLine,
  parseProgressDraft,
  pruneHotMemory,
  retrieveHotMemory
} from '../memoryHotLayer.mjs';
import {
  FINDING_IMPORTANCE,
  FINDING_PASSES,
  HOST_REVIEW_METHODS,
  FINDINGS_REL,
  PROGRESS_REL,
  RALPH_KNOWLEDGE_CONTRIBUTION_SCHEMA,
  RALPH_REVIEW_SCHEMA_VERSION,
  RALPHS_DIR_REL,
  STATE_REL,
  REVIEW_NIT_CAP,
  REVIEW_OUTCOMES,
  REVIEW_SOURCES,
  SECTION_ACCEPT,
  SECTION_ANALYZE,
  SECTION_CURRENT,
  SECTION_FLAGGED,
  SECTION_GOAL,
  SECTION_LANDED,
  SECTION_MUST,
  SECTION_OPEN_QUESTIONS,
  SECTION_OUT,
  SECTION_PLAN,
  SECTION_SUPERSEDED,
  SECTION_UNRESOLVED,
  TASK_PLAN_REL,
  appendProgressLine,
  appendProgressRound,
  createEmptyAcceptLayers,
  createRunSkeleton,
  hydrateIntensityFields,
  isLegacyRalphRunId,
  listRuns,
  loadRun,
  migrateHint,
  moveRunToActive,
  nowIso,
  readJson,
  runDir,
  runLayoutOf,
  runMachineFile,
  runStateDir,
  saveRun,
  setRunStatus,
  unique,
  validateReviewReport,
  writeJson,
  writeRalphIndex
} from './state.mjs';
import {
  buildPlanComplianceFindings,
  isReviewSkipPath,
  readGitSourceFacts,
  resolveReviewScope,
  suggestGateSet,
  writeInstructionCorrection
} from './gates.mjs';
import { buildElevationFromRun, mapFind, tokenize } from './map.mjs';

function hotMemoryQueryFrom(run, extra = '') {
  return [run?.title, run?.goal, extra].filter(Boolean).join('\n');
}

function collectHotMemoryHits(run, { cwd, query = '' } = {}) {
  const projectKey = run?.project_key || resolveProjectKeyFromCwd(cwd);
  if (!projectKey) return { status: 'skipped', hits: [], reason: 'no project_key' };
  return retrieveHotMemory({
    projectKey,
    query: query || hotMemoryQueryFrom(run)
  });
}

export function promoteHotMemoryFromRun(run, { cwd = process.cwd() } = {}) {
  const rel = String(run.artifact_refs?.findings || FINDINGS_REL).replace(/\\/g, '/');
  if (rel.includes('#')) {
    return { status: 'skipped', added: 0, skipped: 0, reason: 'artifact_refs.findings must be a bare filename' };
  }
  const findingsPath = path.join(runDir(run.run_id, cwd), rel);
  if (!fs.existsSync(findingsPath)) {
    return { status: 'skipped', added: 0, skipped: 0, reason: 'no findings.md' };
  }
  const projectKey = run.project_key || resolveProjectKeyFromCwd(cwd);
  if (!projectKey) return { status: 'skipped', added: 0, skipped: 0, reason: 'no project_key' };
  const text = fs.readFileSync(findingsPath, 'utf8');
  const backrefBase = path.join(RALPHS_DIR_REL, run.run_id, rel).replaceAll('\\', '/');
  const rules = extractReusableRulesFromFindings(text, {
    taskKey: run.run_id,
    backrefBase
  });
  if (!rules.length) return { status: 'empty', added: 0, skipped: 0 };
  const written = appendHotMemoryEntries(
    projectKey,
    rules.map((rule) => ({ ...rule, date: nowIso().slice(0, 10) }))
  );
  return { status: written.added ? 'ok' : 'empty', ...written };
}

export function recordFinding(runId, fields = {}, cwd = process.cwd()) {
  const run = loadRun(runId, cwd);
  const dir = runDir(runId, cwd);
  const findingsRel = String(run.artifact_refs?.findings || FINDINGS_REL).replace(/\\/g, '/');
  if (findingsRel.includes('#')) throw new Error('artifact_refs.findings must be a bare filename');
  const findingsPath = path.join(dir, findingsRel);
  const progressPath = path.join(dir, 'progress.md');
  const existing = fs.existsSync(findingsPath)
    ? fs.readFileSync(findingsPath, 'utf8')
    : defaultFindingsStub({ taskKey: runId });
  const progress = fs.existsSync(progressPath) ? fs.readFileSync(progressPath, 'utf8') : '';
  const draft = parseProgressDraft(progress);
  const phenomenon = String(fields.phenomenon || draft.failed_must || '').trim();
  const cause = String(fields.cause || draft.over_claimed || '').trim();
  const action = String(fields.action || '').trim();
  const scope = String(fields.scope || '').trim();
  if (!phenomenon) throw new Error('finding needs --phenomenon (or progress failed_must)');
  if (!cause) throw new Error('finding needs --cause (or progress over_claimed)');
  if (!action) throw new Error('finding needs --action');
  if (!scope) throw new Error('finding needs --scope');
  const rule = String(fields.rule || '').trim() || `${action}（${scope}）`;
  const result = appendFindingsEntry(existing, {
    title: fields.title,
    phenomenon,
    cause,
    action,
    scope,
    cost: fields.cost,
    evidence: fields.evidence,
    rule
  });
  fs.writeFileSync(findingsPath, result.text, 'utf8');
  appendProgressLine(runId, cwd, '- ' + nowIso() + ' finding ' + result.id);
  return {
    run_id: runId,
    id: result.id,
    path: path.relative(cwd, findingsPath).replaceAll('\\', '/')
  };
}

export function confirmProjectHotMemory(needle, { cwd = process.cwd(), projectKey = null } = {}) {
  const key = projectKey || resolveProjectKeyFromCwd(cwd);
  if (!key) throw new Error('project_key required for knowledge-confirm');
  return confirmHotMemoryEntry(key, needle);
}

export function pruneProjectHotMemory({ cwd = process.cwd(), projectKey = null } = {}) {
  const key = projectKey || resolveProjectKeyFromCwd(cwd);
  if (!key) throw new Error('project_key required for knowledge-prune');
  return pruneHotMemory(key);
}

export function initRun(options, cwd = process.cwd()) {
  const requestedId = options.run_id || options.runId;
  if (isLegacyRalphRunId(requestedId)) throw new Error(migrateHint(requestedId));
  const naming = loadNamingConfig();
  if (options?.strict_naming !== false && naming.ralph?.legacy_tolerance?.create_must_follow_config !== false) {
    assertStrictRalphRunId(requestedId, naming);
  }
  const existing = listRuns(cwd).find((row) => row.run_id === requestedId && !row.needs_migrate);
  if (existing && !options.force) {
    throw new Error('run already exists: ' + requestedId + ' (resume the same task_key; use --force to overwrite skeleton)');
  }
  const runOptions = { ...options };
  if (!runOptions.project_key) {
    runOptions.project_key = options.project || options.project_key || resolveProjectKeyFromCwd(cwd);
  }
  if (options?.attach_knowledge !== false && !(options?.knowledge_refs?.length)) {
    const pack = attachKnowledgeRefs({
      title: options.title,
      goal: options.goal,
      project: runOptions.project_key,
      q: options.knowledge_query || '',
      cwd,
      limit: options.knowledge_limit || INJECT_SOFT_CAP
    });
    runOptions.knowledge_refs = pack.knowledge_refs || [];
    runOptions.knowledge_summary = pack.knowledge_summary || [];
    runOptions._knowledge_attach = pack;
  } else {
    runOptions.knowledge_refs = options.knowledge_refs || [];
    runOptions.knowledge_summary = options.knowledge_summary || [];
  }
  const run = createRunSkeleton(runOptions);
  const dir = runDir(run.run_id, cwd);
  if (fs.existsSync(dir) && !options.force) throw new Error('run already exists: ' + run.run_id + ' (use --force to overwrite skeleton)');
  fs.mkdirSync(dir, { recursive: true });
  saveRun(run, cwd);
  const nl = String.fromCharCode(10);
  const knowledgeMd = formatKnowledgeRefsMarkdown({
    knowledge_refs: run.knowledge_refs || [],
    knowledge_summary: run.knowledge_summary || []
  });
  const hotPack = collectHotMemoryHits(run, {
    cwd,
    query: options.knowledge_query || hotMemoryQueryFrom(run)
  });
  const hotMd = formatHotMemoryMarkdown(hotPack.hits || []);
  const writeIntent = options.write_intent === true
    || (options.write_intent !== false && run.intensity !== 'tiny');
  if (writeIntent) {
    run.artifact_refs.intent = TASK_PLAN_REL;
  }
  run.knowledge = {
    memory_refs: unique((hotPack.hits || []).map((hit) => hit.id || hit.rule).filter(Boolean))
  };
  saveRun(run, cwd);
  // P2+b: without an explicit --lite/--full the heuristic only advises. run.json already holds
  // gate_set=full; the suggestion lives on the returned object + a progress line, never in the ledger.
  const explicitGateSet = options.gate_set != null && String(options.gate_set).trim() !== '';
  const gateSetSuggestion = explicitGateSet
    ? null
    : suggestGateSet({ title: run.title, goal: run.goal, scope: run.scope, capability_ids: run.capability_ids });
  const gateSetSuggestionLine = gateSetSuggestion && gateSetSuggestion.gate_set === 'lite'
    ? ('- gate_set_suggestion: lite (advisory; run.json stays full — explicit --lite only) reasons=' + gateSetSuggestion.reasons.join('; ') + nl)
    : '';
  const knowledgeLine = '- knowledge_refs: ' + ((run.knowledge_refs || []).join(', ') || '(none)');
  const goalBody = writeIntent
    ? ('## ' + SECTION_GOAL + nl + nl + (run.goal || '') + nl + nl
      + '### ' + SECTION_OPEN_QUESTIONS + nl + nl
      + '### 问题' + nl + nl
      + '### 预期结果' + nl + nl
      + '### 影响面' + nl + nl
      + '### 约束' + nl)
    : ('## ' + SECTION_GOAL + nl);
  const taskPlan = [
    '# ' + run.run_id,
    '',
    '> 运行: ' + run.run_id + '　状态: ' + run.phase + '/' + run.status,
    '',
    goalBody,
    '',
    '## ' + SECTION_ANALYZE,
    '',
    knowledgeMd,
    '',
    hotMd,
    '',
    '### ' + SECTION_MUST,
    '',
    '### ' + SECTION_OUT,
    '',
    '### ' + SECTION_FLAGGED,
    '',
    '### ' + SECTION_UNRESOLVED,
    '',
    '## ' + SECTION_PLAN,
    '',
    knowledgeLine,
    '',
    '### ' + SECTION_CURRENT,
    '',
    '### ' + SECTION_LANDED,
    '',
    '### ' + SECTION_SUPERSEDED,
    '',
    '## ' + SECTION_ACCEPT,
    '',
    '### ' + SECTION_CURRENT,
    '',
    '| 项 | must_id | evidence_class | 结果 | 证据 |',
    '| --- | --- | --- | --- | --- |',
    '',
    '### ' + SECTION_LANDED,
    ''
  ].join(nl);
  const stubs = {
    [TASK_PLAN_REL]: taskPlan,
    [PROGRESS_REL]: '# ' + run.run_id + ' - 进度' + nl + nl
      + '> 用于上下文恢复。压缩/重启后先读此文件（最后 30 行）。' + nl
      + '> **追加式，时间正序**。' + nl + nl
      + '- ' + nowIso() + ' init ' + run.run_id + nl
      + '- intensity: ' + (run.intensity || 'standard') + nl
      + '- gate_set: ' + (run.gate_set || 'full')
      + (run.gate_set === 'lite' ? (' (brief→deliver→close; max_deliver_loops=' + run.budget.max_deliver_loops + ')') : '') + nl
      + gateSetSuggestionLine
      + '- max_iterations: ' + run.max_iterations + nl
      + '- intent: ' + (run.artifact_refs.intent || '(none)') + nl
      + '- knowledge_refs: ' + ((run.knowledge_refs || []).join(', ') || '(none)') + nl
      + formatHotMemoryProgressLine(hotPack.hits || []) + nl,
    [FINDINGS_REL]: defaultFindingsStub({ taskKey: run.run_id })
  };
  for (const [name, bodyText] of Object.entries(stubs)) {
    const filePath = path.join(dir, name);
    if (!fs.existsSync(filePath) || options.force) fs.writeFileSync(filePath, bodyText, 'utf8');
  }
  const reuse_suggestions = [];
  const seen = new Set([run.run_id]);
  const title = String(run.title || '').trim();
  const goal = String(run.goal || '').trim();
  for (const row of listRuns(cwd)) {
    if (row.run_id === run.run_id) continue;
    const rowTitle = String(row.title || '').trim();
    const overlap = rowTitle && (
      rowTitle === title
      || (title && (rowTitle.includes(title) || title.includes(rowTitle)))
      || (goal && goal.includes(rowTitle))
    );
    if (!overlap) continue;
    reuse_suggestions.push({
      run_id: row.run_id,
      title: row.title,
      needs_migrate: Boolean(row.needs_migrate),
      source: 'list'
    });
    seen.add(row.run_id);
  }
  try {
    const hits = mapFind(run.title || run.goal || '', { cwd, limit: 5 });
    for (const match of hits.matches || []) {
      for (const ref of match.run_refs || []) {
        if (seen.has(ref)) continue;
        seen.add(ref);
        reuse_suggestions.push({ run_id: ref, title: match.title, source: 'map' });
      }
    }
  } catch {
    /* missing map is not fatal */
  }
  if (reuse_suggestions.length) run.reuse_suggestions = reuse_suggestions.slice(0, 5);
  if (gateSetSuggestion) run.gate_set_suggestion = gateSetSuggestion;
  return run;
}

export function buildKnowledgeContribution(run, {
  cwd = process.cwd(),
  modules = [],
  lessons = [],
  keywords = [],
  acceptance = [],
  status = 'done',
  include_process_lessons_in_map = false,
  capability = null
} = {}) {
  if (!run || typeof run !== 'object') throw new Error('run required');
  if (run.status === 'ABANDONED') {
    throw new Error('knowledge contribution forbidden for ABANDONED runs; resume first if work continues');
  }
  const elevation = capability
    ? {
        capability,
        durable_lessons: unique(lessons || capability.lessons || []),
        process_lessons: unique(capability.process_lessons || [])
      }
    : buildElevationFromRun(run, {
        modules,
        lessons,
        keywords,
        acceptance,
        status,
        cwd,
        include_process_lessons_in_map
      });
  const cap = elevation.capability;
  const git = readGitSourceFacts(cwd);
  const candidates = [];
  const extract_audit = [];
  candidates.push({
    type: 'capability',
    title: cap.title,
    summary: cap.summary || run.goal || '',
    keywords: cap.keywords || [],
    body_ref: (cap.acceptance && cap.acceptance[0]) || null,
    confidence: run.gates?.accept === 'PASS' ? 0.75 : 0.4,
    durable: true,
    provenance: {
      run_id: run.run_id,
      files: unique(cap.modules || []),
      source_kind: 'ralph_archive'
    }
  });
  const taskTexts = [run.title, run.goal, cap.title, cap.summary].filter(Boolean);
  const keptBodies = [];
  for (const lesson of elevation.durable_lessons || []) {
    const gated = gateLesson(lesson, { taskTexts, existing: keptBodies });
    if (!gated.keep) {
      extract_audit.push({
        type: 'lesson',
        text: lesson,
        total: gated.score.total,
        reason: gated.score.reason || 'below Gate B'
      });
      continue;
    }
    keptBodies.push(gated.body);
    candidates.push({
      type: 'lesson',
      title: gated.title,
      summary: gated.body,
      keywords: tokenize(lesson).slice(0, 8),
      body_ref: null,
      confidence: gated.score.total >= 75 ? 0.8 : 0.7,
      durable: true,
      extract_score: gated.score.total,
      extract_breakdown: gated.score.breakdown,
      provenance: {
        run_id: run.run_id,
        files: [],
        source_kind: 'ralph_archive'
      }
    });
  }
  return {
    schema_version: RALPH_KNOWLEDGE_CONTRIBUTION_SCHEMA,
    run_id: run.run_id,
    created_at: nowIso(),
    source: {
      repo_root: cwd.replaceAll(String.fromCharCode(92), String.fromCharCode(47)),
      project_key: run.project_key || null,
      git_head: git.head || null,
      branch: git.ref || null,
      archive_path: run.last_archive_path || null,
      last_archived_at: run.last_archived_at || null
    },
    intent: {
      title: run.title,
      goal: run.goal,
      scope_in: run.scope?.in || [],
      scope_out: run.scope?.out || []
    },
    capability_hint: {
      id: cap.id,
      title: cap.title,
      modules: cap.modules || [],
      keywords: cap.keywords || [],
      acceptance_paths: cap.acceptance || []
    },
    candidates,
    extract_audit,
    existing_knowledge_refs: Array.isArray(run.knowledge_refs) ? [...run.knowledge_refs] : [],
    policy: {
      suggest_status: 'candidate',
      auto_promote: false
    },
    elevation: {
      durable_lessons: elevation.durable_lessons,
      process_lessons: elevation.process_lessons
    }
  };
}

export const KNOWLEDGE_CONTRIBUTION_DEGRADED_REASON =
  'P1b stopped knowledge-contribution.json; home ingest replaced by hot memory';

export function writeKnowledgeContribution(runId, options = {}) {
  const cwd = options.cwd || process.cwd();
  const run = loadRun(runId, cwd);
  if (run.status === 'ABANDONED') {
    throw new Error('knowledge contribution forbidden for ABANDONED runs');
  }
  appendProgressLine(runId, cwd, '- ' + nowIso() + ' knowledge-contribute skipped: ' + KNOWLEDGE_CONTRIBUTION_DEGRADED_REASON);
  return {
    path: null,
    abs: null,
    contribution: null,
    run_id: runId,
    status: 'degraded',
    reason: KNOWLEDGE_CONTRIBUTION_DEGRADED_REASON
  };
}

/**
 * Resolve L2 extract hook config from options / env / naming.json.
 * Env: RALPH_KNOWLEDGE_HOOK=none|cli, RALPH_KNOWLEDGE_HOOK_CMD="node kb.mjs extract --source {package}"
 */
export function resolveKnowledgeContributeHookConfig({ hook = false, cwd = process.cwd() } = {}) {
  const naming = loadNamingConfig();
  const cfg = naming.ralph?.knowledge_contribute || {};
  const envMode = process.env.RALPH_KNOWLEDGE_HOOK || null;
  const envCmd = process.env.RALPH_KNOWLEDGE_HOOK_CMD || null;
  let mode = 'none';
  if (hook === true || hook === 'cli') mode = envMode || cfg.hook || 'cli';
  else if (typeof hook === 'string' && hook) mode = hook;
  else if (cfg.on_finalize && cfg.hook && cfg.hook !== 'none') mode = cfg.hook;
  else mode = envMode || 'none';
  if (mode === true) mode = 'cli';
  return {
    mode,
    cli: envCmd || cfg.cli || null,
    fail_open: cfg.fail_open !== false,
    timeout_ms: Number(cfg.timeout_ms) > 0 ? Number(cfg.timeout_ms) : 30000,
    on_finalize: Boolean(cfg.on_finalize),
    cwd
  };
}

/**
 * Best-effort extract hook. Never throws when fail_open (default).
 * @param {string} packageAbs absolute path to knowledge-contribution.json
 * @param {object} packageObj parsed package
 */
export function invokeKnowledgeContributeHook(packageAbs, packageObj, options = {}) {
  const cfg = {
    mode: options.mode || 'none',
    cli: options.cli || null,
    fail_open: options.fail_open !== false,
    timeout_ms: options.timeout_ms || 30000,
    cwd: options.cwd || process.cwd()
  };
  if (!cfg.mode || cfg.mode === 'none' || cfg.mode === false) {
    return { status: 'skipped', reason: 'hook not requested' };
  }
  if (cfg.mode === 'http') {
    return { status: 'skipped', reason: 'http hook not implemented; use cli or external extract' };
  }
  if (cfg.mode !== 'cli' && cfg.mode !== true) {
    return { status: 'skipped', reason: 'unknown hook mode: ' + String(cfg.mode) };
  }

  const projectKey = packageObj?.source?.project_key
    || resolveProjectKeyFromCwd(cfg.cwd)
    || '';

  let command = cfg.cli;
  if (!command) {
    const ingested = ingestContribution(packageObj, { cwd: cfg.cwd, projectKey });
    if (ingested.ok) {
      return {
        status: 'ok',
        command: 'builtin-home-knowledge',
        project_key: ingested.project_key,
        written: ingested.written,
        ids: ingested.ids,
        stdout: JSON.stringify(ingested)
      };
    }
    const root = resolvePortfolioKbRoot();
    if (!root) {
      return { status: 'skipped', reason: ingested.reason || 'knowledge_root not found (set dispatch.knowledge_root / PORTFOLIO_KB_ROOT)' };
    }
    const kbJs = path.join(root, 'tools', 'kb.mjs');
    if (!fs.existsSync(kbJs)) {
      return {
        status: 'skipped',
        reason: ingested.reason
          || ('default kb CLI missing: ' + kbJs.replaceAll(String.fromCharCode(92), String.fromCharCode(47))
          + ' (set ralph.knowledge_contribute.cli or RALPH_KNOWLEDGE_HOOK_CMD)')
      };
    }
    command = 'node "' + kbJs + '" extract --source "{package}" --project "{project}" --status candidate';
  }

  const filled = String(command)
    .replaceAll('{package}', packageAbs)
    .replaceAll('{package_json}', packageAbs)
    .replaceAll('{run_id}', packageObj?.run_id || '')
    .replaceAll('{project}', projectKey)
    .replaceAll('{project_key}', projectKey);

  try {
    const stdout = execSync(filled, {
      cwd: cfg.cwd,
      timeout: cfg.timeout_ms,
      shell: true,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return {
      status: 'ok',
      command: filled,
      stdout: String(stdout || '').slice(0, 2000)
    };
  } catch (err) {
    const result = {
      status: 'failed',
      command: filled,
      error: err?.message || String(err),
      stderr: String(err?.stderr || '').slice(0, 2000),
      code: err?.status ?? err?.code ?? null
    };
    if (cfg.fail_open) return result;
    throw new Error('knowledge contribute hook failed: ' + result.error);
  }
}

/**
 * Write contribution package; optional extract hook (candidate only, fail-open).
 * User utterance:「投喂知识库」→ knowledgeContribute(..., { hook: true })
 */
export function knowledgeContribute(runId, {
  cwd = process.cwd(),
  modules = [],
  lessons = [],
  keywords = [],
  acceptance = [],
  status = 'done',
  include_process_lessons_in_map = false,
  hook = false
} = {}) {
  const written = writeKnowledgeContribution(runId, {
    cwd,
    modules,
    lessons,
    keywords,
    acceptance,
    status,
    include_process_lessons_in_map
  });
  if (written.status === 'degraded') {
    return { ...written, hook: { status: 'skipped', reason: written.reason } };
  }
  const hookCfg = resolveKnowledgeContributeHookConfig({ hook, cwd });
  let hookResult;
  if (!hook) {
    hookResult = { status: 'skipped', reason: 'hook not requested' };
  } else {
    // explicit hook:true forces cli mode if config is none
    const mode = hook && (hookCfg.mode === 'none' || !hookCfg.mode) ? 'cli' : hookCfg.mode;
    hookResult = invokeKnowledgeContributeHook(written.abs, written.contribution, {
      ...hookCfg,
      mode
    });
    appendProgressLine(
      runId,
      cwd,
      '- ' + nowIso() + ' knowledge-contribute hook status=' + hookResult.status
        + (hookResult.reason ? (' reason=' + hookResult.reason) : '')
        + (hookResult.error ? (' error=' + hookResult.error) : '')
    );
  }
  return {
    ...written,
    hook: hookResult
  };
}

function nextReviewId(run) {
  const existing = Array.isArray(run.review?.reviews) ? run.review.reviews : [];
  let max = 0;
  for (const item of existing) {
    const match = String(item.review_id || '').match(/^REV-([1-9][0-9]*)$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return 'REV-' + (max + 1);
}

function normalizeFindingClass(description) {
  return String(description || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ').trim().slice(0, 80);
}

function applyNitCap(findings) {
  let openNits = 0;
  return findings.map((finding) => {
    const isNit = finding.importance === 'nit' || finding.severity === 'info';
    if (finding.status !== 'OPEN' || !isNit) return finding;
    openNits += 1;
    if (openNits <= REVIEW_NIT_CAP) return finding;
    return { ...finding, status: 'WAIVED', acceptance: finding.acceptance + ' (nit cap)' };
  });
}

function normalizeFindings(findings = []) {
  const mapped = [];
  for (const [index, finding] of findings.entries()) {
    const file = finding.file || 'unknown';
    if (isReviewSkipPath(file)) continue;
    const item = {
      id: finding.id || ('F-' + (index + 1)),
      severity: finding.severity || 'medium',
      file,
      line: Number.isInteger(finding.line) ? finding.line : 1,
      description: finding.description || '',
      status: finding.status || 'OPEN',
      acceptance: finding.acceptance || '待确认'
    };
    if (finding.pass && FINDING_PASSES.includes(finding.pass)) item.pass = finding.pass;
    if (finding.importance && FINDING_IMPORTANCE.includes(finding.importance)) item.importance = finding.importance;
    else if (item.severity === 'info') item.importance = 'nit';
    mapped.push(item);
  }
  return applyNitCap(mapped);
}

export function normalizeHostReview(host_review = null) {
  if (host_review == null || host_review === '') return null;
  if (typeof host_review === 'string') {
    try {
      host_review = JSON.parse(host_review);
    } catch {
      throw new Error('host_review must be a JSON object or object string');
    }
  }
  if (typeof host_review !== 'object' || Array.isArray(host_review)) {
    throw new Error('host_review must be an object when present');
  }
  const method = host_review.method != null && String(host_review.method).trim()
    ? String(host_review.method).trim()
    : null;
  if (method && !HOST_REVIEW_METHODS.includes(method)) {
    throw new Error('host_review.method must be one of ' + HOST_REVIEW_METHODS.join(', '));
  }
  return {
    method,
    entry: host_review.entry != null && String(host_review.entry).trim() ? String(host_review.entry).trim() : null,
    artifact_paths: unique(Array.isArray(host_review.artifact_paths) ? host_review.artifact_paths.map(String) : []),
    note: host_review.note != null && String(host_review.note).trim() ? String(host_review.note) : null
  };
}

export function recordReview(runId, {
  cwd = process.cwd(),
  outcome,
  reviewed_commit = null,
  fix_commit = null,
  review_scope = null,
  task_thread_id = null,
  review_thread_id = null,
  summary = '',
  findings = [],
  evidence_refs = [],
  review_id,
  source = null,
  host_review = null,
  include_compliance = true
} = {}) {
  if (!REVIEW_OUTCOMES.includes(outcome)) throw new Error('outcome must be one of ' + REVIEW_OUTCOMES.join(', '));
  if (source != null && source !== '' && !REVIEW_SOURCES.includes(source)) {
    throw new Error('source must be one of ' + REVIEW_SOURCES.join(', '));
  }
  const run = hydrateIntensityFields(loadRun(runId, cwd));
  const id = review_id || nextReviewId(run);
  if (review_id && run.review?.reviews?.some((item) => item.review_id === review_id)) throw new Error('review already exists: ' + review_id);
  const resolvedFix = fix_commit || null;
  const resolvedReviewed = reviewed_commit || null;
  const resolvedScope = resolveReviewScope({ review_scope, fix_commit: resolvedFix, reviewed_commit: resolvedReviewed });
  const resolvedSource = source != null && source !== '' ? source : null;
  const resolvedHostReview = normalizeHostReview(host_review);
  let mergedFindings = [...(findings || [])];
  if (include_compliance !== false) {
    mergedFindings = mergedFindings.concat(buildPlanComplianceFindings(run, cwd));
  }
  let resolvedOutcome = outcome;
  let normalizedPreview = normalizeFindings(mergedFindings);
  if (resolvedOutcome === 'PASS' && normalizedPreview.some((item) => item.status === 'OPEN' && item.importance === 'important')) {
    resolvedOutcome = 'NEEDS_CHANGES';
  }
  if (resolvedOutcome === 'PASS') {
    normalizedPreview = normalizedPreview.map((item) => {
      if (item.status === 'OPEN' && (item.importance === 'nit' || item.severity === 'info')) {
        return { ...item, status: 'WAIVED', acceptance: item.acceptance + ' (nit)' };
      }
      return item;
    });
  }
  const previousOpen = [];
  const existingReviews = Array.isArray(run.review?.reviews) ? run.review.reviews : [];
  for (const prev of existingReviews) {
    if (!prev?.path) continue;
    const absPrev = runMachineFile(runId, prev.path, cwd);
    if (!fs.existsSync(absPrev)) continue;
    try {
      const old = readJson(absPrev);
      for (const finding of old.findings || []) {
        if (finding.status === 'OPEN') previousOpen.push(finding);
      }
    } catch {
      // ignore unreadable prior review
    }
  }
  for (const finding of normalizedPreview) {
    if (finding.status !== 'OPEN') continue;
    const cls = (finding.pass || '') + '|' + normalizeFindingClass(finding.description);
    const repeat = previousOpen.some((old) => ((old.pass || '') + '|' + normalizeFindingClass(old.description)) === cls);
    if (repeat) {
      writeInstructionCorrection(runId, cwd, {
        count: 2,
        repeated_signal: cls,
        proposed_rule: finding.description
      });
      break;
    }
  }
  const report = {
    schema_version: RALPH_REVIEW_SCHEMA_VERSION,
    review_id: id,
    run_id: run.run_id,
    outcome: resolvedOutcome,
    reviewed_commit: resolvedReviewed,
    fix_commit: resolvedFix || (resolvedScope === 'commit' ? resolvedReviewed : null),
    review_scope: resolvedScope,
    task_thread_id: task_thread_id || run.review?.task_thread_id || null,
    review_thread_id: review_thread_id || null,
    summary: summary || '',
    findings: normalizedPreview,
    evidence_refs: unique(evidence_refs),
    recorded_at: nowIso()
  };
  if (resolvedSource) report.source = resolvedSource;
  if (resolvedHostReview) report.host_review = resolvedHostReview;
  const errors = validateReviewReport(report);
  if (errors.length) throw new Error('invalid review: ' + errors.join('; '));
  const relPath = path.join('reviews', id + '.json').replaceAll(String.fromCharCode(92), String.fromCharCode(47));
  writeJson(path.join(runStateDir(runId, cwd), relPath), report);
  const entry = {
    review_id: id,
    path: relPath,
    outcome: report.outcome,
    reviewed_commit: report.reviewed_commit,
    fix_commit: report.fix_commit,
    review_scope: report.review_scope,
    task_thread_id: report.task_thread_id,
    review_thread_id: report.review_thread_id,
    recorded_at: report.recorded_at
  };
  if (report.source) entry.source = report.source;
  const previous = run.review && typeof run.review === 'object' ? run.review : { latest_review_id: null, task_thread_id: null, reviews: [] };
  const reviews = Array.isArray(previous.reviews) ? [...previous.reviews, entry] : [entry];
  run.review = { latest_review_id: id, task_thread_id: report.task_thread_id || previous.task_thread_id || null, reviews };
  run.artifact_refs = { ...run.artifact_refs, latest_review_ref: relPath };
  // Dual-layer accept: review outcome drives judgment layer (strict needs this before gate accept).
  run.accept_layers = run.accept_layers || createEmptyAcceptLayers(run.intensity || 'standard');
  if (report.outcome === 'PASS') {
    run.accept_layers.judgment = 'PASS';
    run.accept_layers.judgment_mode = 'review';
  } else if (report.outcome === 'NEEDS_CHANGES' || report.outcome === 'BLOCKED') {
    run.accept_layers.judgment = 'FAIL';
    run.accept_layers.judgment_mode = 'review';
  }
  run.updated_at = nowIso();
  saveRun(run, cwd);
  const progressPath = path.join(runDir(runId, cwd), 'progress.md');
  const nl = String.fromCharCode(10);
  let line = '- ' + report.recorded_at + ' review ' + id + ' ' + report.outcome;
  if (report.reviewed_commit) line += ' commit=' + report.reviewed_commit;
  if (report.fix_commit) line += ' fix_commit=' + report.fix_commit;
  if (report.review_scope) line += ' scope=' + report.review_scope;
  if (report.source) line += ' source=' + report.source;
  if (report.task_thread_id) line += ' task_thread=' + report.task_thread_id;
  if (report.review_thread_id) line += ' review_thread=' + report.review_thread_id;
  line += ' accept_layers.judgment=' + run.accept_layers.judgment;
  line += nl;
  if (fs.existsSync(progressPath)) fs.appendFileSync(progressPath, line, 'utf8');
  else fs.writeFileSync(progressPath, '# Progress' + nl + nl + line, 'utf8');
  return { run, report, path: path.join(RALPHS_DIR_REL, runId, STATE_REL, relPath).replaceAll(String.fromCharCode(92), String.fromCharCode(47)) };
}

/**
 * Resume same run_id to IN_PROGRESS (from COMPLETED / ABANDONED / PAUSED / BLOCKED / etc.).
 * If the run sits under completed/, rename it back to the ralph root first, then open a new progress round.
 */
export function resumeRun(runId, { reason, cwd = process.cwd() } = {}) {
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new Error('reason is required for resumeRun');
  }
  const moved = runLayoutOf(runId, cwd) === 'completed' ? moveRunToActive(runId, cwd) : { moved: false };
  const result = setRunStatus(runId, { status: 'IN_PROGRESS', reason: reason.trim(), cwd });
  appendProgressRound(runId, cwd, {
    title: 'resume',
    goal: reason.trim(),
    result: '进行中',
    findingHint: null
  });
  const hotPack = collectHotMemoryHits(result.run, { cwd, query: reason.trim() });
  appendProgressLine(runId, cwd, formatHotMemoryProgressLine(hotPack.hits || []));
  writeRalphIndex(cwd);
  return { ...result, action: 'resume', moved, hot_memory: hotPack };
}
