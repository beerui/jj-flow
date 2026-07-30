# 命令总览

30 秒选对入口。细节在各命令页。`jj-flow` = **项目族编排**（same + ralph + dispatch）。

## 主入口（优先）

| 入口 | 何时用 | 平台 |
|------|--------|------|
| [$jj-same](command-jj-same.html) | 同源迁移、handoff、持续同步 | Codex `$` · Claude `/` · Grok `/` · Qoder `/` |
| [$jj-ralph](command-jj-ralph.html) | 单仓全流程：分析 → 计划 → 验收 → 归档 + 能力地图 | Codex `$` · Claude `/` · Grok `/` · Qoder `/` |
| [$jj-review](command-jj-review.html) | 宿主 review 映射为 ralph `REV-*` | Codex `$` · Claude `/` · Grok `/` · Qoder `/` |
| [$jj-dispatch](command-jj-dispatch.html) | 业务仓发起多项目调度；状态：`D:/a/dispatch-control` 或工作区 `.jj-flow/` | Codex `$` · Grok `/` · Qoder `/`（**无** Claude 薄命令） |
| `$jj-end` / `/jj-end` | 收工：同步、提交、合入 integration | Codex · Claude · Grok · Qoder（skill，无独立文档页） |
| [$jj](command-jj.html) | 不确定时的兼容路由 | Codex `$` · Claude `/` · Grok `/` · Qoder `/` |

**不确定：** 多仓迁移用 same；单仓闭环用 ralph；多仓调度用 dispatch。兼容路由见 [$jj](command-jj.html)。

控制面 **`delivery_id`** 是调度任务身份（manifest 字段），不是对话命令名。

## 维护与自动化

- [CLI](command-cli.html)：`install-skill`、`uninstall-skill`、`doctor`、`scenario`、`host-trial`、`harness-gc`、`dispatch-tick`、`ralph *`
- 维护本仓：`npm run verify`

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

```text
$jj-ralph
目标=登录后密码过期提醒
范围=仅登录成功路径
验收=提示出现且可跳转改密
```

## 平台差异

| 宿主 | 调用形态 | 备注 |
|------|----------|------|
| Codex | `$jj-*` | dispatch 宿主 `host_id=codex-app`，`handle_kind=thread` |
| Claude Code | `/jj-*` | 仅薄命令：same / ralph / review / end / 兼容 `jj`；**无** `/jj-dispatch` |
| Grok Build | `/jj-*`（skill `user-invocable`） | 含 `/jj-dispatch`；宿主 `host_id=grok-build`，`handle_kind=session` |
| Qoder | `/jj-*` | 与 Grok 同源 skill 安装，含 dispatch |

```text
$jj-same 会话=019f... 源=承接前台 目标=兑接前台 开始迁移
/jj-same 会话=019f... 源=承接前台 目标=兑接前台 开始迁移
$jj-dispatch PREVIEW delivery=DEL-…
/jj-dispatch PREVIEW delivery=DEL-…
```

**`jj-dispatch` 与 Grok：** skill 与 host 契约（Phase 1）已支持 Grok；PREVIEW / 计划 / CAS tick 不绑死 Codex。  
完整 DISPATCH 绑定仍要求 **可验证 sandbox attestation + 独占 worktree**（Grok 走 session 句柄，见 [Grok Host Adapter](design-docs/grok-host-adapter.html)）。真实 Host 闭环验收仍为 PENDING，不得用半真实 `host:trial` 冒充。

## 状态怎么理解

- `PASS`：证据满足当前门禁。
- `PENDING`：信息或验证还不完整，不能当成已经通过。
- `FAIL`：已有证据证明当前结果不满足要求。
- `BLOCKED`：缺少关键权限、环境、来源或决策，继续执行会扩大风险。
- `REUSE`：现有资料或目标实现仍然新鲜，可以直接复用。
- `REFRESH_SOURCES`：来源已变化，需要刷新后再继续。
- `REBASELINE`：现有基线无法可靠对账，需要重新建立。

同源迁移的 Handoff 标准步骤和 `REUSE / REFRESH_SOURCES / REBASELINE / BLOCKED` 判断见 [$jj-same](command-jj-same.html)。

## 安装与卸载命令

安装使用 `install-skill`（Codex / Claude / Grok / Qoder），完整参数见 [安装](installation.html)：

```bash
npx @shendu-sdt/jj-flow@beta install-skill --platform all --dry-run --json
```

卸载同样支持平台、项目目标、dry-run 和 JSON。先预览，确认旧版未登记资产后再决定是否 `--force`：

```bash
npx @shendu-sdt/jj-flow@beta uninstall-skill --platform all --dry-run --json
```

## 下一步

第一次使用建议先读 [使用说明](usage.html)，然后从 [$jj-same](command-jj-same.html) 开始。
