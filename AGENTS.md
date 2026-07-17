# jj-flow agent rules

- `jj-flow` 是 **项目族编排工作流**（同源迁移 same + 多项目调度 dispatch），不是 Maestro 适配器产品。可调用 Maestro skill，但不要复制或重写 Maestro core，也不要把 jj 做成通用编排引擎。
- 项目族交付以控制面 manifest、Git commit、verification/review artifact 和 runtime sandbox attestation 为事实来源；聊天正文、thread 状态和 memory 不能推进 checkpoint。
- Reviewer 必须保持 `read-only`，只输出可追溯 findings；Developer 只能在批准的目标项目独占 worktree 中处理当前 `task_key`。
- 用户可见的控制任务是可恢复调度身份；临时 subagent 只在任务内部做探索、文档核对或并行只读工作，不得创建控制任务、修改批准快照或成为持久 thread identity。
- 同一项目的多个 writer 必须形成单一依赖链，运行时最多一个 active writer；交付必须由 terminal writer 的当前 commit 通过 Review。
- 全部流程禁止调用 `maestro explore`；代码与资料定位使用 Read、Glob、Grep、Bash、`rg` 或已批准的 skill。
- 用户可见原生命令仅保留 `jj-same` 与 `jj-dispatch`（外加兼容入口 `jj`）。已移除 `jj-delivery` / `jj-validate` / `jj-evolve` / `jj-feat` / `jj-fix` / `jj-knowhow` / `jj-auto` / `jj-review`。
- 控制平面中的 `delivery_id` 是多项目调度任务身份，不是已移除的 `$jj-delivery` 对话入口。
- 修改调度协议后至少运行 `node --test tests/jj-dispatch-contract.test.mjs`、`npm run verify` 和 `git diff --check`。
