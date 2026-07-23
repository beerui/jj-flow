# $jj-ralph / /jj-ralph

单仓全流程自治闭环：需求分析 → 计划实施 → 验收完成 → 归档。

Codex 用 `$jj-ralph`，Claude Code 用 `/jj-ralph`。

## 何时用

- 当前仓库从需求做到验收与归档
- 需要能力地图沉淀，方便下次找回历史经验
- 用户明确说 ralph / 全流程 / 闭环

不要用：

- 同源多仓迁移主体 → [$jj-same](command-jj-same.html)（ralph 只导出 handoff 包）
- 控制项目多目标调度 → [$jj-dispatch](command-jj-dispatch.html)（ralph 只导出推荐快照）

## 输入模板

```text
$jj-ralph
目标：要完成什么。
资料：PRD、接口、会话、日志、路径。
范围：做什么 / 不做什么。
验收：什么证据算完成。
```

## 产物位置

```text
.workflow/ralph/ralphs/RALPH-{slug}-{date}/
.workflow/ralph/business-map.json
.workflow/ralph/archive/…
.workflow/handoffs/<HOF-ID>/          # 可选交接
.workflow/dispatch/recommendations/…  # 可选分发快照
```

## 机械 CLI（快速收口）

对话负责分析与改代码；下列命令保证格式正确、可重复：

```bash
jj ralph init --run-id RALPH-demo-20260722 --title "…" --goal "…"
jj ralph status --run-id RALPH-demo-20260722
jj ralph archive --run-id RALPH-demo-20260722
jj ralph map-merge --run-id RALPH-demo-20260722
jj ralph map-find --query "关键词"
jj ralph handoff --run-id RALPH-demo-20260722
jj ralph dispatch-snapshot --run-id RALPH-demo-20260722
jj ralph commit-prep --run-id RALPH-demo-20260722
```

默认不自动 `git commit` / `push`。

## 用户何时被打断

MUST 无法安全推断、不可逆操作、缺密钥、需要人工 UAT、脏工作区会覆盖用户改动。其它阶段门禁 PASS 后自动继续。

## 与 same / dispatch

- 完成后若需迁移：`jj ralph handoff` → same 读取 `.workflow/handoffs/`，在目标仓实现（不在 ralph 目录实现）。
- 完成后若需分发：`jj ralph dispatch-snapshot` → dispatch 读取推荐快照。

设计细节见 [jj-ralph 设计](../design-docs/jj-ralph.html)。
