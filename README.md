# toolsx

轻量、类型安全的 TypeScript 工具库，按运行环境拆成两个入口：

- `toolsx/utils`：数组、对象、字符串、异步和类型判断等无运行环境依赖的函数。
- `toolsx/shared`：request、Cookie、Storage 和 EventEmitter 等应用侧能力。

## 安装

```bash
pnpm add toolsx
```

```ts
import { debounce, retry, unique } from 'toolsx/utils'
import { Cookie, EventEmitter, StorageWithExpiration, createRequestClient } from 'toolsx/shared'
```

## utils

### Type guards

- `isNumber` / `isFiniteNumber`
- `isString` / `isBoolean` / `isFunction`
- `isObject` / `isPlainObject`
- `isNil` / `isDefined`
- `isEmpty`

`isNumber(NaN)` 返回 `true`；需要排除 `NaN` 和无穷值时使用 `isFiniteNumber`。

### Array

- `toArray` / `unique` / `compact`
- `flatten(array, depth)`
- `intersection` / `difference` / `partition`
- `chunk` / `last`
- `groupBy` / `keyBy`
- `sortBy` / `shuffle` / `sample`

```ts
import { compact, intersection, keyBy, partition } from 'toolsx/utils'

const values = compact([0, 1, null, 2])
const sharedIds = intersection([1, 2, 3], [2, 3, 4])
const [enabled, disabled] = partition(users, (user) => user.enabled)
const usersById = keyBy(users, (user) => user.id)
```

### Object

- `pick` / `omit`
- `deepMerge` / `deepEqual` / `clone`
- `get` / `has` / `set` / `unset`
- `mapValues` / `mapKeys`

`set`、`unset` 和 `deepMerge` 会拒绝 `__proto__`、`constructor`、`prototype` 路径，避免原型污染。

```ts
import { deepMerge, get, has, set } from 'toolsx/utils'

const options = deepMerge({ theme: { color: 'red' } }, { theme: { size: 12 } })
set(options, 'theme.color', 'blue')

get<string>(options, 'theme.color')
has(options, 'theme.size')
```

### Number / String

- `clamp` / `randomInt`
- `capitalize` / `camelCase` / `pascalCase` / `kebabCase` / `snakeCase`
- `trim` / `truncate`
- `escapeHtml` / `mask` / `randomString`

### Async / Function / JSON

- `noop` / `sleep(ms, signal)`
- `tryCatch` / `timeout` / `withResolvers`
- `retry`
- `debounce` / `throttle`
- `promisePool`
- `memoize` / `memoizeAsync`
- `safeJsonParse` / `safeJsonStringify`

```ts
import { debounce, memoizeAsync, promisePool, retry } from 'toolsx/utils'

const data = await retry(() => loadData(), {
  retries: 3,
  delay: 200,
  factor: 2,
  maxDelay: 3_000,
  jitter: true,
  shouldRetry: (error) => isNetworkError(error)
})

const search = debounce(runSearch, 200, {
  leading: false,
  trailing: true,
  maxWait: 1_000
})

search.pending()
search.flush()
search.cancel()

const results = await promisePool(ids, (id) => loadUser(id), 4)
const loadUserOnce = memoizeAsync(loadUser, { ttl: 30_000 })
```

兼容旧版调用：`retry(fn, times, delay)`。`memoize` / `memoizeAsync` 默认使用第一个参数作为缓存键，多参数函数建议传入 `resolver`。

## request

`createRequestClient` 基于 `ofetch`，默认不抛请求错误，而是返回结构化结果：

```ts
import { createRequestClient, unwrapRequestResult } from 'toolsx/shared'

export const request = createRequestClient({
  baseURL: '/api',
  getToken: () => localStorage.getItem('access_token')
})

const result = await request.get<{ name: string }>('/user')

if (result.error) {
  console.error(result.error.message, result.status)
} else {
  console.log(result.response.name, result.meta.duration)
}

const user = await unwrapRequestResult(request.get<{ name: string }>('/user'))
```

### 完整配置

