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
pnpm version:packages
```

该命令消费 changeset，更新 `package.json` 版本和 `CHANGELOG.md`。

## 本地发布

```bash
pnpm release
```

`pnpm release` 会先执行完整 `pnpm verify`，再通过 Changesets 发布尚未出现在 npm registry 的版本。npm 账号需要完成登录并启用发布所需的 2FA。

项目不配置 GitHub 自动发布；版本生成、npm 发布、Git commit、tag 和 push 均由维护者在本地确认后执行。
