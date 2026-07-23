/**
 * Decide whether a recipe may proceed to write work based on guards and evidence only.
 * Host/tool availability is not a hard gate: agents work with available tools.
 */
export function buildExecutionDecision({ mode, guardReport, evidence = [], skillCalls = [] } = {}) {
  if (guardReport?.status === 'FAIL') {
    return makeDecision({
      status: 'blocked',
      reason: 'guard_report 为 FAIL，必须先修正失败证据。',
      mode,
      skillCalls
    });
  }

  if (guardReport?.status !== 'PASS') {
    return makeDecision({
      status: 'disabled',
      reason: `guard_report 为 ${guardReport?.status || 'unknown'}，证据不足时不进入自动执行。`,
      mode,
      skillCalls
    });
  }

  return makeDecision({
    status: 'ready',
    reason: '证据与 guard 均满足，可进入实施调用链。',
    mode,
    skillCalls
  });
}

function makeDecision({ status, reason, mode, skillCalls }) {
  return {
    status,
    reason,
    mode,
    skill_calls: skillCalls.map((call) => ({
      skill: call.skill,
      mode: call.mode,
      optional: Boolean(call.optional)
    }))
  };
}
