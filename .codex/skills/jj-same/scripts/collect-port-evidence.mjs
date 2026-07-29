#!/usr/bin/env node
/**
 * Cross-platform port evidence collector for jj-same.
 * Works on Windows / macOS / Linux with Node.js + git.
 *
 * Preferred entry:
 *   node scripts/collect-port-evidence.mjs \
 *     --source-repo <path> --source-base <ref> --source-ref <ref> \
 *     --target-repo <path> [--target-ref HEAD]
 *
 * Thin wrappers:
 *   ./collect-port-evidence.sh ...
 *   powershell -File collect-port-evidence.ps1 ...
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

function printUsage(stream = process.stderr) {
  stream.write(`Usage:
  node collect-port-evidence.mjs --source-repo <path> --source-base <ref> --source-ref <ref> --target-repo <path> [--target-ref HEAD]

Options:
  --source-repo <path>   Source git worktree (required)
  --source-base <ref>    Baseline ref in source (required)
  --source-ref <ref>     Feature/source ref (required)
  --target-repo <path>   Target git worktree (required)
  --target-ref <ref>     Target ref to compare (default: HEAD)
  -h, --help             Show help

Environment:
  Requires Node.js >= 20 and git on PATH.
`);
}

function parseArgs(argv) {
  const options = {
    sourceRepo: null,
    sourceBase: null,
    sourceRef: null,
    targetRepo: null,
    targetRef: 'HEAD',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value == null || value.startsWith('-')) {
        throw new Error(`Missing value for ${arg}`);
      }
      return value;
    };

    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '--source-repo':
      case '-SourceRepo':
        options.sourceRepo = next();
        break;
      case '--source-base':
      case '-SourceBase':
        options.sourceBase = next();
        break;
      case '--source-ref':
      case '-SourceRef':
        options.sourceRef = next();
        break;
      case '--target-repo':
      case '-TargetRepo':
        options.targetRepo = next();
        break;
      case '--target-ref':
      case '-TargetRef':
        options.targetRef = next();
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function runGit(repo, args, { allowFailure = false } = {}) {
  const result = spawnSync('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.error) {
    throw new Error(`Failed to run git: ${result.error.message}`);
  }

  const stdout = String(result.stdout || '');
  const stderr = String(result.stderr || '');
  const combined = [stdout, stderr].filter(Boolean).join('\n').trimEnd();

  if (result.status !== 0 && !allowFailure) {
    throw new Error(
      `git -C '${repo}' ${args.join(' ')} failed:\n${combined || `(exit ${result.status})`}`,
    );
  }

  return {
    status: result.status ?? 1,
    stdout,
    stderr,
    lines: stdout
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter((line, index, arr) => !(index === arr.length - 1 && line === '')),
  };
}

function resolveRepoPath(inputPath) {
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Path does not exist: ${resolved}`);
  }
  const check = runGit(resolved, ['rev-parse', '--is-inside-work-tree'], { allowFailure: true });
  if (check.status !== 0 || check.lines[0] !== 'true') {
    throw new Error(`Not a Git worktree: ${resolved}`);
  }
  return resolved;
}

function gitPathExists(repo, ref, filePath) {
  const result = runGit(repo, ['cat-file', '-e', `${ref}:${filePath}`], { allowFailure: true });
  return result.status === 0;
}

function gitPathHash(repo, ref, filePath) {
  if (!gitPathExists(repo, ref, filePath)) return null;
  return runGit(repo, ['rev-parse', `${ref}:${filePath}`]).lines[0] || null;
}

function packageSummary(repo, ref) {
  if (!gitPathExists(repo, ref, 'package.json')) {
    return 'package.json unavailable at ref';
  }

  try {
    const raw = runGit(repo, ['show', `${ref}:package.json`]).stdout;
    const pkg = JSON.parse(raw);
    const deps = pkg.dependencies || {};
    const devDeps = pkg.devDependencies || {};
    const vue = deps.vue;
    const router = deps['vue-router'];
    const store = deps.pinia
      ? `pinia ${deps.pinia}`
      : deps.vuex
        ? `vuex ${deps.vuex}`
        : 'no declared store';
    const builder = devDeps.vite
      ? `vite ${devDeps.vite}`
      : devDeps['@vue/cli-service']
        ? `vue-cli ${devDeps['@vue/cli-service']}`
        : 'unknown builder';
    return `${pkg.name}; vue ${vue}; router ${router}; ${store}; ${builder}`;
  } catch {
    return 'package.json could not be parsed';
  }
}

function escapeTablePath(filePath) {
  return String(filePath).replaceAll('|', '\\|');
}

export function collectPortEvidence({
  sourceRepo,
  sourceBase,
  sourceRef,
  targetRepo,
  targetRef = 'HEAD',
} = {}) {
  if (!sourceRepo || !sourceBase || !sourceRef || !targetRepo) {
    throw new Error('source-repo, source-base, source-ref, and target-repo are required');
  }

  const source = resolveRepoPath(sourceRepo);
  const target = resolveRepoPath(targetRepo);

  runGit(source, ['rev-parse', '--verify', sourceBase]);
  runGit(source, ['rev-parse', '--verify', sourceRef]);
  runGit(target, ['rev-parse', '--verify', targetRef]);

  const mergeBase = runGit(source, ['merge-base', sourceBase, sourceRef]).lines[0];
  const range = `${mergeBase}..${sourceRef}`;
  const commits = runGit(source, ['log', '--reverse', '--format=%h\t%s', range]).lines;
  const changed = runGit(source, ['diff', '--name-status', range]).lines;
  const sourceStatus = runGit(source, ['status', '--short', '--branch']).lines;
  const targetStatus = runGit(target, ['status', '--short', '--branch']).lines;

  const lines = [];
  lines.push('# Port evidence');
  lines.push('');
  lines.push(`- Source: \`${source}\``);
  lines.push(`- Source range: \`${range}\``);
  lines.push(`- Source stack: ${packageSummary(source, sourceRef)}`);
  lines.push(`- Target: \`${target}\``);
  lines.push(`- Target ref: \`${targetRef}\``);
  lines.push(`- Target stack: ${packageSummary(target, targetRef)}`);
  lines.push('');
  lines.push('## Source commits');
  lines.push('');

  if (commits.length === 0) {
    lines.push('- No commits in range.');
  } else {
    for (const commit of commits) {
      lines.push(`- ${commit}`);
    }
  }

  lines.push('');
  lines.push('## Changed-path comparison');
  lines.push('');
  lines.push('| Source status | Path | Target ref state | Content relation |');
  lines.push('|---|---|---|---|');

  for (const line of changed) {
    if (!line || !String(line).trim()) continue;
    const parts = String(line).split('\t');
    const status = parts[0];
    const filePath = parts[parts.length - 1];
    const targetExists = gitPathExists(target, targetRef, filePath);
    const targetState = targetExists ? 'present' : 'missing';
    let relation = 'not comparable';

    if (!/^D/.test(status) && targetExists) {
      const sourceHash = gitPathHash(source, sourceRef, filePath);
      const targetHash = gitPathHash(target, targetRef, filePath);
      relation = sourceHash && sourceHash === targetHash ? 'identical blob' : 'different blob';
    }

    lines.push(`| ${status} | \`${escapeTablePath(filePath)}\` | ${targetState} | ${relation} |`);
  }

  lines.push('');
  lines.push('## Worktree status');
  lines.push('');
  lines.push('### Source');
  lines.push('```text');
  lines.push(...sourceStatus);
  lines.push('```');
  lines.push('');
  lines.push('### Target');
  lines.push('```text');
  lines.push(...targetStatus);
  lines.push('```');
  lines.push('');
  lines.push(
    '> This report is structural evidence only. Classify behavior with source requirements and target call chains before editing.',
  );
  lines.push('');

  return {
    markdown: lines.join('\n'),
    source,
    target,
    range,
    mergeBase,
    commits,
    changed,
  };
}

export function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n\n`);
    printUsage();
    process.exitCode = 2;
    return 2;
  }

  if (options.help) {
    printUsage(process.stdout);
    return 0;
  }

  const missing = [];
  if (!options.sourceRepo) missing.push('--source-repo');
  if (!options.sourceBase) missing.push('--source-base');
  if (!options.sourceRef) missing.push('--source-ref');
  if (!options.targetRepo) missing.push('--target-repo');
  if (missing.length) {
    process.stderr.write(`Missing required options: ${missing.join(', ')}\n\n`);
    printUsage();
    process.exitCode = 2;
    return 2;
  }

  try {
    const report = collectPortEvidence(options);
    process.stdout.write(report.markdown.endsWith('\n') ? report.markdown : `${report.markdown}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
    return 1;
  }
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const thisPath = path.resolve(fileURLToPath(import.meta.url));
if (entryPath && entryPath === thisPath) {
  main();
}
