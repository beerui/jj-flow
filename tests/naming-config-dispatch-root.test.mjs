import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  defaultDispatchControlRoot,
  ensureDispatchControlRoot,
  expandUserPath,
  resolveDispatchControlRoot
} from '../src/namingConfig.mjs';

test('defaultDispatchControlRoot is ~/.jj-flow', () => {
  assert.equal(defaultDispatchControlRoot(), path.join(os.homedir(), '.jj-flow'));
  assert.equal(expandUserPath('~/.jj-flow'), path.join(os.homedir(), '.jj-flow'));
});

test('resolveDispatchControlRoot defaults to ~/.jj-flow when no env override', () => {
  const prev = process.env.JJ_DISPATCH_CONTROL_ROOT;
  const prevConfig = process.env.JJ_GLOBAL_CONFIG_DIR;
  try {
    delete process.env.JJ_DISPATCH_CONTROL_ROOT;
    // Avoid loading D:/a/config/naming.json which may override control_root
    process.env.JJ_GLOBAL_CONFIG_DIR = path.join(os.tmpdir(), 'jj-no-config-dir-missing');
    const root = resolveDispatchControlRoot({
      configDir: path.join(os.tmpdir(), 'jj-no-config-dir-missing')
    });
    assert.equal(root, path.join(os.homedir(), '.jj-flow'));
  } finally {
    if (prev === undefined) delete process.env.JJ_DISPATCH_CONTROL_ROOT;
    else process.env.JJ_DISPATCH_CONTROL_ROOT = prev;
    if (prevConfig === undefined) delete process.env.JJ_GLOBAL_CONFIG_DIR;
    else process.env.JJ_GLOBAL_CONFIG_DIR = prevConfig;
  }
});

test('ensureDispatchControlRoot creates home .jj-flow layout', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-ensure-home-'));
  const root = ensureDispatchControlRoot({ explicit: path.join(tmp, '.jj-flow') });
  assert.ok(fs.existsSync(root));
  assert.ok(fs.existsSync(path.join(root, 'README.md')));
  assert.ok(fs.existsSync(path.join(root, '.workflow', 'dispatch')));
});

test('JJ_DISPATCH_CONTROL_ROOT wins over defaults', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-dispatch-env-'));
  const target = path.join(tmp, 'custom-control');
  const prev = process.env.JJ_DISPATCH_CONTROL_ROOT;
  try {
    process.env.JJ_DISPATCH_CONTROL_ROOT = target;
    assert.equal(resolveDispatchControlRoot(), path.resolve(target));
  } finally {
    if (prev === undefined) delete process.env.JJ_DISPATCH_CONTROL_ROOT;
    else process.env.JJ_DISPATCH_CONTROL_ROOT = prev;
  }
});