```ts
const request = createRequestClient({
  baseURL: '/api',
  timeout: 10_000,
  concurrency: 6,
  headers: { 'x-client': 'web' },
  auth: { header: 'Authorization', type: 'Bearer' },
  getToken: async () => tokenStore.accessToken,
  refreshToken: async () => {
    const token = await refreshAccessToken()
    tokenStore.accessToken = token
    return token
  },
  retryPolicy: {
    retries: 2,
    delay: 250,
    factor: 2,
    maxDelay: 3_000,
    jitter: true
  },
  responseCache: {
    ttl: 30_000,
    methods: ['GET'],
    invalidateOnMutation: true
  },
  onRequest: ({ options }) => ({
    ...options,
    headers: { ...options.headers, trace: '1' }
  }),
  onTrace: (trace) => console.log(trace.requestId, trace.duration)
})
```

默认行为：

- GET / HEAD 相同在途请求会去重。
- GET 缓存需要通过 `responseCache` 显式启用。
- 仅 GET / HEAD / OPTIONS 会自动重试，默认状态码为 `408`、`409`、`425`、`429`、`500`、`502`、`503`、`504`。
- `refreshToken` 存在时，默认在 `401` 后刷新；并发失败请求共享同一个刷新任务。
- 请求自动生成 `x-request-id`，结果 `meta` 包含耗时、尝试次数、缓存和去重状态。

单次请求可以用 `retryPolicy: false`、`dedupe: false`、`responseCache: false` 或 `skipAuthRefresh: true` 覆盖全局行为。

### 业务校验和转换

```ts
const result = await request.get<{ code: number; data: User; message: string }, 'json', User>('/profile', {
  validateResponse: (body) => body.code === 0 || body.message,
  transform: (body) => body.data
})
```

`validateResponse` 返回 `false`、错误消息或 `RequestError` 时，请求会返回失败结果。

### 中间件

```ts
const removeMiddleware = request.use(async (context, next) => {
  context.options.headers = {
    ...context.options.headers,
    'x-feature': 'profile'
  }

  const result = await next()
  return result
})

removeMiddleware()
```

### 缓存、进度和中断

```ts
const result = await request.post('/upload', {
  body: file,
  onUploadProgress: ({ loaded, total, percent, done }) => {},
  onDownloadProgress: ({ loaded, total, percent, done }) => {}
})

await request.invalidateCache('/users')
request.cache.clear()

const task = request.abortable.get('/slow')
task.abort()
await task.promise
```

Fetch 在不同运行环境下无法统一提供逐字节上传事件，因此上传回调至少报告开始和完成状态；下载回调会在响应流读取过程中报告字节进度。

### 实例方法

- `request(url, options)` / `request.raw(url, options)`
- `request.get/post/put/patch/delete/head/options`
- `request.withAbort` / `request.abortable.*`
- `request.use(middleware)`
- `request.invalidateCache(url, options)` / `request.cache.*`
- `request.createAbortController()` / `request.isAbortError(error)`

`raw` 返回原始 `FetchResponse`，不使用结果转换、业务校验、缓存和中间件。

### request 工具函数

- Header：`mergeHeaders`、`omitHeaders`、`headersToObject`、`getHeader`、`createAuthorizationHeader`
- Query：`createQueryString`、`appendQuery`
- Signal：`mergeSignals`、`createTimeoutSignal`
- Result：`isRequestSuccess`、`isRequestFailure`、`mapRequestResult`、`unwrapRequestResult`
- Error：`RequestError`、`normalizeRequestError`、`isRequestError`
- Trace：`createRequestId`

## Cookie

`Cookie` 支持默认配置、JSON、批量读取、清理和 SSR 安全降级。

```ts
import { Cookie, parseCookieHeader, serializeCookie } from 'toolsx/shared'

const cookie = new Cookie({ sameSite: 'Lax', secure: true })

cookie.setJSON('profile', { id: 1, name: 'Tom' }, { maxAge: 60 * 30 })
const profile = cookie.getJSON<{ id: number; name: string }>('profile')

cookie.has('profile')
cookie.getAll()
cookie.remove('profile')
cookie.clear()

parseCookieHeader('token=abc; theme=dark')
serializeCookie('token', 'abc', { path: '/', sameSite: 'Lax' })
```

API：

- `set` / `get` / `remove`
- `setJSON` / `getJSON`
- `getAll` / `has` / `clear`
- `isAvailable`
- `parseCookieHeader` / `serializeCookie`

