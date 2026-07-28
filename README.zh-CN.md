# toolsx

[English](README.md) | 简体中文

`toolsx` 是一个面向现代 Web 应用、SDK 与 Node.js 服务的轻量、类型安全 TypeScript 工具库。

项目提供两个职责清晰的入口：

- `toolsx/utils`：不依赖具体运行环境的数组、对象、字符串、数字、JSON、异步、函数与类型判断工具。
- `toolsx/shared`：面向应用环境的 request、Cookie、带过期能力的 Storage 与类型安全 EventEmitter。

## 环境要求

- 在 Node.js 中使用时需要 Node.js 20 或更高版本。
- 需要支持 ESM 的运行环境或构建工具。
- 只有实际使用浏览器相关能力时才需要对应的浏览器 API。

## 安装

```bash
pnpm add toolsx
```

```bash
npm install toolsx
```

```bash
yarn add toolsx
```

## 导入

```ts
import { debounce, deepMerge, retry, unique } from 'toolsx/utils'
import { Cookie, EventEmitter, StorageWithExpiration, createRequestClient } from 'toolsx/shared'
```

包不提供根级 `toolsx` 运行时入口。请从 `toolsx/utils` 或 `toolsx/shared` 导入，使运行环境边界保持明确。

## 快速开始

```ts
import { createRequestClient } from 'toolsx/shared'
import { chunk, isDefined, unique } from 'toolsx/utils'

const ids = unique([1, 1, 2, 3])
const pages = chunk(ids, 2)
const values = [1, null, 2, undefined].filter(isDefined)

const request = createRequestClient({ baseURL: '/api' })
const result = await request.get<{ name: string }>('/profile')

if (result.error) {
  console.error(result.error.message)
} else {
  console.log(result.response.name, pages, values)
}
```

# 通用工具

本节所有 API 均从 `toolsx/utils` 导出。

## 类型判断

| API                     | 行为                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `isNumber(value)`       | 判断 `typeof value === 'number'`，因此 `NaN` 也会通过。                            |
| `isFiniteNumber(value)` | 判断值是否为有限数字。                                                             |
| `isString(value)`       | 判断值是否为字符串。                                                               |
| `isBoolean(value)`      | 判断值是否为布尔值。                                                               |
| `isFunction(value)`     | 判断值是否为函数，并收窄可调用类型。                                               |
| `isObject(value)`       | 判断值是否为非 `null` 对象，数组也会通过。                                         |
| `isPlainObject(value)`  | 判断对象标签是否为 `[object Object]`。                                             |
| `isNil(value)`          | 判断值是否为 `null` 或 `undefined`。                                               |
| `isDefined(value)`      | 排除 `null` 与 `undefined`，适合配合数组过滤。                                     |
| `isEmpty(value)`        | nil、空字符串、空数组、空 Map、空 Set、空普通对象返回 `true`，其他值返回 `false`。 |

```ts
import { isDefined, isFiniteNumber } from 'toolsx/utils'

const numbers = [1, null, 2, undefined].filter(isDefined)
isFiniteNumber(Number.NaN) // false
```

## 数组工具

| API                                      | 行为                                                  |
| ---------------------------------------- | ----------------------------------------------------- |
| `toArray(value)`                         | nil 返回 `[]`；数组原样返回；单值包装为数组。         |
| `unique(array)`                          | 基于 `Set` 去重，并保留第一次出现的顺序。             |
| `uniqueBy(array, getKey)`                | 根据计算得到的 key 去重，并保留第一次出现的顺序。     |
| `compact(array)`                         | 移除 JavaScript 假值。                                |
| `flatten(array, depth = Infinity)`       | 将嵌套数组递归展开到指定深度。                        |
| `intersection(...arrays)`                | 返回存在于所有输入数组中的唯一值。                    |
| `difference(array, values)`              | 返回不在 `values` 中的值。                            |
| `partition(array, predicate)`            | 返回 `[匹配项, 未匹配项]`，支持类型守卫 predicate。   |
| `chunk(array, size)`                     | 按大小拆分数组；`size <= 0` 时返回 `[]`。             |
| `first(array)`                           | 返回第一项；空数组返回 `undefined`。                  |
| `last(array)`                            | 返回最后一项；空数组返回 `undefined`。                |
| `take(array, count = 1)`                 | 返回前 `count` 项。                                   |
| `drop(array, count = 1)`                 | 排除前 `count` 项。                                   |
| `takeRight(array, count = 1)`            | 返回后 `count` 项。                                   |
| `dropRight(array, count = 1)`            | 排除后 `count` 项。                                   |
| `range(start?, end, step?)`              | 生成不包含终点的数字序列；支持 `range(end)`。         |
| `zip(...arrays)`                         | 按索引组合数组，较短数组的缺失位置使用 `undefined`。  |
| `groupBy(array, getKey)`                 | 分组为 `Record<Key, Item[]>`。                        |
| `keyBy(array, getKey)`                   | 索引为 `Record<Key, Item>`；重复 key 使用后一项覆盖。 |
| `sortBy(array, getValue, order = 'asc')` | 根据字符串、数字或 Date key 返回排序后的新数组。      |
| `shuffle(array, random = Math.random)`   | 使用 Fisher-Yates 算法返回打乱后的新数组。            |
| `sample(array, random = Math.random)`    | 随机返回一项；空数组返回 `undefined`。                |

