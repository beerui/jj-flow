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
- 本地改过或历史未登记：默认拒绝，审查后 `--force`  
- 用户装入口仍可在 [安装](installation.html) 用一行 `npx … install-skill`；装好后请走对话，不必再学 CLI  
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

对话入口仍是 `$jj-ralph` / `/jj-ralph`。下列命令供 skill 脚本 / 维护脚本调用。

```bash
jj ralph init --run-id RALPH-… --title "…" --goal "…" \
  [--intensity tiny|standard|strict] [--lite|--full] [--max-iterations N] \
  [--capability CAP-…] [--project KEY] [--knowledge-query Q] [--no-knowledge-refs] \
  [--host-id …] [--thread-id …] [--model-id …] [--session-export path] [--force] [--json]

jj ralph status [--run-id RALPH-…] [--json]
jj ralph archive --run-id RALPH-… [--slug name] [--json]
jj ralph finalize --run-id RALPH-… [--modules p1,p2] [--keywords a,b] [--lessons "l1|l2"] [--slug name] [--force] [--json]
jj ralph map-merge --run-id RALPH-… [--modules …] [--keywords …] [--lessons …] [--force] [--json]
jj ralph map-find --query "关键词" [--limit N] [--json]
jj ralph handoff --run-id RALPH-… [--handoff-id HOF-…] [--target name] [--json]
jj ralph dispatch-snapshot --run-id RALPH-… [--target name] [--json]
jj ralph gate --run-id RALPH-… --gate analyze|plan|deliver|accept|archive|brief|close --status PASS|FAIL|… [--no-advance] [--json]
jj ralph scope --run-id RALPH-… [--in path]… [--out path]… [--json]
jj ralph deliver-attempt --run-id RALPH-… [--improved true|false|auto] [--signal text] [--json]
jj ralph accept-layer --run-id RALPH-… --layer mechanical|judgment \
  --status PASS|FAIL|PENDING|SKIPPED [--mode none|review|recheck|adversarial_note] [--note text] [--json]
jj ralph rollback-phase --run-id RALPH-… --to PLAN|DELIVER|ANALYZE --reason "…" [--json]
jj ralph set-status --run-id RALPH-… --status PAUSED|BLOCKED|IN_PROGRESS --reason "…" [--json]
jj ralph commit-prep --run-id RALPH-… [--json]
jj ralph review-record --run-id RALPH-… --outcome PASS|NEEDS_CHANGES|BLOCKED [审查溯源选项…] [--json]
jj ralph host-record --run-id RALPH-… [--host-id …] [--thread-id …] [--session-handle …] [--model-id …] [--export-path …] [--json]
```

说明：

- `intensity`：`tiny` / `standard`（默认）/ `strict` — 预算与 accept 判断层；对话入口见 [ralph 命令](command-jj-ralph.html)  
- `gate_set`：默认 `full`（五 gate）；`--lite` 走 `brief`→`deliver`→`close`（别名仍写 analyze/plan/accept/archive 五键，`close` 照走 accept/archive 证据门），`budget.max_deliver_loops ≤ 3`；任一 gate FAIL/BLOCKED 或 `scope --in` 新增路径 → 自动升 full，同目录不换 run_id。与 `intensity` 正交（tiny ≠ lite）  
- `deliver-attempt`：DELIVER 循环记是否改进；可省略 `--improved`（按工作区指纹自动判定）；连续无改进 → `BLOCKED` + `STAGNATION`  
- `accept-layer`：双层验收；**strict** 下 judgment 须 PASS 才能 `gate accept PASS`  
- `archive` / `finalize` 默认要求 accept=PASS（`--force` 可覆盖）  
- `finalize` = map-merge + archive  
- `handoff` 写到 `.workflow/handoffs/`（迁移实现不在 ralph 目录内）  
- `commit-prep` 只出清单与 message，**不** git commit/push  
- 业务仓也可由 skill 内 `ralph_ops.mjs` 调用同源逻辑（权威实现 `src/ralph.mjs`）

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

轻量分配展示；审计细节在 JSON / manifest。设计见 [任务分配 UX](design-docs/task-assignment-ux.html)。

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
npm run docs:build
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

用户路径：[安装](installation.html) · [命令总览](commands.html) · [五分钟上手](usage.html)  
维护：[维护说明](maintenance.html)
