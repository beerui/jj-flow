# skill-en-zh-rewrite — 中文对照（人类审阅）

> **重要**：本文档仅供人类理解与审阅。  
> **不是** Agent 运行时 SSOT。发生冲突时以 skill 正文为准。  
> English SSOT: `skills/skill-en-zh-rewrite/`  
> Session: SEZ-20260803-path-migrate · Updated: 2026-08-03

## 技能用途

维护工作流：技能正文英文化 SSOT + 中文对照包；含 skills/ 顶层迁移。

## 仓库规范（2026-08-03）

| 项 | 说明 |
| --- | --- |
| 编辑源 | 顶层 `skills/skill-en-zh-rewrite/` |
| 发布 | npm `files` 含 `skills/`；install 分发到各宿主 |
| 宿主安装目录 | 如 `~/.codex/skills/skill-en-zh-rewrite`、`~/.grok/skills/skill-en-zh-rewrite` — **勿当编辑源** |
| Claude | 仅 `.claude/commands/` 薄入口（若清单声明） |

## 英文化状态

| 状态 | 说明 |
| --- | --- |
| 路径迁移 | **已完成**（`.codex/skills` → `skills/`） |
| 正文 EN SSOT | 多数协议文件仍为中文/混合；按 P0 清单分批改写 |
| 对照包 | 本文件为入口级对照 |

## 相关产物

- Inventory: `docs/skill-zh-bridge/sessions/SEZ-20260803-path-migrate/language-report.md`
- Workflow: `skills/skill-en-zh-rewrite/`