```ts
import { flatten, groupBy, intersection, keyBy, partition } from 'toolsx/utils'

const nested = flatten([1, [2, [3]]])
const shared = intersection([1, 2, 3], [2, 3, 4])
const [enabled, disabled] = partition(users, (user) => user.enabled)
const grouped = groupBy(users, (user) => user.role)
const usersById = keyBy(users, (user) => user.id)
```

## 对象工具

| API                                | 行为                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `pick(object, keys)`               | 创建只包含指定字段的对象。                                                     |
| `omit(object, keys)`               | 创建排除指定字段的浅拷贝。                                                     |
| `defaults(object, values)`         | 仅使用默认值补充值为 `undefined` 的字段。                                      |
| `compactObject(object)`            | 创建移除值为 `undefined` 的浅拷贝。                                            |
| `deepMerge(target, source)`        | 递归合并普通对象，非普通对象值直接替换。                                       |
| `get(object, path, defaultValue?)` | 使用点路径或 `PropertyKey[]` 路径读取值。                                      |
| `has(object, path)`                | 判断路径是否存在，即使路径值为 `undefined` 也能正确判断。                      |
| `set(object, path, value)`         | 修改原对象，并自动创建缺失的普通对象路径。                                     |
| `unset(object, path)`              | 删除路径，返回 `Reflect.deleteProperty` 的结果。                               |
| `mapValues(object, transform)`     | 保留 key，对每个自有属性的值进行转换。                                         |
| `mapKeys(object, transform)`       | 保留值，对每个自有属性的 key 进行转换。                                        |
| `invert(object)`                   | 交换对象的 key 与值；重复值由后出现的 key 覆盖。                               |
| `deepFreeze(value)`                | 递归冻结对象属性，并返回深只读类型。                                           |
| `deepEqual(left, right)`           | 深比较对象、数组、Date、RegExp、Map、Set、TypedArray 视图、Symbol 与循环引用。 |
| `clone(value)`                     | 优先使用 `structuredClone`，不可用时降级为 JSON 克隆。                         |

`deepMerge`、`get`、`has`、`set`、`unset` 会拒绝 `__proto__`、`constructor`、`prototype` 路径片段，避免访问或写入原型污染路径。

```ts
import { deepMerge, get, has, set, unset } from 'toolsx/utils'

const settings = deepMerge({ theme: { color: 'red' } }, { theme: { size: 12 } })

set(settings, 'theme.color', 'blue')
get<string>(settings, 'theme.color') // blue
has(settings, 'theme.size') // true
unset(settings, 'theme.size')
```

## 数字工具

| API                             | 行为                                                 |
| ------------------------------- | ---------------------------------------------------- |
| `clamp(value, min, max)`        | 把数字限制在包含边界的区间内。                       |
| `randomInt(min, max, random?)`  | 在取整后的包含边界区间中生成随机整数，可注入随机源。 |
| `sum(values)`                   | 计算数字数组总和；空数组返回 `0`。                   |
| `average(values)`               | 计算数字数组平均值；空数组返回 `NaN`。               |
| `roundTo(value, precision = 0)` | 按指定十进制精度四舍五入。                           |

## 字符串工具

| API                                                                  | 行为                                           |
| -------------------------------------------------------------------- | ---------------------------------------------- |
| `capitalize(value)`                                                  | 将第一个字符转为大写。                         |
| `camelCase(value)`                                                   | 转换为 `camelCase`。                           |
| `pascalCase(value)`                                                  | 转换为 `PascalCase`。                          |
| `kebabCase(value)`                                                   | 转换为 `kebab-case`。                          |
| `snakeCase(value)`                                                   | 转换为 `snake_case`。                          |
| `trim(value, chars?)`                                                | 移除两端空白或指定字符集合。                   |
| `truncate(value, length, omission = '…')`                            | 按 Unicode code point 截断并追加省略标记。     |
| `escapeHtml(value)`                                                  | 转义 `&`、`<`、`>`、`"`、`'`。                 |
| `escapeRegExp(value)`                                                | 转义正则表达式特殊字符。                       |
| `mask(value, visibleStart = 0, visibleEnd = 4, maskCharacter = '*')` | 遮罩中间的 Unicode 字符。                      |
| `randomString(length, alphabet?, random?)`                           | 生成随机字符串，默认字符集为大小写字母和数字。 |

```ts
import { escapeHtml, mask, pascalCase, truncate } from 'toolsx/utils'

pascalCase('user-profile') // UserProfile
truncate('这是一个很长的标题', 6) // 这是一个很…
mask('13800138000', 3, 4) // 138****8000
escapeHtml('<script>') // &lt;script&gt;
```

## JSON 工具

| API                                       | 行为                                        |
| ----------------------------------------- | ------------------------------------------- |
| `safeJsonParse(value, fallback?)`         | JSON 解析失败时返回 fallback，不抛异常。    |
| `safeJsonStringify(value, fallback = '')` | JSON 序列化抛错时返回 fallback。            |
| `stableJsonStringify(value)`              | 按稳定对象 key 顺序序列化；循环引用会抛错。 |

## 异步与函数工具

