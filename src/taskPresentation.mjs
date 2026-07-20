import fs from 'node:fs';
import path from 'node:path';

export const TASK_ASSIGNMENT_SCHEMA_VERSION = 'jj-flow/task-assignment/1.0';

export function taskDocumentPath(root, taskId) {
  if (!root || !taskId) throw new Error('root and taskId are required');
  return path.resolve(root, '.workflow', 'tasks', safeTaskId(taskId), 'task.md');
}

export function readTaskTitle({ root, taskId, file } = {}) {
  const document = file || taskDocumentPath(root, taskId);
  if (!fs.existsSync(document)) throw new Error(`任务文档不存在：${document}`);
  const content = fs.readFileSync(document, 'utf8');
  const heading = content.match(/^#\s+(.+?)\s*$/m);
  if (!heading?.[1]) throw new Error(`任务文档缺少主标题：${document}`);
  return heading[1].trim();
}

export function buildTaskAssignment({ root, taskId, delivery, manifestPath = null } = {}) {
  if (!delivery || typeof delivery !== 'object') throw new Error('delivery is required');
  const title = readTaskTitle({ root, taskId });
  const command = `jj dispatch-tick --manifest ${manifestPath || 'control-plane.json'} --delivery ${delivery.delivery_id} --write`;
  return {
    schema_version: TASK_ASSIGNMENT_SCHEMA_VERSION,
    task_id: taskId,
    title,
    delivery_id: delivery.delivery_id,
    status: delivery.status || 'DRAFT',
    flow: ['PREVIEW', 'APPROVE', 'DISPATCH', 'TICK'],
    command
  };
}

export function renderTaskAssignment(assignment) {
  return [
    `任务：${assignment.title}`,
    `任务 ID：${assignment.task_id}`,
    `分配流程：${assignment.flow.join(' → ')}`,
    `命令：${assignment.command}`
  ].join('\n');
}

export function renderDispatchSummary(result, { title = null } = {}) {
  const lines = [];
  if (title) lines.push(`任务：${title}`);
  lines.push(`状态：${result.status}${result.persisted ? '（已写回）' : '（预览）'}`);
  if (result.actions?.length) lines.push(`已分配：${result.actions.length} 个任务`);
  if (result.decision_required?.length) lines.push(`待确认：${result.decision_required.length} 项`);
  if (result.next_wait?.length) lines.push(`等待：${result.next_wait.length} 项`);
  return `${lines.join('\n')}\n`;
}

function safeTaskId(taskId) {
  const safe = String(taskId).replace(/[^a-zA-Z0-9._-]+/g, '-');
  if (!safe || safe === '.' || safe === '..') throw new Error('invalid taskId');
  return safe;
}
