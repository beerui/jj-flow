# 实验场 sibling 仓

> 产品仓 **没有** `labs/` 树。Loop gym 与 Family gym 是与 `jj-flow` **同级** 的独立 git 仓。  
> 设计 SSOT：[实验场 Loop gym / Family gym](design-docs/jj-flow-labs.html)。本页只钉死仓名、发现根、env。

## 仓名（钉死）

父目录随机器；**目录名不要改**。

| Lab | 仓目录名 | 示例（Windows） |
| --- | --- | --- |
| Lab 1 · Loop gym | `jj-lab-loop` | `D:\daji-docs\jj-lab-loop` |
| Lab 2 · Family gym | `jj-lab-family` | `D:\daji-docs\jj-lab-family` |

POSIX 同级：`$PARENT/jj-flow`、`$PARENT/jj-lab-loop`、`$PARENT/jj-lab-family`。

GitHub remotes（公开，与 `jj-flow` 同账号）：

| Lab | clone |
| --- | --- |
| Loop gym | https://github.com/beerui/jj-lab-loop |
| Family gym | https://github.com/beerui/jj-lab-family |

```bash
git clone https://github.com/beerui/jj-lab-loop.git
git clone https://github.com/beerui/jj-lab-family.git
```

clone 后目录名保持 `jj-lab-loop` / `jj-lab-family`。`_materialized/` 不进 git，本地要跑机械套件需再 `node scripts/lab.mjs seed`。

**禁止：**

- 在产品仓建 `jj-flow/labs/`
- 从产品 `git rev-parse --show-toplevel` 拼接 `../jj-lab-loop` 当发现逻辑（runner 不得猜路径）
- 把 lab 角色命名为 项目A / 项目B / 项目C / `handoff` / `project-a`
- 把 `lab-roots.json` 或 gym 源码打进 npm 包

## 发现根（fail-closed）

解析顺序：已存在的**绝对目录**才算命中。缺根 → exit ≠ 0。不 mkdir `~/.jj-flow`，不发明 sibling 路径。

1. `JJ_LAB_LOOP_ROOT` / `JJ_LAB_FAMILY_ROOT`（必须已是绝对路径）
2. `JJ_LAB_ROOTS_FILE` 指向的 JSON
3. 产品仓内已存在的 `lab-roots.json`（缺失时**不要**创建）

形状见仓库根 `lab-roots.json.example`。复制为 `lab-roots.json` 后改成你机器上的绝对路径；该文件已被 `.gitignore`。

**POSIX：**

```bash
export JJ_LAB_LOOP_ROOT="/d/daji-docs/jj-lab-loop"
export JJ_LAB_FAMILY_ROOT="/d/daji-docs/jj-lab-family"
# 或
export JJ_LAB_ROOTS_FILE="$PWD/lab-roots.json"
```

**pwsh：**

```powershell
$env:JJ_LAB_LOOP_ROOT = "D:\daji-docs\jj-lab-loop"
$env:JJ_LAB_FAMILY_ROOT = "D:\daji-docs\jj-lab-family"
# 或
$env:JJ_LAB_ROOTS_FILE = Join-Path (Get-Location) "lab-roots.json"
```

产品 `npm run lab:check` 委派各 lab `scripts/lab.mjs`，并已接入 `npm run verify`。缺根、缺 pin、缺 runner → exit ≠ 0。未设根时不得假装 PASS。

CI（ubuntu `verify` 与 windows-latest `lab:check`）在跑套件前用 `.github/actions/prepare-lab-roots` clone `beerui/jj-lab-loop` / `beerui/jj-lab-family` 到不落在 `$HOME` 下的绝对路径，seed，再注入 `JJ_LAB_*_ROOT` + `JJ_FLOW_ROOT`。默认 `$RUNNER_TEMP`；GitHub-hosted Ubuntu 上 `$RUNNER_TEMP` 位于 `/home/runner/work/_temp`，gym `env-print` 会判 `control_root under homedir`，因此改用 `/tmp/jj-flow-labs`。本地跑 `verify` 同样必须先设绝对根（或已存在的 `lab-roots.json`）。不要从产品 toplevel 猜 `../jj-lab-*`。

### gym pin 维护

CI 不跟 gym 的 `main`，而是钉在 `.github/actions/prepare-lab-roots/action.yml` 的 `loop_ref` / `family_ref` 两个 SHA 上。gym 的机械 oracle 直接读写 ralph 产物（`tasks/<task-*>/task_plan.md`、`.state/run.json` 等），所以 **ralph 布局、`run_id` 形态或 gate 契约一变，就要同步升 pin**；否则 CI 只在 `verify` 最后一步 `lab:check` 报 `LAB-ORACLE-FAIL`，且症状在 gym 侧（例如 `acceptance.md` ENOENT、`legacy RALPH run layout for RALPH-*`），不是产品缺陷。

升 pin 步骤：

1. 先把修复合进 gym 仓 `main`（gym 是独立仓，产品仓的 token 未必能推）。
2. 把两个 gym checkout 到目标 SHA，seed 后在产品仓跑 `npm run lab:check`，确认 PASS。
3. 改 `action.yml` 两个 `default:`，再跑一遍 `npm run verify`。
4. 在 CHANGELOG 记一句「gym pin → `<loop sha>` / `<family sha>`」。

注意区分：`action.yml` 里的 pin 是 **gym 仓的 commit**；gym 自己 `lab-manifest.json` 的 `jj_flow_commit` 是 gym **声明兼容的产品 commit**。CI 红的原因是前者过旧。

## 各仓里有什么

每个 lab 仓含：

- `README.md`
- `.gitignore`（必须含 `_materialized/`）
- `lab-manifest.json`（`id` + 非空 `harness_version` 和/或 `jj_flow_commit`；pin `0.1.3` / PR2 commit）
- `seed/`、`scripts/lab.mjs`、`scripts/oracles/`、`scenarios/`

`git check-ignore -v _materialized/loop-gym/.git`（loop）与 `_materialized/family-gym/notes-alpha/.git`（family）必须命中 ignore。物化 git 只存在于本地 `_materialized/`，不进 lab 仓历史。

## 调用 cwd

| 动作 | cwd |
| --- | --- |
| Loop gym ralph | `$JJ_LAB_LOOP_ROOT/_materialized/loop-gym` |
| Family ralph / handoff | `$JJ_LAB_FAMILY_ROOT/_materialized/family-gym/notes-alpha` |
| Family same | `…/notes-beta` |
| 禁止 | 产品仓根、`jj-lab-loop` / `jj-lab-family` **种子**仓根、`family-gym/` 包装目录、`control/` |

业务 git 写走进产品 `jj-flow` 历史 = STOP。详见设计 §1.1。

## 发布隔离

`package.json` `files` 与 `npm pack --dry-run` 不得出现 `labs/`。Harness 规则 `HNS-PUBLISH-LABS`。产品 `.gitignore` **不要**写 `labs/_materialized/`。
