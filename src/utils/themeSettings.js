import { DEFAULT_THEME_SETTINGS, THEME_OPTIONS } from '../constants/themes'

export { DEFAULT_THEME_SETTINGS } from '../constants/themes'

export function normalizeThemeSettings(payload, supportedThemes = THEME_OPTIONS) {
  const supportedThemeIds = supportedThemes.map((item) => item.id)
  const rawTheme = String(payload?.theme ?? '').trim().toLowerCase()
  const theme = supportedThemeIds.includes(rawTheme)
    ? rawTheme
    : DEFAULT_THEME_SETTINGS.theme

  return {
    theme,
    darkModeEnabled: Boolean(payload?.dark_mode_enabled ?? payload?.darkModeEnabled)
  }
}
