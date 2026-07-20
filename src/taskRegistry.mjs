import fs from 'node:fs';
import path from 'node:path';

export const TASK_STATE_SCHEMA_VERSION = 'jj-flow/task-state/1.0';

export function canonicalTaskId(delivery) {
  if (!delivery || typeof delivery !== 'object') throw new Error('delivery is required');
  const taskId = delivery.task_id || `TASK-${delivery.delivery_id || ''}`;
  return safeTaskId(taskId);
}

export function taskMetadataPath(root, taskId) {
  return path.resolve(root, '.workflow', 'tasks', safeTaskId(taskId), 'task.json');
}

export function buildTaskState({ delivery, taskId = canonicalTaskId(delivery), manifestPath, root = process.cwd(), now = new Date().toISOString() } = {}) {
  if (!delivery || typeof delivery !== 'object') throw new Error('delivery is required');
  if (!manifestPath) throw new Error('manifestPath is required');
  const absoluteRoot = path.resolve(root);
  const absoluteManifest = path.resolve(absoluteRoot, manifestPath);
  return {
    schema_version: TASK_STATE_SCHEMA_VERSION,
    task_id: safeTaskId(taskId),
    delivery_id: delivery.delivery_id,
    title: delivery.title || delivery.delivery_id,
    status: delivery.status || 'DRAFT',
    task_mode: delivery.task_mode || 'standard',
    manifest_ref: path.relative(absoluteRoot, absoluteManifest) || path.basename(absoluteManifest),
    task_document_ref: path.relative(absoluteRoot, taskMetadataPath(absoluteRoot, taskId)).replace(/\\/g, '/').replace(/\/task\.json$/, '/task.md'),
    created_at: now,
    updated_at: now
  };
}

export function readTaskState({ root = process.cwd(), taskId } = {}) {
  const file = taskMetadataPath(root, taskId);
  if (!fs.existsSync(file)) throw new Error(`任务索引不存在：${file}`);
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (state?.schema_version !== TASK_STATE_SCHEMA_VERSION) {
    throw new Error(`任务索引版本不支持：${state?.schema_version || 'unknown'}`);
  }
  if (state.task_id !== safeTaskId(taskId)) throw new Error(`任务索引 task_id 不匹配：${file}`);
  return state;
}

export function writeTaskState(state, { root = process.cwd() } = {}) {
  if (!state || typeof state !== 'object') throw new Error('state is required');
  const file = taskMetadataPath(root, state.task_id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  return file;
}

export function resolveTask({ root = process.cwd(), taskId, manifestPath = null } = {}) {
  const absoluteRoot = path.resolve(root);
  const state = readTaskState({ root: absoluteRoot, taskId });
  const manifestRef = manifestPath || state.manifest_ref;
  const absoluteManifest = path.resolve(absoluteRoot, manifestRef);
  if (!fs.existsSync(absoluteManifest)) throw new Error(`控制面 manifest 不存在：${absoluteManifest}`);
  const plane = JSON.parse(fs.readFileSync(absoluteManifest, 'utf8'));
  const delivery = plane.deliveries?.find((item) => item.delivery_id === state.delivery_id);
  if (!delivery) throw new Error(`任务 ${state.task_id} 绑定的 delivery 不存在：${state.delivery_id}`);
  return { state, plane, delivery, manifestPath: absoluteManifest, root: absoluteRoot };
}

export function taskStatus({ root = process.cwd(), taskId, manifestPath = null } = {}) {
  const resolved = resolveTask({ root, taskId, manifestPath });
  const { state, plane, delivery } = resolved;
  return {
    schema_version: TASK_STATE_SCHEMA_VERSION,
    task_id: state.task_id,
    title: delivery.title || state.title,
    delivery_id: delivery.delivery_id,
    status: delivery.status || state.status,
    task_mode: delivery.task_mode || state.task_mode,
    revision: plane.revision,
    manifest_ref: state.manifest_ref,
    task_document_ref: state.task_document_ref,
    updated_at: state.updated_at,
    targets: (delivery.targets || []).map((target) => ({
      project_id: target.project_id,
      status: target.status,
      responsibilities: (target.responsibilities || []).map((responsibility) => ({
        name: responsibility.name,
        phase: responsibility.phase,
        status: responsibility.status,
        attempt: responsibility.attempt
      }))
    })),
    next_action: nextAction(delivery)
  };
}

function nextAction(delivery) {
  if (delivery.status === 'DRAFT' || delivery.status === 'PREVIEW_ONLY') return 'PREVIEW';
  if (delivery.status === 'APPROVED' || delivery.status === 'DISPATCHING' || delivery.status === 'RUNNING') return 'TICK';
  if (delivery.status === 'BLOCKED') return '解除阻塞后重新 PREVIEW';
  if (delivery.status === 'VERIFIED') return '已完成';
  return '查看任务文档和控制面事件';
}

function safeTaskId(taskId) {
  const safe = String(taskId || '').trim();
  if (!safe || safe === '.' || safe === '..' || safe.includes('/') || safe.includes('\\') || !/^[a-zA-Z0-9._-]+$/.test(safe)) {
    throw new Error(`invalid taskId: ${taskId}`);
  }
  return safe;
}
