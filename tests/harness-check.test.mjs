import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { checkHarnessRepository, HARNESS_SCHEMA_VERSION } from '../scripts/check-harness.mjs';

test('current repository satisfies the Harness manifest', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'harness-manifest.json'), 'utf8'));
  const result = checkHarnessRepository();
  assert.ok(manifest.record_system.forbidden_paths.includes('.workflow'));
  assert.equal(fs.existsSync(path.join(process.cwd(), '.workflow')), false);
  assert.equal(result.ok, true, JSON.stringify(result.findings, null, 2));
  assert.equal(result.status, 'PASS');
  assert.ok(result.stats.files_checked > 0);
  assert.ok(result.stats.links_checked > 0);
  assert.equal(result.stats.protocols_checked, 1);
  assert.equal(result.stats.scenarios_checked, 4);
  assert.equal(result.stats.host_trials_checked, 1);
  assert.equal(result.stats.gc_baselines_checked, 1);
});

test('Harness check rejects a forbidden local state path', () => {
  withTemporaryManifest((manifest) => {
    manifest.record_system.forbidden_paths = ['package.json'];
  }, (manifestPath) => {
    const result = checkHarnessRepository({ manifestPath });
    assert.equal(result.ok, false);
    assert.ok(result.findings.some((finding) => finding.rule_id === 'HNS-STATE-001' && finding.path === 'package.json'));
  });
});

test('Harness check reports broken navigation with remediation', () => {
  withTemporaryManifest((manifest) => {
    manifest.required_links[0].contains = 'missing-harness-navigation-target';
  }, (manifestPath) => {
    const result = checkHarnessRepository({ manifestPath });
    const finding = result.findings.find((item) => item.rule_id === 'HNS-LINK-002');
    assert.ok(finding);
    assert.ok(finding.next_action);
  });
});

test('Harness check enforces map size and protocol version', () => {
  withTemporaryManifest((manifest) => {
    manifest.schema_version = 'jj-flow/harness/0.0';
    manifest.record_system.maps[0].max_lines = 1;
  }, (manifestPath) => {
    const result = checkHarnessRepository({ manifestPath });
    assert.equal(HARNESS_SCHEMA_VERSION, 'jj-flow/harness/1.0');
    assert.ok(result.findings.some((finding) => finding.rule_id === 'HNS-SCHEMA-001'));
    assert.ok(result.findings.some((finding) => finding.rule_id === 'HNS-MAP-002'));
  });
});

test('Harness check rejects runtime and structured contract enum drift', () => {
  withTemporaryManifest((manifest, tempDir) => {
    const source = path.join(process.cwd(), manifest.protocol_contracts[0].contract);
    const contract = JSON.parse(fs.readFileSync(source, 'utf8'));
    contract.action_types = ['CREATE_THREAD'];
    const target = path.join(tempDir, 'host-action-contract.json');
    fs.writeFileSync(target, `${JSON.stringify(contract, null, 2)}\n`, 'utf8');
    manifest.protocol_contracts[0].contract = repositoryRelative(target);
  }, (manifestPath) => {
    const result = checkHarnessRepository({ manifestPath });
    assert.equal(result.ok, false);
    assert.ok(result.findings.some((finding) => finding.rule_id === 'HNS-PROTOCOL-PARITY-001'));
  });
});

