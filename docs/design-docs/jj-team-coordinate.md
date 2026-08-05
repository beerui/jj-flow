# `jj-team-coordinate`：会话内多角色执行引擎融入 jj-flow

> 状态：Proposed
>
> P0 最小侵入已落地：设计 + skill 入库 + inventory/command/integrations。  
> 已补：用户透明协议 + Codex 兼容；harness review 修复（catalog fail-closed、worker 宿主分支、无 pycache）。  
> 完整 bridge CLI / 真机 Codex 验收仍未关闭。
>
> 关联：`ARCHITECTURE.md`（控制面不变量）、`jj-ralph.md`、`task-assignment-ux.md`、`grok-host-adapter.md`  
> 人类中文对照（非 Agent SSOT）：`docs/skill-zh-bridge/jj-team-coordinate/README.zh.md`
>
> 来源 skill：Claude 侧 `team-coordinate`（动态 role-spec + `team-worker`）
>
> 产品 id：`jj-team-coordinate`（inventory 约束 `^jj(-[a-z0-9]+)*$`）
>
> 别名：用户口语 / 历史入口仍可称 `team-coordinate`；**仓库 SSOT 与 install 名以 `jj-team-coordinate` 为准**

## 1. 摘要

`jj-team-coordinate` 是 **会话内多 Agent 执行引擎**，不是第四条交付主路径。

jj-flow 主路径保持：

| 主路径 | 职责 |
| --- | --- |
| `jj-same` | 同源迁移 / 持续同步 |
| `jj-ralph` | 单仓 ANALYZE→ARCHIVE + 能力地图 |
| `jj-dispatch` | 多项目调度身份 / 批准 / receipt |

本 skill 只在 **需要动态多角色并行** 时被调用（典型：ralph DELIVER 大改、跨模块分析、多角色文档/实现流水线）。它产出 `.workflow/.team/TC-*` 会话产物；**不得**自行推进 ralph `run.json` phase、control-plane checkpoint，或创建 `delivery_id` / 持久 `task_key`。

## 2. 问题与动机

| 痛点 | 说明 |
| --- | --- |
| 单 agent 上下文易糊 | 大需求需要分析 / 实现 / 验证分角色 |
| 固定 pipeline 过刚 | 任务类型多，需要运行时生成 role-spec |
| 与交付事实源混用 | 聊天 session 被误当检查点 → 不可恢复 |

目标：

1. 把已验证好用的 `team-coordinate` **版本化进 jj-flow**（`skills/` SSOT + install）。
2. 用清晰边界接上 ralph / same / review，**不改** dispatch 状态机。
3. 第一版 **最小侵入**：文档 + inventory + 薄 slash + integrations 指针；不做自动化 bridge CLI。

## 3. 非目标

| 非目标 | 原因 |
| --- | --- |
| 替代 `jj-dispatch` | 调度身份 / CAS / host attestation 与 team session 不同层 |
| 用 team session 推进 checkpoint | 违反 harness 不变量 |
| P0 保证 Codex/Grok 与 Claude 100% 同构 | 依赖 TeamCreate / maestro / `team-worker`；需 host adapter |
| 同期合入 `team-adversarial-swarm` | 另一搜索引擎；后续单独 design |
| 在 jj-flow **本仓** 写 `.workflow/` | harness 禁止提交 `.workflow`；demo 放 docs/sessions 或业务仓 |

## 4. 架构裁决

### 4.1 分层

```text
用户意图
   │
   ├─ 交付闭环 ──► jj-ralph / jj-same / jj-dispatch   （事实源）
   │
   └─ 需要强协作 ──► jj-team-coordinate                 （执行引擎）
                          │
                          ▼
                   .workflow/.team/TC-<slug>-<date>/
                          │
              （可选，人/agent 确认后）
                          ▼
              ralph evidence / progress 引用路径
              jj-review REV 素材（只读 findings 源）
```

### 4.2 身份对照（禁止混写）

| 身份 | Owner | 示例 |
| --- | --- | --- |
| `RALPH-*` | ralph | `RALPH-login-20260805` |
| `DEL-*` / `task_key` | dispatch | 控制面调度 |
| `TC-*` session_id | **team-coordinate** | `TC-multi-role-impl-20260805` |
| 动态 role / `TASK-*`（host TaskCreate） | team session 内部 | 仅会话调度，≠ ralph plan TASK |

