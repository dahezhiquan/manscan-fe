export const primaryNav = [
  { label: '仪表盘', active: true, count: null, icon: 'grid', route: '/' },
  { label: '漏洞', active: false, count: 1, icon: 'shield', route: '/vulnerabilities' },
  { label: '扫描', active: false, count: 0, icon: 'scan', route: '/scans' },
  { label: '域名资产清单', active: false, count: null, icon: 'stack', route: '/assets/domains' },
  { label: '主机资产清单', active: false, count: null, icon: 'server', route: '/assets/hosts' },
  { label: '资产配置中心', active: false, count: null, icon: 'server', route: '/assets/config' },
  { label: '定时任务', active: false, count: null, icon: 'clock', route: '/scheduled-jobs' }
]

export const secondaryNav = [
  { label: '报告', icon: 'chart' },
  { label: '漏洞模板', icon: 'doc', route: '/templates/all' },
  { label: '漏洞情报', icon: 'shield', route: '/vulnerability-intelligence' }
]

export const footerNav = [
  { label: '设置', icon: 'gear', route: '/settings' },
  { label: '文档中心', icon: 'help' }
]

export function getNavigationState(path = '/', options = {}) {
  const { scanCount, vulnerabilityCount } = options

  const isRouteActive = (route) => {
    if (!route) {
      return false
    }

    if (route === '/') {
      return path === '/'
    }

    if (route === '/scans') {
      return path === '/scans' || path.startsWith('/scans/')
    }

    if (route === '/templates/all') {
      return path === '/templates/all' || path.startsWith('/templates/')
    }

    if (route === '/vulnerability-intelligence') {
      return path === route
    }

    if (route === '/assets/config') {
      return path === '/assets/config' || path.startsWith('/assets/config')
    }

    if (route === '/assets/domains') {
      return path === '/assets/domains' || path.startsWith('/assets/domains')
    }

    if (route === '/assets/hosts') {
      return path === '/assets/hosts' || path.startsWith('/assets/hosts')
    }

    if (route === '/scheduled-jobs') {
      return path === '/scheduled-jobs'
    }

    return path === route
  }

  return {
    primaryNav: primaryNav.map((item) => ({
      ...item,
      count: resolveNavCount(item, { scanCount, vulnerabilityCount }),
      active: isRouteActive(item.route)
    })),
    secondaryNav: secondaryNav.map((item) => ({
      ...item,
      active: isRouteActive(item.route)
    }))
  }
}

function resolveNavCount(item, { scanCount, vulnerabilityCount }) {
  if (item.route === '/scans' && scanCount !== undefined) {
    return scanCount
  }

  if (item.route === '/vulnerabilities' && vulnerabilityCount !== undefined) {
    return vulnerabilityCount
  }

  return item.count
}
