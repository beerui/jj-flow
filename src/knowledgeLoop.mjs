export function buildKnowledgeLoopPackage({ mode, recipe, intent = '', evidence = [], guardReport, executionDecision } = {}) {
  const completed = guardReport?.status === 'PASS';
  const captureTargets = completed ? inferCaptureTargets(mode, evidence) : [];
  const pendingGuards = (guardReport?.results || [])
    .filter((item) => item.status !== 'PASS')
    .map((item) => ({ id: item.id, status: item.status, reason: item.reason }));
  const nextActions = completed
    ? buildCompletedNextActions(captureTargets, executionDecision)
    : pendingGuards.map((item) => `补齐 ${item.id}：${item.reason}`);

  return {
    status: completed ? 'ready' : 'pending',
    intent,
    mode,
    recipe_id: recipe?.id || null,
    capture_targets: captureTargets,
    team_context: {
      guard_status: guardReport?.status || 'PENDING',
      execution_status: executionDecision?.status || 'disabled',
      evidence: evidence.map((item) => ({
        id: item.id,
        source: item.source,
        artifact_type: item.artifact_type,
        summary: item.summary
      })),
      pending_guards: pendingGuards,
      next_actions: nextActions
    },
    boundary: 'knowledge loop only packages context; Maestro core remains unchanged'
  };
}

function inferCaptureTargets(mode, evidence) {
  const targets = new Set();

  if (['same'].includes(mode)) {
    targets.add('knowhow');
    targets.add('spec');
    targets.add('workflow_recipe');
  }
  if (evidence.some((item) => item.artifact_type === 'problem_solution')) targets.add('knowhow');
  if (evidence.some((item) => item.artifact_type === 'recipe_registry')) targets.add('workflow_recipe');

  return [...targets];
}

function buildCompletedNextActions(captureTargets, executionDecision) {
  const actions = captureTargets.map((target) => `捕获为 ${target}`);
  if (executionDecision?.status === 'ready') {
    actions.unshift('可以交给 Maestro 调用链继续执行');
  }
  if (!actions.length) {
    actions.push('无需捕获知识资产，保留 evidence 和 guard 状态。');
  }

  return actions;
}
