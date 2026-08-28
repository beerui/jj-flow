# jj-end — 中文对照（人类审阅）

> **重要**：本文档仅供人类理解与审阅。  
> **不是** Agent 运行时 SSOT。发生冲突时以 skill 正文为准。  
> English SSOT: `skills/jj-end/`  
> Session: TC-skill-en-zh-20260803 · Updated: 2026-08-03

## 技能用途

Git **收工**（closeout）：同步远端、按 Conventional Commits **中文摘要**提交、推送工作分支、合入 integration（默认 dev/develop/main）、推送 integration、再切回工作分支。

中文触发说法（人类侧，写入对照包而非 EN SSOT 正文）：收工、结束任务、任务完成、提交并合并到 dev。

## 固定顺序

```text
fetch → 解析分支 →（可选）提交 → 同步 work → 推送 work
  → 切到 integration 并同步 → merge work → 推送 integration → 切回
```

失败即停并尽量回到 `work_branch`。禁止 force push、删分支、改 git config、提交 secrets/无关文件。

冲突：agent 先打分类表（simple/complex）。全部 simple 则自己解完继续收工；有一条 complex 或拿不准 → 整段 abort，不分解子集。见 SSOT `Conflict classify` / G-end-2。

## 核心规则（摘要）

| 规则 | 说明 |
| --- | --- |
| 一次跑完 | 不得中途「只 commit / 只 push」后停等用户（Hard-stop/冲突除外） |
| 主动收尾 | 实现完成且未禁止 push/merge 时，先打印 `work→integration` 计划再执行到底 |
| dry_run / 禁止 push | 只报告计划，不 merge/push |
| 不写控制面 | 不读/推进 dispatch；调度闭环用 `$jj-dispatch` |
| end ≠ 关仓 | 只做 Git 落地；ralph 归档/resume 仍走 `$jj-ralph` |

## Integration 解析优先级

1. 用户显式 `integration=`
2. 家族/仓库约定（仅文档 / AGENTS / `naming.json` / 用户配置**点名**集成分支）
3. 启发式：`dev` → `develop` → `main`
4. 否则询问

git log / `Merge #N into staging` / 同时存在 `staging` 分支 / AGENTS 里 `pnpm build:h5:staging` 这类构建脚本名 **不算**约定，不能压过已有的 `dev`（EP-20260828）。要合预发必须 `integration=staging`。

禁止 monorepo 未声明时猜根。

## 仓库规范（2026-08-03）

| 项 | 说明 |
| --- | --- |
| 编辑源 | 顶层 `skills/jj-end/` |
| 发布 | npm `files` 含 `skills/`；install 分发到各宿主 |
| 宿主安装目录 | 如 `~/.codex/skills/jj-end`、`~/.grok/skills/jj-end` — **勿当编辑源** |
| Claude | 仅 `.claude/commands/` 薄入口（若清单声明） |

## 英文化状态

| 状态 | 说明 |
| --- | --- |
| 路径迁移 | **已完成**（`.codex/skills` → `skills/`） |
| 正文 EN SSOT | **已完成**（2026-08-03 TC-skill-en-zh）：`SKILL.md`、`agents/openai.yaml`；保留「commit subject 中文」产品约定 |
| 对照包 | 本文件为入口级对照；中文触发词仅在此 |

## 相关产物

- Inventory: `docs/skill-zh-bridge/sessions/SEZ-20260803-path-migrate/language-report.md`
- Rewrite report: `docs/skill-zh-bridge/sessions/TC-skill-en-zh-20260803/artifacts/rev-end-eval-rewrite-report.md`
- Workflow: `skills/skill-en-zh-rewrite/`
