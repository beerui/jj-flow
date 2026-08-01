# 续作：改错、子需求、归档后与废弃救回

> 用户向说明见 `docs/commands/jj-ralph.md` §「做完了还要改 / 还要加东西」。  
> 回退边权威：`rollback.md`。本文规定 **agent 如何续作**（**始终优先同一 `run_id`**）。

## 总原则（无终态冻结）

| 概念 | 含义 |
| --- | --- |
| 统一任务（账本） | 同一 `run_id` + gates；归档后、废弃后仍可 resume |
| 统一任务（业务） | 同一需求族；仅**真新需求**才 `init` 新 run |
| 归档（archive） | 提升 map + 写快照事件；**不是**墓碑；可再归档 |
| `COMPLETED` | 兼容展示态（最近一次归档后）；**可** continue → `IN_PROGRESS` |
| `ABANDONED` | 做一半不要了；**不** map-merge；可 resume 救回 |

```text
resolve target run (named | latest active | latest any)
if ABANDONED → resume IN_PROGRESS + progress
if 曾归档 / status=COMPLETED / phase=ARCHIVE → 同 run 续作（resume / rollback gates），禁止默认强制新 run
if 活跃 → 同 run 差量续作
新 RALPH 仅当：明确新需求族 / 用户要求新 id
```

聊天不推进检查点。不进 skill 的会话改码 ≠ 账本续作。

### 关联字段约定（SSOT）

`run.json` schema **未**声明 `supersedes_run_id` 等 top-level 键（`additionalProperties: false` 时勿 invent 进 run.json）。

**权威落点：`progress.md` 审计行**，键名统一：

| 键 | 何时 |
| --- | --- |
| `supersedes_run_id: RALPH-…` | **仅**真新 run 纠正旧实现时（少见；默认同 run 续作） |
| `parent_run_id: RALPH-…` | **仅**真新 run 且纯子需求族分叉时（少见） |
| `related_run_id: RALPH-…` | 弱关联（可选） |

- 默认路径**不需要**新 run，也就**不需要**链字段。
- 与 `suggestReopenAsNew` 一致时：该 helper **仅**服务真新需求；note 会提示 **prefer same-run resume**。
- 若将来 schema 开放字段，再迁入 `run.json`；在此之前 progress 即审计事实。

## 1. 修改错了

### 1.1 活跃 run（含 PAUSED / BLOCKED / READY_FOR_USER_TEST）

- 代码错：留在 DELIVER，改代码，追加 `progress.md`，再验
- accept 误 PASS：`gate accept FAIL` 或 `rollback-phase --to DELIVER`
- 分析/计划错：**按相邻边逐步回退**（禁止跳级）。例：当前 ACCEPT →  
  `rollback-phase --to DELIVER` → `--to PLAN` → `--to ANALYZE`（每步可带 reason）；  
  当前 DELIVER → `--to PLAN` 再 `--to ANALYZE`。详见 `rollback.md` 边表。
- 暂停：`set-status PAUSED`

用户话术：`纠正` / `写错了，退回 DELIVER` / `继续 RALPH-xxx：…`

### 1.2 已归档 / status=COMPLETED / phase=ARCHIVE

- **优先同 run**：`resume` / `set-status IN_PROGRESS --reason "…"`（或 `rollback-phase --to ACCEPT|DELIVER`，COMPLETED 时自动 resume）
- 清/改相关 gates（如 accept/archive → PENDING 或 FAIL）后改代码，再验，可 **再 archive**
- 归档快照目录保留作审计；**不**擦除历史 snapshot；再归档可走时间戳子目录
- **不要**默认 `init` 新 run；**不要**说「禁止 reopen」

用户话术：`继续 RALPH-xxx：…` / `纠正 RALPH-xxx：…`（仍落在同 run）

### 1.3 ABANDONED

- `resume --reason "…"` → `IN_PROGRESS`，同目录续作
- **禁止**对 ABANDONED 做 `map-merge` / `archive`（须先 resume）

## 2. 新增子级需求

### 2.1 任意未废弃的同一业务任务（含已归档）

