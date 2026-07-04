export function buildExecutionDecision({ mode, guardReport, evidence = [], maestroCalls = [] } = {}) {
  const compatibility = evidence.find((item) => item.artifact_type === 'maestro_compatibility');
  const compatibilityStatus = compatibility?.evidence?.status || 'unknown';
  const compatible = compatibility?.evidence?.compatible === true;

  if (guardReport?.status === 'FAIL') {
    return makeDecision({
      status: 'blocked',
      reason: 'guard_report 为 FAIL，必须先修正失败证据。',
      mode,
      compatibilityStatus,
      maestroCalls
    });
  }

  if (compatibility && !compatible) {
    return makeDecision({
      status: 'blocked',
      reason: `Maestro 兼容性为 ${compatibilityStatus}，不能自动进入执行链。`,
      mode,
      compatibilityStatus,
      maestroCalls
    });
  }

  if (!compatibility) {
    return makeDecision({
      status: 'disabled',
      reason: '缺少 Maestro 兼容性 evidence，默认只生成 prompt 和调用链。',
      mode,
      compatibilityStatus,
      maestroCalls
    });
  }

  if (guardReport?.status !== 'PASS') {
    return makeDecision({
      status: 'disabled',
      reason: `guard_report 为 ${guardReport?.status || 'unknown'}，证据不足时不进入自动执行。`,
      mode,
      compatibilityStatus,
      maestroCalls
    });
  }

  return makeDecision({
    status: 'ready',
    reason: '证据、guard 和 Maestro 兼容性均满足，可进入 Maestro 调用链。',
    mode,
    compatibilityStatus,
    maestroCalls
  });
}

function makeDecision({ status, reason, mode, compatibilityStatus, maestroCalls }) {
  return {
    status,
    reason,
    mode,
    compatibility_status: compatibilityStatus,
    maestro_calls: maestroCalls.map((call) => ({
      skill: call.skill,
      mode: call.mode,
      optional: Boolean(call.optional)
    }))
  };
}
