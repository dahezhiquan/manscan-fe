import { setColorMode } from './useColorMode'
import { DEFAULT_THEME_SETTINGS, THEME_OPTIONS } from '../constants/themes'
import { getAuthToken, getStoredUser } from '../utils/authSession'
import { normalizeThemeSettings } from '../utils/themeSettings'

// index.html reads this cache before the module bundle and styles are loaded.
const THEME_SETTINGS_CACHE_KEY = 'manscan-theme-settings'

export function getCachedThemeSettings() {
  if (typeof window === 'undefined' || !getAuthToken()) {
    return null
  }

  try {
    const user = getStoredUser()
    const cached = JSON.parse(window.localStorage.getItem(THEME_SETTINGS_CACHE_KEY) || 'null')
    if (
      !user?.username || !cached || cached.userId !== user.id || cached.username !== user.username ||
      !THEME_OPTIONS.some((item) => item.id === cached.theme) ||
      typeof cached.darkModeEnabled !== 'boolean'
    ) {
      return null
    }

    return normalizeThemeSettings(cached)
  } catch {
    return null
  }
}

/** Cache only successful server responses; live previews remain unsaved. */
export function cacheThemeSettings(settings) {
  const user = getStoredUser()
  if (typeof window === 'undefined' || !getAuthToken() || !user?.username) {
    return
  }

  try {
    window.localStorage.setItem(THEME_SETTINGS_CACHE_KEY, JSON.stringify({
      userId: user.id,
      username: user.username,
      ...normalizeThemeSettings(settings)
    }))
  } catch {
    // The server remains the source of truth when browser storage is unavailable.
  }
}

export function clearCachedThemeSettings() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem(THEME_SETTINGS_CACHE_KEY)
    window.sessionStorage.removeItem(THEME_SETTINGS_CACHE_KEY)
  } catch {
    // User identity checks also prevent a different account from using this cache.
  }
}

export function getAppliedThemeSettings() {
  if (typeof document === 'undefined') {
    return { ...DEFAULT_THEME_SETTINGS }
  }

  return normalizeThemeSettings({
    theme: document.documentElement.dataset.theme,
    darkModeEnabled: document.documentElement.dataset.colorMode === 'dark'
  })
}

/** Apply the supported visual theme and its independent color mode together. */
export function applyThemeSettings(settings) {
  const normalized = normalizeThemeSettings(settings)

  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = normalized.theme
  }

  setColorMode(normalized.darkModeEnabled)
}
