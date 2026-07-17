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
  same: {
    mode: 'same',
    id: 'cross-project-same',
    title: '同源项目迁移与持续同步',
    summary: '基于会话、需求、handoff snapshot、分支或 commit，在同源分叉项目间首次迁移或按基线持续同步；多项目编排交给 $jj-dispatch。',
    routeHints: [
      'same', '迁移', '同源', '同步', 'handoff', 'snapshot', 'sync_key', '持续同步',
      '准备交接', '更新交接', '项目族', 'port', 'migrate', 'sync'
    ],
    maestroCalls: [
      { skill: '$maestro-analyze', mode: 'analysis', purpose: '建立源变更地图、需求账本与目标能力矩阵。' },
      { skill: '$maestro-blueprint', mode: 'analysis', optional: true, purpose: '首次迁移或需求变化时生成可追溯 BLP/REQ。' },
      { skill: '$maestro-plan', mode: 'analysis', purpose: '在 EXECUTION_READY 后生成最窄实施计划。' },
      { skill: '$maestro-execute', mode: 'write', purpose: '按目标原生架构实施最小化补丁。' },
      { skill: '$quality-review', mode: 'analysis', purpose: '审查风险、剃刀范围与缺失证据。' },
      { skill: '$quality-test', mode: 'analysis', purpose: '聚焦验证；运行时验收保持 PENDING 或 N/A。' },
      { skill: '$manage-knowhow-capture', mode: 'write', optional: true, purpose: '稳定迁移规则可沉淀为 arch spec 或 knowhow。' }
    ],
    evidenceChecklist: [
      'user_intent',
      'source_materials',
      'handoff_snapshot',
      'source_commit',
      'target_analysis',
      'migration_matrix',
      'acceptance',
      'test_result',
      'review_result'
    ],
    guards: [
      'evidence-not-guessed',
      'source-materials-discovered',
      'blocking-decisions-isolated',
      'maestro-chain-ready',
      'tests-planned'
    ],
    inputPolicy: [
      '不要要求用户先传固定 CLI 参数；会话 ID、路径、源/目标可用自然语言给出。',
      '区分 EXECUTION_READY 与 HANDOFF_READY；不得用交接完成证据阻塞可实施迁移。',
      '多项目调度身份交给 $jj-dispatch；本入口只做迁移、差异适配与同步检查点。',
      '全部流程禁止调用 maestro explore；代码与资料定位使用 Read、Glob、Grep、Bash 或已批准的 Maestro skill。'
    ],
    promptFocus: [
      '先锁定源、目标、授权范围与证据入口，再生成迁移矩阵。',
      '复用共享 handoff / BLP/REQ，目标独立做 ANL-TARGET 与实施。',
      '五项门禁：稳健、剃刀、精准、最小化、复用。',
      '禁止使用 maestro explore；没有证据的结论保持 PENDING。',
      'jj-flow 是项目族编排工作流：本入口负责迁移协议与证据门禁；可调用 Maestro skill，但不重写其执行引擎。'
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
