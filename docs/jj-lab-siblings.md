# 实验场 Sibling 仓库规范

`jj-flow` 产品仓库内部**不包含** `labs/` 目录。用于端到端机械验证与回归演练的两个实验场仓库（Loop Gym 与 Family Gym）是与 `jj-flow` **同级（Sibling）存放的独立 Git 仓库**。

完整的实验场架构设计请参阅 [实验场 Loop Gym / Family Gym 设计文档](design-docs/jj-flow-labs.md)。本页说明仓库命名、路径发现规则与日常维护步骤。

## 一、固定仓库名称与克隆地址

实验场所在的父目录因机器而异，但**两个实验场仓库的文件夹名称必须保持固定**：

| 实验场名称 | 固定目录名 | 本地路径示例（Windows） | 公开 GitHub 仓库地址 |
| :--- | :--- | :--- | :--- |
| **Lab 1 · Loop Gym**（单仓闭环演练场） | `jj-lab-loop` | `D:\daji-docs\jj-lab-loop` | `https://github.com/beerui/jj-lab-loop` |
| **Lab 2 · Family Gym**（多仓同源迁移演练场） | `jj-lab-family` | `D:\daji-docs\jj-lab-family` | `https://github.com/beerui/jj-lab-family` |

在本地准备实验场时，请在与 `jj-flow` 同级的父目录下克隆并初始化种子工作区：

```bash
git clone https://github.com/beerui/jj-lab-loop.git
git clone https://github.com/beerui/jj-lab-family.git

# 克隆后分别进入两个仓库生成本地物化工作区（_materialized/ 不进 Git）
cd jj-lab-loop && node scripts/lab.mjs seed
cd ../jj-lab-family && node scripts/lab.mjs seed
```

::: danger 四条硬性隔离红线
1. **禁止在 `jj-flow` 产品仓内创建 `labs/` 目录**。
2. **禁止在运行脚本中通过 `../jj-lab-loop` 相对路径盲猜目录**（必须走显式路径发现规则）。
3. **禁止将实验场内部的测试仓库角色命名为 `项目A / 项目B / 项目C` 或 `project-a`**（实验场使用 `loop-gym`、`notes-alpha`、`notes-beta`）。
4. **禁止把本地 `lab-roots.json` 或实验场代码打包进 NPM 发布物**（受 `HNS-PUBLISH-LABS` 门禁检查）。
:::

## 二、实验场根路径发现规则（Fail-Closed）

当你运行 `npm run lab:check`（已包含在 `npm run verify` 中）时，测试执行器会按以下优先级查找两个实验场的**已存在绝对路径**（若未配置或目录不存在，立即报错退出，绝不静默跳过）：

1. **环境变量优先**：读取 `JJ_LAB_LOOP_ROOT` 与 `JJ_LAB_FAMILY_ROOT`（必须是已存在的绝对路径）。
2. **自定义配置文件路径**：读取环境变量 `JJ_LAB_ROOTS_FILE` 指向的 JSON 文件。
3. **仓库本地配置文件**：读取 `jj-flow` 根目录下的 `lab-roots.json`（你可以复制仓库内的 `lab-roots.json.example` 为 `lab-roots.json` 并填入本机绝对路径；该文件已在 `.gitignore` 中被忽略）。

### 本地环境变量配置示例

**macOS / Linux (POSIX)：**

```bash
export JJ_LAB_LOOP_ROOT="/Users/dev/work/jj-lab-loop"
export JJ_LAB_FAMILY_ROOT="/Users/dev/work/jj-lab-family"
# 或者直接指定配置文件：
export JJ_LAB_ROOTS_FILE="$PWD/lab-roots.json"
```

**Windows PowerShell (pwsh)：**

```powershell
$env:JJ_LAB_LOOP_ROOT = "D:\daji-docs\jj-lab-loop"
$env:JJ_LAB_FAMILY_ROOT = "D:\daji-docs\jj-lab-family"
# 或者直接指定配置文件：
$env:JJ_LAB_ROOTS_FILE = Join-Path (Get-Location) "lab-roots.json"
```

::: info CI 环境是如何注入实验场路径的？
在 GitHub Actions（Ubuntu `verify` 与 Windows `lab:check`）中，工作流会在执行测试前调用 `.github/actions/prepare-lab-roots/action.yml`，将两个实验场仓库克隆到非 `$HOME` 下的临时绝对路径（如 `/tmp/jj-flow-labs`），自动执行 `seed` 并注入 `JJ_LAB_LOOP_ROOT`、`JJ_LAB_FAMILY_ROOT` 与 `JJ_FLOW_ROOT`。
:::

## 三、如何升级 CI 中的实验场版本锁（Gym Pin）

CI 不会直接拉取实验场仓库的浮动 `main` 分支，而是锁定在 `.github/actions/prepare-lab-roots/action.yml` 中的 `loop_ref` 与 `family_ref` 两个 commit SHA 上。

当你修改了 `ralph` 的目录布局、`run_id` 格式或门禁契约时，实验场里的机械断言（Oracle）也需要同步更新。升级步骤如下：

1. **先更新实验场仓库**：将适配新契约的改动提交并合入 `jj-lab-loop` 或 `jj-lab-family` 的 `main` 分支。
2. **本地联调验证**：将本地两个实验场检出到目标 commit SHA，重新执行 `seed`，然后在 `jj-flow` 仓库运行 `npm run lab:check` 确认全部通过。
3. **更新 `action.yml` 版本锁**：将 `.github/actions/prepare-lab-roots/action.yml` 中 `loop_ref` / `family_ref` 的 `default:` 值更新为新的 commit SHA，并运行一遍 `npm run verify`。
4. **记录更新日志**：在 `CHANGELOG.md` 的 `## Unreleased` 中记录本次实验场版本锁升级。

*(注：关于旧版本锁 `ed72b08` 的过渡兼容层保留在 `scripts/lab-overlays/jj-lab-loop/` 下，当前版本锁 `75461e1` / `652d1f5` 已原生支持新版契约，overlay 自动为 no-op。)*

## 四、实验场内部结构与工作目录边界

每个实验场仓库包含顶层说明文档、`.gitignore`（必须忽略 `_materialized/`）、`lab-manifest.json`、`seed/`、`scripts/lab.mjs`、`scripts/oracles/` 与 `scenarios/`。

在实验场执行测试或演练时，必须在物化后的目标目录（`_materialized/`）下运行，严禁在种子根目录或 `jj-flow` 产品仓库根目录直接写入业务测试提交：

| 演练动作 | 正确的当前工作目录（`cwd`） |
| :--- | :--- |
| **Loop Gym 单仓闭环** | `$JJ_LAB_LOOP_ROOT/_materialized/loop-gym` |
| **Family Gym 源仓开发与交接** | `$JJ_LAB_FAMILY_ROOT/_materialized/family-gym/notes-alpha` |
| **Family Gym 目标仓同源迁移** | `$JJ_LAB_FAMILY_ROOT/_materialized/family-gym/notes-beta` |
| **严禁作为业务写入 `cwd` 的目录** | `jj-flow` 产品仓根、`jj-lab-*` 种子仓根、`family-gym/` 外层包装目录、`control/` |

## 相关阅读

* [实验场 Loop Gym / Family Gym 设计文档](design-docs/jj-flow-labs.md)
* [仓库与文档维护指南](maintenance.md)
