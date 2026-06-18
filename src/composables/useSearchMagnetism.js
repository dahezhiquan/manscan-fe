import { nextTick, onBeforeUnmount } from 'vue'

export function useSearchMagnetism(selector, options = {}) {
  const cleanupHandlers = []
  const {
    moveXFactor = 0.04,
    moveYFactor = 0.04,
    maxMoveX = 8,
    maxMoveY = 4,
    defaultGlowX = '82%',
    defaultGlowY = '50%'
  } = options

  async function setup() {
    await nextTick()
    cleanup()

    const element = document.querySelector(selector)

    if (!element) {
      return
    }

    const handleMove = (event) => {
      const rect = element.getBoundingClientRect()
      const offsetX = event.clientX - (rect.left + rect.width / 2)
      const offsetY = event.clientY - (rect.top + rect.height / 2)
      const moveX = Math.max(-maxMoveX, Math.min(maxMoveX, offsetX * moveXFactor))
      const moveY = Math.max(-maxMoveY, Math.min(maxMoveY, offsetY * moveYFactor))
      const glowX = ((event.clientX - rect.left) / rect.width) * 100
      const glowY = ((event.clientY - rect.top) / rect.height) * 100

      element.style.setProperty('--search-magnet-x', `${moveX}px`)
      element.style.setProperty('--search-magnet-y', `${moveY}px`)
      element.style.setProperty('--search-glow-x', `${glowX}%`)
      element.style.setProperty('--search-glow-y', `${glowY}%`)
    }

    const handleLeave = () => {
      element.style.setProperty('--search-magnet-x', '0px')
      element.style.setProperty('--search-magnet-y', '0px')
      element.style.setProperty('--search-glow-x', defaultGlowX)
      element.style.setProperty('--search-glow-y', defaultGlowY)
    }

    element.addEventListener('mousemove', handleMove)
    element.addEventListener('mouseleave', handleLeave)

    cleanupHandlers.push(() => {
      element.removeEventListener('mousemove', handleMove)
      element.removeEventListener('mouseleave', handleLeave)
    })
  }

  function cleanup() {
    cleanupHandlers.splice(0).forEach((handler) => handler())
  }

  onBeforeUnmount(() => {
    cleanup()
  })

  return {
    setup,
    cleanup
  }
}
