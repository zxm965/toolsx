# toolsx

English | [简体中文](README.zh-CN.md)

`toolsx` is a lightweight, type-safe TypeScript utility library for modern web applications, SDKs, and Node.js services.

It provides two focused entry points:

- `toolsx/utils`: runtime-independent array, object, string, number, JSON, async, function, and type-guard utilities.
- `toolsx/shared`: request client, Cookie, expiring Storage, and typed EventEmitter utilities for application environments.

## Requirements

- Node.js 20 or newer for Node.js usage.
- An ESM-compatible bundler or runtime.
- Browser APIs are only required by the browser-specific features that use them.

## Installation

```bash
pnpm add toolsx
```

```bash
npm install toolsx
```

```bash
yarn add toolsx
```

## Imports

```ts
import { debounce, deepMerge, retry, unique } from 'toolsx/utils'
import { Cookie, EventEmitter, StorageWithExpiration, createRequestClient } from 'toolsx/shared'
```

There is no root `toolsx` runtime entry. Import from `toolsx/utils` or `toolsx/shared` so that the intended environment boundary stays explicit.

## Quick start

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

# Utilities

All utilities in this section are exported from `toolsx/utils`.

## Type guards

| API                     | Behavior                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `isNumber(value)`       | Checks `typeof value === 'number'`. `NaN` is considered a number.                                      |
| `isFiniteNumber(value)` | Checks that the value is a finite number.                                                              |
| `isString(value)`       | Checks whether the value is a string.                                                                  |
| `isBoolean(value)`      | Checks whether the value is a boolean.                                                                 |
| `isFunction(value)`     | Checks whether the value is a function and narrows its callable type.                                  |
| `isObject(value)`       | Checks for a non-`null` object. Arrays also pass.                                                      |
| `isPlainObject(value)`  | Checks for an object whose tag is `[object Object]`.                                                   |
| `isNil(value)`          | Checks for `null` or `undefined`.                                                                      |
| `isDefined(value)`      | Excludes `null` and `undefined`; useful with `Array.prototype.filter`.                                 |
| `isEmpty(value)`        | Treats nil values, empty strings/arrays/maps/sets/plain objects as empty. Other values return `false`. |

```ts
import { isDefined, isFiniteNumber } from 'toolsx/utils'

const numbers = [1, null, 2, undefined].filter(isDefined)
isFiniteNumber(Number.NaN) // false
```

## Array utilities

| API                                      | Behavior                                                                                     |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| `toArray(value)`                         | Returns `[]` for nil values, the same array for arrays, or wraps a single value in an array. |
| `unique(array)`                          | Removes duplicates with `Set`, preserving first-seen order.                                  |
| `compact(array)`                         | Removes JavaScript-falsy values.                                                             |
| `flatten(array, depth = Infinity)`       | Recursively flattens nested arrays up to `depth`.                                            |
| `intersection(...arrays)`                | Returns unique values present in every input array.                                          |
| `difference(array, values)`              | Returns values that are not present in `values`.                                             |
| `partition(array, predicate)`            | Returns `[matched, unmatched]` and supports type-guard predicates.                           |
| `chunk(array, size)`                     | Splits an array into chunks. Returns `[]` when `size <= 0`.                                  |
| `last(array)`                            | Returns the last item or `undefined`.                                                        |
| `groupBy(array, getKey)`                 | Groups items into `Record<Key, Item[]>`.                                                     |
| `keyBy(array, getKey)`                   | Indexes items into `Record<Key, Item>`; later duplicate keys overwrite earlier values.       |
| `sortBy(array, getValue, order = 'asc')` | Returns a sorted copy using string, number, or `Date` keys.                                  |
| `shuffle(array, random = Math.random)`   | Returns a Fisher-Yates shuffled copy.                                                        |
| `sample(array, random = Math.random)`    | Returns one random item or `undefined` for an empty array.                                   |

