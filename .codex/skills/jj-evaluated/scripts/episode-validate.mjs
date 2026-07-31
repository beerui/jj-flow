#!/usr/bin/env node
/**
 * Validate jj-evaluated episode JSON / JSONL against episode-contract minimums.
 *
 * Usage:
 *   node episode-validate.mjs <path-to-episode.json|jsonl> [--json]
 *   node episode-validate.mjs --help
 *
 * Exit 0: no errors (warnings allowed)
 * Exit 1: one or more errors
 * Exit 2: usage / IO / parse failure
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ALLOWED_KINDS = new Set([
  'user_request',
  'user_correction',
  'agent_turn',
  'tool_call',
  'subagent',
  'artifact_write',
  'handoff_created',
  'handoff_superseded',
  'commit',
  'verification',
  'review',
  'wait',
  'escalation'
]);

export const ALLOWED_CLOCK_QUALITY = new Set([
  'exact',
  'derived',
  'inconsistent',
  'unknown'
]);

export const ALLOWED_TIMESTAMP_PROVENANCE = new Set([
  'thread',
  'artifact',
  'git',
  'filesystem',
  'user_export'
]);

export const ALLOWED_ROLES = new Set(['承接', '兑接', '承载']);

/**
 * @typedef {{ severity: 'error'|'warning', path: string, message: string, code?: string }} Finding
 */

/**
 * @param {unknown} value
 * @param {string} basePath
 * @returns {Finding[]}
 */
export function validateEvent(value, basePath = '$') {
  /** @type {Finding[]} */
  const findings = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    findings.push({
      severity: 'error',
      code: 'EVENT_NOT_OBJECT',
      path: basePath,
      message: 'event must be a non-null object'
    });
    return findings;
  }

  const event = /** @type {Record<string, unknown>} */ (value);

  for (const field of ['event_id', 'episode_id', 'kind', 'clock_quality', 'timestamp_provenance']) {
    if (event[field] === undefined || event[field] === null || event[field] === '') {
      findings.push({
        severity: 'error',
        code: 'MISSING_FIELD',
        path: `${basePath}.${field}`,
        message: `required field "${field}" is missing or empty`
      });
    }
  }

  if (typeof event.event_id === 'string' && !event.event_id.trim()) {
    findings.push({
      severity: 'error',
      code: 'EMPTY_EVENT_ID',
      path: `${basePath}.event_id`,
      message: 'event_id must be a non-empty string'
    });
  } else if (event.event_id !== undefined && event.event_id !== null && typeof event.event_id !== 'string') {
    findings.push({
      severity: 'error',
      code: 'TYPE_EVENT_ID',
      path: `${basePath}.event_id`,
      message: 'event_id must be a string'
    });
  }

  if (typeof event.episode_id === 'string' && !event.episode_id.trim()) {
    findings.push({
      severity: 'error',
      code: 'EMPTY_EPISODE_ID',
      path: `${basePath}.episode_id`,
      message: 'episode_id must be a non-empty string'
    });
  } else if (event.episode_id !== undefined && event.episode_id !== null && typeof event.episode_id !== 'string') {
    findings.push({
      severity: 'error',
      code: 'TYPE_EPISODE_ID',
      path: `${basePath}.episode_id`,
      message: 'episode_id must be a string'
    });
  }

  if (typeof event.kind === 'string') {
    if (!ALLOWED_KINDS.has(event.kind)) {
      findings.push({
        severity: 'error',
        code: 'INVALID_KIND',
        path: `${basePath}.kind`,
        message: `kind "${event.kind}" is not in the allowed set`
      });
    }
  } else if (event.kind !== undefined && event.kind !== null) {
    findings.push({
      severity: 'error',
      code: 'TYPE_KIND',
      path: `${basePath}.kind`,
      message: 'kind must be a string'
    });
  }

  if (typeof event.clock_quality === 'string') {
    if (!ALLOWED_CLOCK_QUALITY.has(event.clock_quality)) {
      findings.push({
        severity: 'error',
        code: 'INVALID_CLOCK_QUALITY',
        path: `${basePath}.clock_quality`,
        message: `clock_quality "${event.clock_quality}" must be exact|derived|inconsistent|unknown`
      });
    }
  } else if (event.clock_quality !== undefined && event.clock_quality !== null) {
    findings.push({
      severity: 'error',
      code: 'TYPE_CLOCK_QUALITY',
      path: `${basePath}.clock_quality`,
      message: 'clock_quality must be a string'
    });
  }

  if (typeof event.timestamp_provenance === 'string') {
    if (!ALLOWED_TIMESTAMP_PROVENANCE.has(event.timestamp_provenance)) {
      findings.push({
        severity: 'error',
        code: 'INVALID_TIMESTAMP_PROVENANCE',
        path: `${basePath}.timestamp_provenance`,
        message:
          `timestamp_provenance "${event.timestamp_provenance}" must be thread|artifact|git|filesystem|user_export`
      });
    }
  } else if (event.timestamp_provenance !== undefined && event.timestamp_provenance !== null) {
    findings.push({
      severity: 'error',
      code: 'TYPE_TIMESTAMP_PROVENANCE',
      path: `${basePath}.timestamp_provenance`,
      message: 'timestamp_provenance must be a string'
    });
  }

  if (event.role !== undefined && event.role !== null) {
    if (typeof event.role !== 'string' || !ALLOWED_ROLES.has(event.role)) {
      findings.push({
        severity: 'error',
        code: 'INVALID_ROLE',
        path: `${basePath}.role`,
        message: 'role if present must be one of 承接|兑接|承载'
      });
    }
  }

  if (event.clock_quality === 'unknown') {
    findings.push({
      severity: 'warning',
      code: 'CLOCK_UNKNOWN',
      path: `${basePath}.clock_quality`,
      message: 'clock_quality is unknown; durations must not be treated as authoritative'
    });
  }

  return findings;
}

