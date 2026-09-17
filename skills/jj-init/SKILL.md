---
name: jj-init
description: "Onboard jj-flow home: join ~/.jj-flow/map.md, group families, backfill knowledge. Triggers: $jj-init, /jj-init, 接入, 梳理项目, 初始化地图, 加入全局地图, 构建知识库, 补充全局知识（bootstrap）. Not ralph run init. Not doctor/map lookup. Mechanical: jj init preview|join|ingest."
---

# jj-init

Write `~/.jj-flow/map.md` and bootstrap home knowledge after the user confirms. Delivery skills only **read** the map.

## Immediate actions

Users do not run CLI. Invoke per [cli-agent.md](../jj/references/cli-agent.md).

1. `jj init preview [--cwd] [--root DIR] [--json]`. Default = cwd. User names a root directory → `--root DIR` (that directory + its **immediate** child repos).
2. 🔴 **CHECKPOINT:** show `user_view`. Remainder keys → ask which to join.
   - Name: user speech wins; else keep preview's name — **do not invent a Chinese product name**.
   - Family: user speech wins; else **suggest** preview's family. Do not invent a new family. Empty / ambiguous → ask. 「加入」without override uses the suggestion (`join` guesses if `--family` omitted).
   - Already indexed: skip join; ingest only approved packages.
3. After yes: `jj init join --path … --name "…" [--aliases a,b] [--family "…"]`. Then `jj init ingest --run-id …` or `--file …` for each approved package.
4. Short report: home path, joined rows, ingest counts.

## Failure

| Trigger | First fix | Still fails |
| --- | --- | --- |
| Missing home | preview creates empty structure | Use paths preview reports; do not invent home/map locations |
| User did not confirm | Stop writes | Continue unindexed |
| Path already indexed | Report `exists`; skip join | Ingest only if they approve packages |
| Ingest file missing / no `project_key` | Skip that package | Fail-open; map row still valid |

## Not this skill

| Intent | Use |
| --- | --- |
| New ralph run / `$jj-ralph init` | `$jj-ralph` |
| This-run feed after archive | `$jj-ralph` 「写入知识库」 |
| Read paths / whether cwd is indexed | `jj doctor` (short Chinese `user_view`) |
| Port / dispatch | `$jj-same` / `$jj-dispatch` |

## Examples

```text
$jj-init
$jj-init 当前仓加入全局地图，中文名称姐姐
$jj-init 梳理 D:\2025，家族中国大集
$jj-init 把本仓已有 ralph 贡献补进知识库
```
