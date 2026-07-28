import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      exclude: ['**/*.d.ts', '**/index.ts'],
      include: ['shared/**/*.ts', 'utils/**/*.ts'],
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        branches: 75,
        functions: 80,
        lines: 80,
        statements: 80
      }
    },
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true
  }
})
