# Project Family Control

这是一个独立控制项目模板。它可以是空项目，不需要承载业务源码；复制 `control-plane.json` 后，把项目路径、Codex App project binding 和本轮 delivery 引用替换成真实值。

使用原则：

1. 先运行 `$jj-dispatch` 的 `PREVIEW`，确认 `origin_project`、`requirement_owner`、`lead_project`、`reference_implementation` 和 `targets`。
2. 用户明确批准后才执行 `DISPATCH`。
3. 每个目标任务使用独占 worktree；产品、测试和 Review 消费已提交 commit。
4. 创建 thread 或写回 manifest 失败时保持 `UNKNOWN`，使用 `RECONCILE`，不要重复创建。
5. 每个 responsibility 都填写 `phase`、`attempt` 和 `depends_on`；依赖未完成时看到 `WAITING_DEPENDENCY`，完成前置任务后再次执行同一批准的 `DISPATCH`。
6. 确认 thread 无法找回时，把 `UNKNOWN` 显式结束为 `BLOCKED`，递增 `attempt` 后重新预览和批准。

控制项目只保存任务、thread、状态、决策和 artifact 引用，不复制业务需求正文或目标验证正文。
