# 维护说明

## 分支和提交

- 使用 Conventional Commits：`feat:`、`fix:`、`docs:`、`test:`、`chore:`。
- 中文摘要即可，例如：`feat: 增加 yapi evidence guard`。

## 验证

Codex 内先用项目自检看长期状态：

```text
$jj validate 检查当前项目状态、文档/代码漂移和下一步升级建议
$jj evolve 基于当前自检结果推进下一项项目管理能力
```

本地维护命令用于确认可自动验证的部分：

```bash
npm run verify
```

`verify` 会运行：

- `node --test tests/*.test.mjs`
- `scripts/check-project.mjs`
- `scripts/build-docs.mjs --check`

## 发布

GitHub Actions 包含两个工作流：

- `ci.yml`：PR 和 push 时运行测试。
- `pages.yml`：main 分支生成 `site/` 并部署到 GitHub Pages。
- `release-please.yml`：根据 Conventional Commits 生成 release PR 和 changelog。
- `npm-publish.yml`：手动触发 npm 发布，默认用于 beta 发布。

### npm beta 发布

仓库设置需要满足：

- Actions workflow permissions 使用 `Read and write permissions`。
- 勾选 `Allow GitHub Actions to create and approve pull requests`，否则 Release Please 不能创建 release PR。
- GitHub Pages 使用 GitHub Actions 部署；`pages.yml` 会在首次部署时尝试自动启用 Pages。

发布前在 GitHub 仓库 secrets 中配置 `NPM_TOKEN`。该 token 必须有 `@shendu-sdt/jj-flow` 的 publish 权限；如果 npm 账号开启了 2FA，需要使用允许 publish bypass 的 granular access token。

GitHub 上发布 beta：

1. 打开 Actions。
2. 选择 `NPM Publish`。
3. 点击 `Run workflow`。
4. `tag` 使用 `beta`。
5. 首次可先把 `dry_run` 设为 `true` 验证包内容。
6. 确认 dry-run 通过后，重新运行并把 `dry_run` 设为 `false`。

本地发布前检查：

```bash
npm run verify
npm_config_cache=.tmp/npm-cache npm publish --dry-run --tag beta --access public
```

发布后的安装命令：

```bash
npx @shendu-sdt/jj-flow@beta install-skill
npx @shendu-sdt/jj-flow@beta install-skill --project
```

## 文档站维护

文档源放在 `docs/`，部署产物由 `npm run docs:build` 生成到 `site/`。`site/` 不提交；GitHub Pages workflow 会在 CI 环境重新生成。

新增或重命名文档页面时：

1. 先写 `docs/*.md`。
2. 在 `scripts/build-docs.mjs` 的 `PAGES` 中登记页面。
3. 更新 `docs/index.md` 的入口。
4. 若页面是长期入口，加入 `scripts/check-project.mjs`。
5. 运行 `npm run verify`。

长期维护原则：文档站是交付协议的正式表面，不能只靠 README 承载完整说明。

README 只保留项目定位、安装入口和文档链接。命令细节、缩写、术语、使用方案和维护规则都放在文档站源码里维护，避免多处重复更新。

新增或调整缩写、命令名、工具名时，同步更新 `docs/glossary.md`。不要把缩写说明再复制到 README。

## 增加新模式

1. 先更新 `docs/usage.md`，写清用户怎么用、默认会自动发现什么、哪些信息才需要用户决策。
2. 同步更新 `docs/commands.md`，写清什么时候用、要给什么、使用示例和会得到什么。
3. 再在 `src/recipes.mjs` 增加 recipe。
4. 在 `src/dispatch.mjs` 确认路由关键词。
5. 在 `src/guards.mjs` 增加必要 guard。
6. 在 `tests/` 增加路由和 guard 测试。

用户可见能力必须文档先行。代码实现不能要求用户先提供一组固定参数；参数只能作为加速信息，默认路径应由模型从项目、资料和上下文中自动分析。

## 增加真实工具接入

工具接入要先产出 evidence，再考虑自动执行。推荐顺序：

1. 包装 CLI 输出为 evidence JSON。
2. 给 evidence 增加 guard。
3. 让 recipe 引用该 evidence。
4. 最后才考虑自动调用工具。

证据适配器必须覆盖成功、字段缺失、部分证据和工具失败 4 类 fixture。成功时输出对应业务 evidence，例如 `yapi_contract`、`arms_sls`、`zentao_task`；字段缺失或部分证据保持 `PENDING`；工具失败必须是 `FAIL`，不能隐式转成 `PASS`。
