# toolsx

一些简单常用的 TypeScript 工具函数，按场景拆成两个入口：

- `toolsx/utils`：与运行环境无关的通用函数。
- `toolsx/shared`：浏览器/应用侧常用能力，包括 request、Cookie、Storage、EventEmitter。

## 安装

```bash
pnpm add toolsx
```

## utils

`utils` 提供一组与业务框架无关的通用函数。

```ts
import { chunk, debounce, isDefined, pick, sleep, tryCatch, unique } from 'toolsx/utils'

const ids = unique([1, 1, 2, 3])
const pages = chunk(ids, 2)
const user = pick({ id: 1, name: 'Tom', password: 'secret' }, ['id', 'name'])
const values = [1, null, 2, undefined].filter(isDefined)
const [data, error] = await tryCatch(fetch('/api/user').then((res) => res.json()))

await sleep(300)

const onResize = debounce(() => {
  console.log('resize settled')
}, 200)
```

### Type guards

- `isNumber(value)`：判断是否为 `number`；不排除 `NaN`。
- `isFiniteNumber(value)`：判断是否为有限数字。
- `isString(value)`：判断是否为字符串。
- `isBoolean(value)`：判断是否为布尔值。
- `isFunction(value)`：判断是否为函数。
- `isObject(value)`：判断是否为非 `null` 对象。
- `isPlainObject(value)`：判断是否为普通对象。
- `isNil(value)`：判断是否为 `null` 或 `undefined`。
- `isDefined(value)`：判断不是 `null` / `undefined`，适合 `array.filter(isDefined)`。
- `isEmpty(value)`：判断空值、空字符串、空数组、空 `Map`、空 `Set`、空对象。

### Array / Object

- `toArray(value)`：把单个值转成数组；`null` / `undefined` 返回空数组。
- `unique(array)`：数组去重，基于 `Set`。
- `chunk(array, size)`：按指定大小拆分数组。
- `last(array)`：获取数组最后一项。
- `groupBy(array, getKey)`：按 key 分组。
- `sortBy(array, getValue, order)`：按字段排序，返回新数组。
- `pick(object, keys)`：选择对象字段。
- `omit(object, keys)`：排除对象字段。
- `deepMerge(target, source)`：深合并普通对象。
- `get(object, path, defaultValue)`：按路径读取对象属性。
- `set(object, path, value)`：按路径写入对象属性，会修改原对象。
- `clone(value)`：优先使用 `structuredClone`，兜底使用 JSON 克隆。

```ts
import { deepMerge, get, groupBy, set, sortBy } from 'toolsx/utils'

const grouped = groupBy([{ type: 'a' }, { type: 'b' }], (item) => item.type)
const sorted = sortBy([{ age: 18 }, { age: 12 }], (item) => item.age)
const options = deepMerge({ theme: { color: 'red' } }, { theme: { size: 12 } })
const color = get<string>(options, 'theme.color')
set(options, 'theme.color', 'blue')
```

### Number / String

- `clamp(value, min, max)`：把数值限制在区间内。
- `randomInt(min, max)`：生成包含边界的随机整数。
- `capitalize(value)`：首字母大写。
- `camelCase(value)`：转小驼峰。
- `kebabCase(value)`：转短横线命名。
- `snakeCase(value)`：转下划线命名。
- `trim(value, chars)`：去除首尾空白或指定字符。

### Async / JSON / Function

- `noop()`：空函数，适合作为默认回调。
- `sleep(ms)`：等待指定毫秒。
- `tryCatch(promise)`：把 Promise 转成 `[data, error]` 元组。
- `retry(fn, times, delay)`：失败重试异步任务。
- `timeout(promise, ms, message)`：给 Promise 增加超时控制。
- `withResolvers<T>()`：创建 `{ promise, resolve, reject }`。
- `debounce(fn, wait)`：防抖函数，返回值带 `cancel()`。
- `throttle(fn, wait)`：节流函数，返回值带 `cancel()`。
- `safeJsonParse(value, fallback)`：安全 JSON 解析。
- `safeJsonStringify(value, fallback)`：安全 JSON 序列化。

