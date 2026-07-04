import { validateEvidence } from './evidence.mjs';

export const PROVIDER_SPECS = {
  yapi: {
    source: '$yapi',
    artifactType: 'yapi_contract',
    requiredFields: ['endpoint', 'method', 'request', 'response'],
    summary: (data) => `YApi contract ${data.method || ''} ${data.endpoint || ''} 已转换为 evidence。`.trim()
  },
  arms: {
    source: '$arms-fix',
    artifactType: 'arms_sls',
    requiredFields: ['fingerprint', 'time_window', 'root_cause'],
    summary: (data) => `ARMS/SLS 指纹 ${data.fingerprint || '(unknown)'} 已转换为 evidence。`
  },
  zentao: {
    source: '$sd-zentao-cli',
    artifactType: 'zentao_task',
    requiredFields: ['task_id', 'title', 'status'],
    summary: (data) => `禅道任务 ${data.task_id || '(unknown)'} 已转换为 evidence。`
  }
};

export function buildProviderEvidence(providerName, rawOutput, { id } = {}) {
  const provider = normalizeProviderName(providerName);
  const spec = PROVIDER_SPECS[provider];
  if (!spec) {
    throw new Error(`Unknown evidence provider: ${providerName}`);
  }

  const payload = parseProviderOutput(rawOutput);
  if (!payload.ok) {
    return makeEvidence({
      id: id || `${provider}-provider-failure`,
      source: spec.source,
      artifact_type: 'provider_failure',
      summary: `${provider} 工具失败：${payload.error || 'unknown error'}。`,
      evidence: {
        provider,
        status: 'FAIL',
        error: payload.error,
        raw: payload.raw
      },
      guardStatus: 'FAIL',
      next_steps: [`修复 ${provider} 工具调用后重新采集 evidence。`]
    });
  }

  const data = normalizeData(payload.data);
  const missingFields = spec.requiredFields.filter((field) => isMissing(data[field]));
  if (missingFields.length) {
    return makeEvidence({
      id: id || `${provider}-provider-partial`,
      source: spec.source,
      artifact_type: 'provider_partial',
      summary: `${provider} 输出不完整，缺少字段：${missingFields.join(', ')}。`,
      evidence: {
        provider,
        status: 'PENDING',
        data,
        missing_fields: missingFields,
        required_fields: spec.requiredFields
      },
      guardStatus: 'PENDING',
      next_steps: [`补齐 ${provider} 输出字段：${missingFields.join(', ')}。`]
    });
  }

  return makeEvidence({
    id: id || `${provider}-${spec.artifactType}`,
    source: spec.source,
    artifact_type: spec.artifactType,
    summary: spec.summary(data),
    evidence: {
      provider,
      status: 'PASS',
      data
    },
    guardStatus: 'PASS'
  });
}

export function buildProviderEvidenceBatch(fixtures) {
  if (!fixtures || typeof fixtures !== 'object') {
    throw new TypeError('fixtures must be an object keyed by provider name');
  }

  return Object.entries(fixtures).flatMap(([provider, cases]) => {
    return Object.entries(cases || {}).map(([caseName, rawOutput]) => {
      return buildProviderEvidence(provider, rawOutput, { id: `${provider}-${caseName}` });
    });
  });
}

function makeEvidence({ id, source, artifact_type, summary, evidence, guardStatus, next_steps = [] }) {
  const item = {
    id,
    source,
    artifact_type,
    summary,
    evidence,
    guard_results: [
      {
        id: 'provider-output',
        status: guardStatus,
        reason: summary
      }
    ],
    next_steps
  };

  const validation = validateEvidence(item);
  if (!validation.ok) {
    throw new Error(`Invalid evidence from provider adapter: ${validation.missing.join(', ') || validation.invalidStatuses.join(', ')}`);
  }

  return item;
}

function parseProviderOutput(rawOutput) {
  if (typeof rawOutput === 'string') {
    try {
      return parseProviderOutput(JSON.parse(rawOutput));
    } catch {
      return { ok: false, error: 'provider output is not valid JSON', raw: rawOutput };
    }
  }

  if (!rawOutput || typeof rawOutput !== 'object') {
    return { ok: false, error: 'provider output must be an object', raw: rawOutput };
  }

  if (rawOutput.ok === false || rawOutput.status === 'error' || rawOutput.exitCode > 0) {
    return {
      ok: false,
      error: rawOutput.error || rawOutput.message || `exitCode ${rawOutput.exitCode}`,
      raw: rawOutput
    };
  }

  return {
    ok: true,
    data: rawOutput.data ?? rawOutput.evidence ?? rawOutput
  };
}

function normalizeProviderName(providerName) {
  return String(providerName || '').trim().toLowerCase();
}

function normalizeData(data) {
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

function isMissing(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && !value.trim()) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value).length === 0) return true;
  return false;
}
