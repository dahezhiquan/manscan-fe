export function resolvePrependedLogScrollTop({
  previousScrollTop,
  previousScrollHeight,
  currentScrollHeight,
  scrollToTop = false
}) {
  if (scrollToTop) {
    return 0
  }

  return previousScrollTop + currentScrollHeight - previousScrollHeight
}
