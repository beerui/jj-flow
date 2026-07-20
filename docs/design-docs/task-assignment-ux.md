# 任务分配与反馈的轻量展示设计

> 状态：Implemented
>
> 验收证据：`tests/task-presentation.test.mjs`、`tests/cli-task-assignment.test.mjs`、`tests/dispatch-runtime.test.mjs`

## 目标

让控制项目的任务分配足够快，同时把详细文档和审计证据留在机器可读层，不把它们重复展示给用户。

## 用户可见流程

```text
TASK-ID -> 读取 task.md 主标题 -> PREVIEW -> 用户批准 -> DISPATCH -> tick/resume
```

命令：

```text
jj task assign --manifest .workflow/dispatch/<DELIVERY_ID>/control-plane.json \
  --delivery <DELIVERY_ID> --task <TASK-ID>
```

默认输出只有任务主标题、任务 ID、四步流程和下一步命令。`--json` 才返回供 Host 使用的结构化分配包。

## Agent 交互

- `distribution_prompt` 保留完整结构化上下文，并增加 `task_id`、`task_title`、`task_doc_ref`。
- `initial_prompt` 只包含标题、ID、责任和最小执行要求，不嵌入任务文档或完整 JSON。
- Developer/Reviewer 开始时只确认标题，过程只报告阻塞和结论，完成时返回结构化证据。

## 完成反馈

非 JSON 的 `dispatch-tick` 输出只显示任务标题、状态、分配数、待确认数和等待数；完整 `actions`、task key、receipt 和 finding 仍保留在 JSON、manifest 和 artifact 中。

## 边界

- `quick` 任务仍可跳过完整任务文档，但必须使用 delivery title 或 task ID 作为回退标题。
- 该设计不改变控制面状态转换、批准快照、CAS 或 Review 门禁。
