# 文档站迁移 VitePress 与使用文档改版

> 状态：Proposed
>
> 日期：2026-09-03
>
> 关联执行计划：[文档站 VitePress 迁移与文案改版](../exec-plans/active/2026-09-03-docs-site-vitepress.html)
>
> 边界：只动文档站（`docs/**`、站点配置、构建/校验脚本、harness 中与站点构建绑定的规则）和用户可见文案；不改 `skills/`（行为真源）、不改 `src/` 业务逻辑；文案改写不得引入 skill 里没有的行为。

## 1. 背景与问题

### 1.1 站点技术

文档站由 `scripts/build-docs.mjs`（约 1200 行）生成：自带一个只认标题 / 列表 / 表格 / 代码块 / 引用的 Markdown 解析器，自制搜索索引与 SPA 内容切换。带来的编辑摩擦：

- 新增一页必须同时登记到脚本里的 `SIDEBAR_GROUPS` / `DEEP_PAGES`，否则 `harness:gc` 报 `GC-DOC-ORPHAN-001`；
- 内链要写 **输出路径**（`command-jj-same.html`），源文件却在 `docs/commands/jj-same.md`，IDE / GitHub 里点不动；
- 没有本地热更新，改一行要重跑构建再开 `site/`；
- 不支持嵌套列表、图片、HTML 直出、代码高亮、提示容器。

### 1.2 使用文档

以 `docs/commands/jj-ralph.md` 为代表，新手读不下去的根因：

- **没有叙事**：从"怎么喊"直接跳到名词表，用户还没做过一次就先被灌"控制项目 / 能力地图 / CAP- / DEL- / 强度档 / 阶段回退 / 迁移残骸"；
- **同一批话术重复三遍**（怎么说 / 做完了还要改 / 一眼对照）；
- **缺一段完整的"第一次用会发生什么"**：说一句话之后 Agent 会做什么、仓库里会多出什么、怎么确认做完；
- dispatch / end 页把 Mode S/W/P、A3/A4、具体事故案例这类内部内容直接放进用户页。

## 2. 目标

1. **改 Markdown 即所见**：`npm run docs:dev` 热更新；内链写源文件相对路径；新增页面只需放文件（深层目录零登记，顶层加一行侧栏）。
2. **新手 5 分钟跑通第一次 ralph**：按"第一次使用"页从安装走到归档，不需要读第二页。
3. **事实不越界**：所有用户文案能在 `skills/*/SKILL.md` 找到依据（见 §6.5）。
4. **`npm run verify` 仍是唯一门禁**：构建失败即链接失败；侧栏覆盖不全即失败。

## 3. 已确认的决策

| 决策 | 选择 | 理由 |
| --- | --- | --- |
| 公开 URL | 采用 VitePress 原生路径（`commands/jj-same.html`），旧地址补跳转页 | 贴近源码结构；README / `package.json.homepage` 链的都是根级页面，路径不变 |
| 三个交互演示（ralph / dispatch / end） | 整套删除（页面、`docs/other/*-demo/` 片段与生成脚本） | 用户决定不再需要 |
| 侧栏 | 顶层 5 组手工维护；`design-docs` / `exec-plans` / `adr` 从目录自动生成 | 保留精心起的标题；深层零登记 |
| 依赖 | `vitepress ^1.6.4` 作为 **devDependency**（仓库第一个依赖） | 用户明确要 VitePress；不影响 npm 包消费者 |
| 首页 | `docs/index.md` 保持普通文档页，不做 hero 落地页 | 内容是表格和步骤，落地页不是本次目标 |

## 4. 站点架构

### 4.1 文件布局

