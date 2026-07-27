# 与 jj-same / jj-dispatch

## jj-same

1. Ralph 在 `run.handoff` 维护精简交接（accept 可自动写）
2. 用户只说：`交接到 兑接` / `交接到 兑接 承载`
3. same 读当前会话 run/handoff 后迁目标；不重做源分析
4. 目标实现不在 `.workflow/ralph/` 下写

## jj-dispatch

需要控制面时写 dispatch recommendation。dispatch 管 task_key。

## 边界

| 能力 | 归属 |
| --- | --- |
| 单仓闭环 + run.handoff | jj-ralph |
| 跨仓迁移 | jj-same |
| 调度身份 | jj-dispatch |
