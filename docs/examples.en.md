# Vue, React, and Node.js examples

English | [简体中文](examples.md)

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
  <p v-else>Loading...</p>
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
  return <p>{user?.name ?? 'Loading...'}</p>
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

Node.js 20 and newer can use the library directly. The default Cookie adapter safely degrades outside the browser; use `parseCookieHeader` and `serializeCookie` for server-side header handling.