| API                                                 | 行为                                                |
| --------------------------------------------------- | --------------------------------------------------- |
| `noop()`                                            | 空函数，可作为默认回调。                            |
| `identity(value)`                                   | 原样返回输入值。                                    |
| `constant(value)`                                   | 创建始终返回指定值的函数。                          |
| `once(fn)`                                          | 创建最多执行一次并缓存结果或同步错误的函数。        |
| `pipe(...functions)`                                | 从左到右组合一元函数。                              |
| `compose(...functions)`                             | 从右到左组合一元函数。                              |
| `sleep(ms, signal?)`                                | 至少等待指定毫秒；Signal 中断时 reject。            |
| `tryCatch(promise)`                                 | 将 Promise 转成 `[data, null]` 或 `[null, error]`。 |
| `retry(fn, options?)`                               | 支持延时、退避、抖动、过滤与取消的异步重试。        |
| `retry(fn, times, delay)`                           | 兼容调用；`times` 表示总尝试次数。                  |
| `timeout(promise, ms, message?)`                    | 超时后 reject，但不会取消原 Promise。               |
| `withResolvers<T>()`                                | 返回 `{ promise, resolve, reject }`。               |
| `raceWithSignal(promise, signal?)`                  | 让 Promise 响应外部 Signal，但不取消底层操作。      |
| `createAbortGroup(...signals)`                      | 创建可追加外部 Signal 的共享取消组。                |
| `createLimiter(concurrency)`                        | 创建可复用的并发限制器。                            |
| `poll(fn, options)`                                 | 按条件轮询，支持间隔、次数、超时与取消。            |
| `mapAsync(items, mapper, options?)`                 | 有限并发异步映射并保持顺序。                        |
| `filterAsync(items, predicate, options?)`           | 有限并发异步过滤并保持顺序。                        |
| `debounce(fn, wait, options?)`                      | 创建带控制方法的防抖函数。                          |
| `throttle(fn, wait, options?)`                      | 创建带控制方法的节流函数。                          |
| `promisePool(items, worker, concurrency, options?)` | 以有限并发处理任务并保持结果顺序。                  |
| `memoize(fn, options?)`                             | 缓存同步函数结果。                                  |
| `memoizeAsync(fn, options?)`                        | 缓存进行中或已完成的 Promise，支持 TTL。            |

### retry 配置

| 配置          | 默认值         | 说明                                  |
| ------------- | -------------- | ------------------------------------- |
| `retries`     | `2`            | 第一次尝试后的重试次数。              |
| `delay`       | `0`            | 基础延时，或接收错误与上下文的函数。  |
| `factor`      | `1`            | 数字延时的指数倍率。                  |
| `maxDelay`    | `Infinity`     | 最大计算延时。                        |
| `jitter`      | `false`        | 随机化延时，或通过自定义函数计算。    |
| `random`      | `Math.random`  | `jitter: true` 时使用的可注入随机源。 |
| `shouldRetry` | 重试至次数耗尽 | 支持异步的重试判断。                  |
| `signal`      | —              | 取消等待和后续尝试。                  |

```ts
import { retry } from 'toolsx/utils'

const data = await retry(({ attempt, signal }) => loadPage({ attempt, signal }), {
  retries: 3,
  delay: 200,
  factor: 2,
  maxDelay: 3_000,
  jitter: true,
  shouldRetry: (error) => isTemporaryError(error)
})
```

### 防抖与节流控制

返回函数都提供：

- `cancel()`：取消待执行调用。
- `flush()`：立即执行待处理的 trailing 调用并返回结果。
- `pending()`：判断是否存在活动计时器。

`debounce` 默认 `{ leading: false, trailing: true }`，额外支持 `maxWait`。`throttle` 默认 `{ leading: true, trailing: true }`。

### 并发任务池

```ts
import { promisePool } from 'toolsx/utils'

const users = await promisePool(ids, (id, index, signal) => loadUser(id, { index, signal }), 4, {
  signal: abortController.signal
})
```

结果顺序与输入顺序一致。任意 worker 失败或 Signal 中断时任务池 reject；已经执行中的任务只有在 worker 使用传入 Signal 时才会主动停止。

### 并发限制、轮询与取消组

```ts
import { createAbortGroup, createLimiter, poll } from 'toolsx/utils'

const group = createAbortGroup(externalSignal)
const limit = createLimiter(3)

const values = await Promise.all(tasks.map((task) => limit(task, group.signal)))
const ready = await poll(checkReady, {
  interval: 200,
  maxAttempts: 10,
  signal: group.signal,
  until: (value) => value === true
})
```

`createLimiter` 返回的函数提供只读 `activeCount`、`pendingCount` 和 `clearQueue(reason?)`。取消排队任务不会自动停止已经运行且忽略 Signal 的任务。

### 函数缓存

```ts
import { memoize, memoizeAsync } from 'toolsx/utils'

const formatUser = memoize(format, {
  resolver: (user, locale) => `${user.id}:${locale}`
})

const loadUserOnce = memoizeAsync(loadUser, {
  ttl: 30_000,
  cacheRejected: false
})

formatUser.cache
formatUser.delete('1:zh-CN')
formatUser.clear()
```

默认缓存 key 是第一个参数，多参数函数应传 `resolver`。异步缓存默认会删除 reject 的 Promise。

## 导出的工具类型

`toolsx/utils` 同时导出 `AnyFunction`、`RandomSource`、`Unary`、`Falsy`、`NestedArray`、`CompactObject`、`DeepReadonly`、`OnceFunction`、`Awaitable`、`AbortGroup`、`ConcurrencyLimiter`、`AsyncCollectionOptions`、`PollContext`、`PollOptions`、`DebounceOptions`、`ThrottleOptions`、`ControlledFunction`、`DebouncedFunction`、`ThrottledFunction`、`RetryContext`、`RetryOptions`、`PromisePoolOptions`、`MemoizedFunction`、`MemoizeOptions`、`MemoizeAsyncOptions`、`MemoizeAsyncCacheEntry`、`MemoizedAsyncFunction`。

