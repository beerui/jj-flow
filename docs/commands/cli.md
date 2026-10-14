# CLI 命令行参考（维护与调试）

::: warning 面向维护者与底层脚本，非日常开发主入口
日常在业务仓库做需求、跨仓迁移或提交合并时，请直接在 Codex / Claude Code / Grok / Qoder 对话窗口中使用 **`$jj-ralph`、`$jj-same`、`$jj-dispatch`、`$jj-end`** 等对话命令，**不需要**手动敲本页的 CLI 子命令。
本页仅供**首次安装/卸载技能、本机诊断（`doctor`）、存量任务运维以及维护 `jj-flow` 仓库本身**时查阅。
:::

命令行调用方式：`npx @brewer/jj-flow@latest <子命令>`，或在已安装包的环境下直接运行 `jj <子命令>`。

## 一、全部 CLI 命令速览

| 命令分组 | 子命令 | 读写属性 | 用途说明 |
| :--- | :--- | :--- | :--- |
| **安装与卸载** | `install-skill` / `uninstall-skill` | 写宿主目录 | 安装或移除各平台的 skills、斜杠命令与子代理，同时初始化 `~/.jj-flow` |
| **环境诊断** | `doctor` | 只读 | 检查本机 `~/.jj-flow` 目录、项目地图、知识库及当前仓库接入状态 |
| **地图与知识** | `home init` / `init preview\|join\|ingest` / `map lookup\|add` | 预览只读 / 写入需确认 | 对应 `$jj-init` 底层机械步骤：生成主目录、预览提案、加入地图、导入知识 |
| **单仓任务运维** | `ralph *` | 读写 `.workflow/ralph/` | 供维护脚本或存量清理使用的 `ralph` 状态机子命令（对话路径不直接调用） |
| **Git 批量收尾** | `end preview` / `end execute` | 预览只读 / 执行写 Git | 对应 `$jj-end` 底层批量执行器：生成收工预览计划并在授权下批量执行 |
| **多仓调度控制** | `dispatch-tick` / `task *` | 默认预览 / `--write` 写账本 | 单步推进多项目调度控制面、查询任务脚手架与分配状态 |
| **验证与演练** | `scenario` / `trace` / `host-trial` / `grok-trial` / `harness-gc` | 只读或临时目录演练 | 确定性场景回放、半真实/真实宿主试跑与仓库熵扫描 |

## 二、安装、卸载与环境诊断（日常最常用）

### 1. 安装与卸载（`install-skill` / `uninstall-skill`）

```bash
# 安装对话入口与子代理
jj install-skill [--platform codex|claude|qoder|grok|agents|all] [--project | --target dir] [--force] [--dry-run] [--json]

# 卸载官方已登记的对话入口与子代理
jj uninstall-skill [--platform codex|claude|qoder|grok|agents|all] [--project | --target dir] [--force] [--dry-run] [--json]
```

**关键行为规则：**
* **按清单安全管理**：卸载时只删除安装清单（ownership manifest）登记过的官方资产，绝不按 `jj-*` 名字前缀误删用户自建文件。
* **增量补齐与强制刷新**：重复运行 `install-skill` 会补齐缺失的技能，默认不覆盖已存在文件；升级覆盖请加 `--force`。
* **跨层级防重（Shadowing）**：若同一资产已在另一层级（用户级 `~/.claude` vs 项目级 `./.claude`）存在，默认跳过并在 `shadowed` 字段报告，防止编辑器菜单出现重复命令；若两层都已存在，会在 `duplicates` 中给出清理命令提示。

### 2. 本机环境只读诊断（`doctor`）

```bash
jj doctor [--json]
```

默认输出面向人类阅读的简明中文摘要（主目录位置、地图项目数、知识库状态、当前仓库是否已登记）。`--json` 仅供脚本或 Agent 解析（不要把整段 JSON 直接贴给用户，展示 `user_view` 即可）。

### 3. 主目录与项目地图管理（`home` / `init` / `map`）

日常请用对话命令 `$jj-init`。底层对应子命令如下：

```bash
jj home init [--json]
jj init preview [--cwd dir] [--root DIR] [--json]
jj init join --path DIR [--name NAME] [--aliases a,b] [--family FAMILY] [--json]
jj init ingest --run-id RALPH-x | --file path [--json]
jj map lookup [--cwd dir] [--json]
jj map add --path DIR [--name NAME] [--aliases a,b] [--family FAMILY] [--json]
```

