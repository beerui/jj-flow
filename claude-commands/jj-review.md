---
name: jj-review
description: 只读审查入口：写 ASSIGNMENT-REVIEW 并 spawn 只读审查者；不调用宿主 /review。有 run 则绑定 findings.md + REV-*.json；无 run 审查工作区 / HEAD，不 init。
argument-hint: run_id/task_thread/review_thread/reviewed_commit
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Skill
  - Task
---

# /jj-review

用户输入：$ARGUMENTS

权威 skill：`skills/jj-review/SKILL.md`。派单协议见 `skills/jj/references/assignment-spawn.md`，此处不再重复。

要点：

1. 主对话是 team-lead：写本轮 `ASSIGNMENT-REVIEW`，随后 `spawn_subagent` 只读审查者 `jj-reviewer`（缺失则 `general-purpose`），独占输入为该派单文件。
2. 不在本对话内进行审查；**不要**调用宿主 `/review`；**不要**执行 `review-record` / `context --review`。
3. 有 ralph run 则绑定：`findings.md` + `REV-n.json`（`HIGH` → `high`）；本轮回复 `[OK]` / `[BLOCK]`。
4. 未指定且无 run → 不绑定，审查工作区或 `HEAD`，不 init。
5. 未指定时读 `.workflow/ralph/index.md` 的**活跃**首行定位 run；拿不准先询问用户。

细则以权威 skill 为准。
