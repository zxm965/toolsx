import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig(
  [
    {
      rootDir: 'packages/shared',
      entries: ['./src/index.ts'],
      declaration: true,
    },
    {
      rootDir: 'packages/utils',
      entries: ['./src/index.ts'],
      declaration: true,
    },
  ]
)
