import { evidenceHas, normalizeEvidenceList } from './evidence.mjs';

const GUARD_RULES = {
  'minimal-input-contract': {
    title: '少参数入口生效',
    pass: () => true,
    passReason: 'delivery 不要求固定 PRD、接口或设计参数。',
    pending: 'delivery 入口不应要求固定资料参数。'
  },
  'source-materials-discovered': {
    title: '项目资料已自动发现',
    pass: (items) => hasType(items, ['project_context', 'source_materials', 'prd_doc', 'api_contract', 'yapi_contract', 'design_reference', 'codex_thread', 'context_package']),
    pending: '仍需从项目、PRD、接口文档、设计图或 Codex 线程中自动发现资料。'
  },
  'blocking-decisions-isolated': {
    title: '只保留阻塞决策',
    pass: (items) => hasType(items, ['decision_gate', 'delivery_decision']),
    pending: '尚未整理哪些问题必须由用户拍板。'
  },
  'workflow-chain-ready': {
    title: '工作调用链已形成',
    pass: (items) => hasType(items, ['workflow_chain', 'context_package', 'plan']),
    pending: '尚未形成可消费的上下文包或调用链。'
  },
  'scope-confirmed': {
    title: '项目边界已确认',
    pass: (items) => hasType(items, ['project_scope', 'acceptance']),
    pending: '缺少项目范围或验收边界。'
  },
  'evidence-not-guessed': {
    title: '证据不是猜的',
    pass: (items) => items.length > 0 && items.every((item) => item.summary),
    pending: '缺少可追溯证据。'
  },
  'yapi-contract-ready': {
    title: '接口字段来自 YApi 或真实接口',
    pass: (items) => hasType(items, ['yapi_contract', 'api_request', 'api_response']) || hasSource(items, ['yapi', '$yapi', '@shendu-sdt/yapi-tool']),
    pending: '涉及接口时，仍需拉取真实请求参数和返回值。'
  },
  'design-reference-ready': {
    title: '设计证据已确认',
    pass: (items) => hasType(items, ['design_reference', 'ui_reference', 'screenshot', 'mastergo_design']),
    pending: '涉及界面交付时，仍需设计图、截图或 UI reference。'
  },
  'tests-planned': {
    title: '验证方式已明确',
    pass: (items) => hasType(items, ['test_plan', 'test_result']),
    pending: '缺少测试计划或验证结果。'
  },
  'delivery-recorded': {
    title: '交付记录可同步',
    pass: (items) => hasType(items, ['delivery_record', 'zentao_task', 'worklog']) || hasSource(items, ['zentao', '$sd-zentao-cli']),
    pending: '缺少禅道任务、工时或交付记录。'
  },
  'arms-fingerprint-ready': {
    title: '线上错误指纹已确认',
    pass: (items) => hasType(items, ['arms_sls', 'sls_log', 'error_fingerprint']) || hasSource(items, ['arms', '$arms-fix', '@shendu-sdt/arms-inspector']),
    pending: '缺少 ARMS/SLS 指纹证据。'
  },
  'root-cause-localized': {
    title: '根因已定位到代码或配置',
    pass: (items) => hasType(items, ['root_cause', 'blame', 'code_location']),
    pending: '缺少根因、责任代码或引入位置。'
  },
  'knowledge-target-clear': {
    title: '知识沉淀目标明确',
    pass: (items) => hasType(items, ['knowledge_target', 'problem_solution', 'reuse_rule']),
    pending: '缺少要沉淀成什么的明确目标。'
  },
  'diff-reviewed': {
    title: '变更已审查',
    pass: (items) => hasType(items, ['diff', 'review_result', 'risk_list']),
    pending: '缺少 diff、review 结果或风险清单。'
  },
  'traceability-ready': {
    title: '来源和验证可追溯',
    pass: (items) => hasType(items, ['source_materials', 'dialogue_summary', 'commit_diff', 'diff', 'test_result', 'review_result', 'problem_solution', 'release_note']),
    pending: '缺少来源、diff、测试、review 或复盘证据。'
  },
  'project-state-readable': {
    title: '项目状态可读取',
    fail: (items) => hasValidationFailure(items, ['project-state', 'workflow-state']),
    pass: (items) => hasType(items, ['project_state']) && hasType(items, ['workflow_state']),
    pending: '缺少 package.json 或版本化项目状态证据。'
  },
  'docs-code-aligned': {
    title: '文档与 recipe 对齐',
    fail: (items) => hasValidationFailure(items, ['docs-reference', 'recipe-registry']),
    pass: (items) => hasType(items, ['docs_reference']) && hasType(items, ['recipe_registry']),
    pending: '缺少命令文档、recipe 注册或源码文件对齐证据。'
  },
  'guard-tests-covered': {
    title: 'guard 与测试覆盖齐备',
    fail: (items) => hasValidationFailure(items, ['test-coverage', 'verification-command']),
    pass: (items) => hasType(items, ['test_coverage']) && hasType(items, ['verification_command']),
    pending: '缺少测试覆盖或 verify 脚本证据。'
  },
  'roadmap-next-step-ready': {
    title: '下一步升级建议明确',
    fail: (items) => hasValidationFailure(items, ['next-recommendation']),
    pass: (items) => hasType(items, ['next_recommendation']),
    pending: '缺少可追溯到 roadmap 或 workflow state 的下一步建议。'
  },
  'phase-readiness-assessed': {
    title: '当前 phase 成功标准已审计',
    pass: (items) => hasType(items, ['phase_readiness']),
    pending: '缺少当前 phase 成功标准的审计证据。'
  },
  'host-capability-reported': {
    title: '宿主能力已报告',
    pass: (items) => hasType(items, ['host_capability', 'tool_compatibility']),
    pending: '缺少宿主或工具可用性报告。'
  },
  'self-validation-ready': {
    title: '已复用项目自检',
    pass: (items) => hasType(items, ['validation_summary']),
    pending: '缺少 validate evidence 汇总，不能直接进入项目自身迭代。'
  },
  'correction-backlog-ready': {
    title: '修正 backlog 已生成',
    pass: (items) => hasType(items, ['correction_backlog']),
    pending: '缺少从自检结果转换出的 correction backlog。'
  },
  'evolution-plan-ready': {
    title: '升级计划已形成',
    fail: (items) => hasValidationFailure(items, ['roadmap-alignment']),
    pass: (items) => hasType(items, ['evolution_plan']) && hasType(items, ['roadmap_alignment']),
    pending: '缺少可追溯到路线图的升级计划。'
  },
  'manager-boundary-preserved': {
    title: '管理者边界保持清晰',
    pass: (items) => hasType(items, ['manager_boundary']),
    pending: '缺少管理者边界证据：不重写外部执行引擎、不扩大授权范围。'
  }
};

