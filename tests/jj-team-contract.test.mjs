/**
 * Contracts for the jj-team team-mode entry.
 * Does not execute a team; checks SSOT, inventory, state-root discipline,
 * the parallelism gate, and that sibling engines were left alone.
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

/** The MUST NOT column of the hard-boundaries table, joined. */
function mustNotColumn(doc) {
  const block = doc.split('## jj-flow hard boundaries')[1]?.split('\n## ')[0] ?? '';
  return block
    .split('\n')
    .filter((line) => line.trim().startsWith('|'))
    .map((line) => line.split('|'))
    .filter((cells) => cells.length >= 4)
    .map((cells) => cells[2])
    .join('\n');
}

test('jj-team is in inventory, on disk, and has a thin claude command', () => {
  const inv = loadSkillInventory(root);
  const row = inv.skills.find((s) => s.id === 'jj-team');
  assert.ok(row, 'jj-team must be registered in skill-inventory.json');
  assert.equal(row.claude_command, 'jj-team.md');
  assert.equal(row.user_invocable, true);
  assert.ok(row.platforms.includes('claude'));
  assert.ok(row.platforms.includes('codex'));

  assert.ok(exists('skills/jj-team/SKILL.md'));
  assert.ok(exists('claude-commands/jj-team.md'));

  const cmd = read('claude-commands/jj-team.md');
  const lines = cmd.length === 0 ? 0 : cmd.replace(/\n$/, '').split('\n').length;
  assert.ok(lines <= CLAUDE_COMMAND_MAX_LINES, 'jj-team command lines ' + lines);

  const parity = checkSkillInventory({ cwd: root });
  assert.equal(parity.ok, true, JSON.stringify(parity.findings, null, 2));
});

test('jj-team ships its manual, roles, state layout and generic rubric', () => {
  for (const rel of [
    'skills/jj-team/references/team-manual.md',
    'skills/jj-team/references/roles.md',
    'skills/jj-team/references/review-dimensions.md',
    'skills/jj-team/specs/state-layout.md'
  ]) {
    assert.ok(exists(rel), 'missing ' + rel);
  }
  const skill = read('skills/jj-team/SKILL.md');
  for (const rel of [
    'references/team-manual.md',
    'references/roles.md',
    'references/review-dimensions.md',
    'specs/state-layout.md'
  ]) {
    assert.ok(skill.includes(rel), 'SKILL.md must link ' + rel);
  }
});

