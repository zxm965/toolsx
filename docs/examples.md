# Vue、React、Node 示例

[English](examples.en.md) | 简体中文

## 通用工具

```ts
import { createAbortGroup, createLimiter, poll, stableJsonStringify, uniqueBy } from 'toolsx/utils'

const users = uniqueBy(records, (item) => item.id)
const cacheKey = stableJsonStringify({ filters, users: users.map((item) => item.id) })

const abortGroup = createAbortGroup(pageSignal)
const limit = createLimiter(3)
const results = await Promise.all(tasks.map((task) => limit(task, abortGroup.signal)))

const ready = await poll(checkReady, {
  interval: 250,
  maxAttempts: 8,
  signal: abortGroup.signal,
  until: Boolean
})
```

## 异步 Storage 适配器

```ts
import { AsyncStorageWithExpiration, createAsyncStorageAdapter } from 'toolsx/shared'

const storage = new AsyncStorageWithExpiration(createAsyncStorageAdapter(localStorage), {
  namespace: 'app',
  validateKey: false
})

const settings = await storage.getOrSet('settings', async () => ({ theme: 'light' }), {
  ttl: 60_000
})
```

## Vue

```ts
// src/api/request.ts
import { createRequestClient } from 'toolsx/shared'

export const request = createRequestClient({
  baseURL: '/api',
  getToken: () => localStorage.getItem('access_token'),
  responseCache: { ttl: 30_000 }
})
```

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { request } from './api/request'

type User = { id: string; name: string }

const user = ref<User | null>(null)
const errorMessage = ref('')

onMounted(async () => {
  const result = await request.get<User>('/profile')

  if (result.error) errorMessage.value = result.error.message
  else user.value = result.response
})
</script>

<template>
  <p v-if="errorMessage">{{ errorMessage }}</p>
  <p v-else-if="user">{{ user.name }}</p>
  <p v-else>加载中...</p>
</template>
```

## React

```tsx
import { useEffect, useState } from 'react'
import { createRequestClient } from 'toolsx/shared'

type User = { id: string; name: string }

const request = createRequestClient({
  baseURL: '/api',
  responseCache: { ttl: 30_000 }
})

export function Profile() {
  const [user, setUser] = useState<User | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const task = request.abortable.get<User>('/profile')

    task.promise.then((result) => {
      if (result.error) setErrorMessage(result.error.message)
      else setUser(result.response)
    })

    return () => task.abort()
  }, [])

  if (errorMessage) return <p>{errorMessage}</p>
  return <p>{user?.name ?? '加载中...'}</p>
}
```

## Node.js

```ts
import { createRequestClient, unwrapRequestResult } from 'toolsx/shared'
import { promisePool } from 'toolsx/utils'

type User = { id: string; name: string }

const request = createRequestClient({
  baseURL: 'https://api.example.com',
  concurrency: 4,
  retryPolicy: { retries: 2, delay: 250, factor: 2 }
})

const ids = ['1', '2', '3']
const users = await promisePool(ids, (id) => unwrapRequestResult(request.get<User>(`/users/${id}`)), 2)

console.log(users)
```

Node.js 20 及以上版本可以直接使用；Cookie 的默认浏览器适配器在服务端会安全降级，如需处理请求头请使用 `parseCookieHeader` / `serializeCookie`。
