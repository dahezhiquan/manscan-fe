import { createApp } from 'vue'
import App from './App.vue'
import manscanIcon from './assets/manscan-icon.png'
import './style.css'

const faviconLink =
  document.querySelector("link[rel='icon']") ||
  Object.assign(document.createElement('link'), { rel: 'icon' })

faviconLink.href = manscanIcon
document.head.appendChild(faviconLink)

createApp(App).mount('#app')