# 请求客户端

所有 request API 均从 `toolsx/shared` 导出。

客户端基于 `ofetch`，在其基础上提供结构化结果、鉴权、重试、缓存、在途去重、中间件、并发限制、进度、中断与追踪能力。

## 基础用法

```ts
import { createRequestClient, unwrapRequestResult } from 'toolsx/shared'

const request = createRequestClient({
  baseURL: 'https://api.example.com',
  getToken: () => localStorage.getItem('access_token')
})

const result = await request.get<{ id: string; name: string }>('/profile')

if (result.error) {
  console.error(result.status, result.error.message)
} else {
  console.log(result.response.name, result.meta.duration)
}

const profile = await unwrapRequestResult(request.get<{ id: string; name: string }>('/profile'))
```

## 返回值模型

默认调用不会因为请求失败而抛异常，而是 resolve 结构化结果：

```ts
type RequestResult<T> =
  | {
      response: T
      error: null
      headers: Headers
      status?: number
      meta: RequestMeta
    }
  | {
      response: null
      error: RequestError
      headers: Headers | null
      status?: number
      meta: RequestMeta
    }
```

`RequestMeta` 字段：

| 字段        | 说明                             |
| ----------- | -------------------------------- |
| `requestId` | 自动生成或调用方提供的请求 ID。  |
| `url`       | 请求 URL 字符串。                |
| `method`    | 标准化后的 HTTP 方法。           |
| `timestamp` | 请求开始的毫秒时间戳。           |
| `duration`  | 调用方观察到的总耗时。           |
| `attempts`  | 网络尝试次数；缓存命中时为 `0`。 |
| `fromCache` | 是否命中响应缓存。               |
| `deduped`   | 是否加入了已存在的在途请求。     |

需要异常式流程时使用 `unwrapRequestResult`。

`RequestError<T>` 继承自 `Error`，并提供可选的 `status`、响应 `data`、`aborted`、请求 `meta` 与 `cause`。`normalizeRequestError` 会保留已有的 `RequestError`，并标准化 Fetch、超时、中断、原生 Error 与未知错误。

## 客户端默认行为

| 行为           | 默认值                                 |
| -------------- | -------------------------------------- |
| 超时           | `15_000` 毫秒                          |
| Header         | `Accept: application/json`             |
| 请求 ID Header | `x-request-id`                         |
| 在途去重       | GET、HEAD 启用                         |
| 响应缓存       | 默认关闭，需显式配置                   |
| 重试次数       | 第一次尝试后重试 2 次                  |
| 重试延时       | 250ms、factor 2、最大 3 秒、随机抖动   |
| 重试方法       | GET、HEAD、OPTIONS                     |
| 重试状态码     | 408、409、425、429、500、502、503、504 |

## 客户端配置

`createRequestClient(options)` 支持 `ofetch` 配置，并增加：

| 配置                 | 说明                                                                        |
| -------------------- | --------------------------------------------------------------------------- |
| `headers`            | 默认 Header，与单次请求 Header 合并。                                       |
| `auth`               | `{ header?, type? }` 或 `false`；默认生成 `Authorization: Bearer <token>`。 |
| `getToken`           | 同步或异步 Token 获取函数。                                                 |
| `refreshToken`       | 刷新失效 Token；并发刷新共享同一个 Promise。                                |
| `shouldRefreshToken` | 自定义刷新判断，支持异步；默认判断状态码 `401`。                            |
| `retryPolicy`        | 重试配置或 `false`。                                                        |
| `responseCache`      | 响应缓存配置或 `false`，支持自定义同步缓存适配器。                          |
| `dedupe`             | 是否启用安全方法的在途去重。                                                |
| `concurrency`        | 最大并发网络执行数，必须大于 0。                                            |
| `middlewares`        | 初始中间件列表。                                                            |
| `requestIdHeader`    | 请求 ID Header 名；传 `false` 关闭注入。                                    |
| `fetch`              | 面向其他运行环境或适配器的自定义 Fetch 实现。                               |
| `onRequest`          | 请求前 Hook，可返回修改后的 Fetch 配置。                                    |
| `onResponse`         | 观察成功网络响应；Hook 异常会被忽略。                                       |
| `onError`            | 观察最终结构化失败；Hook 异常会被忽略。                                     |
| `onTrace`            | 观察最终耗时与状态信息；Hook 异常会被忽略。                                 |

```ts
const request = createRequestClient({
  baseURL: '/api',
  timeout: 10_000,
  concurrency: 6,
  headers: { 'x-client': 'web' },
  getToken: () => tokenStore.accessToken,
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
  onTrace: (trace) => console.log(trace.requestId, trace.duration)
})
```

## 单次请求配置

普通请求支持 `ofetch` 配置，并增加：

| 配置                               | 说明                                                       |
| ---------------------------------- | ---------------------------------------------------------- |
| `transform(data)`                  | 同步或异步转换成功响应。                                   |
| `validateResponse(data, response)` | 返回 `false`、错误消息或 `RequestError` 时生成结构化失败。 |
| `retryPolicy`                      | 覆盖或关闭客户端重试。                                     |
| `responseCache`                    | 为单次请求启用、配置或关闭缓存。                           |
| `cacheKey`                         | 显式响应缓存 key。                                         |
| `dedupe`                           | 覆盖在途去重设置。                                         |
| `dedupeKey`                        | 显式在途去重 key。                                         |
| `skipAuthRefresh`                  | 禁止该请求刷新 Token。                                     |
| `onUploadProgress`                 | 上传进度回调。                                             |
| `onDownloadProgress`               | 流式下载进度回调。                                         |