/**
 * @param {unknown} value
 * @returns {{ ok: boolean, errors: Finding[], warnings: Finding[], findings: Finding[], shape: string, event_count: number }}
 */
export function validateEpisodeDocument(value) {
  /** @type {Finding[]} */
  const findings = [];

  if (value === null || value === undefined) {
    findings.push({
      severity: 'error',
      code: 'EMPTY_DOCUMENT',
      path: '$',
      message: 'document is empty'
    });
    return summarize(findings, 'empty', 0);
  }

  // Array of events
  if (Array.isArray(value)) {
    if (value.length === 0) {
      findings.push({
        severity: 'error',
        code: 'EMPTY_EVENTS',
        path: '$',
        message: 'event array is empty'
      });
      return summarize(findings, 'event_array', 0);
    }
    for (let i = 0; i < value.length; i += 1) {
      findings.push(...validateEvent(value[i], `$[${i}]`));
    }
    return summarize(findings, 'event_array', value.length);
  }

  if (typeof value !== 'object') {
    findings.push({
      severity: 'error',
      code: 'INVALID_ROOT',
      path: '$',
      message: 'root must be an object, an array of events, or JSONL events'
    });
    return summarize(findings, 'invalid', 0);
  }

  const root = /** @type {Record<string, unknown>} */ (value);

  // Episode wrapper with events[]
  if (Array.isArray(root.events)) {
    if (!root.episode_id || (typeof root.episode_id === 'string' && !root.episode_id.trim())) {
      findings.push({
        severity: 'error',
        code: 'MISSING_EPISODE_ID',
        path: '$.episode_id',
        message: 'episode wrapper requires non-empty episode_id'
      });
    } else if (typeof root.episode_id !== 'string') {
      findings.push({
        severity: 'error',
        code: 'TYPE_EPISODE_ID',
        path: '$.episode_id',
        message: 'episode_id must be a string'
      });
    }

    if (root.role !== undefined && root.role !== null) {
      if (typeof root.role !== 'string' || !ALLOWED_ROLES.has(root.role)) {
        findings.push({
          severity: 'error',
          code: 'INVALID_ROLE',
          path: '$.role',
          message: 'role if present must be one of 承接|兑接|承载'
        });
      }
    }

    if (root.events.length === 0) {
      findings.push({
        severity: 'error',
        code: 'EMPTY_EVENTS',
        path: '$.events',
        message: 'episode.events must not be empty'
      });
    }

    for (let i = 0; i < root.events.length; i += 1) {
      const eventFindings = validateEvent(root.events[i], `$.events[${i}]`);
      findings.push(...eventFindings);
      const event = root.events[i];
      if (
        event
        && typeof event === 'object'
        && !Array.isArray(event)
        && typeof root.episode_id === 'string'
        && typeof /** @type {Record<string, unknown>} */ (event).episode_id === 'string'
        && /** @type {Record<string, unknown>} */ (event).episode_id !== root.episode_id
      ) {
        findings.push({
          severity: 'warning',
          code: 'EPISODE_ID_MISMATCH',
          path: `$.events[${i}].episode_id`,
          message: `event.episode_id differs from wrapper episode_id "${root.episode_id}"`
        });
      }
    }

    return summarize(findings, 'episode_wrapper', root.events.length);
  }

  // Single event object
  if (root.event_id !== undefined || root.kind !== undefined) {
    findings.push(...validateEvent(root, '$'));
    return summarize(findings, 'single_event', 1);
  }

  findings.push({
    severity: 'error',
    code: 'UNRECOGNIZED_SHAPE',
    path: '$',
    message:
      'unrecognized document shape; expected episode wrapper with events[], event array, single event, or JSONL events'
  });
  return summarize(findings, 'unrecognized', 0);
}

