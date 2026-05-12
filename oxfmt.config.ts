import { defineConfig } from 'oxfmt'

export default defineConfig({
  semi: false,
  tabWidth: 2,
  printWidth: 160,
  singleQuote: true,
  jsxSingleQuote: true,
  sortImports: true,
  singleAttributePerLine: false,
  trailingComma: 'none',
  ignorePatterns: ['prisma']
})