```ts
type ApiEnvelope<T> = { code: number; data: T; message: string }
type User = { id: string; name: string }

const result = await request.get<ApiEnvelope<User>, 'json', User>('/profile', {
  validateResponse: (body) => body.code === 0 || body.message,
  transform: (body) => body.data
})
```

## 实例方法

- 可调用实例：`request(url, options)`
- 方法快捷调用：`request.get/post/put/patch/delete/head/options`
- 原始响应：`request.raw(url, options)`
- 可中断调用：`request.withAbort(url, options)`
- 可中断快捷调用：`request.abortable.get/post/put/patch/delete/head/options`
- 注册中间件：`request.use(middleware)`
- 缓存失效：`request.invalidateCache(url, options)`
- 缓存控制器：`request.cache`
- 中断辅助：`request.createAbortController()`、`request.isAbortError(error)`

`request.raw` 在 `RequestResult` 内返回 `FetchResponse`。它仍会应用默认 Header、鉴权、并发限制、进度、请求/响应/错误 Hook 与追踪，但不会应用普通请求的转换、业务校验、包装层重试、响应缓存、在途去重和中间件。

## Token 刷新

配置 `refreshToken` 后，最终 `401` 默认触发一次刷新，除非 `shouldRefreshToken` 返回否定结果。同一 Token 并发失败时共享刷新 Promise；刷新后会清空响应缓存。

刷新函数应更新 `getToken` 使用的 Token 来源，或直接返回新 Token。

## 请求重试

`RequestRetryOptions`：

| 配置          | 说明                                                 |
| ------------- | ---------------------------------------------------- |
| `retries`     | 第一次尝试后的重试次数。                             |
| `delay`       | 基础延时或接收 `RequestRetryContext` 的函数。        |
| `factor`      | 数字延时的指数倍率。                                 |
| `maxDelay`    | 最大延时。                                           |
| `jitter`      | 布尔随机抖动或自定义函数。                           |
| `random`      | `jitter: true` 时使用的可注入随机源。                |
| `methods`     | 允许重试的 HTTP 方法。                               |
| `statusCodes` | 允许重试的失败状态码；无状态码的网络错误可参与重试。 |
| `shouldRetry` | 支持异步的最终判断。                                 |
| `onRetry`     | 接收最终延时的观察回调。                             |

中断错误不会重试。

## 在途去重与缓存

在途去重会让相同 key 的 GET/HEAD 调用共享正在执行的 Promise。缓存需要显式开启，只缓存成功且已经 transform 的结果。默认使用当前 request 实例内存，也可以配置自定义同步缓存适配器。

默认 key 包含 method、baseURL、URL、query、body 和鉴权 Token 的哈希。业务需要自定义身份时使用 `cacheKey` 或 `dedupeKey`。

`ResponseCacheOptions`：

| 配置                   | 默认值     | 说明                                    |
| ---------------------- | ---------- | --------------------------------------- |
| `ttl`                  | `30_000`   | 缓存有效毫秒数。                        |
| `methods`              | `['GET']`  | 可缓存的方法。                          |
| `invalidateOnMutation` | `true`     | POST/PUT/PATCH/DELETE 成功后清空缓存。  |
| `adapter`              | 内存适配器 | 实现 `RequestCacheAdapter` 的同步缓存。 |

缓存控制器：

- `request.cache.clear()`
- `request.cache.delete(key)`
- `request.cache.has(key)`
- `request.cache.keys()`
- `request.cache.size`
- `await request.invalidateCache(url, options)`

```ts
import { createMemoryRequestCache, createRequestClient } from 'toolsx/shared'

const cache = createMemoryRequestCache()
const request = createRequestClient({ responseCache: { adapter: cache, ttl: 30_000 } })
```

默认缓存不是浏览器 HTTP Cache，也不会跨进程或 request 实例共享。自定义适配器必须同步实现 `get`、`set`、`delete`、`clear`、`has`、`keys` 和 `size`；`request.cache` 控制客户端配置的主适配器。

## 中间件

```ts
const remove = request.use(async (context, next) => {
  context.options.headers = {
    ...context.options.headers,
    'x-feature': 'profile'
  }

  const result = await next()
  return result
})

remove()
```

中间件包裹重试执行，可以修改 `context.options`，也可以不调用 `next` 而直接返回结果。同一个中间件多次调用 `next` 会转为结构化请求失败。

## 进度与中断

```ts
const upload = request.abortable.post('/files', {
  body: file,
  onUploadProgress: ({ loaded, total, percent, done }) => {},
  onDownloadProgress: ({ loaded, total, percent, done }) => {}
})

upload.abort('user cancelled')
const result = await upload.promise
```

`RequestProgress` 包含 `phase`、`loaded`、可选的 `total`/`percent` 和 `done`。

不同运行环境中的 Fetch API 无法统一提供逐字节上传进度，因此上传回调至少会报告开始和完成；下载回调会在消费响应流时报告字节进度。

## Request 工具函数

