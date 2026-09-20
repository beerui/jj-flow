---
name: jj-team
description: 团队模式入口；调一次即预置常驻团队（ccteam 流程），并行度数字只定规模、不否决；起完同会话直接给任务、无需前缀。不推进 ralph/dispatch 检查点。
argument-hint: "<任务描述 | check | resume | remeasure | rebuild | pause | close>"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Skill
  - Agent
  - AskUserQuestion
  - TeamCreate
  - TeamDelete
  - SendMessage
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
---

# /jj-team

用户输入：$ARGUMENTS

团队模式入口：**量可并行度 → 预置常驻团队**。数字只定规模、不否决；状态 `~/.jj-flow/team/<project_key>/`，权威 skill `skills/jj-team/`。

## 执行要点

1. 加载 skill `jj-team`（含 `references/team-manual.md`、`references/roles.md`）。
2. **Phase 0 解析会话绑定**：活跃且会话 id 相同 → 静默 resume（resume, do not init）；读不到 id 就写 `null`，**绝不编造**。
3. **再算并行度**，数字连卡点一起报告。`implementers = 测得道数`；禁止按角色清单凑人。
4. **一次确认**后生成花名册；0/1 道也预置，0 道只留 team-lead + reviewer，不建 implementer 目录。
5. **起完即常驻**：同一会话之后直接给任务，不必再打 `/jj-team`；非团队活直接答，不生成队友。
6. **再路由**：单次任务 / 固定 SDLC 链 / 多假设搜索 → `/jj-team-coordinate`、`/jj-team-lifecycle`、`/jj-team-swarm`，点名即止，不重实现。降级宿主照样跑团队，只是串行。
7. **不写仓库**：状态只落 `~/.jj-flow/team/<project_key>/`；**不建仓库根 `CLAUDE.md`**；不碰 `jj-ralph` / `jj-same` / `jj-review`。
8. 审查用通用维度（RD-1 产品深度 / RD-2 可测试性 / RD-3 性能 / RD-4 API 优雅）；命令 `check` / `resume` / `remeasure` / `rebuild` / `pause` / `close`，**永不自动关闭**。

细则：skill `SKILL.md` + `docs/design-docs/jj-team.md`。
