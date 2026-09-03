export const ASSET_CONFIG_CATEGORY_META = {
  whitelist: {
    label: '全局扫描白名单',
    icon: 'shield',
    summary: '不参与扫描的域名、Host、路径和资产前缀',
    itemLabel: '白名单项',
    itemPlaceholder: '例如：*.internal.example.com',
    itemScopeLabel: '生效范围',
    itemScopePlaceholder: '例如：主动扫描 / 被动采集',
    itemValueLabel: '白名单值',
    theme: 'green'
  },
  userAgent: {
    label: '全局扫描 User-Agent',
    icon: 'doc',
    summary: '统一控制主动扫描与探测请求使用的标识',
    itemLabel: 'User-Agent',
    itemPlaceholder: '例如：Mozilla/5.0 (...)',
    itemScopeLabel: '使用场景',
    itemScopePlaceholder: '例如：HTTP 探测 / Headless',
    itemValueLabel: 'UA 字符串',
    theme: 'blue'
  },
  subnet: {
    label: '网络网段信息',
    icon: 'stack',
    summary: '记录目标网络、边界网段与扫描覆盖范围',
    itemLabel: '网段条目',
    itemPlaceholder: '例如：10.10.0.0/16',
    itemScopeLabel: '适用范围',
    itemScopePlaceholder: '例如：内网 / 云上 VPC',
    itemValueLabel: 'CIDR / 网段',
    theme: 'yellow'
  },
  passive: {
    label: '被动流量地址配置',
    icon: 'server',
    summary: '维护被动流量采集、回流和镜像接收地址',
    itemLabel: '地址条目',
    itemPlaceholder: '例如：http://collector.internal:9000',
    itemScopeLabel: '接收类型',
    itemScopePlaceholder: '例如：回流 / 镜像 / Webhook',
    itemValueLabel: '地址',
    theme: 'pink'
  }
}

export const ASSET_CONFIG_CATEGORY_ORDER = ['whitelist', 'userAgent', 'subnet', 'passive']