## request

`request` 基于 `ofetch`，适合在应用或 SDK 中对外暴露统一 HTTP 能力。它默认不抛请求错误，而是返回结构化结果；业务层成功/失败由使用方根据协议判断。

```ts
import { createRequestClient, unwrapRequestResult } from 'toolsx/shared'

export const useRequest = createRequestClient({
  baseURL: 'https://api.example.com',
  getToken: () => localStorage.getItem('access_token')
})

const result = await useRequest.get<{ name: string }>('/user')

if (result.error) {
  console.error(result.error.message, result.status)
} else {
  console.log(result.response.name)
}

const user = await unwrapRequestResult(useRequest.get<{ name: string }>('/user'))
```

### request API

```ts
const useRequest = createRequestClient({
  baseURL: '/api',
  timeout: 10_000,
  headers: { 'x-client': 'web' },
  auth: { header: 'Authorization', type: 'Bearer' },
  getToken: async () => 'token',
  onRequest: ({ options }) => ({ ...options, headers: { ...options.headers, trace: '1' } }),
  onResponse: ({ response }) => console.log(response.status),
  onError: ({ error }) => console.warn(error.message)
})
```

实例方法：

- `useRequest(url, options)` / `useRequest.raw(url, options)`
- `useRequest.get/post/put/patch/delete/head/options(url, options)`
- `useRequest.withAbort(url, options)`
- `useRequest.abortable.get/post/put/patch/delete/head/options(url, options)`
- `useRequest.createAbortController()` / `useRequest.isAbortError(error)`

### 业务校验

如果接口固定返回 `{ code, data, message }`，可以用 `validateResponse` 把业务失败转成 `RequestError`：

```ts
const result = await useRequest.get<{ code: number; data: User; message: string }, 'json', User>('/profile', {
  validateResponse: (body) => body.code === 0 || body.message,
  transform: (body) => body.data
})
```

### request 工具函数

- `mergeHeaders(source, extra)`：合并 headers，后者覆盖前者。
- `omitHeaders(source, names)`：复制 headers 并移除指定字段。
- `headersToObject(headers)`：把 `HeadersInit` 转成普通对象。
- `getHeader(headers, name)`：安全读取 header。
- `createAuthorizationHeader(token, auth)`：按配置生成鉴权 header。
- `createQueryString(params)` / `appendQuery(url, params)`：序列化 query，自动忽略 `null` / `undefined`。
- `mergeSignals(...signals)`：合并多个 `AbortSignal`。
- `createTimeoutSignal(timeout)`：创建超时中断信号，可配合 `mergeSignals` 使用。
- `createRequestId(prefix)`：生成简单 request id。
- `isRequestSuccess(result)` / `isRequestFailure(result)`：类型守卫。
- `mapRequestResult(result, transform)`：只转换成功响应，失败结果原样透传。
- `unwrapRequestResult(result)`：请求错误时抛出 `RequestError`，否则返回 `response`。
- `normalizeRequestError(error)` / `isRequestError(error)`：错误标准化与类型判断。

```ts
import { appendQuery, createTimeoutSignal, mapRequestResult, mergeSignals, unwrapRequestResult } from 'toolsx/shared'

const url = appendQuery('/users', { page: 1, keyword: 'tom' })
const result = await useRequest.get<{ list: User[] }>(url, {
  signal: mergeSignals(createTimeoutSignal(5_000))
})

const listResult = mapRequestResult(result, (data) => data.list)
const list = await unwrapRequestResult(listResult)
```

## Cookie

`Cookie` 是浏览器端 cookie 读写工具，依赖 `document.cookie`。

```ts
import { Cookie } from 'toolsx/shared'

const cookie = new Cookie()

cookie.set('token', 'abc', {
  maxAge: 60 * 30,
  sameSite: 'Lax',
  secure: true,
  onSuccess: () => console.log('cookie saved')
})

const token = cookie.get('token')
cookie.remove('token')
```

### Cookie API

