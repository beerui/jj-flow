# jj — 中文对照（人类审阅）

> **重要**：本文档仅供人类理解与审阅。  
> **不是** Agent 运行时 SSOT。发生冲突时以英文 skill 正文为准。  
> English SSOT: `skills/jj/`  
> Session: TC-skill-en-zh-20260803 · Updated: 2026-08-03

## 技能用途

兼容路由入口：把 `$jj` / `/jj` 转到 `jj-same`、`jj-ralph`、`jj-review`、`jj-end`、`jj-dispatch`（宿主支持时）或 experimental 的 `jj-evaluated`。  
`jj` 不是终端命令入口；正式使用主推原生 skill。

## 仓库规范（2026-08-03）

| 项 | 说明 |
| --- | --- |
| 编辑源 | 顶层 `skills/jj/` |
| 发布 | npm `files` 含 `skills/`；install 分发到各宿主 |
| 宿主安装目录 | 如 `~/.codex/skills/jj`、`~/.grok/skills/jj` — **勿当编辑源** |
| Claude | 仅 `.claude/commands/` 薄入口（若清单声明）；**无** `/jj-dispatch`、**无** `/jj-evaluated`（intentional） |

## 英文化状态

| 状态 | 说明 |
| --- | --- |
| 路径迁移 | **已完成**（`.codex/skills` → `skills/`） |
| 正文 EN SSOT | **已完成**（session TC-skill-en-zh-20260803 / en-writer-ralph-router） |
| 对照包 | 本文件为入口级章节对照 |

## 章节对照 — SKILL.md

| English heading (SSOT) | 中文含义 | 备注 |
| --- | --- | --- |
| Role | 定位 | 兼容入口 vs 终端命令 |
| Pre-route checks (read-only) | 路由前检查（只读） | handoff / run / control manifest |
| Routing priority | 路由优先级 | 1 same … 7 clarify |
| Execution contract | 执行契约 | 保留原始需求；证据不足则 PENDING/BLOCKED |
| Removed | 已移除 | 旧 skill id 列表 |

## 路由优先级（中文摘要）

| 优先级 | 意图 | 目标 skill |
| --- | ---: | --- |
| 1 | 同源多仓迁移 / handoff / 持续同步 | `jj-same` |
| 2 | 多目标批准 / delivery_id / task_key / 控制项目调度 | `jj-dispatch`（无 Claude slash） |
| 3 | 单仓闭环 / 能力地图 / 验收归档 / 归档后续作·废弃 | `jj-ralph`（同 run resume 优先） |
| 4 | 单仓只读审查 / REV-*.json | `jj-review` |
| 5 | 单仓 git 收工 | `jj-end`（不关死 ralph） |
| 6 | 离线 episode 评估 | `jj-evaluated`（experimental） |
| 7 | 不确定 | 先澄清，不默认 same |

## 关键规则摘要

1. 不通过 shell 执行 `jj-same` 等同名对话命令；`npx`/`jj` 用于安装或机械步骤  
2. 无 control 不伪造成 dispatch  
3. `jj-dispatch`：Codex / Qoder / Grok 安装；无 Claude slash = intentional（勿写「仅 Codex」）  
4. 禁止虚构 `/jj-evaluated` Claude 命令  

## 刻意不对照的内容

- 脚本源码与 CLI 字面量
- 各目标 skill 的内部协议（见各自 bridge 包）

## 相关产物

- Rewrite report: `docs/skill-zh-bridge/sessions/TC-skill-en-zh-20260803/artifacts/ralph-router-rewrite-report.md`
- Glossary: `docs/skill-zh-bridge/sessions/TC-skill-en-zh-20260803/artifacts/glossary.json`
- Inventory: `docs/skill-zh-bridge/sessions/SEZ-20260803-path-migrate/language-report.md`
- Workflow: `skills/skill-en-zh-rewrite/`

## 修订记录

| 日期 | sessionId | 说明 |
| --- | --- | --- |
| 2026-08-03 | SEZ-20260803-path-migrate | 路径迁移后入口级对照 |
| 2026-08-03 | TC-skill-en-zh-20260803 | 正文 EN SSOT 完成；章节对照表更新 |
