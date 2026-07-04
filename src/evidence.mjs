export const EVIDENCE_STATUSES = ['PASS', 'PENDING', 'FAIL', 'WAIVED'];

export function normalizeEvidenceList(input = []) {
  if (!Array.isArray(input)) {
    throw new TypeError('evidence must be an array');
  }

  return input.map((item, index) => normalizeEvidence(item, index));
}

export function normalizeEvidence(item, index = 0) {
  if (!item || typeof item !== 'object') {
    throw new TypeError(`evidence[${index}] must be an object`);
  }

  const id = item.id || `evidence-${index + 1}`;
  const guardResults = Array.isArray(item.guard_results) ? item.guard_results : [];

  return {
    id,
    source: item.source || 'manual',
    artifact_type: item.artifact_type || 'note',
    path: item.path || null,
    summary: item.summary || '',
    guards: Array.isArray(item.guards) ? item.guards : [],
    evidence: item.evidence ?? null,
    guard_results: guardResults,
    next_steps: Array.isArray(item.next_steps) ? item.next_steps : []
  };
}

export function validateEvidence(item) {
  const missing = [];
  for (const field of ['id', 'source', 'artifact_type', 'summary']) {
    if (!item[field]) missing.push(field);
  }

  const invalidStatuses = [];
  for (const result of item.guard_results || []) {
    if (result?.status && !EVIDENCE_STATUSES.includes(result.status)) {
      invalidStatuses.push(result.status);
    }
  }

  return {
    ok: missing.length === 0 && invalidStatuses.length === 0,
    missing,
    invalidStatuses
  };
}

export function evidenceHas(evidenceList, predicate) {
  return evidenceList.some((item) => predicate(item));
}