## 三、单仓任务存量运维（`ralph` 子命令）

日常做需求请直接在对话里用 `$jj-ralph`（对话路径下主会话通过读写 Markdown 与 JSON 文档推进任务，不执行 CLI）。以下子命令供**存量任务迁移、批量收尾或脚本调试**使用：

### 1. 常用运维与存量清理命令

```bash
# 检索当前仓库的任务列表（默认最多返回 8 条简明候选，--details 返回全量）
jj ralph locate [--run-id task-…] [--limit 8] [--details] [--json]

# 检查或批量收尾滞后任务（默认 dry-run 只列名单；加 --yes 执行 migrate 与 finalize）
jj ralph remediate [--yes] [--force] [--json]

# 将旧版 1.0 RALPH-* 目录提升迁移为新版 .workflow/ralph/<task_key>/ 结构
jj ralph migrate [--all-projects] [--prune-archive] [--yes] [--json]

# 将已有旧任务绑定到规范的 task-* 目录名
jj ralph adopt --task task-… [--from RALPH-…] [--absorb task-…] [--json]
```

::: info 活跃任务阈值提醒规则
当 `.workflow/ralph/index.md` 中进行中的任务超过 **5 条**、或任一条超过 **5 天**未更新时，系统会记录「归档提示」；同一会话或同需求出现并排的「审查修复」任务时，会记录「同需求提示」。所有提示仅作提醒，不会自动删除或归档你的任务。
:::

### 2. 状态机与门禁底层子命令（供脚本与测试调用）

```bash
jj ralph init --run-id task-… --title "…" --goal "…" \
  [--intensity tiny|standard|strict] [--lite|--full] [--max-iterations N] \
  [--capability CAP-…] [--in a,b] [--out c,d] [--project KEY] [--knowledge-query Q] [--no-knowledge-refs] \
  [--intent|--no-intent] [--host-id …] [--thread-id …] [--model-id …] [--session-export path] [--force] [--json]

jj ralph status [--run-id task-…] [--details] [--json]
jj ralph context --run-id task-… [--review] [--review-scope working_tree|commit] [--base-commit sha] [--output path] [--json]
jj ralph gate --run-id task-… --gate analyze|plan|deliver|accept|archive|brief|close --status PASS|FAIL|… [--no-advance] [--json]
jj ralph scope --run-id task-… [--in path]… [--out path]… [--json]
jj ralph scope --run-id task-… --replace-in path [--replace-in path]… --reason "当前合同变更原因" [--json]
jj ralph deliver-attempt --run-id task-… [--improved true|false] [--signal text] [--json]
jj ralph accept-layer --run-id task-… --layer mechanical|judgment \
  --status PASS|FAIL|PENDING|SKIPPED [--mode none|review|recheck|adversarial_note] [--note text] [--json]
jj ralph rollback-phase --run-id task-… --to PLAN|DELIVER|ANALYZE --reason "…" [--json]
jj ralph set-status --run-id task-… --status PAUSED|BLOCKED|IN_PROGRESS --reason "…" [--json]
jj ralph resume|continue --run-id task-… [--reason "…"] [--json]
jj ralph abandon --run-id task-… [--reason "…"] [--json]
jj ralph finding --run-id task-… --action "…" --scope "…" [--phenomenon "…"] [--cause "…"] [--rule "…"] [--json]
jj ralph metrics --run-id task-… [--persist] [--json]

jj ralph archive --run-id task-… [--slug name] [--json]
jj ralph finalize --run-id task-… [--modules p1,p2] [--keywords a,b] [--lessons "l1|l2"] [--slug name] [--force] [--include-process-lessons] [--no-contribution-package] [--json]
jj ralph map-merge --run-id task-… [--modules …] [--keywords …] [--lessons …] [--force] [--include-process-lessons] [--json]
jj ralph map-find --query "关键词" [--limit N] [--json]
jj ralph knowledge-contribute --run-id task-… [--lessons "l1|l2"] [--modules …] [--hook] [--json]
jj ralph knowledge-confirm --needle "…" [--project KEY] [--json]
jj ralph knowledge-prune [--project KEY] [--json]

jj ralph handoff --run-id task-… [--handoff-id HOF-…] [--target name] [--json]
jj ralph dispatch-snapshot --run-id task-… [--target name] [--json]
jj ralph commit-prep --run-id task-… [--json]
jj ralph review-record --run-id task-… --outcome PASS|NEEDS_CHANGES|BLOCKED [审查溯源选项…] [--json]
jj ralph host-record --run-id task-… [--host-id …] [--thread-id …] [--model-id …] [--export-path …] [--json]
```

