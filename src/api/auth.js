import { AUTH_LOGIN_API, AUTH_LOGOUT_API, AUTH_ME_API } from '../constants/api'
import { requestJson } from '../utils/http'

export async function loginUser(credentials) {
  return requestJson(AUTH_LOGIN_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: credentials.username,
      password: credentials.password
    }),
    skipAuth: true
  })
}

export async function getCurrentUser(signal) {
  return requestJson(AUTH_ME_API, {
    method: 'GET',
    signal
  })
}

export async function logoutCurrentUser() {
  return requestJson(AUTH_LOGOUT_API, {
    method: 'POST'
  })
}
