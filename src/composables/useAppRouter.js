import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { normalizePath, resolveDocumentTitle } from '../router/routes'

export function useAppRouter() {
  const currentPath = ref(normalizePath(window.location.pathname))
  const currentSearch = ref(window.location.search)

  function syncPath() {
    currentPath.value = normalizePath(window.location.pathname)
    currentSearch.value = window.location.search
  }

  function navigateTo(path) {
    const target = new URL(path || '/', window.location.origin)
    const normalized = normalizePath(target.pathname)
    const search = target.search

    if (normalized !== currentPath.value || search !== currentSearch.value) {
      window.history.pushState({}, '', `${normalized}${search}`)
      currentPath.value = normalized
      currentSearch.value = search
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
    currentSearch,
    navigateTo
  }
}