```text
新增
  docs/.vitepress/config.mjs      VitePress 配置（.mjs，全仓无 TS）
  docs/.vitepress/sidebar.mjs     侧栏纯数据模块；不 import vitepress；校验脚本可 import
  docs/.vitepress/redirects.mjs   旧 URL → 新 URL 映射表
  docs/changelog.md               <!--@include: ../CHANGELOG.md-->（根 CHANGELOG 仍归 release-please）
  scripts/check-docs.mjs          docs:check：侧栏覆盖 + 临时目录构建 + 产物断言
删除
  scripts/build-docs.mjs
  docs/dispatch-demo.md  docs/ralph-demo.md  docs/end-demo.md
  docs/other/dispatch-demo/  docs/other/end-demo/  docs/other/ralph-demo/
  .gitignore 中 3 行 demo 媒体规则
不变
  site/ 仍是输出目录（outDir: '../site'）→ pages.yml、.gitignore 的 site/ 不动
```

`.gitignore` 加 `docs/.vitepress/cache/`。`package.json` `files` 含 `docs/`，配置文件会随 npm 包发布（几 KB，可接受）；`cache/` 因 `.gitignore` 也被 npm 忽略。

### 4.2 `config.mjs`

| 项 | 值 | 说明 |
| --- | --- | --- |
| `base` | `/jj-flow/` | GitHub Pages 项目站 |
| `lang` / `title` / `description` | `zh-CN` / `jj-flow` / `用对话做项目族编排工作流` | 沿用现有定位语 |
| `cleanUrls` | `false`（默认） | 保留 `.html`，与 README 链接一致 |
| `srcExclude` | 读 `harness-manifest.json` → `documentation_policy.excluded_paths`，去掉 `docs/` 前缀加 `/**` | 单一真源，不维护两份 |
| `outDir` | `../site` | 见 §4.1 |
| `sitemap.hostname` | `https://beerui.github.io/jj-flow/` | 替代手写 sitemap |
| `themeConfig.nav` | 安装 / 第一次使用 / 更新日志 | 对应现有 header-quick |
| `themeConfig.socialLinks` | GitHub | — |
| `themeConfig.sidebar` | `import { sidebar } from './sidebar.mjs'` | — |
| `themeConfig.editLink` | `https://github.com/beerui/jj-flow/edit/main/docs/:path` | 直接服务"方便修改" |
| `themeConfig.search` | `provider: 'local'` + 中文分词（§4.5） | — |
| `themeConfig.outline` | `[2, 3]`，label `本页目录` | — |
| 中文文案 | `docFooter` / `sidebarMenuLabel` / `returnToTopLabel` / `darkModeSwitchLabel` / search translations | — |
| `buildEnd` | 按 `redirects.mjs` 写跳转页 | §4.4 |
| 不启用 | `lastUpdated`（需要 `fetch-depth: 0`） | YAGNI |

### 4.3 `sidebar.mjs` 契约

```js
export const sidebar = [ /* VitePress SidebarItem[]，单一侧栏 */ ];
export function sidebarDocPaths() { /* 扁平化所有 link → ['docs/index.md', 'docs/commands/jj-ralph.md', …] */ }
```

- 顶层 5 组沿用现有分组与标题：开始 / 工作流 / 概念 / 维护者 / 参考；唯一改名是「五分钟上手」→「第一次使用」（随 §7.4 改版）。`jj-lab-siblings.md` 补进「维护者」（现在是唯一不在侧栏的顶层页）。
- 「参考」内 `设计文档` / `执行计划` / `ADR` 三项为 **`collapsed: true` 的子分组**，条目由 `fs.readdirSync` 生成：标题取文件首个 `# ` 行，`index.md` 排最前；`exec-plans` 先 `active/` 后 `completed/`，各按文件名倒序（日期倒序）；`adr` 按文件名升序。
- 选折叠子组而不是分区侧栏：进入设计文档后仍能看到全局导航；侧栏默认高度与现在一致。
- 模块只依赖 `node:fs` / `node:path` / `node:url`，供 `scripts/check-docs.mjs` 直接 `import`；作为脚本运行（`node docs/.vitepress/sidebar.mjs`）时打印 `sidebarDocPaths()` 的 JSON，供同步的 `harnessGc` `spawnSync` 读取。

### 4.4 旧地址跳转（`redirects.mjs` + `buildEnd`）

映射表（旧 → 新，均相对站点根）：

