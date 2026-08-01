# 与 jj-same / jj-dispatch

## 身份不要混

| 身份 | 谁管 | 例子 |
| --- | --- | --- |
| `RALPH-*` run_id | **ralph**（业务仓 `.workflow/ralph/`） | `RALPH-login-reminder-20260722` |
| `CAP-*` | ralph business-map | `CAP-login-reminder` |
| run 内 `REQ-*` / `TASK-*` | ralph plan | `TASK-1` 识别 password_expired |
| `DEL-*` delivery | **dispatch**（控制项目 / control-plane） | `DEL-password` |
| 调度 `task_key` | dispatch | 与 ralph 的 `TASK-1` **不是同一编号** |

业务仓：项目A / 项目B / 项目C（前台、识票等）。  
**控制项目** 只记调度状态，不在此仓用 ralph 顶替业务实现。

## jj-same

1. Ralph 在 `run.handoff` 维护精简交接（accept 可自动写）
2. 用户只说：`交接到 项目B` / `交接到 项目B 项目C`
3. same 读当前会话 run/handoff 后迁目标；不重做源分析
4. 目标实现不在 `.workflow/ralph/` 下写
5. 源仓若 `intensity=strict`，handoff 的 must / do_not_port / targets 应更完整（便于项目B·项目C复用）
6. 归档后再改同 run：应 **commit + 再 accept/handoff**，刷新 `source_head` / must；handoff ready 跟 accept 与 git 稳定有关

## jj-dispatch

需要控制面时写 dispatch recommendation。dispatch 管 delivery / task_key。  
例：`$jj-dispatch PREVIEW delivery=DEL-password 目标=项目A,项目B,项目C`  
→ 与项目A仓里的 `RALPH-login-reminder-20260722` 是两条线；可引用但勿改错目录。

## 边界

| 能力 | 归属 |
| --- | --- |
| 单仓闭环 + run.handoff + intensity | jj-ralph |
| 跨仓迁移 | jj-same |
| 调度身份 `DEL-*` / task_key | jj-dispatch |