export const ASSET_CONFIG_SEED = [
  {
    key: 'whitelist',
    groups: [
      {
        id: 'whitelist-core',
        name: '生产核心系统',
        description: '核心业务域名、健康检查路径和登录入口。',
        owner: 'SecOps',
        scope: '主动扫描 / 被动采集',
        status: 'enabled',
        tags: ['生产', '核心', '健康检查'],
        updatedAt: '2026-09-01T18:40:00+08:00',
        entries: [
          {
            id: 'whitelist-core-1',
            value: '*.api.example.com',
            scope: '主动扫描',
            note: '业务 API 域名',
            status: 'enabled'
          },
          {
            id: 'whitelist-core-2',
            value: '/health',
            scope: '探活检查',
            note: '健康检查路径',
            status: 'enabled'
          },
          {
            id: 'whitelist-core-3',
            value: 'portal.example.com',
            scope: '被动采集',
            note: '核心门户入口',
            status: 'enabled'
          }
        ]
      },
      {
        id: 'whitelist-ops',
        name: '运维与外联例外',
        description: '跳板机、运维控制台与外联窗口。',
        owner: 'Platform',
        scope: '主动扫描',
        status: 'enabled',
        tags: ['运维', '例外'],
        updatedAt: '2026-09-01T09:20:00+08:00',
        entries: [
          {
            id: 'whitelist-ops-1',
            value: 'jump.example.net',
            scope: '运维入口',
            note: '跳板机入口',
            status: 'enabled'
          },
          {
            id: 'whitelist-ops-2',
            value: 'status.example.net',
            scope: '外联窗口',
            note: '状态页与公告页',
            status: 'paused'
          }
        ]
      }
    ]
  },
  {
    key: 'userAgent',
    groups: [
      {
        id: 'ua-browser',
        name: '浏览器模拟',
        description: '适合页面探测、登录态检查和需要浏览器痕迹的任务。',
        owner: 'Scan Team',
        scope: 'HTTP / Headless',
        status: 'enabled',
        tags: ['浏览器', '通用'],
        updatedAt: '2026-09-01T20:10:00+08:00',
        entries: [
          {
            id: 'ua-browser-1',
            value:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
            scope: 'HTTP 探测',
            note: '默认浏览器 UA',
            status: 'enabled'
          },
          {
            id: 'ua-browser-2',
            value:
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
            scope: 'Headless',
            note: 'macOS 场景',
            status: 'enabled'
          }
        ]
      },
      {
        id: 'ua-bot',
        name: '扫描器伪装',
        description: '更偏稳定、低特征的请求头组合。',
        owner: 'SecOps',
        scope: '主动扫描',
        status: 'paused',
        tags: ['扫描器', '低特征'],
        updatedAt: '2026-08-31T16:30:00+08:00',
        entries: [
          {
            id: 'ua-bot-1',
            value: 'ManScan/1.0 (+https://internal.example.com)',
            scope: '主动扫描',
            note: '内部统一标识',
            status: 'enabled'
          },
          {
            id: 'ua-bot-2',
            value: 'Mozilla/5.0 (compatible; ManScan/1.0; +https://internal.example.com)',
            scope: '主动扫描',
            note: '兼容旧策略',
            status: 'paused'
          }
        ]
      }
    ]
  },
  {
    key: 'subnet',
    groups: [
      {
        id: 'subnet-corp',
        name: '办公网与研发网',
        description: '按部门划分的常用扫描覆盖网段。',
        owner: 'Network',
        scope: '内网',
        status: 'enabled',
        tags: ['办公网', '研发网'],
        updatedAt: '2026-09-01T19:05:00+08:00',
        entries: [
          {
            id: 'subnet-corp-1',
            value: '10.10.0.0/16',
            scope: '办公网',
            note: '办公区主网段',
            status: 'enabled'
          },
          {
            id: 'subnet-corp-2',
            value: '10.20.32.0/20',
            scope: '研发网',
            note: '研发环境',
            status: 'enabled'
          },
          {
            id: 'subnet-corp-3',
            value: '172.16.48.0/21',
            scope: '共享服务',
            note: '共享服务区',
            status: 'paused'
          }
        ]
      },
      {
        id: 'subnet-cloud',
        name: '云上 VPC',
        description: '云上地址段和边界防护范围。',
        owner: 'CloudOps',
        scope: '云环境',
        status: 'enabled',
        tags: ['云上', 'VPC'],
        updatedAt: '2026-08-30T17:55:00+08:00',
        entries: [
          {
            id: 'subnet-cloud-1',
            value: '100.64.0.0/12',
            scope: '云主机',
            note: '共享云网段',
            status: 'enabled'
          },
          {
            id: 'subnet-cloud-2',
            value: '192.168.100.0/24',
            scope: '测试环境',
            note: '压测与演示网段',
            status: 'enabled'
          }
        ]
      }
    ]
  },
  {
    key: 'passive',
    groups: [
      {
        id: 'passive-collector',
        name: '被动采集总线',
        description: '接收镜像流量、回流结果和规则事件。',
        owner: 'Pipeline',
        scope: '镜像 / 回流',
        status: 'enabled',
        tags: ['采集', '总线'],
        updatedAt: '2026-09-01T21:15:00+08:00',
        entries: [
          {
            id: 'passive-collector-1',
            value: 'http://passive-collector.internal:9000',
            scope: 'HTTP 回流',
            note: '主采集地址',
            status: 'enabled'
          },
          {
            id: 'passive-collector-2',
            value: 'tcp://10.8.12.43:9100',
            scope: '镜像接收',
            note: '流量镜像入口',
            status: 'enabled'
          }
        ]
      },
      {
        id: 'passive-alert',
        name: '告警同步出口',
        description: '被动流量产生的告警同步目标。',
        owner: 'SOC',
        scope: '告警 / Webhook',
        status: 'paused',
        tags: ['告警', '同步'],
        updatedAt: '2026-08-29T14:25:00+08:00',
        entries: [
          {
            id: 'passive-alert-1',
            value: 'https://hooks.example.com/security/passive',
            scope: 'Webhook',
            note: '告警推送',
            status: 'enabled'
          },
          {
            id: 'passive-alert-2',
            value: 'http://10.8.12.58:8080/api/passive',
            scope: '内网出口',
            note: '联动中台',
            status: 'paused'
          }
        ]
      }
    ]
  }
]

export function createAssetConfigState() {
  return ASSET_CONFIG_SEED.map((category) => ({
    ...category,
    groups: category.groups.map((group) => ({
      ...group,
      tags: [...group.tags],
      entries: group.entries.map((entry) => ({ ...entry }))
    }))
  }))
}

export function getAssetConfigCategoryMeta(key) {
  return ASSET_CONFIG_CATEGORY_META[key] ?? {
    label: String(key ?? '').trim() || '未命名配置域',
    icon: 'server',
    summary: '未定义',
    itemLabel: '配置项',
    itemPlaceholder: '请输入配置值',
    itemScopeLabel: '生效范围',
    itemScopePlaceholder: '请输入作用范围',
    itemValueLabel: '配置值',
    theme: 'yellow'
  }
}
