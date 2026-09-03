import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  checkCiLabRoots,
  checkHarnessRepository,
  checkPublishLabs,
  gitignoreForbidsLabsMaterialized,
  gitignoreIgnoresLabRootsJson,
  HARNESS_SCHEMA_VERSION,
  isForbiddenLabsPublishEntry,
  packStdoutContainsLabs,
  prepareLabRootsActionCoversSiblings,
  workflowCallsPrepareLabRoots
} from '../scripts/check-harness.mjs';

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
  assert.equal(result.stats.gardeners_checked, 1);
  assert.ok(result.stats.exec_plans_checked > 0);
  assert.equal(result.stats.maturity_models_checked, 1);
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

test('Harness check requires every design doc to be indexed', () => {
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
  });
});

test('Harness check requires Implemented design evidence', () => {
  withTemporaryManifest((manifest, tempDir) => {
    const designDir = path.join(tempDir, 'implemented-design');
    const designPath = path.join(designDir, 'finished.md');
    const indexPath = path.join(designDir, 'index.md');
    fs.mkdirSync(designDir);
    fs.writeFileSync(indexPath, '# 设计文档\n\n- [完成设计](finished.md)\n', 'utf8');
    fs.writeFileSync(designPath, '# 完成设计\n\n> 状态：Implemented\n', 'utf8');
    manifest.documentation_policy.design_docs.directory = repositoryRelative(designDir);
    manifest.documentation_policy.design_docs.index = repositoryRelative(indexPath);
  }, (manifestPath) => {
    const result = checkHarnessRepository({ manifestPath });
    assert.equal(result.ok, false);
    assert.ok(result.findings.some((finding) => finding.rule_id === 'HNS-DESIGN-EVIDENCE-001'));
  });
});

test('Harness check requires every exec plan to be indexed and stored under the matching status directory', () => {
  withTemporaryManifest((manifest, tempDir) => {
    const planDir = path.join(tempDir, 'exec-plans');
    const activeDir = path.join(planDir, 'active');
    const completedDir = path.join(planDir, 'completed');
    const indexPath = path.join(planDir, 'index.md');
    const planPath = path.join(activeDir, 'unindexed.md');
    fs.mkdirSync(activeDir, { recursive: true });
    fs.mkdirSync(completedDir, { recursive: true });
    fs.writeFileSync(indexPath, '# 执行计划\n', 'utf8');
    fs.writeFileSync(planPath, '# 未索引计划\n\n> 状态：completed\n', 'utf8');
    manifest.documentation_policy.exec_plans = {
      ...manifest.documentation_policy.exec_plans,
      directory: repositoryRelative(planDir),
      index: repositoryRelative(indexPath),
      active_directory: repositoryRelative(activeDir),
      completed_directory: repositoryRelative(completedDir)
    };
  }, (manifestPath) => {
    const result = checkHarnessRepository({ manifestPath });
    assert.equal(result.ok, false);
    assert.ok(result.findings.some((finding) => finding.rule_id === 'HNS-EXEC-PLAN-INDEX-001'));
    assert.ok(result.findings.some((finding) => finding.rule_id === 'HNS-EXEC-PLAN-STATUS-002'));
  });
});

test('Harness check rejects maturity scores outside the declared scale and document drift', () => {
  withTemporaryManifest((manifest, tempDir) => {
    const maturityPath = path.join(tempDir, 'maturity.md');
    fs.writeFileSync(maturityPath, '# 成熟度\n\n| 维度 | 当前 |\n| --- | ---: |\n| 可重放反馈 | 4 |\n', 'utf8');
    manifest.documentation_policy.maturity_models = [{
      id: 'temporary-maturity',
      path: repositoryRelative(maturityPath),
      minimum: 0,
      maximum: 3,
      dimensions: [{ label: '可重放反馈', score: 3 }]
    }];
  }, (manifestPath) => {
    const result = checkHarnessRepository({ manifestPath });
    assert.equal(result.ok, false);
    assert.ok(result.findings.some((finding) => finding.rule_id === 'HNS-MATURITY-SCORE-002'));
    assert.ok(result.findings.some((finding) => finding.rule_id === 'HNS-MATURITY-ROW-002'));
  });
});

