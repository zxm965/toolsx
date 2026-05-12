import { createRequestClient, setRequestClient } from './client'
import type { CreateRequestOptions, RequestInstance, TokenGetter } from './types'

const requestState: {
  config: Omit<CreateRequestOptions, 'getToken'>
  getToken?: TokenGetter
  request: RequestInstance
} = { config: {}, request: createRequestClient() }

export function configureRequest(options: Omit<CreateRequestOptions, 'getToken'> = {}) {
  requestState.config = { ...requestState.config, ...options }

  requestState.request = setRequestClient(
    createRequestClient({ ...requestState.config, getToken: requestState.getToken })
  )

  return requestState.request
}

export function setAccessTokenGetter(getToken?: TokenGetter) {
  requestState.getToken = getToken
  requestState.request = setRequestClient(createRequestClient({ ...requestState.config, getToken }))

  return requestState.request
}

export function getRequestClient() {
  return requestState.request
}
