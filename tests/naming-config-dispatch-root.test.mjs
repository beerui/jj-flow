import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  ensureDispatchControlRoot,
  resolveDispatchControlRoot
} from '../src/namingConfig.mjs';

test('resolveDispatchControlRoot falls back to workspace .jj-flow when portfolio missing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-dispatch-root-'));
  const prev = process.env.JJ_DISPATCH_CONTROL_ROOT;
  const prevConfig = process.env.JJ_GLOBAL_CONFIG_DIR;
  try {
    delete process.env.JJ_DISPATCH_CONTROL_ROOT;
    // Force no global config dir so defaults are used, but portfolio D:/a may still exist on this machine.
    // Pass a non-existent configDir; resolution still checks portfolio path existence on disk.
    process.env.JJ_GLOBAL_CONFIG_DIR = path.join(tmp, 'no-config');
    const root = resolveDispatchControlRoot({
      cwd: tmp,
      configDir: path.join(tmp, 'no-config')
    });
    // On machines with D:/a, preferred portfolio wins; otherwise .jj-flow under tmp.
    if (fs.existsSync('D:\\a') || fs.existsSync('D:/a')) {
      assert.match(root.replace(/\\/g, '/'), /dispatch-control$/);
    } else {
      assert.equal(root, path.resolve(tmp, '.jj-flow'));
    }
  } finally {
    if (prev === undefined) delete process.env.JJ_DISPATCH_CONTROL_ROOT;
    else process.env.JJ_DISPATCH_CONTROL_ROOT = prev;
    if (prevConfig === undefined) delete process.env.JJ_GLOBAL_CONFIG_DIR;
    else process.env.JJ_GLOBAL_CONFIG_DIR = prevConfig;
  }
});

test('ensureDispatchControlRoot creates .jj-flow under explicit cwd fallback', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-dispatch-ensure-'));
  const prev = process.env.JJ_DISPATCH_CONTROL_ROOT;
  try {
    // Force fallback path by explicit control via env pointing at tmp/.jj-flow after delete env...
    // Use explicit option instead.
    const root = ensureDispatchControlRoot({
      explicit: path.join(tmp, '.jj-flow'),
      cwd: tmp
    });
    assert.equal(root, path.resolve(tmp, '.jj-flow'));
    assert.ok(fs.existsSync(root));
    assert.ok(fs.existsSync(path.join(root, 'README.md')));
    assert.ok(fs.existsSync(path.join(root, '.workflow', 'dispatch')));
  } finally {
    if (prev === undefined) delete process.env.JJ_DISPATCH_CONTROL_ROOT;
    else process.env.JJ_DISPATCH_CONTROL_ROOT = prev;
  }
});

test('JJ_DISPATCH_CONTROL_ROOT wins over defaults', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-dispatch-env-'));
  const target = path.join(tmp, 'custom-control');
  const prev = process.env.JJ_DISPATCH_CONTROL_ROOT;
  try {
    process.env.JJ_DISPATCH_CONTROL_ROOT = target;
    assert.equal(resolveDispatchControlRoot({ cwd: tmp }), path.resolve(target));
  } finally {
    if (prev === undefined) delete process.env.JJ_DISPATCH_CONTROL_ROOT;
    else process.env.JJ_DISPATCH_CONTROL_ROOT = prev;
  }
});
