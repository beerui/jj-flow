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

test('the team root is the main checkout, and the fallback is named', () => {
  const skill = read('skills/jj-team/SKILL.md');
  const layout = read('skills/jj-team/specs/state-layout.md');
  for (const doc of [skill, layout]) {
    assert.match(doc, /\.workflow\/\.team\//, 'the root is the project-internal .team directory');
    assert.match(doc, /main checkout/i, 'the root is the main checkout, not the current one');
    assert.match(doc, /forbidden_paths/, 'the fallback trigger is the manifest field, not a prose exception');
    assert.match(doc, /HNS-STATE-001/, 'the fallback is enforced by the repo\'s own gate');
    assert.match(doc, /~\/\.jj-flow\/team\//, 'the fallback root is stated');
    // $JJ_FLOW_HOME used to relocate the whole team state. It must not read
    // that way any more: a project-internal ledger ignores it entirely.
    assert.match(doc, /JJ_FLOW_HOME/);
    assert.match(doc, /moves only the fallback root/, 'the env var must be scoped to the fallback root');
  }
  // ...and the user page must not still promise a wholesale move.
  const page = read('docs/commands/jj-team.md');
  assert.match(page, /JJ_FLOW_HOME/);
  assert.doesNotMatch(page, /整体换个位置|整体覆盖/, 'the command page must not promise a wholesale move');
  // The MUST NOT column keeps the worktree fork and .plans/, and no longer
  // claims the repo is off limits wholesale.
  const mustNot = mustNotColumn(skill);
  assert.match(mustNot, /worktree/i, 'writing into a linked worktree still forks the ledger');
  assert.match(mustNot, /\.plans/);
  // No state may be written outside the one root.
  assert.match(mustNot, /outside .*\.workflow\/\.team\//i);
});

test('the main-checkout rule has one copy, and SKILL.md points at it', () => {
  // The rule used to be restated in SKILL.md next to a sentence declaring it had
  // "exactly one copy" in the spec. The guard was file-level — any occurrence in
  // the file counted — so corrupting the spec's operational line still left the
  // spec's own explanatory line satisfying it. R-3b called that "the assertion is
  // a phrase match"; the deeper cause is that the doc carried two copies of a rule
  // it declared single-source, which makes any phrase match satisfiable by the
  // wrong line.
  //
  // What this test guards is structural: the spec states the rule once, and
  // SKILL.md carries a pointer instead of a restatement.
  //
  // What it deliberately does NOT guard: that the formula is *correct*. There is
  // no implementation of this rule anywhere in the product — no code resolves the
  // team root — so no assertion can mechanically judge right from wrong. The
  // formula is also restated in four places outside this skill (design-docs twice,
  // the command page, the CHANGELOG), and nothing here sees those. A claim of
  // correctness would be the same false green this rewrite exists to remove.
  const skill = read('skills/jj-team/SKILL.md');
  const layout = read('skills/jj-team/specs/state-layout.md');

  // The spec states it once. Counting is the only thing that can catch a broken
  // operational line: "any occurrence counts" is exactly what let M1 survive.
  const formula = layout.match(/path\.resolve\(cwd, common, '\.\.'\)/g) || [];
  assert.equal(formula.length, 1, 'state-layout.md must state the resolution formula once, found ' + formula.length);
  // ...and the wrong function must not be present to satisfy anything. Without
  // this negative, replacing `resolve` with `dirname` at the operational line
  // drops the count to zero and nothing distinguishes that from a deletion.
  assert.equal(
    (layout.match(/path\.dirname\(common\)/g) || []).length,
    0,
    'the wrong function must not appear in the spec — the operational line is the only copy'
  );
  // The two existing commands stay named in the spec, so a reader is not sent to
  // a pointer that no longer holds the command.
  assert.match(layout, /git rev-parse --git-common-dir/, 'the spec names the command that resolves the root');

  // SKILL.md declares the rule single-source, then points at where it lives.
  assert.match(skill, /exactly one copy/i, 'SKILL.md must declare the spec the single source');
  assert.match(
    skill,
    /\[specs\/state-layout\.md\]\(specs\/state-layout\.md\)/,
    'SKILL.md must point at the spec rather than restate the rule'
  );
  // ...and carries neither half of the rule itself. Two negatives, because the
  // command and the formula can be reintroduced independently: a restatement that
  // keeps the command but drops the formula is still a second copy of the decision.
  assert.doesNotMatch(
    skill,
    /git rev-parse --git-common-dir/,
    'the main-checkout command belongs to the spec only — SKILL.md is the second copy'
  );
  assert.doesNotMatch(
    skill,
    /path\.resolve\(cwd, common, '\.\.'\)/,
    'the resolution formula belongs to the spec only — SKILL.md is the second copy'
  );
  assert.doesNotMatch(
    skill,
    /path\.dirname\(common\)/,
    'the wrong function must not be introduced by a restatement either'
  );
});

test('no repo-root CLAUDE.md is introduced', () => {
  assert.equal(exists('CLAUDE.md'), false, 'jj-team must not add a repo-root CLAUDE.md');
  const skill = read('skills/jj-team/SKILL.md');
  assert.match(mustNotColumn(skill), /CLAUDE\.md/);
  assert.match(skill, /team-snapshot\.md/);
});

test('the home SSOT registers team/ as a fallback directory, not a global layer', () => {
  // ~/.jj-flow/README.md is generated from this source; a top-level state dir
  // that the home's own index does not list reads as unsupported.
  const home = read('src/homeLayout.mjs');
  assert.match(home, /\| `team\/` \|/);
  assert.match(home, /\| `memory\/` \|/);
  // Registering the row is not enough: the description used to read as the
  // global layer, which sends the next reader to home for a project that can
  // use its own .workflow/.team/.
  const row = home.split('\n').find((line) => line.includes('| `team/` |'));
  assert.ok(row, 'src/homeLayout.mjs must register the team/ row');
  assert.match(row, /fallback/i, 'the team/ row must say it is a fallback');
  assert.match(row, /forbid/i, 'the team/ row must name what triggers the fallback');
  // The portable copy under jj-ralph must stay byte-identical (ralph:check).
  assert.equal(
    read('skills/jj-ralph/scripts/lib/homeLayout.mjs'),
    home,
    'skills/jj-ralph/scripts/lib/homeLayout.mjs must mirror src/homeLayout.mjs'
  );
});

test('the project_key convention is named, not re-invented as a slug', () => {
  // Three files used to carry three different derivations ("lowercased basename
  // of the project path", "lowercased basename of the git root walked up from
  // cwd", "the row's path in map.md"). The rule now names the one
  // implementation, and the authoritative value is the field on disk.
  const layout = read('skills/jj-team/specs/state-layout.md');
  assert.match(layout, /resolveProjectKeyFromCwd/, 'the spec must name the one implementation');
  assert.match(layout, /authoritative/i, 'the spec must say which value is authoritative');
  // ...and it must not claim jj-team calls it: nothing on this path does.
  assert.doesNotMatch(layout, /团队键由它解析/, 'no code on the jj-team path calls it');
  for (const rel of [
    'skills/jj-team/SKILL.md',
    'skills/jj-team/specs/state-layout.md',
    'docs/commands/jj-team.md'
  ]) {
    const doc = read(rel);
    assert.match(doc, /project_key/, rel + ' must use the product term project_key');
    assert.match(doc, /team-session\.json/, rel + ' must name where the authoritative value lives');
  }
  // A second derivation wording in a reader-facing surface is the drift this
  // test exists to stop: the spec names the function, the rest must not
  // re-state the algorithm in their own words.
  for (const rel of ['skills/jj-team/SKILL.md', 'docs/commands/jj-team.md']) {
    assert.doesNotMatch(
      read(rel),
      /projectKeyFromPath|lowercased basename|小写目录名/,
      rel + ' must not carry a second derivation wording'
    );
  }
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
  // `optional_only` is a fifth exclusion with its own reason to report. The live
  // ledger already carried the key while the spec had four, so a reader comparing
  // them saw a bucket the spec could not explain. It is pinned here as a
  // measurement step (same numbered voice as the others) and in the field table,
  // and the two must agree — a key in one and not the other is the drift.
  assert.match(measure, /^\d+\. \*\*Owner-is-team-lead\*\*/m, 'precondition: the step numbering was located');
  assert.match(
    measure,
    /Optional-only.*deliberately not done/i,
    'optional_only must be defined as a measurement step, and as "deliberately not done"'
  );
  assert.match(
    measure,
    /not fully orthogonal/i,
    'the two buckets overlap in practice; the spec must say so rather than imply they do not'
  );
  // The field table records the same five keys, so a recovering session sees one set.
  const layout = read('skills/jj-team/specs/state-layout.md');
  assert.match(
    layout,
    /excluded\{substantively_complete, optional_only, blocked_on_decision, blocked_on_live_host, owner_is_team_lead\}/,
    'parallelism.excluded must list all five exclusions'
  );
  // `measured` is only meaningful with the lanes behind it. The ledger's lanes[]
  // elements carry lane_id / description / unblocked / owner / files[]; the spec
  // must say so, or a recovering session cannot tell what a lane entry is.
  assert.match(
    layout,
    /lanes\[\{lane_id, description, unblocked, owner, files\[\]\}\]/,
    'the spec must state the lanes[] element shape'
  );
  assert.match(layout, /measured` is the number of `unblocked` lanes/, 'measured must be defined off the lanes');
  // ...and tasks[].status is an enum, not free text. The live ledger had written
  // two different words for what reads as the same terminal state, which is what
  // an undefined enum costs.
  assert.match(
    layout,
    /`status` is `in_progress \\| landed \\| done`/,
    'tasks[].status must be an enumerated set'
  );
  assert.match(layout, /`closed_at` is required for `landed` and `done`/, 'the terminal states require closed_at');
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

test('the staleness exit contract is stated as four codes wherever it is enumerated', () => {
  // T-6 added exit code 3 (usage) to snapshot_stale.mjs. Every doc that
  // enumerated the codes still said three, so a reader who only meets the docs
  // concludes a mistyped command is a snapshot verdict.
  //
  // The target list below was built by scanning the whole lane file set with the
  // widest pattern (a bare `[0-3]`) and reading every hit. The plan's own list
  // came from scanning four candidate files and was two short: the two
  // design-doc lines here were found only by scanning all of them. Same root
  // cause the plan recorded against itself — searching by word misses.
  const enumerated = [
    ['skills/jj-team/SKILL.md', /\(exit `0`\/`1`\/`2`\/`3`\)/],
    ['skills/jj-team/SKILL.md', /`0` fresh \/ `1` stale \/ `2` unverifiable \/ `3` usage/],
    ['skills/jj-team/specs/state-layout.md', /\| `3` \| usage/],
    ['skills/jj-team/specs/state-layout.md', /Exit `3` is separate from `2`/],
    ['skills/jj-team/references/team-manual.md', /exit `0` = fresh.*`1` = regenerate first.*`2` = cannot verify.*`3` = the command itself was mistyped/],
    ['docs/commands/jj-team.md', /`3` = 命令本身打错了/],
    ['docs/design-docs/jj-team.md', /0 \/ 1 \/ 2 \/ 3 退出码回答/],
    ['docs/design-docs/jj-team.md', /以退出码 0 \/ 1 \/ 2 \/ 3 回答/]
  ];
  for (const [rel, pattern] of enumerated) {
    assert.match(read(rel), pattern, rel + ' must state the fourth exit code at ' + pattern);
  }
  // Two further lines name a subset and stay true as written: SKILL.md's `check`
  // row and its error-handling row each name `1` and `3` only. Neither claims to
  // be an enumeration and each is internally consistent, so neither is pinned
  // here — an assertion that covered them would be a guarantee this test does not
  // have.
  //
  // team-manual.md's Recover row used to be counted in that "not claimed" set. It
  // enumerates all four codes and it is the **resume** call site, so a missing code
  // there is not a wording gap — resume would hand out a wrong verdict. That is
  // the difference this list actually turns on, and it is why the entry above was
  // added: not "it mentions codes" but "a reader acts on the missing one".
});

test('the resolution table cannot fall through to a silent second provisioning', () => {
  // The old R3 required "both ids known". A live team bound to someone else's
  // id, on a host that cannot read its own id, matched no rule at all — and
  // "no rule matched" used to mean "provision", i.e. the one outcome this entry
  // exists to prevent, taken silently.
  const layout = read('skills/jj-team/specs/state-layout.md');
  const table = layout.split('Step 0 — identity')[1].split('\n```')[0];
  // The condition line itself, not the paragraph that explains what used to be
  // wrong with it — quoting the old wording in prose is how the fix stays
  // reviewable.
  const r3 = table.split('\n').find((line) => line.startsWith('R3  '));
  assert.ok(r3, 'the R3 condition line must be locatable');
  assert.doesNotMatch(r3, /both ids known/, 'R3 must not require my own id to be readable');
  assert.match(r3, /the team's host\.session_id is known AND it is not mine/);
  // ...and the table is total: an unmatched state asks instead of provisioning.
  assert.match(table, /The table is total/, 'the resolution table must state its own totality');
  assert.match(table, /NOT a licence to\s+provision|not a licence to provision/i, 'no match must not provision');
  assert.match(table, /print the state that matched and ask/i);
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

test('the roles reference carries the working method, once', () => {
  // F-5: the skill source had no working method at all, so every team re-derived
  // it by hand in the onboarding prompts. The five rules below are the gap.
  // F-25-T8-1/T8-3 are the other half: the method is stated **once**. The
  // implementer's "surface discipline" bullet used to restate Doc-Code Sync in
  // full; it is now a pointer, because a second copy of a rule is what drifts.
  const roles = read('skills/jj-team/references/roles.md');
  const method = roles.split('## Working method')[1].split('\n## ')[0];
  assert.ok(method, 'precondition: the working-method section was located');
  for (const [label, re] of [
    ['vertical slicing', /Vertical slicing/],
    ['TDD', /TDD/],
    ['the mock boundary', /Mock boundary/],
    ['doc-code sync', /Doc-Code Sync/],
    ['the anti-illusion protocol', /Anti-illusion protocol/]
  ]) {
    assert.match(method, re, 'the working method must state ' + label);
  }
  // The behaviour-over-implementation rule is the load-bearing half of TDD; a
  // method section that says "TDD" without it is the version that breaks on
  // every refactor.
  assert.match(method, /behaviour, not implementation/i);
  assert.match(method, /mock the thing under test/i, 'the forbidden mock must be named, not implied');
  assert.match(method, /did not write the test/i, 'the anti-illusion protocol must cover an unrun test');
  // ...and the method must not have a second copy in the implementer section.
  const implementer = roles.split('## implementer')[1].split('\n## ')[0];
  assert.match(
    implementer,
    /Surface discipline.*Doc-Code Sync/s,
    'the implementer must point at Doc-Code Sync rather than restate it'
  );
  assert.doesNotMatch(
    implementer,
    /drift waiting to be found/,
    'that sentence belongs to the method section only — a second copy is the drift this lane closes'
  );
  // Methodology only: the roster above is unchanged, and custodian stays opt-in.
  assert.match(roles, /custodian \(opt-in\)/);
  assert.match(roles, /duplicate infrastructure/);
});

test('peer delivery is described as the host allows, never as a promise', () => {
  // F-6: the manual told an implementer to message the reviewer "directly, not
  // through team-lead". On a host whose ListAgents returns agent ids only, no
  // name resolves — so the instruction failed at the first attempt and the
  // teammate had no way to tell a host limitation from its own mistake.
  const manual = read('skills/jj-team/references/team-manual.md');
  const comms = manual.split('## Communication')[1].split('\n## ')[0];
  assert.ok(comms, 'precondition: the Communication section was located');
  assert.doesNotMatch(
    comms,
    /not through team-lead/,
    'direct peer messaging must not be promised where names do not resolve'
  );
  assert.match(comms, /agent id/i, 'the relay path must name the handle a host actually hands back');
  assert.match(comms, /host fact/i, 'the reason must be stated — it is a host fact, not a protocol choice');
  // The onboarding-prompt rule: never write the promise the host cannot keep.
  assert.match(comms, /never.*promise|Do not write an onboarding prompt/i);
  // The status-check table must not promise a board the host may not have.
  const checks = manual.split('## Status checks')[1];
  assert.match(checks, /only where `task_board: true`/i, 'TaskList must be gated on the capability');
});

test('docs page is registered in the sidebar and the design index', () => {
  assert.ok(exists('docs/commands/jj-team.md'));
  assert.ok(exists('docs/design-docs/jj-team.md'));

  const sidebar = read('docs/.vitepress/sidebar.mjs');
  assert.ok(sidebar.includes("'/commands/jj-team'"), 'sidebar must link /commands/jj-team');

  const designIndex = read('docs/design-docs/index.md');
  assert.match(designIndex, /\[jj-team\]\(jj-team\.md\)/);
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
  // host_mode is gone. One enum could not say "teammates but no task board", and
  // this repo's host is exactly that, so the honest record is two independent
  // bits. A fourth enum value was the rejected fix: it moves the shortage to the
  // next host instead of removing it, which is why the rejection is recorded.
  assert.doesNotMatch(layout, /^\| `host_mode` \|/m, 'host_mode must not remain a field of its own');
  assert.match(layout, /replaces the sibling's `host_mode`/, 'the replacement must be declared, not silent');
  // Step 0's pseudocode must name the two bits, not the retired enum: someone
  // executing it literally writes host_mode back into team-session.json, which
  // is exactly what the split removed. The row-form ban above cannot see this —
  // :107 is pseudocode inside a code fence, not a table row, so without a count
  // the word survives in precisely the one place a reader copies from.
  // Counted, not merely present: the guard is only real if the total is 1 (the
  // declaration above) rather than 0, which would also pass a "must not appear".
  const hostModeMentions = (layout.match(/host_mode/g) || []).length;
  assert.equal(hostModeMentions, 1, 'host_mode may be named once, where the replacement is declared — found ' + hostModeMentions);
  assert.match(layout, /\{teammates, task_board\}/, 'the two capability bits must be named');
  // ...and this repo's host must be recorded by the combination that forced the
  // change. Without this the spec names two bits but never says which host has
  // which, and a recovering session cannot tell whether the split was needed.
  assert.match(
    layout,
    /teammates: true` \+ `task_board: false/,
    'the spec must record this repo\'s host as teammates-without-a-board — that combination is why the enum had to go'
  );
  assert.match(
    layout,
    /fourth enum value was the rejected fix/i,
    'the rejected alternative must be recorded, or the next host adds a fifth value'
  );
  // The sibling keeps its enum — this skill deviates from it, the sibling does not.
  const sibling = read('skills/jj-team-coordinate/SKILL.md');
  assert.match(
    sibling,
    /full \| codex-degraded \| generic-degraded/,
    'the sibling enum this skill claims to reuse'
  );
  for (const field of ['team_id', 'host', 'parallelism', 'review_rubric', 'last_seen_at', 'capabilities']) {
    assert.ok(layout.includes('`' + field + '`'), 'the field table must document ' + field);
  }
  // No auto-close: the only automatic signal is wall clock.
  assert.match(layout, /no team is ever auto-closed/i);
});

test('host detection probes capability, not brand', () => {
  const skill = read('skills/jj-team/SKILL.md');
  assert.match(skill, /once per session/i);
  assert.match(skill, /capability, not brand/i);
  // The result is two independent booleans, not one mode. Asserting the old
  // "Team/Task APIs exist" wording would have kept a probe that cannot see this
  // repo's host, which has one capability and not the other.
  assert.match(skill, /two independent booleans/i, 'the probe records two independent booleans');
  assert.match(skill, /`teammates: true` \+ `task_board: false`|teammates: true.*task_board: false/i,
    'this repo\'s host must be recordable as teammates-but-no-board');
  assert.match(skill, /teammates: false/);
  assert.match(skill, /task_board: true/);
  // The retired enum is named as retired, with the reason it could not survive.
  assert.match(skill, /retired three-value `host_mode`/i, 'the retired enum must be named as retired');
  assert.match(skill, /codex-degraded/);
  assert.match(skill, /generic-degraded/);
  // A host without teammates still runs the team — it is not a dead end.
  assert.match(skill, /still provisions and still runs the team/i);
  assert.match(skill, /what is lost is concurrency, not the team/i);
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
  // ...and the Lifecycle diagram is not a fourth copy either. It used to spell
  // `resolve + bind (R1-R6)` inline — one line standing in for six rows. O1
  // rewrites that line into an explicit "provision a second team", which is the
  // one outcome R6's totality clause exists to prevent, and which no phrase
  // check on the *table* can see. So the guard is on the line itself: it must
  // point at the spec, name the resume outcome, and offer no provisioning branch.
  //
  // Why forbidding `provision` on that one line is not over-tight: R6's own row
  // does provision (nothing found), so the line is not allowed to enumerate the
  // table — it points. Any outcome a one-line summary *does* name is a claim
  // about the branches, and the only claim a reader acts on is "re-invoking never
  // quietly gives me a second team".
  const lifecycle = skill.slice(
    skill.indexOf('## Lifecycle'),
    skill.indexOf('## Commands')
  );
  assert.ok(lifecycle.length > 0, 'precondition: the Lifecycle section was located');
  const phase0 = lifecycle.split('\n').find((l) => l.includes('Phase 0'));
  assert.ok(phase0, 'precondition: the Phase 0 line was located');
  assert.match(phase0, /specs\/state-layout\.md/, 'the Phase 0 line points at the spec; it does not restate the table');
  assert.match(phase0, /resume/, 'the Phase 0 line still names the resume outcome');
  assert.doesNotMatch(
    phase0,
    /provision/i,
    'the Phase 0 line must not offer provisioning as a branch — R6 makes the table total'
  );
  assert.doesNotMatch(
    phase0,
    /fall[- ]?through/i,
    'an unmatched state asks; nothing falls through'
  );
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

test('staleness is two conditions, and the undecidable one offers nothing', () => {
  // The rule used to be one sentence: "> 14d and no live teammates → print one
  // line and offer close". Both halves were undefined — what bumps last_seen_at,
  // and how anyone counts live teammates. On a host with no teammate roster the
  // second half is not measurable at all, so the sentence was a promise no host
  // could keep. Both halves are now defined together, and the unmeasifiable one
  // has its own verdict.
  const layout = read('skills/jj-team/specs/state-layout.md');
  const stale = layout.split('## Staleness and closing')[1].split('\n## ')[0];
  assert.ok(stale, 'precondition: the staleness section was located');
  // Condition 1: the clock, and what it actually measures.
  assert.match(stale, /now - last_seen_at > 14d/, 'the wall-clock window is stated');
  assert.match(
    stale,
    /last \*invoked\*, not when anyone last \*worked\*/i,
    'last_seen_at must say what it measures — a working team reads stale without a re-invocation'
  );
  // Condition 2: liveness, and the case where it cannot be measured.
  assert.match(stale, /no live teammates/i, 'the liveness condition is stated');
  const undecidable = stale.split('\n').filter((l) => /undecidable/i.test(l));
  assert.ok(undecidable.length > 0, 'precondition: a line naming the undecidable case was located');
  // The verdict must ride on the line that names the case, not appear somewhere
  // else in the section: a bare /undecidable/ match is satisfied by the line that
  // merely introduces the word while the rule it should carry is deleted.
  assert.ok(
    undecidable.some((l) => /report only/i.test(l)),
    'the undecidable case must carry the report-only verdict on its own line'
  );
  // ...and the case must be *established*, not merely handled if it ever arises.
  // This repo is the one that hits it, so the spec has to name it with the
  // capability that makes it so — otherwise "when condition 2 is undecidable"
  // is a conditional with nothing showing it ever applies here.
  assert.ok(
    undecidable.some((l) => /ListAgents/.test(l)),
    'the spec must name this host as the undecidable case, with the capability that makes it so'
  );
  assert.ok(
    undecidable.some((l) => /cannot address them by name/i.test(l)),
    'the reason must be stated — a bare "some hosts" leaves this repo guessing whether the rule applies to it'
  );
  assert.ok(
    undecidable.every((l) => !/offer `close`/.test(l)),
    'no line naming the undecidable case may offer close'
  );
  // ...and the degraded branch must say it offers nothing rather than trailing
  // off into a promise.
  const reportOnly = undecidable.find((l) => /report only/i.test(l));
  assert.match(reportOnly, /offer nothing/, 'the degraded branch must say it offers nothing');
  assert.match(
    reportOnly,
    /must not produce a `close` offer/i,
    'an unverifiable condition must not produce a close offer'
  );
  // The error-handling row must carry the same two branches. A row that offers
  // close unconditionally re-creates the promise one layer up.
  const skill = read('skills/jj-team/SKILL.md');
  const row = skill.split('\n').find((l) => l.startsWith('| Team stale'));
  assert.ok(row, 'precondition: the Team stale row was located');
  assert.match(row, /undecidable/i, 'the row must name the undecidable case');
  assert.match(row, /offer nothing/i, 'the row must say the undecidable case offers nothing');
  assert.match(row, /specs\/state-layout\.md/, 'the row points at the full rule instead of restating it');
});

test('rebuild rebuilds the same team and is not a second live team', () => {
  // "Stand up a fresh roster" read as either a same-team rebirth or a second
  // live team. R5 already decides the second one — it is an AskUserQuestion, not
  // a command — so the row has to say which of the two `rebuild` is, or a reader
  // provisions a duplicate team through a command that was never meant to.
  const skill = read('skills/jj-team/SKILL.md');
  const row = skill.split('\n').find((l) => l.startsWith('| `rebuild`'));
  assert.ok(row, 'precondition: the rebuild row was located');
  assert.match(row, /same.*team/i, 'rebuild is a same-team rebirth');
  assert.match(row, /keep the `team_id`/, 'rebuild keeps the identity and the ledger');
  assert.match(row, /not.*second live team/i, 'rebuild is explicitly not a second live team');
  assert.match(row, /R5/, 'the second-team case is routed to R5, not to this command');
});

test('a provisioned team makes bare turns into tasks', () => {
  const skill = read('skills/jj-team/SKILL.md');
  assert.match(skill, /Session contract/);
  assert.match(skill, /not team work/i);
  assert.match(skill, /new lane/i);
  assert.match(skill, /existing lane/i);
  // The banner is a fixed, greppable string. The date slot is spelled the same
  // way `team_id` spells it — a reader who copies the banner must not end up with
  // a directory name the Phase 0 glob would never match.
  assert.match(skill, /团队已就位：TEAM-<project_key>-<YYYYMMDD> ｜后续直接给任务（无需 \/jj-team）/);
  assert.doesNotMatch(skill, /TEAM-<project_key>-<date>/, 'the shorter <date> spelling must not survive beside it');
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
