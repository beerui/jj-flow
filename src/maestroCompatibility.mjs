import { spawnSync } from 'node:child_process';

export const MIN_MAESTRO_VERSION = '0.5.0';

export function buildMaestroCompatibilityEvidence({ runCommand = defaultRunCommand } = {}) {
  const result = runCommand('maestro', ['--version']);
  if (result.errorCode === 'ENOENT') {
    return compatibilityEvidence({
      status: 'missing',
      compatible: false,
      summary: 'Maestro CLI 未安装或不在 PATH 中。',
      output: result.output,
      error: result.error
    });
  }

  if (result.errorCode === 'EPERM') {
    return compatibilityEvidence({
      status: 'blocked',
      compatible: false,
      summary: '当前执行环境阻止 Maestro CLI 版本检查。',
      output: result.output,
      error: result.error
    });
  }

  if (result.status !== 0) {
    return compatibilityEvidence({
      status: 'unavailable',
      compatible: false,
      summary: 'Maestro CLI 可调用但版本检查失败。',
      output: result.output,
      error: result.error
    });
  }

  const version = parseVersion(result.output);
  if (!version) {
    return compatibilityEvidence({
      status: 'unknown',
      compatible: false,
      summary: 'Maestro CLI 可调用，但无法解析版本号。',
      output: result.output,
      error: result.error
    });
  }

  const compatible = compareVersions(version, MIN_MAESTRO_VERSION) >= 0;
  return compatibilityEvidence({
    status: compatible ? 'compatible' : 'incompatible',
    compatible,
    version,
    summary: compatible
      ? `Maestro CLI ${version} 可用，满足最低版本 ${MIN_MAESTRO_VERSION}。`
      : `Maestro CLI ${version} 低于最低版本 ${MIN_MAESTRO_VERSION}。`,
    output: result.output,
    error: result.error
  });
}

function compatibilityEvidence({ status, compatible, version = null, summary, output = '', error = '' }) {
  return {
    id: 'maestro-compatibility',
    source: '$jj validate',
    artifact_type: 'maestro_compatibility',
    path: null,
    summary,
    evidence: {
      status,
      compatible,
      version,
      min_version: MIN_MAESTRO_VERSION,
      output,
      error
    },
    next_steps: compatible ? [] : ['安装或升级 Maestro CLI 后重新运行 $jj validate。']
  };
}

function defaultRunCommand(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return {
    status: result.status,
    output: `${result.stdout || ''}${result.stderr || ''}`.trim(),
    error: result.error?.message || '',
    errorCode: result.error?.code || null
  };
}

function parseVersion(output) {
  const match = String(output || '').match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? match[0] : null;
}

function compareVersions(a, b) {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);

  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return 1;
    if (left[index] < right[index]) return -1;
  }

  return 0;
}