### 4.3 何时调用

| 场景 | 建议 |
| --- | --- |
| 单点 tiny 改动 | **不要**上 team；直接 ralph |
| DELIVER 跨多模块、需并行角色 | 调 `jj-team-coordinate` |
| 只读审查 | 优先 `jj-review`；team 仅当需要多角度分析报告 |
| 跨仓迁移 | `jj-same`；team 可辅助目标分析，不替代 handoff 契约 |
| 多项目批准调度 | **只** `jj-dispatch` |

### 4.4 产物与可选 bridge（P0 仅文档约定）

| Team 产物 | 可映射到 | 写入方 |
| --- | --- | --- |
| `artifacts/*.md` | ralph DELIVER 证据路径 / progress 引用 | agent 手写引用；P0 无 CLI |
| `wisdom/decisions.md` | plan 修订说明 | 人/agent 确认后写 ralph plan |
| 对抗/质量 findings（若有） | `jj-review` findings 素材 | 审查适配器只读消费 |
| **禁止** | control-plane manifest、`run.json` gates 静默 PASS | — |

P1+ 可增加 `jj team-bridge summarize --session TC-… --run-id RALPH-…`（纯写引用清单，仍不改 gate）。

## 5. 宿主能力矩阵

| 能力 | Claude Code | Grok Build | Codex / Qoder |
| --- | --- | --- | --- |
| Skill install | ✅ `~/.claude/skills` | ✅ `~/.grok/skills` | ✅ |
| Slash `/jj-team-coordinate` | ✅ 薄入口 | 宿主 skill 触发 | `$jj-team-coordinate` |
| `team-worker` agent | 优先（`agents/team-worker.md` 随 skill 提供） | 常 **fallback** `general-purpose` | 视 agent 配置 |
| TeamCreate / Task* / SendMessage | ✅ | 部分/不同 API | 部分 |
| `mcp__maestro__team_msg` | 有则用 | 常无 → **文件消息总线** `.msg/` | 常无 → 文件总线 |
| `maestro delegate` CLI | 可选 | 可选；失败则直接工具 | 可选 |

**P0 保证**：Claude 主路径可用；其他宿主 **degraded**：coordinator 仍按 phase 跑，worker 用 `general-purpose` + 文件 session，禁止假设 maestro 必达。

### 5.1 skill_root 解析（必须多宿主）

禁止写死 `.claude/skills/team-coordinate`。解析顺序：

1. 当前 skill 包根（已安装目录含 `SKILL.md` + `roles/`）
2. 业务仓 `skills/jj-team-coordinate`（开发态）
3. 宿主：`~/.claude|/.codex|/.grok|/.qoder/skills/jj-team-coordinate`
4. 兼容旧名：`…/team-coordinate`（仅只读回落，不作为 SSOT）

### 5.2 用户提示（仅嵌套 jj-flow 工作流）

| 调用方式 | 提示 |
| --- | --- |
| 用户直接 `/jj-team-coordinate` | **不**打多行 banner |
| 嵌套在 **ralph / review / dispatch** | **一句话**：`开启 team 模式，开始任务XXX 约 10-25分钟` |

契约：`skills/jj-team-coordinate/references/user-transparency.md`。

### 5.3 Codex 兼容（degraded 一等公民）

| 缺失 | 替代 |
| --- | --- |
| TeamCreate | 仅 session 目录 |
| Task* | `<session>/tasks.json` |
| team-worker / maestro | general-purpose + 文件总线 |
| 并行 | 允许串行；预告更长用时 |

细则：`skills/jj-team-coordinate/references/host-codex.md`。

## 6. 仓库落地（最小侵入 = P0）

