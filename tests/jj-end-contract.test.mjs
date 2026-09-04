import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skill = fs.readFileSync(path.join(root, 'skills/jj-end/SKILL.md'), 'utf8')

test('jj-end does not treat staging git-log as integration convention', () => {
  assert.match(skill, /EP-20260828/)
  assert.match(skill, /Not convention/)
  assert.match(skill, /Merge #N into staging/)
  assert.match(skill, /merge `dev` only/)
  assert.match(skill, /G-end-1/)
  assert.match(skill, /integration_source/)
  assert.match(skill, /Never print source=`git-log`/)
  assert.match(skill, /pnpm build:h5:staging/)
  assert.match(skill, /build flavor, env, or script name/)
  assert.match(skill, /Treat git log \/ MR titles/)
})

test('jj-end self-merges handleable conflicts; only unhandleable aborts whole merge', () => {
  assert.match(skill, /Conflict classify/)
  assert.match(skill, /G-end-2/)
  assert.match(skill, /prefer self-merge/)
  assert.match(skill, /Label them `self-merge`/)
  assert.match(skill, /Do \*\*not\*\* abort the whole merge because files are Vue\/docs\/logic/)
  assert.match(skill, /Do \*\*not\*\* resolve a subset then abort/)
  assert.match(skill, /Abort because a file is Vue\/docs\/logic/)
  assert.match(skill, /First-glance “this looks complex” is a \*\*misclassify\*\*/)
})

test('jj-end happy-path final reply is one line without tables', () => {
  assert.match(skill, /## Final Response/)
  assert.match(skill, /\*\*one line\*\* in Chinese/)
  assert.match(skill, /No table, no bullet list, no field dump/)
  assert.match(skill, /Classify table is user-visible only on STOP/)
  assert.match(skill, /do not list auto-resolved files/)
})
