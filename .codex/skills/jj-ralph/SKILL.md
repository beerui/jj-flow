---
name: jj-ralph
description: 单仓全流程自治闭环：需求分析 → 计划实施 → 验收完成 → 归档；全步骤文档留痕、能力地图可检索、仅在必要时请用户介入。可导出 handoff 供 jj-same、导出分发快照供 jj-dispatch。
---

# jj-ralph

单仓 Ralph 循环：把需求做完并留下可追溯产物。记忆在 Git 与 `.workflow/ralph/`，不靠聊天推进检查点。

用 Read、Glob、Grep、Bash、Git 与聚焦测试。

## 何时用

- 当前仓库从需求到验收的完整闭环
- 需要能力地图沉淀，方便下次会话找回历史经验
- 用户明确说 ralph / 全流程 / 闭环 / 归档

不要用：

- 同源多仓迁移主体 → `$jj-same`（ralph 只产出 handoff 包）
- 控制项目多目标调度 → `$jj-dispatch`（ralph 只产出推荐快照）

## 输入

保留用户原始目标。完整输入通常含：目标、资料、范围（做/不做）、验收。资料不全时可先建 run，安全默认记入 `assumptions`。

## 立即动作

1. 若无 run：
   `jj ralph init --run-id RALPH-{slug}-{YYYYMMDD} --title "…" --goal "…"`
   或按 [references/artifact-layout.md](references/artifact-layout.md) 手建 `ralphs/` 目录。
2. 读 `business-map.json` 或 `jj ralph map-find --query "…"`，复用历史能力/教训。
3. 按 [references/phases.md](references/phases.md) 推进 ANALYZE → PLAN → DELIVER → ACCEPT → ARCHIVE。
4. 阶段产物写在 **`.workflow/ralph/ralphs/<run_id>/`**（目录名是 **ralphs**，不是 runs）。
5. accept PASS 后机械收口（推荐 CLI，快且格式正确）：
   - `jj ralph archive --run-id …`
   - `jj ralph map-merge --run-id …`
   - 需要迁移：`jj ralph handoff --run-id …`（产物在 **handoffs/**，不在 ralph 内实现）
   - 需要分发：`jj ralph dispatch-snapshot --run-id …`
   - 提交清单：`jj ralph commit-prep --run-id …`（**不**自动 commit/push）
   - 轻量审查：`$jj-review` + `jj ralph review-record --run-id …`

## 阶段产物

| 阶段 | 文件 | 要点 |
| --- | --- | --- |
| ANALYZE | `analyze.md` | MUST/OUT/UNRESOLVED、验收、能力草案 CAP-* |
| PLAN | `plan.md` | TASK→REQ、最小文件、不做范围 |
| DELIVER | 业务代码 + `progress.md` | 每轮追加；验证 FAIL 则返工直至 PASS 或 BLOCKED |
| ACCEPT | `acceptance.md` | 每项 PASS 或 N/A+理由；无证据不得 PASS |
| ARCHIVE | archive + map | CLI archive + map-merge |

`run.json` 契约见 [references/ralph-run.schema.json](references/ralph-run.schema.json)。

## 用户介入

仅当：MUST 无法安全推断、不可逆操作、缺密钥、需 UAT、脏工作区覆盖用户改动。其余自动推进，不问「是否继续下一阶段」。

## 与 same / dispatch

详见 [references/integrations.md](references/integrations.md)。

- **same**：`jj ralph handoff` → `.workflow/handoffs/<HOF-ID>/`；same 读需求在目标仓实现，**不在 ralph 文件夹下写迁移实现**。
- **dispatch**：`jj ralph dispatch-snapshot` → 推荐快照；dispatch 负责其它项目任务身份。

## 能力地图

[references/business-map.md](references/business-map.md)。下次会话必须先 `map-find` 或读 `business-map.json` 再决定是否从零分析。

## 完成报告（中文）

- run_id、phase、status、产物路径
- 验收结论与证据
- 地图是否已 merge、可检索关键词
- handoff / dispatch-snapshot 路径（若有）
- commit-prep 建议（未要求则不提交）
- 阻塞与解除条件（若有）

## 调用示例

```text
$jj-ralph 目标=登录后密码过期提醒 范围=仅登录成功路径 验收=有提示且可跳转改密
$jj-ralph 继续 RALPH-login-reminder-20260722
$jj-ralph 查地图 密码过期
```
