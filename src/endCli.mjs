import fs from 'node:fs';
import path from 'node:path';
import { previewEnd, executeEnd } from './end.mjs';

const help = `jj end / end_ops.mjs — Git closeout runner

  preview [--cwd DIR] [--work-branch NAME] [--integration NAME | --convention-file FILE]
          [--remote origin] [--paths-file FILE | --path FILE ...]
          [--message "feat(scope): 中文摘要" | --message-file FILE]
          [--return-to work|integration] [--output FILE] [--json]
  execute --plan-file FILE [--cwd DIR] [--json]

preview reads local refs only; --output must be outside the repository.
execute requires existing authorization for commit/push/merge. It validates the exact preview,
fetches, commits selected files with normal hooks, syncs/pushes work, merges/pushes integration,
then returns. Changes and failures require a fresh preview; no force/rebase/stash/branch deletion.
Conflicts return both parent/blob ids after aborting the runner's own merge for host resolution.
Git >= 2.38 is required for merge-tree verification. No Ralph/dispatch state is written.
`;

const readText = (file, cwd) => {
  if (typeof file !== 'string' || !file) throw new Error('input file path required');
  return fs.readFileSync(path.resolve(cwd, file), 'utf8').replace(/^\uFEFF/, '');
};
const readJson = (file, cwd) => JSON.parse(readText(file, cwd));

export function runEndCommand(args = [], { cwd = process.cwd(), stdout = process.stdout } = {}) {
  if (!args.length || args.includes('--help') || args.includes('-h')) { stdout.write(help); return 0; }
  const options = { paths: [] };
  let command = args[0];
  const names = {
    '--cwd': 'cwd', '--work-branch': 'work_branch', '--integration': 'integration', '--remote': 'remote',
    '--return-to': 'return_to', '--message': 'message', '--message-file': 'message_file',
    '--paths-file': 'paths_file', '--convention-file': 'convention_file', '--output': 'output', '--plan-file': 'plan_file'
  };
  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--json') continue;
    if (arg === '--dry-run' && command === 'preview') continue;
    if (arg === '--path' || names[arg]) {
      const value = args[++i];
      if (value == null || value.startsWith('--')) throw new Error('missing value for ' + arg);
      if (arg === '--path') options.paths.push(value);
      else {
        if (Object.hasOwn(options, names[arg])) throw new Error('duplicate option: ' + arg);
        options[names[arg]] = value;
      }
      continue;
    }
    throw new Error('unknown end option: ' + arg);
  }
  cwd = path.resolve(cwd, options.cwd || '.');
  if (command === 'preview') {
    if (options.plan_file) throw new Error('--plan-file is only for execute');
    if (options.message && options.message_file) throw new Error('use message or message-file, not both');
    if (options.paths_file) {
      const paths = readJson(options.paths_file, cwd);
      if (!Array.isArray(paths) || paths.some(item => typeof item !== 'string')) throw new Error('paths-file must contain a JSON string array');
      options.paths.push(...paths);
    }
    if (options.message_file) options.message = readText(options.message_file, cwd).trim();
    if (options.convention_file) options.convention = readJson(options.convention_file, cwd);
    const preview = previewEnd({ ...options, cwd });
    if (options.output) {
      const file = path.resolve(cwd, options.output);
      const rel = path.relative(preview.root, file);
      if (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel)) throw new Error('preview output must be outside the repository');
      // Existing parents must also stay outside after symlink resolution.
      const parent = fs.realpathSync(path.dirname(file));
      const realRel = path.relative(preview.root, parent);
      if (realRel !== '..' && !realRel.startsWith('..' + path.sep) && !path.isAbsolute(realRel)) throw new Error('preview output parent resolves inside the repository');
      if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) throw new Error('preview output cannot be a symlink');
      fs.writeFileSync(file, JSON.stringify(preview, null, 2) + '\n');
    }
    stdout.write(JSON.stringify(preview, null, 2) + '\n');
    return preview.blockers.length ? 1 : 0;
  }
  if (command === 'execute') {
    if (!options.plan_file) throw new Error('execute requires --plan-file');
    if (Object.keys(options).some(key => !['cwd', 'plan_file', 'paths'].includes(key)) || options.paths.length) throw new Error('execute consumes the plan unchanged; do not override its options');
    const result = executeEnd(readJson(options.plan_file, cwd), { cwd });
    stdout.write(JSON.stringify(result, null, 2) + '\n');
    return result.ok ? 0 : 1;
  }
  throw new Error('unknown end command: ' + command);
}