| API                                       | 行为                                           |
| ----------------------------------------- | ---------------------------------------------- |
| `mergeHeaders(source, extra)`             | 创建合并后的 Headers，`extra` 优先。           |
| `omitHeaders(source, names)`              | 创建移除指定 Header 后的副本。                 |
| `headersToObject(headers)`                | 转换为 `Record<string, string>`。              |
| `getHeader(headers, name)`                | 不区分大小写地安全读取 Header。                |
| `createAuthorizationHeader(token, auth?)` | 创建鉴权 Header，或返回 `undefined`。          |
| `createQueryString(params)`               | 序列化基本值、Date 和数组，忽略 nil。          |
| `appendQuery(url, params)`                | 在 URL hash 前追加 query。                     |
| `mergeSignals(...signals)`                | 任意输入中断时中断的合并 Signal。              |
| `createTimeoutSignal(timeout, reason?)`   | 创建超时 Signal；非正数返回 `undefined`。      |
| `createRequestId(prefix?, random?)`       | 创建带时间与随机部分的请求 ID，可注入随机源。  |
| `createMemoryRequestCache(entries?)`      | 创建符合 `RequestCacheAdapter` 的内存缓存。    |
| `isRequestSuccess(result)`                | 成功结果类型守卫。                             |
| `isRequestFailure(result)`                | 失败结果类型守卫。                             |
| `mapRequestResult(result, transform)`     | 只转换成功 response。                          |
| `unwrapRequestResult(result)`             | 返回 response 或抛出 `RequestError`。          |
| `normalizeRequestError(error)`            | 把未知、Fetch、中断错误转换为 `RequestError`。 |
| `isRequestError(error)`                   | `RequestError` 类型守卫。                      |

## 导出的 Request 类型

request 入口同时导出 `FetchOptions`、`FetchRequest`、`FetchResponse`、`MappedResponseType`、`ResponseType`、`RequestMethod`、`TokenValue`、`TokenGetter`、`RequestProgressPhase`、`RequestProgress`、`RequestProgressHandler`、`RequestRetryContext`、`RequestRetryOptions`、`ResponseCacheOptions`、`RequestCacheEntry`、`RequestCacheAdapter`、`RequestOptions`、`RawRequestOptions`、`RequestMeta`、`RequestErrorOptions`、`RequestSuccess`、`RequestFailure`、`RequestResult`、各类 Hook Context、`RequestAuthOptions`、`TokenRefreshContext`、`RequestTrace`、中间件类型、`CreateRequestOptions`、`AbortableRequest`、快捷调用类型、`RequestCacheController`、`RequestInstance`、`QueryValue`、`QueryParams`。

# Cookie

`Cookie` 提供自动编码的浏览器 Cookie 读写、JSON 辅助方法、默认配置、服务端适配器与非浏览器安全降级。

```ts
import { Cookie, parseCookieHeader, serializeCookie } from 'toolsx/shared'

const cookie = new Cookie({ sameSite: 'Lax', secure: true })

cookie.setJSON('profile', { id: 1, name: 'Tom' }, { maxAge: 30 * 60 })
const profile = cookie.getJSON<{ id: number; name: string }>('profile')

cookie.has('profile')
cookie.getAll()
cookie.remove('profile')
cookie.clear()

parseCookieHeader('token=abc; theme=dark')
serializeCookie('token', 'abc', { path: '/', sameSite: 'Lax' })
```

## 构造函数与适配器

```ts
const cookie = new Cookie(defaultOptions?, adapter?)
```

`CookieAdapter` 包含 `read(): string` 和 `write(serializedCookie): void`。不传适配器时，会在可用环境中读写 `document.cookie`。

SSR/Node.js 环境没有 `document` 时，`isAvailable()` 返回 `false`，写入方法返回 `false`，读取返回空对象或 `null`。

## Cookie 配置

| 配置          | 说明                                     |
| ------------- | ---------------------------------------- |
| `expires`     | Date 或绝对毫秒时间戳；非法日期会抛错。  |
| `maxAge`      | 有效秒数。                               |
| `path`        | 默认 `/`。                               |
| `domain`      | Cookie domain。                          |
| `sameSite`    | `'Strict'`、`'Lax'` 或 `'None'`。        |
| `secure`      | 添加 `Secure` 属性。                     |
| `httpOnly`    | 添加 `HttpOnly` 属性，用于服务端序列化。 |
| `partitioned` | 添加 `Partitioned` 属性。                |
| `priority`    | 添加 `'Low'`、`'Medium'` 或 `'High'`。   |
| `onSuccess`   | 适配器写入成功后调用。                   |

## Cookie 方法

| API                                      | 行为                                                 |
| ---------------------------------------- | ---------------------------------------------------- |
| `set(name, value, options?)`             | 编码并写入，返回环境可用/写入成功状态。              |
| `setJSON(name, value, options?)`         | JSON 序列化并写入；无法序列化的 `undefined` 会抛错。 |
| `get(name)`                              | 返回解码值或 `null`。                                |
| `getJSON(name, fallback?)`               | 解析 JSON，失败时返回 fallback 或 `null`。           |
| `getAll()`                               | 以对象返回所有可见的解码 Cookie。                    |
| `has(name)`                              | 判断 Cookie 是否存在。                               |
| `remove(name, options?)`                 | 使用匹配的 path/domain 让 Cookie 过期。              |
| `clear(options?)`                        | 删除所有当前可见 Cookie，并返回数量。                |
| `isAvailable()`                          | 判断适配器或浏览器 Cookie 是否可用。                 |
| `parseCookieHeader(header)`              | 解析 Cookie Header 或 `document.cookie` 字符串。     |
| `serializeCookie(name, value, options?)` | 生成 Set-Cookie/document-cookie 写入字符串。         |

