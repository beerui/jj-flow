export const HANDOFF_SCHEMA_VERSION = 'jj-same/handoff-snapshot/1.0';

export function validateHandoffSnapshot(snapshot, schema) {
  const findings = [];
  const add = (ruleId, path, reason, nextAction) => findings.push({
    rule_id: ruleId,
    path,
    reason,
    next_action: nextAction
  });
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    add('HOF-STRUCTURE-001', '.', 'Handoff snapshot 必须是对象。', '提供符合 handoff snapshot schema 的 JSON 对象。');
    return result(findings);
  }
  const required = Array.isArray(schema?.required) ? schema.required : [];
  for (const field of required) {
    if (snapshot[field] === undefined || snapshot[field] === null) {
      add('HOF-REQUIRED-001', field, `缺少必填字段：${field}`, '按 handoff-snapshot.schema.json 补齐字段。');
    }
  }
  if (snapshot.schema_version !== HANDOFF_SCHEMA_VERSION) {
    add('HOF-VERSION-001', 'schema_version', `schema_version 必须为 ${HANDOFF_SCHEMA_VERSION}。`, '升级 snapshot 或使用匹配的 validator。');
  }
  if (!/^HOF-[A-Za-z0-9._-]+$/.test(String(snapshot.snapshot_id || ''))) {
    add('HOF-ID-001', 'snapshot_id', 'snapshot_id 格式无效。', '使用 HOF- 前缀和稳定标识。');
  }
  checkEnum(snapshot, schema, 'handoff_status', add);
  checkEnum(snapshot, schema, 'execution_readiness', add);
  checkEnum(snapshot, schema, 'seal_freshness', add);
  for (const field of ['anl_source_ref', 'blueprint_ref', 'family_plan_ref']) {
    if (!nonEmpty(snapshot.canonical?.[field])) add('HOF-CANONICAL-001', `canonical.${field}`, 'Canonical reference 不能为空。', '指向版本化源分析、蓝图或家族计划。');
  }
  if (!Array.isArray(snapshot.canonical?.requirement_refs) || snapshot.canonical.requirement_refs.length === 0) {
    add('HOF-CANONICAL-002', 'canonical.requirement_refs', '至少需要一个正式 requirement reference。', '登记版本化需求引用。');
  }

  const inventory = Array.isArray(snapshot.source_inventory) ? snapshot.source_inventory : [];
  const unresolved = Array.isArray(snapshot.requirement_ledger?.unresolved) ? snapshot.requirement_ledger.unresolved : [];
  if (snapshot.execution_readiness === 'READY') {
    if (inventory.some((item) => item?.status !== 'AVAILABLE')) add('HOF-READY-001', 'source_inventory', 'READY snapshot 的来源必须全部 AVAILABLE。', '恢复来源或将 execution_readiness 改为 BLOCKED。');
    if (unresolved.length) add('HOF-READY-002', 'requirement_ledger.unresolved', 'READY snapshot 不能包含未解决需求。', '解决歧义后生成 successor snapshot。');
    if (snapshot.verification?.commit_stable !== true || snapshot.verification?.static_checks !== 'PASS') {
      add('HOF-READY-003', 'verification', 'READY snapshot 需要稳定 commit 和 PASS static checks。', '完成最小验证或保持 BLOCKED。');
    }
  }
  if (snapshot.handoff_status === 'READY_FOR_HANDOFF') {
    if (snapshot.execution_readiness !== 'READY' || snapshot.seal_freshness !== 'FRESH') {
      add('HOF-HANDOFF-001', 'handoff_status', 'READY_FOR_HANDOFF 需要 READY execution 和 FRESH seal。', '刷新来源并重新封存 snapshot。');
    }
    if (snapshot.verification?.review !== 'PASS' || !['PASS', 'N/A'].includes(snapshot.verification?.user_test)) {
      add('HOF-HANDOFF-002', 'verification', 'READY_FOR_HANDOFF 需要 Review PASS 和 user test PASS/N/A。', '补齐验收证据后再宣告可交接。');
    }
  }
  return result(findings);
}

function checkEnum(snapshot, schema, field, add) {
  const allowed = schema?.properties?.[field]?.enum || [];
  if (!allowed.includes(snapshot[field])) add('HOF-ENUM-001', field, `${field} 不在 schema 枚举中。`, `使用：${allowed.join(', ')}`);
}

function result(findings) {
  return {
    ok: findings.length === 0,
    status: findings.length === 0 ? 'PASS' : 'FAIL',
    findings
  };
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
