# 项目规划

## 原始问题

我们不是缺一个更复杂的 AI 工具，而是缺一套能在真实项目里交付的入口：同一套做法可以让不同模型、不同工具、不同项目尽量产出稳定结果。

所以 `jj-flow` 的核心不是替代 Maestro，而是作为 Maestro 上层的交付编排协议，把项目边界、证据习惯、验收方式放在 Maestro 前面。`jj` 只是一个简单标识，不代表组织或业务品牌。

## v0.1 必须做

- 独立项目，不放在文档站里。
- 提供 Codex 内 `$jj-delivery`，以及 Claude Code 内 `/jj-delivery`，其中 delivery 是少参数端到端交付入口，并覆盖明确功能、线上最小修复、交付前审查与不确定意图。
- 提供 `$jj-validate` 作为项目管理者自检入口，检查状态漂移并给出下一步升级建议。
- 提供 `$jj-evolve` 作为项目自身迭代入口，把自检结果转换成 correction backlog、升级计划和 Maestro 调用链。
- 文档站必须包含安装方式、命令参数、使用方案和维护说明，而不只是入口菜单。
- 输出 Maestro 调用链、prompt、evidence checklist、guard 状态。
- 把 `$yapi`、`$arms-fix`、`$sd-zentao-cli` 放进真实流程位置。
- 用测试保证路由和 guard 不会把缺证据的内容误写成 PASS。
- 建好 GitHub CI、GitHub Pages、Release Please、Dependabot、Changelog 基础设施。

## 暂时不做

- 不 fork Maestro 核心。
- 不把所有工具重新实现一遍。
- 不直接自动改用户项目代码。
- 不把 `/jj-*` 或 `$jj-*` 做成重型编排引擎。

## 后续阶段

### v0.2 安装与集成

- 稳定 GitHub Pages 文档站的信息架构，让使用、架构、规划、维护、部署都能被长期引用。
- 增强 `install-skill`，支持 `.codex/skills`、`.claude/commands`、更多安装来源、版本检查和错误诊断。
- 增加 npm 发布配置。
- 增加真实 `maestro` CLI 检测和版本兼容检查。

### v0.3 真实证据采集

- 接入 `@shendu-sdt/yapi-tool`，生成 `yapi_contract` evidence。
- 接入 `@shendu-sdt/arms-inspector`，生成 `arms_sls` evidence。
- 接入禅道 CLI，生成 `zentao_task` / `worklog` evidence。

### v1.0 项目级闭环

- `/jj-*` 和 `$jj-*` 根据 intent 选择 Maestro 链路并可选执行。
- 每次真实交付都能沉淀成 knowhow、spec 或 workflow recipe。
- 支持团队协作：一个人发起，多个模型/智能体按证据和 guard 分工推进。
- 提供 Codex `$jj-dispatch` 控制项目 MVP：动态区分 origin、requirement owner、lead、reference 和 targets，支持只读预览、显式批准、幂等派发和中断恢复。
- 控制项目只保存协调状态和 artifact 引用，不在 `jj-flow` 内实现 daemon、数据库、自动 merge/push/release 或完整多智能体执行引擎。

## 与 Maestro 的关系

Maestro 是通用编排器，`jj-flow` 是项目交付协议的 adapter。这样 Maestro 升级时，优先维护 `jj-flow` 的 prompt、recipe 和 evidence schema，而不是反复改 Maestro core。
