# jj-team-coordinate — 中文对照（人类审阅）

> **重要**：本文档仅供人类理解与审阅。  
> **不是** Agent 运行时 SSOT。发生冲突时以英文 skill 正文为准。  
> English SSOT: `skills/jj-team-coordinate/`  
> 设计：`docs/design-docs/jj-team-coordinate.md`  
> 上游：Claude `team-coordinate` · Updated: 2026-08-05

## 技能用途

会话内**多角色执行引擎**（不是交付主路径）：

1. 分析任务 → 2. 动态生成 role-spec → 3. 建任务链 → 4. 派发 worker → 5. 交付产物  

Session 前缀 **`TC`**，目录：业务仓 `.workflow/.team/TC-<slug>-<date>/`。  
内置角色只有 **coordinator**；其他角色运行时生成，经 `team-worker`（缺失则 `general-purpose`）执行。

**不会**推进 ralph `run.json` 门禁或 dispatch control-plane checkpoint。  
完成 team 后若嵌在 ralph DELIVER，只把 `artifacts/` 路径交给父 skill 引用。

## 何时用 / 何时不用

| 用 | 不用 |
| --- | --- |
| 跨多模块并行实施 | 单点 tiny 改动（直接 ralph） |
| 多角度分析、动态拆角色 | 多项目调度（用 `jj-dispatch`） |
| 需要可恢复的 `TC-*` 会话流水线 | 纯审查（优先 `jj-review`） |
| | 方案搜索 / 多假设对抗（用 `jj-team-swarm`） |

## 身份对照（禁止混写）

| 身份 | Owner | 中文理解 |
| --- | --- | --- |
| `TC-*` | 本 skill | team 会话 id |
| `RALPH-*` | jj-ralph | 单仓闭环 run |
| `DEL-*` / `task_key` | jj-dispatch | 多项目调度身份 |
| host Task 主题 `IMPL-1` 等 | team 会话内部 | ≠ ralph plan 的 TASK |

## 仓库规范

| 项 | 说明 |
| --- | --- |
| 编辑源 | 顶层 `skills/jj-team-coordinate/` |
| 发布 | npm `files` 含 `skills/`；`jj install-skill` 分发 |
| 宿主安装目录 | `~/.claude|/.codex|/.grok|/.qoder/skills/jj-team-coordinate` — **勿当编辑源** |
| Claude 薄入口 | `claude-commands/jj-team-coordinate.md` → `/jj-team-coordinate` |
| 其他宿主 | `$jj-team-coordinate` / skill id |
| 旧名 | 口语 “Team Coordinate” / 目录 `team-coordinate` 可回落只读，SSOT 仍是 `jj-team-coordinate` |

## 章节对照 — SKILL.md

| English heading (SSOT) | 中文含义 | 备注 |
| --- | --- | --- |
| User notice (nested only) | 用户提示（仅嵌套） | 直接调用无 banner；嵌套 ralph/review/dispatch 一句话 |
| jj-flow hard boundaries | jj-flow 硬边界 | MUST / MUST NOT |
| Architecture | 架构 | coordinator + 动态 worker |
| Shared constants | 共享常量 | TC 前缀、max 5 roles 等 |
| skill_root resolution (multi-host) | 多宿主 skill 根解析 | 禁止写死仅 `.claude/...` |
| Role router | 角色路由 | 仅 coordinator 进 skill |
| Input parsing | 输入解析 | check / resume / revise… |
| Role registry | 角色登记 | 静态 coordinator + 动态 role-spec |
| Invocation | 调用方式 | Claude / Codex 入口 |
| Lifecycle | 生命周期 | Phase 0–5 |
| Coordinator spawn template | Coordinator 派生子模板 | team-worker / fallback |
| Completion action | 完成动作 | 归档 / 保留 / 导出 |
| Specs reference | 规格索引 | pipelines / quality-gates 等 |
| Session directory | 会话目录 | team-session、artifacts、wisdom… |
| Session resume | 会话恢复 | 对账 TaskList 或 tasks.json |
| Error handling | 错误处理 | 缺 maestro 不整 skill 失败 |
| Host compatibility | 宿主兼容 | Claude full / Codex degraded |

