# Ralph 产物布局

```text
.workflow/ralph/RALPH-{kebab-slug}-{YYYYMMDD}/
  run.json                 # 含 family + handoff（精简）
  analyze.md
  plan.md
  progress.md
  acceptance.md
  handoff/handoff.json     # 可选镜像，供 same 读取

.workflow/ralph/
  business-map.json
  archive/YYYY-MM-DD-{kebab-slug}/
```

## 规则

1. 交接真相源：`run.handoff`
2. 不写外部 `.workflow/handoffs/`、不写 csv-wave HOF 大包
3. 命名遵循 `D:/a/config/naming.json`
4. 脚本：`scripts/ralph_ops.mjs`