服务端没有 `document` 时，默认实例的写入方法返回 `false`，读取返回空结果；也可以在构造函数中传入自定义 `CookieAdapter`。浏览器 JavaScript 无法创建 `HttpOnly` Cookie，需要由服务端响应头设置。

## StorageWithExpiration

`StorageWithExpiration` 为任意兼容 `Storage` 的实现增加 TTL、滑动过期、命名空间、版本迁移、容量降级和跨标签页通知。

```ts
import { StorageWithExpiration, createMemoryStorage, isStorageAvailable } from 'toolsx/shared'

const rawStorage = isStorageAvailable(localStorage) ? localStorage : createMemoryStorage()
const storage = new StorageWithExpiration(rawStorage, {
  namespace: 'my-app',
  validateKey: false,
  version: 2,
  slidingExpiration: 30 * 60_000,
  sync: true,
  migrate: (value, { fromVersion }) => {
    return fromVersion === 1 ? migrateProfile(value) : value
  },
  onParseError: (error, key) => console.warn(key, error)
})

storage.setItem('user-profile', { name: 'Tom' }, { ttl: 60_000 })
const profile = storage.getValue<{ name: string }>('user-profile')
const settings = storage.getOrSet('settings', () => ({ theme: 'light' }))

const unsubscribe = storage.subscribe((change) => {
  console.log(change.type, change.key, change.source)
})

storage.keys()
storage.has('settings')
storage.removeItem('settings')
storage.clear()
unsubscribe()
storage.destroy()
```

说明：

- `expiresAt` 使用绝对毫秒时间戳或 `Date`，`ttl` / `slidingExpiration` 使用持续毫秒数。
- 主 Storage 写入失败时，默认降级到内存 Storage；传 `fallbackStorage: false` 可以关闭。
- 配置 namespace 后，`clear()` 只清理当前 namespace。
- `sync: true` 优先使用 `BroadcastChannel`，不可用时降级到 `storage` 事件。
- `getItem` 返回 `{ found, expired, value, expiresAt, version }`，过期数据会被删除。

## EventEmitter

```ts
import { EventEmitter } from 'toolsx/shared'

type AppEvents = {
  'user:login': { id: string }
  logout: undefined
}

const emitter = new EventEmitter<AppEvents>({ maxListeners: 20 })

const unsubscribe = emitter.on('user:login', ({ id }) => console.log(id), {
  priority: 10,
  signal: abortController.signal
})

emitter.once('logout', () => console.log('once'))
emitter.onPattern('user:*', ({ eventName, payload }) => {})
emitter.onAny(({ eventName, payload }) => {})

emitter.emit('user:login', { id: '1' })
await emitter.emitAsync('logout')

const syncErrors = emitter.safeEmit('logout')
const asyncErrors = await emitter.safeEmitAsync('logout')
unsubscribe()
```

API：

- `on` / `off` / `once`
- `onAny` / `onPattern`
- `emit` / `safeEmit`
- `emitAsync` / `safeEmitAsync`
- `clear` / `listenerCount` / `totalListenerCount`
- `setMaxListeners`
- `createListenerHelper`

`safeEmit` 只捕获同步抛错；异步 listener 应使用 `safeEmitAsync`。

## 框架示例和 API 文档

- [Vue、React、Node 示例](docs/examples.md)
- 执行 `pnpm docs:api` 生成 TypeDoc API 网站到 `docs/api`。
- Vite Playground 位于 `playground/vite`，包含成功、重试、缓存和业务失败状态以及代码复制示例。

## 开发与发布

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
pnpm playground:build
pnpm verify
```

`pnpm verify` 会串行执行 lint、格式、类型检查、覆盖率、库构建、Playground 构建、包导出校验和 API 文档生成。版本和 CHANGELOG 使用 Changesets 管理，详情见 [发布说明](docs/release.md)。

## 边界说明

- `clone` 优先使用 `structuredClone`；旧环境的 JSON 降级不支持函数、循环引用等数据。
- Cookie 和 Storage 中的“加密”不属于本库职责；敏感凭证应优先使用服务端 `HttpOnly` Cookie。
- response cache 位于当前 request 实例内存中，不是 HTTP Cache，也不会跨进程共享。
- 浏览器 Storage 容量、Cookie 大小和跨标签页能力受用户环境及隐私策略影响。