## 章节对照 — references/

| File | 中文含义 |
| --- | --- |
| `user-transparency.md` | 用户透明协议：派工前三要素、确认门槛、用时量级、完成收口 |
| `host-codex.md` | Codex 等降级：`tasks.json`、文件消息总线、串行 worker |

## 章节对照 — roles / specs

| Path | 中文含义 |
| --- | --- |
| `roles/coordinator/role.md` | Coordinator 角色：Phase 0–5、MUST、透明协议挂钩 |
| `roles/coordinator/commands/analyze-task.md` | 任务分析与角色设计 |
| `roles/coordinator/commands/dispatch.md` | 任务链创建 |
| `roles/coordinator/commands/monitor.md` | 进度监控 / check / resume / 完成 |
| `specs/pipelines.md` | 动态流水线模型 |
| `specs/role-spec-template.md` | 动态 role-spec 模板 |
| `specs/quality-gates.md` | 质量维度与阈值 |
| `specs/knowledge-transfer.md` | 跨角色知识传递 |
| `agents/team-worker.md` | Worker agent 定义（随 skill 分发） |

## 生命周期（中文摘要）

| 阶段 | 中文理解 |
| --- | --- |
| Phase 0 | 恢复已有 `TC-*` 会话 |
| Phase 1 | 文本级任务分析；探测宿主 full/degraded；**透明 pre-flight** |
| Phase 2 | 建 session、生成 role-spec、初始化 wisdom/.msg |
| Phase 3 | 建任务链（Task* 或 `tasks.json`） |
| Phase 4 | 派第一批 worker（或串行一个）→ 向用户报状态 → STOP |
| Phase 5 | 完成报告（实际用时 vs 预估）+ 归档/保留/导出 |

用户命令：`check`/`status`（只读状态图）· `resume`/`continue`（推进）· `revise` · `feedback` · `improve`。

## 用户提示（摘要）

- **直接** `/jj-team-coordinate`：**不要**多行提示。  
- **嵌套** ralph / review / dispatch：一句  
  `[team] 嵌套于 ralph DELIVER：… · 约 10–25 分钟 · 不推进 gate`  
- 内部 catalog 仍要；无一适用 → 不开 team。

## Codex / 降级（摘要）

| 缺失能力 | 替代 |
| --- | --- |
| TeamCreate | 仅 session 目录 + session_id |
| TaskCreate 等 | `<session>/tasks.json` |
| team-worker | `general-purpose` + 同一 role-assignment 提示词 |
| maestro 消息总线 | `.msg/messages.jsonl` + `meta.json` |
| 并行 | 允许串行；预告更长用时；靠用户 `resume` 推进 |

## 与 ralph 的接缝

典型：ralph PLAN 就绪 → **先透明说明 why/time** → team 做多模块 DELIVER → Archive 后把 `artifacts/` 路径写回 ralph evidence → 再 ACCEPT。  
详见 `skills/jj-ralph/references/integrations.md`（EN SSOT）与本对照「身份对照」。

## 关键规则摘要

1. 聊天 / team session **不能**当交付检查点  
2. `TC-*` ≠ `RALPH-*` ≠ `DEL-*`  
3. 无 team 理由 catalog → 不开 team  
4. 缺 Claude 专有 API 时 **降级**，不整 skill 硬失败  
5. 对抗蚁群搜索走 **`jj-team-swarm`**，不混进本 skill  

## 刻意不对照的内容

- role-spec 运行时生成正文、worker 内部 prompt 模板全文  
- maestro / Team* / Task* API 参数字面量  
- JSON schema 字段名（`team-session.json`、`tasks.json` 等）  
- 宿主安装路径中的环境变量名  

## 相关入口

| 入口 | 说明 |
| --- | --- |
| Claude | `/jj-team-coordinate` |
| Codex / Grok / Qoder | `$jj-team-coordinate` |
| 设计文档 | `docs/design-docs/jj-team-coordinate.md` |
| 中文设计索引 | `docs/design-docs/index.md` |
