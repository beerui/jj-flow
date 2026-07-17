# 维护说明

## 分支和提交

- 使用 Conventional Commits：`feat:`、`fix:`、`docs:`、`test:`、`chore:`。
- 中文摘要即可，例如：`feat: 增加 same recipe 默认路由`。

## 验证

维护 `jj-flow` 自身时，直接修改仓库并运行：

```bash
npm run verify
```

`verify` 会运行：

- `node --test tests/*.test.mjs`
- `scripts/check-project.mjs`
- `scripts/build-docs.mjs --check`

修改调度协议后额外建议：

```bash
node --test tests/jj-dispatch-contract.test.mjs
git diff --check
```

已移除 `$jj-validate` / `$jj-evolve` 对话入口；不要再安装或调用它们。

## 发布

GitHub Actions 包含两个工作流：

- `ci.yml`：PR 和 push 时运行测试。
- `pages.yml`：构建并部署文档站。
- `release-please.yml`：根据 Conventional Commits 生成版本与 changelog。

## 文档

- 源文档在 `docs/`。
- 用 `npm run docs:build` 生成 `site/`。
- 用户可见能力变更时，先更新 `docs/usage.md` 与相关命令页，再改代码。
