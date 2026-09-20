# Assignment spawn

Parent is team-lead. `$jj-ralph` / `$jj-review` / `$jj-same` follow these rules on every conversational spawn. Do not restate them in those skills.

## Announce

**Before the spawn tool call**, one user-visible line naming who and what. Do not wait silently.

| Path | Line |
| --- | --- |
| ralph TASK | **派遣开发实现** / **派遣前端开发实现任务** |
| ralph FIX | **派遣按审查改** |
| review (and ralph 大功能) | **派遣审查** (e.g. 派遣 reviewer 审查改动代码); follow-up **派遣审查（delta）** |
| same RESEARCH | **派遣调研** |
| same HANDOFF | **派遣交接实施** (e.g. 派遣开发实施交接) |

## Occupancy

A live `[reviewer]` still running → **do not spawn** another slice (including `$jj-same` / RESEARCH). Announce 审查还在跑; keep `[reviewer]` labeled. Occupancy wins over spawn-this-turn. `send_subagent_message` only steers that live child, never a different slice.

Multiple live `[research]` / `[implementer]` **this turn** are allowed when **cwd differs** (independent projects). Same cwd write stays serial. Do not serialize independent-project HANDOFF behind Mode S.

## Resume

Same type + same cwd + completed → `resume_from` that id with a new exclusive assignment.
Different persona or different cwd → new spawn (`resume_from` inherits cwd).
Do not resume a reviewer as implementer or researcher. Do not resume a source-repo implementer into a target-repo HANDOFF.

## Description

Spawn description **starts with** the persona tag (Occupancy reads it):

| Path | Tag |
| --- | --- |
| ralph TASK / FIX, same HANDOFF | `[implementer]` |
| review (and ralph 大功能) | `[reviewer]` (never `[reviewer] local changes`) |
| same RESEARCH | `[research]` |

## Assignment paths

Exclusive assignment `## 读这些` / `## 交付` = **exact paths**. Not「以现有代码为准」. never sample session/commit ids.
