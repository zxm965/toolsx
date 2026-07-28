# 发布流程

项目使用 Changesets 管理语义化版本和 CHANGELOG。

## 提交变更

```bash
pnpm changeset
```

选择 `toolsx`、版本级别并填写面向使用者的变更说明。生成的 `.changeset/*.md` 应与代码一起提交。

## 本地验证

```bash
pnpm verify
```

验证内容包括：

- oxlint 和 oxfmt 检查
- TypeScript 与 Vue 类型检查
- Vitest 和 V8 覆盖率阈值
- 库与 Playground 构建
- `dist` 运行时导出和类型声明校验
- TypeDoc API 文档生成

## 生成版本

```bash
pnpm version
```

该命令消费 changeset，更新 `package.json` 版本和 `CHANGELOG.md`。

## 发布

```bash
pnpm release
```

GitHub `main` 分支上的 Release workflow 使用 `changesets/action` 创建版本 PR；合并版本 PR 后，需要仓库配置 `NPM_TOKEN` 才能发布到 npm。发布前还会执行完整 `pnpm verify`。
