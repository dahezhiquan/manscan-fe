import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { normalizePath, resolveDocumentTitle } from '../router/routes'

export function useAppRouter() {
  const currentPath = ref(normalizePath(window.location.pathname))

  function syncPath() {
    currentPath.value = normalizePath(window.location.pathname)
  }

  function navigateTo(path) {
    const normalized = normalizePath(path)

    if (normalized !== currentPath.value) {
      window.history.pushState({}, '', normalized)
      currentPath.value = normalized
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }

  const documentTitle = computed(() => resolveDocumentTitle(currentPath.value))

  onMounted(() => {
    document.title = documentTitle.value
    window.addEventListener('popstate', syncPath)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('popstate', syncPath)
  })

  watch(documentTitle, (title) => {
    document.title = title
  })

  return {
    currentPath,
    navigateTo
  }
}
