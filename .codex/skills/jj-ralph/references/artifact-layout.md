# Ralph 产物布局

**位置：业务仓**（项目A / 项目B / 项目C等），不是控制项目。

```text
.workflow/ralph/RALPH-{kebab-slug}-{YYYYMMDD}/
  run.json                 # phase/gates + intensity/budget/stagnation/accept_layers + handoff
  analyze.md
  plan.md
  progress.md              # deliver-attempt / resume|abandon 审计；真新 run 时可选 supersedes|parent 链
  acceptance.md
  reviews/REV-*.json       # 可选；strict 判断层常依赖
  handoff/handoff.json     # 可选镜像，供 same 读取

.workflow/ralph/
  business-map.json        # CAP-* 能力地图（ABANDONED run 不 map-merge）
  archive/YYYY-MM-DD-{kebab-slug}/   # soft archive 快照（可 re-archive 时间戳目录；非墓碑）
```

## 规则

1. 交接真相源：`run.handoff`
2. 不写外部 `.workflow/handoffs/`、不写 csv-wave HOF 大包
3. 命名遵循 naming 配置（`jj doctor` / `JJ_GLOBAL_CONFIG_DIR`；**禁止**写死本机路径）
4. 脚本：`scripts/ralph_ops.mjs`（含 `deliver-attempt` / `accept-layer` / `resume` / `abandon`）
5. `RALPH-*` ≠ 控制面上的 `DEL-*` / 调度 `task_key`
6. 活跃目录始终是权威 run；archive 下是历史快照。归档后继续改 → **同** `RALPH-*` 目录 resume，不默认新开
