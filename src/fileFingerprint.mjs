import crypto from 'node:crypto';
import fs from 'node:fs';

export function hashNormalizedTextFile(file) {
  const content = fs.readFileSync(file, 'utf8').replaceAll(/\r\n?/g, '\n');
  return `sha256:${crypto.createHash('sha256').update(content, 'utf8').digest('hex')}`;
}
