# jj-ralph — 中文对照（人类审阅）

> **重要**：本文档仅供人类理解与审阅。  
> **不是** Agent 运行时 SSOT。发生冲突时以英文 skill 正文为准。  
> English SSOT: `skills/jj-ralph/`  
> Session: TC-skill-en-zh-20260803 · Updated: 2026-08-03

## 技能用途

单仓闭环：需求分析 → 计划 → 实施验证 → 验收 → 归档（ANALYZE→PLAN→DELIVER→ACCEPT→ARCHIVE）。  
产物在业务仓 `.workflow/ralph/`；交接真相源是 `run.handoff`。  
同需求始终优先同一 `run_id`（归档后 `resume`；半途 `abandon` 可救回）。「审查修复 / review-fix」不是新任务。同会话守卫认 `review.task_thread_id` 和 CLI `--thread-id` / `host.thread_id`。审查只出 findings，等用户说「按审查改」再改。跨仓用 `jj-same`，多项目调度用 `jj-dispatch`。

## 仓库规范（2026-08-03）

| 项 | 说明 |
| --- | --- |
| 编辑源 | 顶层 `skills/jj-ralph/` |
| 发布 | npm `files` 含 `skills/`；install 分发到各宿主 |
| 宿主安装目录 | 如 `~/.codex/skills/jj-ralph`、`~/.grok/skills/jj-ralph` — **勿当编辑源** |
| Claude | 仅 `.claude/commands/` 薄入口（若清单声明） |

## 英文化状态

| 状态 | 说明 |
| --- | --- |
| 路径迁移 | **已完成**（`.codex/skills` → `skills/`） |
| 正文 EN SSOT | **已完成**（session TC-skill-en-zh-20260803 / en-writer-ralph-router） |
| 对照包 | 本文件为入口级章节对照 |

## 章节对照 — SKILL.md

| English heading (SSOT) | 中文含义 | 备注 |
| --- | --- | --- |
| Immediate actions | 立即动作 | 定位 run、intensity、gate、finalize |
| Handoff | 交接 | 真相源 `run.handoff` |
| Scripts | 脚本 | `ralph_ops.mjs` 子命令清单 |
| Rollback & continue (summary) | 回退与续作（摘要） | 含 archive 后再做、abandon |
| Knowledge contribute (L2) | 投喂知识库（L2） | candidate only；fail-open |
| Hard constraints | 硬约束 | 控制项目禁业务 ralph 等 |
| Completion report | 完成报告 | 字段清单 |
| Examples (user speech; agent resolves the run) | 示例（用户口语；agent 解析 run） | 示例可保留中文口语 |

## 章节对照 — references/

| File | English heading (SSOT) | 中文含义 |
| --- | --- | --- |
| `phases.md` | Phases and checkpoints | 阶段与检查点 |
| `phases.md` | status | 运行状态 |
| `phases.md` | Autonomy loop | 自治循环 |
| `phases.md` | Intensity | 强度档 tiny\|standard\|strict |
| `phases.md` | Gate set (deprecated) | 对话路径不用 lite；机械 CLI 仅兼容旧 run |
| `phases.md` | MUST evidence | MUST 证据（防假绿） |
| `phases.md` | Lean execution | 精简执行 |
| `phases.md` | User intervention | 用户介入（仅此） |
| `phases.md` | Closeout | 收口 |
| `phases.md` | Rollback | 回退（详见 rollback.md） |
| `phases.md` | gate | 门禁与 product-consistency |
| `post-complete-continue.md` | Continue after complete (agent) | 续作（agent） |
| `post-complete-continue.md` | Principles / Detection / Fix mistakes | 原则 / 探测 / 改错 |
| `post-complete-continue.md` | Add requirements / Abandon / Anti-patterns | 加需求 / 废弃 / 负例 |
| `post-complete-continue.md` | Knowledge contribute | 投喂知识库 |
| `tiny-example.md` | Tiny single-point example | 单点改动最短样例 |
| `artifact-layout.md` | Ralph artifact layout | Ralph 产物布局 |
| `artifact-layout.md` | Current contract vs history | 当前合约 vs 历史（live Goal / 验收 / Steps；历史按日写 progress.md） |
| `business-map.md` | Business / capability map | 能力地图 |
| `rollback.md` | Ralph rollback (agent) | Ralph 回退（agent） |
| `integrations.md` | Integration with jj-same / jj-dispatch | 与 same / dispatch 边界；另含 optional team-coordinate / team-swarm |
| `must-evidence.md` | MUST evidence class (acceptance contract) | 验收证据类（原已 EN） |

## 阶段 / 产物

| 英文名 | 中文理解 | 产物 |
| --- | --- | --- |
| ANALYZE | 需求分析 | `task_plan.md` Goal（+ 可选 存疑） |
| PLAN | 计划实施 | `task_plan.md` Steps |
| DELIVER | 实施验证 | 代码、按日 `progress.md`、聚焦验证 |
| ACCEPT | 验收 | `task_plan.md` 验收清单 |
| ARCHIVE | 归档 | 原地 COMPLETED + `run.json` `archive` / `archive_history`、`business-map.json` 合并 |

## intensity

| 值 | 中文理解 |
| --- | --- |
| `tiny` | 单点快做；短计划；判断层默认可 SKIPPED |
| `standard` | 默认档；遗留 run 等同此 |
| `strict` | 更紧预算；判断层必须 PASS（review/recheck） |

## 关键规则摘要

1. 聊天正文不能推进检查点 → SSOT `phases.md` 开头 / Agents.md 控制面事实源规则  
2. 同需求 → 同一 `run_id`；归档 ≠ 作废；续作用 `resume` → `post-complete-continue.md`  
3. 证据层级不得低于 MUST 的 `evidence_class`；禁 write-then-read 仅用静态 diff 假绿 → `must-evidence.md`  
4. product-consistency 在 accept/archive gate 机械执行 → `phases.md` § gate  
5. 控制项目不跑业务 ralph；`DEL-*` ≠ `RALPH-*` → `integrations.md`  
6. `$jj-end` 只做 Git，与 run status 正交；收工顺序 review → commit → commit-scope 复审 → accept PASS → MUST finalize → `$jj-end`
7. 可选多角色实施：`jj-team-coordinate`（`TC-*`）；可选对抗搜索：`jj-team-swarm`（`TAS-*`）— 均不推进 gate；**嵌套时**一句提示即可，直接调用不打 banner  
8. 任务/方案变更：重写 live Goal / 验收 / Steps；按日追加 `progress.md`；禁止在 live plan 里堆 已落地 / REQ 账本 → `artifact-layout.md`
9. 对话路径不用 `--lite` / `brief` / `close`；忽略 `gate_set?`；tiny 只缩短计划
10. 「先不写代码 / 先理解需求」只写 ANALYZE，不过关、不改业务文件
11. 截图 / 「这里」先读图当需求；同会话「继续 / 按审查改 / 改坏了」→ resume，禁止 init
12. `index.md` 活跃超过 5 条或 5 天未动 → 「归档提示」；不自动归档；不确定先问用户

## 刻意不对照的内容

- 脚本源码、JSON Schema 字段名
- CLI 子命令与 flag 字面量（`deliver-attempt`、`accept-layer`、`gate` 等）
- `evidence_class` 枚举字面量
- 业务仓 knowledge / 具体 API 名（应留在业务仓）

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
| 2026-09-03 | conversational-no-lite | 对话路径弃用 lite；补截图 / 分析停手 / 同会话续跑 |
