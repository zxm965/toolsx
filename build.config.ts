import { resolve } from 'node:path'
import { defineBuildConfig } from 'unbuild'
// export default defineBuildConfig([
//   {
//     entries: ['./index.ts'],
//     declaration: true,
//     clean: false,
//     rootDir: resolve(__dirname, './shared'),
//   },
//   {
//     entries: ['./index.ts'],
//     declaration: true,
//     clean: false,
//     rootDir: resolve(__dirname, './utils'),
//   },
//   {
//     entries: ['./index.ts'],
//     declaration: true,
//     clean: false,
//     outDir: resolve(__dirname, './dist'),
//   },
// ])
export default defineBuildConfig({
  entries: [
    './index.ts',
    './shared/index.ts',
    './utils/index.ts',
  ],
  declaration: true,
  clean: true,
})