浏览器 JavaScript 无法创建 `HttpOnly` Cookie；敏感 HttpOnly Cookie 必须由服务端设置。

导出的 Cookie 类型：`CookieSameSite`、`CookiePriority`、`CookieOptions`、`CookieAdapter`。

# 带过期能力的 Storage

`StorageWithExpiration` 为任何兼容 Web Storage 的对象增加序列化、TTL、滑动过期、命名空间、数据迁移、降级存储与变更通知。

```ts
import { StorageWithExpiration, createMemoryStorage, isStorageAvailable } from 'toolsx/shared'

const source = isStorageAvailable(localStorage) ? localStorage : createMemoryStorage()
const storage = new StorageWithExpiration(source, {
  namespace: 'my-app',
  validateKey: false,
  version: 2,
  slidingExpiration: 30 * 60_000,
  sync: true,
  migrate: (value, { fromVersion }) => (fromVersion === 1 ? migrateProfile(value) : value)
})

storage.setItem('user-profile', { name: 'Tom' }, { ttl: 60_000 })
const profile = storage.getValue<{ name: string }>('user-profile')
const settings = storage.getOrSet('settings', () => ({ theme: 'light' }))
```

## Storage 配置

| 配置                 | 默认值              | 说明                                                              |
| -------------------- | ------------------- | ----------------------------------------------------------------- |
| `namespace`          | —                   | 为物理 key 添加前缀，并限定 `clear()` 范围。                      |
| `version`            | `1`                 | 当前数据结构版本。                                                |
| `migrate`            | —                   | 从旧版本同步迁移 value。                                          |
| `slidingExpiration`  | —                   | 实例级滑动过期毫秒数。                                            |
| `fallbackStorage`    | 内存 Storage        | 主存储写入失败时使用；`false` 关闭。                              |
| `validateKey`        | 英文字母/下划线规则 | 可传 `false`、RegExp 或函数自定义。                               |
| `serialize`          | `JSON.stringify`    | 自定义数据序列化。                                                |
| `deserialize`        | `JSON.parse`        | 自定义数据反序列化。                                              |
| `parseErrorStrategy` | `'remove'`          | 非法数据使用 `'remove'` 或 `'keep'`。                             |
| `onParseError`       | —                   | 接收错误、逻辑 key、原始字符串。                                  |
| `onQuotaError`       | —                   | 接收主存储写入错误和逻辑 key。                                    |
| `sync`               | `false`             | 启用 BroadcastChannel 或浏览器 storage 事件通知，也可传同步配置。 |

`StorageSyncOptions` 支持 `channelName` 与 `broadcast: false`。

## 写入配置

| 配置                | 说明                             |
| ------------------- | -------------------------------- |
| `expiresAt`         | 绝对 Date、毫秒时间戳或 `null`。 |
| `ttl`               | 相对有效毫秒数。                 |
| `slidingExpiration` | 单条数据滑动有效毫秒数。         |

显式非空 `expiresAt` 决定初始过期时间；否则依次使用 `ttl`、滑动过期时长。

## 读取结果

`getItem<T>(key)` 返回可判别联合：

- 有效：`{ found: true, expired: false, value, expiresAt, version }`
- 已过期：`{ found: true, expired: true, value, expiresAt, version }`
- 不存在/非法：`{ found: false, expired: false, value: null, expiresAt: null, version: null }`

过期数据会被删除；读取有效的滑动过期数据时会自动续期。

## Storage 方法

| API                                    | 行为                                                      |
| -------------------------------------- | --------------------------------------------------------- |
| `setItem(key, value, options?)`        | 序列化并写入带版本信息的数据。                            |
| `getItem<T>(key)`                      | 返回完整存在/过期状态。                                   |
| `getValue<T>(key)`                     | 只返回有效 value，否则返回 `null`。                       |
| `getOrSet(key, createValue, options?)` | 读取有效值，或同步创建并写入新值。                        |
| `has(key)`                             | 判断是否存在有效且未过期的数据。                          |
| `keys()`                               | 合并主存储和降级存储的逻辑 key。                          |
| `entries<T>()`                         | 返回所有有效数据的 `[key, value]`。                       |
| `values<T>()`                          | 返回所有有效 value。                                      |
| `updateItem(key, updater, options?)`   | 更新已有有效数据；缺失时返回 `null`。                     |
| `purgeExpired()`                       | 清理全部过期数据并返回数量。                              |
| `removeItem(key)`                      | 同时从主存储和降级存储删除。                              |
| `clear()`                              | 有 namespace 时只清理当前 namespace，否则清空包装的存储。 |
| `subscribe(listener)`                  | 订阅本地/外部 `set`、`remove`、`clear` 变更。             |
| `destroy()`                            | 关闭同步资源并清空监听。                                  |
| `createMemoryStorage()`                | 创建兼容标准 Storage 的内存实现。                         |
| `isStorageAvailable(storage)`          | 通过临时写入/删除检查可用性。                             |

`StorageChange` 包含 `type`、可选 `key`/`value`，以及 `source: 'local' | 'external'`。

