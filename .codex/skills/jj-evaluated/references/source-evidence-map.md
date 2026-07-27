# Current source evidence map

This file records the first observed sample used to shape the skill. It is a
baseline for evaluation, not a new authority for project routing. Re-discover
paths and verify branch/commit state before using them in a new episode.

## Observed role mapping

| Role | Observed repository | Use in evaluation |
| --- | --- | --- |
| 承接前台 | `D:\codeup\chengjie\cj-frontend-web` | target/source role in the older password-reminder wave; verify per episode |
| 兑接前台 | `D:\codeup\duijie\dj-frontend-web` | target role in the older wave; verify per episode |
| 承载前台 | `D:\codeup\chengjie\cz-broker-web` | source project for the newer enterprise-tag handoff sample |
| draft-manager candidate | `D:\codeup\chengjie\cz-draft-manager-web` | exists, but the sampled wave did not establish it as the active source |

Do not substitute the last row for 承载 without current evidence.

## Representative episodes

Observed evidence roots for the first sample include:

- `D:\codeup\chengjie\cj-frontend-web\.workflow\.csv-wave`
- `D:\codeup\duijie\dj-frontend-web\.workflow\.csv-wave`
- `D:\codeup\chengjie\cj-frontend-web\.workflow\ralph`
- `D:\codeup\chengjie\cz-broker-web\.workflow\.csv-wave\20260724-analyze-source-acceptor-enterprise-tag-right-align\requirement-baseline`

These paths are input references only. Recheck existence, hashes, branch and
commit before treating an artifact as part of a new episode.

### Older password-reminder wave

Thread `019f5a11-daa6-7bb1-85b0-2017cb3e5d38` contains representative active
turns: initial analysis (~3 min), scope confirmation (~1 min), design/screenshot
supplement (~21 min), a `window.require` correction (~2.7 min), original
execution/verification (~86.5 min), current-page popup correction (~54.2 min),
and final commit (~4.1 min). These are thread-derived active-turn estimates,
not authoritative wall time. The dominant signals are repeated analysis,
correction/rework, and expensive validation waits.

### New enterprise-tag handoff

Thread `019f9446-8672-73f0-b928-f4831433c25f` produced HOF-001 and HOF-002
blocked snapshots, then HOF-003 as the fresh successor after branch/dirty-state
correction. Source commit:
`d54b25cdb28484855153a3f0e3ea5887331b533b`.

Both targets consumed HOF-003 without rebuilding source analysis. The observed
target artifact spans were about 1 second for 承接 and 80 seconds for 兑接;
source-to-target commit wall spans were about 36 and 53 minutes respectively.
Those wall spans include waiting and must be split into active, handoff, tool,
and human attention time in a future export.

## Data-quality warnings

- `.csv-wave` file mtimes can span only 0–1 seconds despite long conversations;
- some old directories span hours because of pauses or multiple sessions;
- ralph `run.json` exposes `created_at`/`updated_at`, while `progress.md` can
  exceed that interval;
- duplicate `run.json` files can exist in active/archive locations.

Use these warnings as test cases for `clock_quality`, not as reasons to discard
the episodes. The first high-value optimization hypothesis is handoff reuse with
successor/freshness validation; reducing repeated source analysis matters more
than shaving an artifact-write second.