```ts
import { flatten, groupBy, intersection, keyBy, partition } from 'toolsx/utils'

const nested = flatten([1, [2, [3]]])
const shared = intersection([1, 2, 3], [2, 3, 4])
const [enabled, disabled] = partition(users, (user) => user.enabled)
const grouped = groupBy(users, (user) => user.role)
const usersById = keyBy(users, (user) => user.id)
```

## Object utilities

| API                                | Behavior                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `pick(object, keys)`               | Creates an object containing the selected keys.                                                                 |
| `omit(object, keys)`               | Creates a shallow copy without the selected keys.                                                               |
| `deepMerge(target, source)`        | Recursively merges plain objects and replaces non-plain values.                                                 |
| `get(object, path, defaultValue?)` | Reads a dot path or `PropertyKey[]` path.                                                                       |
| `has(object, path)`                | Checks whether a path exists, including paths whose value is `undefined`.                                       |
| `set(object, path, value)`         | Mutates the object and creates missing plain-object segments.                                                   |
| `unset(object, path)`              | Deletes a path and returns the `Reflect.deleteProperty` result.                                                 |
| `mapValues(object, transform)`     | Maps each own key to a new value while preserving keys.                                                         |
| `mapKeys(object, transform)`       | Maps own keys while preserving values.                                                                          |
| `deepEqual(left, right)`           | Deeply compares objects, arrays, dates, regexes, maps, sets, typed-array views, symbols, and cyclic references. |
| `clone(value)`                     | Uses `structuredClone` when available and falls back to JSON cloning.                                           |

`deepMerge`, `get`, `has`, `set`, and `unset` reject `__proto__`, `constructor`, and `prototype` path segments to prevent prototype-pollution access.

```ts
import { deepMerge, get, has, set, unset } from 'toolsx/utils'

const settings = deepMerge({ theme: { color: 'red' } }, { theme: { size: 12 } })

set(settings, 'theme.color', 'blue')
get<string>(settings, 'theme.color') // blue
has(settings, 'theme.size') // true
unset(settings, 'theme.size')
```

## Number utilities

| API                      | Behavior                                                 |
| ------------------------ | -------------------------------------------------------- |
| `clamp(value, min, max)` | Constrains a number to the inclusive range.              |
| `randomInt(min, max)`    | Returns an integer between the rounded inclusive bounds. |

## String utilities

| API                                                                  | Behavior                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `capitalize(value)`                                                  | Uppercases the first character.                                   |
| `camelCase(value)`                                                   | Converts words to `camelCase`.                                    |
| `pascalCase(value)`                                                  | Converts words to `PascalCase`.                                   |
| `kebabCase(value)`                                                   | Converts words to `kebab-case`.                                   |
| `snakeCase(value)`                                                   | Converts words to `snake_case`.                                   |
| `trim(value, chars?)`                                                | Trims whitespace or the supplied character set from both ends.    |
| `truncate(value, length, omission = '…')`                            | Truncates by Unicode code points and appends the omission marker. |
| `escapeHtml(value)`                                                  | Escapes `&`, `<`, `>`, `"`, and `'`.                              |
| `mask(value, visibleStart = 0, visibleEnd = 4, maskCharacter = '*')` | Masks the middle Unicode code points.                             |
| `randomString(length, alphabet?, random?)`                           | Generates a random string. The default alphabet is alphanumeric.  |

```ts
import { escapeHtml, mask, pascalCase, truncate } from 'toolsx/utils'

pascalCase('user-profile') // UserProfile
truncate('A long title', 8) // A long …
mask('13800138000', 3, 4) // 138****8000
escapeHtml('<script>') // &lt;script&gt;
```

## JSON utilities

| API                                       | Behavior                                                           |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `safeJsonParse(value, fallback?)`         | Returns parsed JSON or the fallback instead of throwing.           |
| `safeJsonStringify(value, fallback = '')` | Returns serialized JSON or the fallback when serialization throws. |

