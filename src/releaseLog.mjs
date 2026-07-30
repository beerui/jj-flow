import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_DIR, '..');

export function loadCurrentReleaseLog({
  packageFile = path.join(PROJECT_ROOT, 'package.json'),
  changelogFile = path.join(PROJECT_ROOT, 'CHANGELOG.md')
} = {}) {
  const { version } = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  const changelog = fs.readFileSync(changelogFile, 'utf8');

  return {
    version,
    release_notes: extractVersionLog(changelog, version)
  };
}

export function extractVersionLog(changelog, version) {
  const lines = String(changelog).split(/\r?\n/);
  const escapedVersion = escapeRegExp(version);
  // Accept Keep-a-Changelog / Release Please / stamped local times:
  // ## 0.1.1-beta.36
  // ## [0.1.1-beta.36] - 2026-07-30
  // ## [1.2.3](https://…/tag/v1.2.3) (2026-07-13)
  // ## 0.1.1-beta.36 — 2026-07-30 17:26
  const versionHeading = new RegExp(
    `^##\\s+(?:\\[)?${escapedVersion}(?:\\])?` +
      `(?:\\([^)]*\\))?` +
      `(?:` +
        `\\s*[—\\-–]\\s*\\d{4}-\\d{2}-\\d{2}(?:[ T]\\d{2}:\\d{2}(?::\\d{2})?)?` +
        `|` +
        `\\s+\\([^)]*\\)` +
      `)?` +
      `\\s*$`
  );
  const start = lines.findIndex((line) => versionHeading.test(line.trim()));

  if (start === -1) {
    throw new Error(`Version ${version} is missing from CHANGELOG.md`);
  }

  const endOffset = lines.slice(start + 1).findIndex((line) => /^##\s+/.test(line.trim()));
  const end = endOffset === -1 ? lines.length : start + 1 + endOffset;
  return lines.slice(start + 1, end).join('\n').trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
