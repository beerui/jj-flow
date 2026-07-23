---
name: jj-ralph
description: 单仓全流程自治闭环；需求分析 → 计划实施 → 验收完成 → 归档；文档留痕、能力地图、仅必要时介入。
argument-hint: "<目标、资料、范围、验收，或 run_id / 查地图关键词>"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Skill
  - AskUserQuestion
---

# /jj-ralph

用户输入：$ARGUMENTS

在**当前单一业务仓库**执行 Ralph 闭环：ANALYZE → PLAN → DELIVER → ACCEPT → ARCHIVE。全步骤写入 `.workflow/ralph/ralphs/<run_id>/`，能力地图为 `.workflow/ralph/business-map.json`。

代码定位用 Read、Glob、Grep、Bash、Git。

## 执行要点

1. 先 `jj ralph map-find` 或读 `business-map.json` 找历史经验，再分析。
2. 无 run 时用 `jj ralph init --run-id RALPH-{slug}-{date} --title "…" --goal "…"`。
3. 聊天不能推进检查点；更新 `run.json` 与阶段文档。
4. 仅在 MUST 歧义、不可逆操作、缺密钥、需 UAT、脏工作区风险时停表问用户。
5. accept PASS 后优先 CLI：`archive`、`map-merge`；可选 `handoff`、`dispatch-snapshot`、`commit-prep`。
6. 与 `/jj-same`：handoff 写在 `.workflow/handoffs/`，迁移实现不在 ralph 目录。
7. 与 `$jj-dispatch`：完成后可写 dispatch 推荐快照，由控制面分发。

不要通过 shell 执行同名 slash；`npx`/`jj` 仅用于安装资产或 `jj ralph *` 机械步骤。