- **禁止** 无必要再 `init` 新 run
- 同 run：analyze 加 `REQ-n`，plan 加 TASK，扩 `scope.in`
- 若 `gates.accept=PASS` 或已 soft-archive：先 `gate accept FAIL` 和/或 `rollback-phase --to DELIVER`（必要时 `resume`），再改 analyze/plan/scope 与代码，然后重新验收；通过后可再 `finalize`/`archive`
- 一次（再）ACCEPT 覆盖全部 REQ

用户话术：`在当前 run 增加子需求：…` / `继续 RALPH-xxx 再加…` / `当前任务加…`

### 2.2 真新需求族（例外）

仅当用户明确新需求 / 新 id / 与旧任务无关时：

- `init` **新** run
- 可选：`progress.md` 写 `parent_run_id`（弱溯源）或 `supersedes_run_id`（明确替代）
- 可用 `suggestReopenAsNew` 仅作元数据建议（**不**创建文件，**不**强制新 run）

用户话术：`新开 RALPH 做另一件事：…`

## 3. 废弃一半不做了

- `abandon` / `set-status ABANDONED --reason "…"`
- 进度记 reason；**不**进 map 能力源
- 以后又要做：`resume` 同 run，**不是**假关仓、也**不是**必须新 run
- `close` **deprecated** → 提示改用 `abandon` 或 `archive`/`finalize`

## Agent 探测

收到 `/jj-ralph` 或「也要 / 再改 / 补充 / 纠正 / 子需求 / 继续」时：

1. 查当前/最近 run（named | latest active | latest any，含 archive/COMPLETED/ABANDONED）
2. **同一业务任务** → **同 run** 续作：
   - `ABANDONED` → `resume` 再 DELIVER
   - `COMPLETED` / 曾归档 / `phase=ARCHIVE` → `resume` 或 `rollback-phase`，再改/再验/可再归档
   - 活跃 → 差量改错或加 REQ（注意 accept 已 PASS 窗口：先 FAIL/rollback）
3. **仅**用户明确新需求族 / 要求新 id → 新 run（可选 progress 链）
4. 完成报告给出 **同一** `run_id`（或例外时新旧 id）

## 对照

| | 改错 | 子需求 | 一半不做 |
| --- | --- | --- | --- |
| 活跃 | 同 run 回退/再 DELIVER | 同 run 加 REQ/TASK | `abandon` |
| 已归档 / COMPLETED | **同 run** resume + 再验（可再归档） | **同 run** 扩 scope 再验 | n/a（已归档不是废弃） |
| ABANDONED | resume 同 run | resume 后加 REQ | 已是 |
| 真新需求 | 新 run + 可选 `supersedes_run_id` | 新 run + 可选 `parent_run_id` | — |
| 禁止 | 默认强制新 run；声称 COMPLETED 不可续 | 无必要的第二 run | map-merge 废弃 run；把 close 当一等入口 |

## 负例

| 负例 | 正确 |
| --- | --- |
| COMPLETED 后强制新 init 只因「已关账」 | 同 run `resume` / continue |
| 手改 run.json 不写 progress 改 status | `set-status` / `resume`（写 progress） |
| 未归档时用户说「也要…」却新 init 全套 | 同 run 扩 scope |
| 一次 `rollback-phase --to ANALYZE` 从 ACCEPT 跳级 | 相邻边逐步回退 |
| 向 run.json 写入未 schema 的链字段 | 真新 run 时写 progress.md；默认同 run 无需链 |
| ABANDONED 上 `map-merge` / `archive` | 先 `resume` |
| 使用 `close` 关任务 | `abandon` 或 `archive`/`finalize` |
| 把 `$jj-end` 当成任务终态 | `$jj-end` 只做 Git，与 run 生死正交 |

## 命令面（续作相关）

```bash
ralph_ops.mjs resume --run-id RALPH-x --reason "归档后续改 tip"
# 或 continue（同 resume）
ralph_ops.mjs abandon --run-id RALPH-x --reason "需求取消"
ralph_ops.mjs set-status --run-id RALPH-x --status IN_PROGRESS --reason "…"
ralph_ops.mjs rollback-phase --run-id RALPH-x --to DELIVER --reason "…"
ralph_ops.mjs finalize --run-id RALPH-x   # = map-merge + soft archive（可再次）
```