export function buildGuardReport(recipe, evidence = []) {
  const items = normalizeEvidenceList(evidence);
  const results = recipe.guards.map((guardId) => evaluateGuard(guardId, items));
  const status = results.some((result) => result.status === 'FAIL')
    ? 'FAIL'
    : results.every((result) => result.status === 'PASS') ? 'PASS' : 'PENDING';

  return { status, results };
}

export function evaluateGuard(guardId, items) {
  const rule = GUARD_RULES[guardId];
  if (!rule) {
    return {
      id: guardId,
      title: guardId,
      status: 'PENDING',
      reason: '未知 guard，不能自动通过。'
    };
  }

  if (rule.fail?.(items)) {
    return {
      id: guardId,
      title: rule.title,
      status: 'FAIL',
      reason: rule.failReason || '发现失败证据，不能自动通过。'
    };
  }

  const passed = rule.pass(items);
  return {
    id: guardId,
    title: rule.title,
    status: passed ? 'PASS' : 'PENDING',
    reason: passed ? (rule.passReason || '证据满足要求。') : rule.pending
  };
}

function hasType(items, types) {
  return evidenceHas(items, (item) => types.includes(item.artifact_type));
}

function hasSource(items, sources) {
  return evidenceHas(items, (item) => sources.includes(item.source));
}

function hasValidationFailure(items, ids) {
  return evidenceHas(items, (item) => item.artifact_type === 'validation_failure' && ids.includes(item.id));
}
