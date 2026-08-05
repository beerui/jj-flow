# Skill 中文对照索引（人类审阅）

> **不是** Agent 运行时 SSOT。编辑与执行以顶层 `skills/<id>/` 英文（目标态）正文为准。  
> Session: `SEZ-20260803-path-migrate`

## 仓库规范

| 项 | 路径 |
| --- | --- |
| **Skill SSOT（编辑源）** | `skills/` |
| npm 发布 | `package.json` → `files` 含 `skills/` |
| 安装目标（Codex） | `~/.codex/skills` 或项目 `.codex/skills` |
| 安装目标（Grok / Qoder） | `~/.grok/skills` / `~/.qoder/skills` |
| Claude 薄入口 | `.claude/commands/` |
| 禁止当编辑源 | 任意宿主安装目录 |

## 对照包

| Skill | 中文对照 |
| --- | --- |
| jj | [jj/README.zh.md](jj/README.zh.md) |
| jj-ralph | [jj-ralph/README.zh.md](jj-ralph/README.zh.md) |
| jj-same | [jj-same/README.zh.md](jj-same/README.zh.md) |
| jj-dispatch | [jj-dispatch/README.zh.md](jj-dispatch/README.zh.md) |
| jj-review | [jj-review/README.zh.md](jj-review/README.zh.md) |
| jj-end | [jj-end/README.zh.md](jj-end/README.zh.md) |
| jj-evaluated | [jj-evaluated/README.zh.md](jj-evaluated/README.zh.md) |
| jj-team-coordinate | [jj-team-coordinate/README.zh.md](jj-team-coordinate/README.zh.md) |
| jj-team-swarm | [jj-team-swarm/README.zh.md](jj-team-swarm/README.zh.md) |
| skill-en-zh-rewrite | [skill-en-zh-rewrite/README.zh.md](skill-en-zh-rewrite/README.zh.md) |

## 进度

| 项 | 状态 |
| --- | --- |
| `.codex/skills` → `skills/` 迁移 | **done** |
| install / package / inventory 对齐 | **done** |
| Claude 目标：`~/.claude/skills` + commands | **done** |
| 入口级中文对照 | **done**（本目录） |
| **全量协议正文英文化（Agent SSOT）** | **done**（session `TC-skill-en-zh-20260803`） |
| `jj-team-coordinate` / `jj-team-swarm` 入口对照 | **done**（2026-08-05） |

## Sessions

| Session | 说明 |
| --- | --- |
| `sessions/SEZ-20260803-path-migrate/` | 路径迁移 + 初扫 |
| `sessions/TC-skill-en-zh-20260803/` | team-coordinate 全面英文化 |
| （产品入库）2026-08-05 | `jj-team-coordinate` + `jj-team-swarm` vendor 与对照包 |
