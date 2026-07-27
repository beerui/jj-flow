# Loop 与 Graph：怎么理解并使用 jj-flow

这页给**第一次用 jj-flow 的人**。它不教你重写引擎——协议和代码已经在仓库里；它教你：

1. 脑子里先放哪两张图
2. 什么场景用哪个命令
3. 怎样才算“真的推进了”，而不是只在聊天里说做完了

读完后，建议立刻打开对应命令页照着打第一句输入：

- 单仓闭环 → [$jj-ralph](command-jj-ralph.html)
- 多项目调度 → [$jj-dispatch](command-jj-dispatch.html)
- 同源迁移 → [$jj-same](command-jj-same.html)
- 第一次怎么写输入 → [使用说明](usage.html)
- 记忆与顶层知识库 → [记忆与知识库](memory-knowledge-guide.html)

## 先记住一句话

**外层 Graph 管秩序，内层 Loop 管做对；文件管算不算发生过。**

| 角色 | 你在管什么 | jj-flow 里对应什么 |
| --- | --- | --- |
| Graph Engineer | 谁做、何时做、失败从哪恢复 | `$jj-dispatch` 控制面、`task_key`、批准快照、receipt |
| Loop Engineer | 这一步怎么做对、测不过怎么改 | `$jj-ralph` 闭环、`$jj-review` 返工、验证证据 |

两者不是二选一：

- 只有一个业务仓、把需求做到验收 → 主要用 **Loop**（`$jj-ralph`）
- 多个项目、要批准/波次/恢复 → 必须先有 **Graph**（`$jj-dispatch`），每个项目节点里再跑 Loop

## 两张图

### 外层 Graph（多项目调度）

```text
DRAFT
  → PREVIEW_ONLY      # 只展示，不创建 task
  → APPROVED          # 用户明确批准冻结的 task_keys
  → DISPATCHING       # 先写 dispatch_intent，再让宿主建 thread
  → RUNNING           # 绑定 thread / worktree，执行中
  → EVIDENCE_READY    # 有 receipt + commit + 验证/审查引用
  → VERIFIED          # terminal writer commit 与 Review PASS 一致

旁路：
  UNKNOWN  → 先 RECONCILE / BIND，禁止同 task_key 再创建
  BLOCKED  → 补证据后重新 PREVIEW，不硬推
```

`task_key` 长这样：

```text
{delivery_id}/{project_id}/{responsibility}/{attempt}

例：
DEL-payment/chengjie-web/development/1
DEL-payment/chengjie-web/verification/1
DEL-payment/chengjie-web/review/1
```

同一 `task_key` 幂等。要重试就升 `attempt`，不要在旧 key 上偷偷续命。

### 内层 Loop（单仓把事做完）

```text
ANALYZE → PLAN → DELIVER ⇄ VERIFY → ACCEPT → ARCHIVE
                    ▲         │
                    └─────────┘
              失败证据回灌后再试
```

停止条件只认：

- `PASS`
- `NEEDS_CHANGES`
- `BLOCKED`
- attempt / 预算耗尽

聊天里的“我觉得好了”不算停止条件。

## 怎么选入口（不会用时先看这表）

| 你的情况 | 先开哪个 | 然后呢 |
| --- | --- | --- |
| 就一个仓库，要把需求做到可验收 | `$jj-ralph` | 需要审查时加 `$jj-review`；做完可 `handoff` / `dispatch-snapshot` |
| 多个固定项目要一起推进、批准、恢复 | `$jj-dispatch`（Codex 控制项目） | 每个 target 节点内再跑 ralph / same / review |
| 功能已在 A 项目做完，迁到同源 B/C | `$jj-same` | 有 handoff 更好；多仓波次仍可由 dispatch 管身份 |
| 完全不知道选啥 | `$jj` | 兼容路由；迁移优先 same，单仓闭环走 ralph |

已移除的入口不要找：`$jj-delivery` / `$jj-validate` / `$jj-evolve`。  
`delivery_id` 只是 dispatch 的任务身份字段，不是旧命令。

## 三条最短上手路径

### 路径 1：单仓闭环（最常见的 Loop）

在业务仓库对话里：

```text
$jj-ralph
目标=登录后密码过期提醒
范围=仅登录成功路径
验收=提示出现且可跳转改密
```

你应该看到的推进：

1. 建立 run（身份在 `.workflow/ralph/RALPH-*/run.json`）
2. 分析 / 计划写清楚范围与验收
3. 实现并留下验证证据
4. 验收 PASS 后 archive / finalize

判断完成：

- 有可追溯 commit
- 有 verification / accept 证据
- `run.json` 进入完成/归档态  
不是：聊天最后回了句“搞定了”

### 路径 2：多项目调度（先 Graph，再 Loop）

先看可点的交互演示：[多项目调度演示](dispatch-demo.html)（承接 / 兑接 / 承载）。


在**独立控制项目**（不是随便一个业务仓）里：

```text
$jj-dispatch PREVIEW
delivery=DEL-password
目标=承接前台,兑接前台,承载前台
验收：各目标有稳定 commit；verification 有证据；terminal writer 当前 commit 获 Review PASS
```

核对预览无误后：

```text
$jj-dispatch DISPATCH 批准 delivery=DEL-password 的当前 task_keys
```

中断或状态不清时：

```text
$jj-dispatch RECONCILE task_key=DEL-password/dj/development/1
```

纪律：