test('Harness check rejects host action fixture policy drift', () => {
  withTemporaryManifest((manifest, tempDir) => {
    const source = path.join(process.cwd(), manifest.protocol_contracts[0].fixture);
    const fixture = JSON.parse(fs.readFileSync(source, 'utf8'));
    fixture.actions[0].sandbox_mode = 'workspace-write';
    const target = path.join(tempDir, 'dispatch-host-actions.json');
    fs.writeFileSync(target, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
    manifest.protocol_contracts[0].fixture = repositoryRelative(target);
  }, (manifestPath) => {
    const result = checkHarnessRepository({ manifestPath });
    assert.equal(result.ok, false);
    assert.ok(result.findings.some((finding) => finding.rule_id === 'HNS-FIXTURE-PARITY-003'));
  });
});

test('Harness check rejects scenario registry drift', () => {
  withTemporaryManifest((manifest) => {
    manifest.scenarios.entries.pop();
  }, (manifestPath) => {
    const result = checkHarnessRepository({ manifestPath });
    assert.equal(result.ok, false);
    assert.ok(result.findings.some((finding) => finding.reason.includes('scenario registry ids')));
  });
});

test('Harness check requires isolated side-effect-free scenarios', () => {
  withTemporaryManifest((manifest) => {
    manifest.scenarios.entries[0].side_effects = 'host-write';
  }, (manifestPath) => {
    const result = checkHarnessRepository({ manifestPath });
    assert.equal(result.ok, false);
    assert.ok(result.findings.some((finding) => finding.rule_id === 'HNS-SCENARIO-006'));
  });
});

test('Harness check rejects stale host trial evidence', () => {
  withTemporaryManifest((manifest, tempDir) => {
    const source = path.join(process.cwd(), manifest.host_trial.evidence);
    const evidence = JSON.parse(fs.readFileSync(source, 'utf8'));
    evidence.runner_sha256 = `sha256:${'0'.repeat(64)}`;
    const target = path.join(tempDir, 'm7-host-trial.json');
    fs.writeFileSync(target, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    manifest.host_trial.evidence = repositoryRelative(target);
  }, (manifestPath) => {
    const result = checkHarnessRepository({ manifestPath });
    assert.equal(result.ok, false);
    assert.ok(result.findings.some((finding) => finding.rule_id === 'HNS-HOST-TRIAL-008'));
  });
});

test('Harness check rejects a stale Harness GC baseline', () => {
  withTemporaryManifest((manifest, tempDir) => {
    const source = path.join(process.cwd(), manifest.maintenance.gc.baseline);
    const baseline = JSON.parse(fs.readFileSync(source, 'utf8'));
    baseline.runner_sha256 = `sha256:${'0'.repeat(64)}`;
    const target = path.join(tempDir, 'h5-gc-baseline.json');
    fs.writeFileSync(target, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
    manifest.maintenance.gc.baseline = repositoryRelative(target);
  }, (manifestPath) => {
    const result = checkHarnessRepository({ manifestPath });
    assert.equal(result.ok, false);
    assert.ok(result.findings.some((finding) => finding.rule_id === 'HNS-GC-008'));
  });
});

test('Harness check rejects a removed entrypoint presented as current', () => {
  withTemporaryManifest((manifest, tempDir) => {
    const currentDoc = path.join(tempDir, 'current-command.md');
    fs.writeFileSync(currentDoc, '# 当前命令\n\n使用 `$jj-delivery` 完成交付。\n', 'utf8');
    manifest.documentation_policy.current_files.push(repositoryRelative(currentDoc));
  }, (manifestPath) => {
    const result = checkHarnessRepository({ manifestPath });
    assert.equal(result.ok, false);
    assert.ok(result.findings.some((finding) => finding.rule_id === 'HNS-DOC-FRESHNESS-001'));
  });
});

test('Harness check requires every design doc to be indexed and built', () => {
  withTemporaryManifest((manifest, tempDir) => {
    const designDir = path.join(tempDir, 'design-docs');
    fs.mkdirSync(designDir);
    fs.writeFileSync(path.join(designDir, 'index.md'), '# 设计文档\n', 'utf8');
    fs.writeFileSync(path.join(designDir, 'unindexed.md'), '# 未索引设计\n\n> 状态：Proposed\n', 'utf8');
    manifest.documentation_policy.design_docs.directory = repositoryRelative(designDir);
    manifest.documentation_policy.design_docs.index = repositoryRelative(path.join(designDir, 'index.md'));
  }, (manifestPath) => {
    const result = checkHarnessRepository({ manifestPath });
    assert.equal(result.ok, false);
    assert.ok(result.findings.some((finding) => finding.rule_id === 'HNS-DESIGN-INDEX-001'));
    assert.ok(result.findings.some((finding) => finding.rule_id === 'HNS-DESIGN-BUILD-001'));
  });
});

test('Harness check requires Implemented design evidence', () => {
  withTemporaryManifest((manifest, tempDir) => {
    const designDir = path.join(tempDir, 'implemented-design');
    const designPath = path.join(designDir, 'finished.md');
    const indexPath = path.join(designDir, 'index.md');
    const builderPath = path.join(tempDir, 'build-docs.mjs');
    fs.mkdirSync(designDir);
    fs.writeFileSync(indexPath, '# 设计文档\n\n- [完成设计](finished.html)\n', 'utf8');
    fs.writeFileSync(designPath, '# 完成设计\n\n> 状态：Implemented\n', 'utf8');
    fs.writeFileSync(builderPath, `source: '${repositoryRelative(indexPath)}'\nsource: '${repositoryRelative(designPath)}'\n`, 'utf8');
    manifest.documentation_policy.design_docs.directory = repositoryRelative(designDir);
    manifest.documentation_policy.design_docs.index = repositoryRelative(indexPath);
    manifest.documentation_policy.site_builder = repositoryRelative(builderPath);
  }, (manifestPath) => {
    const result = checkHarnessRepository({ manifestPath });
    assert.equal(result.ok, false);
    assert.ok(result.findings.some((finding) => finding.rule_id === 'HNS-DESIGN-EVIDENCE-001'));
  });
});

function withTemporaryManifest(change, assertion) {
  const tempRoot = path.join(process.cwd(), '.tmp');
  fs.mkdirSync(tempRoot, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(tempRoot, 'harness-manifest-'));
  const manifestPath = path.join(tempDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'harness-manifest.json'), 'utf8'));
  change(manifest, tempDir);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  try {
    assertion(manifestPath, tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function repositoryRelative(file) {
  return path.relative(process.cwd(), file).replaceAll('\\', '/');
}
