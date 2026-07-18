# 命令总览

30 秒选对入口。细节在各命令页。`jj-flow` = **项目族编排**（same + dispatch）。禁止 `maestro explore`。

## 主入口（优先）

| 入口 | 何时用 | 平台 |
|------|--------|------|
| [$jj-same](command-jj-same.html) | 同源迁移、handoff、持续同步 | Codex `$` / Claude `/` |
| [$jj-dispatch](command-jj-dispatch.html) | 控制项目上多项目预览、批准、绑定、恢复 | **仅 Codex** |

**不确定就用 same。** 兼容路由见 [$jj](command-jj.html)。

## 维护与自动化

- [CLI](command-cli.html)：`install-skill`、`doctor`、`scenario`、`host-trial`、`harness-gc`、`dispatch-tick`
- 维护本仓：`npm run verify`（无 `$jj-validate` / `$jj-evolve` 对话入口）

## 已移除（非活入口）

勿再安装或当作主 CTA：`$jj-delivery`、`$jj-validate`、`$jj-evolve`，以及更早的 feat/fix/knowhow/auto/review。

控制面 **`delivery_id`** = 调度任务身份，不是对话命令。

## 通用输入模板

所有对话命令都接受自然语言，不要求先整理成固定参数。完整输入通常包含：

```text
$jj-<命令>
目标：要完成什么。
资料：会话、PRD、YApi、设计图、日志、diff、handoff 或文件路径。
范围：本次做什么，不做什么。
关键决策：已经由用户拍板的取舍。
验收：什么结果算完成。
```

例如：

```text
$jj-same
会话=019f...
当前需求=保留密码入口
源=承接前台
目标=兑接前台,承载前台
```

## 平台差异

Codex 使用 `$jj-*`，Claude Code 使用 `/jj-*`。例如：

```text
$jj-same 会话=019f... 源=承接前台 目标=兑接前台 开始迁移
/jj-same 会话=019f... 源=承接前台 目标=兑接前台 开始迁移
```

`$jj-dispatch` 依赖 Codex App 的 task、thread 和 worktree 能力，当前没有对应的 `/jj-dispatch`。

## 状态怎么理解

- `PASS`：证据满足当前门禁。
- `PENDING`：信息或验证还不完整，不能当成已经通过。
- `FAIL`：已有证据证明当前结果不满足要求。
- `BLOCKED`：缺少关键权限、环境、来源或决策，继续执行会扩大风险。
- `REUSE`：现有资料或目标实现仍然新鲜，可以直接复用。
- `REFRESH_SOURCES`：来源已变化，需要刷新后再继续。
- `REBASELINE`：现有基线无法可靠对账，需要重新建立。

同源迁移的 Handoff 标准步骤和 `REUSE / REFRESH_SOURCES / REBASELINE / BLOCKED` 判断见 [$jj-same](command-jj-same.html)。

## 安装命令

安装 Codex skills 或 Claude commands 使用 `install-skill`，完整参数和冲突处理见 [安装](installation.html)：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --platform all --dry-run --json
```

## 下一步

第一次使用建议先读 [使用说明](usage.html)，然后从 [$jj-same](command-jj-same.html) 开始。
