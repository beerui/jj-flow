# 项目规划

## 原始问题

我们不是缺一个更复杂的 AI 工具，而是缺一套能在真实项目里交付的入口：同一套做法可以让不同模型、不同工具、不同项目尽量产出稳定结果。

所以 `jj-flow` 的核心是 **项目族编排工作流**：把同源迁移、单仓闭环、持续同步与多项目调度做成可恢复、有证据门禁的协议。`jj` 只是命令标识，不代表组织或业务品牌。

## v0.1 必须做

- 独立项目，不放在文档站里。
- 提供 Codex 内 `$jj-same` 与 Claude Code 内 `/jj-same` 作为同源迁移/持续同步入口。
- 提供 Codex 内 `$jj-dispatch` 作为项目族控制平面调度入口。
- 文档站必须包含安装方式、命令参数、使用方案和维护说明，而不只是入口菜单。
- 输出 调用链、prompt、evidence checklist、guard 状态。
- 用测试保证路由和 guard 不会把缺证据的内容误写成 PASS。
- 建好 GitHub CI、GitHub Pages、Release Please、Dependabot、Changelog 基础设施。
- 已收敛：移除 `jj-delivery` / `jj-validate` / `jj-evolve`；维护本仓使用 `npm run verify`。

## 暂时不做

- 不重写外部执行引擎。
- 不把所有工具重新实现一遍。
- 不直接自动改用户项目代码。
- 不把 `/jj-*` 或 `$jj-*` 做成重型编排引擎。

## 后续阶段

### v0.2 安装与集成

- 稳定 GitHub Pages 文档站的信息架构，让使用、架构、规划、维护、部署都能被长期引用。
- 增强 `install-skill`，支持 `.codex/skills`、`.claude/commands`、更多安装来源、版本检查和错误诊断。
- 增加 npm 发布配置。
- 增强宿主能力诊断（Git / Codex / Claude），不绑定特定外部编排 CLI。

### v0.3 真实证据采集

- 接入 `@shendu-sdt/yapi-tool`，生成 `yapi_contract` evidence。
- 接入 `@shendu-sdt/arms-inspector`，生成 `arms_sls` evidence。
- 接入禅道 CLI，生成 `zentao_task` / `worklog` evidence。

### v1.0 项目级闭环

- `/jj-*` 和 `$jj-*` 根据 intent 选择 same / ralph / dispatch 链路并推进。
- 每次真实交付都能沉淀成 knowhow、spec 或 workflow recipe。
- 支持团队协作：一个人发起，多个模型/智能体按证据和 guard 分工推进。
- 提供 Codex `$jj-dispatch` 控制项目 MVP：动态区分 origin、requirement owner、lead、reference 和 targets，支持只读预览、显式批准、幂等派发和中断恢复。
- 控制项目只保存协调状态和 artifact 引用，不在 `jj-flow` 内实现 daemon、数据库、自动 merge/push/release 或完整多智能体执行引擎。

## 里程碑状态（协议层）

| 里程碑 | 状态 | 说明 |
|--------|------|------|
| M5 项目族控制平面与审查闭环 | completed | P9/P10 |
| M6 主调度运行时与目标差异决策 | **completed** | P11/P12；验收见 [m6-acceptance.md](milestones/m6-acceptance.html) |
| M7 控制项目试跑与 host 闭环 | **completed（semi-real）** | P13：真实临时 Git/worktree；PREVIEW→tick→BIND→receipt→resume→rework，验收见 [m7-acceptance.md](milestones/m7-acceptance.html) |
| H5 Harness 持续熵清理 | **completed** | 只读质量评分、P0/P1 阻断、版本化 baseline；验收见 [h5-acceptance.md](milestones/h5-acceptance.html) |

## 与外部工具的关系

- **jj-flow**：定义项目族怎么拆任务、怎么 handoff、怎么调度与验收。
- **Codex / Claude Code**：对话与执行宿主。
- **控制面事实**：manifest、Git、VRF/REV、sandbox attestation，优先于聊天「完成」。
