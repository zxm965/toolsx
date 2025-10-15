import { defineBuildConfig } from 'unbuild'
export default defineBuildConfig({
  entries: [
    './index.ts',
    './shared/index.ts',
    './utils/index.ts',
  ],
  declaration: true,
  clean: true,
})
