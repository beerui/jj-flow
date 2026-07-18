export const HOST_ACTION_SCHEMA_VERSION = 'jj-flow/dispatch-host-action/1.0';

export const HOST_ACTION_TYPES = Object.freeze([
  'CREATE_THREAD',
  'RECONCILE_THREAD'
]);

export const RECEIPT_KINDS = Object.freeze(['TASK_RESULT', 'REVIEW_RESULT']);
export const RECEIPT_STATUSES = Object.freeze(['COMPLETED', 'BLOCKED']);

export const HOST_ACCESS_PROFILES = Object.freeze({
  read: Object.freeze({
    agent_name: 'jj-workflow-reviewer',
    sandbox_mode: 'read-only',
    environment: 'project-read',
    worktree_policy: 'forbidden'
  }),
  write: Object.freeze({
    agent_name: 'jj-workflow-developer',
    sandbox_mode: 'workspace-write',
    environment: 'exclusive-worktree',
    worktree_policy: 'required-at-bind'
  })
});

export const HOST_ACTION_POLICIES = Object.freeze({
  CREATE_THREAD: Object.freeze({
    mode: 'external-write',
    required_capabilities: Object.freeze(['create_thread', 'sandbox']),
    write_access_capabilities: Object.freeze(['worktree'])
  }),
  RECONCILE_THREAD: Object.freeze({
    mode: 'read-only',
    required_capabilities: Object.freeze(['list_threads', 'read_thread', 'sandbox']),
    write_access_capabilities: Object.freeze(['worktree'])
  })
});

export function describeHostAction(type, access) {
  const policy = HOST_ACTION_POLICIES[type];
  const profile = HOST_ACCESS_PROFILES[access];
  if (!policy) throw new Error(`Unknown host action type: ${type}`);
  if (!profile) throw new Error(`Unknown host action access: ${access}`);
  const requiredCapabilities = [
    ...policy.required_capabilities,
    ...(access === 'write' ? policy.write_access_capabilities : [])
  ];
  return {
    host_action_schema_version: HOST_ACTION_SCHEMA_VERSION,
    mode: policy.mode,
    required_capabilities: requiredCapabilities,
    ...profile
  };
}