**关键参数说明：**
* **`gate_set`（机械 CLI 专属）**：默认 `full`（五步门禁）。机械 CLI 下显式传入 `--lite` 时走 `brief → deliver → close` 压缩路径（对话路径永远走完整五步，不使用 `--lite`）。
* **审查上下文快照（`--context-file`）**：
  ```bash
  jj ralph context --run-id task-demo --review --output .workflow/ralph/task-demo/.state/review-context.json --json
  jj ralph review-record --run-id task-demo --outcome PASS --source host_builtin --context-file .workflow/ralph/task-demo/.state/review-context.json --findings-file .workflow/findings.json --host-review-file .workflow/host-review.json --json
  jj ralph gate --run-id task-demo --gate accept --status PASS --context-file .workflow/ralph/task-demo/.state/review-context.json --json
  ```
* **便携脚本同步**：`skills/jj-ralph/scripts/ralph_ops.mjs` 与 `src/ralph.mjs` 共享同一套实现，修改 `src/ralph*` 后必须运行 `npm run ralph:sync`。

## 四、Git 批量收尾执行器（`end` 子命令）

日常请使用 `$jj-end` 对话入口。技能内部调用随包分发的 `scripts/end_ops.mjs`（与 `jj end` 同源，修改 `src/end*` 后运行 `npm run end:sync`）：

```bash
jj end preview --work-branch feature/demo --paths-file ../task-paths.json --message-file ../commit-message.txt --output ../end-preview.json
jj end execute --plan-file ../end-preview.json
```

* **仓库外临时文件保护**：`--paths-file`、`--message-file` 与 `--output` 预览文件均放置在仓库工作区之外（通常在系统临时目录），避免污染业务仓 Git 状态。
* **严格状态校验**：`preview` 完全只读；`execute` 会核对预览生成时的分支、文件列表与远端身份，按照 `fetch → commit → sync/push work → sync/merge/push integration → return` 顺序执行，任一步出错立即停止并返回实际完成进度（要求 Git 2.38 及以上版本）。

## 五、多仓调度与任务查询（`dispatch-tick` / `task`）

```bash
# 单步调度预览或 CAS 写入（默认只读预览，加 --write 才更新控制面）
jj dispatch-tick --delivery DELIVERY_ID [--manifest path | --control-root dir] [--receipt receipt.json] [--write] [--json]

# 任务脚手架与状态查询
jj task scaffold --delivery DELIVERY_ID [--manifest path | --control-root dir] [--task TASK-ID] [--root dir] [--json]
jj task assign --task TASK-ID [--delivery DELIVERY_ID] [--manifest path] [--control-root dir] [--json]
jj task status --task TASK-ID [--root dir] [--manifest path] [--control-root dir] [--json]
jj task context --task TASK-ID [--root dir] [--manifest path] [--control-root dir] [--json]
```

## 六、场景验证、宿主试跑与仓库维护

```bash
jj scenario list|check|run <scenario|all> [--json]
jj trace explain|replay <trace.json> [--json]
jj host-trial run [--json]
jj grok-trial run [--json] [--session-id ID] [--write-report] [--report-path path]
jj harness-gc [--json]
```

开发维护 `jj-flow` 本仓库时的常用 NPM 脚本：

```bash
npm run docs:dev        # 启动 VitePress 本地热更新预览
npm run docs:check      # 校验侧栏覆盖、表格语法、更新日志切分与死链构建
npm run docs:build      # 构建静态站点至 site/
npm run docs:preview    # 本地预览构建产物（含 /jj-flow/ 路径前缀）
npm run ralph:sync      # 同步 src/ralph* 到 skills/jj-ralph/scripts/lib/
npm run end:sync        # 同步 src/end* 到 skills/jj-end/scripts/lib/
npm run harness:check   # 运行仓库 Harness 契约检查
npm run harness:gc      # 运行只读熵扫描与质量评分
npm run verify          # 运行全量门禁测试链
```

## 相关阅读

* [1 分钟安装与配置](../installation.md)
* [命令总览与选型指南](../commands.md)
* [第一次使用（完整实战）](../usage.md)
* [仓库与文档维护指南](../maintenance.md)
