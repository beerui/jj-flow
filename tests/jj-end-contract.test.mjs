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

test('jj-end classifies merge conflicts; mixed simple+complex aborts whole merge', () => {
  assert.match(skill, /Conflict classify/)
  assert.match(skill, /G-end-2/)
  assert.match(skill, /Unsure → `complex`/)
  assert.match(skill, /Do \*\*not\*\* resolve a subset/)
  assert.match(skill, /Label a conflict `simple` when unsure/)
})