| 旧 | 新 |
| --- | --- |
| `command-jj.html`、`command-jj-init.html` … `command-jj-team-swarm.html`（11 个） | `commands/jj.html`、`commands/jj-*.html` |
| `command-cli.html` | `commands/cli.html` |
| `adr-0001-external-tool-boundary.html` | `adr/0001-external-tool-boundary.html` |
| `adr-0002-project-family-control-plane.html` | `adr/0002-project-family-control-plane.html` |
| `ralph-demo.html`、`milestones/ralph-demo.html` | `commands/jj-ralph.html` |
| `dispatch-demo.html`、`milestones/dispatch-demo.html` | `commands/jj-dispatch.html` |
| `end-demo.html`、`milestones/end-demo.html` | `commands/jj-end.html` |

其余页面源路径 = 输出路径（`installation.html`、`design-docs/x.html`、`milestones/*-acceptance.html`、`changelog.html` …），无需跳转。`buildEnd(siteConfig)` 在 `siteConfig.outDir` 写 `<meta http-equiv="refresh">` + canonical + 兜底链接的静态页；目标用相对路径计算，不依赖 `base`。

### 4.5 搜索

VitePress 本地搜索（minisearch）默认按空白/标点分词，中文整句成一个词、只能匹配句首。配置 `search.options.miniSearch.options.tokenize`：有 `Intl.Segmenter` 时按 `zh` 词粒度切分并过滤非词段，否则回退默认正则。函数须自包含（VitePress 会序列化到客户端）。Node 20 官方构建含 full-icu，构建期索引与浏览器查询用同一分词器。

### 4.6 更新日志

`docs/changelog.md` 只有一行 `<!--@include: ../CHANGELOG.md-->`。VitePress 的 include 相对当前文件解析，可越出 `srcDir`；被包含内容里的相对链接会按 `docs/changelog.md` 的位置解析，所以 CHANGELOG 里的链接一律写绝对 URL（现有唯一一条 `docs/design-docs/ralph-plans-workspace.md` 改为 GitHub blob 地址；规则写进维护说明）。侧栏「维护者 → 更新日志」指向它。

## 5. 内容迁移（技术）

### 5.1 链接改写

235 处 `.html` 内链一次性改为源文件相对 `.md` 路径。算法：把链接按 **当前页的旧输出位置** 解析成旧输出绝对路径 → 用旧 `PAGES` 表（output → source）找到源文件 → 相对当前源文件目录写出，保留 `#锚点`。

- `changelog.html` → `changelog.md`（新包装页）；`index.html` → `index.md`。
- 两处带锚点的链接（`#做完了还要改`）：VitePress slug 与旧 slug 对纯中文标题一致；改写 ralph 页时若标题变化则同步更新。
- 指向 demo 的 4 处引用随 demo 删除。
- `design-docs/grok-host-adapter.md` 里指向 `skills/…/*.md` 的链接改为 GitHub blob URL（站点里从来打不开）；`ralph-workspace-layout.md` 示例表格里两个虚构 `progress.md` 链接改成行内代码。
- `docs/design-docs/index.md` / `exec-plans/index.md` / `adr/index.md` 的索引链接同样改为 `.md`（harness 索引规则同步改，见 §6.2）。
- 改写用一次性脚本（放 `.tmp/`，不入库）；`vitepress build` 的 dead-link 检查兜底，构建即校验。

### 5.2 Markdown 兼容

正文里没有双花括号（会被 Vue 当插值；行内代码也不豁免，只有围栏代码块安全）、没有裸尖括号标签、全部以 H1 开头、没有 frontmatter；`docs/pitfalls.md` / `commands/cli.md` 中的 `---` 是分隔线而非 frontmatter（不在首行）。markdown-it 能力严格超过旧解析器，不需要逐页改语法。

## 6. Harness 与校验

### 6.1 `scripts/check-docs.mjs`（`npm run docs:check`）

