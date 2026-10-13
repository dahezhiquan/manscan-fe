export const COLOR_MODE_ATTRIBUTE = 'colorMode'
export const COLOR_MODE_DARK = 'dark'
export const COLOR_MODE_LIGHT = 'light'

export function setColorMode(isDarkModeEnabled) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.dataset[COLOR_MODE_ATTRIBUTE] = isDarkModeEnabled
    ? COLOR_MODE_DARK
    : COLOR_MODE_LIGHT
}
