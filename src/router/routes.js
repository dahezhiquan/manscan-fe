export const ROUTE_PATHS = {
  HOME: '/',
  VULNERABILITIES: '/vulnerabilities',
  SCANS: '/scans',
  SCAN_CREATE: '/scans/create',
  TEMPLATES: '/templates/all'
}

export const ROUTE_TITLES = {
  [ROUTE_PATHS.HOME]: 'ManScan',
  [ROUTE_PATHS.TEMPLATES]: 'ManScan - 漏洞模版',
  [ROUTE_PATHS.VULNERABILITIES]: 'ManScan - 漏洞',
  [ROUTE_PATHS.SCANS]: 'ManScan - 扫描',
  [ROUTE_PATHS.SCAN_CREATE]: 'ManScan - 创建扫描任务'
}

export function normalizePath(path) {
  if (!path || path === '/') {
    return ROUTE_PATHS.HOME
  }

  if (path === '/templates' || path === ROUTE_PATHS.TEMPLATES) {
    return ROUTE_PATHS.TEMPLATES
  }

  if (path === ROUTE_PATHS.VULNERABILITIES) {
    return ROUTE_PATHS.VULNERABILITIES
  }

  if (path === ROUTE_PATHS.SCANS) {
    return ROUTE_PATHS.SCANS
  }

  if (path === ROUTE_PATHS.SCAN_CREATE) {
    return ROUTE_PATHS.SCAN_CREATE
  }

  if (/^\/scans\/[^/]+$/.test(path)) {
    return path
  }

  if (path.startsWith('/templates/')) {
    return path
  }

  return ROUTE_PATHS.HOME
}

export function resolveDocumentTitle(path) {
  if (path.startsWith('/scans/')) {
    return 'ManScan - 扫描任务详情'
  }

  if (path.startsWith('/templates/')) {
    return 'ManScan - 模版详情'
  }

  return ROUTE_TITLES[path] || ROUTE_TITLES[ROUTE_PATHS.HOME]
}