| 资产 | 动作 |
| --- | --- |
| `skills/jj-team-coordinate/` | Vendor 最新 `team-coordinate` + jj-flow 边界段落 + host 解析 |
| `skills/jj-team-coordinate/agents/team-worker.md` | Worker agent 定义随 skill 分发 |
| `skill-inventory.json` | 登记 id；`claude_command` + platforms |
| `claude-commands/jj-team-coordinate.md` | 薄 slash（≤40 行） |
| `skills/jj-ralph/references/integrations.md` | 增加 optional team 一节 |
| `skills/jj/SKILL.md` | 路由表 **不默认导向**；可加「显式 team 多角色」提示 |
| `docs/design-docs/*` + `build-docs` | 本设计 + 索引 |
| `ARCHITECTURE.md` | 修改入口表加一行 |
| **不改** | `src/dispatch*.mjs`、ralph schema、control-plane |

### 6.1 命名与兼容

| 层 | 名称 |
| --- | --- |
| Inventory / 目录 / Claude command | `jj-team-coordinate` |
| Session 前缀 | 仍为 `TC`（协议稳定） |
| 历史触发语 | “Team Coordinate” / `team-coordinate` → 路由到本 skill |
| 安装后 Claude 路径 | `~/.claude/skills/jj-team-coordinate`（不再以 host 目录为编辑源） |

### 6.2 会话目录

业务仓：

```text
.workflow/.team/TC-<slug>-<date>/
  team-session.json
  task-analysis.json
  role-specs/
  artifacts/
  .msg/
  wisdom/
  explorations/
  discussions/
```

jj-flow 产品仓：禁止提交 `.workflow`；示例 session 可放 `docs/…/sessions/`（已有 skill-en-zh 先例）。

## 7. 协议要点（继承自 team-coordinate）

1. **Coordinator-only skill 入口**；worker 不二次调用 skill。
2. Phase 0 resume → 1 分析 → 2 生成 role-spec → 3 task 链 → 4 spawn-and-stop → 5 完成交互。
3. 动态角色上限 5；超出合并。
4. 消息：优先 `team_msg`；不可用则写 `.msg/messages.jsonl` + `meta.json`。
5. 完成：Archive / Keep / Export；Keep 后 `resume`/`continue`。

完整 specs 见 skill 内 `specs/*`。

## 8. 分阶段

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| **P0**（本次） | 设计 + vendor skill + inventory + 薄 command + ralph integrations 指针 + docs | `checkSkillInventory` 通过；`docs:check`；无 dispatch/ralph 状态机 diff |
| **P1** | Host adapter 文档硬化 + 用户透明协议 + Codex 兼容说明 | `references/host-codex.md` + `user-transparency.md` 已入 skill |
| **P2** | 可选 bridge：session → ralph progress 引用清单 | 脚本 + 合约测试（只写引用，不写 gate）— **未做** |
| **P3** | 与 `jj-team-swarm`（TAS）并列 | 见 `docs/design-docs/jj-team-swarm.md` |

## 9. 风险

| 风险 | 缓解 |
| --- | --- |
| 用户以为 team 完成 = ralph 验收 | SKILL 顶部硬边界 + integrations 表 |
| maestro 缺失导致假失败 | 文件总线 fallback；CLI 失败继续用 Read/Grep |
| install 覆盖用户本地改过的 `~/.claude/skills/team-coordinate` | 新 id `jj-team-coordinate` 并行；旧目录不强制删除 |
| 角色膨胀 token | max 5 roles；tiny 任务禁止默认上 team |

## 10. 验收（P0）

- [x] `docs/design-docs/jj-team-coordinate.md` 入索引与 `build-docs`
- [x] `skills/jj-team-coordinate/SKILL.md` 存在且含 jj-flow 边界
- [x] `skill-inventory.json` 含 `jj-team-coordinate`
- [x] `claude-commands/jj-team-coordinate.md` ≤40 行
- [x] `jj-ralph` integrations 有 optional team 指针
- [x] skill inventory parity + docs:check
- [x] 无 control-plane / ralph schema 行为变更

## 11. 开放问题

1. P1 是否把 `team-worker` 同步装到 `~/.agents/agents` / Codex agents？（现随 skill 目录提供）
2. Bridge 引用清单 schema 是否挂在 ralph run 下 `team-refs.json`？
3. `jj` 兼容路由是否增加第 8 条「显式多角色 team」——倾向 **是，但优先级低于 same/ralph/dispatch**。
