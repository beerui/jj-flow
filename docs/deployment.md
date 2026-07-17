# GitHub Pages 部署

## 目标

`jj-flow` 是长期维护项目，文档必须可以被自动构建、自动检查、自动部署到 GitHub Pages。仓库中的 Markdown 是唯一文档源，部署产物由脚本生成，不手工维护。

公开文档地址固定使用：

```text
https://beerui.github.io/jj-flow/index.html
```

## 目录约定

```text
docs/                 文档源，维护者只改这里
scripts/build-docs.mjs 静态站点生成脚本
site/                 构建产物，本地生成，不提交
.github/workflows/pages.yml GitHub Pages 发布流程
```

## 本地构建

```bash
npm run docs:build
```

构建结果会写入 `site/`。本地只需要检查 HTML 是否生成完整，不需要把 `site/` 提交到仓库。

## 本地检查

```bash
npm run docs:check
npm run verify
```

`docs:check` 使用同一套生成逻辑构建到临时目录，并检查首页、全部独立命令页、样式、搜索脚本和搜索索引是否完整。`verify` 会同时跑单元测试、项目结构检查和文档站检查。

## GitHub Pages 流程

合并到 `main` 后，`pages.yml` 会：

1. 安装依赖。
2. 运行 `npm run docs:build`。
3. 上传 `site/` 作为 Pages artifact。
4. 部署到 GitHub Pages 环境。

## npm 发布流程

`npm-publish.yml` 用于从 GitHub Actions 发布 npm 包。它不会自动跟随每次 push 发布，需要维护者手动触发。

发布 beta 前确认：

- `package.json` 的版本是预发布版本，例如 `0.1.1-beta.0`。
- GitHub 仓库 secret 已配置 `NPM_TOKEN`。
- `npm run verify` 在本地或 CI 中通过。
- `npm publish --dry-run --tag beta --access public` 没有包内容警告。

在 GitHub Actions 中运行：

```text
Workflow: NPM Publish
tag: beta
dry_run: false
run_verify: true
```

发布成功后，用户可以用：

```bash
npx @shendu-sdt/jj-flow@beta install-skill
npx @shendu-sdt/jj-flow@beta install-skill --platform claude
npx @shendu-sdt/jj-flow@beta install-skill --platform all --project
```

## 新增文档页面

1. 先在 `docs/` 新增 Markdown。
2. 在 `scripts/build-docs.mjs` 的 `PAGES` 中登记页面标题、源文件和输出文件。
3. 在 `docs/index.md` 加入口。
4. 如果页面是安装、命令、使用、架构这类长期入口，同步加入 `scripts/check-project.mjs`。
5. 运行 `npm run verify`。

不要直接编辑 `site/`。如果 GitHub Pages 内容不对，修文档源或生成脚本。
