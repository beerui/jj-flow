# jj-same — 中文对照（人类审阅）

> **重要**：本文档仅供人类理解与审阅。  
> **不是** Agent 运行时 SSOT。发生冲突时以 skill 正文为准。  
> English SSOT: `skills/jj-same/`  
> Session: TC-skill-en-zh-20260803 · Updated: 2026-09-04

## 技能用途

同源分叉项目间迁移/同步功能；从 Ralph handoff 解析目标并适配目标原生架构。

**写哪（2026-09-04）**：源仓读 `run.handoff`；每个目标仓写自己的 Ralph（先复用同会话 / 审查切片 live run，否则 dispatch `task-<slug>`）。`ANL-TARGET` 只是 id。不要把分析正文写进 `~/.jj-flow/.workflow/tasks/`，也不要再开 csv-wave 当实施本。same 不调用 `ensureDispatchRalphRuns`。多轮对话不能推进 plane。

## 仓库规范（2026-08-03）

| 项 | 说明 |
| --- | --- |
| 编辑源 | 顶层 `skills/jj-same/` |
| 发布 | npm `files` 含 `skills/`；install 分发到各宿主 |
| 宿主安装目录 | 如 `~/.codex/skills/jj-same`、`~/.grok/skills/jj-same` — **勿当编辑源** |
| Claude | 仅 `.claude/commands/` 薄入口（若清单声明） |

## 英文化状态

| 状态 | 说明 |
| --- | --- |
| 路径迁移 | **已完成**（`.codex/skills` → `skills/`） |
| 正文 EN SSOT | **已完成**（2026-08-03，`en-writer-same`） |
| 对照包 | 本文件为入口级对照 + 章节映射 |

## EN ↔ ZH 章节映射

### `skills/jj-same/SKILL.md`

| EN heading | ZH gloss |
| --- | --- |
| Cross-project precise port | 跨项目精准迁移 |
| Happy path checklist | Happy path 清单 |
| How users say it | 用户怎么说 |
| Write plane (do not collapse) | 写面（勿塌层） |
| Ralph handoff first | Ralph handoff 优先 |
| Dual gates + user-visible output | 双门禁 + 用户可见输出 |
| Project family + control-plane boundary | 项目族 + 控制面边界 |
| Evidence entry points (pointers) | 证据入口（指针） |
| Artifact routing | 产物路由 |
| Hard constraints / MUST NOT | 硬约束 / MUST NOT |
| References | 引用 |
| Invocation examples | 调用示例 |

### `references/happy-path.md`

| EN heading | ZH gloss |
| --- | --- |
| Numbered main path | 编号主路径 |
| Dual gates (short definitions) | 双门禁（短定义） |
| Self-check criteria (agent-internal; do not recite to the user) | 自检准则（agent 内部，勿对用户背诵） |
| User-visible closeout (summary only) | 用户可见收工（只总结） |
| Control-plane boundary | 控制面边界 |
| Other references | 其它 references |

### `references/workflow-core.md`

| EN heading | ZH gloss |
| --- | --- |
| Delivery lifecycle | 交付生命周期 |
| Dual-gate extension (execution priority) | 双门禁扩展（执行优先级） |
| Evidence entry points | 证据入口 |
| Session-driven | 会话驱动 |
| Branch-driven | 分支驱动 |
| Mixed-driven | 混合驱动 |
| Handoff-snapshot-driven | 交接快照驱动 |
| Artifact routing (detail) | 产物路由（细节） |
| Continuous-sync rules | 持续同步规则 |
| Post-change sync decision | 修改完成后的同步决策 |
| Workflows 1–7 | 工作流 1–7 |
| 1. Lock scope | 1. 锁定范围 |
| 2. Establish repo facts | 2. 建立仓库事实 |
| 3. Generate formal requirements | 3. 生成正式需求 |
| 4. Review target and decide port | 4. 评审目标并做迁移决策 |
| 5. Design the narrowest patch | 5. 设计最窄补丁 |
| 6. Implement increments | 6. 实施增量 |
| 7. Layered verification | 7. 分层验证 |
| Delivery format (user-visible = short summary) | 交付格式（用户可见 = 短总结） |

### `references/continuous-sync.md`

