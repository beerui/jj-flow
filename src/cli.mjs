import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { buildDispatch, MODE_CHOICES, renderMarkdown } from './dispatch.mjs';
import {
  installSkill,
  projectClaudeSkillsTarget,
  projectClaudeTarget,
  projectCodexAgentsTarget,
  projectCodexTarget,
  projectGrokTarget,
  projectQoderTarget,
  uninstallSkill
} from './installSkill.mjs';
import { loadCurrentReleaseLog } from './releaseLog.mjs';
import { persistPlaneCas, tickDispatch } from './dispatchRuntime.mjs';
import { inspectHarnessRepository, renderDoctorText } from './harnessDoctor.mjs';
import { replayTrace, renderTraceExplanation } from './dispatchTrace.mjs';
import { renderScenarioText, runAllScenarios, runScenario, SCENARIO_IDS } from './scenarioRunner.mjs';
import { renderHostTrialText, runHostTrial } from './hostTrialRunner.mjs';
import {
  renderGrokTrialText,
  runGrokHostTrial,
  WAVE2_TRIAL_REL,
  writeGrokTrialReport
} from './grokHostTrialRunner.mjs';
import { renderHarnessGcText, runHarnessGc } from './harnessGc.mjs';
import { writeTaskArtifacts } from './taskArtifacts.mjs';
import { buildTaskAssignment, readTaskTitle, renderDispatchSummary, renderTaskAssignment } from './taskPresentation.mjs';
import { canonicalTaskId, resolveTask, taskStatus } from './taskRegistry.mjs';
import {
  archiveRun,
  finalizeRun,
  setGate,
  rollbackPhase,
  setRunStatus,
  resumeRun,
  abandonRun,
  commitPrep,
  getStatus,
  initRun,
  mapFind,
  mapMergeFromRun,
  knowledgeContribute,
  renderRalphStatusText,
  recordReview,
  recordHostMeta,
  recordDeliverAttempt,
  setAcceptLayer,
  persistRunMetrics,
  writeDispatchSnapshot,
  writeHandoffPackage,
  recordFinding,
  confirmProjectHotMemory,
  pruneProjectHotMemory,
  migrateRuns,
  adoptRun
} from './ralph.mjs';
import {
  ensureDispatchControlRoot,
  resolveDeliveryManifestPath,
  resolveDispatchControlRoot
} from './namingConfig.mjs';
import { ensureJjFlowHome } from './homeLayout.mjs';
import { ingestInit, joinInit, previewInit } from './jjInit.mjs';
import { appendProjectMapRow, findProjectByCwd, loadProjectMap } from './projectMap.mjs';

export function runCli(rawArgs = [], { cwd = process.cwd(), stdout = process.stdout } = {}) {
  const args = [...rawArgs];

  if (args[0] === 'install-skill') {
    return runInstallSkill(args.slice(1), { cwd, stdout });
  }

  if (args[0] === 'uninstall-skill') {
    return runUninstallSkill(args.slice(1), { cwd, stdout });
  }

  if (args[0] === 'dispatch-tick') {
    return runDispatchTick(args.slice(1), { cwd, stdout });
  }

  if (args[0] === 'home') {
    return runHomeCommand(args.slice(1), { cwd, stdout });
  }

  if (args[0] === 'init') {
    return runInitCommand(args.slice(1), { cwd, stdout });
  }

  if (args[0] === 'map') {
    return runMapCommand(args.slice(1), { cwd, stdout });
  }

  if (args[0] === 'doctor') {
    return runDoctor(args.slice(1), { cwd, stdout });
  }

  if (args[0] === 'scenario') {
    return runScenarioCommand(args.slice(1), { stdout });
  }

  if (args[0] === 'trace') {
    return runTraceCommand(args.slice(1), { cwd, stdout });
  }

  if (args[0] === 'host-trial') {
    return runHostTrialCommand(args.slice(1), { stdout });
  }

  if (args[0] === 'grok-trial') {
    return runGrokTrialCommand(args.slice(1), { cwd, stdout });
  }

  if (args[0] === 'harness-gc') {
    return runHarnessGcCommand(args.slice(1), { cwd, stdout });
  }

  if (args[0] === 'task') {
    return runTaskCommand(args.slice(1), { cwd, stdout });
  }

  if (args[0] === 'ralph') {
    return runRalphCommand(args.slice(1), { cwd, stdout });
  }

  if (args.includes('--help') || args.includes('-h')) {
    printHelp(stdout);
    return 0;
  }

  const options = parseArgs(args, cwd, { defaultMode: 'auto' });
  const dispatch = buildDispatch(options);

  if (options.json) {
    stdout.write(`${JSON.stringify(dispatch, null, 2)}\n`);
  } else {
    stdout.write(renderMarkdown(dispatch));
  }

  return 0;
}

function runScenarioCommand(rawArgs, { stdout } = {}) {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printScenarioHelp(stdout);
    return 0;
  }
  const json = rawArgs.includes('--json');
  const args = rawArgs.filter((arg) => arg !== '--json');
  const command = args.shift();
  let result;
  if (command === 'list') {
    result = { schema_version: 'jj-flow/scenario-list/1.0', scenarios: [...SCENARIO_IDS] };
  } else if (command === 'check') {
    if (args.length) throw new Error(`Unknown scenario check option: ${args[0]}`);
    result = runAllScenarios({ includeTraces: false });
  } else if (command === 'run') {
    const scenarioId = args.shift();
    if (!scenarioId) throw new Error('scenario run requires a scenario id');
    if (args.length) throw new Error(`Unknown scenario run option: ${args[0]}`);
    result = scenarioId === 'all' ? runAllScenarios() : runScenario(scenarioId);
  } else {
    throw new Error('scenario requires list, check, or run');
  }
  if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else if (command === 'list') stdout.write(`${result.scenarios.join('\n')}\n`);
  else stdout.write(renderScenarioText(result));
  return result.status && result.status !== 'PASS' ? 1 : 0;
}

function runTraceCommand(rawArgs, { cwd = process.cwd(), stdout } = {}) {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printTraceHelp(stdout);
    return 0;
  }
  const json = rawArgs.includes('--json');
  const args = rawArgs.filter((arg) => arg !== '--json');
  const command = args.shift();
  const file = args.shift();
  if (!['explain', 'replay'].includes(command)) throw new Error('trace requires explain or replay');
  if (!file) throw new Error(`trace ${command} requires a trace JSON file`);
  if (args.length) throw new Error(`Unknown trace ${command} option: ${args[0]}`);
  const trace = JSON.parse(fs.readFileSync(fs.realpathSync(path.resolve(cwd, file)), 'utf8'));
  const replay = replayTrace(trace);
  if (json) {
    const result = command === 'replay'
      ? replay
      : { run_id: trace.run_id, scenario: trace.scenario, steps: trace.steps?.length || 0, replay };
    stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    stdout.write(renderTraceExplanation(trace, replay));
  }
  return replay.ok ? 0 : 1;
}

function runHostTrialCommand(rawArgs, { stdout } = {}) {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printHostTrialHelp(stdout);
    return 0;
  }
  const json = rawArgs.includes('--json');
  const args = rawArgs.filter((arg) => arg !== '--json');
  const command = args.shift();
  if (command !== 'run') throw new Error('host-trial requires run');
  if (args.length) throw new Error(`Unknown host-trial option: ${args[0]}`);
  const result = runHostTrial();
  if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else stdout.write(renderHostTrialText(result));
  return result.status === 'PASS' ? 0 : 1;
}

function runGrokTrialCommand(rawArgs, { cwd = process.cwd(), stdout } = {}) {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printGrokTrialHelp(stdout);
    return 0;
  }
  const json = rawArgs.includes('--json');
  const writeReport = rawArgs.includes('--write-report');
  const args = rawArgs.filter((arg) => arg !== '--json' && arg !== '--write-report');
  const command = args.shift();
  if (command !== 'run') throw new Error('grok-trial requires run');
  let sessionId = null;
  let reportPath = WAVE2_TRIAL_REL;
  while (args.length) {
    const arg = args.shift();
    if (arg === '--session-id') {
      sessionId = args.shift();
      if (!sessionId) throw new Error('grok-trial --session-id requires a value');
      continue;
    }
    if (arg === '--report-path') {
      reportPath = args.shift();
      if (!reportPath) throw new Error('grok-trial --report-path requires a value');
      continue;
    }
    throw new Error(`Unknown grok-trial option: ${arg}`);
  }
  const result = runGrokHostTrial({ sessionId, env: process.env });
  if (writeReport && result.session_id) {
    const written = writeGrokTrialReport(result, { cwd, reportPath });
    result.report_path = written;
  }
  if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else stdout.write(renderGrokTrialText(result));
  return result.status === 'PASS' ? 0 : 1;
}