## Async and function utilities

| API                                                 | Behavior                                                                                       |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `noop()`                                            | Empty function for default callbacks.                                                          |
| `sleep(ms, signal?)`                                | Waits for at least `ms`; rejects when the signal aborts.                                       |
| `tryCatch(promise)`                                 | Converts a promise into `[data, null]` or `[null, error]`.                                     |
| `retry(fn, options?)`                               | Retries a promise-returning function with delay, backoff, jitter, filtering, and cancellation. |
| `retry(fn, times, delay)`                           | Compatibility overload where `times` is the total number of attempts.                          |
| `timeout(promise, ms, message?)`                    | Rejects if the promise does not settle in time. It does not cancel the original promise.       |
| `withResolvers<T>()`                                | Returns `{ promise, resolve, reject }`.                                                        |
| `debounce(fn, wait, options?)`                      | Creates a controlled debounced function.                                                       |
| `throttle(fn, wait, options?)`                      | Creates a controlled throttled function.                                                       |
| `promisePool(items, worker, concurrency, options?)` | Processes items with bounded concurrency and preserves result order.                           |
| `memoize(fn, options?)`                             | Caches synchronous results.                                                                    |
| `memoizeAsync(fn, options?)`                        | Caches in-flight/resolved promises with optional TTL.                                          |

### Retry options

| Option        | Default                      | Description                                                     |
| ------------- | ---------------------------- | --------------------------------------------------------------- |
| `retries`     | `2`                          | Number of retries after the first attempt.                      |
| `delay`       | `0`                          | Base delay or a function receiving the error and retry context. |
| `factor`      | `1`                          | Exponential multiplier applied to numeric delays.               |
| `maxDelay`    | `Infinity`                   | Maximum computed delay.                                         |
| `jitter`      | `false`                      | Randomizes delay or computes it with a custom function.         |
| `shouldRetry` | Always retry until exhausted | Async-capable predicate.                                        |
| `signal`      | —                            | Cancels waiting and future attempts.                            |

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

### Debounce and throttle controls

Both returned functions expose:

- `cancel()`: cancels pending invocation.
- `flush()`: immediately runs the pending trailing invocation and returns its value.
- `pending()`: reports whether a timer is active.

`debounce` defaults to `{ leading: false, trailing: true }` and additionally supports `maxWait`. `throttle` defaults to `{ leading: true, trailing: true }`.

### Promise pool

```ts
import { promisePool } from 'toolsx/utils'

const users = await promisePool(ids, (id, index, signal) => loadUser(id, { index, signal }), 4, {
  signal: abortController.signal
})
```

The result array follows input order. The pool rejects when a worker rejects or the signal aborts; work already in progress is not forcibly terminated unless the worker uses the supplied signal.