| EN heading | ZH gloss |
| --- | --- |
| Sync contract | 同步契约 |
| Family delivery plan | 家族交付计划 |
| Auto-advance vs explicit target | 自动推进与显式目标 |
| Cross-session handoff | 跨会话交接 |
| Success checkpoints | 成功检查点 |
| First port | 首次迁移 |
| Later sync | 后续同步 |
| Post-change decision gate | 修改完成决策门禁 |
| Deferred sync | 延期同步 |
| Auto-trigger boundaries | 自动触发边界 |

### `references/project-family.md`

| EN heading | ZH gloss |
| --- | --- |
| Logic matrix | 逻辑矩阵 |
| Current example paths | 当前示例路径 |
| Role judgment | 角色判断 |
| Port directions | 迁移方向 |
| Same-row ports | 同一行迁移 |
| Cross-row ports | 跨行迁移 |
| Default delivery order | 默认交付顺序 |
| Branch derivation rules | 分支派生规则 |
| Naming grammar | 命名 grammar |
| Derivation algorithm | 派生算法 |
| Positive / negative examples | 正例 / 负例 |
| Six-project root-cause check | 六项目根因检查 |
| Task-level project registry | 任务级项目登记 |

### `references/artifact-routing.md`

| EN heading | ZH gloss |
| --- | --- |
| Artifact ownership | 产物归属 |
| Canonical routes | Canonical 路由 |
| Content mapping | 内容映射 |
| Source analysis `ANL-SOURCE` | 源分析 `ANL-SOURCE` |
| Migration handoff snapshot | 迁移交接快照 |
| Formal requirements `BLP` | 正式需求 `BLP` |
| Target analysis `ANL-TARGET` | 目标分析 `ANL-TARGET` |
| State boundaries | 状态边界 |

### `references/handoff-snapshot.md`

| EN heading | ZH gloss |
| --- | --- |
| Preferred path (Ralph) | 优先路径（Ralph） |
| Core boundaries | 核心边界 |
| When to generate | 生成时机 |
| Freshness decision | Freshness 决策 |
| Prepare handoff | 准备交接 |
| Consume handoff | 消费交接 |
| Update handoff | 更新交接 |
| Delta and continuous sync | Delta 与持续同步 |
| Minimal handoff output | 最小交接输出 |

### `references/silence-account-case.md`

| EN heading | ZH gloss |
| --- | --- |
| Evidence sources | 证据来源 |
| Final requirement invariants | 最终需求不变量 |
| Branch evolution | 分支演进 |
| Key differences and lessons | 关键差异与教训 |
| Project C judgment | 项目C判断 |
| Recommended capability matrix | 推荐能力矩阵 |

### `references/branch-purpose-preflight.md`

| EN heading | ZH gloss |
| --- | --- |
| Hard gate | 硬门禁 |
| Checks 1–5 — branch purpose | 检查 1–5 — 分支用途 |
| Checks 6–10 — base freshness (CREATE hard gate) | 检查 6–10 — 基线新鲜度（CREATE 硬门） |
| Golden Q&A (must not regress) | 黄金问答（不得回归） |
| Non-goals | 非目标 |

## 术语速查（摘自 glossary）

| ZH | EN |
| --- | --- |
| 交接 | handoff |
| 验收 | ACCEPT / acceptance |
| 归档 | ARCHIVE / archive |
| 控制平面 | control plane |
| 派发 | dispatch |
| 审查 | review |
| 门禁 | gate |
| 产物 | artifact |
| 权威源 | SSOT / authoritative source |
| 薄入口 | thin entry / thin wrapper |
| 能力地图 | business-map / capability map |
| 项目族 | project family |
| 领头项目 | lead project |
| 家族交付计划 | family delivery plan |
| 持续同步 | continuous sync |
| 基线新鲜度 | base freshness |
| 五项准则 | five self-check criteria (robust/razor/precise/minimal/reuse) |

## 相关产物

- Inventory: `docs/skill-zh-bridge/sessions/SEZ-20260803-path-migrate/language-report.md`
- Rewrite report: `docs/skill-zh-bridge/sessions/TC-skill-en-zh-20260803/artifacts/same-rewrite-report.md`
- Glossary: `docs/skill-zh-bridge/sessions/TC-skill-en-zh-20260803/artifacts/glossary.json`
- Workflow: `skills/skill-en-zh-rewrite/`
