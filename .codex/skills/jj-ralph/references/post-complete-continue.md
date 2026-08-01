# 续作（agent）

用户向：`docs/commands/jj-ralph.md` §「做完了还要改」。  
回退边：`rollback.md`。

## 原则

- **同一需求 → 同一 `run_id`**（含已归档、`COMPLETED`、`ABANDONED` 救回）。  
- **归档** = map-merge + 快照；可再改、再归档。  
- **新 run** 仅用户明确新需求 / 新 id。  
- 聊天不推进检查点。  
- **用户默认不说 `RALPH-…`。** 口语如「再改 tip」「刚才那个」「这个先不做了」= 续作信号；由 agent 解析 run。

## 探测

1. **解析目标 run（顺序）：**  
   a. 用户显式 `RALPH-…`（可选，少见）  
   b. 本会话已在用的 run  
   c. 最近 `updated_at` 且 title/goal/关键词与用户话匹配  
   d. `map-find` / 目录扫描辅助  
   e. 仍歧义 → 用 **title 列表** 问用户（可附 id），不要逼用户默写编号  
2. 同需求 → **不要 init**：  
   - `ABANDONED` → `resume`  
   - 已归档 / `COMPLETED` / `phase=ARCHIVE` → `resume` 或 `rollback-phase`（如 →DELIVER）  
   - 活跃 → 直接改；若 accept 已 PASS：先 `gate accept FAIL` 或 rollback  
3. 真新需求（用户明确「另外做一件」「新开」或语义全新）→ `init`；可选 progress 写 `parent_run_id` / `supersedes_run_id`（**勿** invent 进 run.json）

## 改错

| 阶段 | 动作 |
| --- | --- |
| DELIVER 中 | 改代码 + progress + 再验 |
| accept 误 PASS | `gate accept FAIL` 或 `rollback-phase --to DELIVER` |
| 计划/分析错 | **相邻边**逐步回退（禁止跳级） |
| 已归档 | `resume` → 同上 → 可再 `finalize` |

## 加需求

同 run：analyze 加 REQ、plan 加 TASK、扩 `scope.in`；一次再验收覆盖全部。  
accept 已过或已归档：先回到 DELIVER，再改再验。

## 废弃

```bash
ralph_ops.mjs abandon --run-id RALPH-x --reason "…"
# 救回
ralph_ops.mjs resume --run-id RALPH-x --reason "…"
```

ABANDONED 上禁止 `map-merge` / `archive`（须先 resume）。  
`close` deprecated。

## 负例

| 错 | 对 |
| --- | --- |
| 要求用户「请提供 RALPH- 编号」才续作 | 自己解析最近/同需求 run |
| 归档后默认新 init | 同 run resume |
| ACCEPT 一次 rollback 到 ANALYZE | 相邻边逐步退 |
| 链字段写进 run.json | 真新 run 时写 progress.md |
| ABANDONED 直接 finalize | 先 resume |
| 把 `$jj-end` 当任务结束 | end 只 Git |

## 命令

```bash
ralph_ops.mjs resume --run-id RALPH-x --reason "…"
ralph_ops.mjs abandon --run-id RALPH-x --reason "…"
ralph_ops.mjs rollback-phase --run-id RALPH-x --to DELIVER --reason "…"
ralph_ops.mjs finalize --run-id RALPH-x --lessons "可复用规则"
ralph_ops.mjs knowledge-contribute --run-id RALPH-x --hook   # 用户：投喂知识库
```

## 投喂知识库

用户说「投喂知识库 / 补充全局知识」时（**不要**要求用户报编号）：

1. 解析 run（同续作探测）  
2. `knowledge-contribute --hook`（重写包 + 可选 extract → candidate only）  
3. 报告：`path`、candidates 数、`hook.status`（ok|skipped|failed）  
4. 失败 fail-open，不改 archive；提示检查 `knowledge_root` / `RALPH_KNOWLEDGE_HOOK_CMD`
