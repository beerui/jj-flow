import fs from 'node:fs';
import path from 'node:path';
import { buildTaskState, canonicalTaskId, writeTaskState } from './taskRegistry.mjs';
import { ensureDispatchRalphRuns, ralphRunIdFromDelivery } from './dispatchRalph.mjs';

const DEFAULT_SECTIONS = ['Goal', '验收', 'Steps'];

export function taskArtifactDirectory(root, taskId) {
  if (!root || !taskId) throw new Error('root and taskId are required');
  const safeId = String(taskId).replace(/[^a-zA-Z0-9._-]+/g, '-');
  return path.resolve(root, '.workflow', 'tasks', safeId);
}

export function buildTaskArtifacts(delivery, {
  root = process.cwd(),
  taskId = canonicalTaskId(delivery),
  manifestPath = null,
  now = new Date().toISOString(),
  ralph_runs = []
} = {}) {
  if (!delivery || typeof delivery !== 'object') throw new Error('delivery is required');
  if (delivery.task_mode === 'quick') {
    return { mode: 'quick', directory: null, files: {}, reason: 'quick 任务不生成完整任务文档。' };
  }
  const directory = taskArtifactDirectory(root, taskId);
  const prompt = delivery.distribution_prompt || {};
  const ralphRunId = ralphRunIdFromDelivery(delivery.delivery_id);
  const taskMarkdown = renderControlTaskMd(delivery, {
    taskId,
    ralphRunId,
    ralph_runs,
    prompt
  });
  const files = {
    ...(manifestPath ? { 'task.json': `${JSON.stringify(buildTaskState({ delivery, taskId, manifestPath, root, now }), null, 2)}\n` } : {}),
    'task.md': `${taskMarkdown}\n`,
    'progress.md': renderProgress(delivery, taskId, now),
    'result.md': renderResult(delivery, taskId)
  };
  return { mode: 'standard', directory, files, sections: DEFAULT_SECTIONS, ralph_run_id: ralphRunId, ralph_runs };
}

export function writeTaskArtifacts(delivery, options = {}) {
  const ralph = options.ensure_ralph === false
    ? { run_id: ralphRunIdFromDelivery(delivery.delivery_id), runs: options.ralph_runs || [] }
    : ensureDispatchRalphRuns({
      delivery,
      plane: options.plane || {},
      taskId: options.taskId || canonicalTaskId(delivery),
      attach_knowledge: options.attach_knowledge === true
    });
  const bundle = buildTaskArtifacts(delivery, { ...options, ralph_runs: ralph.runs });
  if (bundle.mode === 'quick') return { ...bundle, ralph };
  fs.mkdirSync(bundle.directory, { recursive: true });
  const paths = {};
  for (const [name, content] of Object.entries(bundle.files)) {
    const target = path.join(bundle.directory, name);
    fs.writeFileSync(target, content, 'utf8');
    paths[name] = target;
  }
  if (!paths['task.json'] && options.manifestPath) {
    paths['task.json'] = writeTaskState(buildTaskState({
      delivery,
      taskId: options.taskId || canonicalTaskId(delivery),
      manifestPath: options.manifestPath,
      root: options.root || process.cwd()
    }), { root: options.root || process.cwd() });
  }
  return { ...bundle, paths, ralph };
}

function listItems(items, fallback) {
  return Array.isArray(items) && items.length ? items.map((item) => '- ' + item) : ['- ' + fallback];
}

function boundRalphRunIds(ralphRunId, ralph_runs) {
  const ids = [];
  for (const row of ralph_runs || []) {
    if (row?.run_id && !ids.includes(row.run_id)) ids.push(row.run_id);
  }
  if (!ids.length && ralphRunId) ids.push(ralphRunId);
  return ids;
}

