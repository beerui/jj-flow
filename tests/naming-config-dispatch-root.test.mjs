import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  defaultDispatchControlRoot,
  describePathConfig,
  ensureDispatchControlRoot,
  expandUserPath,
  resolveDeliveryManifestPath,
  resolveDispatchControlRoot,
  resolveKnowledgeRoot,
  resolvePortfolioRoot
} from '../src/namingConfig.mjs';

function withEnv(envPatch, fn) {
  const prev = {};
  for (const key of Object.keys(envPatch)) {
    prev[key] = process.env[key];
    if (envPatch[key] === undefined) delete process.env[key];
    else process.env[key] = envPatch[key];
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(envPatch)) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  }
}

test('defaultDispatchControlRoot is ~/.jj-flow', () => {
  assert.equal(defaultDispatchControlRoot(), path.join(os.homedir(), '.jj-flow'));
  assert.equal(expandUserPath('~/.jj-flow'), path.join(os.homedir(), '.jj-flow'));
});

test('resolveDispatchControlRoot defaults to ~/.jj-flow when no env override', () => {
  withEnv({
    JJ_DISPATCH_CONTROL_ROOT: undefined,
    JJ_GLOBAL_CONFIG_DIR: path.join(os.tmpdir(), 'jj-no-config-dir-missing')
  }, () => {
    const root = resolveDispatchControlRoot({
      configDir: path.join(os.tmpdir(), 'jj-no-config-dir-missing')
    });
    assert.equal(root, path.join(os.homedir(), '.jj-flow'));
  });
});

test('ensureDispatchControlRoot creates home .jj-flow layout', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ensure-home-'));
  const root = ensureDispatchControlRoot({ explicit: path.join(tmp, '.jj-flow') });
  assert.ok(fs.existsSync(root));
  assert.ok(fs.existsSync(path.join(root, 'README.md')));
  assert.ok(fs.existsSync(path.join(root, '.workflow', 'dispatch')));
  assert.ok(fs.existsSync(path.join(root, '.workflow', 'tasks')));
});

test('JJ_DISPATCH_CONTROL_ROOT wins over defaults', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-dispatch-env-'));
  const target = path.join(tmp, 'custom-control');
  withEnv({ JJ_DISPATCH_CONTROL_ROOT: target }, () => {
    assert.equal(resolveDispatchControlRoot(), path.resolve(target));
  });
});

test('naming.json dispatch.control_root is expanded and used', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-naming-cfg-'));
  const control = path.join(tmp, 'dispatch-control');
  const portfolio = path.join(tmp, 'portfolio');
  fs.mkdirSync(path.join(tmp, 'config'), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, 'config', 'naming.json'),
    JSON.stringify({
      schema_version: 'jj-flow/naming/1.0',
      project_map: path.join(portfolio, 'map.md').replaceAll('\\', '/'),
      dispatch: {
        portfolio_root: portfolio.replaceAll('\\', '/'),
        control_root: control.replaceAll('\\', '/'),
        knowledge_root: path.join(portfolio, 'knowledge').replaceAll('\\', '/')
      }
    }),
    'utf8'
  );
  withEnv({
    JJ_DISPATCH_CONTROL_ROOT: undefined,
    JJ_PORTFOLIO_ROOT: undefined,
    PORTFOLIO_KB_ROOT: undefined,
    JJ_GLOBAL_CONFIG_DIR: path.join(tmp, 'config')
  }, () => {
    const configDir = path.join(tmp, 'config');
    assert.equal(resolveDispatchControlRoot({ configDir }), path.resolve(control));
    assert.equal(resolvePortfolioRoot({ configDir }), path.resolve(portfolio));
    assert.equal(resolveKnowledgeRoot({ configDir }), path.resolve(path.join(portfolio, 'knowledge')));
    const manifest = resolveDeliveryManifestPath('DEL-demo', { configDir });
    assert.equal(
      manifest,
      path.join(path.resolve(control), '.workflow', 'dispatch', 'DEL-demo', 'control-plane.json')
    );
    const snap = describePathConfig({ configDir });
    assert.equal(snap.control_root, path.resolve(control));
    assert.equal(snap.portfolio_root, path.resolve(portfolio));
    assert.equal(snap.naming_config_source, 'file');
  });
});

test('explicit control root wins over env and naming.json', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-explicit-'));
  const envTarget = path.join(tmp, 'from-env');
  const explicit = path.join(tmp, 'from-explicit');
  withEnv({ JJ_DISPATCH_CONTROL_ROOT: envTarget }, () => {
    assert.equal(
      resolveDispatchControlRoot({ explicit }),
      path.resolve(explicit)
    );
  });
});

test('~/custom-control expands under home', () => {
  assert.equal(expandUserPath('~/custom-control'), path.join(os.homedir(), 'custom-control'));
  withEnv({
    JJ_DISPATCH_CONTROL_ROOT: undefined,
    JJ_GLOBAL_CONFIG_DIR: path.join(os.tmpdir(), 'jj-no-config-2')
  }, () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-tilde-cfg-'));
    fs.mkdirSync(path.join(tmp, 'config'), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, 'config', 'naming.json'),
      JSON.stringify({
        dispatch: { control_root: '~/custom-jj-control-test-path' }
      }),
      'utf8'
    );
    assert.equal(
      resolveDispatchControlRoot({ configDir: path.join(tmp, 'config') }),
      path.join(os.homedir(), 'custom-jj-control-test-path')
    );
  });
});

test('jj-dispatch skill states product default ~/.jj-flow and NEEDS_CONFIRM gate', () => {
  const skill = fs.readFileSync(
    path.join(process.cwd(), '.codex', 'skills', 'jj-dispatch', 'SKILL.md'),
    'utf8'
  );
  assert.match(skill, /~\/\.jj-flow/);
  assert.match(skill, /control_root/);
  assert.doesNotMatch(skill, /默认 `D:\/a\/dispatch-control`/);
  assert.match(skill, /NEEDS_CONFIRM/);
  assert.match(skill, /确认前.*不.*DISPATCH|用户确认前/);
});