1. 先 `PREVIEW`，再明确批准，再 `DISPATCH`
2. 只派当前 wave 里依赖已满足的 key
3. worker 只回 receipt，不直接改 control-plane
4. 缺证据就 `PENDING` / `BLOCKED`，绝不猜 `PASS`

### 路径 3：同源迁移（Loop 产物交给另一条边）

```text
$jj-same
会话=019f...
当前需求=保留密码入口
源=承接前台
目标=兑接前台,承载前台
```

或先在源侧 ralph 完成后导出 handoff，再 same 读取交接包。  
迁移实现不在 `.workflow/ralph/` 里完成；ralph 负责源侧闭环，same 负责目标适配。

## 事实源：什么文件算“发生过”

### 控制仓（Graph）

```text
.workflow/dispatch/DEL-xxx/control-plane.json
.workflow/tasks/TASK-DEL-xxx/
  task.md
  plan.md
  progress.md
  result.md
.workflow/receipts/...
```

### 业务仓（Loop）

```text
.workflow/ralph/RALPH-*/run.json
.workflow/ralph/RALPH-*/progress.md
verification/*
review/*
git commits
```

口令：

**没写入这些产物的进展，等于没发生。**  
聊天只能触发动作、解释现状，不能推进 checkpoint。

## 值班 Checklist（可照着勾）

### A. Delivery 状态

| 状态 | 你可以做 | 不要做 | 必查 |
| --- | --- | --- | --- |
| `DRAFT` | 补全 origin / owner / lead / targets | 直接全量建 task | intake 信息是否齐全 |
| `PREVIEW_ONLY` | `PREVIEW` 核对 task_keys 与依赖 | 跳过批准创建 thread | 完整 key 列表与阻塞项 |
| `APPROVED` | `DISPATCH` 批准冻结集合 | 目标/责任/attempt 变了还用旧批准 | 批准记录 |
| `DISPATCHING` | 写 intent，宿主建 task | 无 intent 建 thread；同 key 双建 | 每个 key 的 intent |
| `RUNNING` | tick 消费 receipt；`RECONCILE` | 用聊天推进状态 | bind / worktree / sandbox 证明 |
| `EVIDENCE_READY` | 校验 commit + 验证 + 审查 | 缺证据判 PASS | receipt 与证据引用 |
| `VERIFIED` | 收口、归档、导出 | 改已验证结果却不升 attempt | commit 与 Review PASS 一致 |
| `UNKNOWN` | 只对账 | 同 key 再创建 | reconcile 证据 |
| `BLOCKED` | 补证据后重 PREVIEW | 绕过阻塞硬推 | 阻塞原因文件 |

### B. Review 返工

```text
review = NEEDS_CHANGES
  1. 收口旧下游任务
  2. 相关 responsibility 的 attempt + 1
  3. 重新 PREVIEW
  4. 重新批准
  5. DISPATCH 新 task_keys
  6. 新 development loop 消费 findings 后重做
```

### C. 每次 tick 前 8 问

1. 当前 `delivery.status` 是什么？
2. 当前 wave 的 `task_keys` 是否都在批准快照里？
3. 可执行 key 是否都有 intent？
4. receipt 的 `attempt` 是否匹配 `task_key`？
5. 有没有 commit / verification / review 引用？
6. Review 是否只可能是 `PASS` 或 `NEEDS_CHANGES`？
7. 若重试，是否应升 attempt 而不是复用旧 key？
8. 聊天结论有没有落成文件？没有就当没发生。

## 常见误区

| 误区 | 正确做法 |
| --- | --- |
| 一个大 loop 串所有项目 | Graph 分 target；每节点各自 loop |
| 只画流程、节点内无验证 | 每个 development 必须有 verification 证据 |
| 把会话记忆当恢复点 | 只读 manifest / receipt / commit / review |
| 跳过 PREVIEW 直接派发 | 先展示完整 task_keys 再明确批准 |
| Developer 给自己 Review PASS | Reviewer 只读；PASS 必须有 findings 协议 |
| 用半真实 `host:trial` 宣称生产 Host 已通 | 真实 Codex App attestation 仍是单独验收 |

## 和现有能力的关系

这页是**使用心智模型**，不是新状态机提案。

| 你在文档里看到的概念 | 仓库里已经有的实现 |
| --- | --- |
| Graph / 控制面 | `src/dispatchControlPlane.mjs`、`src/dispatchRuntime.mjs`、`$jj-dispatch` |
| Loop / 单仓闭环 | `$jj-ralph`、`src/ralph.mjs` |
| 审查返工 | `$jj-review`、Review `PASS`/`NEEDS_CHANGES` |
| 迁移边 | `$jj-same`、handoff snapshot |
| 机器可读仓库地图 | `harness-manifest.json`、`ARCHITECTURE.md` |

协议细节以命令页、schema 和测试为准：

- [多项目调度](command-jj-dispatch.html)
- [单仓闭环](command-jj-ralph.html)
- [架构](architecture.html)
- [Harness Engineering](design-docs/harness-engineering.html)

## 你现在就可以做的下一件事

1. 若只有一个仓库一件需求：复制路径 1 的 `$jj-ralph` 输入，改成你的目标/范围/验收。
2. 若是多项目交付：先建/进入控制项目，复制路径 2 的 `PREVIEW`，看完整 `task_keys` 再决定是否批准。
3. 若是“A 已做完，迁到 B/C”：走路径 3 的 `$jj-same`，并坚持证据可追溯。

第一次用时，宁可多 `PREVIEW` 一次，也不要无批准快照就开写。
