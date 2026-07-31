# Ralph 产物布局

**位置：业务仓**（承接 / 兑接 / 承载等），不是控制项目。

```text
.workflow/ralph/RALPH-{kebab-slug}-{YYYYMMDD}/
  run.json                 # phase/gates + intensity/budget/stagnation/accept_layers + handoff
  analyze.md
  plan.md
  progress.md              # 含 deliver-attempt / 续作链 supersedes_run_id|parent_run_id
  acceptance.md
  reviews/REV-*.json       # 可选；strict 判断层常依赖
  handoff/handoff.json     # 可选镜像，供 same 读取

.workflow/ralph/
  business-map.json        # CAP-* 能力地图
  archive/YYYY-MM-DD-{kebab-slug}/
```

## 规则

1. 交接真相源：`run.handoff`
2. 不写外部 `.workflow/handoffs/`、不写 csv-wave HOF 大包
3. 命名遵循 naming 配置（`jj doctor` / `JJ_GLOBAL_CONFIG_DIR`；**禁止**写死本机路径）
4. 脚本：`scripts/ralph_ops.mjs`（含 `deliver-attempt` / `accept-layer`）
5. `RALPH-*` ≠ 控制面上的 `DEL-*` / 调度 `task_key`
