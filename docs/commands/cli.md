# CLI 参考（维护 / 调试）

> **面向维护者与 Agent 机械步骤，不是日常用法。**  
> 正常交付请在 Codex / Claude / Grok / Qoder 里用 **对话入口**（`$jj-ralph` / `/jj-same` / …），**不要**让用户手敲下面命令完成业务。  
> 本页把 `jj` 表面 **集中列全**，教程与工作流页不再展开 CLI。

入口：`npx @brewer/jj-flow@latest …` 或本地 `jj`（需已安装包）。

---

## 总览

| 命令 | 用途 |
|------|------|
| `install-skill` / `uninstall-skill` | 安装或卸载 skill / 薄命令（同时生成 `~/.jj-flow` 空 map/知识结构） |
| `home init` / `init preview\|join\|ingest` / `map lookup` / `map add` | 生成用户主目录；接入地图与补知识（`$jj-init` 对话入口，须用户同意）；`map lookup` 只读 |
| `doctor` | 只读诊断 Git / Harness / 路径 / capabilities |
| `ralph *` | 单仓 run 机械步骤（不替代对话） |
| `end preview` / `end execute` | Git 收尾预览和批量执行；不写任务账本 |
| `dispatch-tick` | 单次调度 tick 预览或 CAS 写入 |
| `task scaffold` / `task assign` | 任务脚手架与轻量分配展示 |
| `scenario` | 确定性场景 list / check / run |
| `trace` | explain / pure replay |
| `host-trial run` | 半真实 Host 试跑（非真 Host） |
| `grok-trial run` | 真 Grok 会话试跑（不关 Wave 2） |
| `harness-gc` | 只读熵扫描 |

---

## 安装与卸载

```bash
jj install-skill [--platform codex|claude|qoder|grok|all] [--project | --target dir] [--force] [--dry-run] [--json]
jj uninstall-skill [--platform …] [--project | --target dir] [--force] [--dry-run] [--json]
```

- 默认不按名称前缀扫描未知文件；只动 ownership 登记资产
- 再跑 `install-skill` 会补上缺失 skill（如 `jj-init`），不覆盖已有文件；刷新旧副本才加 `--force`
- 本地改过或历史未登记：默认拒绝，审查后 `--force`
- 用户装入口仍可在 [安装](../installation.md) 用一行 `npx … install-skill`；装好后请走对话，不必再学 CLI
- `install-skill` 会在 `~/.jj-flow` 生成空 `naming.json` / `map.md` / `knowledge/`（已有文件不覆盖）

```bash
jj home init [--json]
jj init preview [--cwd dir] [--root DIR] [--json]
jj init join --path DIR [--name NAME] [--aliases a,b] [--family FAMILY] [--json]
jj init ingest --run-id RALPH-x | --file path [--json]
jj map lookup [--cwd dir] [--json]
jj map add --path DIR [--name NAME] [--aliases a,b] [--family FAMILY] [--json]
```

对话入口是 `$jj-init`。`preview` 只提案（默认短中文 `user_view`；`--json` 给 Agent，不要贴给用户）；`join` / `ingest` 须用户同意后由 Agent 代写。`map lookup` / doctor / ralph 只读地图。`jj ralph init` 是开单仓 run，不是接入。

---

## doctor

```bash
jj doctor [--json]
```

默认给用户看短中文（主目录 / 地图 / 知识 / 当前项目在不在地图里）。`--json` 给 Agent，**不要**把整份 JSON 贴给用户；复述 `user_view` 即可。业务仓缺 harness-manifest 不算失败。

---

## ralph 子命令

对话入口仍是 `$jj-ralph` / `/jj-ralph`。下列命令供 skill 脚本 / 维护脚本调用。`run_id` 即任务目录名，形如 `task-<slug>`（P2 起；旧 `RALPH-*` 目录先 `migrate` / `adopt`）。