/**
 * @param {string} text
 * @param {string} [sourcePath]
 */
export function parseEpisodeText(text, sourcePath = '') {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) {
    return {
      ok: false,
      error: {
        severity: 'error',
        code: 'EMPTY_FILE',
        path: sourcePath || '$',
        message: 'file is empty'
      },
      value: null
    };
  }

  const looksJsonl =
    sourcePath.toLowerCase().endsWith('.jsonl')
    || (trimmed.includes('\n') && !trimmed.startsWith('[') && !trimmed.startsWith('{'));

  if (looksJsonl || (trimmed.includes('\n') && countLeadingJsonObjects(trimmed) > 1)) {
    const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      return {
        ok: false,
        error: {
          severity: 'error',
          code: 'EMPTY_FILE',
          path: sourcePath || '$',
          message: 'jsonl file has no non-empty lines'
        },
        value: null
      };
    }
    /** @type {unknown[]} */
    const events = [];
    for (let i = 0; i < lines.length; i += 1) {
      try {
        events.push(JSON.parse(lines[i]));
      } catch (err) {
        return {
          ok: false,
          error: {
            severity: 'error',
            code: 'JSONL_PARSE',
            path: `${sourcePath || '$'}:line ${i + 1}`,
            message: `invalid JSON on line ${i + 1}: ${/** @type {Error} */ (err).message}`
          },
          value: null
        };
      }
    }
    return { ok: true, value: events, error: null };
  }

  try {
    return { ok: true, value: JSON.parse(trimmed), error: null };
  } catch (err) {
    return {
      ok: false,
      error: {
        severity: 'error',
        code: 'JSON_PARSE',
        path: sourcePath || '$',
        message: `invalid JSON: ${/** @type {Error} */ (err).message}`
      },
      value: null
    };
  }
}

/**
 * @param {string} filePath
 */
