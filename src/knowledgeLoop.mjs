import { attachKnowledgeRefs } from './portfolioKnowledge.mjs';

export function buildKnowledgeLoopPackage({ mode, recipe, intent = '', evidence = [], guardReport, executionDecision, project = null, cwd = process.cwd(), knowledge_refs = null } = {}) {
  const completed = guardReport?.status === 'PASS';
  const captureTargets = completed ? inferCaptureTargets(mode, evidence) : [];
  const pendingGuards = (guardReport?.results || [])
    .filter((item) => item.status !== 'PASS')
    .map((item) => ({ id: item.id, status: item.status, reason: item.reason }));
  const nextActions = completed
    ? buildCompletedNextActions(captureTargets, executionDecision)
    : pendingGuards.map((item) => `补齐 ${item.id}：${item.reason}`);

  const portfolio = Array.isArray(knowledge_refs)
    ? {
        status: knowledge_refs.length ? 'ready' : 'empty',
        knowledge_refs,
        knowledge_summary: knowledge_refs.map((id) => String(id)),
        knowledge_items: []
      }
    : attachKnowledgeRefs({ q: intent, project, cwd });

  return {
    status: completed ? 'ready' : 'pending',
    intent,
    mode,
    recipe_id: recipe?.id || null,
    capture_targets: captureTargets,
    knowledge_refs: portfolio.knowledge_refs || [],
    knowledge_summary: portfolio.knowledge_summary || [],
    portfolio_knowledge: {
      status: portfolio.status,
      root: portfolio.portfolio_kb_root || null,
      project_key: portfolio.project_key || project || null,
      items: portfolio.knowledge_items || []
    },
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
      next_actions: nextActions,
      knowledge_refs: portfolio.knowledge_refs || []
    },
    boundary: 'knowledge loop packages context and portfolio knowledge_refs; chat/thread memory is non-authoritative'
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
    actions.unshift('可以按调用链继续执行');
  }
  if (!actions.length) {
    actions.push('无需捕获知识资产，保留 evidence 和 guard 状态。');
  }

  return actions;
}
