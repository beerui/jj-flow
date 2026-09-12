# jj-review — 中文对照（人类审阅）

> **重要**：本文档仅供人类理解与审阅。  
> **不是** Agent 运行时 SSOT。发生冲突时以 skill 正文为准。  
> English SSOT: `skills/jj-review/`  
> Session: TC-skill-en-zh-20260803 · Updated: 2026-08-03

## 技能用途

单仓**只读审查适配器**：走客服派单（`ASSIGNMENT-REVIEW` + spawn），**禁止**调用宿主 `/review`。有 ralph run 时双写 `findings.md` + `reviews/REV-*.json`；没有 run 时审工作区 / HEAD，不 init。

不改业务代码，不 init run，不建 fix 任务，不走 dispatch。审查出 `NEEDS_CHANGES` 后停在 findings，等用户说「按审查改」再改。  
可写到已 soft-archive / `COMPLETED` 的 run（ralph 无终态冻结）；不要为「补审查」另 init 新 run。  
跨项目正式 VERIFIED 门用 `jj-dispatch`。

## 立即动作（对照）

1. **定位 run**：未点名时先读 `.workflow/ralph/index.md` 的「活跃」表（正在做的任务，不要先 glob）；没有活跃行再扫 live `task-*` / leftover。无 run → 无绑定，审工作区/HEAD，禁止 init；点名的 `run_id` 不存在才 `BLOCKED`
2. **确定审查范围**：本轮 ASSIGNMENT-TASK 交付文件；对话路径不跑 `context --review`。无绑定则脏工作区否则 HEAD；缺 commit/diff → `BLOCKED`。本轮只有文案/样式 → skip
3. **用户已提供结果** → `source=user_provided`，直接映射落盘
4. **客服派单 spawn** → 主对话是 team-lead：写 `ASSIGNMENT-REVIEW`，spawn 前先说「派遣审查」（例如「派遣reviewer审查改动代码」），再本轮 spawn `jj-reviewer`（缺失则 `general-purpose`；`description` 以 `[reviewer]` 开头；Grok/Claude 用 `agents/jj-*.md`，Codex 用 `jj-reviewer.toml`；审查工人钉 `reasoning_effort`/`model_reasoning_effort` 为 `high`，不 inherit / 不用 `xhigh`，父会话仍 `high`）；禁止在 parent 审、禁止开机读 report-layout / host-review / review-policy。检查维度：类型安全、null 处理、API 契约、回归。只审 listed files；禁止宿主 `/review`、禁止整仓 grep。活审查未结束不要派 `$jj-same`。首次审查新开；follow-up 同 cwd `resume_from` 上一名已结束的 `jj-reviewer`，不要 resume 实施工人。G-review-2 / G-review-4 / G-review-5
5. **映射** `[OK]`/`[WARN]`→`PASS`，`[BLOCK]`→`NEEDS_CHANGES`；`HIGH`→`high`；compliance 对照 `## Steps`
6. **落盘** 仅有 run 时：先回复用户，再写 `findings.md` + `REV-n.json` + 回写 `run.json.review` / `accept_layers.judgment`（文档，不跑 `review-record`）。G-review-3 / 样本 `01a08ea0`
7. **最终回复**：本轮必须给出 `[OK]` / `[WARN]` / `[BLOCK]`；有问题列出 HIGH/MEDIUM/LOW + 修改意见；等「按审查改」

## 硬规则（摘要）

| 规则 | 说明 |
| --- | --- |
| 只读 | 不改业务代码、不 init、不建 fix 任务 |
| 禁止宿主 /review | 只走 ASSIGNMENT-REVIEW spawn；全部改动也只加宽派单，永不 `/review`（G-review-2） |
| 同会话 follow-up | 同一 bound run 已有 `REV-*` / 宿主审查文件时只审 delta，`resume_from` 上一名 `jj-reviewer`（G-review-5）；禁止再 spawn 全量 reviewer，禁止 resume 实施工人（G-review-1 / EP-20260907） |
| bound 首次 | 客服派单：exclusive `task_paths`，禁止 Grok `/review` / `[reviewer] local changes`（G-review-2） |
| 落盘 | 有 run 时 `REV-*.json` 是事实源；无绑定则只回聊天 |
| PASS/NEEDS_CHANGES | 有 run 时必须有 `reviewed_commit`（≥7 位）；无绑定用 HEAD |
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
