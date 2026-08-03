# jj-review — 中文对照（人类审阅）

> **重要**：本文档仅供人类理解与审阅。  
> **不是** Agent 运行时 SSOT。发生冲突时以 skill 正文为准。  
> English SSOT: `skills/jj-review/`  
> Session: TC-skill-en-zh-20260803 · Updated: 2026-08-03

## 技能用途

单仓**只读审查适配器**：优先调用当前宿主内置 review/code-review，把结论映射为 ralph run 的 `reviews/REV-*.json` 并回写 `run.json`。

不改业务代码，不 init run，不建 fix 任务，不走 dispatch。  
可写到已 soft-archive / `COMPLETED` 的 run（ralph 无终态冻结）；不要为「补审查」另 init 新 run。  
跨项目正式 VERIFIED 门用 `jj-dispatch`。

## 立即动作（对照）

1. **定位 run**：读 `.workflow/ralph/RALPH-*/run.json`；无 run → `BLOCKED`，禁止 init  
2. **确定审查范围**：analyze/plan/progress/acceptance；缺 commit/diff → `BLOCKED`  
3. **用户已提供结果** → `source=user_provided`，直接映射落盘  
4. **否则宿主内置 review** → `source=host_builtin`  
5. **映射** outcome：`PASS` / `NEEDS_CHANGES` / `BLOCKED`  
6. **落盘** `reviews/REV-n.json` + 回写 run.json + progress.md  
7. **完成报告**（简短）

## 硬规则（摘要）

| 规则 | 说明 |
| --- | --- |
| 只读 | 不改业务代码、不 init、不建 fix 任务 |
| 宿主优先 | 有内置 review 时禁止跳过改做平行自审 |
| 必须落盘 | `REV-*.json` 是事实源，不是聊天结论 |
| PASS/NEEDS_CHANGES | 必须有 `reviewed_commit`（≥7 位） |
| 证据不足 | `BLOCKED` |
| 禁止 | 用 `npm test` / verify / CI 绿灯冒充 review `PASS` |

## 回退

仅当宿主审查不可用且用户要求继续时，允许 `source=fallback_inline` 最小内联审查；`user_provided` **不算**回退。

## 仓库规范（2026-08-03）

| 项 | 说明 |
| --- | --- |
| 编辑源 | 顶层 `skills/jj-review/` |
| 发布 | npm `files` 含 `skills/`；install 分发到各宿主 |
| 宿主安装目录 | 如 `~/.codex/skills/jj-review`、`~/.grok/skills/jj-review` — **勿当编辑源** |
| Claude | 仅 `.claude/commands/` 薄入口（若清单声明） |

## 英文化状态

| 状态 | 说明 |
| --- | --- |
| 路径迁移 | **已完成**（`.codex/skills` → `skills/`） |
| 正文 EN SSOT | **已完成**（2026-08-03 TC-skill-en-zh）：`SKILL.md`、`host-review.md`、`report-layout.md`、skeleton、`agents/openai.yaml` |
| 对照包 | 本文件为入口级对照 |

## 相关产物

- Inventory: `docs/skill-zh-bridge/sessions/SEZ-20260803-path-migrate/language-report.md`
- Rewrite report: `docs/skill-zh-bridge/sessions/TC-skill-en-zh-20260803/artifacts/rev-end-eval-rewrite-report.md`
- Workflow: `skills/skill-en-zh-rewrite/`
