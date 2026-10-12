import { USERS_API } from '../constants/api'
import { requestJson } from '../utils/http'

export async function getUserList(params = {}, signal) {
  const searchParams = new URLSearchParams()

  appendQueryParam(searchParams, 'page', params.page)
  appendQueryParam(searchParams, 'page_size', params.page_size ?? params.pageSize)

  const query = searchParams.toString()
  const requestUrl = query ? `${USERS_API}?${query}` : USERS_API

  return requestJson(requestUrl, {
    method: 'GET',
    signal
  })
}

export async function createUser(payload, signal) {
  return requestJson(USERS_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: payload.username,
      password: payload.password,
      role: payload.role,
      status: payload.status
    }),
    signal
  })
}

export async function updateUser(username, payload, signal) {
  const requestBody = {
    role: payload.role,
    status: payload.status
  }

  if (payload.password) {
    requestBody.password = payload.password
  }

  return requestJson(getUserDetailApi(username), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody),
    signal
  })
}

export async function deleteUser(username, signal) {
  return requestJson(getUserDetailApi(username), {
    method: 'DELETE',
    signal
  })
}

function appendQueryParam(searchParams, key, value) {
  if (value === null || value === undefined || value === '') {
    return
  }

  searchParams.set(key, String(value))
}

function getUserDetailApi(username) {
  return `${USERS_API}/${encodeURIComponent(username)}`
}
