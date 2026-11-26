import { NOTIFICATIONS_API, SETTINGS_THEME_API } from '../constants/api'
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

export async function getNotificationList(signal) {
  const searchParams = new URLSearchParams({ page: '1', page_size: '100' })
  return requestJson(`${NOTIFICATIONS_API}?${searchParams.toString()}`, {
    method: 'GET',
    signal
  })
}

export async function updateNotification(id, payload, signal) {
  return requestJson(`${NOTIFICATIONS_API}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: payload.name,
      description: payload.description ?? '',
      enabled: payload.enabled,
      event: payload.event,
      style: payload.style
    }),
    signal
  })
}
