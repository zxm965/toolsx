import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const requiredExports = {
  './shared': ['AsyncStorageWithExpiration', 'Cookie', 'EventEmitter', 'StorageWithExpiration', 'createMemoryRequestCache', 'createRequestClient'],
  './utils': ['chunk', 'createLimiter', 'debounce', 'deepMerge', 'noop', 'poll', 'retry', 'safeJsonParse', 'stableJsonStringify', 'uniqueBy']
}

for (const [subpath, names] of Object.entries(requiredExports)) {
  const definition = packageJson.exports[subpath]

  if (!definition?.import || !definition?.types) {
    throw new Error(`Missing import/types export for ${subpath}`)
  }

  await access(resolve(root, definition.import))
  await access(resolve(root, definition.types))

  const module = await import(resolve(root, definition.import))

  for (const name of names) {
    if (!(name in module)) {
      throw new Error(`Missing runtime export ${name} from ${subpath}`)
    }
  }
}

console.log(`Validated package exports for ${packageJson.name}@${packageJson.version}`)