test('state root is the jj-flow home, never the repo', () => {
  const skill = read('skills/jj-team/SKILL.md');
  assert.match(skill, /~\/\.jj-flow\/team\/<project_key>\//);
  assert.match(skill, /JJ_FLOW_HOME/);
  // The repo forbids .workflow/ and .plans/ is not a jj-flow convention.
  const mustNot = mustNotColumn(skill);
  assert.match(mustNot, /\.workflow/);
  assert.match(mustNot, /\.plans/);

  const layout = read('skills/jj-team/specs/state-layout.md');
  assert.match(layout, /forbidden_paths/);
  assert.match(layout, /~\/\.jj-flow\/team\//);
});

test('no repo-root CLAUDE.md is introduced', () => {
  assert.equal(exists('CLAUDE.md'), false, 'jj-team must not add a repo-root CLAUDE.md');
  const skill = read('skills/jj-team/SKILL.md');
  assert.match(mustNotColumn(skill), /CLAUDE\.md/);
  assert.match(skill, /team-snapshot\.md/);
});

test('the measurement sizes the roster — it never vetoes provisioning', () => {
  const skill = read('skills/jj-team/SKILL.md');
  assert.match(skill, /parallelism/i);
  assert.match(skill, /Measure parallelism \*\*before\*\* choosing a team size/);
  assert.match(skill, /never the reverse|not the reverse/i);
  // Both low values still provision; the number only picks the roster.
  assert.match(skill, /\|\s*0\s*\|[^|]*Still provision/);
  assert.match(skill, /\|\s*1\s*\|[^|]*Still provision/);
  assert.doesNotMatch(skill, /stand up a team/i);
  // One sizing formula, and no idle implementer on the roster
  assert.match(skill, /implementers = measured lanes/);
  assert.match(skill, /never spawn an idle implementer/i);
  // Re-measure at phase boundaries
  assert.match(skill, /phase boundary/i);
});

test('heavy work is excluded before counting lanes', () => {
  const skill = read('skills/jj-team/SKILL.md');
  assert.match(skill, /Substantively-complete/);
  assert.match(skill, /Blocked-on-decision/);
  assert.match(skill, /Blocked-on-live-host/);
  assert.match(skill, /human-serial|human serial/i);
  assert.match(skill, /File-set collisions/);
});

test('the sizing formula excludes lanes owned by team-lead', () => {
  // A lane the team-lead owns itself has nobody to dispatch it to. Counting it
  // would make `implementers = measured lanes` spawn someone idle — the exact
  // failure the formula's own anti-drift clause is there to catch. So the fix
  // belongs in the definition of the count, not in an exception beside it.
  const skill = read('skills/jj-team/SKILL.md');
  const measure = skill.split('## Parallelism measurement')[1].split('\n## ')[0];
  // Named as a measurement step, in the same numbered voice as the other
  // exclusions — not buried in prose where an editor could drop it.
  assert.match(measure, /^\d+\. \*\*Owner-is-team-lead\*\* — in-flight work the team-lead owns itself/m);
  // ...and the formula sentence carries it. A lone list item would read as advice.
  assert.match(measure, /A lane owned by team-lead is not an assignable lane/);
  assert.match(measure, /excluded from it exactly like a blocked one/);
  // The consequence stays pinned: the count must not buy an idle seat.
  assert.match(measure, /never spawn an idle implementer/i);
  // The field table records it inside the same excluded{} set as the other three,
  // so a recovering session sees the same four keys.
  const layout = read('skills/jj-team/specs/state-layout.md');
  assert.match(
    layout,
    /excluded\{substantively_complete, blocked_on_decision, blocked_on_live_host, owner_is_team_lead\}/,
    'parallelism.excluded must list all four exclusions'
  );
  // The manual states the rule where a teammate reads it.
  assert.match(read('skills/jj-team/references/team-manual.md'), /owner_is_team_lead/);
  // The design doc closed the item instead of deleting it — the closed reason is
  // the 2026-09-18 measurement that produced implementers = 0.
  const design = read('docs/design-docs/jj-team.md');
  assert.match(design, /\[x\][^\n]*owner-is-team-lead/, 'the open item must be closed, by name');
  // The example must apply the rule it just defined. It used to read
  // "1 lane → team-lead + 1 implementer + reviewer" for the very event whose only
  // lane the team-lead owned, i.e. a worked example that contradicts step 5.
  // The whole paragraph, not its first line: a contradiction added further down was
  // invisible to a first-line cut, which is how the earlier one survived a review.
  const example = skill.split('**Worked example**')[1].split('\n\n')[0];
  assert.match(example, /`implementers = 0`/, 'the worked example must size off the exclusion it defines');
  assert.doesNotMatch(example, /1 implementer/, 'the worked example must not roster an implementer for an unassignable lane');
  // ...and the closed item must not keep claiming the 0 came from outside the formula.
  assert.doesNotMatch(
    design,
    /这个 0 不是公式给的/,
    'the closed item must not contradict the exclusion now recorded in the formula'
  );
});

test('snapshot staleness is a mechanical check, not an editorial rule', () => {
  // The old state was a prose rule in the spec. The check now exists as code,
  // is reachable from every call site that would otherwise trust by eye, and
  // its behaviour is covered by tests/jj-team-snapshot-stale.test.mjs.
  assert.ok(exists('skills/jj-team/scripts/snapshot_stale.mjs'), 'the check must ship as a script');
  const skill = read('skills/jj-team/SKILL.md');
  assert.match(skill, /scripts\/snapshot_stale\.mjs/);
  // The exit contract is stated where it is used: 0 fresh / 1 stale / 2 cannot tell.
  assert.match(skill, /`0` fresh \/ `1` stale \/ `2` unverifiable/);
  // "Cannot tell" must not be readable as a pass — that is the whole exit code 2.
  assert.match(skill, /Exit `2` means "cannot tell"[\s\S]{0,120}not a pass/);
  // It is a hard boundary, not a suggestion.
  assert.match(mustNotColumn(skill), /Trust a snapshot stamp by eye/);
  // Both call sites that would trust the snapshot name the check.
  assert.match(skill, /\| `check` \/ `status` \|[^|]*snapshot staleness check/);
  assert.match(skill, /\| `resume` \|[^|]*stale or unverifiable snapshot stamp/);
  // The spec defines the stamp format exactly once, fenced so it is parseable.
  const layout = read('skills/jj-team/specs/state-layout.md');
  assert.match(layout, /staleness-stamp v1/);
  assert.match(layout, /```stamp/);
  assert.match(layout, /scripts\/snapshot_stale\.mjs/);
  // The design doc records it as mechanized, and the §8 risk paragraph agrees.
  const design = read('docs/design-docs/jj-team.md');
  assert.match(design, /scripts\/snapshot_stale\.mjs/);
  assert.match(design, /快照陈旧检测已机械化/);
  assert.doesNotMatch(design, /未做机械校验/, 'the design doc must not still call it un-mechanized');
  // The user page tells the reader how to run it and that exit 2 is not a pass.
  const page = read('docs/commands/jj-team.md');
  assert.match(page, /snapshot_stale\.mjs --team-dir/);
  assert.match(page, /`2` 不算通过/);
});

test('review rubric is the fixed generic four, not project-invented', () => {
  const skill = read('skills/jj-team/SKILL.md');
  for (const id of ['RD-1', 'RD-2', 'RD-3', 'RD-4']) {
    assert.ok(skill.includes(id), 'SKILL.md must list ' + id);
  }
  assert.match(skill, /产品深度/);
  assert.match(skill, /可测试性/);
  assert.match(skill, /性能/);
  assert.match(skill, /API 优雅/);

  const dims = read('skills/jj-team/references/review-dimensions.md');
  assert.match(dims, /do \*\*not\*\* invent project-specific ones/);
  for (const id of ['RD-1', 'RD-2', 'RD-3', 'RD-4']) {
    assert.ok(dims.includes(id), 'review-dimensions.md must define ' + id);
  }
  // Every dimension carries both anchors
  assert.equal((dims.match(/\*\*STRONG\*\*/g) || []).length, 4);
  assert.equal((dims.match(/\*\*WEAK\*\*/g) || []).length, 4);
  assert.match(dims, /Any `WEAK` → the verdict cannot be `\[OK\]`|Any `WEAK`/);
});

test('checkpoint non-authority and exclusive-assignment separation', () => {
  const skill = read('skills/jj-team/SKILL.md');
  assert.match(skill, /does NOT advance ralph\/dispatch checkpoints|never advances a ralph\/dispatch checkpoint/i);
  assert.match(skill, /ASSIGNMENT file/);
  assert.match(skill, /separate execution line/);
  // Identity separation from the sibling engines
  assert.match(skill, /TEAM-\*/);
  assert.match(skill, /TC-\*/);
  assert.match(skill, /TLV4-\*/);
  assert.match(skill, /TAS-\*/);
});

test('sibling engines are routed to, not modified', () => {
  const skill = read('skills/jj-team/SKILL.md');
  assert.match(skill, /jj-team-coordinate/);
  assert.match(skill, /jj-team-lifecycle/);
  assert.match(skill, /jj-team-swarm/);
  assert.match(skill, /do not reimplement its pipeline|Do not reimplement/i);
  // The umbrella must not claim sibling session prefixes as its own state
  assert.doesNotMatch(skill, /State root:.*TC-/);
  assert.doesNotMatch(skill, /State root:.*TLV4-/);
  assert.doesNotMatch(skill, /State root:.*TAS-/);
});

test('custodian is opt-in, with a stated trigger', () => {
  const skill = read('skills/jj-team/SKILL.md');
  assert.match(skill, /custodian/i);
  assert.match(skill, /omitted by default|opt-in|only when/i);
  const roles = read('skills/jj-team/references/roles.md');
  assert.match(roles, /custodian \(opt-in\)/);
  assert.match(roles, /duplicate infrastructure/);
});

test('message delivery constraint is stated', () => {
  const skill = read('skills/jj-team/SKILL.md');
  assert.match(skill, /only when it is \*\*idle\*\*|lands only when the recipient is \*\*idle\*\*/i);
  assert.match(skill, /Files are real-time; messages are not|Files carry continuous state/);
});

test('docs page is registered in the sidebar and the design index', () => {
  assert.ok(exists('docs/commands/jj-team.md'));
  assert.ok(exists('docs/design-docs/jj-team.md'));

  const sidebar = read('docs/.vitepress/sidebar.mjs');
  assert.ok(sidebar.includes("'/commands/jj-team'"), 'sidebar must link /commands/jj-team');

  const designIndex = read('docs/design-docs/index.md');
  assert.match(designIndex, /\[jj-team\]\(jj-team\.md\)/);
});

test('the home SSOT registers team/ as a supported directory', () => {
  // ~/.jj-flow/README.md is generated from this source; a top-level state dir
  // that the home's own index does not list reads as unsupported.
  const home = read('src/homeLayout.mjs');
  assert.match(home, /\| `team\/` \|/);
  assert.match(home, /\| `memory\/` \|/);
  // The portable copy under jj-ralph must stay byte-identical (ralph:check).
  assert.equal(
    read('skills/jj-ralph/scripts/lib/homeLayout.mjs'),
    home,
    'skills/jj-ralph/scripts/lib/homeLayout.mjs must mirror src/homeLayout.mjs'
  );
});

test('the project_key convention is named, not re-invented as a slug', () => {
  for (const rel of [
    'skills/jj-team/SKILL.md',
    'skills/jj-team/specs/state-layout.md',
    'docs/commands/jj-team.md'
  ]) {
    const doc = read(rel);
    assert.match(doc, /project_key/, rel + ' must use the product term project_key');
    assert.match(doc, /projectKeyFromPath|小写目录名|lowercased basename/, rel + ' must give the derivation');
  }
});

test('user-facing command indexes list the new entry', () => {
  // Neither surface is covered by a gate: check-docs.mjs validates docs/ sidebar
  // coverage and link targets, not these hand-maintained lists.
  const overview = read('docs/commands.md');
  assert.match(overview, /commands\/jj-team\.md/);
  const readme = read('README.md');
  assert.match(readme, /team 常驻团队/);
});

test('jj router knows about the team entry without reordering the engines', () => {
  const skill = read('skills/jj/SKILL.md');
  assert.match(skill, /description:[\s\S]*?jj-team\b/);
  const body = skill.split('## Routing priority')[1] || skill;
  const iTeam = body.indexOf('jj-team (Claude: /jj-team)');
  const iCoord = body.indexOf('jj-team-coordinate');
  assert.ok(iTeam >= 0, 'router must list jj-team');
  assert.ok(iCoord > iTeam, 'jj-team must route before the sibling engines');
  assert.match(body, /measures real parallelism first|measures parallelism first/i);
  // The router must not still promise a refusal at 0/1 lanes.
  assert.doesNotMatch(body, /says "no team" when the count is 0 or 1/);
});

test('team-session.json reuses the sibling enums and is the Phase 0 read target', () => {
  const layout = read('skills/jj-team/specs/state-layout.md');
  assert.match(layout, /team-session\.json/);
  // status is a deliberate superset of the sibling's three values
  assert.match(layout, /active[^\n]*paused[^\n]*completed[^\n]*abandoned/);
  // host_mode is the sibling's enum verbatim
  assert.match(layout, /full[^\n]*codex-degraded[^\n]*generic-degraded/);
  const sibling = read('skills/jj-team-coordinate/SKILL.md');
  assert.match(
    sibling,
    /full \| codex-degraded \| generic-degraded/,
    'the sibling enum this skill claims to reuse'
  );
  for (const field of ['team_id', 'host', 'parallelism', 'review_rubric', 'last_seen_at']) {
    assert.ok(layout.includes('`' + field + '`'), 'the field table must document ' + field);
  }
  // No auto-close: the only automatic signal is wall clock.
  assert.match(layout, /no team is ever auto-closed/i);
});

test('host detection probes capability, not brand', () => {
  const skill = read('skills/jj-team/SKILL.md');
  assert.match(skill, /once per session/i);
  assert.match(skill, /capability, not brand/i);
  assert.match(skill, /when Team\/Task APIs exist/);
  assert.match(skill, /codex-degraded/);
  assert.match(skill, /generic-degraded/);
  // A degraded host still runs the team — it is not a dead end.
  assert.match(skill, /still provisions and still runs the team/i);
});

test('Phase 0 binds a session and never fabricates an id', () => {
  const layout = read('skills/jj-team/specs/state-layout.md');
  // The env ladder must be the one src/claudeHostAdapter.mjs already reads —
  // and in the same order. Asserting only that the names appear lets a
  // reversed ladder through, which is exactly what happened once.
  const adapter = read('src/claudeHostAdapter.mjs');
  const names = ['CLAUDE_SESSION_ID', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CONVERSATION_ID'];
  const order = (text) =>
    names
      .map((n) => [n, text.indexOf(n)])
      .filter(([, i]) => i >= 0)
      .sort((a, b) => a[1] - b[1])
      .map(([n]) => n);
  // Slice on the function's own contract (`resolveClaudeSessionId` … `if (!raw)`)
  // rather than on the exact formatting of the assignment — this test must not
  // break because an unrelated file got reformatted.
  const adapterBlock = adapter.slice(
    adapter.indexOf('resolveClaudeSessionId'),
    adapter.indexOf('if (!raw)')
  );
  assert.ok(adapterBlock.includes('env'), 'precondition: the adapter ladder was located');
  assert.deepEqual(order(adapterBlock), names, 'precondition: the adapter ladder');
  assert.deepEqual(order(layout), names, 'state-layout.md must not reorder the ladder');
  // R1..R6 appear, in resolution order.
  let cursor = -1;
  for (const id of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6']) {
    const at = layout.indexOf('\n' + id + '  ');
    assert.ok(at > cursor, id + ' must appear, in order, in the Phase 0 table');
    cursor = at;
  }
  assert.match(layout, /never fabricate/i);
  assert.match(layout, /resume, do not init/i);
  // Exactly one copy: SKILL.md points at the spec instead of restating it.
  const skill = read('skills/jj-team/SKILL.md');
  assert.match(skill, /one copy/i);
  assert.doesNotMatch(skill, /^R1  live/m, 'the R-table must live in exactly one file');
  // ...and the design doc is not a third copy either. It restated the whole
  // table once, which is how it ended up naming SKILL.md as a holder of it.
  //
  // The rule is: the design doc cites no rule ids at all. A single-line regex
  // for "R1..R6 in order" is a false guarantee — a `| R1 |` table with one row
  // per line, or the spec's own multi-line block, both sail through it. The
  // doc records the *reasoning*; the ids stay in the SSOT.
  const design = read('docs/design-docs/jj-team.md');
  assert.match(design, /specs\/state-layout\.md/);
  const designRIds = design.match(/\bR[1-9]\b/g) || [];
  assert.deepEqual(designRIds, [], 'the design doc must not cite the resolution ids: ' + designRIds.join(','));
  assert.doesNotMatch(design, /R1[^\n]*全文见[^\n]*SKILL\.md/, 'SKILL.md does not hold the table');
  // The per-host ladder has one copy too; the design doc restating it is how
  // both copies got the order wrong at once. Naming one variable while
  // explaining something is fine — enumerating the ladder is not.
  for (const line of design.split('\n')) {
    const hits = names.filter((n) => line.includes(n)).length;
    assert.ok(hits <= 1, 'the ladder lives in the spec only: ' + line.trim());
  }
});

test('the new-session path is described as asking, not as a silent resume', () => {
  // R3: a different session id is a real ambiguity. The command page promised
  // an unconditional silent resume, which R3 makes false and which a user hits
  // on the very first re-invocation from a new session.
  const page = read('docs/commands/jj-team.md');
  // Positive requirement, not a bare /接管/ anywhere: some line about a new
  // session must actually say it asks. Deliberately no `|| includes('问')`
  // fallback — 问 is a high-frequency character and would match a line saying
  // the opposite ("新会话里你不用问任何东西").
  assert.ok(
    page.split('\n').some((l) => l.includes('新会话') && l.includes('接管')),
    'the new-session line must say it asks'
  );
  assert.doesNotMatch(page, /新会话[^\n]*静默 resume/, 'a new session is not a silent resume');
  const skill = read('skills/jj-team/SKILL.md');
  assert.match(skill, /specs\/state-layout\.md/);
  assert.doesNotMatch(skill, /see R1 below/, 'that pointer dangles — the table is not below');
});

test('a provisioned team makes bare turns into tasks', () => {
  const skill = read('skills/jj-team/SKILL.md');
  assert.match(skill, /Session contract/);
  assert.match(skill, /not team work/i);
  assert.match(skill, /new lane/i);
  assert.match(skill, /existing lane/i);
  // The banner is a fixed, greppable string.
  assert.match(skill, /团队已就位：TEAM-<project_key>-<date> ｜后续直接给任务（无需 \/jj-team）/);
  // Recovering the roster must not re-derive it from the (compacted) transcript.
  assert.match(skill, /Do not re-derive the roster from the transcript/i);
});

test('the command page follows the canonical nine-heading skeleton', () => {
  // No gate checks this: check-docs.mjs validates sidebar coverage, link
  // targets, the vitepress build and redirects — not the section skeleton.
  const page = read('docs/commands/jj-team.md');
  for (const heading of [
    '## 写法',
    '## 适用与边界',
    '## 开始前',
    '## 第一次这样用',
    '## 常用说法',
    '## 做完之后',
    '## 边界细则',
    '## 记录在哪',
    '## 相关'
  ]) {
    assert.ok(page.includes(heading), 'docs/commands/jj-team.md must carry ' + heading);
  }
  // Exactly nine — a bespoke top-level section is work that nothing else will
  // keep in sync. Extra material goes under `###` or inside an existing one.
  assert.equal((page.match(/^## /gm) || []).length, 9, 'the skeleton is nine sections, no more');
  // Index surfaces that no gate covers.
  assert.match(read('docs/index.md'), /\[team\]\(commands\/jj-team\.md\)/);
});
