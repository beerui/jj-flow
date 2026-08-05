/**
 * Contracts for optional team execution engines (jj-team-coordinate / jj-team-swarm).
 * Does not execute multi-agent pipelines; checks SSOT, inventory, routing, hygiene.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CLAUDE_COMMAND_MAX_LINES,
  checkSkillInventory,
  loadSkillInventory
} from '../src/skillInventory.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

test('jj-team-coordinate and jj-team-swarm are inventory + disk + claude commands', () => {
  const inv = loadSkillInventory(root);
  const ids = new Set(inv.skills.map((s) => s.id));
  assert.ok(ids.has('jj-team-coordinate'));
  assert.ok(ids.has('jj-team-swarm'));
  for (const id of ['jj-team-coordinate', 'jj-team-swarm']) {
    const row = inv.skills.find((s) => s.id === id);
    assert.equal(row.claude_command, id + '.md');
    assert.ok(row.platforms.includes('claude'));
    assert.ok(row.platforms.includes('codex'));
    assert.ok(exists(path.join('skills', id, 'SKILL.md')));
    assert.ok(exists(path.join('claude-commands', id + '.md')));
    const cmd = read(path.join('claude-commands', id + '.md'));
    const lines = cmd.length === 0 ? 0 : cmd.replace(/\n$/, '').split('\n').length;
    assert.ok(lines <= CLAUDE_COMMAND_MAX_LINES, id + ' command lines ' + lines);
  }
  const parity = checkSkillInventory({ cwd: root });
  assert.equal(parity.ok, true, JSON.stringify(parity.findings, null, 2));
});

test('jj router places team engines after delivery paths and keeps checkpoint language', () => {
  const skill = read('skills/jj/SKILL.md');
  assert.match(skill, /description:[\s\S]*?jj-team-coordinate/);
  assert.match(skill, /description:[\s\S]*?jj-team-swarm/);
  const body = skill.split('## Routing priority')[1] || skill;
  const iSame = body.indexOf('jj-same');
  const iRalph = body.indexOf('jj-ralph');
  const iTeam = body.indexOf('jj-team-coordinate');
  const iSwarm = body.indexOf('jj-team-swarm');
  assert.ok(iSame >= 0 && iRalph >= 0 && iTeam >= 0 && iSwarm >= 0);
  assert.ok(iTeam > iRalph, 'team-coordinate must route after ralph');
  assert.ok(iSwarm > iTeam, 'swarm after coordinate in routing table');
  assert.match(skill, /do not advance checkpoint|never default delivery path|does not advance checkpoint/i);
});

test('team skills declare checkpoint non-authority and session prefixes', () => {
  const coord = read('skills/jj-team-coordinate/SKILL.md');
  const swarm = read('skills/jj-team-swarm/SKILL.md');
  for (const text of [coord, swarm]) {
    assert.match(text, /MUST NOT|does NOT|Do not|不得/i);
    assert.match(text, /ralph|dispatch|checkpoint/i);
  }
  assert.match(coord, /TC-/);
  assert.match(swarm, /TAS-/);
  assert.match(coord, /User transparency|user-transparency/);
  assert.match(swarm, /User transparency|user-transparency/);
});

test('coordinator role fail-closes without catalog reason (not always-team)', () => {
  const role = read('skills/jj-team-coordinate/roles/coordinator/role.md');
  assert.match(role, /Gate: why-team catalog|why-team catalog/i);
  assert.match(role, /STOP team path|do \*\*not\*\* create `TC-\*`|do not create/);
  assert.doesNotMatch(
    role,
    /Always proceed to Phase 2[\s\S]{0,80}NEVER skip team workflow based on complexity/
  );
});

test('no python bytecode under skills/jj-team-swarm', () => {
  const scripts = path.join(root, 'skills', 'jj-team-swarm', 'scripts');
  assert.ok(fs.existsSync(scripts));
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        assert.notEqual(name, '__pycache__', 'unexpected __pycache__ under ' + p);
        walk(p);
      } else {
        assert.ok(!name.endsWith('.pyc'), 'unexpected .pyc ' + p);
      }
    }
  };
  walk(scripts);
});

test('jj-team-swarm ships aco.py and conservative defaults', () => {
  assert.ok(exists('skills/jj-team-swarm/scripts/aco.py'));
  assert.ok(exists('skills/jj-team-swarm/scripts/test_aco.py'));
  const tpl = JSON.parse(read('skills/jj-team-swarm/specs/swarm-config-template.json'));
  assert.ok(tpl.swarm.n_ants <= 3, 'default n_ants should be conservative');
  assert.ok(tpl.swarm.max_iterations <= 3, 'default max_iterations should be conservative');
  assert.notEqual(tpl.scoring.mode, 'adversarial', 'default scoring should not force 3-vote adversarial');
});

test('optional: aco.py test suite when python is available', async () => {
  const { spawnSync } = await import('node:child_process');
  const candidates = process.platform === 'win32' ? ['python', 'python3', 'py'] : ['python3', 'python'];
  let py = null;
  for (const c of candidates) {
    const probe = spawnSync(c, ['--version'], { encoding: 'utf8' });
    if (probe.status === 0) {
      py = c;
      break;
    }
  }
  if (!py) {
    // Skip without failing CI hosts that lack Python
    return;
  }
  const r = spawnSync(py, [path.join(root, 'skills/jj-team-swarm/scripts/test_aco.py')], {
    encoding: 'utf8',
    cwd: root,
    timeout: 120000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }
  });
  assert.equal(r.status, 0, (r.stdout || '') + (r.stderr || ''));
  assert.match(r.stdout || '', /passed/i);
  // Hygiene: test run must not leave bytecode in skill SSOT
  const pycache = path.join(root, 'skills/jj-team-swarm/scripts/__pycache__');
  if (fs.existsSync(pycache)) {
    fs.rmSync(pycache, { recursive: true, force: true });
  }
});
