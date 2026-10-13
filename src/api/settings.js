import { SETTINGS_THEME_API } from '../constants/api'
import { requestJson } from '../utils/http'

export async function getThemeSettings(signal) {
  return requestJson(SETTINGS_THEME_API, {
    method: 'GET',
    signal
  })
}

export async function updateThemeSettings(payload, signal) {
  return requestJson(SETTINGS_THEME_API, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      theme: payload.theme,
      dark_mode_enabled: payload.darkModeEnabled
    }),
    signal
  })
}
