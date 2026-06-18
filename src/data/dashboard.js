export const primaryNav = [
  { label: '仪表盘', active: true, count: null, icon: 'grid', route: '/' },
  { label: '漏洞', active: false, count: 1, icon: 'shield', route: '/vulnerabilities' },
  { label: '扫描', active: false, count: 0, icon: 'scan', route: '/scans' },
  { label: '资产清单', active: false, count: 0, icon: 'stack' },
  { label: '资产分组', active: false, count: 0, icon: 'server' }
]

export const secondaryNav = [
  { label: '报告', icon: 'chart' },
  { label: '漏洞模板', icon: 'doc', route: '/templates/all' },
  { label: '凭证监控', icon: 'lock' },
  { label: '集成', icon: 'plug' }
]

export const footerNav = [
  { label: '设置', icon: 'gear' },
  { label: '帮助', icon: 'help' },
  { label: '退出登录', icon: 'logout' }
]

export function getNavigationState(path = '/') {
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

    return path === route
  }

  return {
    primaryNav: primaryNav.map((item) => ({
      ...item,
      active: isRouteActive(item.route)
    })),
    secondaryNav: secondaryNav.map((item) => ({
      ...item,
      active: isRouteActive(item.route)
    }))
  }
}

export const vulnerabilityStats = [
  { label: '总计', value: 0, tone: 'total' },
  { label: '严重', value: 0, tone: 'critical' },
  { label: '高危', value: 0, tone: 'high' },
  { label: '中危', value: 0, tone: 'medium' },
  { label: '未知', value: 0, tone: 'unknown' },
  { label: '低危', value: 0, tone: 'low' }
]

export const assetStats = [
  { value: 0, label: '资产' },
  { value: 0, label: '服务' },
  { value: 0, label: '技术栈' },
  { value: 0, label: '受影响服务' }
]

export const remediationStats = [
  { value: '--', label: '严重（14 天 SLA）', tone: 'critical' },
  { value: '--', label: '高危（60 天 SLA）', tone: 'high' },
  { value: '--', label: '中危（90 天 SLA）', tone: 'medium' },
  { value: '0', label: '已修复总数', tone: 'total' }
]

export const remediationOverviewStats = [
  { value: 0, label: '待修复' },
  { value: 0, label: '修复中' },
  { value: 0, label: '已延期' },
  { value: 0, label: '已验证' }
]

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
