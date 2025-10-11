import { resolve } from 'node:path'
import { defineBuildConfig } from 'unbuild'
export default defineBuildConfig([
  {
    entries: ['./index.ts'],
    declaration: true,
    clean: false,
    rootDir: resolve(__dirname, './packages/shared'),
  },
  {
    entries: ['./index.ts'],
    declaration: true,
    clean: false,
    rootDir: resolve(__dirname, './packages/utils'),
  },
  {
    entries: ['./index.ts'],
    declaration: true,
    clean: false,
    rootDir: resolve(__dirname, './packages/extx'),
    outDir: resolve(__dirname, './dist'),
  },
])
