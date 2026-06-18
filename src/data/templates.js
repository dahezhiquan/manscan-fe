export const templateSummaryItems = [
  { key: 'templateCount', label: '模板总数' },
  { key: 'cveTemplateCount', label: 'CVE 数量' },
  { key: 'kevTemplateCount', label: 'KEV 数量' },
  { key: 'fingerprintTemplateCount', label: '指纹数量' }
]

export const templateFilters = [
  '风险等级',
  '标签',
  '协议',
  '产品',
  'KEV',
  'CVE'
]

export const severityFilterOptions = [
  { value: 'critical', label: '严重', englishLabel: 'Critical', tone: 'critical', count: '1.8K' },
  { value: 'high', label: '高危', englishLabel: 'High', tone: 'high', count: '2.9K' },
  { value: 'medium', label: '中危', englishLabel: 'Medium', tone: 'medium', count: '2.8K' },
  { value: 'low', label: '低危', englishLabel: 'Low', tone: 'low', count: '509' },
  { value: 'info', label: '信息', englishLabel: 'Info', tone: 'info', count: '4.9K' }
]

export const protocolFilterOptions = [
  { value: 'http', label: 'Http', count: '11.2K' },
  { value: 'code', label: 'Code', count: '933' },
  { value: 'file', label: 'File', count: '447' },
  { value: 'tcp', label: 'Tcp', count: '284' },
  { value: 'workflow', label: 'Workflow', count: '202' },
  { value: 'javascript', label: 'Javascript', count: '117' },
  { value: 'ssl', label: 'Ssl', count: '38' },
  { value: 'dns', label: 'Dns', count: '32' },
  { value: 'headless', label: 'Headless', count: '26' }
]

export const booleanFilterOptions = [
  { value: 'true', label: 'True' },
  { value: 'false', label: 'False' }
]

export const templateNavTabs = [
  { label: '编辑器', icon: 'editor' },
  { label: '历史记录', icon: 'history' },
  { label: '模板库', icon: 'library', active: true }
]

export const templateDetailMock = {
  id: 'CNVD-2019-01348',
  name: 'Xiuno BBS 安装目录未删除（CNVD-2019-01348）',
  description:
    'Xiuno BBS 若在安装完成后未删除 `/install/` 目录，攻击者仍可直接访问初始化页面并重新进入安装流程。模板通过请求安装目录并匹配安装脚本与语言选择页面特征，验证系统是否处于可重复安装状态。',
  impact:
    '- 攻击者可借助残留安装入口重置数据库连接、覆盖原有部署或重新初始化站点，导致论坛不可用、配置被篡改\n- 甚至进一步接管应用。',
  remediation:
    '- 部署完成后立即删除安装目录、初始化脚本和安装相关静态资源\n- 同时在 Web 服务器层面禁止对安装入口的外部访问\n- 并在上线前加入重复安装检查。',
  severity: '高危',
  protocols: ['http'],
  tags: ['cnvd2019', 'cnvd', 'xiuno', 'vuln'],
  cvssScore: 7.5,
  vendor: '',
  product: '',
  shodanQuery: '',
  fofaQuery: '',
  references: ['https://www.cnvd.org.cn/flaw/show/CNVD-2019-01348'],
  nucleiTemplateName: 'CNVD-2019-01348.yaml',
  nucleiTemplateContent: `id: CNVD-2019-01348

info:
  name: Xiuno BBS 安装目录未删除（CNVD-2019-01348）
  author: princechaddha
  severity: high
  description: |
    Xiuno BBS 若在安装完成后未删除 /install/ 目录，攻击者仍可直接访问初始化页面并重新进入安装流程。
  impact: |
    - 攻击者可借助残留安装入口重置数据库连接、覆盖原有部署或重新初始化站点，导致论坛不可用、配置被篡改
    - 甚至进一步接管应用。
  remediation: |
    - 部署完成后立即删除安装目录、初始化脚本和安装相关静态资源
    - 同时在 Web 服务器层面禁止对安装入口的外部访问
    - 并在上线前加入重复安装检查。
  reference:
    - https://www.cnvd.org.cn/flaw/show/CNVD-2019-01348
  classification:
    cvss-score: 7.5
  tags: cnvd2019,cnvd,xiuno,vuln

http:
  - method: GET
    path:
      - "{{BaseURL}}/install/"

    matchers:
      - type: word
        words:
          - "/view/js/xiuno.js"
          - "Choose Language (选择语言)"`
}
