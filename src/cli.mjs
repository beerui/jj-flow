import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { buildDispatch, MODE_CHOICES, renderMarkdown } from './dispatch.mjs';
import {
  installSkill,
  projectClaudeTarget,
  projectCodexAgentsTarget,
  projectCodexTarget,
  projectQoderTarget,
  uninstallSkill
} from './installSkill.mjs';
import { loadCurrentReleaseLog } from './releaseLog.mjs';
import { persistPlaneCas, tickDispatch } from './dispatchRuntime.mjs';
import { inspectHarnessRepository, renderDoctorText } from './harnessDoctor.mjs';
import { replayTrace, renderTraceExplanation } from './dispatchTrace.mjs';
import { renderScenarioText, runAllScenarios, runScenario, SCENARIO_IDS } from './scenarioRunner.mjs';
import { renderHostTrialText, runHostTrial } from './hostTrialRunner.mjs';
import { renderHarnessGcText, runHarnessGc } from './harnessGc.mjs';
import { writeTaskArtifacts } from './taskArtifacts.mjs';
import { buildTaskAssignment, readTaskTitle, renderDispatchSummary, renderTaskAssignment } from './taskPresentation.mjs';
import { canonicalTaskId, resolveTask, taskStatus } from './taskRegistry.mjs';
import {
  archiveRun,
  finalizeRun,
  setGate,
  commitPrep,
  getStatus,
  initRun,
  mapFind,
  mapMergeFromRun,
  renderRalphStatusText,
  recordReview,
  writeDispatchSnapshot,
  writeHandoffPackage
} from './ralph.mjs';

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
    stdout.write('jj task\n\n用法：\n  jj task scaffold --manifest control-plane.json --delivery DELIVERY_ID [--task TASK-ID] [--root dir] [--json]\n  jj task assign --task TASK-ID [--root dir] [--manifest control-plane.json] [--delivery DELIVERY_ID] [--json]\n  jj task status --task TASK-ID [--root dir] [--manifest control-plane.json] [--json]\n  jj task context --task TASK-ID [--root dir] [--manifest control-plane.json] [--json]\n\n说明：\n  task.json 是任务 ID 的持久索引；新会话只需提供 TASK-ID，即可解析任务文档、控制面和最新状态。\n');
    return 0;
  }
  const command = rawArgs.shift();
  if (!['scaffold', 'assign', 'status', 'context'].includes(command)) throw new Error('task requires scaffold, assign, status, or context');
  const options = { manifest: null, deliveryId: null, taskId: null, root: cwd, json: false };
  while (rawArgs.length) {
    const arg = rawArgs.shift();
    if (arg === '--manifest') options.manifest = rawArgs.shift();
    else if (arg === '--delivery') options.deliveryId = rawArgs.shift();
    else if (arg === '--task') options.taskId = rawArgs.shift();
    else if (arg === '--root') options.root = rawArgs.shift() || cwd;
    else if (arg === '--json') options.json = true;
    else throw new Error(`Unknown task option: ${arg}`);
  }
  const root = path.resolve(cwd, options.root);
  let resolved = null;
  if (options.taskId && (!options.manifest || !options.deliveryId)) {
    resolved = resolveTask({ root, taskId: options.taskId, manifestPath: options.manifest });
    options.manifest = path.relative(root, resolved.manifestPath) || path.basename(resolved.manifestPath);
    options.deliveryId = resolved.delivery.delivery_id;
  }
  if (!options.manifest) throw new Error('--manifest requires a control-plane.json path, unless --task points to task.json');
  if (!options.deliveryId) throw new Error('--delivery requires a delivery_id');
  const manifestPath = path.resolve(root, options.manifest);
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
  if (options.json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else {
    let title = null;
    try {
      title = readTaskTitle({ root: cwd, taskId: `TASK-${options.deliveryId}` });
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
  if (!options.manifest) throw new Error('--manifest requires a control-plane.json path');
  if (!options.deliveryId) throw new Error('--delivery requires a delivery_id');
  options.manifest = fs.realpathSync(options.manifest);
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
      if (!platform) throw new Error('--platform requires codex, claude, qoder, or all');
      if (!['codex', 'claude', 'qoder', 'all'].includes(platform)) {
        throw new Error('--platform must be codex, claude, qoder, or all');
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
      options.claudeTargetDir = projectClaudeTarget({ cwd });
      options.qoderTargetDir = projectQoderTarget({ cwd });
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
  stdout.write(`jj-flow\n\n用法：\n  jj install-skill [--platform codex|claude|qoder|all] [--project | --target dir] [--force] [--dry-run] [--json]\n  jj uninstall-skill [--platform codex|claude|qoder|all] [--project | --target dir] [--force] [--dry-run] [--json]\n  jj doctor [--json]\n  jj scenario list | check | run <scenario|all> [--json]\n  jj trace explain | replay <trace.json> [--json]\n  jj host-trial run [--json]\n  jj harness-gc [--json]\n  jj dispatch-tick --manifest control-plane.json --delivery DELIVERY_ID [--receipt receipt.json] [--write] [--json]\n  jj ralph init|status|archive|map-merge|map-find|handoff|dispatch-snapshot|commit-prep|review-record [options] [--json]\n\n说明：\n  npx/CLI 只负责安装、卸载和维护调试。Codex 安装同时写入 .codex/skills 与 .codex/agents；Qoder 安装写入 .qoder/skills；真实使用入口是 $jj-same / $jj-ralph / $jj-dispatch（Codex）与 /jj-same / /jj-ralph（Claude Code）。\n  uninstall-skill 只删除 ownership manifest 登记或包内明确声明的资产；已修改及旧版未登记资产默认拒绝删除。\n  doctor 只读取 Git、Harness manifest 和版本化仓库文件，不修复、不安装、不派发。\n  scenario 使用固定 fixture 和纯状态转换，不创建真实 task；trace replay 不执行记录的 host actions。\n  host-trial 在系统临时目录运行半真实 Git/worktree/CAS/Review 闭环，不创建 Codex App task。\n  harness-gc 只读扫描文档、schema、fixture、规则 owner 和维护重复，不自动修复。\n  dispatch-tick 只执行一次可恢复调度 tick；默认预览，不启动后台进程。控制面中的 delivery_id 是任务身份，不是已移除的 $jj-delivery 入口。\n  ralph 子命令负责单仓闭环的机械步骤（init/status/archive/地图/handoff/快照/提交清单），不替代对话入口 $jj-ralph。\n\n示例：\n  npx @shendu-sdt/jj-flow@beta install-skill\n  npx @shendu-sdt/jj-flow@beta install-skill --platform qoder\n  npx @shendu-sdt/jj-flow@beta uninstall-skill --dry-run\n  npx @shendu-sdt/jj-flow@beta doctor --json\n  npx @shendu-sdt/jj-flow@beta scenario run dispatch-interrupted-resume --json\n`);
  stdout.write('  jj task scaffold --manifest control-plane.json --delivery DELIVERY_ID [--root dir] [--json]\n  jj task assign --manifest control-plane.json --delivery DELIVERY_ID --task TASK-ID [--root dir] [--json]\n');
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
    else stdout.write(`initialized ${run.run_id}\n`);
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
      force: Boolean(options.force)
    });
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else stdout.write(`finalized ${options.runId} -> ${result.archive_path} (map ${result.capability.id})\n`);
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
      force: Boolean(options.force)
    }, cwd);
    if (json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else stdout.write(`map-merged ${result.capability.id} from ${options.runId}\n`);
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
      task_thread_id: options.taskThreadId || null,
      review_thread_id: options.reviewThreadId || null,
      summary: options.summary || '',
      findings: options.findings,
      evidence_refs: options.evidenceRefs
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

  throw new Error(`Unknown ralph command: ${command}`);
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

function parseRalphReviewArgs(args) {
  const options = { findings: [], evidenceRefs: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--run-id') { options.runId = args[++i]; continue; }
    if (arg === '--outcome') { options.outcome = args[++i]; continue; }
    if (arg === '--reviewed-commit') { options.reviewedCommit = args[++i]; continue; }
    if (arg === '--task-thread') { options.taskThreadId = args[++i]; continue; }
    if (arg === '--review-thread') { options.reviewThreadId = args[++i]; continue; }
    if (arg === '--summary') { options.summary = args[++i]; continue; }
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

function printRalphHelp(stdout) {
  stdout.write(`jj ralph\n\n用法：\n  jj ralph init --run-id RALPH-… --title "…" --goal "…" [--capability CAP-…] [--in …] [--out …] [--force] [--json]\n  jj ralph status [--run-id RALPH-…] [--json]\n  jj ralph archive --run-id RALPH-… [--slug name] [--json]\n  jj ralph finalize --run-id RALPH-… [--modules p1,p2] [--keywords a,b] [--lessons "l1|l2"] [--slug name] [--force] [--json]\n  jj ralph map-merge --run-id RALPH-… [--modules p1,p2] [--keywords a,b] [--lessons "l1|l2"] [--force] [--json]\n  jj ralph map-find --query "关键词" [--limit N] [--json]\n  jj ralph handoff --run-id RALPH-… [--handoff-id HOF-…] [--target name] [--json]\n  jj ralph dispatch-snapshot --run-id RALPH-… [--target name] [--json]\n  jj ralph gate --run-id RALPH-… --gate analyze|plan|deliver|accept|archive --status PASS|FAIL|… [--no-advance] [--json]\n  jj ralph commit-prep --run-id RALPH-… [--json]\n  jj ralph review-record --run-id RALPH-… --outcome PASS|NEEDS_CHANGES|BLOCKED [--reviewed-commit sha] [--task-thread id] [--review-thread id] [--summary text] [--findings-file path] [--json]\n\n说明：\n  单仓闭环的机械步骤。对话入口是 $jj-ralph / /jj-ralph。\n  archive 要求 gates.accept=PASS；finalize = map-merge + archive；map-merge 默认要求 accept=PASS（--force 可覆盖）；gate 更新 gates 并可推进 phase。\n  handoff 写到 .workflow/handoffs/（不在 ralph 目录实现迁移）。\n  commit-prep 只生成清单与 message，不执行 git commit/push。\n  review-record 把审查结论与任务/审查会话 ID 关联写入 reviews/ 并更新 run.json。\n`);
}

function printDoctorHelp(stdout) {
  stdout.write(`jj doctor\n\n用法：\n  jj doctor [--json]\n\n说明：\n  只读检查 Git、Harness manifest、权威文件、禁止路径、host capabilities 和可用 autonomy level。\n`);
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

function printHarnessGcHelp(stdout) {
  stdout.write(`jj harness-gc\n\n用法：\n  jj harness-gc [--json]\n\n说明：\n  只读执行 Harness 熵清理扫描和质量评分。P0/P1 阻断；P2/P3 仅形成维护建议；不会自动删除、重写或创建本地状态。\n`);
}

function printInstallHelp(stdout) {
  stdout.write(`jj install-skill\n\n用法：\n  jj install-skill [--platform codex|claude|qoder|all] [--project | --target dir] [--force] [--dry-run] [--json]\n\n选项：\n  --platform    安装目标。codex 同时安装 .codex/skills 与 .codex/agents，claude 安装 .claude/commands，qoder 安装 .qoder/skills，all 安装全部资产。默认：codex\n  --project     安装到当前项目的 .codex/skills、.codex/agents、.claude/commands 或 .qoder/skills。\n  --target dir  自定义 skills/commands 目标；Codex agents 安装到该目录的兄弟 agents 目录。不能和 --platform all 一起使用。\n  --force       任一目标资产已存在时覆盖整组安装文件。\n  --dry-run     显示 skills、agents 与 commands 的目标和冲突，不写文件。\n  --json        输出结构化结果；Codex 结果包含 agents 与 agent_target。\n`);
}

function printUninstallHelp(stdout) {
  stdout.write(`jj uninstall-skill\n\n用法：\n  jj uninstall-skill [--platform codex|claude|qoder|all] [--project | --target dir] [--force] [--dry-run] [--json]\n\n选项：\n  --platform    卸载目标。codex 同时处理 .codex/skills 与 .codex/agents，claude 处理 .claude/commands，qoder 处理 .qoder/skills，all 处理全部资产。默认：codex\n  --project     从当前项目的 .codex/skills、.codex/agents、.claude/commands 或 .qoder/skills 卸载。\n  --target dir  自定义 skills/commands 目标；Codex agents 位于该目录的兄弟 agents 目录。不能和 --platform all 一起使用。\n  --force       删除内容已修改或旧版未登记所有权的明确 jj-flow 资产。\n  --dry-run     仅显示删除目标、冲突和是否需要 --force，不写文件。\n  --json        输出结构化结果，包括 removed、conflicts 和 conflict_details。\n\n说明：\n  默认按 ownership manifest 或当前包内容校验，任一冲突都会阻止整组删除。不会按 jj-* 前缀扫描或删除未知资产。\n`);
}