### Memoization

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
formatUser.delete('1:en')
formatUser.clear()
```

The default memoization key is the first argument. Supply `resolver` for multi-argument functions. Rejected async results are removed by default.

## Exported utility types

`AnyFunction`, `Falsy`, `NestedArray`, `DebounceOptions`, `ThrottleOptions`, `ControlledFunction`, `DebouncedFunction`, `ThrottledFunction`, `RetryContext`, `RetryOptions`, `PromisePoolOptions`, `MemoizedFunction`, `MemoizeOptions`, `MemoizeAsyncOptions`, `MemoizeAsyncCacheEntry`, and `MemoizedAsyncFunction` are exported from `toolsx/utils`.

# Request client

All request APIs are exported from `toolsx/shared`.

The client is based on `ofetch`, adds structured results, and centralizes authentication, retry, caching, deduplication, middleware, concurrency, progress, aborting, and tracing.

## Basic usage

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

## Result model

The default client call resolves instead of throwing request failures.

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

`RequestMeta` contains:

| Field       | Description                                                  |
| ----------- | ------------------------------------------------------------ |
| `requestId` | Generated or caller-provided request ID.                     |
| `url`       | Request URL string.                                          |
| `method`    | Normalized HTTP method.                                      |
| `timestamp` | Start timestamp in milliseconds.                             |
| `duration`  | Total observed duration in milliseconds.                     |
| `attempts`  | Number of network attempts; cache hits use `0`.              |
| `fromCache` | `true` for an in-memory response-cache hit.                  |
| `deduped`   | `true` when the caller joined an existing in-flight request. |

Use `unwrapRequestResult` when exception-based control flow is preferred.

`RequestError<T>` extends `Error` and exposes optional `status`, response `data`, `aborted`, request `meta`, and `cause`. `normalizeRequestError` preserves existing `RequestError` values and normalizes Fetch, timeout, abort, native `Error`, and unknown failures.

## Client defaults

| Behavior                | Default                                        |
| ----------------------- | ---------------------------------------------- |
| Timeout                 | `15_000` ms                                    |
| Header                  | `Accept: application/json`                     |
| Request ID header       | `x-request-id`                                 |
| In-flight deduplication | Enabled for GET and HEAD                       |
| Response cache          | Disabled until configured                      |
| Retry count             | 2 retries after the first attempt              |
| Retry delay             | 250 ms, factor 2, max 3 seconds, random jitter |
| Retry methods           | GET, HEAD, OPTIONS                             |
| Retry statuses          | 408, 409, 425, 429, 500, 502, 503, 504         |

## Client configuration

`createRequestClient(options)` accepts normal `ofetch` options plus:

| Option               | Description                                                                   |
| -------------------- | ----------------------------------------------------------------------------- |
| `headers`            | Default headers merged with request headers.                                  |
| `auth`               | `{ header?, type? }` or `false`. Defaults to `Authorization: Bearer <token>`. |
| `getToken`           | Sync or async token getter.                                                   |
| `refreshToken`       | Refreshes an expired token; concurrent refreshes share one promise.           |
| `shouldRefreshToken` | Custom async-capable refresh predicate. Default: status `401`.                |
| `retryPolicy`        | Retry configuration or `false`.                                               |
| `responseCache`      | In-memory response-cache configuration or `false`.                            |
| `dedupe`             | Enables/disables safe-method in-flight deduplication.                         |
| `concurrency`        | Maximum simultaneous network executions. Must be greater than zero.           |
| `middlewares`        | Initial middleware list.                                                      |
| `requestIdHeader`    | Header name or `false` to disable injection.                                  |
| `fetch`              | Custom fetch implementation for alternate runtimes or adapters.               |
| `onRequest`          | May return modified fetch options before auth/header resolution finishes.     |
| `onResponse`         | Observes successful network responses. Hook errors are ignored.               |
| `onError`            | Observes final structured failures. Hook errors are ignored.                  |
| `onTrace`            | Observes final timing/status metadata. Hook errors are ignored.               |

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

## Per-request options

Each normal request accepts `ofetch` options plus:

| Option                             | Description                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `transform(data)`                  | Maps successful response data, synchronously or asynchronously.               |
| `validateResponse(data, response)` | Returns `false`, a message, or `RequestError` to create a structured failure. |
| `retryPolicy`                      | Overrides or disables client retry.                                           |
| `responseCache`                    | Enables, configures, or disables cache for the request.                       |
| `cacheKey`                         | Explicit response-cache key.                                                  |
| `dedupe`                           | Overrides in-flight deduplication.                                            |
| `dedupeKey`                        | Explicit in-flight deduplication key.                                         |
| `skipAuthRefresh`                  | Prevents token refresh for this request.                                      |
| `onUploadProgress`                 | Receives upload progress events.                                              |
| `onDownloadProgress`               | Receives streamed download progress events.                                   |

```ts
type ApiEnvelope<T> = { code: number; data: T; message: string }
type User = { id: string; name: string }