export function validateEpisodeFile(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    const finding = {
      severity: /** @type {const} */ ('error'),
      code: 'FILE_NOT_FOUND',
      path: abs,
      message: `file not found: ${abs}`
    };
    return summarize([finding], 'missing', 0);
  }

  let text;
  try {
    text = fs.readFileSync(abs, 'utf8');
  } catch (err) {
    const finding = {
      severity: /** @type {const} */ ('error'),
      code: 'READ_ERROR',
      path: abs,
      message: `failed to read file: ${/** @type {Error} */ (err).message}`
    };
    return summarize([finding], 'io', 0);
  }

  if (!String(text).trim()) {
    const finding = {
      severity: /** @type {const} */ ('error'),
      code: 'EMPTY_FILE',
      path: abs,
      message: 'file is empty'
    };
    return summarize([finding], 'empty', 0);
  }

  const parsed = parseEpisodeText(text, abs);
  if (!parsed.ok) {
    return summarize([/** @type {Finding} */ (parsed.error)], 'parse', 0);
  }
  return validateEpisodeDocument(parsed.value);
}

/**
 * @param {Finding[]} findings
 * @param {string} shape
 * @param {number} eventCount
 */
function summarize(findings, shape, eventCount) {
  const errors = findings.filter((f) => f.severity === 'error');
  const warnings = findings.filter((f) => f.severity === 'warning');
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    findings,
    shape,
    event_count: eventCount
  };
}

function countLeadingJsonObjects(text) {
  let count = 0;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('{') || t.startsWith('[')) count += 1;
    else break;
    if (count > 2) break;
  }
  return count;
}

function parseArgs(argv) {
  const out = { path: null, json: false, help: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--episode' || a === '-e') out.path = argv[++i];
    else if (!a.startsWith('-') && !out.path) out.path = a;
  }
  return out;
}

function printHelp() {
  process.stdout.write(`episode-validate.mjs — validate jj-evaluated episode JSON/JSONL

Usage:
  node episode-validate.mjs <path-to-episode.json|jsonl> [--json]
  node episode-validate.mjs --episode <path> [--json]
  node episode-validate.mjs --help

Minimums (episode-contract):
  - each event: event_id, episode_id, kind, clock_quality, timestamp_provenance
  - kind ∈ allowed set; clock_quality ∈ exact|derived|inconsistent|unknown
  - timestamp_provenance ∈ thread|artifact|git|filesystem|user_export
  - role if present ∈ 承接|兑接|承载
  - empty files rejected

Exit codes:
  0  no errors (warnings ok)
  1  validation errors
  2  usage / IO / parse failure
`);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  if (!args.path) {
    printHelp();
    process.exit(2);
  }

  const result = validateEpisodeFile(args.path);
  const payload = {
    ok: result.ok,
    errors: result.errors,
    warnings: result.warnings,
    shape: result.shape,
    event_count: result.event_count
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    if (result.ok) {
      process.stdout.write(
        `OK shape=${result.shape} events=${result.event_count} warnings=${result.warnings.length}\n`
      );
      for (const w of result.warnings) {
        process.stdout.write(`  warning ${w.path}: ${w.message}\n`);
      }
    } else {
      process.stderr.write(
        `FAIL errors=${result.errors.length} warnings=${result.warnings.length} shape=${result.shape}\n`
      );
      for (const e of result.errors) {
        process.stderr.write(`  error ${e.path}: ${e.message}\n`);
      }
      for (const w of result.warnings) {
        process.stderr.write(`  warning ${w.path}: ${w.message}\n`);
      }
    }
  }

  // Parse/IO map to exit 2; pure schema errors → 1
  const ioCodes = new Set(['FILE_NOT_FOUND', 'READ_ERROR', 'JSON_PARSE', 'JSONL_PARSE', 'EMPTY_FILE']);
  if (!result.ok && result.errors.every((e) => ioCodes.has(/** @type {string} */ (e.code)))) {
    process.exit(2);
  }
  process.exit(result.ok ? 0 : 1);
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
const self = path.resolve(fileURLToPath(import.meta.url));
if (entry === self) {
  main();
}