1. `import('../docs/.vitepress/sidebar.mjs')` → `sidebarDocPaths()`；每条须对应存在的 `.md`；`docs/**/*.md` 减去 manifest `excluded_paths` 与 `.vitepress/` 后，每个文件都必须在侧栏中（否则列出缺失，exit 1）。
2. `spawnSync('vitepress build docs --outDir .tmp/docs-site-check-<pid>')`，非零即失败（dead link 在此暴露）。
3. 产物断言：`index.html`、`commands/jj-ralph.html`、`changelog.html`（含 `Changelog`）、`sitemap.xml`、每条 redirect（含 `http-equiv="refresh"` 与目标路径）。
4. 清理临时目录；输出 `docs site check passed`。

`docs:build` = `vitepress build docs`；`docs:dev` / `docs:preview` 为开发用。manifest `verification` 里 `docs-check` 条目（`temporary-write`）语义不变。

### 6.2 `scripts/check-harness.mjs`

- 删除 `HNS-DESIGN-BUILD-001/002`、`HNS-ADR-BUILD-001/002`、`HNS-EXEC-PLAN-BUILD-001/002` 及 `siteBuilderText` 读取：VitePress 全量构建，"未进构建清单"不再可能，规则只会恒真。
- `HNS-DESIGN-INDEX-001` / `HNS-ADR-INDEX-001` / `HNS-EXEC-PLAN-INDEX-001` 改为认 `.md` 文件名（`<basename>.md` / `active|completed/<name>.md`）。
- 保留 `HNS-DOC-007` / `HNS-DOC-008`（`site_builder` 存在且可读）；manifest `site_builder` 改指 `docs/.vitepress/sidebar.mjs`（schema 字段名不变）。
- `removed_outputs` 改为 `jj-delivery.md` / `jj-validate.md` / `jj-evolve.md`（`HNS-DOC-FRESHNESS-002` 继续拦旧入口链接）。

### 6.3 `src/harnessGc.mjs`

保留 `GC-DOC-ORPHAN-001` 与 `documentation-coverage` 评分类别，只换数据来源：`sidebar.mjs` 作为脚本运行时（`node docs/.vitepress/sidebar.mjs`）打印 `sidebarDocPaths()` 的 JSON；`runHarnessGc` 用 `spawnSync` 同步读取，"当前文档不在侧栏"即孤儿。原因：`runHarnessGc` / `checkHarnessRepository` 是同步函数，侧栏模块是 ESM 只能异步 import；spawn 一次子进程比把 CLI 与全部测试改成异步便宜得多。manifest `site_builder` 改指 `docs/.vitepress/sidebar.mjs`（字段名不变；语义"声明站点有哪些页的文件"）。

### 6.4 其他

- `scripts/check-project.mjs` 必需文件：去掉 `scripts/build-docs.mjs`，加 `scripts/check-docs.mjs`、`docs/.vitepress/config.mjs`、`docs/.vitepress/sidebar.mjs`、`docs/.vitepress/redirects.mjs`。
- `tests/docs-site.test.mjs` 重写：侧栏模块单测（5 组存在、自动分组含已知设计文档、每条 link 有源文件）、redirect 表单测（每条目标对应源文件）、`check-docs.mjs` 端到端一次（exit 0 + 标记输出）。
- `tests/harness-check.test.mjs`：去掉 BUILD 断言与假 builder 文件；索引 fixture 改 `.md` 链接。
- 文案更新：`docs/maintenance.md`（文档 SSOT 表、命令）、`docs/deployment.md`、`docs/architecture.md`、`ARCHITECTURE.md` 两行、`docs/commands/cli.md` 两行、`CHANGELOG.md` Unreleased 一条。
- CI / Pages 工作流不变（`npm ci` 会装 vitepress；`docs:build` 仍输出 `site/`）。

### 6.5 取舍

- 站点不再能用 `file://` 直接打开（SPA + `base`），改用 `npm run docs:preview`。
- 约 150 个 devDependencies；`verify` 多一次 VitePress 构建（约 20–40 s）。
- 中文搜索依赖 `Intl.Segmenter`；不支持的旧浏览器回退到默认分词（只匹配句首）。

