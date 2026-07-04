export const TOOL_PROFILES = {
  yapi: {
    name: 'YApi contract fetcher',
    skill: '$yapi',
    npm: '@shendu-sdt/yapi-tool',
    evidenceTypes: ['yapi_contract', 'api_request', 'api_response']
  },
  arms: {
    name: 'ARMS/SLS inspector',
    skill: '$arms-fix',
    npm: '@shendu-sdt/arms-inspector',
    evidenceTypes: ['arms_sls', 'sls_log', 'error_fingerprint']
  },
  zentao: {
    name: 'ZenTao task helper',
    skill: '$sd-zentao-cli',
    npm: null,
    evidenceTypes: ['zentao_task', 'delivery_record', 'worklog']
  }
};

export const RECIPES = {
  delivery: {
    mode: 'delivery',
    id: 'minimal-input-delivery',
    title: '少参数端到端交付',
    summary: '用户只提供关键数据和关键决策，模型自动发现资料并编排 Maestro 完成交付。',
    routeHints: ['delivery', '交付', '端到端', '完整流程', 'PRD', 'prd', '接口文档', '设计图', 'codex://threads', 'Codex 线程', '自动推进', '关键决策', '精修'],
    maestroCalls: [
      { skill: '$maestro-analyze', mode: 'analysis', purpose: '自动发现当前项目、.workflow、PRD、接口文档、设计图、Codex 线程和既有证据。' },
      { skill: '$maestro-blueprint', mode: 'analysis', optional: true, purpose: '当规格缺口会影响实现时，补齐 Product Brief、PRD、Architecture 和 Epics。' },
      { skill: '$maestro-roadmap', mode: 'analysis', optional: true, purpose: '把大需求拆成可连续推进的 milestone 和 phase。' },
      { skill: '$maestro-plan', mode: 'analysis', purpose: '基于自动发现的上下文生成可验收执行计划和决策 gate。' },
      { skill: '$yapi', mode: 'analysis', optional: true, purpose: '涉及接口时拉取真实请求参数、返回值和字段约束。' },
      { skill: '$maestro-execute', mode: 'write', purpose: '按计划实现功能，遇到阻塞决策再询问用户。' },
      { skill: '$quality-review', mode: 'analysis', purpose: '审查风险、边界、回归点和缺失证据。' },
      { skill: '$quality-auto-test', mode: 'analysis', optional: true, purpose: '能自动化验证的部分补测试或运行目标测试。' },
      { skill: '$quality-test', mode: 'analysis', purpose: '按验收条件做最终验证，人工登录态或后端限制保持 PENDING。' },
      { skill: '$maestro-impeccable', mode: 'analysis', optional: true, purpose: '涉及设计稿还原或 UI 精修时，做视觉检查和修正建议。' },
      { skill: '$manage-knowhow-capture', mode: 'write', optional: true, purpose: '交付完成后沉淀可复用流程、证据和决策模板。' }
    ],
    evidenceChecklist: [
      'user_intent',
      'project_context',
      'source_materials',
      'api_contract',
      'design_reference',
      'acceptance',
      'decision_gate',
      'maestro_chain',
      'test_result',
      'delivery_record'
    ],
    guards: ['minimal-input-contract', 'source-materials-discovered', 'design-reference-ready', 'blocking-decisions-isolated', 'maestro-chain-ready', 'tests-planned'],
    inputPolicy: [
      '不要要求用户先传 --prd、--api、--design 等固定参数；资料路径可以自然写在需求里。',
      '先从当前项目、.workflow、用户消息、Codex 线程链接和已有文档中自动发现上下文。',
      '只在交付边界、方案取舍、上线风险或外部权限真正阻塞时询问用户。'
    ],
    promptFocus: [
      '先自动发现资料并生成 context package，不要把缺资料变成固定参数要求。',
      '把 PRD、接口文档、设计图、Codex 线程、测试和交付记录整理成 Maestro 可消费证据。',
      '用户只负责关键数据和关键决策，其它分析、计划、实现、审查、测试和精修由流程推进。',
      '保持 jj-flow 是 Maestro 上层协议：生成上下文、guard 和调用链，不重写 Maestro 执行引擎。',
      '没有证据的结论保持 PENDING，人工登录态、后端 guard 或截图验证要明确标出。'
    ]
  },
  validate: {
    mode: 'validate',
    id: 'project-self-validation',
    title: '项目管理者自检',
    summary: '检查 jj-flow 当前状态、文档与代码一致性、recipe/guard/测试覆盖和下一步升级建议。',
    routeHints: ['validate', '自检', '项目状态', '漂移', '一致性', '下一步', '升级建议', '路线图', 'roadmap'],
    maestroCalls: [
      { skill: '$maestro-analyze', mode: 'analysis', purpose: '读取当前项目、.workflow、路线图、文档、recipe、guard 和测试状态。' },
      { skill: '$quality-review', mode: 'analysis', purpose: '审查文档、代码、测试和发布门禁是否存在漂移。' },
      { skill: '$maestro-plan', mode: 'analysis', purpose: '基于自检证据生成下一步最小升级计划。' },
      { skill: '$quality-test', mode: 'analysis', purpose: '确认需要运行的验证命令和仍需人工确认的风险。' },
      { skill: '$manage-knowhow-capture', mode: 'write', optional: true, purpose: '把稳定的项目管理规则沉淀为 spec 或 knowhow。' }
    ],
    evidenceChecklist: [
      'project_state',
      'workflow_state',
      'docs_reference',
      'recipe_registry',
      'phase_readiness',
      'maestro_compatibility',
      'test_coverage',
      'verification_command',
      'next_recommendation'
    ],
    guards: ['project-state-readable', 'docs-code-aligned', 'phase-readiness-assessed', 'maestro-compatibility-reported', 'guard-tests-covered', 'roadmap-next-step-ready', 'evidence-not-guessed'],
    inputPolicy: [
      'validate 可以只给一句自检目标；默认检查当前 jj-flow 仓库状态。',
      '先读取项目现有文件、.workflow 和路线图，再判断是否需要用户补充决策。',
      '输出必须区分 PASS、PENDING、FAIL 和需要人工确认的项。'
    ],
    promptFocus: [
      '把 jj-flow 当作长期维护项目来检查，而不是只检查一次命令输出。',
      '优先发现文档、recipe、guard、测试、workflow 和路线图之间的漂移。',
      '下一步建议必须说明证据来源，并保持 Maestro 上层协议定位。',
      '能自动验证的部分列出命令；不能验证的部分保持 PENDING 或人工确认。'
    ]
  },
  evolve: {
    mode: 'evolve',
    id: 'project-evolution-manager',
    title: '项目自身迭代',
    summary: '把项目自检、路线图和用户反馈转换成 correction backlog、升级计划和 Maestro 调用链。',
    routeHints: ['evolve', '自我进化', '迭代', '升级项目', '项目管理者', '管理者', 'correction', 'backlog', '自我纠正', '长期规划'],
    maestroCalls: [
      { skill: '$maestro-analyze', mode: 'analysis', purpose: '读取 validate evidence、workflow state、路线图、文档和用户反馈。' },
      { skill: '$quality-review', mode: 'analysis', purpose: '确认 correction backlog 是否覆盖自检失败、漂移和 PENDING 风险。' },
      { skill: '$maestro-plan', mode: 'analysis', purpose: '把下一项升级拆成可验收计划和必须人工确认的决策 gate。' },
      { skill: '$maestro-execute', mode: 'write', purpose: '在计划和边界清晰后执行 jj-flow 自身功能迭代。' },
      { skill: '$quality-test', mode: 'analysis', purpose: '运行项目验证并确认新增能力没有破坏薄适配层边界。' },
      { skill: '$manage-knowhow-capture', mode: 'write', optional: true, purpose: '把稳定的管理规则沉淀为 spec、knowhow 或 workflow recipe。' }
    ],
    evidenceChecklist: [
      'validation_summary',
      'correction_backlog',
      'roadmap_alignment',
      'evolution_plan',
      'manager_boundary',
      'test_result'
    ],
    guards: ['self-validation-ready', 'correction-backlog-ready', 'evolution-plan-ready', 'manager-boundary-preserved', 'evidence-not-guessed', 'tests-planned'],
    inputPolicy: [
      'evolve 可以只给一句迭代目标；默认先复用 validate evidence，再决定修正或升级。',
      '如果存在 FAIL，优先生成 correction backlog；没有 FAIL 时推进 workflow 下一项 phase。',
      '只把必须改变项目方向、范围或外部依赖的决策交给用户。'
    ],
    promptFocus: [
      '先判断自检失败、文档/代码漂移和路线图下一步，不要直接发散做新功能。',
      '每个升级项都要有验收标准、验证命令或人工确认条件。',
      '保持 jj-flow 是 Maestro 上层协议：负责上下文、证据、guard 和调用链，不替代 Maestro 执行。',
      '完成后必须回到 validate 和 verify，形成自我验证、自我纠正、再升级的闭环。'
    ]
  },
  feat: {
    mode: 'feat',
    id: 'feature-delivery',
    title: '真实项目功能交付',
    summary: '从需求到接口、实现、验证、交付记录的完整功能开发链路。',
    routeHints: ['新增', '功能', '需求', '页面', '接口', '开发', '实现', 'feat', 'feature', 'yapi'],
    maestroCalls: [
      { skill: '$maestro-plan', mode: 'analysis', purpose: '把需求拆成可验收计划，并明确不做什么。' },
      { skill: '$yapi', mode: 'analysis', optional: true, purpose: '涉及接口时，拉取真实请求参数和返回值。' },
      { skill: '$maestro-execute', mode: 'write', purpose: '按已确认计划执行实现。' },
      { skill: '$quality-review', mode: 'analysis', purpose: '交付前审查风险、边界和回归点。' },
      { skill: '$quality-test', mode: 'analysis', purpose: '按验收条件验证实际效果。' },
      { skill: '$sd-zentao-cli', mode: 'analysis', optional: true, purpose: '同步任务状态、工时或交付记录。' }
    ],
    evidenceChecklist: [
      'project_scope',
      'acceptance',
      'yapi_contract',
      'design_reference',
      'test_plan',
      'test_result',
      'delivery_record'
    ],
    guards: ['scope-confirmed', 'evidence-not-guessed', 'yapi-contract-ready', 'design-reference-ready', 'tests-planned', 'delivery-recorded'],
    promptFocus: [
      '先确认真实项目、页面、组件、接口和验收边界。',
      '涉及接口字段时，以 YApi 或真实网络数据为准。',
      '实现后必须说明验证方式和未覆盖风险。',
      '可以沉淀为 knowhow 的部分要单独标记。'
    ]
  },
  fix: {
    mode: 'fix',
    id: 'online-fix',
    title: '线上问题定位与修复',
    summary: '从 ARMS/SLS 指纹到代码根因、最小修复、验证和归档。',
    routeHints: ['bug', 'fix', '报错', '异常', '线上', 'arms', 'sls', '500', 'error', '修复', '崩溃'],
    maestroCalls: [
      { skill: '$arms-fix', mode: 'analysis', purpose: '拉取 SLS/ARMS 证据并定位指纹。' },
      { skill: '$maestro-plan', mode: 'analysis', purpose: '把根因、修复范围、验证方式写成执行计划。' },
      { skill: '$maestro-execute', mode: 'write', purpose: '执行最小修复。' },
      { skill: '$quality-test', mode: 'analysis', purpose: '验证复现路径和回归点。' },
      { skill: '$manage-knowhow-capture', mode: 'analysis', optional: true, purpose: '把可复用排查路径沉淀。' }
    ],
    evidenceChecklist: [
      'arms_sls',
      'error_fingerprint',
      'reproduction',
      'root_cause',
      'test_result',
      'resolution'
    ],
    guards: ['arms-fingerprint-ready', 'root-cause-localized', 'evidence-not-guessed', 'tests-planned'],
    promptFocus: [
      '先拿真实日志、时间窗、app.id、URL 或用户路径，不能靠猜。',
      '回答必须包含根因机制、引入位置、修复位置。',
      '修复范围要尽量窄，避免误伤其它租户或页面。'
    ]
  },
  knowhow: {
    mode: 'knowhow',
    id: 'knowledge-harvest',
    title: '项目经验沉淀',
    summary: '把真实项目对话、提交、问题和方案转成可复用知识资产。',
    routeHints: ['总结', '沉淀', '复盘', '经验', '规范', '文档', 'knowhow', '学习', '知识'],
    maestroCalls: [
      { skill: '$maestro-learn', mode: 'analysis', purpose: '梳理代码、对话或交付过程中的稳定模式。' },
      { skill: '$codify-to-knowhow', mode: 'write', optional: true, purpose: '把结构化素材转换成 knowhow/spec 条目。' },
      { skill: '$spec-add', mode: 'write', optional: true, purpose: '记录明确规则或约束。' },
      { skill: '$manage-knowhow-capture', mode: 'write', purpose: '沉淀可复用模板、recipe 或经验。' }
    ],
    evidenceChecklist: [
      'dialogue_summary',
      'commit_diff',
      'problem_solution',
      'knowledge_target',
      'reuse_rule'
    ],
    guards: ['knowledge-target-clear', 'traceability-ready', 'evidence-not-guessed'],
    promptFocus: [
      '优先保留问题、约束、证据、解决方案，而不是泛泛总结。',
      '能变成工作流步骤的内容要标出触发条件和验收条件。',
      '结论要能被下次真实项目复用。'
    ]
  },
  review: {
    mode: 'review',
    id: 'delivery-review',
    title: '交付前质量审查',
    summary: '对计划、diff、测试和交付证据做最后审查。',
    routeHints: ['review', '审查', '风险', '质量', '检查', '验收', '测试', 'diff'],
    maestroCalls: [
      { skill: '$quality-review', mode: 'analysis', purpose: '优先找 bug、回归、边界和缺失测试。' },
      { skill: '$quality-test', mode: 'analysis', purpose: '补齐用户验收和自动验证。' },
      { skill: '$team-review', mode: 'analysis', optional: true, purpose: '复杂变更可引入多视角审查。' }
    ],
    evidenceChecklist: [
      'diff',
      'test_result',
      'risk_list',
      'acceptance',
      'release_note'
    ],
    guards: ['diff-reviewed', 'tests-planned', 'traceability-ready', 'evidence-not-guessed'],
    promptFocus: [
      '先列风险和缺陷，再给摘要。',
      '每个结论都要能追到文件、命令或验收证据。',
      '没有证据的 PASS 只能保持 PENDING。'
    ]
  }
};

export const MODES = ['auto', ...Object.keys(RECIPES)];

export function getRecipe(mode) {
  const recipe = RECIPES[mode];
  if (!recipe) {
    throw new Error(`Unknown jj mode: ${mode}`);
  }
  return recipe;
}
