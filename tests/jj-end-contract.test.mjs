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

test('jj-end never merges dest into work; self-merge must keep both parents', () => {
  assert.match(skill, /G-end-3/)
  assert.match(skill, /Never\*\* merge `dev`\/integration into the work branch/)
  assert.match(skill, /Merge integration \(`dev`/)
  assert.match(skill, /checkout --ours\/--theirs/)
  assert.match(skill, /40e3f959/)
  assert.match(skill, /both parent blobs/)
  assert.doesNotMatch(skill, /merge dest into feat|merge origin\/dev into/)
})

test('jj-end asks when task, merge, or requirement is unclear', () => {
  assert.match(skill, /G-end-4/)
  assert.match(skill, /unclear task \/ merge \/ requirement/)
  assert.match(skill, /STOP and ask/)
  assert.match(skill, /cannot name both/)
})

test('jj-end finish reply is merge status plus current branch', () => {
  assert.match(skill, /## Final Response/)
  assert.match(skill, /exactly two Chinese lines/)
  assert.match(skill, /合并状态：已合并到：/)
  assert.match(skill, /合并状态：已回退：/)
  assert.match(skill, /当前分支：/)
  assert.match(skill, /Classify table is user-visible only on STOP/)
  assert.match(skill, /do not list auto-resolved files/)
  assert.doesNotMatch(skill, /\*\*one line\*\* in Chinese/)
})