- `set(name, value, options)`：写入 cookie，会自动编码 name/value。
- `get(name)`：读取 cookie，未命中时返回 `null`。
- `remove(name, options)`：删除指定 cookie，可传 `path` / `domain` 保持与写入时一致。

`CookieOptions`：

- `expires`：过期时间，支持 `Date` 或毫秒时间戳。
- `maxAge`：有效秒数。
- `path`：默认 `/`。
- `domain`：cookie domain。
- `sameSite`：`Strict` / `Lax` / `None`。
- `secure`：是否添加 `Secure`。
- `onSuccess`：写入完成后的回调。

## StorageWithExpiration

`StorageWithExpiration` 为 `localStorage` / `sessionStorage` 增加 JSON 序列化和过期状态能力。它依赖浏览器 `Storage` API，也提供内存 storage 兜底。

```ts
import { createMemoryStorage, isStorageAvailable, StorageWithExpiration } from 'toolsx/shared'

const rawStorage = isStorageAvailable(localStorage) ? localStorage : createMemoryStorage()
const storage = new StorageWithExpiration(rawStorage, {
  validateKey: false,
  onParseError: (error, key) => console.warn('bad storage item:', key, error)
})

storage.setItem(
  'user-profile',
  { name: 'Tom' },
  {
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
  }
)

const result = storage.getItem<{ name: string }>('user-profile')

if (result.expired) {
  console.log('expired profile:', result.value)
} else if (result.found) {
  console.log(result.value.name)
}

const profile = storage.getValue<{ name: string }>('user-profile')
storage.removeItem('user-profile')
```

### StorageWithExpiration API

- `new StorageWithExpiration(storage, options)`：传入 `localStorage`、`sessionStorage` 或兼容 `Storage` 的对象。
- `setItem(key, value, options)`：写入任意可序列化数据；`options.expiresAt` 可传 `Date` 或毫秒时间戳。
- `getItem<T>(key)`：返回 `{ found, expired, value, expiresAt }`；过期时会删除存储并返回 `expired: true`。
- `getValue<T>(key)`：只返回未过期 value；不存在、已过期或解析失败时返回 `null`。
- `removeItem(key)`：删除指定 key。
- `clear()`：清空传入的 storage。
- `createMemoryStorage()`：创建内存版 `Storage`，适合测试或 storage 不可用时兜底。
- `isStorageAvailable(storage)`：检测 storage 是否可读写。

`StorageWithExpirationOptions`：

- `validateKey`：默认使用英文字母/下划线校验；传 `false` 关闭，也可传 `RegExp` 或函数自定义。
- `serialize` / `deserialize`：自定义序列化逻辑。
- `parseErrorStrategy`：解析失败时 `remove` 或 `keep`，默认 `remove`。
- `onParseError`：解析失败回调。

## EventEmitter

`EventEmitter` 是轻量类型安全事件工具，适合业务模块之间做简单事件通信。

```ts
import { createListenerHelper, EventEmitter } from 'toolsx/shared'

type AppEvents = {
  login: { id: string; name: string }
  logout: undefined
}

const emitter = new EventEmitter<AppEvents>()
const createListener = createListenerHelper<AppEvents>()

const onLogin = createListener('login', (user) => {
  console.log(user.name)
})

const unsubscribe = emitter.on('login', onLogin)
emitter.emit('login', { id: '1', name: 'Tom' })
unsubscribe()

emitter.once('logout', () => {
  console.log('logout once')
})
emitter.emit('logout')
```

### EventEmitter API

- `on(eventName, listener)`：订阅事件，并返回取消订阅函数。
- `off(eventName, listener)`：移除事件监听；需要传入同一个 listener 引用。
- `once(eventName, listener)`：订阅一次性事件，并返回取消订阅函数。
- `emit(eventName, payload)`：同步触发事件，listener 抛错会向外抛出。
- `safeEmit(eventName, payload)`：触发事件并收集 listener 抛出的错误，不中断后续 listener。
- `clear(eventName?)`：清空某个事件或全部事件。
- `listenerCount(eventName)`：获取事件监听数量。
- `createListenerHelper<T>()`：创建 listener helper，让单独声明的 listener 保留 payload 类型。
