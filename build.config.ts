import { defineBuildConfig } from 'unbuild'
export default defineBuildConfig({
  entries: ['./shared/index.ts', './utils/index.ts'],
  declaration: true,
  clean: true
})
