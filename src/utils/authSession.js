const ACCESS_TOKEN_KEY = 'manscan-auth-access-token'
const TOKEN_TYPE_KEY = 'manscan-auth-token-type'
const EXPIRES_AT_KEY = 'manscan-auth-expires-at'
const USER_KEY = 'manscan-auth-user'
const LEGACY_LOGIN_SESSION_KEY = 'manscan-login-session'
const LEGACY_LOGIN_USERNAME_KEY = 'manscan-login-username'

export const AUTH_SESSION_EXPIRED_EVENT = 'manscan-auth-session-expired'

function getStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.sessionStorage
}

function readStorageValue(key) {
  try {
    return getStorage()?.getItem(key) || ''
  } catch {
    return ''
  }
}

function writeStorageValue(key, value) {
  try {
    getStorage()?.setItem(key, value)
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function removeStorageValue(key) {
  try {
    getStorage()?.removeItem(key)
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function removeLegacyLoginState() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem(LEGACY_LOGIN_SESSION_KEY)
    window.localStorage.removeItem(LEGACY_LOGIN_USERNAME_KEY)
  } catch {
    // Legacy state cleanup should not block auth initialization.
  }
}

export function normalizeUser(user) {
  if (!user || typeof user !== 'object') {
    return null
  }

  return {
    id: user.id ?? null,
    username: String(user.username ?? '').trim(),
    display_name: String(user.display_name ?? user.displayName ?? '').trim(),
    role: String(user.role ?? '').trim()
  }
}

export function getAuthToken() {
  return readStorageValue(ACCESS_TOKEN_KEY)
}

export function getAuthorizationHeader() {
  const accessToken = getAuthToken()

  if (!accessToken) {
    return ''
  }

  const tokenType = readStorageValue(TOKEN_TYPE_KEY) || 'Bearer'
  return `${tokenType} ${accessToken}`
}

export function getStoredUser() {
  const rawUser = readStorageValue(USER_KEY)

  if (!rawUser) {
    return null
  }

  try {
    return normalizeUser(JSON.parse(rawUser))
  } catch {
    return null
  }
}

export function setAuthSession(session) {
  const accessToken = String(session?.access_token ?? session?.accessToken ?? '').trim()

  if (!accessToken) {
    throw new Error('登录响应缺少访问令牌。')
  }

  writeStorageValue(ACCESS_TOKEN_KEY, accessToken)
  writeStorageValue(TOKEN_TYPE_KEY, String(session?.token_type ?? session?.tokenType ?? 'Bearer').trim() || 'Bearer')
  writeStorageValue(EXPIRES_AT_KEY, String(session?.expires_at ?? session?.expiresAt ?? '').trim())
  updateStoredUser(session?.user)
  removeLegacyLoginState()
}

export function updateStoredUser(user) {
  const normalizedUser = normalizeUser(user)

  if (normalizedUser) {
    writeStorageValue(USER_KEY, JSON.stringify(normalizedUser))
    return normalizedUser
  }

  removeStorageValue(USER_KEY)
  return null
}

export function clearAuthSession() {
  removeStorageValue(ACCESS_TOKEN_KEY)
  removeStorageValue(TOKEN_TYPE_KEY)
  removeStorageValue(EXPIRES_AT_KEY)
  removeStorageValue(USER_KEY)
  removeLegacyLoginState()
}

export function notifyAuthSessionExpired() {
  clearAuthSession()

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT))
  }
}
