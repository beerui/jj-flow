# $jj-ralph / /jj-ralph

单仓全流程自治闭环：需求分析 → 计划实施 → 验收完成 → 归档。

Codex 用 `$jj-ralph`，Claude Code 用 `/jj-ralph`。

## 何时用

- 当前仓库从需求做到验收与归档
- 需要能力地图沉淀
- 用户明确说 ralph / 全流程 / 闭环

不要用：

- 同源多仓迁移主体 → [$jj-same](command-jj-same.html)
- 控制项目多目标调度 → [$jj-dispatch](command-jj-dispatch.html)

## 输入模板

```text
$jj-ralph
目标：要完成什么。
资料：PRD、接口、会话、日志、路径。
范围：做什么 / 不做什么。
验收：什么证据算完成。
```

已定位到文件/行号的小改动，直接附路径；协议走短产物路径。

## 产物位置

```text
.workflow/ralph/RALPH-{slug}-{date}/
.workflow/ralph/business-map.json
.workflow/ralph/archive/…
.workflow/handoffs/<HOF-ID>/
.workflow/dispatch/recommendations/…
```

## 执行默认

- 机械步骤优先 skill 脚本 `ralph_ops.mjs`（自带 `scripts/lib/ralph.mjs`，业务仓无需 jj-flow 包）
- 仅 skill 损坏时 skeleton 手建；不要因“无 jj-flow”降级
- 少检索、短产物、失败换策略
- accept 后优先 `finalize`（map-merge + archive）
- JSON 优先脚本；脚本不可用再复制 skill 内 skeleton
- 默认不自动 commit/push

设计细节见 [jj-ralph 设计](../design-docs/jj-ralph.html)。

## 记忆与知识库

从 **0.1.1-beta.31** 起，`jj ralph init` 默认从顶层知识库自动挂载 `knowledge_refs` / `knowledge_summary`。知识库路径可配置（`dispatch.knowledge_root` / `PORTFOLIO_KB_ROOT` / `{portfolio_root}/knowledge`；本机 portfolio 例 `D:/a/knowledge`），见 [安装 · 本机目录配置](installation.html)。

- 关闭：`--no-knowledge-refs`
- 指定检索：`--project <key> --knowledge-query "..."`
- 任务结束后：更新 business-map → `kb extract --incremental` → promote 高置信条目

完整操作见 [记忆与知识库](../memory-knowledge-guide.html)。设计见 [Portfolio Knowledge](../design-docs/portfolio-knowledge.html)。
