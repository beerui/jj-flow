# jj-evaluated — 中文对照（人类审阅）

> **重要**：本文档仅供人类理解与审阅。  
> **不是** Agent 运行时 SSOT。发生冲突时以 skill 正文为准。  
> English SSOT: `skills/jj-evaluated/`  
> Session: TC-skill-en-zh-20260803 · Updated: 2026-08-03

## 技能用途

实验性**离线评估**：用真实 conversation export 与 versioned 产物，诊断并改进 jj-same / jj-ralph / jj-dispatch 的时耗、交接复用、重做与 trace 质量。

产品报告根（业务仓）：`.workflow/evaluated/`。  
平台：Codex / Qoder / Grok skill install；**无** Claude slash（intentional，勿发明 `/jj-evaluated`）。

## 九步（对照）

| 步 | 工作 |
| ---: | --- |
| 1 | 建立范围与权威源（设计文档、角色图、git 事实） |
| 2 | 摄入真实 episode |
| 3 | 归一化并打标 → `episode-validate` |
| 4 | 谨慎基线（每段时长带 clock_quality + provenance） |
| 5 | 先 split 再提议（search / holdout / regression） |
| 6 | 从原始 trace 诊断；一次一个有界候选 |
| 7 | 先便宜再昂贵的 replay |
| 8 | 审慎 review 与 promote |
| 9 | 归档与维护 |

## 角色标签（产品约定，勿改写）

契约与脚本允许的 role 字面量仍为：`项目A` / `项目B` / `项目C`（见 `episode-validate.mjs` `ALLOWED_ROLES`）。  
EN 正文中保留这些 token，不翻译成 handoff/source 等。

## 仓库规范（2026-08-03）

| 项 | 说明 |
| --- | --- |
| 编辑源 | 顶层 `skills/jj-evaluated/` |
| 发布 | npm `files` 含 `skills/`；install 分发到各宿主 |
| 宿主安装目录 | 如 `~/.codex/skills/jj-evaluated`、`~/.grok/skills/jj-evaluated` — **勿当编辑源** |
| Claude | 仅 `.claude/commands/` 薄入口（若清单声明） |
| 脚本 | `scripts/episode-validate.mjs`、`scripts/evaluated_ops.mjs`（保留；role 校验未改） |

## 英文化状态

| 状态 | 说明 |
| --- | --- |
| 路径迁移 | **已完成**（`.codex/skills` → `skills/`） |
| 正文 EN SSOT | **已完成**（2026-08-03 TC-skill-en-zh）：`SKILL.md` 与 refs 主体原为 EN；清扫混合中文短语；`项目A/B/C` 作为契约 token 保留 |
| 对照包 | 本文件为入口级对照 |

## 相关产物

- Inventory: `docs/skill-zh-bridge/sessions/SEZ-20260803-path-migrate/language-report.md`
- Rewrite report: `docs/skill-zh-bridge/sessions/TC-skill-en-zh-20260803/artifacts/rev-end-eval-rewrite-report.md`
- Workflow: `skills/skill-en-zh-rewrite/`
