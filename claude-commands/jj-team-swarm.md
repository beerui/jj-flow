---
name: jj-team-swarm
description: 对抗蚁群搜索（ACO + 对抗评分）；不推进 ralph/dispatch 检查点。
argument-hint: "<搜索目标 | resume | check>"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Skill
  - Agent
  - AskUserQuestion
---

# /jj-team-swarm

用户输入：$ARGUMENTS

对抗蚁群：config → aco init → 迭代 explore/score/update/converge → synthesize。  
Session：`.workflow/.team/TAS-*/`。权威 skill：`skills/jj-team-swarm/`。

## 执行要点

1. 加载 `jj-team-swarm`；解析 `scripts/aco.py` 多宿主路径。
2. **直接调用**：无强制提示。仅嵌套在 ralph/review/dispatch 时一句：`开启 swarm 模式，开始任务XXX 约 15-40分钟`。
3. Workflow 或 agent-module 降级见 `references/host-compatibility.md`。
4. **禁止**用 best-solution 直接改 ralph/dispatch gate。
5. 多角色实施用 `/jj-team-coordinate`，不是本命令。

细则：skill `SKILL.md` + `docs/design-docs/jj-team-swarm.md`。
