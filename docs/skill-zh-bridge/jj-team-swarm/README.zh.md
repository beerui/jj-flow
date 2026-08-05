# jj-team-swarm — 中文对照（人类审阅）

> **重要**：本文档仅供人类理解与审阅。  
> **不是** Agent 运行时 SSOT。发生冲突时以英文 skill 正文为准。  
> English SSOT: `skills/jj-team-swarm/`  
> 设计：`docs/design-docs/jj-team-swarm.md`  
> 上游：Claude `team-adversarial-swarm`（TAS） · Updated: 2026-08-05

## 技能用途

**对抗蚁群搜索引擎**（不是交付主路径）：

- **Python** `aco.py`：信息素 / 选路 / 更新 / 报告（算法侧）  
- **模块** explore → score → converge → synthesize：LLM 探索与对抗决策（编排侧）  

Session 前缀 **`TAS`**，目录：业务仓 `.workflow/.team/TAS-<slug>-<date>/`。  
最终产物常为 `artifacts/best-solution.md`，只可被父 skill **引用为证据路径**，不能单独当作 ACCEPT PASS。

兄弟 skill：`jj-team-coordinate`（多角色**实施**流水线，`TC-*`）。本 skill 管**搜索 / 多假设 / 对抗评分**，不管动态 role 实施流水线。

## 何时用 / 何时不用

| 用 | 不用 |
| --- | --- |
| 大搜索空间、路径/方案迭代优选 | 单点 tiny 改动 |
| 多假设竞争、需对抗评分 | 已知方案的多角色实施（用 `jj-team-coordinate`） |
| 架构选型、多路径比较 | 跨仓调度（用 `jj-dispatch`） |
| 用户明确说蚁群 / 对抗搜索 / TAS | 替代 ralph 验收门 |

## 身份对照（禁止混写）

| 身份 | Owner | 中文理解 |
| --- | --- | --- |
| `TAS-*` | 本 skill | swarm 会话 id |
| `TC-*` | jj-team-coordinate | 多角色实施会话 |
| `RALPH-*` | jj-ralph | 单仓闭环 run |
| `DEL-*` | jj-dispatch | 调度交付 |

## 仓库规范

| 项 | 说明 |
| --- | --- |
| 编辑源 | 顶层 `skills/jj-team-swarm/` |
| 发布 | npm `files` 含 `skills/`；`jj install-skill` 分发 |
| 宿主安装目录 | `…/skills/jj-team-swarm` — **勿当编辑源** |
| Claude 薄入口 | `/jj-team-swarm` |
| 其他宿主 | `$jj-team-swarm` / skill id |
| 旧名 | `team-adversarial-swarm` / 口语「蚁群」「对抗搜索」 |
| 依赖 | 本机 Python ≥ 3.10 推荐；stdlib only（`pheromone.py` / `scoring.py`） |
| 测试 | `python skills/jj-team-swarm/scripts/test_aco.py` |

## 章节对照 — SKILL.md

| English heading (SSOT) | 中文含义 | 备注 |
| --- | --- | --- |
| User notice (nested only) | 用户提示（仅嵌套） | 直接调用无 banner；嵌套 ralph/review/dispatch 一句话 |
| jj-flow hard boundaries | jj-flow 硬边界 | 禁止静默烧 token 多轮迭代 |
| Architecture | 架构 | Coordinator 外环 + ACO 内环 |
| Module registry | 模块登记 | explore / score / converge / synthesize |
| Shared constants | 共享常量 | TAS、aco 子命令 |
| skill_root / aco.py resolution | skill 根与 aco 路径解析 | 多宿主 + 旧名回落 |
| Specs | 规格索引 | 协议 / 信息素 / 蚁输出 / 收敛 |
| Session directory | 会话目录 | pheromone、trails、scores… |
| Coordinator flow | Coordinator 流程 | Phase 0–4 |
| Module composition patterns | 模块组合模式 | 全量 / 仅探索 / 单轮调试等 |
| Error handling | 错误处理 | 缺 Python / Workflow 降级 |
| Host notes | 宿主说明 | full / workflow-degraded |
| Invocation | 调用方式 | 入口与遗留口语 |

## 章节对照 — references/

| File | 中文含义 |
| --- | --- |
| `user-transparency.md` | 提示协议：直接无 banner；嵌套一句话 |
| `host-compatibility.md` | 宿主兼容：Workflow 缺失时 agent-module 降级；Codex/Grok 串行蚁 |

## 章节对照 — specs / scripts / workflows