## 7. 使用文档改版

### 7.1 读者与判据

读者：第一次装 jj-flow、只想在自己仓库里让 Agent 把一个需求做完的人。判据：读完「第一次使用」+「ralph」两页，能独立完成 安装 → 说一句话 → 看到归档记录 → 再改一点 → 收工。

### 7.2 命令页模板（每个命令页按此顺序）

1. **一句话**：它帮你做什么、不做什么 + 怎么喊（Codex `$jj-x` / 其他 `/jj-x`）
2. **什么时候用 / 不该用**（不该用时去哪一页）
3. **开始前**：≤ 3 条准备（在哪个仓、哪条分支、要不要先 commit）
4. **第一次这样用**：你说 → Agent 会做 → 你会看到 → 怎么算做完（一段完整走一遍）
5. **常用说法**：按场景分组，每场景 1–2 句真实话术；不再在多处重复
6. **做完之后**：再改一点 / 继续 / 不做了 / 交接 / 收工（各指向对应页）
7. **进阶**（可选，放后面）：强度档、只分析不动代码、截图当需求、参数写法
8. **记录在哪**：只列用户会打开的文件
9. **相关**

### 7.3 名词纪律

- 用户页第一次出现的术语要有一句人话解释；`CAP-*` / `DEL-*` / `run_id` / `task_key` 不出现在前 4 段。
- Mode S/W/P、A2/A3/A4、gate 名、L1/L2、`events.jsonl`、`migrated/`、`archive/` 之类内部词移到 `concepts-hosts.md` / 设计文档，命令页只留一句 + 链接。
- 示例仓库统一叫 **项目A / 项目B / 项目C**（与 skill 一致）。
- "归档"固定解释为：记录定稿、任务目录搬进 `completed/`、以后还能接着改。

### 7.4 各页改法

| 页 | 改法 |
| --- | --- |
| `index.md` | 三句话定位 + 「我该用哪个」表（保留）+ 三步开始；砍掉重复的"怎么喊"（安装页已有） |
| `installation.md` | 结构不变；把"装好后怎么喊"表移到最前面的"下一步"前；补一句"装的是对话入口，不是后台服务" |
| `usage.md` | 改名「第一次使用」：以 ralph 为主线完整走一遍（在仓库里开对话 → 说一句话 → 五步各做什么 → 仓库里多出什么 → 怎么确认 → 接着改 / 收工 / 交接），same / dispatch 只留入口和一句区别 |
| `commands.md` | 保留总览表；"可以怎么说"合并为一组示例；加一句"从哪页开始"的指引 |
| `commands/jj-ralph.md` | 按 §7.2 全部重写（当前最差） |
| `commands/jj-same.md` / `jj-dispatch.md` / `jj-end.md` / `jj-init.md` / `jj-review.md` / `jj.md` | 按 §7.2 重写；dispatch 页去掉 Mode S/W/P 段（一句 + 链接宿主页）；end 页去掉事故复述，保留"合入哪条分支"规则的用户版 |
| `pitfalls.md` | 结构已是场景式，保留；每条补一行"在哪一步会遇到"；删 demo 引用 |
| `commands/jj-team-*.md` / `jj-evaluated.md` | 只做轻改：开头统一一句"可选，不推进验收"，其余不动 |
| `glossary.md` / `concepts-*.md` | 不改结构；`concepts-hosts.md` 接收 dispatch 页移出的 Mode S/W/P 说明 |

### 7.5 事实边界（改写只能在此范围内）

来自 `skills/*/SKILL.md`，改写不得与之矛盾、不得新增行为：

