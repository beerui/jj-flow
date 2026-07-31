# 续作：改错与子需求（关账前 / 关账后）

> 用户向说明见 `docs/commands/jj-ralph.md` §「1. 续作：改错与子需求」。  
> 回退边权威：`rollback.md`。本文规定 **agent 如何续作**（含关账前同 run 与关账后新 run 链）。

## 总原则

| 概念 | 含义 |
| --- | --- |
| 统一任务（账本） | 同一 `run_id` + gates |
| 统一任务（业务） | 同一需求族（链字段见下） |

```text
未 COMPLETED → 同 run_id 继续
已 COMPLETED → 禁止 reopen；新 run + 链回旧 run
```

聊天不推进检查点。不进 skill 的会话改码 ≠ 账本续作。

### 关联字段约定（SSOT）

`run.json` schema **未**声明 `supersedes_run_id` 等 top-level 键（`additionalProperties: false` 时勿 invent 进 run.json）。

**权威落点：`progress.md` 首行（或首条 audit 行）**，键名统一：

| 键 | 何时 |
| --- | --- |
| `supersedes_run_id: RALPH-…` | **纠正 / fixup**，或明确「当前有效实现替代 A」 |
| `parent_run_id: RALPH-…` | **纯子需求增量**，父 run 仍有效、不否定 |
| `related_run_id: RALPH-…` | 弱关联（可选）；优先用 `parent_run_id` |

- 与 `suggestReopenAsNew` 一致时用 **`supersedes_run_id`**（勿混用裸词 `supersedes:`  alone 而不写 id 键名）。
- 若将来 schema 开放字段，再迁入 `run.json`；在此之前 progress 即审计事实。

## 1. 修改错了

### 1.1 未 COMPLETED

- 代码错：留在 DELIVER，改代码，追加 `progress.md`，再验
- accept 误 PASS：`gate accept FAIL` 或 `rollback-phase --to DELIVER`
- 分析/计划错：**按相邻边逐步回退**（禁止跳级）。例：当前 ACCEPT →  
  `rollback-phase --to DELIVER` → `--to PLAN` → `--to ANALYZE`（每步可带 reason）；  
  当前 DELIVER → `--to PLAN` 再 `--to ANALYZE`。详见 `rollback.md` 边表。
- 暂停：`set-status PAUSED`

用户话术：`纠正` / `写错了，退回 DELIVER` / `继续 RALPH-xxx：…`

### 1.2 已 COMPLETED

- **禁止** `COMPLETED` → `IN_PROGRESS` 或 un-archive 覆盖
- **新 run**；`progress.md` 写 `supersedes_run_id: <旧 run_id>`
- analyze 只写纠偏差量；title/goal 带「纠正 / fixup」
- 可选：`suggestReopenAsNew` 元数据建议（不创建文件）

用户话术：`纠正 RALPH-xxx：…`

## 2. 新增子级需求

### 2.1 未 COMPLETED

- **禁止** 无必要再 `init` 新 run
- 同 run：analyze 加 `REQ-n`，plan 加 TASK，扩 `scope.in`
- 一次 ACCEPT 覆盖全部 REQ
- **若 `gates.accept=PASS` 但尚未 finalize**（phase 仍在 ACCEPT、status 非 COMPLETED）：先 `gate accept FAIL` 和/或 `rollback-phase --to DELIVER`，再改 analyze/plan/scope 与代码，然后重新验收

用户话术：`在当前 run 增加子需求：…` / `当前任务加…`

### 2.2 已 COMPLETED

- **新 run**；`progress.md` 写 `parent_run_id: <父 run_id>`（纯子增量）
- **不要**对纯子需求写 `supersedes_run_id`（那会暗示父实现作废）；纠正才用 supersedes
- analyze MUST 仅子需求；父项验收可 N/A「已由父 run 验收」
- 轻量路径（tiny-example）

用户话术：`子需求续 RALPH-xxx：…`

## Agent 探测

收到 `/jj-ralph` 或「也要 / 再改 / 补充 / 纠正 / 子需求」时：

1. 查当前/最近 run（active 优先，否则近期 archive）
2. **status ∈ {IN_PROGRESS, PAUSED, BLOCKED, READY_FOR_USER_TEST}** → 同 run 续作（改错回退或加 REQ；注意 accept 已 PASS 未 finalize 窗口）
3. **`status=COMPLETED` 或 `phase=ARCHIVE`（finalize 后通常同时出现）** → 新 run + 强制 progress 链（纠正 → `supersedes_run_id`；子需求 → `parent_run_id`）；轻量 delta
4. 完成报告同时给出新 `run_id` 与关联旧 id

## 对照

| | 改错 | 子需求 |
| --- | --- | --- |
| 未关账 | 同 run 回退/再 DELIVER（相邻边） | 同 run 加 REQ/TASK |
| 已关账 | 新 run + `supersedes_run_id` | 新 run + `parent_run_id` |
| 禁止 | 改写 COMPLETED status | 无关联的第二 run；纯子需求误用 supersedes |

## 负例

| 负例 | 正确 |
| --- | --- |
| COMPLETED 后手改 run.json 继续做 | 新 run + progress 链 |
| 未关账时用户说「也要 close」却新 init 全套 | 同 run 扩 scope |
| 已关账后无关联 init，map 上像无关需求 | progress 写 `parent_run_id` / `supersedes_run_id` |
| 一次 `rollback-phase --to ANALYZE` 从 ACCEPT 跳级 | 相邻边逐步回退 |
| 向 run.json 写入未 schema 的 supersedes 字段 | 写 progress.md 审计行 |
