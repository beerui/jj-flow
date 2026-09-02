---
name: jj-init
description: 接入 jj-flow：当前仓（或点名的根目录）加入全局地图、梳理家族、补知识库。不是 ralph 开 run。
argument-hint: "[当前仓 | 根目录 | 中文名称 | 家族 | 补知识库]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Skill
  - AskUserQuestion
---

# /jj-init

用户输入：$ARGUMENTS

权威 skill：`skills/jj-init/`。先 `jj init preview`，用户点头再 `join` / `ingest`。