| Path | 中文含义 |
| --- | --- |
| `specs/swarm-protocol.md` | Coordinator ↔ Python ↔ 模块（或 agent 降级）三方协议 |
| `specs/pheromone-schema.md` | 信息素矩阵、蒸发、更新 |
| `specs/ant-output-schema.md` | 蚁输出 JSON 合约；对抗 verified_score |
| `specs/convergence-criteria.md` | 双层收敛：Python 信号 + 对抗辩论 |
| `specs/swarm-config-template.json` | Phase 1 配置模板 |
| `scripts/aco.py` | ACO CLI：`init` / `select` / `update` / `converged` / `report` |
| `scripts/pheromone.py` / `scoring.py` | 算法实现 |
| `scripts/test_aco.py` | 脚本级回归测试 |
| `workflows/wf-swarm-explore.js` | 并行（或串行）蚁探索 |
| `workflows/wf-swarm-score.js` | 对抗三票评分 |
| `workflows/wf-swarm-converge.js` | 是否收敛辩论 |
| `workflows/wf-swarm-synthesize.js` | 综合 best-solution |

## 生命周期（中文摘要）

| 阶段 | 中文理解 |
| --- | --- |
| Phase 0 | 恢复未收敛的 `TAS-*` |
| Phase 1 | 写 `swarm-config.json`；宿主模式；仅嵌套时一句话提示 |
| Phase 2 | `aco.py init`；报告 n_nodes / n_edges |
| Phase 3 | 循环 k=1…K：select → explore → score → update → converge；每轮向用户报进度 |
| Phase 4 | `report` + synthesize → `best-solution.md`；归档 / 保留 / 导出 / 再跑 |

### 模块（中文）

| 模块 | 作用 |
| --- | --- |
| Explore | N 只蚁按信息素提示探索任务空间，产出 ant 结果 |
| Score | 对每只蚁做 prosecutor/defender/judge 式对抗评分 |
| Converge | 是否停止迭代（继续 vs 收敛） |
| Synthesize | 综合 top 方案 → `best-solution.md` |

### 组合模式

| 模式 | 流程 |
| --- | --- |
| 全量（默认） | explore → score → update → converge → … → synthesize |
| 仅探索 | explore → update(self_score) → converge → synthesize |
| 单轮调试 | explore(k=1) → score(k=1) |
| 仅评分 / 仅综合 | 已有产物时独立跑 |

## 用户提示（摘要）

- **直接** `/jj-team-swarm`：**不要**多行提示。  
- **嵌套** ralph / review / dispatch：一句  
  `[swarm] 嵌套于 ralph PLAN：多假设搜索 · 约 15–40 分钟 · 不推进 gate`  
- 内部 catalog 仍要；高成本时最多多问一句确认。

## 宿主兼容（摘要）

| 模式 | 含义 |
| --- | --- |
| `full` | Claude Workflow + Bash 调 Python |
| `workflow-degraded` | 无 Workflow 运行时：按各 wf 脚本的 args/返回契约用 **Agent 模块** 实现同等 I/O |
| `python-only-degraded` | 有 Python 但 LLM 预算紧：减小 n_ants / max_iterations |

**禁止**仅因没有 Claude Workflow API 就整 skill 失败。  
**禁止**在没有 Python 时伪造信息素与分数。

`aco.py` 解析顺序：本 skill 包 → 仓库 `skills/jj-team-swarm` → 各宿主 install 路径 → 旧名 `team-adversarial-swarm`（只读回落）。

## 与 ralph 的接缝

典型：PLAN 多假设不确定 → **透明说明** → swarm 跑出 `best-solution.md` → 路径写入 plan/evidence → 再 DELIVER/ACCEPT。  
实施阶段多角色并行仍用 **`jj-team-coordinate`**，不要用 swarm 代替。

## 关键规则摘要

1. `TAS-*` 产物不是交付检查点  
2. 开跑前必须说明为什么 / 当前 / 用时  
3. Python 算法与 LLM 模块分层；降级改编排，不改 ACO 数学契约  
4. 与 `jj-team-coordinate` 职责分离：搜索 vs 实施  
5. jj-flow 本仓禁止提交 `.workflow/`  

## 刻意不对照的内容

- `aco.py` / pheromone 更新公式细节（见 EN specs）  
- Workflow JS 源码与 `parallel()`/`agent()` API  
- JSON 字段字面量（`verified_score`、`ant_id` 等）  
- 测试夹具与临时 session 路径  

## 相关入口

| 入口 | 说明 |
| --- | --- |
| Claude | `/jj-team-swarm` |
| Codex / Grok / Qoder | `$jj-team-swarm` |
| 设计文档 | `docs/design-docs/jj-team-swarm.md` |
| 实施引擎对照 | [jj-team-coordinate/README.zh.md](../jj-team-coordinate/README.zh.md) |
