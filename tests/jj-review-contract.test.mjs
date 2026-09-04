import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skill = fs.readFileSync(path.join(root, 'skills/jj-review/SKILL.md'), 'utf8')

test('jj-review finish reply is 通过 plus summary, or problem plus 修改意见', () => {
  assert.match(skill, /通过。/)
  assert.match(skill, /一句总结/)
  assert.match(skill, /修改意见/)
  assert.match(skill, /STOP template on BLOCKED/)
  assert.doesNotMatch(skill, /same-turn/)
  assert.doesNotMatch(skill, /one-line on PASS/)
  assert.match(skill, /Wait for the user to say 「按审查改」/)
})

test('jj-review unbound when no ralph run; never init', () => {
  const host = fs.readFileSync(path.join(root, 'skills/jj-review/references/host-review.md'), 'utf8')
  assert.doesNotMatch(skill, /reason: no_ralph_run/)
  assert.match(skill, /Unspecified and no run → \*\*unbound\*\*; continue/)
  assert.match(skill, /Unbound review of working tree \/ HEAD/)
  assert.match(skill, /never init/i)
  assert.match(skill, /Explicit `run_id` named but missing/)
  assert.match(skill, /\*\*Persist\*\* — \*\*bound run only/)
  assert.match(host, /persist `REV-\*\.json` only when a ralph run is bound/)
  assert.match(host, /unbound\s+→ chat only/)
})

test('jj-review locates unspecified run from index.md 活跃 first', () => {
  const layout = fs.readFileSync(path.join(root, 'skills/jj-review/references/report-layout.md'), 'utf8')
  assert.match(skill, /index\.md/)
  assert.match(skill, /read `index\.md` \*\*活跃\*\* first/)
  assert.match(skill, /do not glob until that table is empty/)
  assert.match(skill, /else currently working from index\.md/)
  assert.match(layout, /currently working/)
  assert.match(layout, /## 活跃/)
  assert.match(layout, /\.workflow\/ralph\/index\.md` first/)
  assert.match(layout, /prefer status `IN_PROGRESS`/)
  assert.match(layout, /No 活跃 row \/ no `index\.md` → fallback glob/)
  assert.match(layout, /live `\.\workflow\/ralph\/<task_key>\/\.state\/run\.json`/)
  assert.doesNotMatch(layout, /pick latest among `\.\workflow\/ralph\/tasks\/\*\//)
})
