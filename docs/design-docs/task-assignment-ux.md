# 任务分配与反馈的轻量展示设计

> 状态：Implemented
>
> 验收证据：`tests/task-presentation.test.mjs`、`tests/cli-task-assignment.test.mjs`、`tests/dispatch-runtime.test.mjs`
>
> 实施边界：只改变人可见展示与 prompt 载荷形状；不改变控制面状态机、CAS、批准快照或 Review 门禁

## 目标

让调度任务分配足够快：人眼只扫主标题与下一步，审计细节留在机器可读层。

## 用户可见流程

```text
TASK-ID -> 读取 task.md 主标题 -> PREVIEW -> 用户批准 -> DISPATCH -> tick/resume
```

控制状态默认在 `control_root`（例 `~/.jj-flow`）；业务仓发起。命令示例：

```text
jj task assign --manifest <control-plane.json> \
  --delivery <DELIVERY_ID> --task <TASK-ID>
```

默认输出：任务主标题、任务 ID、四步流程、下一步命令。`--json` 返回 Host 用的结构化分配包。

## Agent 交互

- `distribution_prompt`：完整结构化上下文 + `task_id` / `task_title` / `task_doc_ref`
- `initial_prompt`：标题、ID、责任与最小执行要求；不嵌入任务正文或完整 JSON
- Developer/Reviewer：开场确认标题；过程只报阻塞与结论；完成回结构化证据

## 完成反馈

非 JSON 的 `dispatch-tick` 只显示标题、状态、分配数、待确认数、等待数；`actions`、task_key、receipt、finding 留在 JSON / manifest / artifact。

## 边界

- `quick` 任务可跳过完整任务文档，须有 delivery title 或 task ID 回退标题
- Grok Mode S 日常串行派发仍遵守本展示原则；真 Host Wave 2 不由本文关闭
