import { buildGuardReport } from './guards.mjs';
import { buildKnowledgeLoopPackage } from './knowledgeLoop.mjs';
import { buildExecutionDecision } from './maestroExecution.mjs';
import { getRecipe, MODES, RECIPES } from './recipes.mjs';
import { normalizeEvidenceList } from './evidence.mjs';

export const MODE_CHOICES = MODES;

export function normalizeMode(mode = 'auto') {
  const normalized = String(mode || 'auto').trim().toLowerCase();
  if (!MODES.includes(normalized)) {
    return 'auto';
  }
  return normalized;
}

export function routeIntent(intent = '') {
  const text = String(intent).toLowerCase();
  const scores = Object.fromEntries(Object.keys(RECIPES).map((mode) => [mode, 0]));

  for (const [mode, recipe] of Object.entries(RECIPES)) {
    for (const hint of recipe.routeHints) {
      if (text.includes(hint.toLowerCase())) scores[mode] += 1;
    }
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [mode, score] = ranked[0];
  return {
    mode: score > 0 ? mode : 'delivery',
    scores,
    reason: score > 0 ? `命中 ${mode} 关键词。` : '没有明显关键词，默认按端到端交付处理。'
  };
}

export function buildDispatch({ mode = 'auto', intent = '', evidence = [], cwd = process.cwd() } = {}) {
  const requestedMode = normalizeMode(mode);
  const routing = requestedMode === 'auto' ? routeIntent(intent) : { mode: requestedMode, scores: null, reason: '用户显式指定模式。' };
  const recipe = getRecipe(routing.mode);
  const normalizedEvidence = normalizeEvidenceList(evidence);
  const guardReport = buildGuardReport(recipe, normalizedEvidence);
  const executionDecision = buildExecutionDecision({
    mode: recipe.mode,
    guardReport,
    evidence: normalizedEvidence,
    maestroCalls: recipe.maestroCalls
  });
  const knowledgeLoop = buildKnowledgeLoopPackage({
    mode: recipe.mode,
    recipe,
    intent,
    evidence: normalizedEvidence,
    guardReport,
    executionDecision
  });
  const maestroPrompt = buildMaestroPrompt({ recipe, intent, guardReport, evidence: normalizedEvidence, cwd });

  return {
    version: '0.1.0',
    requested_mode: requestedMode,
    mode: recipe.mode,
    recipe: {
      id: recipe.id,
      title: recipe.title,
      summary: recipe.summary
    },
    routing,
    cwd,
    evidence: normalizedEvidence,
    evidence_checklist: recipe.evidenceChecklist,
    guard_report: guardReport,
    execution_decision: executionDecision,
    knowledge_loop: knowledgeLoop,
    maestro_calls: recipe.maestroCalls,
    maestro_prompt: maestroPrompt
  };
}

export function buildMaestroPrompt({ recipe, intent, guardReport, evidence, cwd }) {
  const calls = recipe.maestroCalls
    .map((call) => `- ${call.skill} (${call.mode})：${call.purpose}${call.optional ? ' [可选]' : ''}`)
    .join('\n');
  const checklist = recipe.evidenceChecklist.map((item) => `- ${item}`).join('\n');
  const guards = guardReport.results.map((item) => `- ${item.status} ${item.id}：${item.reason}`).join('\n');
  const focus = recipe.promptFocus.map((item) => `- ${item}`).join('\n');
  const inputPolicy = recipe.inputPolicy?.length
    ? `\n输入策略：\n${recipe.inputPolicy.map((item) => `- ${item}`).join('\n')}\n`
    : '';
  const evidenceSummary = evidence.length
    ? evidence.map((item) => `- ${item.id} | ${item.source} | ${item.artifact_type} | ${item.summary}`).join('\n')
    : '- 暂无证据，所有关键结论保持 PENDING。';

  return `【/jj-${recipe.mode}】${recipe.title}\n\n原始需求：\n${intent || '(空)'}\n\n当前目录：\n${cwd}\n${inputPolicy}\n执行重点：\n${focus}\n\n建议 Maestro 调用链：\n${calls}\n\n必须补齐的证据：\n${checklist}\n\n已有证据：\n${evidenceSummary}\n\n证据门禁状态：\n${guards}\n\n要求：先说明边界和证据，再执行；没有证据的结论不能写成 PASS。`;
}

export function renderMarkdown(dispatch) {
  const calls = dispatch.maestro_calls
    .map((call) => `- ${call.skill}：${call.purpose}${call.optional ? '（可选）' : ''}`)
    .join('\n');
  const guards = dispatch.guard_report.results
    .map((item) => `- ${item.status} ${item.title}：${item.reason}`)
    .join('\n');
  const execution = dispatch.execution_decision
    ? `- ${dispatch.execution_decision.status}：${dispatch.execution_decision.reason}`
    : '- disabled：缺少执行决策。';
  const knowledgeLoop = dispatch.knowledge_loop
    ? `- ${dispatch.knowledge_loop.status}：${dispatch.knowledge_loop.team_context.next_actions.join('；')}`
    : '- pending：缺少知识闭环包。';

  return `# /jj-${dispatch.mode}\n\n${dispatch.recipe.title}：${dispatch.recipe.summary}\n\n## Maestro 调用\n\n${calls}\n\n## 证据门禁\n\n${guards}\n\n## 执行决策\n\n${execution}\n\n## 知识闭环\n\n${knowledgeLoop}\n\n## Maestro 提示词\n\n\`\`\`text\n${dispatch.maestro_prompt}\n\`\`\`\n`;
}