test('Harness check rejects Gardener code-write permission and workflow contract drift', () => {
  withTemporaryManifest((manifest, tempDir) => {
    const workflowPath = path.join(tempDir, 'harness-gardener.yml');
    const source = fs.readFileSync(path.join(process.cwd(), manifest.maintenance.gardener.workflow), 'utf8')
      .replace('contents: read', 'contents: write')
      .replace('issues: write', 'issues: read')
      .replace('actions/github-script@v7', 'actions/not-github-script@v7');
    fs.writeFileSync(workflowPath, source, 'utf8');
    manifest.maintenance.gardener.workflow = repositoryRelative(workflowPath);
  }, (manifestPath) => {
    const result = checkHarnessRepository({ manifestPath });
    assert.equal(result.ok, false);
    assert.ok(result.findings.some((finding) => finding.rule_id === 'HNS-GARDENER-005'));
    assert.ok(result.findings.some((finding) => finding.rule_id === 'HNS-GARDENER-006'));
  });
});

test('Harness check rejects Gardener permissions outside the explicit allowlist', () => {
  withTemporaryManifest((manifest, tempDir) => {
    const workflowPath = path.join(tempDir, 'harness-gardener.yml');
    const source = fs.readFileSync(path.join(process.cwd(), manifest.maintenance.gardener.workflow), 'utf8')
      .replace('  issues: write', '  issues: write\n  pull-requests: write');
    fs.writeFileSync(workflowPath, source, 'utf8');
    manifest.maintenance.gardener.workflow = repositoryRelative(workflowPath);
  }, (manifestPath) => {
    const result = checkHarnessRepository({ manifestPath });
    assert.equal(result.ok, false);
    assert.ok(result.findings.some((finding) => finding.rule_id === 'HNS-GARDENER-006'));
  });
});

test('HNS-PUBLISH-LABS rejects labs/ in package files and gitignore materialized path', () => {
  assert.equal(isForbiddenLabsPublishEntry('labs'), true);
  assert.equal(isForbiddenLabsPublishEntry('labs/'), true);
  assert.equal(isForbiddenLabsPublishEntry('labs/loop-gym'), true);
  assert.equal(isForbiddenLabsPublishEntry('skills/'), false);
  assert.equal(isForbiddenLabsPublishEntry('docs/'), false);
  assert.equal(gitignoreForbidsLabsMaterialized('node_modules/\nlabs/_materialized/\n'), true);
  assert.equal(gitignoreForbidsLabsMaterialized('node_modules/\nlab-roots.json\n'), false);
  assert.equal(gitignoreIgnoresLabRootsJson('lab-roots.json\n'), true);
  assert.equal(gitignoreIgnoresLabRootsJson('# lab-roots.json\n'), false);
  assert.equal(packStdoutContainsLabs('npm notice docs/design-docs/jj-flow-labs.md\n'), false);
  assert.equal(packStdoutContainsLabs('npm notice labs/loop-gym/package.json\n'), true);

  const findings = [];
  checkPublishLabs({
    cwd: process.cwd(),
    packageJson: { files: ['skills/', 'labs/', 'docs/'] },
    addFinding: (ruleId, targetPath, reason, nextAction) => {
      findings.push({ rule_id: ruleId, path: targetPath, reason, nextAction });
    },
    runPack: false
  });
  assert.ok(findings.some((item) => item.rule_id === 'HNS-PUBLISH-LABS' && /labs\//.test(item.reason)));
});

test('HNS-CI-LAB-ROOTS requires sibling clone action and verify workflows', () => {
  assert.equal(prepareLabRootsActionCoversSiblings('github.com/beerui/jj-lab-loop\n'), false);
  assert.equal(prepareLabRootsActionCoversSiblings([
    'github.com/beerui/jj-lab-loop',
    'github.com/beerui/jj-lab-family',
    'JJ_LAB_LOOP_ROOT',
    'JJ_LAB_FAMILY_ROOT',
    'JJ_FLOW_ROOT',
    'RUNNER_TEMP'
  ].join('\n')), true);
  assert.equal(workflowCallsPrepareLabRoots('uses: ./.github/actions/prepare-lab-roots\n'), true);
  assert.equal(workflowCallsPrepareLabRoots('run: npm run verify\n'), false);

  const findings = [];
  checkCiLabRoots({
    cwd: process.cwd(),
    addFinding: (ruleId, targetPath, reason, nextAction) => {
      findings.push({ rule_id: ruleId, path: targetPath, reason, nextAction });
    }
  });
  assert.equal(findings.length, 0, JSON.stringify(findings, null, 2));
});

test('current package.json files does not publish labs/', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.equal(Array.isArray(pkg.files) && pkg.files.some(isForbiddenLabsPublishEntry), false);
  const gi = fs.readFileSync(path.join(process.cwd(), '.gitignore'), 'utf8');
  assert.equal(gitignoreForbidsLabsMaterialized(gi), false);
  assert.equal(gitignoreIgnoresLabRootsJson(gi), true);
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