导出的 Storage 类型：`StorageExpiration`、`StorageParseErrorStrategy`、`StorageChangeType`、`StorageMigrationContext`、`StorageSyncOptions`、`StorageWithExpirationOptions`、`StorageItem`、`StorageSetOptions`、`StorageGetResult`、`StorageChange`。

## 异步 Storage 适配器

`AsyncStorageWithExpiration` 面向 IndexedDB、远程 KV 或其他 Promise 存储。它不会改变同步 `StorageWithExpiration` 的方法签名。

```ts
import { AsyncStorageWithExpiration, createAsyncStorageAdapter } from 'toolsx/shared'

const storage = new AsyncStorageWithExpiration(createAsyncStorageAdapter(localStorage), {
  namespace: 'app',
  validateKey: false
})

const value = await storage.getOrSet('settings', async () => loadDefaults(), { ttl: 60_000 })
await storage.updateItem('settings', async (current) => ({ ...current, ready: true }))
```

`AsyncStorageAdapter` 必须实现异步兼容的 `getItem`、`setItem`、`removeItem`；`keys` 与 `clear` 可选。命名空间清理、遍历和过期批量清理需要适配器提供 `keys()`。`createAsyncStorageAdapter(storage)` 可把同步 Web Storage 转成异步适配器。

异步实例提供 `setItem`、`getItem`、`getValue`、`getOrSet`、`has`、`keys`、`entries`、`values`、`updateItem`、`purgeExpired`、`removeItem` 和 `clear`。并发调用相同 key 的 `getOrSet` 会共享创建 Promise。

导出的异步 Storage 类型：`AsyncStorageValue`、`AsyncStorageAdapter`、`AsyncStorageWithExpirationOptions`。

# 类型安全 EventEmitter

`EventEmitter<TEvents>` 支持类型安全事件、一次性监听、优先级、通配符、任意事件监听、异步触发、安全触发、AbortSignal 清理与监听数量提示。

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
unsubscribe()
```

## Emitter 配置

| 配置                     | 默认值         | 说明                                                    |
| ------------------------ | -------------- | ------------------------------------------------------- |
| `maxListeners`           | `10`           | 每个精确事件/Pattern/Any 分组的提示阈值；`0` 关闭限制。 |
| `onMaxListenersExceeded` | `console.warn` | 自定义超限回调。                                        |

监听配置支持 `priority`（数字越大越先执行）与 `signal`（中断时自动取消订阅）。

## EventEmitter 方法

| API                                      | 行为                                                |
| ---------------------------------------- | --------------------------------------------------- |
| `on(eventName, listener, options?)`      | 添加精确事件监听，返回取消订阅函数。                |
| `off(eventName, listener)`               | 根据相同函数引用移除精确事件监听。                  |
| `once(eventName, listener, options?)`    | 第一次调用前移除监听。                              |
| `onAny(listener, options?)`              | 监听所有触发的事件。                                |
| `onPattern(pattern, listener, options?)` | 使用 `*` 通配符匹配字符串事件名。                   |
| `emit(eventName, payload?)`              | 同步调用，不等待 Promise；同步错误向外抛出。        |
| `safeEmit(eventName, payload?)`          | 收集同步错误并继续执行。                            |
| `emitAsync(eventName, payload?)`         | 按顺序等待监听器；错误导致 reject。                 |
| `emitParallel(eventName, payload?)`      | 并行启动并等待监听器；任一错误导致 reject。         |
| `safeEmitAsync(eventName, payload?)`     | 按顺序等待并收集全部错误。                          |
| `waitFor(eventName, options?)`           | 等待下一次精确事件，支持超时和 Signal。             |
| `clear(eventName?)`                      | 清空一个精确事件，或清空全部精确/Pattern/Any 监听。 |
| `listenerCount(eventName)`               | 返回某个精确事件监听数量。                          |
| `eventNames()`                           | 返回当前存在精确监听器的事件名。                    |
| `hasListeners(eventName?)`               | 判断指定精确事件或整个 emitter 是否存在监听器。     |
| `totalListenerCount()`                   | 返回精确、Pattern、Any 监听总数。                   |
| `setMaxListeners(value)`                 | 更新阈值并返回 emitter。                            |
| `createListenerHelper<TEvents>()`        | 单独声明监听函数时保留 payload 类型。               |

Promise 监听器应使用 `emitAsync`/`safeEmitAsync`；`safeEmit` 只提供即时同步错误收集。

导出的 EventEmitter 类型：`EventListener`、`Unsubscribe`、`EventListenerOptions`、`EventWaitOptions`、`EventEmitterOptions`、`EventAnyPayload`、`EventAnyListener`。

# 框架示例

- [Vue、React 与 Node.js 示例](docs/examples.md)
- [Vue, React, and Node.js examples (English)](docs/examples.en.md)

# 运行环境与安全说明

- 只有明确标记的浏览器能力依赖浏览器 API；通用工具可以直接在 Node.js 中使用。
- `structuredClone` 不可用时，`clone` 会降级为 JSON 克隆，此时无法保留 JSON 不支持的值、函数与循环引用。
- Cookie 与 Storage 工具不提供数据加密，客户端存储不能作为安全凭证保险箱。
- 浏览器敏感凭证应优先使用服务端设置的 `HttpOnly`、`Secure` 与合适的 `SameSite` Cookie。
- Request 默认使用实例内存缓存；自定义适配器的持久性由适配器实现决定，且都不是标准 HTTP Cache。
- Cookie 和 Web Storage 的可用性与容量取决于浏览器隐私策略和用户设置。

# 许可证

MIT
