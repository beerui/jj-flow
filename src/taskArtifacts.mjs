import fs from 'node:fs';
import path from 'node:path';
import { buildTaskState, canonicalTaskId, writeTaskState } from './taskRegistry.mjs';

const DEFAULT_SECTIONS = ['任务目标', '项目归属', '分发提示词', '任务范围', '非目标', '风险', '验收标准', '依赖', '当前状态', '推荐下一步'];

export function taskArtifactDirectory(root, taskId) {
  if (!root || !taskId) throw new Error('root and taskId are required');
  const safeId = String(taskId).replace(/[^a-zA-Z0-9._-]+/g, '-');
  return path.resolve(root, '.workflow', 'tasks', safeId);
}

export function buildTaskArtifacts(delivery, { root = process.cwd(), taskId = canonicalTaskId(delivery), manifestPath = null, now = new Date().toISOString() } = {}) {
  if (!delivery || typeof delivery !== 'object') throw new Error('delivery is required');
  if (delivery.task_mode === 'quick') {
    return { mode: 'quick', directory: null, files: {}, reason: 'quick 任务不生成完整任务文档。' };
  }
  const directory = taskArtifactDirectory(root, taskId);
  const prompt = delivery.distribution_prompt || {};
  const targetProjects = (delivery.targets || []).map((target) => target.project_id).filter(Boolean);
  const planRows = buildPlanRows(delivery);
  const taskMarkdown = [
    `# ${delivery.title || delivery.delivery_id}`,
    '',
    `- task_id：${taskId}`,
    `- delivery_id：${delivery.delivery_id}`,
    `- 状态：${delivery.status || 'DRAFT'}`,
    `- task_mode：${delivery.task_mode || 'standard'}`,
    '',
    '## 任务目标',
    '',
    prompt.summary || delivery.title || '待补充任务目标。',
    '',
    '## 项目归属',
    '',
    `- 需求来源：${prompt.source_project || delivery.origin_project || '待确认'}`,
    `- 需求归属：${delivery.requirement_owner || '待确认'}`,
    `- 领头项目：${delivery.lead_project || '待确认'}`,
    `- 目标项目：${targetProjects.join('、') || '待确认'}`,
    '',
    '## 分发提示词',
    '',
    '```json',
    JSON.stringify({ ...prompt, delivery_id: delivery.delivery_id }, null, 2),
    '```',
    '',
    '## 任务范围',
    '',
    '- 只执行已批准的 task_key 和目标项目责任。',
    '- 先输出 AI 友好的任务描述、风险点、验收标准和计划，再开始修改。',
    '',
    '## 非目标',
    '',
    ...(listItems(prompt.do_not_port, '暂无明确排除项。')),
    '',
    '## 风险',
    '',
    ...(listItems(prompt.risk_points, '暂无已知风险；仍需由目标分析确认。')),
    '',
    '## 验收标准',
    '',
    ...(listItems(prompt.acceptance_criteria, '以目标分析、验证回执和 Review PASS 为准。')),
    '',
    '## 依赖',
    '',
    ...(planRows.length ? planRows.map((row) => `- ${row}`) : ['- 无已登记依赖。']),
    '',
    '## 当前状态',
    '',
    `- delivery：${delivery.status || 'DRAFT'}`,
    '- task 文档：READY',
    '- 下一步：用户确认后才允许 APPROVE / DISPATCH。',
    '',
    '## 推荐下一步',
    '',
    '源项目完成并通过验证后，展示各目标项目的 DIRECT / ADAPT / BLOCKED 推荐，等待用户选择；选择后重新 PREVIEW 和 APPROVE。',
    '',
    '## 产物引用',
    '',
    `- handoff_ref：${prompt.handoff_ref || delivery.handoff_ref || '待生成'}`,
    `- source_head：${prompt.source_head || delivery.reference_implementation?.commit || '待生成'}`,
    `- task_artifact_dir：.workflow/tasks/${path.basename(directory)}`
  ].join('\n');

  const files = {
    ...(manifestPath ? { 'task.json': `${JSON.stringify(buildTaskState({ delivery, taskId, manifestPath, root, now }), null, 2)}\n` } : {}),
    'task.md': `${taskMarkdown}\n`,
    'plan.md': renderPlan(delivery, taskId, planRows),
    'progress.md': renderProgress(delivery, taskId),
    'result.md': renderResult(delivery, taskId)
  };
  return { mode: 'standard', directory, files, sections: DEFAULT_SECTIONS };
}

export function writeTaskArtifacts(delivery, options = {}) {
  const bundle = buildTaskArtifacts(delivery, options);
  if (bundle.mode === 'quick') return bundle;
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
  return { ...bundle, paths };
}

function listItems(items, fallback) {
  return Array.isArray(items) && items.length ? items.map((item) => `- ${item}`) : [`- ${fallback}`];
}

function buildPlanRows(delivery) {
  const rows = [];
  const add = (projectId, responsibilities) => {
    for (const item of responsibilities || []) {
      rows.push(`${delivery.delivery_id}/${projectId}/${item.name}/${item.attempt || 1}（${(item.depends_on || []).join(', ') || '无前置'}）`);
    }
  };
  add(delivery.lead_project, delivery.lead_responsibilities);
  for (const target of delivery.targets || []) add(target.project_id, target.responsibilities);
  return rows;
}

function renderPlan(delivery, taskId, rows) {
  return [
    `# ${taskId} 执行计划`, '',
    `- delivery_id：${delivery.delivery_id}`,
    '- 执行顺序：前置责任完成后再创建下游 thread。',
    '- 写任务：独占 worktree；读任务：read-only project-read。', '',
    '## 责任链', '',
    ...(rows.length ? rows.map((row, index) => `${index + 1}. ${row}`) : ['1. 待补充。']), '',
    '## 闸门', '',
    '1. 任务文档已生成。',
    '2. 用户确认目标集合后 PREVIEW / APPROVE。',
    '3. 每个目标先完成 ANL-TARGET，再执行 development。',
    '4. verification 与 Review PASS 后才可推进 checkpoint。', ''
  ].join('\n');
}

function renderProgress(delivery, taskId) {
  return [`# ${taskId} 进度`, '', `- delivery：${delivery.status || 'DRAFT'}`, '- [ ] intake 已确认', '- [ ] 任务文档已确认', '- [ ] 源项目已完成', '- [ ] 用户选择目标', '- [ ] 目标分析完成', '- [ ] 目标验证与 Review 完成', ''].join('\n');
}

function renderResult(delivery, taskId) {
  return [`# ${taskId} 结果`, '', '- 状态：PENDING', `- delivery：${delivery.delivery_id}`, '- source_head：待填写', '- target checkpoints：待填写', '- 风险与未解决项：待填写', '- 推荐下一步：源任务完成后生成目标候选并等待用户选择。', ''].join('\n');
}
