---
name: jj-init
description: "Onboard jj-flow home: join ~/.jj-flow/map.md, group families, backfill knowledge. Triggers: $jj-init, /jj-init, 接入, 梳理项目, 初始化地图, 加入全局地图, 构建知识库, 补充全局知识（bootstrap）. Not ralph run init. Not doctor/map lookup. Mechanical: jj init preview|join|ingest."
---

# jj-init

Write `~/.jj-flow/map.md` and bootstrap home knowledge after the user confirms. Delivery skills only **read** the map.

`$jj-ralph init` opens a single-repo **run**. This skill is machine/project onboarding.

## Immediate actions

Users do not run CLI. Resolve: `jj` on PATH, else `node <repo>/bin/jj.mjs`, else `npx @brewer/jj-flow`. `--json` is for you. Never paste JSON. `user_view` is a hint, not a paste target.

1. `jj init preview [--cwd] [--root DIR] [--json]` — create empty `~/.jj-flow` if missing; list indexed vs proposed rows and pending `knowledge-contribution.json`. Default = cwd only. `--root` = that directory + its **immediate** child repos.
2. 🔴 **CHECKPOINT:** show a **short** Chinese proposal (中文名称 / aliases / family / pending count) — not the raw CLI dump.
   - One line per project: `已在地图|待加入  名称  (key)  path  家族=…  待投喂=N`
   - Cap **12** project lines; then `其余 M 仓：key1, key2, …` and ask which to join.
   - Do not list contribution titles except: cwd row ≤3 titles; `--root` only `key N` for ≤5 keys with N>0.
   - Name: user speech wins; else AGENTS.md heading or package/dir name — **do not invent a Chinese product name**.
   - Family: empty unless the user names one (preview lists existing families).
   - Already indexed: skip join; only ingest packages they approve.
3. After yes: `jj init join --path … --name "…" [--aliases a,b] [--family "…"]`. Then `jj init ingest --run-id …` or `--file …` for each approved package.
4. Short report: home path, joined rows, ingest counts.

## Failure

| Trigger | First fix | Still fails |
| --- | --- | --- |
| Missing home | preview creates empty structure | Do not invent `/portfolio` paths |
| User did not confirm | Stop writes | Continue unindexed |
| Path already indexed | Report `exists` | Do not duplicate the row |
| Ingest file missing / no `project_key` | Skip that package | Fail-open; map row still valid |

## Not this skill

| Intent | Use |
| --- | --- |
| New ralph run | `$jj-ralph` |
| This-run feed after archive | `$jj-ralph` 「投喂知识库」 |
| Read paths / whether cwd is indexed | `jj doctor` (short Chinese `user_view`) |
| Port / dispatch | `$jj-same` / `$jj-dispatch` |

## Examples

```text
$jj-init
$jj-init 当前仓加入全局地图，中文名称姐姐
$jj-init 梳理 D:\2025，家族中国大集
$jj-init 把本仓已有 ralph 贡献补进知识库
```