```bash
jj ralph init --run-id task-… --title "…" --goal "…" \
  [--intensity tiny|standard|strict] [--lite|--full] [--max-iterations N] \
  [--capability CAP-…] [--in a,b] [--out c,d] [--project KEY] [--knowledge-query Q] [--no-knowledge-refs] \
  [--intent|--no-intent] [--host-id …] [--thread-id …] [--model-id …] [--session-export path] [--force] [--json]

jj ralph status [--run-id task-…] [--details] [--json]
jj ralph locate [--run-id task-…] [--limit 8] [--details] [--json]
jj ralph context --run-id task-… [--review] [--review-scope working_tree|commit] [--base-commit sha] [--output path] [--json]
jj ralph gate --run-id task-… --gate analyze|plan|deliver|accept|archive|brief|close --status PASS|FAIL|… [--no-advance] [--json]
jj ralph scope --run-id task-… [--in path]… [--out path]… [--json]
jj ralph scope --run-id task-… --replace-in path [--replace-in path]… --reason "当前合同变更原因" [--json]
jj ralph deliver-attempt --run-id task-… [--improved true|false] [--signal text] [--json]
jj ralph accept-layer --run-id task-… --layer mechanical|judgment \
  --status PASS|FAIL|PENDING|SKIPPED [--mode none|review|recheck|adversarial_note] [--note text] [--json]
jj ralph rollback-phase --run-id task-… --to PLAN|DELIVER|ANALYZE --reason "…" [--json]
jj ralph set-status --run-id task-… --status PAUSED|BLOCKED|IN_PROGRESS --reason "…" [--json]
jj ralph finding --run-id task-… --action "…" --scope "…" [--phenomenon "…"] [--cause "…"] [--rule "…"] [--json]
jj ralph metrics --run-id task-… [--persist] [--json]

jj ralph archive --run-id task-… [--slug name] [--json]
jj ralph finalize --run-id task-… [--modules p1,p2] [--keywords a,b] [--lessons "l1|l2"] [--slug name] [--force] [--json]
jj ralph map-merge --run-id task-… [--modules …] [--keywords …] [--lessons …] [--force] [--json]
jj ralph map-find --query "关键词" [--limit N] [--json]
jj ralph knowledge-contribute --run-id task-… [--lessons "l1|l2"] [--modules …] [--hook] [--json]
jj ralph knowledge-confirm --needle "…" [--project KEY] [--json]
jj ralph knowledge-prune [--project KEY] [--json]

jj ralph handoff --run-id task-… [--handoff-id HOF-…] [--target name] [--json]
jj ralph dispatch-snapshot --run-id task-… [--target name] [--json]
jj ralph commit-prep --run-id task-… [--json]
jj ralph review-record --run-id task-… --outcome PASS|NEEDS_CHANGES|BLOCKED [审查溯源选项…] [--json]
jj ralph host-record --run-id task-… [--host-id …] [--thread-id …] [--session-handle …] [--model-id …] [--export-path …] [--json]

jj ralph migrate [--all-projects] [--json]
jj ralph adopt --task task-… [--from RALPH-…] [--absorb task-…] [--json]
```

说明：

