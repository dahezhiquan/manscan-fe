export const DEFAULT_THEME_SETTINGS = {
  theme: 'cartoon',
  darkModeEnabled: false
}

export function normalizeThemeSettings(payload, supportedThemes = []) {
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
