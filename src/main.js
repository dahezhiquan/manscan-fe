import { createApp } from 'vue'
import App from './App.vue'
import manscanIcon from './assets/manscan-icon.png'
import { applyThemeSettings, getCachedThemeSettings } from './composables/useTheme'
import { DEFAULT_THEME_SETTINGS } from './constants/themes'

applyThemeSettings(getCachedThemeSettings() || DEFAULT_THEME_SETTINGS)

const faviconLink =
  document.querySelector("link[rel='icon']") ||
  Object.assign(document.createElement('link'), { rel: 'icon' })

faviconLink.href = manscanIcon
document.head.appendChild(faviconLink)

createApp(App).mount('#app')
