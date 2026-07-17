---
name: jj-evolve
description: 维护 jj-flow 项目本身时使用；根据自检结果、路线图和用户反馈推进下一轮演进。
argument-hint: "<自检结果、用户反馈、路线图或迭代目标>"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Skill
  - AskUserQuestion
---

# /jj-evolve

用户输入：$ARGUMENTS

读取 `.workflow/project.md`、`.workflow/roadmap.md`、`.workflow/state.json` 和最近自检证据。先修正自检失败和用户反馈指出的方向错误，再推进路线图能力。保持 `jj-flow` 是 Maestro 上层协议，不重写 Maestro core。**禁止调用 `maestro explore`**。