const result = await request.get<ApiEnvelope<User>, 'json', User>('/profile', {
  validateResponse: (body) => body.code === 0 || body.message,
  transform: (body) => body.data
})
```

## Methods

- Callable instance: `request(url, options)`
- Shortcuts: `request.get`, `post`, `put`, `patch`, `delete`, `head`, `options`
- Raw response: `request.raw(url, options)`
- Abortable call: `request.withAbort(url, options)`
- Abortable shortcuts: `request.abortable.get/post/put/patch/delete/head/options`
- Middleware registration: `request.use(middleware)`
- Cache invalidation: `request.invalidateCache(url, options)`
- Cache controller: `request.cache`
- Abort helpers: `request.createAbortController()`, `request.isAbortError(error)`

`request.raw` returns `FetchResponse` inside `RequestResult`. It still applies default headers, authentication, concurrency, progress, request/response/error hooks, and tracing, but it does not apply normal-request transforms, business validation, wrapper retry, response caching, deduplication, or middleware.

## Token refresh

When `refreshToken` is configured, a final `401` triggers one refresh attempt unless `shouldRefreshToken` says otherwise. Requests failing concurrently with the same token share the refresh promise. The response cache is cleared after refresh.

The refresh function should update the token source used by `getToken`, or return the new token directly.

## Retry

`RequestRetryOptions` supports:

| Option        | Description                                                               |
| ------------- | ------------------------------------------------------------------------- |
| `retries`     | Retries after the first attempt.                                          |
| `delay`       | Base delay or a function of `RequestRetryContext`.                        |
| `factor`      | Exponential multiplier for numeric delay.                                 |
| `maxDelay`    | Maximum delay.                                                            |
| `jitter`      | Boolean random jitter or custom jitter function.                          |
| `methods`     | Allowed HTTP methods.                                                     |
| `statusCodes` | Allowed failure statuses. Network errors have no status and are eligible. |
| `shouldRetry` | Async-capable final predicate.                                            |
| `onRetry`     | Observability callback receiving the chosen delay.                        |

Abort failures are never retried.

## Deduplication and cache

Deduplication shares an in-flight promise for matching GET/HEAD keys. Cache is opt-in and stores successful transformed results in the request instance memory.

Default keys include method, base URL, URL, query, body, and a hash of the auth token. Use `cacheKey` or `dedupeKey` when application-specific identity is required.

`ResponseCacheOptions`:

| Option                 | Default   | Description                                                  |
| ---------------------- | --------- | ------------------------------------------------------------ |
| `ttl`                  | `30_000`  | Entry lifetime in milliseconds.                              |
| `methods`              | `['GET']` | Cacheable methods.                                           |
| `invalidateOnMutation` | `true`    | Clears entries after successful POST/PUT/PATCH/DELETE calls. |

Cache controller methods:

- `request.cache.clear()`
- `request.cache.delete(key)`
- `request.cache.has(key)`
- `request.cache.keys()`
- `request.cache.size`
- `await request.invalidateCache(url, options)`

This is an in-memory application cache, not the browser HTTP cache, and it is not shared across processes or request-client instances.

## Middleware

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

Middleware wraps retry execution and may modify `context.options` or return a result without calling `next`. Calling `next` more than once becomes a structured request failure.

## Progress and aborting

```ts
const upload = request.abortable.post('/files', {
  body: file,
  onUploadProgress: ({ loaded, total, percent, done }) => {},
  onDownloadProgress: ({ loaded, total, percent, done }) => {}
})

