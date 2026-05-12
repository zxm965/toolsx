import { defineConfig } from 'oxlint'

export default defineConfig({
  rules: {
    'no-unused-vars': 'warn',
    'no-undef': 'off',
    'no-var': 'error',
    'no-unused-expressions': 'warn',
    'no-unused-labels': 'warn',
    'oxc/approx-constant': 'warn'
  },
  ignorePatterns: ['node_modules', '.output', 'dist', 'prisma/generated', 'components.d.ts']
})