function renderControlTaskMd(delivery, { taskId, ralphRunId, ralph_runs, prompt }) {
  const targetProjects = (delivery.targets || []).map((target) => target.project_id).filter(Boolean);
  const accept = listItems(prompt.acceptance_criteria, '以各项目 Ralph 验收 + 回执 + Review PASS 为准。');
  const boundIds = boundRalphRunIds(ralphRunId, ralph_runs);
  const pathHint = boundIds.map((id) => '`.workflow/ralph/' + id + '/`').join(' 或 ');
  const steps = [
    '1. 统筹只写 control_root（plane / receipt / attestation / 本索引）。不要在 ~/.jj-flow 写业务实现或 ANL 正文当实施本。',
    '2. 每个 lead/target 业务仓必须有完整 Ralph：' + pathHint + '（task_plan Goal/验收/Steps + progress + findings + run.json）。reuse-sibling 时以 `### 各项目 Ralph` 的实际 run_id 为准。',
    '3. 目标仓 ANALYZE/ADAPT/DELIVER/ACCEPT 都在该仓 Ralph 里做；`$jj-same` 只迁协议，不替代目标 Ralph。',
    '4. 分析证据仍可用 plane 的 ANL-TARGET id，但正文落在对应仓 `task_plan.md`。',
    '5. ACCEPT PASS 后该仓 finalize；Git 收工 `$jj-end`。delivery VERIFIED 仍要 attestation + produced_commit。'
  ];
  const ralphLines = (ralph_runs || []).length
    ? ralph_runs.map((row) => {
      const loc = row.path
        ? '`' + String(row.path).replaceAll('\\', '/') + '/.workflow/ralph/' + row.run_id + '/`'
        : '(path missing)';
      return '- `' + row.project_id + '` · ' + row.role + ' · ' + (row.action || '?') + ' · ' + loc;
    })
    : ['- （尚未绑定业务仓 path；登记 plane.projects[].path 后再 scaffold）'];
  return [
    '# ' + taskId,
    '',
    '> 统筹索引（control_root）。实施只写各业务仓 Ralph，不写本目录的 ANL-* 正文。',
    '',
    '## Goal',
    '',
    prompt.summary || delivery.title || '待补充任务目标。',
    '',
    '- delivery：`' + delivery.delivery_id + '`',
    '- 状态：' + (delivery.status || 'DRAFT'),
    '- 需求来源：' + (prompt.source_project || delivery.origin_project || '待确认'),
    '- 领头：' + (delivery.lead_project || '待确认'),
    '- 目标：' + (targetProjects.join('、') || '待确认'),
    '- Ralph run_id：`' + boundIds.join('` · `') + '`',
    '- handoff_ref：' + (prompt.handoff_ref || delivery.handoff_ref || '待生成'),
    '- source_head：' + (prompt.source_head || delivery.reference_implementation?.commit || '待生成'),
    '',
    '## 验收',
    '',
    ...accept,
    '',
    '## Steps',
    '',
    ...steps,
    '',
    '### 各项目 Ralph',
    '',
    ...ralphLines,
    '',
    '### 非目标',
    '',
    ...listItems(prompt.do_not_port, '暂无明确排除项。')
  ].join('\n');
}

function renderProgress(delivery, taskId, now) {
  const day = String(now || new Date().toISOString()).slice(0, 10);
  return [
    '# ' + taskId + ' — progress',
    '',
    '## ' + day,
    '',
    '- delivery：' + (delivery.status || 'DRAFT'),
    '- [ ] 各业务仓 Ralph 已 init/resume',
    '- [ ] 源项目 lead Ralph 分析/验收',
    '- [ ] 目标仓 Ralph ADAPT',
    '- [ ] 目标验证与 Review',
    ''
  ].join('\n');
}

function renderResult(delivery, taskId) {
  return [
    '# ' + taskId + ' 结果',
    '',
    '- 状态：PENDING',
    '- delivery：' + delivery.delivery_id,
    '- source_head：待填写',
    '- 各项目 Ralph：见 task.md `### 各项目 Ralph`',
    '- target checkpoints：待填写',
    '- 风险与未解决项：待填写',
    ''
  ].join('\n');
}
