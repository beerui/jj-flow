#!/usr/bin/env node
/**
 * Minimal runner for experimental jj-evaluated skill.
 *
 * Pure Node ESM; no external deps. Portable (no absolute host paths baked in).
 *
 * Usage:
 *   node evaluated_ops.mjs validate --episode <path> [--json]
 *   node evaluated_ops.mjs init-report --out <dir> [--episode-id <id>]
 *   node evaluated_ops.mjs check-split --manifest <path> [--json]
 *   node evaluated_ops.mjs --help
 *   node evaluated_ops.mjs <subcommand> --help
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @returns {Promise<typeof import('./episode-validate.mjs')>}
 */
async function loadValidator() {
  const local = path.join(__dirname, 'episode-validate.mjs');
  return import(pathToFileURL(local).href);
}

function die(msg, code = 2) {
  process.stderr.write(`${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const out = { _: [], flags: /** @type {Record<string, string|boolean>} */ ({}) };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        out.flags[key] = true;
      } else {
        out.flags[key] = next;
        i += 1;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function printRootHelp() {
  process.stdout.write(`evaluated_ops.mjs — experimental jj-evaluated minimal runner

Subcommands:
  validate      Validate an episode JSON/JSONL file
  init-report   Write a report skeleton markdown under an output directory
  check-split   Validate optimization/search + holdout + regression split manifest

Usage:
  node evaluated_ops.mjs <subcommand> [options]
  node evaluated_ops.mjs <subcommand> --help
  node evaluated_ops.mjs --help

Script resolution (agent):
  1. repo skill scripts under skills/jj-evaluated/scripts/
  2. installed skill path (same relative scripts/)
  3. node skills/jj-evaluated/scripts/evaluated_ops.mjs …
`);
}

function printValidateHelp() {
  process.stdout.write(`evaluated_ops.mjs validate — episode contract minimums

Usage:
  node evaluated_ops.mjs validate --episode <path> [--json]
  node evaluated_ops.mjs validate --help

Options:
  --episode, -e   Path to episode .json or .jsonl
  --json          Print { ok, errors, warnings }
`);
}

function printInitReportHelp() {
  process.stdout.write(`evaluated_ops.mjs init-report — write report skeleton

Usage:
  node evaluated_ops.mjs init-report --out <dir> [--episode-id <id>]
  node evaluated_ops.mjs init-report --help

Options:
  --out           Output directory (required for explicit placement)
  --episode-id    Episode id used in report header and default path segment

Default product root for reports (business repos):
  .workflow/evaluated/<episode_id|timestamp>/report.md

If --out is omitted, writes under cwd/.workflow/evaluated/<id>/report.md
`);
}

function printCheckSplitHelp() {
  process.stdout.write(`evaluated_ops.mjs check-split — split manifest integrity

Usage:
  node evaluated_ops.mjs check-split --manifest <path> [--json]
  node evaluated_ops.mjs check-split --help

Required keys:
  - optimization OR search
  - holdout
  - regression

Each key must be an array or object. When lists of ids can be derived,
ids must not overlap across sets.

Exit 0 when ok; exit 1 on validation errors; exit 2 on usage/IO.
`);
}

/**
 * @param {unknown} section
 * @returns {string[]}
 */
function extractIds(section) {
  if (section == null) return [];
  if (Array.isArray(section)) {
    return section
      .map((item) => {
        if (typeof item === 'string' || typeof item === 'number') return String(item);
        if (item && typeof item === 'object') {
          const o = /** @type {Record<string, unknown>} */ (item);
          if (o.id != null) return String(o.id);
          if (o.episode_id != null) return String(o.episode_id);
        }
        return null;
      })
      .filter(/** @type {(v: string|null) => v is string} */ ((v) => Boolean(v)));
  }
  if (typeof section === 'object') {
    const o = /** @type {Record<string, unknown>} */ (section);
    if (Array.isArray(o.ids)) return extractIds(o.ids);
    if (Array.isArray(o.episodes)) return extractIds(o.episodes);
    if (Array.isArray(o.items)) return extractIds(o.items);
    return Object.keys(o);
  }
  return [];
}

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {{ ok: boolean, errors: Array<{path:string,message:string,code?:string}>, warnings: Array<{path:string,message:string,code?:string}> }}
 */
export function checkSplitManifest(value) {
  /** @type {Array<{path:string,message:string,code?:string}>} */
  const errors = [];
  /** @type {Array<{path:string,message:string,code?:string}>} */
  const warnings = [];

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push({
      code: 'SPLIT_NOT_OBJECT',
      path: '$',
      message: 'split manifest must be a JSON object'
    });
    return { ok: false, errors, warnings };
  }

  const root = /** @type {Record<string, unknown>} */ (value);
  const hasOptimization = Object.prototype.hasOwnProperty.call(root, 'optimization');
  const hasSearch = Object.prototype.hasOwnProperty.call(root, 'search');
  if (!hasOptimization && !hasSearch) {
    errors.push({
      code: 'MISSING_OPTIMIZATION',
      path: '$.optimization|search',
      message: 'missing required key "optimization" or "search"'
    });
  }
  if (!Object.prototype.hasOwnProperty.call(root, 'holdout')) {
    errors.push({
      code: 'MISSING_HOLDOUT',
      path: '$.holdout',
      message: 'missing required key "holdout"'
    });
  }
  if (!Object.prototype.hasOwnProperty.call(root, 'regression')) {
    errors.push({
      code: 'MISSING_REGRESSION',
      path: '$.regression',
      message: 'missing required key "regression"'
    });
  }

  const isSection = (v) => Array.isArray(v) || (v && typeof v === 'object');
  const searchSection = hasOptimization ? root.optimization : root.search;
  const searchKey = hasOptimization ? 'optimization' : 'search';

  if ((hasOptimization || hasSearch) && !isSection(searchSection)) {
    errors.push({
      code: 'BAD_SECTION_TYPE',
      path: `$.${searchKey}`,
      message: `${searchKey} must be an array or object`
    });
  }
  if (Object.prototype.hasOwnProperty.call(root, 'holdout') && !isSection(root.holdout)) {
    errors.push({
      code: 'BAD_SECTION_TYPE',
      path: '$.holdout',
      message: 'holdout must be an array or object'
    });
  }
  if (Object.prototype.hasOwnProperty.call(root, 'regression') && !isSection(root.regression)) {
    errors.push({
      code: 'BAD_SECTION_TYPE',
      path: '$.regression',
      message: 'regression must be an array or object'
    });
  }

  if (hasOptimization && hasSearch) {
    warnings.push({
      code: 'BOTH_OPT_AND_SEARCH',
      path: '$.optimization|search',
      message: 'both optimization and search present; treating optimization as primary search set'
    });
  }

  const groups = [
    { key: searchKey, ids: extractIds(searchSection) },
    { key: 'holdout', ids: extractIds(root.holdout) },
    { key: 'regression', ids: extractIds(root.regression) }
  ];

  /** @type {Map<string, string[]>} */
  const seen = new Map();
  for (const g of groups) {
    for (const id of g.ids) {
      if (!seen.has(id)) seen.set(id, []);
      seen.get(id).push(g.key);
    }
  }
  for (const [id, keys] of seen.entries()) {
    const unique = [...new Set(keys)];
    if (unique.length > 1) {
      errors.push({
        code: 'OVERLAPPING_ID',
        path: `$.ids.${id}`,
        message: `id "${id}" appears in multiple sets: ${unique.join(', ')}`
      });
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * @param {string} outDir
 * @param {string} [episodeId]
 */
export function writeReportSkeleton(outDir, episodeId) {
  const id = (episodeId && String(episodeId).trim()) || defaultEpisodeId();
  const dir = path.resolve(outDir || path.join(process.cwd(), '.workflow', 'evaluated', id));
  fs.mkdirSync(dir, { recursive: true });
  const reportPath = path.join(dir, 'report.md');
  const content = buildReportSkeleton(id);
  fs.writeFileSync(reportPath, content, 'utf8');
  return { ok: true, episode_id: id, path: reportPath, dir };
}

function defaultEpisodeId() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `EP-${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

function buildReportSkeleton(episodeId) {
  return `# jj-evaluated report — ${episodeId}

> Status: draft skeleton (experimental MVP runner)
>
> Skill: \`$jj-evaluated\`
>
> Product report root (business repos): \`.workflow/evaluated/\`
>
> jj-flow repo itself is not control-plane truth for business evaluations.

## 1. Episode and role mapping

| Field | Value |
| --- | --- |
| episode_id | \`${episodeId}\` |
| role | <!-- project role: 项目A \\| 项目B \\| 项目C \\| control harness --> |
| project_path | |
| branch / commit | |
| thread_id / export_id | |
| evidence refs | |

## 2. Baseline table and clock-quality caveats

| Metric | Value | clock_quality | timestamp_provenance |
| --- | ---: | --- | --- |
| active_duration | | | |
| wall_span | | | |
| idle_duration | | | |
| handoff_wait | | | |
| tool_wait | | | |
| human_attention | | | |
| artifact_write_span | | | |

Caveats:

- Do not treat filesystem mtime or a lone \`run.json\` duration as authoritative.
- Mark every duration with \`clock_quality\` and provenance.

## 3. Failure / behavior tags and causal hypotheses

| Tag | Evidence ref | Hypothesis |
| --- | --- | --- |
| | | |

## 4. Optimization / holdout / regression split

| Set | Episode ids | Notes |
| --- | --- | --- |
| optimization/search | | |
| holdout | | disjoint; outcomes not shown to proposer |
| regression | | immutable |

Leakage checks:

- [ ] no shared ids across sets
- [ ] group-split by thread / feature / role / time window where applicable

Validate split: \`node evaluated_ops.mjs check-split --manifest <split.json>\`

## 5. Candidate change

| Field | Value |
| --- | --- |
| candidate_id | |
| expected mechanism | |
| bounded diff / asset | |
| non-goals | |

## 6. Replay results

| Suite | Result | Notes |
| --- | --- | --- |
| contract / schema | | |
| search subset | | |
| full search | | |
| holdout | | |
| regression | | |

Token / time trade-offs:

## 7. Human decision

| Field | Value |
| --- | --- |
| reviewer | |
| decision | approve / reject / defer |
| reward-hacking check | |
| leakage check | |
| unsafe-autonomy check | |

## 8. Promotion status and rollback

| Field | Value |
| --- | --- |
| promotion status | not promoted |
| promoted assets | |
| rollback path | |
| next data-collection action | |

---

Generated by \`evaluated_ops.mjs init-report\` (experimental). Fill sections from real episode evidence only.
`;
}

async function cmdValidate(flags) {
  if (flags.help || flags.h) {
    printValidateHelp();
    process.exit(0);
  }
  const episode = flags.episode || flags.e;
  if (!episode || episode === true) {
    printValidateHelp();
    process.exit(2);
  }

  const { validateEpisodeFile } = await loadValidator();
  const result = validateEpisodeFile(String(episode));
  const payload = {
    ok: result.ok,
    errors: result.errors,
    warnings: result.warnings,
    shape: result.shape,
    event_count: result.event_count
  };

  if (flags.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else if (result.ok) {
    process.stdout.write(
      `OK shape=${result.shape} events=${result.event_count} warnings=${result.warnings.length}\n`
    );
  } else {
    process.stderr.write(`FAIL errors=${result.errors.length}\n`);
    for (const e of result.errors) {
      process.stderr.write(`  error ${e.path}: ${e.message}\n`);
    }
  }

  const ioCodes = new Set(['FILE_NOT_FOUND', 'READ_ERROR', 'JSON_PARSE', 'JSONL_PARSE', 'EMPTY_FILE']);
  if (!result.ok && result.errors.every((e) => ioCodes.has(/** @type {string} */ (e.code)))) {
    process.exit(2);
  }
  process.exit(result.ok ? 0 : 1);
}

function cmdInitReport(flags) {
  if (flags.help || flags.h) {
    printInitReportHelp();
    process.exit(0);
  }
  const episodeId = flags['episode-id'] && flags['episode-id'] !== true
    ? String(flags['episode-id'])
    : undefined;
  let out = flags.out && flags.out !== true ? String(flags.out) : null;
  if (!out) {
    const id = episodeId || defaultEpisodeId();
    out = path.join(process.cwd(), '.workflow', 'evaluated', id);
  }
  const result = writeReportSkeleton(out, episodeId);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(0);
}

function cmdCheckSplit(flags) {
  if (flags.help || flags.h) {
    printCheckSplitHelp();
    process.exit(0);
  }
  const manifest = flags.manifest || flags.m;
  if (!manifest || manifest === true) {
    printCheckSplitHelp();
    process.exit(2);
  }
  const abs = path.resolve(String(manifest));
  if (!fs.existsSync(abs)) {
    die(`file not found: ${abs}`, 2);
  }
  let text;
  try {
    text = fs.readFileSync(abs, 'utf8');
  } catch (err) {
    die(`failed to read: ${/** @type {Error} */ (err).message}`, 2);
  }
  if (!String(text).trim()) {
    die('manifest file is empty', 2);
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch (err) {
    die(`invalid JSON: ${/** @type {Error} */ (err).message}`, 2);
  }

  const result = checkSplitManifest(value);
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (result.ok) {
    process.stdout.write(`OK warnings=${result.warnings.length}\n`);
    for (const w of result.warnings) {
      process.stdout.write(`  warning ${w.path}: ${w.message}\n`);
    }
  } else {
    process.stderr.write(`FAIL errors=${result.errors.length}\n`);
    for (const e of result.errors) {
      process.stderr.write(`  error ${e.path}: ${e.message}\n`);
    }
  }
  process.exit(result.ok ? 0 : 1);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    printRootHelp();
    process.exit(argv.length === 0 ? 2 : 0);
  }

  const sub = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const flags = parsed.flags;

  // Allow positional episode for validate convenience
  if (sub === 'validate' && !flags.episode && !flags.e && parsed._[0]) {
    flags.episode = parsed._[0];
  }
  if (sub === 'check-split' && !flags.manifest && !flags.m && parsed._[0]) {
    flags.manifest = parsed._[0];
  }
  if (sub === 'init-report' && !flags.out && parsed._[0]) {
    flags.out = parsed._[0];
  }

  if (sub === 'validate') return cmdValidate(flags);
  if (sub === 'init-report') return cmdInitReport(flags);
  if (sub === 'check-split') return cmdCheckSplit(flags);

  process.stderr.write(`unknown subcommand: ${sub}\n\n`);
  printRootHelp();
  process.exit(2);
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
const self = path.resolve(fileURLToPath(import.meta.url));
if (entry === self) {
  main();
}