upload.abort('user cancelled')
const result = await upload.promise
```

`RequestProgress` contains `phase`, `loaded`, optional `total`/`percent`, and `done`.

The Fetch API does not expose uniform byte-by-byte upload progress in every runtime. Upload callbacks always report start and completion when configured; download callbacks report bytes while the response stream is consumed.

## Request utilities

| API                                       | Behavior                                                          |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `mergeHeaders(source, extra)`             | Creates merged `Headers`; `extra` wins.                           |
| `omitHeaders(source, names)`              | Creates headers without the selected names.                       |
| `headersToObject(headers)`                | Converts headers into `Record<string, string>`.                   |
| `getHeader(headers, name)`                | Case-insensitive safe lookup.                                     |
| `createAuthorizationHeader(token, auth?)` | Creates the configured auth header or `undefined`.                |
| `createQueryString(params)`               | Serializes primitives, dates, and arrays; ignores nil values.     |
| `appendQuery(url, params)`                | Adds serialized query before a URL hash.                          |
| `mergeSignals(...signals)`                | Creates a signal that aborts when any input aborts.               |
| `createTimeoutSignal(timeout, reason?)`   | Creates an abort signal or `undefined` for non-positive timeouts. |
| `createRequestId(prefix?)`                | Creates a timestamp/random request ID.                            |
| `isRequestSuccess(result)`                | Success type guard.                                               |
| `isRequestFailure(result)`                | Failure type guard.                                               |
| `mapRequestResult(result, transform)`     | Maps only a successful response.                                  |
| `unwrapRequestResult(result)`             | Returns response or throws `RequestError`.                        |
| `normalizeRequestError(error)`            | Converts unknown/fetch/abort errors to `RequestError`.            |
| `isRequestError(error)`                   | `RequestError` type guard.                                        |

## Exported request types

The request entry exports `FetchOptions`, `FetchRequest`, `FetchResponse`, `MappedResponseType`, `ResponseType`, `RequestMethod`, `TokenValue`, `TokenGetter`, `RequestProgressPhase`, `RequestProgress`, `RequestProgressHandler`, `RequestRetryContext`, `RequestRetryOptions`, `ResponseCacheOptions`, `RequestOptions`, `RawRequestOptions`, `RequestMeta`, `RequestErrorOptions`, `RequestSuccess`, `RequestFailure`, `RequestResult`, hook contexts, `RequestAuthOptions`, `TokenRefreshContext`, `RequestTrace`, middleware types, `CreateRequestOptions`, `AbortableRequest`, shortcut types, `RequestCacheController`, `RequestInstance`, `QueryValue`, and `QueryParams`.

# Cookie

`Cookie` provides encoded browser cookie access, JSON helpers, defaults, server adapters, and safe non-browser behavior.

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

## Constructor and adapter

```ts
const cookie = new Cookie(defaultOptions?, adapter?)
```

`CookieAdapter` contains `read(): string` and `write(serializedCookie): void`. Without an adapter, the class reads and writes `document.cookie` when available.

In an SSR/Node.js environment with no `document`, `isAvailable()` is `false`, writes return `false`, and reads return empty/null results.

## Cookie options

| Option      | Description                                                    |
| ----------- | -------------------------------------------------------------- |
| `expires`   | `Date` or absolute millisecond timestamp. Invalid dates throw. |
| `maxAge`    | Lifetime in seconds.                                           |
| `path`      | Defaults to `/`.                                               |
| `domain`    | Cookie domain.                                                 |
| `sameSite`  | `'Strict'`, `'Lax'`, or `'None'`.                              |
| `secure`    | Adds the `Secure` attribute.                                   |
| `onSuccess` | Called after adapter write succeeds.                           |

## Cookie methods

| API                                      | Behavior                                                             |
| ---------------------------------------- | -------------------------------------------------------------------- |
| `set(name, value, options?)`             | Encodes and writes a cookie; returns availability/success boolean.   |
| `setJSON(name, value, options?)`         | JSON-serializes and writes; throws for non-serializable `undefined`. |
| `get(name)`                              | Returns decoded value or `null`.                                     |
| `getJSON(name, fallback?)`               | Parses JSON or returns fallback/`null`.                              |
| `getAll()`                               | Returns all decoded cookies as an object.                            |
| `has(name)`                              | Checks own cookie presence.                                          |
| `remove(name, options?)`                 | Expires the cookie using matching path/domain.                       |
| `clear(options?)`                        | Removes every currently visible cookie and returns the count.        |
| `isAvailable()`                          | Reports adapter/browser availability.                                |
| `parseCookieHeader(header)`              | Decodes a Cookie header or `document.cookie` string.                 |
| `serializeCookie(name, value, options?)` | Produces a Set-Cookie/document-cookie assignment string.             |

Browser JavaScript cannot create `HttpOnly` cookies. Set sensitive `HttpOnly` cookies from the server.

Exported Cookie types: `CookieSameSite`, `CookieOptions`, and `CookieAdapter`.

# Storage with expiration

`StorageWithExpiration` wraps any Web Storage-compatible object with serialization, TTL, sliding expiration, namespaces, schema migration, fallback storage, and change notifications.

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

## Storage options

| Option               | Default                     | Description                                                                                |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------------------ |
| `namespace`          | —                           | Prefixes physical keys and scopes `clear()`.                                               |
| `version`            | `1`                         | Current stored-value schema version.                                                       |
| `migrate`            | —                           | Synchronous value migration from an older version.                                         |
| `slidingExpiration`  | —                           | Instance-wide sliding lifetime in milliseconds.                                            |
| `fallbackStorage`    | In-memory storage           | Used when primary writes fail; `false` disables fallback.                                  |
| `validateKey`        | Letters/underscores pattern | `false`, `RegExp`, or predicate customizes validation.                                     |
| `serialize`          | `JSON.stringify`            | Custom item serializer.                                                                    |
| `deserialize`        | `JSON.parse`                | Custom item deserializer.                                                                  |
| `parseErrorStrategy` | `'remove'`                  | `'remove'` or `'keep'` invalid entries.                                                    |
| `onParseError`       | —                           | Receives error, logical key, and raw value.                                                |
| `onQuotaError`       | —                           | Receives primary write error and logical key.                                              |
| `sync`               | `false`                     | Enables `BroadcastChannel` or browser `storage`-event notifications; accepts sync options. |

`StorageSyncOptions` supports `channelName` and `broadcast: false`.

## Set options

| Option              | Description                                        |
| ------------------- | -------------------------------------------------- |
| `expiresAt`         | Absolute `Date`, millisecond timestamp, or `null`. |
| `ttl`               | Relative lifetime in milliseconds.                 |
| `slidingExpiration` | Per-item sliding lifetime in milliseconds.         |

An explicit non-null `expiresAt` defines the initial expiry. Otherwise `ttl`, then sliding expiration, determines it.

## Read result

`getItem<T>(key)` returns a discriminated union:

- Valid: `{ found: true, expired: false, value, expiresAt, version }`
- Expired: `{ found: true, expired: true, value, expiresAt, version }`
- Missing/invalid: `{ found: false, expired: false, value: null, expiresAt: null, version: null }`

Expired entries are removed. Reading a valid sliding-expiration item renews its expiry.

## Storage methods

| API                                    | Behavior                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------- |
| `setItem(key, value, options?)`        | Serializes and writes a versioned entry.                                  |
| `getItem<T>(key)`                      | Returns full found/expired state.                                         |
| `getValue<T>(key)`                     | Returns only a valid value or `null`.                                     |
| `getOrSet(key, createValue, options?)` | Reads a valid value or creates/stores one synchronously.                  |
| `has(key)`                             | Checks for a valid, non-expired item.                                     |
| `keys()`                               | Returns logical keys from primary and fallback storage.                   |
| `removeItem(key)`                      | Removes from primary and fallback storage.                                |
| `clear()`                              | Clears the namespace, or the entire wrapped storages without a namespace. |
| `subscribe(listener)`                  | Subscribes to local/external `set`, `remove`, and `clear` changes.        |
| `destroy()`                            | Closes synchronization resources and clears listeners.                    |
| `createMemoryStorage()`                | Creates a standards-compatible in-memory `Storage`.                       |
| `isStorageAvailable(storage)`          | Performs a temporary write/remove availability check.                     |

`StorageChange` contains `type`, optional `key`/`value`, and `source: 'local' | 'external'`.

Exported Storage types: `StorageExpiration`, `StorageParseErrorStrategy`, `StorageChangeType`, `StorageMigrationContext`, `StorageSyncOptions`, `StorageWithExpirationOptions`, `StorageItem`, `StorageSetOptions`, `StorageGetResult`, and `StorageChange`.

# Typed EventEmitter

`EventEmitter<TEvents>` provides typed exact events, one-time listeners, priorities, wildcard patterns, any-event listeners, async emission, safe emission, AbortSignal cleanup, and listener-limit warnings.

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

## Emitter options

| Option                   | Default        | Description                                                            |
| ------------------------ | -------------- | ---------------------------------------------------------------------- |
| `maxListeners`           | `10`           | Warning threshold per exact/pattern/any group. `0` disables the limit. |
| `onMaxListenersExceeded` | `console.warn` | Custom overflow callback.                                              |

Listener options support `priority` (higher runs first) and `signal` (auto-unsubscribe on abort).

## EventEmitter methods

| API                                      | Behavior                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `on(eventName, listener, options?)`      | Adds an exact listener and returns unsubscribe.                           |
| `off(eventName, listener)`               | Removes matching exact listener references.                               |
| `once(eventName, listener, options?)`    | Removes the exact listener before its first invocation.                   |
| `onAny(listener, options?)`              | Observes all emitted events.                                              |
| `onPattern(pattern, listener, options?)` | Observes string event names matching `*` wildcards.                       |
| `emit(eventName, payload?)`              | Invokes synchronously and does not await promises. Sync errors propagate. |
| `safeEmit(eventName, payload?)`          | Collects synchronous listener errors and continues.                       |
| `emitAsync(eventName, payload?)`         | Awaits listeners sequentially; errors reject.                             |
| `safeEmitAsync(eventName, payload?)`     | Awaits sequentially and collects all errors.                              |
| `clear(eventName?)`                      | Clears one exact event or all exact/pattern/any listeners.                |
| `listenerCount(eventName)`               | Counts exact listeners for one event.                                     |
| `totalListenerCount()`                   | Counts exact, pattern, and any listeners.                                 |
| `setMaxListeners(value)`                 | Updates the threshold and returns the emitter.                            |
| `createListenerHelper<TEvents>()`        | Preserves payload type when declaring listeners separately.               |

Use `emitAsync`/`safeEmitAsync` for promise-returning listeners. `safeEmit` only provides immediate synchronous error collection.

Exported EventEmitter types: `EventListener`, `Unsubscribe`, `EventListenerOptions`, `EventEmitterOptions`, `EventAnyPayload`, and `EventAnyListener`.

# Framework examples

- [Vue, React, and Node.js examples](docs/examples.en.md)
- [Vue、React 与 Node.js 示例（中文）](docs/examples.md)

# Runtime and security notes

- Browser-only APIs degrade only where explicitly documented; runtime-independent utilities remain available in Node.js.
- `clone` falls back to JSON cloning when `structuredClone` is unavailable, so unsupported JSON values, functions, and cyclic references are not preserved in that fallback.
- Cookie and Storage helpers do not encrypt data. Do not treat client-side storage as a secure credential vault.
- Prefer server-set `HttpOnly`, `Secure`, and appropriate `SameSite` cookies for sensitive browser credentials.
- Request response caching is local memory, not persistent storage or standards-based HTTP caching.
- Cookie and Web Storage availability/capacity depend on browser privacy policy and user settings.

# License

MIT