- `intensity`：`tiny` / `standard`（默认）/ `strict`，决定预算与 accept 判断层；对话入口见 [ralph 命令](jj-ralph.md)
- `gate_set`：默认 `full`（五 gate）。`--lite` 走 `brief` → `deliver` → `close`：`brief` = analyze + plan，`close` = accept + archive，账本仍写五键，`close` 照走 accept / archive 证据门；`budget.max_deliver_loops ≤ 3`。任一 gate FAIL / BLOCKED，或 `scope --in` 新增路径，自动升 full（恢复 intensity 预算），同目录、不换 `run_id`。lite 预算到顶时只停（`BLOCKED`，`unblock` 指明出口），不自动升档；`gate deliver FAIL` 即出口，升 full 并解除该 BLOCKED。`gate_set` 与 `intensity` 正交：tiny 不等于 lite
- 无 `--lite` / `--full` 时，init 按规模**只给建议**：改动面小（`--in` ≤ 2 个具体文件，或标题 / 目标含「小改 / 顺手 / typo / px」这类口语）、无架构词（重构 / 协议 / 鉴权 / 迁移 / schema / api …）、单一验收项，三者同时成立才建议 `lite`，拿不准即 `full`。文本模式多打一行 `gate_set? lite …`，`--json` 带 `run.gate_set_suggestion`（`applied=false`）；`run.json` 仍写 `full`。要走 lite 必须显式 `--lite`（尚未过任何 gate 时可 `--lite --force` 重 init）
- `deliver-attempt`：DELIVER 每轮记一次是否改进；省略 `--improved` 时按工作区指纹自动判定；连续无改进 → `BLOCKED` + `STAGNATION`
- `accept-layer`：双层验收；**strict** 下 judgment 须 PASS 才能 `gate accept PASS`
- `archive` / `finalize` 默认要求 accept=PASS（`--force` 可覆盖）；`finalize` = map-merge + archive；归档原地翻转，不再复制到 `archive/`
- `finding`：按五要素（现象 / 原因 / 对策 / 适用范围 / 证据）追写 `findings.md`，并在 progress 留一行索引
- `migrate`：把活跃的旧 `RALPH-*` 目录 1:1 迁到 `tasks/task-<slug>/`（原目录改名 `.migrated-*` 保留）；`adopt --task` 把已有 run 绑定到规范目录，`--absorb` 只提示、不自动合并
- `handoff` 写 `tasks/<task_key>/.state/handoff.json`（`run.handoff` 仍是 SSOT；迁移实现本身走 `$jj-same`，不在 ralph 目录内）
- `commit-prep` 只出清单与 message，**不** git commit / push
- 业务仓也可由 skill 内 `ralph_ops.mjs` 调用同源逻辑（权威实现 `src/ralph.mjs`，`npm run ralph:sync` 同步）

定位与审查可用短路径：已知编号直接 `context --run-id`；`locate` 默认只返回 8 个简明候选及省略数量，`--details` 返回全部。`status --details` 保留完整 run 和指标。`context --review` 一次汇集当前 Goal / 验收 / Steps、验证记录尾部、上一份审查及真实 Git 范围；不推进门禁、不读完整业务地图。路径按仓库根匹配，同名文件不互相替代，其他脏文件另列。

```text
jj ralph context --run-id task-demo --review --output .workflow/ralph/task-demo/.state/review-context.json --json
jj ralph review-record --run-id task-demo --outcome PASS --source host_builtin --context-file .workflow/ralph/task-demo/.state/review-context.json --findings-file .workflow/findings.json --host-review-file .workflow/host-review.json --json
jj ralph gate --run-id task-demo --gate accept --status PASS --context-file .workflow/ralph/task-demo/.state/review-context.json --json
```

`findings.json` 为审查结果数组，`host-review.json` 为真实宿主元数据对象；文件支持 UTF-8 BOM，路径相对 cwd，避免 PowerShell 内联 JSON 转义。`finalize` / `archive` 同样接受 `--context-file`。空范围、缺失计划文件、修改过的快照不能变成通过；代码、index、HEAD、当前合同变化后，刷新材料并审查增量。已记录的快照也在后续门禁自动核对，省略参数不会让旧审查重新有效。已提交内容须用 commit 范围，`--base-commit` 缺省为 HEAD 第一父提交，根提交与空树比较；任务文件仍脏时不能宣称提交范围审查完成。

`scope --replace-in` / `--replace-out` 用于方案已明确替换旧范围的续办，必须给 `--reason`，旧范围保留在事件中。它不自动删历史要求，`scope.out` 也不隐藏 Git 改动。

## end 批量执行