- **ralph**：永远五步（分析 → 计划 → 改代码 → 验收 → 归档），`tiny` 只缩短分析和计划，`strict` 在验收前多一道审查/复检；「先不写代码 / 先分析」停在分析，说「开始做吧 / 我认可」才动代码；同一件事的「继续 / 按审查改 / 改坏了 / 修完 / 再改一下」接着同一任务（归档过也一样），不新开；「这个先不做了 / 砍了」标废弃，可救回；截图 / 「这里」先当需求读；验收通过默认归档；归档后会问一次要不要投喂全局知识库，你点头才写；**不 commit / 不 push / 不合分支**（收工用 `$jj-end`）；用户不用记任务编号；记录在 `.workflow/ralph/<task-…>/`（`task_plan.md` 目标·验收·步骤、`progress.md` 过程、`findings.md` 踩坑与结论），归档后搬进 `completed/`；迁仓说「交接到 项目B 项目C」→ same（源仓未提交时交接未就绪）。
- **same**：迁的是需求不变量，不整文件复制；先读 ralph 任务里的交接信息；动手前核对每个目标仓的分支是不是这个任务的分支，不对就停；多目标说不清（如「三端」）会先问；每个目标单独报结果（做了什么 / 怎么验证的 / 分支与提交 / 下一步），部分成功不算全部完成；不主动 commit / push。
- **dispatch**：Codex / Grok / Qoder 可用，Claude 没有（有意为之）；预览（只读、分支表）→ 你批准 → 派发 → 可中断续跑；源仓未提交会被拦；「验收通过」要有提交 + 审查 + 真实会话 + 证明文件，口头不算；验收通过 ≠ 已 push / 已合；回退时列选项由你点选；调度状态默认在 `~/.jj-flow`；默认在功能分支上改、不额外开目录。
- **end**：固定顺序 拉最新 → 提交 → 同步并推工作分支 → 切到合入分支同步 → 合并 → 推合入分支 → 回到工作分支；合入分支：你写的 `integration=` > 文档/配置明说的收工分支 > `dev` → `develop` → `main` > 问你；git log 里的 `Merge into staging`、`staging` 分支存在、构建脚本名含 staging **都不算**约定；执行前先打印一行 `work→integration` 计划及来源；冲突默认自己合，只有真正判不了（同一开关两边相反、二进制/密钥）才整段中止并把表交给你；绝不 force push / 删分支 / 改 git 配置；`dry_run=true` 只打印计划；做完实现后 Agent 可能主动收工，不想推就明说"先别推"；end 只动 Git，不归档 ralph 任务。
- **review**：只读；优先用宿主自带 code review；结论写进当前 ralph 任务 `.state/reviews/REV-n.json`，结果只有 通过 / 需要修改 / 阻塞；没有 ralph 任务就不会硬建一个；你也可以把审查结论贴给它记录；改完说「按审查改」回到 ralph。
- **init**：先给短提案（中文名 / 别名 / 家族 / 待投喂条数），你点头才写 `~/.jj-flow/map.md`；默认只处理当前仓，说「梳理 D:\2025」则加上该目录的直接子仓；名字用你说的，否则用 AGENTS.md 标题或目录名，不自己编；ralph / same / dispatch 不会自动入图。
- **jj**：分流入口；顺序 接入 → 迁移 → 多项目 → 单仓 → 审查 → 收工；说不清就先问目标。

## 8. 验收

- `npm run verify` 全绿（含新的 `docs:check`、更新后的 harness 检查与测试）。
- `npm run docs:build` 产物包含：`index.html`、`commands/jj-ralph.html`、`changelog.html`、`sitemap.xml`、全部跳转页；不含任何 demo 页。
- `grep -r '\.html)' docs --include=*.md` 在非排除目录无内链残留。
- `npm run docs:preview` + 浏览器截图：首页、ralph 页、设计文档页（折叠组展开）、搜索"迁仓"有结果；窄屏 (390px) 侧栏可收起。
- 内容自查：每个命令页 9 段齐全且顺序一致；ralph 页前 4 段不含 §7.3 禁用词；每条行为陈述能对到 §7.5。

## 9. 不做什么

- 不改 `skills/`；不改 `src/ralph` 等业务逻辑；不改 README（链接的根级页面路径不变）。
- 不加 `.gitattributes`（工作区 CRLF 是本机 checkout 状态，单独处理）。
- 不做 hero 首页、不做多语言、不启用 `lastUpdated`。