function runHarnessGcCommand(rawArgs, { cwd = process.cwd(), stdout } = {}) {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printHarnessGcHelp(stdout);
    return 0;
  }
  const unknown = rawArgs.filter((arg) => arg !== '--json');
  if (unknown.length) throw new Error(`Unknown harness-gc option: ${unknown[0]}`);
  const result = runHarnessGc({ cwd });
  if (rawArgs.includes('--json')) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else stdout.write(renderHarnessGcText(result));
  return result.status === 'PASS' ? 0 : 1;
}

function runTaskCommand(rawArgs, { cwd = process.cwd(), stdout } = {}) {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    stdout.write('jj task\n\n用法：\n  jj task scaffold --delivery DELIVERY_ID [--manifest path | --control-root dir] [--task TASK-ID] [--root dir] [--json]\n  jj task assign --task TASK-ID [--root dir] [--manifest path] [--delivery DELIVERY_ID] [--control-root dir] [--json]\n  jj task status --task TASK-ID [--root dir] [--manifest path] [--control-root dir] [--json]\n  jj task context --task TASK-ID [--root dir] [--manifest path] [--control-root dir] [--json]\n\n说明：\n  task.json 是任务 ID 的持久索引。业务仓 cwd 下可只传 --delivery：默认解析 control_root（~/.jj-flow 或 naming.json）。\n  目录配置：naming.json dispatch.control_root / portfolio_root / knowledge_root；env JJ_DISPATCH_CONTROL_ROOT。\n');
    return 0;
  }
  const command = rawArgs.shift();
  if (!['scaffold', 'assign', 'status', 'context'].includes(command)) throw new Error('task requires scaffold, assign, status, or context');
  const options = {
    manifest: null,
    deliveryId: null,
    taskId: null,
    root: null,
    controlRoot: null,
    json: false
  };
  while (rawArgs.length) {
    const arg = rawArgs.shift();
    if (arg === '--manifest') options.manifest = rawArgs.shift();
    else if (arg === '--delivery') options.deliveryId = rawArgs.shift();
    else if (arg === '--task') options.taskId = rawArgs.shift();
    else if (arg === '--root') options.root = rawArgs.shift() || null;
    else if (arg === '--control-root') options.controlRoot = rawArgs.shift() || null;
    else if (arg === '--json') options.json = true;
    else throw new Error(`Unknown task option: ${arg}`);
  }

  // Root defaults:
  // - explicit --root wins
  // - --control-root or delivery-only (no --manifest) → resolved control_root
  // - legacy --manifest / --task from cwd → cwd
  const resolvedControlRoot = resolveDispatchControlRoot({ explicit: options.controlRoot });
  let root;
  if (options.root) {
    root = path.resolve(cwd, options.root);
  } else if (options.controlRoot || (options.deliveryId && !options.manifest)) {
    if (command === 'scaffold' || options.controlRoot) {
      ensureDispatchControlRoot({ explicit: options.controlRoot });
    }
    root = resolvedControlRoot;
  } else {
    root = path.resolve(cwd);
  }

  let resolved = null;
  if (options.taskId && (!options.manifest || !options.deliveryId)) {
    const rootsToTry = [root];
    if (root !== resolvedControlRoot) rootsToTry.push(resolvedControlRoot);
    if (root !== path.resolve(cwd)) rootsToTry.push(path.resolve(cwd));
    let lastErr = null;
    for (const tryRoot of rootsToTry) {
      try {
        resolved = resolveTask({ root: tryRoot, taskId: options.taskId, manifestPath: options.manifest });
        root = tryRoot;
        options.manifest = path.relative(root, resolved.manifestPath) || path.basename(resolved.manifestPath);
        options.deliveryId = resolved.delivery.delivery_id;
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr && !options.deliveryId && !options.manifest) throw lastErr;
  }
  if (!options.manifest && options.deliveryId) {
    const manifestAbs = resolveDeliveryManifestPath(options.deliveryId, {
      explicit: options.controlRoot,
      ensure: command === 'scaffold'
    });
    root = resolvedControlRoot;
    options.manifest = path.relative(root, manifestAbs) || manifestAbs;
    if (command === 'scaffold') {
      ensureDispatchControlRoot({ explicit: options.controlRoot });
      fs.mkdirSync(path.dirname(manifestAbs), { recursive: true });
    }
  }
  if (!options.manifest) throw new Error('--manifest 或 --delivery 至少提供一个（--delivery 默认解析 control_root 下 control-plane.json）');
  if (!options.deliveryId) throw new Error('--delivery requires a delivery_id');
  const manifestPath = path.isAbsolute(options.manifest)
    ? options.manifest
    : path.resolve(root, options.manifest);
  const plane = resolved?.plane || JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const delivery = resolved?.delivery || plane.deliveries?.find((item) => item.delivery_id === options.deliveryId);
  if (!delivery) throw new Error(`Unknown delivery_id: ${options.deliveryId}`);
  options.taskId ||= canonicalTaskId(delivery);
  if (['status', 'context'].includes(command)) {
    const status = taskStatus({ root, taskId: options.taskId, manifestPath: options.manifest });
    const result = command === 'context' ? {
      ...status,
      task_document: readTaskDocument(root, options.taskId),
      prompt: `任务 ID：${status.task_id}\n任务：${status.title}\n当前状态：${status.status}\n下一步：${status.next_action}`
    } : status;
    if (options.json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else stdout.write(command === 'context' ? `${result.prompt}\n\n${result.task_document}` : renderTaskStatus(result));
    return 0;
  }
  if (command === 'assign') {
    const assignment = buildTaskAssignment({
      root,
      taskId: options.taskId,
      delivery,
      manifestPath: options.manifest
    });
    if (options.json) stdout.write(`${JSON.stringify(assignment, null, 2)}\n`);
    else stdout.write(`${renderTaskAssignment(assignment)}\n`);
    return 0;
  }
  const result = writeTaskArtifacts(delivery, { root, taskId: options.taskId, manifestPath: options.manifest });
  if (options.json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else stdout.write(result.mode === 'quick'
    ? 'quick 任务：跳过完整任务文档。\n'
    : `任务文档已生成：${result.directory}\n`);
  return 0;
}

function readTaskDocument(root, taskId) {
  const document = path.resolve(root, '.workflow', 'tasks', taskId, 'task.md');
  return fs.existsSync(document) ? fs.readFileSync(document, 'utf8') : '任务文档不存在。';
}

function renderTaskStatus(status) {
  const lines = [
    `任务：${status.title}`,
    `任务 ID：${status.task_id}`,
    `状态：${status.status}`,
    `delivery：${status.delivery_id}`,
    `revision：${status.revision}`,
    `下一步：${status.next_action}`
  ];
  for (const target of status.targets || []) {
    lines.push(`目标 ${target.project_id}：${target.status}`);
  }
  return `${lines.join('\n')}\n`;
}

function printInitHelp(stdout) {
  stdout.write(`jj init preview [--cwd dir] [--root DIR] [--json]
jj init join --path DIR [--name NAME] [--aliases a,b] [--family FAMILY] [--entry FILE] [--json]
jj init ingest --run-id RALPH-x | --file path [--cwd dir] [--json]

对话入口是 $jj-init。preview 只提案；join / ingest 须用户同意后由 Agent 代写。
默认短中文（user_view）；--json 给 Agent，不要贴给用户。
默认 preview 当前仓。用户点名根目录时用 --root（只扫该目录及其直接子仓）。
jj ralph init 是开单仓 run，不是这个命令。
`);
}

function runInitCommand(rawArgs, { cwd = process.cwd(), stdout } = {}) {
  const json = rawArgs.includes('--json');
  const args = rawArgs.filter((arg) => arg !== '--json');
  if (args[0] === '--help' || args[0] === '-h') {
    printInitHelp(stdout);
    return 0;
  }
  let sub = args[0];
  let rest = args.slice(1);
  if (!sub || (sub !== 'preview' && sub !== 'join' && sub !== 'ingest')) {
    rest = args;
    sub = 'preview';
  }
  if (sub === 'preview') {
    let previewCwd = cwd;
    let root = null;
    for (let i = 0; i < rest.length; i += 1) {
      if (rest[i] === '--cwd') previewCwd = rest[++i];
      else if (rest[i] === '--root') root = rest[++i];
      else throw new Error('Unknown init preview option: ' + rest[i]);
    }
    const payload = previewInit({ cwd: previewCwd, root });
    if (json) stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    else stdout.write(`${payload.user_view}\n`);
    return 0;
  }
  if (sub === 'join') {
    const options = { projectPath: null, name: '', aliases: [], family: '', type: 'repo', host: '', entry: '' };
    for (let i = 0; i < rest.length; i += 1) {
      const arg = rest[i];
      if (arg === '--path') options.projectPath = rest[++i];
      else if (arg === '--name') options.name = rest[++i];
      else if (arg === '--aliases') options.aliases = String(rest[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
      else if (arg === '--family') options.family = rest[++i];
      else if (arg === '--type') options.type = rest[++i];
      else if (arg === '--host') options.host = rest[++i];
      else if (arg === '--entry') options.entry = rest[++i];
      else throw new Error('Unknown init join option: ' + arg);
    }
    if (!options.projectPath) options.projectPath = cwd;
    const result = joinInit({ cwd, ...options });
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else stdout.write(`init join ${result.status}: ${result.project?.project_key || ''} ${result.project?.path || result.reason || ''}\n`);
    return result.ok ? 0 : 1;
  }
  if (sub === 'ingest') {
    const options = { runId: null, file: null, ingestCwd: cwd };
    for (let i = 0; i < rest.length; i += 1) {
      const arg = rest[i];
      if (arg === '--run-id') options.runId = rest[++i];
      else if (arg === '--file') options.file = rest[++i];
      else if (arg === '--cwd') options.ingestCwd = rest[++i];
      else throw new Error('Unknown init ingest option: ' + arg);
    }
    if (!options.runId && !options.file) throw new Error('init ingest needs --run-id or --file');
    const result = ingestInit({ cwd: options.ingestCwd, runId: options.runId, file: options.file });
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else stdout.write(`init ingest ${result.status}: written=${result.written || 0} ${result.file || result.reason || ''}\n`);
    return result.ok ? 0 : 1;
  }
  stdout.write(`Unknown init command: ${sub}\n`);
  return 1;
}

function runHomeCommand(rawArgs, { stdout } = {}) {
  const json = rawArgs.includes('--json');
  const args = rawArgs.filter((arg) => arg !== '--json');
  const sub = args[0] || 'init';
  if (sub === '--help' || sub === '-h' || rawArgs.includes('--help') || rawArgs.includes('-h')) {
    stdout.write('jj home init [--json]\n\n在 ~/.jj-flow 生成 naming.json、map.md 和 knowledge/ 空结构（已有文件不覆盖）。\n');
    return 0;
  }
  if (sub !== 'init') {
    stdout.write(`Unknown home command: ${sub}\n`);
    return 1;
  }
  const home = ensureJjFlowHome();
  if (json) stdout.write(`${JSON.stringify(home, null, 2)}\n`);
  else stdout.write(`jj home: ${home.root}\n  map: ${home.map_path}\n  knowledge: ${home.knowledge_root}\n`);
  return 0;
}

function runMapCommand(rawArgs, { cwd = process.cwd(), stdout } = {}) {
  const json = rawArgs.includes('--json');
  const args = rawArgs.filter((arg) => arg !== '--json');
  const sub = args.shift();
  if (!sub || sub === '--help' || sub === '-h') {
    stdout.write('jj map lookup [--cwd dir] [--json]\njj map add --path DIR [--name NAME] [--aliases a,b] [--family FAMILY] [--json]\n');
    return 0;
  }
  if (sub === 'lookup') {
    let lookupCwd = cwd;
    for (let i = 0; i < args.length; i += 1) {
      if (args[i] === '--cwd') lookupCwd = args[++i];
    }
    const map = loadProjectMap();
    const hit = findProjectByCwd(lookupCwd, { map });
    const payload = {
      cwd: lookupCwd,
      map_path: map.path,
      indexed: Boolean(hit),
      project: hit
    };
    if (json) stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    else if (!hit) stdout.write(`not indexed: ${lookupCwd}\n`);
    else stdout.write(`${hit.project_key}  ${hit.name}  family=${hit.family || hit.heading || '-'}  ${hit.path}\n`);
    return 0;
  }
  if (sub === 'add') {
    const options = { projectPath: null, name: '', aliases: [], family: '', type: 'repo', host: '', entry: '' };
    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      if (arg === '--path') options.projectPath = args[++i];
      else if (arg === '--name') options.name = args[++i];
      else if (arg === '--aliases') options.aliases = String(args[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
      else if (arg === '--family') options.family = args[++i];
      else if (arg === '--type') options.type = args[++i];
      else if (arg === '--host') options.host = args[++i];
      else if (arg === '--entry') options.entry = args[++i];
      else throw new Error('Unknown map add option: ' + arg);
    }
    if (!options.projectPath) options.projectPath = cwd;
    const result = appendProjectMapRow(options);
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else stdout.write(`map ${result.status}: ${result.project?.project_key || ''} ${result.project?.path || result.reason || ''}\n`);
    return result.ok ? 0 : 1;
  }
  stdout.write(`Unknown map command: ${sub}\n`);
  return 1;
}

function runDoctor(rawArgs, { cwd = process.cwd(), stdout } = {}) {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printDoctorHelp(stdout);
    return 0;
  }
  const unknown = rawArgs.filter((arg) => arg !== '--json');
  if (unknown.length) throw new Error(`Unknown doctor option: ${unknown[0]}`);
  const result = inspectHarnessRepository({ cwd });
  if (rawArgs.includes('--json')) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else stdout.write(renderDoctorText(result));
  return result.ok ? 0 : 1;
}

export function parseArgs(rawArgs, defaultCwd = process.cwd(), { defaultMode = 'auto' } = {}) {
  const rest = [...rawArgs];
  let mode = defaultMode;
  let json = false;
  let cwd = defaultCwd;
  let evidence = [];

  if (rest[0] && MODE_CHOICES.includes(rest[0])) {
    mode = rest.shift();
  }

  const words = [];
  while (rest.length) {
    const arg = rest.shift();
    if (arg === '--json') {
      json = true;
      continue;
    }
    if (arg === '--cwd') {
      cwd = rest.shift() || cwd;
      continue;
    }
    if (arg === '--evidence') {
      const file = rest.shift();
      if (!file) throw new Error('--evidence requires a file path');
      evidence = readEvidence(file);
      continue;
    }
    words.push(arg);
  }

  return { mode, intent: words.join(' ').trim(), evidence, cwd, json };
}

function readEvidence(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : parsed.evidence;
}

function runInstallSkill(rawArgs, { cwd = process.cwd(), stdout } = {}) {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printInstallHelp(stdout);
    return 0;
  }

  const options = parseInstallArgs(rawArgs, cwd);
  const result = installSkill(options);
  if (result.ok && ['installed', 'updated'].includes(result.status)) {
    Object.assign(result, loadCurrentReleaseLog());
  }

  if (options.json) {
    stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    stdout.write(`${result.message}\n`);
    if (result.release_notes) {
      stdout.write(`\n版本日志（${result.version}）\n${result.release_notes}\n`);
    }
  }

  return result.ok ? 0 : 1;
}

function runUninstallSkill(rawArgs, { cwd = process.cwd(), stdout } = {}) {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printUninstallHelp(stdout);
    return 0;
  }

  const options = parseAssetArgs(rawArgs, cwd, 'uninstall-skill');
  const result = uninstallSkill(options);
  stdout.write(options.json ? `${JSON.stringify(result, null, 2)}\n` : `${result.message}\n`);
  return result.ok ? 0 : 1;
}

function runDispatchTick(rawArgs, { cwd = process.cwd(), stdout } = {}) {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    stdout.write(
      'jj dispatch-tick\n\n'
      + '用法：\n'
      + '  jj dispatch-tick --delivery DELIVERY_ID [--manifest path | --control-root dir] [--receipt r.json] [--write] [--json]\n\n'
      + '说明：\n'
      + '  未给 --manifest 时，从 control_root 解析：\n'
      + '  {control_root}/.workflow/dispatch/<DELIVERY_ID>/control-plane.json\n'
      + '  control_root 顺序：--control-root > JJ_DISPATCH_CONTROL_ROOT > naming.json dispatch.control_root > ~/.jj-flow\n'
      + '  配置文件：~/.jj-flow/naming.json（可用 $JJ_GLOBAL_CONFIG_DIR 覆盖）\n'
    );
    return 0;
  }
  const options = parseDispatchTickArgs(rawArgs, cwd);
  const plane = JSON.parse(fs.readFileSync(options.manifest, 'utf8'));
  const receipts = options.receipts.flatMap(readJsonItems);
  const targetApprovals = options.approvals.flatMap(readJsonItems);
  const expectedRevision = options.expectedRevision === null ? plane.revision : options.expectedRevision;
  let result = tickDispatch(plane, {
    deliveryId: options.deliveryId,
    expectedRevision,
    receipts,
    targetApprovals,
    capabilities: options.capabilities
  });
  if (options.write && result.state_changed && result.plane.revision !== plane.revision) {
    const cas = persistPlaneCas({
      manifestPath: options.manifest,
      expectedRevision,
      nextPlane: result.plane
    });
    if (!cas.ok) {
      result = {
        ...result,
        ok: false,
        status: cas.status,
        plane: cas.plane || result.plane,
        decision_required: cas.decision_required || result.decision_required,
        persisted: false
      };
    } else {
      result.persisted = Boolean(cas.persisted);
    }
  } else {
    result.persisted = false;
  }
  result.control_root = options.controlRootResolved;
  result.manifest_path = options.manifest;
  if (options.json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else {
    let title = null;
    const taskRoot = options.controlRootResolved || cwd;
    try {
      title = readTaskTitle({ root: taskRoot, taskId: `TASK-${options.deliveryId}` });
    } catch {
      // 任务文档可能尚未生成；调度仍可输出状态摘要。
    }
    stdout.write(renderDispatchSummary(result, { title }));
  }
  return result.ok ? 0 : 1;
}

function readJsonItems(file) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(value) ? value : [value];
}

function parseDispatchTickArgs(rawArgs, cwd) {
  const rest = [...rawArgs];
  const options = {
    manifest: null,
    deliveryId: null,
    controlRoot: null,
    expectedRevision: null,
    receipts: [],
    approvals: [],
    capabilities: [],
    write: false,
    json: false
  };
  while (rest.length) {
    const arg = rest.shift();
    if (arg === '--manifest') options.manifest = rest.shift();
    else if (arg === '--delivery') options.deliveryId = rest.shift();
    else if (arg === '--control-root') options.controlRoot = rest.shift();
    else if (arg === '--expected-revision') options.expectedRevision = Number(rest.shift());
    else if (arg === '--receipt') options.receipts.push(rest.shift());
    else if (arg === '--approval') options.approvals.push(rest.shift());
    else if (arg === '--capabilities') options.capabilities = (rest.shift() || '').split(',').filter(Boolean);
    else if (arg === '--no-target-analysis') {
      throw new Error('--no-target-analysis 已移除：目标 ANL-TARGET 差异决策不可绕过');
    }
    else if (arg === '--write') options.write = true;
    else if (arg === '--json') options.json = true;
    else throw new Error(`Unknown dispatch-tick option: ${arg}`);
  }
  if (!options.deliveryId) throw new Error('--delivery requires a delivery_id');
  if (!options.manifest) {
    options.manifest = resolveDeliveryManifestPath(options.deliveryId, {
      explicit: options.controlRoot,
      ensure: false
    });
  } else if (!path.isAbsolute(options.manifest)) {
    options.manifest = path.resolve(cwd, options.manifest);
  }
  if (!fs.existsSync(options.manifest)) {
    const controlRoot = resolveDispatchControlRoot({ explicit: options.controlRoot });
    throw new Error(
      `control-plane not found: ${options.manifest}\n`
      + `control_root=${controlRoot} (set naming.json dispatch.control_root, JJ_DISPATCH_CONTROL_ROOT, or --control-root / --manifest)`
    );
  }
  options.manifest = fs.realpathSync(options.manifest);
  options.controlRootResolved = resolveDispatchControlRoot({ explicit: options.controlRoot });
  return options;
}

function parseInstallArgs(rawArgs, cwd = process.cwd()) {
  return parseAssetArgs(rawArgs, cwd, 'install-skill');
}

function parseAssetArgs(rawArgs, cwd = process.cwd(), command = 'install-skill') {
  const rest = [...rawArgs];
  const options = {
    targetDir: undefined,
    platform: 'codex',
    project: false,
    force: false,
    dryRun: false,
    json: false
  };

  while (rest.length) {
    const arg = rest.shift();
    if (arg === '--target') {
      const target = rest.shift();
      if (!target) throw new Error('--target requires a directory path');
      if (options.project) throw new Error('--target cannot be used with --project');
      if (options.platform === 'all') throw new Error('--target cannot be used with --platform all');
      options.targetDir = target;
      continue;
    }
    if (arg === '--platform') {
      const platform = rest.shift();
      if (!platform) throw new Error('--platform requires codex, claude, qoder, grok, or all');
      if (!['codex', 'claude', 'qoder', 'grok', 'all'].includes(platform)) {
        throw new Error('--platform must be codex, claude, qoder, grok, or all');
      }
      if (options.targetDir && platform === 'all') {
        throw new Error('--platform all cannot be used with --target');
      }
      options.platform = platform;
      continue;
    }
    if (arg === '--project') {
      if (options.targetDir) throw new Error('--project cannot be used with --target');
      options.project = true;
      options.codexTargetDir = projectCodexTarget({ cwd });
      options.codexAgentsTargetDir = projectCodexAgentsTarget({ cwd });
      options.claudeSkillsTargetDir = projectClaudeSkillsTarget({ cwd });
      options.claudeTargetDir = projectClaudeTarget({ cwd });
      options.qoderTargetDir = projectQoderTarget({ cwd });
      options.grokTargetDir = projectGrokTarget({ cwd });
      continue;
    }
    if (arg === '--force') {
      options.force = true;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    throw new Error(`Unknown ${command} option: ${arg}`);
  }

  return options;
}

function printHelp(stdout) {
  stdout.write(`jj-flow\n\n用法：\n  jj install-skill [--platform codex|claude|qoder|grok|all] [--project | --target dir] [--force] [--dry-run] [--json]\n  jj uninstall-skill [--platform codex|claude|qoder|grok|all] [--project | --target dir] [--force] [--dry-run] [--json]\n  jj home init [--json]\n  jj init preview|join|ingest [--json]\n  jj map lookup|add [--json]\n  jj doctor [--json]\n  jj scenario list | check | run <scenario|all> [--json]\n  jj trace explain | replay <trace.json> [--json]\n  jj host-trial run [--json]\n  jj grok-trial run [--json] [--session-id ID] [--write-report] [--report-path path]\n  jj harness-gc [--json]\n  jj dispatch-tick --delivery DELIVERY_ID [--manifest path | --control-root dir] [--receipt receipt.json] [--write] [--json]\n  jj ralph init|status|archive|map-merge|map-find|handoff|dispatch-snapshot|commit-prep|review-record|host-record|metrics|migrate|adopt [options] [--json]\n\n说明：\n  npx/CLI 只负责安装、卸载和维护调试。Codex 安装同时写入 .codex/skills 与 .codex/agents；Qoder/Grok/Claude 安装写入各自 skills 目录；Claude 另装 slash commands。真实使用入口是 $jj-init / $jj-same / $jj-ralph / $jj-dispatch（Codex）与 /jj-init / /jj-same / /jj-ralph（Claude Code / Grok slash）。\n  uninstall-skill 只删除 ownership manifest 登记或包内明确声明的资产；已修改及旧版未登记资产默认拒绝删除。\n  doctor 只读取 Git、Harness manifest、路径配置（control_root/portfolio_root）和版本化仓库文件，不修复、不安装、不派发。\n  scenario 使用固定 fixture 和纯状态转换，不创建真实 task；trace replay 不执行记录的 host actions。\n  host-trial 在系统临时目录运行半真实 Git/worktree/CAS/Review 闭环，不创建 Codex App task。\n  grok-trial 绑定真实 GROK_SESSION_ID 跑 create/bind/RECONCILE/返工；默认不写里程碑 JSON，不关闭 Wave 2，不升 A2。\n  harness-gc 只读扫描文档、schema、fixture、规则 owner 和维护重复，不自动修复。\n  dispatch-tick 只执行一次可恢复调度 tick；默认预览，不启动后台进程。未给 --manifest 时从 control_root 解析 plane。\n  目录配置：~/.jj-flow 为产品默认（control_root / map.md / knowledge/）；可用 $JJ_GLOBAL_CONFIG_DIR/naming.json 覆盖。install-skill 会生成空 map 与知识结构。地图写入与知识建库走 $jj-init / jj init（须用户同意）。\n  ralph 子命令负责单仓闭环的机械步骤（init/status/archive/地图/handoff/快照/提交清单），不替代对话入口 $jj-ralph。\n\n示例：\n  npx @brewer/jj-flow@beta install-skill\n  npx @brewer/jj-flow@beta install-skill --platform grok\n  npx @brewer/jj-flow@beta uninstall-skill --dry-run\n  npx @brewer/jj-flow@beta doctor --json\n  npx @brewer/jj-flow@beta scenario run dispatch-interrupted-resume --json\n`);
  stdout.write('  jj task scaffold --delivery DELIVERY_ID [--manifest path | --control-root dir] [--json]\n  jj task assign --delivery DELIVERY_ID --task TASK-ID [--control-root dir] [--json]\n');
}

function runRalphCommand(rawArgs, { cwd = process.cwd(), stdout = process.stdout } = {}) {
  if (!rawArgs.length || rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printRalphHelp(stdout);
    return 0;
  }
  const json = rawArgs.includes('--json');
  const args = rawArgs.filter((arg) => arg !== '--json');
  const command = args.shift();

  if (command === 'init') {
    const options = parseRalphInitArgs(args);
    const run = initRun(options, cwd);
    if (json) stdout.write(`${JSON.stringify({ run }, null, 2)}\n`);
    else {
      stdout.write(`initialized ${run.run_id}\n`);
      for (const item of run.reuse_suggestions || []) {
        stdout.write(`reuse? ${item.run_id}${item.needs_migrate ? ' (needs_migrate)' : ''}${item.title ? (' · ' + item.title) : ''}\n`);
      }
    }
    return 0;
  }

  if (command === 'status') {
    const options = parseRalphRunArgs(args, { requireRunId: false });
    const payload = getStatus({ runId: options.runId, cwd });
    if (json) stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    else stdout.write(`${renderRalphStatusText(payload)}\n`);
    return 0;
  }

  if (command === 'archive') {
    const options = parseRalphRunArgs(args, { requireRunId: true });
    const result = archiveRun(options.runId, { cwd, slug: options.slug });
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else stdout.write(`archived ${options.runId} -> ${result.manifest.archive_path}\n`);
    return 0;
  }

  if (command === 'finalize') {
    const options = parseRalphRunArgs(args, { requireRunId: true });
    const result = finalizeRun(options.runId, {
      cwd,
      slug: options.slug,
      modules: options.modules || [],
      keywords: options.keywords || [],
      lessons: options.lessons || [],
      acceptance: options.acceptance || [],
      status: options.status || 'done',
      force: Boolean(options.force),
      include_process_lessons_in_map: Boolean(options.includeProcessLessonsInMap),
      contribution_package: options.noContributionPackage ? false : true
    });
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else {
      let line = `finalized ${options.runId} -> ${result.archive_path} (map ${result.capability.id}`;
      if (result.contribution_path) line += `; knowledge ${result.contribution_path}`;
      line += ')\n';
      stdout.write(line);
    }
    return 0;
  }

  if (command === 'map-merge') {
    const options = parseRalphRunArgs(args, { requireRunId: true });
    const result = mapMergeFromRun(options.runId, {
      modules: options.modules || [],
      keywords: options.keywords || [],
      lessons: options.lessons || [],
      acceptance: options.acceptance || [],
      status: options.status || 'done',
      force: Boolean(options.force),
      include_process_lessons_in_map: Boolean(options.includeProcessLessonsInMap)
    }, cwd);
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else stdout.write(`map-merged ${result.capability.id} from ${options.runId}\n`);
    return 0;
  }

  if (command === 'knowledge-contribute') {
    const options = parseRalphRunArgs(args, { requireRunId: true });
    const result = knowledgeContribute(options.runId, {
      cwd,
      modules: options.modules || [],
      keywords: options.keywords || [],
      lessons: options.lessons || [],
      acceptance: options.acceptance || [],
      status: options.status || 'done',
      include_process_lessons_in_map: Boolean(options.includeProcessLessonsInMap),
      hook: Boolean(options.hook)
    });
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else {
      stdout.write(
        `knowledge-contribute ${options.runId} -> ${result.path}`
        + ` (candidates=${result.contribution?.candidates?.length || 0}`
        + `; hook=${result.hook?.status || 'n/a'})\n`
      );
    }
    return 0;
  }

  if (command === 'map-find') {
    const options = parseRalphFindArgs(args);
    const result = mapFind(options.query, { cwd, limit: options.limit });
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else if (!result.matches.length) stdout.write('no matches\n');
    else {
      for (const match of result.matches) {
        stdout.write(`- ${match.id} (${match.score}) ${match.title}\n  runs: ${match.run_refs.join(', ')}\n`);
      }
    }
    return 0;
  }

  if (command === 'handoff') {
    const options = parseRalphRunArgs(args, { requireRunId: true });
    const result = writeHandoffPackage(options.runId, {
      cwd,
      handoff_id: options.handoffId,
      targets_hint: options.targets
    });
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else stdout.write(`handoff ${result.handoff.handoff_id} -> ${result.path}\n`);
    return 0;
  }

  if (command === 'dispatch-snapshot') {
    const options = parseRalphRunArgs(args, { requireRunId: true });
    const result = writeDispatchSnapshot(options.runId, { cwd, targets_hint: options.targets });
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else stdout.write(`dispatch-snapshot -> ${result.path}\n`);
    return 0;
  }

  if (command === 'review-record') {
    const options = parseRalphReviewArgs(args);
    const result = recordReview(options.runId, {
      cwd,
      outcome: options.outcome,
      reviewed_commit: options.reviewedCommit || null,
      fix_commit: options.fixCommit || null,
      review_scope: options.reviewScope || null,
      task_thread_id: options.taskThreadId || null,
      review_thread_id: options.reviewThreadId || null,
      summary: options.summary || '',
      findings: options.findings,
      evidence_refs: options.evidenceRefs,
      source: options.source || null,
      host_review: options.hostReview || null
    });
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else stdout.write(`review-record ${result.report.review_id} ${result.report.outcome} -> ${result.path}\n`);
    return 0;
  }

  if (command === 'gate') {
    const options = parseRalphGateArgs(args);
    const result = setGate(options.runId, {
      gate: options.gate,
      status: options.status,
      cwd,
      advance: options.advance
    });
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else stdout.write(`gate ${options.gate}=${options.status} phase=${result.phase} (${options.runId})\n`);
    return 0;
  }

  if (command === 'deliver-attempt') {
    const options = parseRalphDeliverAttemptArgs(args);
    const result = recordDeliverAttempt(options.runId, {
      improved: options.improved,
      signal: options.signal,
      score: options.score,
      cwd
    });
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else {
      stdout.write(
        `deliver-attempt ${options.runId} improved=${result.improved} source=${result.improved_source}`
        + ` iteration=${result.iteration}`
        + (result.blocked ? ` BLOCKED ${result.intervention_needed?.kind || ''}` : '')
        + '\n'
      );
      if (result.finding_hint) stdout.write(`${result.finding_hint}\n`);
    }
    return 0;
  }

  if (command === 'accept-layer') {
    const options = parseRalphAcceptLayerArgs(args);
    const result = setAcceptLayer(options.runId, {
      layer: options.layer,
      status: options.status,
      mode: options.mode,
      note: options.note,
      cwd
    });
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else stdout.write(`accept-layer ${options.layer}=${options.status} (${options.runId})\n`);
    return 0;
  }

  if (command === 'rollback-phase') {
    const options = parseRalphRollbackPhaseArgs(args);
    const result = rollbackPhase(options.runId, {
      toPhase: options.toPhase,
      reason: options.reason,
      cwd
    });
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else {
      stdout.write(`rollback-phase ${result.fromPhase}→${result.toPhase} (${options.runId})\n`);
      if (result.finding_hint) stdout.write(`${result.finding_hint}\n`);
    }
    return 0;
  }

  if (command === 'set-status') {
    const options = parseRalphSetStatusArgs(args);
    const result = setRunStatus(options.runId, {
      status: options.status,
      reason: options.reason,
      cwd
    });
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else stdout.write(`set-status ${result.from}→${result.status} (${options.runId})\n`);
    return 0;
  }

  if (command === 'resume' || command === 'continue') {
    const options = parseRalphResumeAbandonArgs(args, 'resume');
    const result = resumeRun(options.runId, { reason: options.reason, cwd });
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else stdout.write(`resume ${result.from}→${result.status} (${options.runId})\n`);
    return 0;
  }

  if (command === 'abandon') {
    const options = parseRalphResumeAbandonArgs(args, 'abandon');
    const result = abandonRun(options.runId, { reason: options.reason, cwd });
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else stdout.write(`abandon ${result.from}→${result.status} (${options.runId})\n`);
    return 0;
  }

  if (command === 'close') {
    throw new Error(
      'close is deprecated; use abandon (half-done discard) or archive/finalize (soft archive). Same run remains resumable.'
    );
  }

  if (command === 'host-record') {
    const options = parseRalphHostArgs(args);
    const result = recordHostMeta(options.runId, {
      host_id: options.hostId || null,
      handle_kind: options.handleKind || null,
      thread_id: options.threadId || null,
      session_handle: options.sessionHandle || null,
      model_id: options.modelId || null,
      export_path: options.exportPath || null
    }, cwd);
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}
`);
    else stdout.write(`host-record ${options.runId} host_id=${result.host?.host_id || 'null'} thread=${result.host?.thread_id || result.host?.session_handle || 'null'}
`);
    return 0;
  }

  if (command === 'metrics') {
    const persist = args.includes('--persist');
    const options = parseRalphRunArgs(args.filter((arg) => arg !== '--persist'), { requireRunId: true });
    const result = persist
      ? persistRunMetrics(options.runId, cwd)
      : getStatus({ runId: options.runId, cwd });
    if (json) stdout.write(`${JSON.stringify({ run_id: options.runId, metrics: result.metrics }, null, 2)}\n`);
    else stdout.write(`${JSON.stringify(result.metrics, null, 2)}\n`);
    return 0;
  }

  if (command === 'commit-prep') {
    const options = parseRalphRunArgs(args, { requireRunId: true });
    const result = commitPrep(options.runId, cwd);
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else {
      stdout.write(`${result.suggested_message}\n\nfiles:\n${result.files.map((file) => `- ${file}`).join('\n')}\n`);
      stdout.write(`\n${result.note}\n`);
    }
    return 0;
  }

  if (command === 'finding') {
    const options = parseRalphFindingArgs(args);
    const result = recordFinding(options.runId, {
      title: options.title,
      phenomenon: options.phenomenon,
      cause: options.cause,
      action: options.action,
      scope: options.scope,
      cost: options.cost,
      evidence: options.evidence,
      rule: options.rule
    }, cwd);
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else stdout.write(`finding ${result.id} -> ${result.path}\n`);
    return 0;
  }

  if (command === 'knowledge-confirm') {
    const options = parseRalphHotMemoryArgs(args, 'knowledge-confirm', { requireNeedle: true });
    const result = confirmProjectHotMemory(options.needle, {
      cwd,
      projectKey: options.project
    });
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else if (result.confirmed) stdout.write(`knowledge-confirm ${result.confirmed.rule}\n`);
    else stdout.write(`knowledge-confirm skipped: ${result.reason}\n`);
    return 0;
  }

  if (command === 'knowledge-prune') {
    const options = parseRalphHotMemoryArgs(args, 'knowledge-prune', { requireNeedle: false });
    const result = pruneProjectHotMemory({ cwd, projectKey: options.project });
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else stdout.write(`knowledge-prune dropped=${result.dropped} kept=${result.kept}\n`);
    return 0;
  }

  if (command === 'migrate') {
    const allProjects = args.includes('--all-projects');
    const result = migrateRuns({ cwd, all_projects: allProjects });
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else {
      stdout.write(`migrate count=${result.count}\n`);
      for (const row of result.runs || []) {
        stdout.write(`  ${row.from} -> ${row.to} (${row.path})\n`);
      }
    }
    return 0;
  }

  if (command === 'adopt') {
    const options = parseRalphAdoptArgs(args);
    const result = adoptRun({
      cwd,
      task: options.task,
      from: options.from,
      absorb: options.absorb
    });
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else if (result.status === 'refused') stdout.write(`adopt refused: ${result.reason}\n${result.example}\n`);
    else stdout.write(`adopt ${result.from || ''} -> ${result.to} (${result.path})\n`);
    return result.ok === false ? 1 : 0;
  }

  throw new Error(`Unknown ralph command: ${command}`);
}

function parseRalphAdoptArgs(args) {
  const options = { task: null, from: null, absorb: null };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--task') { options.task = args[++i]; continue; }
    if (arg === '--from') { options.from = args[++i]; continue; }
    if (arg === '--absorb') { options.absorb = args[++i] || true; continue; }
    throw new Error(`Unknown ralph adopt option: ${arg}`);
  }
  return options;
}

function parseRalphInitArgs(args) {
  const options = {
    force: false,
    scope: { in: [], out: [] },
    capability_ids: []
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--run-id') {
      options.run_id = args[++i];
      continue;
    }
    if (arg === '--title') {
      options.title = args[++i];
      continue;
    }
    if (arg === '--goal') {
      options.goal = args[++i];
      continue;
    }
    if (arg === '--capability') {
      options.capability_ids.push(args[++i]);
      continue;
    }
    if (arg === '--in') {
      options.scope.in.push(args[++i]);
      continue;
    }
    if (arg === '--out') {
      options.scope.out.push(args[++i]);
      continue;
    }
    if (arg === '--force') {
      options.force = true;
      continue;
    }
    if (arg === '--no-knowledge-refs') {
      options.attach_knowledge = false;
      continue;
    }
    if (arg === '--project') {
      options.project = args[++i];
      continue;
    }
    if (arg === '--knowledge-query') {
      options.knowledge_query = args[++i];
      continue;
    }
    if (arg === '--host-id') {
      options.host = options.host || {};
      options.host.host_id = args[++i];
      continue;
    }
    if (arg === '--thread-id') {
      options.host = options.host || {};
      options.host.thread_id = args[++i];
      continue;
    }
    if (arg === '--model-id') {
      options.host = options.host || {};
      options.host.model_id = args[++i];
      continue;
    }
    if (arg === '--session-export') {
      options.host = options.host || {};
      options.host.export_path = args[++i];
      continue;
    }
    if (arg === '--intensity') {
      options.intensity = args[++i];
      continue;
    }
    if (arg === '--max-iterations') {
      options.max_iterations = Number(args[++i]);
      continue;
    }
    if (arg === '--no-intent') {
      options.write_intent = false;
      continue;
    }
    if (arg === '--intent') {
      options.write_intent = true;
      continue;
    }
    throw new Error(`Unknown ralph init option: ${arg}`);
  }
  if (!options.run_id || !options.title || !options.goal) {
    throw new Error('ralph init requires --run-id, --title, and --goal');
  }
  return options;
}

function parseRalphRunArgs(args, { requireRunId = false } = {}) {
  const options = { targets: [], modules: [], keywords: [], lessons: [], acceptance: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--run-id') {
      options.runId = args[++i];
      continue;
    }
    if (arg === '--slug') {
      options.slug = args[++i];
      continue;
    }
    if (arg === '--handoff-id') {
      options.handoffId = args[++i];
      continue;
    }
    if (arg === '--target') {
      options.targets.push(args[++i]);
      continue;
    }
    if (arg === '--modules') {
      options.modules = String(args[++i] || '').split(',').map((x) => x.trim()).filter(Boolean);
      continue;
    }
    if (arg === '--keywords') {
      options.keywords = String(args[++i] || '').split(',').map((x) => x.trim()).filter(Boolean);
      continue;
    }
    if (arg === '--lessons') {
      options.lessons = String(args[++i] || '').split('|').map((x) => x.trim()).filter(Boolean);
      continue;
    }
    if (arg === '--acceptance') {
      options.acceptance = String(args[++i] || '').split(',').map((x) => x.trim()).filter(Boolean);
      continue;
    }
    if (arg === '--status') {
      options.status = args[++i];
      continue;
    }
    if (arg === '--force') {
      options.force = true;
      continue;
    }
    if (arg === '--include-process-lessons') {
      options.includeProcessLessonsInMap = true;
      continue;
    }
    if (arg === '--no-contribution-package') {
      options.noContributionPackage = true;
      continue;
    }
    if (arg === '--hook') {
      options.hook = true;
      continue;
    }
    throw new Error(`Unknown ralph option: ${arg}`);
  }
  if (requireRunId && !options.runId) throw new Error('requires --run-id');
  return options;
}

function parseRalphGateArgs(args) {
  const options = { advance: true };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--run-id') { options.runId = args[++i]; continue; }
    if (arg === '--gate' || arg === '--phase') { options.gate = args[++i]; continue; }
    if (arg === '--status') { options.status = args[++i]; continue; }
    if (arg === '--no-advance') { options.advance = false; continue; }
    throw new Error(`Unknown ralph gate option: ${arg}`);
  }
  if (!options.runId) throw new Error('gate requires --run-id');
  if (!options.gate) throw new Error('gate requires --gate analyze|plan|deliver|accept|archive');
  if (!options.status) throw new Error('gate requires --status PENDING|PASS|FAIL|N/A|BLOCKED');
  return options;
}

function parseRalphDeliverAttemptArgs(args) {
  const options = { signal: null, score: null, improved: undefined };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--run-id') { options.runId = args[++i]; continue; }
    if (arg === '--improved') {
      const raw = String(args[++i] ?? '').toLowerCase();
      if (raw === 'true' || raw === '1' || raw === 'yes') options.improved = true;
      else if (raw === 'false' || raw === '0' || raw === 'no') options.improved = false;
      else if (raw === 'auto') options.improved = undefined;
      else throw new Error('--improved must be true|false|auto');
      continue;
    }
    if (arg === '--signal') { options.signal = args[++i]; continue; }
    if (arg === '--score') { options.score = Number(args[++i]); continue; }
    throw new Error(`Unknown ralph deliver-attempt option: ${arg}`);
  }
  if (!options.runId) throw new Error('deliver-attempt requires --run-id');
  return options;
}

function parseRalphAcceptLayerArgs(args) {
  const options = { mode: null, note: null };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--run-id') { options.runId = args[++i]; continue; }
    if (arg === '--layer') { options.layer = args[++i]; continue; }
    if (arg === '--status') { options.status = args[++i]; continue; }
    if (arg === '--mode') { options.mode = args[++i]; continue; }
    if (arg === '--note') { options.note = args[++i]; continue; }
    throw new Error(`Unknown ralph accept-layer option: ${arg}`);
  }
  if (!options.runId) throw new Error('accept-layer requires --run-id');
  if (!options.layer) throw new Error('accept-layer requires --layer mechanical|judgment');
  if (!options.status) throw new Error('accept-layer requires --status PENDING|PASS|FAIL|SKIPPED');
  return options;
}

function parseRalphRollbackPhaseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--run-id') { options.runId = args[++i]; continue; }
    if (arg === '--to' || arg === '--to-phase' || arg === '--phase') { options.toPhase = args[++i]; continue; }
    if (arg === '--reason') { options.reason = args[++i]; continue; }
    throw new Error(`Unknown ralph rollback-phase option: ${arg}`);
  }
  if (!options.runId) throw new Error('rollback-phase requires --run-id');
  if (!options.toPhase) throw new Error('rollback-phase requires --to PLAN|DELIVER|ANALYZE|ACCEPT');
  if (!options.reason) throw new Error('rollback-phase requires --reason');
  return options;
}

function parseRalphSetStatusArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--run-id') { options.runId = args[++i]; continue; }
    if (arg === '--status') { options.status = args[++i]; continue; }
    if (arg === '--reason') { options.reason = args[++i]; continue; }
    throw new Error(`Unknown ralph set-status option: ${arg}`);
  }
  if (!options.runId) throw new Error('set-status requires --run-id');
  if (!options.status) {
    throw new Error(
      'set-status requires --status IN_PROGRESS|READY_FOR_USER_TEST|BLOCKED|PAUSED|ABANDONED|COMPLETED'
    );
  }
  if (!options.reason) throw new Error('set-status requires --reason');
  return options;
}

function parseRalphResumeAbandonArgs(args, commandName) {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--run-id') { options.runId = args[++i]; continue; }
    if (arg === '--reason') { options.reason = args[++i]; continue; }
    throw new Error(`Unknown ralph ${commandName} option: ${arg}`);
  }
  if (!options.runId) throw new Error(`${commandName} requires --run-id`);
  if (!options.reason) throw new Error(`${commandName} requires --reason`);
  return options;
}

function parseRalphHostArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--run-id') { options.runId = args[++i]; continue; }
    if (arg === '--host-id') { options.hostId = args[++i]; continue; }
    if (arg === '--handle-kind') { options.handleKind = args[++i]; continue; }
    if (arg === '--thread-id') { options.threadId = args[++i]; continue; }
    if (arg === '--session-handle') { options.sessionHandle = args[++i]; continue; }
    if (arg === '--model-id') { options.modelId = args[++i]; continue; }
    if (arg === '--export-path') { options.exportPath = args[++i]; continue; }
    throw new Error(`Unknown ralph host-record option: ${arg}`);
  }
  if (!options.runId) throw new Error('host-record requires --run-id');
  return options;
}

function parseRalphReviewArgs(args) {
  const options = { findings: [], evidenceRefs: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--run-id') { options.runId = args[++i]; continue; }
    if (arg === '--outcome') { options.outcome = args[++i]; continue; }
    if (arg === '--reviewed-commit') { options.reviewedCommit = args[++i]; continue; }
    if (arg === '--fix-commit') { options.fixCommit = args[++i]; continue; }
    if (arg === '--review-scope') { options.reviewScope = args[++i]; continue; }
    if (arg === '--task-thread') { options.taskThreadId = args[++i]; continue; }
    if (arg === '--review-thread') { options.reviewThreadId = args[++i]; continue; }
    if (arg === '--summary') { options.summary = args[++i]; continue; }
    if (arg === '--source') { options.source = args[++i]; continue; }
    if (arg === '--host-review-json') {
      const raw = args[++i];
      try {
        options.hostReview = JSON.parse(raw);
      } catch {
        throw new Error('--host-review-json must be valid JSON object');
      }
      if (options.hostReview == null || typeof options.hostReview !== 'object' || Array.isArray(options.hostReview)) {
        throw new Error('--host-review-json must be a JSON object');
      }
      continue;
    }
    if (arg === '--finding-json') { options.findings.push(JSON.parse(args[++i])); continue; }
    if (arg === '--findings-file') {
      const filePath = args[++i];
      const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!Array.isArray(payload)) throw new Error('--findings-file must contain a JSON array');
      options.findings.push(...payload);
      continue;
    }
    if (arg === '--evidence') { options.evidenceRefs.push(args[++i]); continue; }
    throw new Error(`Unknown ralph review-record option: ${arg}`);
  }
  if (!options.runId) throw new Error('review-record requires --run-id');
  if (!options.outcome) throw new Error('review-record requires --outcome');
  return options;
}

function parseRalphFindArgs(args) {
  const options = { limit: 10 };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--query') {
      options.query = args[++i];
      continue;
    }
    if (arg === '--limit') {
      options.limit = Number(args[++i]);
      continue;
    }
    if (!options.query && !arg.startsWith('--')) {
      options.query = arg;
      continue;
    }
    throw new Error(`Unknown ralph map-find option: ${arg}`);
  }
  if (!options.query) throw new Error('map-find requires --query');
  return options;
}

function parseRalphFindingArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--run-id') { options.runId = args[++i]; continue; }
    if (arg === '--title') { options.title = args[++i]; continue; }
    if (arg === '--phenomenon') { options.phenomenon = args[++i]; continue; }
    if (arg === '--cause') { options.cause = args[++i]; continue; }
    if (arg === '--action') { options.action = args[++i]; continue; }
    if (arg === '--scope') { options.scope = args[++i]; continue; }
    if (arg === '--cost') { options.cost = args[++i]; continue; }
    if (arg === '--evidence') { options.evidence = args[++i]; continue; }
    if (arg === '--rule') { options.rule = args[++i]; continue; }
    throw new Error(`Unknown ralph finding option: ${arg}`);
  }
  if (!options.runId) throw new Error('finding requires --run-id');
  return options;
}

function parseRalphHotMemoryArgs(args, commandName, { requireNeedle = false } = {}) {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--project') { options.project = args[++i]; continue; }
    if (arg === '--needle') { options.needle = args[++i]; continue; }
    throw new Error(`Unknown ralph ${commandName} option: ${arg}`);
  }
  if (requireNeedle && !options.needle) throw new Error(`${commandName} requires --needle`);
  return options;
}

function printRalphHelp(stdout) {
  stdout.write(`jj ralph\n\n用法：\n  jj ralph init --run-id task-… --title "…" --goal "…" [--intensity tiny|standard|strict] [--max-iterations N] [--capability CAP-…] [--in …] [--out …] [--project KEY] [--knowledge-query Q] [--no-knowledge-refs] [--intent|--no-intent] [--force] [--json]\n  jj ralph status [--run-id task-…] [--json]\n  jj ralph archive --run-id task-… [--slug name] [--json]\n  jj ralph finalize --run-id task-… [--modules p1,p2] [--keywords a,b] [--lessons "l1|l2"] [--slug name] [--force] [--include-process-lessons] [--no-contribution-package] [--json]\n  jj ralph map-merge --run-id task-… [--modules p1,p2] [--keywords a,b] [--lessons "l1|l2"] [--force] [--include-process-lessons] [--json]\n  jj ralph knowledge-contribute --run-id task-… [--lessons "l1|l2"] [--modules …] [--hook] [--json]\n  jj ralph finding --run-id task-… --action "…" --scope "…" [--phenomenon "…"] [--cause "…"] [--rule "…"] [--json]\n  jj ralph knowledge-confirm --needle "…" [--project KEY] [--json]\n  jj ralph knowledge-prune [--project KEY] [--json]\n  jj ralph map-find --query "关键词" [--limit N] [--json]\n  jj ralph handoff --run-id task-… [--handoff-id HOF-…] [--target name] [--json]\n  jj ralph dispatch-snapshot --run-id task-… [--target name] [--json]\n  jj ralph gate --run-id task-… --gate analyze|plan|deliver|accept|archive --status PASS|FAIL|… [--no-advance] [--json]\n  jj ralph deliver-attempt --run-id task-… --improved true|false [--signal text] [--json]\n  jj ralph accept-layer --run-id task-… --layer mechanical|judgment --status PASS|FAIL|PENDING|SKIPPED [--mode none|review|recheck|adversarial_note] [--note text] [--json]\n  jj ralph rollback-phase --run-id task-… --to PLAN|DELIVER|ANALYZE --reason "…" [--json]\n  jj ralph set-status --run-id task-… --status PAUSED|BLOCKED|IN_PROGRESS --reason "…" [--json]\n  jj ralph commit-prep --run-id task-… [--json]\n  jj ralph metrics --run-id task-… [--persist] [--json]
  jj ralph review-record --run-id task-… --outcome PASS|NEEDS_CHANGES|BLOCKED [--reviewed-commit sha] [--fix-commit sha] [--review-scope working_tree|commit] [--task-thread id] [--review-thread id] [--summary text] [--finding-json json] [--findings-file path] [--source host_builtin|user_provided|fallback_inline] [--host-review-json json] [--json]
  jj ralph host-record --run-id task-… [--host-id codex|grok-build|claude|qoder|other] [--thread-id id] [--session-handle id] [--model-id id] [--export-path path] [--json]
  jj ralph migrate [--all-projects] [--json]
  jj ralph adopt --task task-… [--from RALPH-…] [--absorb task-…] [--json]
  jj ralph init ... [--host-id …] [--thread-id …] [--model-id …] [--session-export path]\n\n说明：\n  单仓闭环的机械步骤。对话入口是 $jj-ralph / /jj-ralph。\n  intensity：tiny/standard/strict 控制预算与 accept 判断层；deliver-attempt 做停滞早停；accept-layer 写双层验收。\n  archive 要求 gates.accept=PASS；finalize = map-merge + archive；map-merge 默认要求 accept=PASS（--force 可覆盖）；gate 更新 gates 并可推进 phase。\n  新 run 写 .workflow/ralph/tasks/<task_key>/{task_plan,progress,findings}.md 与 .state/{run.json,reviews/,handoff.json}。\n  活跃 RALPH-* 目录须先 jj ralph migrate（1:1）或 adopt --task；adopt --absorb 不自动合并。\n  commit-prep 只生成清单与 message，不执行 git commit/push。\n  review-record 把审查结论与任务/审查会话 ID 关联写入 .state/reviews/ 并更新 run.json；可选 --source / --host-review-json 写入溯源。\n`);
}

function printDoctorHelp(stdout) {
  stdout.write(`jj doctor\n\n用法：\n  jj doctor [--json]\n\n说明：\n  默认给用户看短中文：主目录 / 地图项目数 / 知识条数 / 当前目录是否在地图里。不要把 --json 贴给用户。\n  --json 给 Agent：含 user_view（同默认短文）和完整 paths。业务仓不要求 harness-manifest。\n`);
}

function printScenarioHelp(stdout) {
  stdout.write(`jj scenario\n\n用法：\n  jj scenario list [--json]\n  jj scenario check [--json]\n  jj scenario run <scenario|all> [--json]\n\n说明：\n  使用版本化 fixture 执行确定性任务场景，只计算状态转换和 host actions，不执行外部副作用。\n`);
}

function printTraceHelp(stdout) {
  stdout.write(`jj trace\n\n用法：\n  jj trace explain <trace.json> [--json]\n  jj trace replay <trace.json> [--json]\n\n说明：\n  explain 展示状态转换链；replay 校验 hash、output 和最早违规步骤，不执行 host actions。\n`);
}

function printHostTrialHelp(stdout) {
  stdout.write(`jj host-trial\n\n用法：\n  jj host-trial run [--json]\n\n说明：\n  在系统临时目录创建独立控制仓、真实 Git repo 和 worktree，验证中断恢复、sandbox attestation、receipt、CAS 和 Reviewer/Developer 返工。不会联网，也不会创建真实 Codex App task。\n`);
}

function printGrokTrialHelp(stdout) {
  stdout.write(`jj grok-trial\n\n用法：\n  jj grok-trial run [--json] [--session-id ID] [--write-report] [--report-path path]\n\n说明：\n  在真实 Grok 会话中跑 create/bind、中断 RECONCILE、host-issued attestation 与 Review 返工。缺 GROK_SESSION_ID / --session-id 或占位 session-<slug>-YYYYMMDD 时 fail-closed。\n  默认不写 docs/milestones/real-host-trial-grok.json；--write-report 才落盘。不关闭 Host Wave 2，不升 A2，不进 npm run verify。\n`);
}

function printHarnessGcHelp(stdout) {
  stdout.write(`jj harness-gc\n\n用法：\n  jj harness-gc [--json]\n\n说明：\n  只读执行 Harness 熵清理扫描和质量评分。P0/P1 阻断；P2/P3 仅形成维护建议；不会自动删除、重写或创建本地状态。\n`);
}

function printInstallHelp(stdout) {
  stdout.write(`jj install-skill\n\n用法：\n  jj install-skill [--platform codex|claude|qoder|grok|all] [--project | --target dir] [--force] [--dry-run] [--json]\n\n选项：\n  --platform    安装目标。codex 同时安装 .codex/skills 与 .codex/agents，claude 安装 .claude/skills（完整 skill）+ .claude/commands（薄入口），qoder 安装 .qoder/skills，grok 安装 .grok/skills，all 安装全部资产。默认：codex\n  --project     安装到当前项目的 .codex/skills、.codex/agents、.claude/commands、.qoder/skills 或 .grok/skills。\n  --target dir  自定义 skills/commands 目标；Codex agents 安装到该目录的兄弟 agents 目录。不能和 --platform all 一起使用。\n  --force       任一目标资产已存在时覆盖整组安装文件。\n  --dry-run     显示 skills、agents 与 commands 的目标和冲突，不写文件。\n  --json        输出结构化结果；Codex 结果包含 agents 与 agent_target。\n\n纪律：\n  Skill 权威源（多端 SSOT）是仓库顶层 skills/；install 分发到各宿主 skills 目录。\n  Claude 安装完整 skills 到 .claude/skills，并安装 .claude/commands 薄入口。改 skill 后请 --force 重装各端。清单见 skill-inventory.json；对账 npm run harness:check。\n  同时在 ~/.jj-flow 生成空 map.md 与 knowledge/（已有文件不覆盖）。新项目须用户同意后才写入索引。\n`);
}

function printUninstallHelp(stdout) {
  stdout.write(`jj uninstall-skill\n\n用法：\n  jj uninstall-skill [--platform codex|claude|qoder|grok|all] [--project | --target dir] [--force] [--dry-run] [--json]\n\n选项：\n  --platform    卸载目标。codex 同时处理 .codex/skills 与 .codex/agents，claude 处理 .claude/skills 与 .claude/commands，qoder 处理 .qoder/skills，grok 处理 .grok/skills，all 处理全部资产。默认：codex\n  --project     从当前项目的 .codex/skills、.codex/agents、.claude/commands、.qoder/skills 或 .grok/skills 卸载。\n  --target dir  自定义 skills/commands 目标；Codex agents 位于该目录的兄弟 agents 目录。不能和 --platform all 一起使用。\n  --force       删除内容已修改或旧版未登记所有权的明确 jj-flow 资产。\n  --dry-run     仅显示删除目标、冲突和是否需要 --force，不写文件。\n  --json        输出结构化结果，包括 removed、conflicts 和 conflict_details。\n\n说明：\n  默认按 ownership manifest 或当前包内容校验，任一冲突都会阻止整组删除。不会按 jj-* 前缀扫描或删除未知资产。\n`);
}