日常入口仍是 `$jj-end` / `/jj-end`。技能优先运行随安装分发的 `scripts/end_ops.mjs`，不要求业务仓安装 jj-flow；包内对应入口为：

```text
jj end preview --work-branch feature/demo --paths-file ../task-paths.json --message-file ../commit-message.txt --output ../end-preview.json
jj end execute --plan-file ../end-preview.json
```

上述三个输入/预览文件放在仓库外；Agent 通常使用系统临时目录。路径文件是精确路径 JSON 数组（rename 同时包含旧、新路径），提交信息首行是中文 Conventional Commit。支持重复 `--path`、`--integration`、`--remote`、`--return-to work|integration` 和 `--cwd`；干净工作区可省略路径和提交信息。`--convention-file` 接收 `{branch, source_path, excerpt}`，只接受源文件中明确写出的收尾分支约定，并校验其内容是否变化。

preview 不 fetch、不写 Git 索引；显式 `--output` 只允许写仓库外。execute 在已有提交/推送/合并授权下执行，保留正常 hooks，并校验预览、分支、文件、远程身份。它按 fetch → commit → sync/push work → sync/merge/push integration → return 执行，遇错停止后续步骤。未选的脏文件和脏子模块明确阻止批量执行；不自动 stash、reset、force push、删分支或改配置。

冲突输出双方 commit/blob 和文件路径，回滚本次未完成合并，交给宿主按双方意图解冲突、验证并提交，再生成新预览继续。推送失败返回实际完成步骤，第二次运行跳过已合入的部分。返回值包含每步耗时和两个分支的推送状态；只有两个分支均完成才报告收工。合并树校验要求 Git 2.38 以上。

---

## dispatch-tick

```bash
jj dispatch-tick --delivery DELIVERY_ID \
  [--manifest path | --control-root dir] \
  [--receipt receipt.json] \
  [--write] [--json]
```

- 默认**预览**；`--write` 才 CAS 写 plane  
- 单次 tick，无后台 daemon  
- `--delivery` 是控制面 `delivery_id`，不是对话命令名  

日常调度请 `$jj-dispatch` / `/jj-dispatch`，不要让用户以 tick 为主路径。

---

## task

```bash
jj task scaffold --delivery DELIVERY_ID [--manifest path | --control-root dir] [--json]
jj task assign --delivery DELIVERY_ID --task TASK-ID [--manifest path | --control-root dir] [--json]
```

轻量分配展示；审计细节在 JSON / manifest。设计见 [任务分配 UX](../design-docs/task-assignment-ux.md)。

---

## scenario / trace / host-trial / harness-gc

```bash
jj scenario list|check|run <scenario|all> [--json]
jj trace explain|replay <trace.json> [--json]
jj host-trial run [--json]
jj grok-trial run [--json] [--session-id ID] [--write-report] [--report-path path]
jj harness-gc [--json]
```

| 命令 | 边界 |
|------|------|
| scenario | 固定 fixture、纯状态、不创建真 task、不执行 host action |
| trace replay | 只重放纯状态转换 |
| host-trial | 系统临时目录半真实 Git/worktree；**不能**关闭真 Host 里程碑 |
| grok-trial | 绑定真实 `GROK_SESSION_ID`；`--write-report` 才写 `real-host-trial-grok.json`；**不**升 A2、**不**进 `verify` |
| harness-gc | 只读 findings，不自动修 |

---

## 本仓库维护（开发 jj-flow 时）

```bash
npm run verify
npm run lab:check
npm run docs:dev
npm run docs:build
npm run docs:preview
npm run docs:check
npm run harness:check
npm run harness:gc
npm run scenario:check
npm run host:trial
npm run ralph:check
npm run ralph:sync
```

npm 发布走 GitHub Actions `NPM Publish`，勿依赖本机 `npm publish` token。

---

## 相关

用户路径：[安装](../installation.md) · [命令总览](../commands.md) · [五分钟上手](../usage.md)
维护：[维护说明](../maintenance.md)
