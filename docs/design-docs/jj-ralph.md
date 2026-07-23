# jj-ralph 单仓全流程自治闭环

> 状态：Implemented
>
> 验收证据：`tests/jj-ralph-contract.test.mjs`、`tests/install-skill.test.mjs`、`npm run verify`
>
> 实施边界：协议资产 + 轻量 CLI 机械步骤；无 dispatch 式 CAS 状态机

## 目标

在当前**单一业务仓库**内完成：

```text
需求分析 → 计划实施 → 验收完成 → 归档
```

约束：

- 全步骤文档留痕、可追溯
- 能力地图可检索，供下次模型会话发现历史经验
- 默认自治，仅在必要时请用户介入

## 非目标

- 多仓迁移实现（`jj-same`）
- 控制面 tick/CAS（`jj-dispatch`）
- 自动 push / merge / release
- 后台 daemon

## 产物布局

```text
.workflow/ralph/
  business-map.json
  RALPH-{slug}-{date}/
  archive/YYYY-MM-DD-{slug}/
.workflow/handoffs/<HOF-ID>/
.workflow/dispatch/recommendations/<SNAP-ID>/
```

## 与 same / dispatch

| 关系 | 约定 |
| --- | --- |
| same | `jj ralph handoff` 写出 `.workflow/handoffs/`；same 读需求后在目标仓实现 |
| dispatch | 验收后 `jj ralph dispatch-snapshot` 写出推荐快照 |

## 机械步骤

- 权威实现：`src/ralph.mjs`
- Skill 可移植副本：`.codex/skills/jj-ralph/scripts/lib/ralph.mjs`（`npm run ralph:sync` 保持同步）
- Agent：`.codex/skills/jj-ralph/scripts/ralph_ops.mjs`（优先 live src，否则 bundled lib；业务仓无需安装 jj-flow）
- CLI：`jj ralph init|status|archive|finalize|map-merge|gate|map-find|handoff|dispatch-snapshot|commit-prep|review-record`
- `finalize` = map-merge + archive（accept PASS 后默认收口）
- `map-merge` 默认要求 accept=PASS（`--force` 可覆盖）
- archive 目录默认去重 run_id 末尾日期：`2026-07-23-smoke` 而非 `…-smoke-20260723`
- archive 冻结副本包含 COMPLETED 的 `run.json`

## 验收

- 安装含 `jj-ralph` skill 与 command
- sample run/map 校验通过
- map-merge 后 map-find 可恢复 run 路径与 lessons
- archive / handoff / dispatch-snapshot 路径正确
