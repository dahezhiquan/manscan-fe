export const primaryNav = [
  { label: '仪表盘', active: true, count: null, icon: 'grid', route: '/' },
  { label: '漏洞', active: false, count: 1, icon: 'shield', route: '/vulnerabilities' },
  { label: '扫描', active: false, count: 0, icon: 'scan', route: '/scans' },
  { label: '域名资产清单', active: false, count: null, icon: 'stack', route: '/assets/domains' },
  { label: '主机资产清单', active: false, count: null, icon: 'server', route: '/assets/hosts' },
  { label: '资产配置中心', active: false, count: null, icon: 'server', route: '/assets/config' }
]

export const secondaryNav = [
  { label: '报告', icon: 'chart' },
  { label: '漏洞模板', icon: 'doc', route: '/templates/all' }
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

    if (route === '/assets/config') {
      return path === '/assets/config' || path.startsWith('/assets/config')
    }

    if (route === '/assets/domains') {
      return path === '/assets/domains' || path.startsWith('/assets/domains')
    }

    if (route === '/assets/hosts') {
      return path === '/assets/hosts' || path.startsWith('/assets/hosts')
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

export const latestDetections = [
  { value: 68, label: '近 7 天' },
  { value: 212, label: '近 30 天' }
]

export const vulnerabilityDetections = [
  {
    severity: '高危',
    severityTone: 'high',
    tag: 'grandstream-grp-default-login',
    title: 'Grandstream GRP - 默认登录凭证',
    time: '5 小时前'
  },
  {
    severity: '严重',
    severityTone: 'critical',
    tag: 'CVE-2026-47668',
    title: 'DbGate - 远程代码执行',
    time: '14 小时前'
  },
  {
    severity: '高危',
    severityTone: 'high',
    tag: 'CVE-2026-46372',
    title: 'SillyTavern - 服务端请求伪造',
    time: '18 小时前'
  },
  {
    severity: '中危',
    severityTone: 'medium',
    tag: 'phpjabbers-event-booking-xss',
    title: 'PHPJabbers Event Booking - 跨站脚本攻击',
    time: '3 天前'
  },
  {
    severity: '高危',
    severityTone: 'high',
    tag: 'wp-livechat-stored-xss',
    title: 'WordPress LiveChat - 未授权存储型 XSS',
    time: '8 天前'
  },
  {
    severity: '严重',
    severityTone: 'critical',
    tag: 'CVE-2026-49812',
    title: 'OpenPanel - 权限绕过导致远程接管',
    time: '10 天前'
  },
  {
    severity: '高危',
    severityTone: 'high',
    tag: 'grafana-plugin-auth-bypass',
    title: 'Grafana 插件接口 - 身份验证绕过',
    time: '12 天前'
  },
  {
    severity: '中危',
    severityTone: 'medium',
    tag: 'nextcms-upload-leak',
    title: 'NextCMS - 上传路径信息泄露',
    time: '15 天前'
  }
]
