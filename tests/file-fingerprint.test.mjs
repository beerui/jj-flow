import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hashNormalizedTextFile } from '../src/fileFingerprint.mjs';

test('text fingerprint is stable across LF and CRLF checkouts', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-flow-fingerprint-'));
  try {
    const lf = path.join(directory, 'lf.mjs');
    const crlf = path.join(directory, 'crlf.mjs');
    fs.writeFileSync(lf, 'export const value = 1;\n', 'utf8');
    fs.writeFileSync(crlf, 'export const value = 1;\r\n', 'utf8');

    assert.equal(hashNormalizedTextFile(lf), hashNormalizedTextFile(crlf));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
