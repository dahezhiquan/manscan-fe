import { createApp } from 'vue'
import App from './App.vue'
import manscanIconOnline from './assets/manscan-icon-online.png'
import './style.css'

const faviconLink =
  document.querySelector("link[rel='icon']") ||
  Object.assign(document.createElement('link'), { rel: 'icon' })

faviconLink.href = manscanIconOnline
document.head.appendChild(faviconLink)

createApp(App).mount('#app')
