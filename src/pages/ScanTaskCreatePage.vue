<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { createScanTask } from '../api/scans'
import { getTemplateList, getTemplateProtocols, getTemplateTags } from '../api/templates'
import { protocolFilterOptions, severityFilterOptions } from '../data/templates'
import {
  appendMultiValueParam,
  mapSeverityTone,
  normalizeArray,
  normalizeProtocolOptions,
  normalizeTagOptions,
  toTitleCase
} from '../utils/template'

const props = defineProps({
  navigateTo: {
    type: Function,
    required: true
  }
})

const stepDefinitions = [
  {
    key: 'basic',
    label: '基础信息',
    title: '指定扫描的基础信息',
    description: '先填写任务名称、描述和创建人，方便后续在任务列表中快速识别。',
    accent: 'Base'
  },
  {
    key: 'targets',
    label: '目标配置',
    title: '指定扫描目标与范围',
    description: '这里决定要扫哪些目标、排除哪些范围。',
    accent: 'Target'
  },
  {
    key: 'filters',
    label: '模版选择',
    title: '指定要扫描的模版。',
    description: '通过标签、模板 ID、协议和漏洞严重级别控制本次任务模版覆盖范围。',
    accent: 'Templates'
  },
  {
    key: 'request',
    label: '请求设置',
    title: '指定扫描请求相关设置',
    description: '配置 Header、变量、重定向、SNI、读写限制以及输出细节。',
    accent: 'Signal'
  },
  {
    key: 'runtime',
    label: '运行参数',
    title: '控制并发、重试、超时与执行策略',
    description: '在性能和稳定性之间做平衡，设置扫描线程、速率和 project 行为。',
    accent: 'Pulse'
  },
  {
    key: 'advanced',
    label: '高级能力',
    title: 'Headless、代理、统计与模板控制',
    description: '最后补充无头浏览器、代理链路、统计指标和模板控制类选项。',
    accent: 'Nebula'
  }
]

const attackTypeOptions = [
  { value: 'batteringram', label: 'batteringram' },
  { value: 'pitchfork', label: 'pitchfork' },
  { value: 'clusterbomb', label: 'clusterbomb' }
]

const scanStrategyOptions = [
  { value: 'auto', label: 'auto · 自动适配' },
  { value: 'host-spray', label: 'host-spray · 先按 Host 跑' },
  { value: 'template-spray', label: 'template-spray · 先按模板跑' }
]

const RESPONSE_SIZE_FIELDS = new Set(['response_read_size', 'response_save_size'])
const AUTOMATIC_SCAN_EXCLUDED_FIELDS = new Set(['include_ids', 'tags', 'severities', 'protocols'])
const MB_TO_BYTES = 1024 * 1024

const stepFields = {
  basic: [
    { key: 'name', label: '任务名称', type: 'string', placeholder: '例如：外网域名漏扫' },
    { key: 'description', label: '任务描述', type: 'string', placeholder: '描述本次扫描目标、背景或关注点' },
    { key: 'created_by', label: '创建人', type: 'string', placeholder: '例如：guohongquan_dxm' }
  ],
  targets: [
    {
      key: 'targets',
      label: '目标列表',
      type: 'string[]',
      placeholder: '每行一个目标，例如：https://example.com',
      helper: '',
      itemLabel: '目标'
    },
    {
      key: 'exclude_targets',
      label: '排除目标',
      type: 'string[]',
      placeholder: '每行一个排除项',
      helper: '',
      itemLabel: '排除项'
    }
  ],
  filters: [
    
  ],
  request: [
    {
      key: 'store_response',
      label: '保存响应',
      type: 'boolean',
      tooltip: '是否把扫描过程中的请求/响应内容保存到日志中（会占用更多磁盘空间，且响应里可能包含敏感信息）'
    },
    {
      key: 'timestamp',
      label: '输出带时间戳',
      type: 'boolean',
      tooltip: '输出结果时是否附带时间戳'
    },
    {
      key: 'matcher_status',
      label: '显示模板匹配失败记录',
      type: 'boolean',
      tooltip:
        '模板里会有很多 matcher 判断“这个目标是否命中”，开启后不仅能看到命中的结果，还能看到某些 matcher 是怎么失败的（注意：开启此项后会导致大量的日志输出，大规模扫描时禁用）'
    },
    { key: 'custom_headers', label: '自定义请求头', type: 'string[]', placeholder: '每行一个 Header，例如：X-Test: 1' },
    {
      key: 'vars',
      label: '模板变量',
      type: 'string[]',
      placeholder: '每行一个变量，例如：key=value',
      tooltip: '模板里有必填变量时，在此处填写'
    },
    { key: 'follow_redirects', label: '跟随重定向', type: 'boolean' },
    {
      key: 'follow_host_redirects',
      label: '仅同 Host 跟随重定向',
      type: 'boolean',
      tooltip: '只跟随同一 Host 的重定向，不会跳去别的 Host'
    },
    { key: 'max_redirects', label: '最大重定向次数', type: 'number', min: 0, placeholder: '默认：10' },
    { key: 'disable_redirects', label: '禁用重定向', type: 'boolean' },
    { key: 'force_attempt_http2', label: '强制 HTTP/2', type: 'boolean' },
    {
      key: 'sni',
      label: '自定义 SNI',
      type: 'string',
      placeholder: '例如：example.com',
      tooltip:
        '如果你的目标本身就是正常域名，通常不用额外设置。只有在“连接地址”和“证书/虚拟主机对应域名”不一致时，才需要手动设定 SNI'
    },
    {
      key: 'allow_local_file_access',
      label: '允许本地文件访问',
      type: 'boolean',
      tooltip:
        '这个开关针对需要读取目标机器本地文件的模版，允许突破沙箱限制，去读取本机文件系统上原本受限制的文件'
    },
    {
      key: 'attack_type',
      label: '攻击类型',
      type: 'select',
      options: attackTypeOptions,
      tooltip:
        '你可以把它理解成 Burp Intruder 里那几种攻击模式。1. batteringram：所有位置共用同一个 payload 值。2. pitchfork：多个 payload 列表按相同下标一一配对。3. clusterbomb：对多个 payload 做全组合（笛卡尔积）。'
    },
    { key: 'source_ip', label: '自定义源 IP', type: 'string', placeholder: '例如：192.168.1.10' },
    { key: 'response_read_size', label: '响应读取上限', type: 'number', min: 0, step: 0.1, placeholder: '单位：MB，默认无限制' },
    { key: 'response_save_size', label: '响应保存上限', type: 'number', min: 0, step: 0.1, placeholder: '单位：MB，默认 1 MB' },
    {
      key: 'tls_impersonate',
      label: 'TLS 指纹伪装',
      type: 'boolean',
      tooltip:
        'ManScan 在发起 HTTPS/TLS 连接时，使用指纹随机化伪装方式，让自己的 TLS 握手更像常见浏览器或其他常见客户端，而不是暴露出很“扫描器味”的默认 TLS 指纹'
    }
  ],
  runtime: [
    {
      key: 'rate_limit',
      label: '每秒请求数',
      type: 'number',
      min: 0,
      placeholder: '默认：150',
      tooltip: '这个扫描任务 1 秒钟内，最多发多少个请求。'
    },
    {
      key: 'rate_limit_duration',
      label: '速率窗口（毫秒）',
      type: 'number',
      min: 0,
      placeholder: '默认：1000',
      tooltip: 'rate_limit 这个数量，是按多长时间窗口来计算的，默认每 1000 毫秒最多发 150 个请求。'
    },
    {
      key: 'bulk_size',
      label: '每模板并行主机数',
      type: 'number',
      min: 0,
      placeholder: '默认：25',
      tooltip: '同一个模板，同时最多打多少个目标主机。'
    },
    {
      key: 'template_threads',
      label: '模板并发数',
      type: 'number',
      min: 0,
      placeholder: '默认：25',
      tooltip: '同时最多执行多少个模板。'
    },
    {
      key: 'headless_bulk_size',
      label: '无头模板并行主机数',
      type: 'number',
      min: 0,
      placeholder: '默认：10',
      tooltip: '对于 headless（无头浏览器）模板，同一个模板同时最多跑多少个目标。'
    },
    {
      key: 'headless_template_threads',
      label: '无头模板并发数',
      type: 'number',
      min: 0,
      placeholder: '默认：10',
      tooltip: '同时最多执行多少个 headless 模板。'
    },
    {
      key: 'js_concurrency',
      label: 'JS 并发数',
      type: 'number',
      min: 0,
      placeholder: '默认：120',
      tooltip: '同时最多运行多少个 JavaScript 运行时 / JS 执行任务。'
    },
    {
      key: 'payload_concurrency',
      label: 'Payload 并发数',
      type: 'number',
      min: 0,
      placeholder: '默认：25',
      tooltip: '单个模板在处理 payload 组合、fuzz、爆破类任务时，同时开多少个 payload 执行。'
    },
    {
      key: 'probe_concurrency',
      label: 'Probe 并发数',
      type: 'number',
      min: 0,
      placeholder: '默认：50',
      tooltip: '做目标存活探测 / HTTP 探测时，同时最多探多少个目标。'
    },
    {
      key: 'timeout',
      label: '超时（秒）',
      type: 'number',
      min: 0,
      placeholder: '默认：5',
      tooltip: '单次请求超时秒数。'
    },
    {
      key: 'retries',
      label: '重试次数',
      type: 'number',
      min: 0,
      placeholder: '默认：1',
      tooltip: '单次请求失败后的重试次数。'
    },
    {
      key: 'max_host_error',
      label: '单 Host 最大错误数',
      type: 'number',
      min: 0,
      placeholder: '默认：30',
      tooltip: '单个 host 累计允许的最大错误数，超过后跳过扫描该 host。'
    },
    { key: 'no_host_errors', label: '禁用 Host Error 跳过', type: 'boolean' },
    {
      key: 'project',
      label: '启用 Project 缓存',
      type: 'boolean',
      tooltip: '你可以把它理解成一种“扫描去重缓存”，在本地记录已经发过的请求，避免重复发送相同请求。'
    },
    {
      key: 'project_path',
      label: 'Project 缓存路径',
      type: 'string',
      placeholder: '例如：/tmp/manscan/project-cache',
      tooltip: '指定 project 缓存文件/目录落盘路径，便于复用扫描缓存或按任务隔离。',
      showWhen: (state) => state.project
    },
    {
      key: 'scan_strategy',
      label: '扫描策略',
      type: 'select',
      options: scanStrategyOptions,
      tooltip:
        '决定“模板”和“目标”这两个维度，优先按什么顺序调度扫描。1. auto：让程序自己根据场景做适配。2. host-spray：对一个 host，尽量把相关模板都跑掉，再切下一个 host。3. template-spray：先拿一个模板批量扫很多 host，再换下一个模板。'
    },
    {
      key: 'disable_http_probe',
      label: '禁用 httpx 探测',
      type: 'boolean',
      tooltip: '对“不是完整 URL 的输入”，系统会先做一层 httpx 探测 / 存活探测，此处可以禁用（不推荐禁用此项）。'
    }
  ],
  advanced: [
    {
      key: 'headless',
      label: '启用 Headless',
      type: 'boolean',
      tooltip: '启用浏览器型模板支持。未开启时，headless 模板将被自动跳过。'
    },
    {
      key: 'page_timeout',
      label: 'Headless 页面超时（秒）',
      type: 'number',
      min: 0,
      placeholder: '默认：20',
      tooltip: '在 headless 模式下，一个页面任务最多允许跑多久。'
    },
    {
      key: 'headless_optional_arguments',
      label: 'Headless 额外参数',
      type: 'string[]',
      placeholder: '每行一个参数',
      tooltip: '给 Chrome 额外补充启动参数。'
    },
    {
      key: 'use_installed_chrome',
      label: '使用系统 Chrome',
      type: 'boolean',
      tooltip: '是否优先使用你机器上已经安装的 Chrome，而不是 ManScan 自己的浏览器方案。'
    },
    {
      key: 'cdp_endpoint',
      label: '远程 CDP 地址',
      type: 'string',
      placeholder: '例如：http://127.0.0.1:9222',
      tooltip: '是否连接一个已经存在的远程浏览器，而不是本地自己启动。'
    },
    { key: 'proxy', label: '代理列表', type: 'string[]', placeholder: '每行一个代理地址' },
    { key: 'proxy_internal', label: '内部请求也走代理', type: 'boolean' },
    { key: 'http_stats', label: '开启 HTTP 状态码统计', type: 'boolean' },
    {
      key: 'enable_global_matchers_templates',
      label: '启用全局被动匹配器模板',
      type: 'boolean',
      tooltip:
        '某些模板不自己主动“打请求”，而是去“旁听”其他模板拿到的响应，然后在这些响应上做统一匹配，此处可以开启这些被动旁听的全局模版。'
    }
  ]
}

const form = reactive(createInitialForm())
const activeStep = ref(0)
const isSubmitting = ref(false)
const errorMessage = ref('')
const successPayload = ref(null)
const templateIdKeyword = ref('')
const templateTagSearch = ref('')
const activeTemplateFilterMenu = ref('')
const activeCustomSelectKey = ref('')
const templateSelectedTags = ref([])
const templateSelectedSeverities = ref([])
const templateSelectedProtocols = ref([])
const templateTagOptions = ref([])
const templateProtocolOptions = ref(
  protocolFilterOptions.map((item) => ({
    value: item.value,
    label: item.label,
    count: item.count ?? ''
  }))
)
const templateListLoading = ref(false)
const templateOptionLoading = ref(false)
const selectAllTemplatesLoading = ref(false)
const templateListError = ref('')
const templateAutoLockPulse = ref(false)
const multiLineDrafts = reactive({})
const templateListState = ref({
  page: 1,
  pageSize: 12,
  total: 0,
  totalPages: 0,
  items: []
})

let templateListAbortController = null
let templateTagsAbortController = null
let templateProtocolsAbortController = null
let templateSearchTimer = null
let templateAutoLockTimer = null

const currentStep = computed(() => stepDefinitions[activeStep.value])
const currentFields = computed(() => (stepFields[currentStep.value.key] ?? []).filter((field) => isFieldVisible(field)))
const completionRate = computed(() => `${Math.round(((activeStep.value + 1) / stepDefinitions.length) * 100)}%`)
const filledFieldCount = computed(() => {
  const values = Object.values(form)
  return values.filter((value) => {
    if (typeof value === 'boolean') {
      return value
    }

    if (Array.isArray(value)) {
      return value.length > 0
    }

    return value !== '' && value !== null && value !== undefined
  }).length
})

const targetsSummary = computed(() => (form.targets.length > 0 ? `${form.targets.length} 个目标已准备` : '尚未填写目标'))
const normalizedTemplateRows = computed(() => templateListState.value.items.map((item) => normalizeTemplateItem(item)))
const filteredTagOptions = computed(() => {
  const keyword = templateTagSearch.value.trim().toLowerCase()
  const selectedSet = new Set(templateSelectedTags.value)
  const matched = templateTagOptions.value.filter((item) => {
    if (!keyword) {
      return true
    }

    return item.label.toLowerCase().includes(keyword) || item.value.toLowerCase().includes(keyword)
  })

  matched.sort((left, right) => {
    const leftSelected = selectedSet.has(left.value) ? 1 : 0
    const rightSelected = selectedSet.has(right.value) ? 1 : 0

    if (leftSelected !== rightSelected) {
      return rightSelected - leftSelected
    }

    return left.label.localeCompare(right.label)
  })

  return matched.slice(0, keyword ? 18 : 12)
})
const selectedTemplateSeverityOptions = computed(() =>
  severityFilterOptions.filter((item) => templateSelectedSeverities.value.includes(item.value))
)
const selectedTemplateProtocolOptions = computed(() =>
  templateProtocolOptions.value.filter((item) => templateSelectedProtocols.value.includes(item.value))
)
const templateSeverityButtonLabel = computed(() =>
  formatMultiSelectLabel('风险等级', selectedTemplateSeverityOptions.value, 'englishLabel')
)
const templateProtocolButtonLabel = computed(() =>
  formatMultiSelectLabel('协议', selectedTemplateProtocolOptions.value, 'label')
)
const templateTagButtonLabel = computed(() => {
  if (!templateSelectedTags.value.length) {
    return '标签'
  }

  if (templateSelectedTags.value.length === 1) {
    return `标签 · ${templateSelectedTags.value[0]}`
  }

  return `标签 · 已选 ${templateSelectedTags.value.length} 项`
})
const templatePaginationStart = computed(() => {
  if (templateListState.value.total === 0 || normalizedTemplateRows.value.length === 0) {
    return 0
  }

  return (templateListState.value.page - 1) * templateListState.value.pageSize + 1
})
const templatePaginationEnd = computed(() => {
  if (templateListState.value.total === 0 || normalizedTemplateRows.value.length === 0) {
    return 0
  }

  return Math.min(
    (templateListState.value.page - 1) * templateListState.value.pageSize + normalizedTemplateRows.value.length,
    templateListState.value.total
  )
})
const currentPageTemplateIds = computed(() => normalizedTemplateRows.value.map((item) => item.id).filter(Boolean))
const isCurrentPageFullySelected = computed(
  () => currentPageTemplateIds.value.length > 0 && currentPageTemplateIds.value.every((id) => isTemplateSelected(id))
)
const isAutomaticScanEnabled = computed(() => form.automatic_scan)
const templateResultsSummary = computed(() => {
  if (templateListLoading.value) {
    return '正在加载模板...'
  }

  return `第 ${templatePaginationStart.value} - ${templatePaginationEnd.value} 条 / 共 ${templateListState.value.total} 条`
})
const visibleTemplatePages = computed(() => {
  const totalPages = templateListState.value.totalPages

  if (totalPages <= 1) {
    return [1]
  }

  const current = templateListState.value.page
  const start = Math.max(1, current - 2)
  const end = Math.min(totalPages, current + 2)
  const pages = []

  for (let page = start; page <= end; page += 1) {
    pages.push(page)
  }

  return pages
})
const hasTemplateFilters = computed(
  () =>
    Boolean(templateIdKeyword.value.trim()) ||
    templateSelectedTags.value.length > 0 ||
    templateSelectedSeverities.value.length > 0 ||
    templateSelectedProtocols.value.length > 0
)

function createInitialForm() {
  return {
    name: '',
    description: '',
    created_by: '',
    targets: [],
    exclude_targets: [],
    scan_all_ips: false,
    tags: [],
    include_ids: [],
    severities: [],
    protocols: [],
    store_response: false,
    timestamp: true,
    matcher_status: false,
    custom_headers: [],
    vars: [],
    follow_redirects: false,
    follow_host_redirects: true,
    max_redirects: null,
    disable_redirects: false,
    force_attempt_http2: false,
    sni: '',
    allow_local_file_access: false,
    attack_type: 'batteringram',
    source_ip: '',
    response_read_size: null,
    response_save_size: null,
    tls_impersonate: false,
    rate_limit: null,
    rate_limit_duration: null,
    bulk_size: null,
    template_threads: null,
    headless_bulk_size: null,
    headless_template_threads: null,
    js_concurrency: null,
    payload_concurrency: null,
    probe_concurrency: null,
    timeout: null,
    retries: null,
    max_host_error: null,
    no_host_errors: false,
    project: false,
    project_path: '',
    scan_strategy: 'auto',
    disable_http_probe: false,
    headless: false,
    page_timeout: null,
    show_browser: false,
    headless_optional_arguments: [],
    use_installed_chrome: false,
    cdp_endpoint: '',
    show_actions: false,
    proxy: [],
    proxy_internal: false,
    enable_progress_bar: false,
    stats_interval: null,
    metrics_port: null,
    http_stats: false,
    new_templates: false,
    automatic_scan: false,
    enable_global_matchers_templates: false
  }
}

function linesToArray(value) {
  return String(value ?? '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function arrayToLines(value) {
  return Array.isArray(value) ? value.join('\n') : ''
}

function formatFieldType(type) {
  if (type === 'string[]') {
    return '多行文本 / string[]'
  }

  if (type === 'boolean') {
    return '开关 / boolean'
  }

  if (type === 'number') {
    return '数字 / number'
  }

  return '文本 / string'
}

function formatMultiSelectLabel(baseLabel, selectedItems, labelKey) {
  if (selectedItems.length === 0) {
    return baseLabel
  }

  if (selectedItems.length === 1) {
    return `${baseLabel} · ${selectedItems[0][labelKey]}`
  }

  return `${baseLabel} · 已选 ${selectedItems.length} 项`
}

function buildTemplateListState(data, page, pageSizeFallback = templateListState.value.pageSize) {
  const nextState = {
    page: Number(data?.page) || page,
    pageSize: Number(data?.pageSize) || pageSizeFallback,
    total: Number(data?.total) || 0,
    totalPages: Number(data?.totalPages) || 0,
    items: Array.isArray(data?.items) ? data.items : []
  }

  if (!nextState.totalPages && nextState.total > 0) {
    nextState.totalPages = Math.ceil(nextState.total / nextState.pageSize)
  }

  return nextState
}

function formatSeverityLabel(severity) {
  const normalized = String(severity ?? '').trim().toLowerCase()
  const matched = severityFilterOptions.find((item) => item.value === normalized)

  if (matched) {
    return matched.label
  }

  if (!normalized) {
    return '未定义'
  }

  return String(severity).trim()
}

function formatProtocolLabel(protocol) {
  const normalized = String(protocol ?? '').trim().toLowerCase()
  const matched = templateProtocolOptions.value.find((item) => item.value === normalized)

  if (matched) {
    return matched.label
  }

  return toTitleCase(normalized)
}

function normalizeTemplateItem(item) {
  return {
    id: String(item?.id ?? '').trim(),
    name: String(item?.name ?? '').trim() || '未命名模板',
    description: String(item?.description ?? '').trim() || '暂无模板描述',
    severity: formatSeverityLabel(item?.severity),
    severityTone: mapSeverityTone(item?.severity),
    author: String(item?.author ?? item?.template_author ?? '').trim() || '--',
    protocols: normalizeArray(item?.protocols ?? item?.protocol),
    tags: normalizeArray(item?.tags)
  }
}

function buildTemplateListParams(page = 1, pageSize = templateListState.value.pageSize) {
  return {
    page,
    pageSize,
    keyword: templateIdKeyword.value,
    tags: templateSelectedTags.value,
    severity: templateSelectedSeverities.value,
    protocol: templateSelectedProtocols.value
  }
}

function isTextareaField(field) {
  return field.type === 'string[]' || field.textarea
}

function isSelectField(field) {
  return field.type === 'select'
}

function isFieldVisible(field) {
  if (typeof field.showWhen === 'function') {
    return field.showWhen(form)
  }

  return true
}

function getFieldValue(field) {
  const value = form[field.key]

  if (field.type === 'string[]') {
    return multiLineDrafts[field.key] ?? arrayToLines(value)
  }

  if (field.type === 'number') {
    return value ?? ''
  }

  return value
}

function updateFieldValue(field, event) {
  const rawValue = event.target.value

  if (field.type === 'string[]') {
    multiLineDrafts[field.key] = rawValue
    form[field.key] = linesToArray(rawValue)
    return
  }

  if (field.type === 'number') {
    form[field.key] = rawValue === '' ? null : Number(rawValue)
    return
  }

  form[field.key] = rawValue
}

function handleNumberFieldWheel(event) {
  const input = event.currentTarget

  if (!(input instanceof HTMLInputElement) || input.type !== 'number') {
    return
  }

  if (document.activeElement === input) {
    input.blur()
  }
}

function getArrayFieldMeta(field) {
  if (field.type !== 'string[]') {
    return null
  }

  const rawValue = multiLineDrafts[field.key] ?? arrayToLines(form[field.key])
  const items = linesToArray(rawValue)
  const itemLabel = field.itemLabel || '条目'
  const helper = field.helper || ''

  return {
    helper,
    summary: items.length > 0 ? `已识别 ${items.length} 个${itemLabel}` : `暂未识别到${itemLabel}`
  }
}

function toggleBooleanField(field) {
  form[field.key] = !form[field.key]
}

function goToStep(index) {
  activeStep.value = index
  errorMessage.value = ''
}

function goPrev() {
  if (activeStep.value > 0) {
    activeStep.value -= 1
    errorMessage.value = ''
  }
}

function triggerTemplateAutoLockPulse() {
  window.clearTimeout(templateAutoLockTimer)
  templateAutoLockPulse.value = true
  templateAutoLockTimer = window.setTimeout(() => {
    templateAutoLockPulse.value = false
  }, 1400)
}

function toggleAutomaticScanMode() {
  form.automatic_scan = !form.automatic_scan
  closeTemplateFilterMenu()

  if (form.automatic_scan) {
    triggerTemplateAutoLockPulse()
    return
  }

  window.clearTimeout(templateAutoLockTimer)
  templateAutoLockPulse.value = false
}

function toggleTemplateTag(tagValue) {
  if (isAutomaticScanEnabled.value) {
    return
  }

  templateSelectedTags.value = templateSelectedTags.value.includes(tagValue)
    ? templateSelectedTags.value.filter((item) => item !== tagValue)
    : [...templateSelectedTags.value, tagValue]
}

function toggleTemplateSeverity(value) {
  if (isAutomaticScanEnabled.value) {
    return
  }

  templateSelectedSeverities.value = templateSelectedSeverities.value.includes(value)
    ? templateSelectedSeverities.value.filter((item) => item !== value)
    : [...templateSelectedSeverities.value, value]
}

function toggleTemplateProtocol(value) {
  if (isAutomaticScanEnabled.value) {
    return
  }

  templateSelectedProtocols.value = templateSelectedProtocols.value.includes(value)
    ? templateSelectedProtocols.value.filter((item) => item !== value)
    : [...templateSelectedProtocols.value, value]
}

function clearTemplateFilters() {
  if (isAutomaticScanEnabled.value) {
    return
  }

  templateIdKeyword.value = ''
  templateTagSearch.value = ''
  templateSelectedTags.value = []
  templateSelectedSeverities.value = []
  templateSelectedProtocols.value = []
  activeTemplateFilterMenu.value = ''
}

function clearSelectedTemplates() {
  if (isAutomaticScanEnabled.value) {
    return
  }

  form.include_ids = []
}

function isTemplateMenuOpen(name) {
  return activeTemplateFilterMenu.value === name
}

function toggleTemplateFilterMenu(name) {
  if (isAutomaticScanEnabled.value) {
    return
  }

  activeTemplateFilterMenu.value = activeTemplateFilterMenu.value === name ? '' : name
}

function closeTemplateFilterMenu() {
  activeTemplateFilterMenu.value = ''
}

function isCustomSelectOpen(fieldKey) {
  return activeCustomSelectKey.value === fieldKey
}

function toggleCustomSelect(fieldKey) {
  activeCustomSelectKey.value = activeCustomSelectKey.value === fieldKey ? '' : fieldKey
}

function closeCustomSelect() {
  activeCustomSelectKey.value = ''
}

function getSelectOptionLabel(field) {
  return field.options?.find((option) => option.value === form[field.key])?.label ?? ''
}

function selectFieldOption(field, value) {
  form[field.key] = value
  closeCustomSelect()
}

function appendSelectedTemplateIds(templateIds) {
  const nextIds = new Set(form.include_ids)
  templateIds.filter(Boolean).forEach((id) => nextIds.add(id))
  form.include_ids = [...nextIds]
}

function removeSelectedTemplateIds(templateIds) {
  const removedIds = new Set(templateIds)
  form.include_ids = form.include_ids.filter((id) => !removedIds.has(id))
}

function isTemplateSelected(templateId) {
  return form.include_ids.includes(templateId)
}

function toggleTemplateSelection(template) {
  if (isAutomaticScanEnabled.value || !template.id) {
    return
  }

  if (isTemplateSelected(template.id)) {
    form.include_ids = form.include_ids.filter((item) => item !== template.id)
    return
  }

  appendSelectedTemplateIds([template.id])
}

function toggleCurrentPageSelection() {
  if (isAutomaticScanEnabled.value) {
    return
  }

  if (!currentPageTemplateIds.value.length) {
    return
  }

  if (isCurrentPageFullySelected.value) {
    removeSelectedTemplateIds(currentPageTemplateIds.value)
    return
  }

  appendSelectedTemplateIds(currentPageTemplateIds.value)
}

async function selectAllFilteredTemplates() {
  if (isAutomaticScanEnabled.value) {
    return
  }

  if (!templateListState.value.total || selectAllTemplatesLoading.value) {
    return
  }

  selectAllTemplatesLoading.value = true
  templateListError.value = ''

  try {
    const allIds = new Set(currentPageTemplateIds.value)
    const totalPages = Math.max(1, templateListState.value.totalPages)

    for (let page = 1; page <= totalPages; page += 1) {
      if (isAutomaticScanEnabled.value) {
        return
      }

      if (page === templateListState.value.page && currentPageTemplateIds.value.length > 0) {
        continue
      }

      const data = await getTemplateList(buildTemplateListParams(page))
      const pageState = buildTemplateListState(data, page)
      pageState.items
        .map((item) => normalizeTemplateItem(item).id)
        .filter(Boolean)
        .forEach((id) => allIds.add(id))
    }

    if (isAutomaticScanEnabled.value) {
      return
    }

    appendSelectedTemplateIds([...allIds])
  } catch (error) {
    console.error('全选模板失败:', error)
    templateListError.value = '全部全选失败，请稍后重试。'
  } finally {
    selectAllTemplatesLoading.value = false
  }
}

function scheduleTemplateFetch() {
  window.clearTimeout(templateSearchTimer)
  templateSearchTimer = window.setTimeout(() => {
    fetchTemplateList(1)
  }, 260)
}

async function fetchTemplateTags() {
  templateTagsAbortController?.abort()
  templateTagsAbortController = new AbortController()

  try {
    const data = await getTemplateTags(templateTagsAbortController.signal)
    templateTagOptions.value = normalizeTagOptions(data)
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('加载模板标签失败:', error)
      templateTagOptions.value = []
    }
  }
}

async function fetchTemplateProtocols() {
  templateProtocolsAbortController?.abort()
  templateProtocolsAbortController = new AbortController()

  try {
    const data = await getTemplateProtocols(templateProtocolsAbortController.signal)
    const normalized = normalizeProtocolOptions(data)

    if (normalized.length) {
      templateProtocolOptions.value = normalized
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('加载模板协议失败:', error)
    }
  }
}

async function fetchTemplateOptions() {
  templateOptionLoading.value = true

  try {
    await Promise.allSettled([fetchTemplateTags(), fetchTemplateProtocols()])
  } finally {
    templateOptionLoading.value = false
  }
}

async function fetchTemplateList(page = 1) {
  templateListAbortController?.abort()
  templateListAbortController = new AbortController()
  templateListLoading.value = true
  templateListError.value = ''

  try {
    const data = await getTemplateList(buildTemplateListParams(page), templateListAbortController.signal)
    templateListState.value = buildTemplateListState(data, page)
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('加载模板列表失败:', error)
      templateListError.value = '模板列表加载失败，请稍后重试。'
      templateListState.value = {
        page,
        pageSize: templateListState.value.pageSize,
        total: 0,
        totalPages: 0,
        items: []
      }
    }
  } finally {
    templateListLoading.value = false
  }
}

function changeTemplatePage(page) {
  if (isAutomaticScanEnabled.value) {
    return
  }

  if (page < 1 || page > Math.max(1, templateListState.value.totalPages) || page === templateListState.value.page) {
    return
  }

  fetchTemplateList(page)
}

function handleGlobalKeydown(event) {
  if (event.key === 'Escape' && (activeTemplateFilterMenu.value || activeCustomSelectKey.value)) {
    closeTemplateFilterMenu()
    closeCustomSelect()
  }
}

function handleGlobalPointerDown(event) {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  if (activeTemplateFilterMenu.value && !target.closest('.scan-template-library-filters')) {
    closeTemplateFilterMenu()
  }

  if (activeCustomSelectKey.value && !target.closest('.scan-create-select')) {
    closeCustomSelect()
  }
}

function goNext() {
  if (activeStep.value < stepDefinitions.length - 1) {
    activeStep.value += 1
    errorMessage.value = ''
  }
}

function buildPayload() {
  const payload = {}

  Object.entries(multiLineDrafts).forEach(([key, value]) => {
    if (Array.isArray(form[key])) {
      form[key] = linesToArray(value)
    }
  })

  for (const [key, value] of Object.entries(form)) {
    if (form.automatic_scan && AUTOMATIC_SCAN_EXCLUDED_FIELDS.has(key)) {
      continue
    }

    if (typeof value === 'boolean') {
      if (value) {
        payload[key] = value
      }
      continue
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        payload[key] = value
      }
      continue
    }

    if (typeof value === 'number') {
      if (!Number.isNaN(value)) {
        payload[key] = RESPONSE_SIZE_FIELDS.has(key) ? Math.round(value * MB_TO_BYTES) : value
      }
      continue
    }

    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) {
        payload[key] = trimmed
      }
    }
  }

  return payload
}

function resolveCreatedTaskDetailPath(payload) {
  const taskId = payload?.task?.id

  if (taskId !== null && taskId !== undefined && taskId !== '') {
    return `/scans/${taskId}`
  }

  const taskApi = String(payload?.task_api ?? '').trim()
  const match = taskApi.match(/\/api\/(?:v1\/)?scans\/([^/?#]+)/)

  if (match?.[1]) {
    return `/scans/${match[1]}`
  }

  return ''
}

async function submitTask() {
  errorMessage.value = ''
  successPayload.value = null

  if (form.targets.length === 0) {
    errorMessage.value = '请至少填写一个目标。'
    activeStep.value = 1
    return
  }

  isSubmitting.value = true

  try {
    const data = await createScanTask(buildPayload())

    successPayload.value = data

    const detailPath = resolveCreatedTaskDetailPath(data)

    if (detailPath) {
      props.navigateTo(detailPath)
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '请求失败，请检查网络或后端服务。'
  } finally {
    isSubmitting.value = false
  }
}

watch(
  [templateIdKeyword, templateSelectedTags, templateSelectedSeverities, templateSelectedProtocols],
  () => {
    form.tags = []
    form.severities = []
    form.protocols = []
    scheduleTemplateFetch()
  },
  { deep: true }
)

onMounted(() => {
  fetchTemplateOptions()
  fetchTemplateList(1)
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('pointerdown', handleGlobalPointerDown)
})

onBeforeUnmount(() => {
  templateListAbortController?.abort()
  templateTagsAbortController?.abort()
  templateProtocolsAbortController?.abort()
  window.clearTimeout(templateSearchTimer)
  window.clearTimeout(templateAutoLockTimer)
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('pointerdown', handleGlobalPointerDown)
})
</script>

<template>
  <main class="scan-create-page">
    <section class="scan-create-hero">
      <div class="scan-create-hero-copy">
        <h1>创建扫描任务</h1>
        <div class="scan-create-checklist-card">
          <span class="scan-create-checklist-label">度小满安全扫描前 checklist</span>
          <a
            class="scan-create-checklist-link"
            href="https://duxiaoman.feishu.cn/wiki/RzScwHpGZiMhrGkrZ8ych8I2nxb?fromScene=spaceOverview"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>打开检查清单</span>
            <span class="scan-create-checklist-link-icon" aria-hidden="true">↗</span>
          </a>
        </div>
      </div>

      <div class="scan-create-hero-panel">
        <div>
          <span class="scan-create-panel-label">进度</span>
          <strong>{{ completionRate }}</strong>
        </div>
        <div>
          <span class="scan-create-panel-label">已填字段</span>
          <strong>{{ filledFieldCount }}</strong>
        </div>
        <div>
          <span class="scan-create-panel-label">目标状态</span>
          <strong>{{ targetsSummary }}</strong>
        </div>
      </div>
    </section>

    <section class="scan-create-shell">
      <aside class="scan-create-steps">
        <button
          v-for="(step, index) in stepDefinitions"
          :key="step.key"
          class="scan-create-step"
          :class="{ 'is-active': index === activeStep }"
          type="button"
          @click="goToStep(index)"
        >
          <span class="scan-create-step-index">0{{ index + 1 }}</span>
          <span class="scan-create-step-copy">
            <strong>{{ step.label }}</strong>
            <small>{{ step.accent }}</small>
          </span>
        </button>
      </aside>

      <section class="scan-create-form-card">
        <header class="scan-create-form-header">
          <div>
            <span class="scan-create-form-badge">{{ currentStep.accent }}</span>
            <h2>{{ currentStep.title }}</h2>
            <p>{{ currentStep.description }}</p>
          </div>

          <button class="scan-create-ghost-button" type="button" @click="props.navigateTo('/scans')">
            返回任务列表
          </button>
        </header>

        <div v-if="currentStep.key === 'filters'" class="scan-template-picker">
          <section
            class="scan-template-inline-shell"
            :class="{
              'is-automatic-scan': isAutomaticScanEnabled,
              'is-automatic-scan-pulse': templateAutoLockPulse
            }"
            aria-label="选择扫描模板"
          >
            <div v-if="templateAutoLockPulse" class="scan-template-auto-lock-overlay" aria-hidden="true">
              <div class="scan-template-auto-lock-core">
                <span class="scan-template-auto-lock-kicker">AUTO MAPPING</span>
                <strong>手动模板选择已锁定</strong>
                <span>自动模板映射扫描已接管模板调度</span>
              </div>
            </div>

            <section class="scan-template-library-panel">
              <div class="scan-template-library-toolbar">
                <div class="scan-template-library-filters">
                  <label class="scan-template-library-search" :class="{ 'is-locked': isAutomaticScanEnabled }">
                    <span v-if="isAutomaticScanEnabled" class="scan-template-lock-mark" aria-hidden="true">AUTO</span>
                    <input
                      v-model="templateIdKeyword"
                      type="text"
                      :disabled="isAutomaticScanEnabled"
                      placeholder="搜索模板，例如：CVE-2024-12345"
                    />
                    <span class="scan-template-library-search-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <circle cx="11" cy="11" r="6.5" />
                        <path d="m16 16 4 4" />
                      </svg>
                    </span>
                  </label>

                  <div class="scan-template-library-filter-wrap" :class="{ 'is-locked': isAutomaticScanEnabled }">
                    <span v-if="isAutomaticScanEnabled" class="scan-template-lock-mark" aria-hidden="true">AUTO</span>
                    <button
                      class="scan-template-library-filter-button"
                      :class="{ 'is-active': isTemplateMenuOpen('severity') || templateSelectedSeverities.length > 0 }"
                      type="button"
                      :disabled="isAutomaticScanEnabled"
                      @click.stop="toggleTemplateFilterMenu('severity')"
                    >
                      <span>{{ templateSeverityButtonLabel }}</span>
                      <svg class="scan-template-library-filter-caret" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                        <path d="M3.5 6 8 10.5 12.5 6" />
                      </svg>
                    </button>

                    <div v-if="isTemplateMenuOpen('severity')" class="scan-template-library-menu">
                      <button
                        v-for="option in severityFilterOptions"
                        :key="option.value"
                        class="scan-template-library-menu-item"
                        type="button"
                        @click.stop="toggleTemplateSeverity(option.value)"
                      >
                        <span
                          class="scan-template-library-menu-check"
                          :class="{ 'is-selected': templateSelectedSeverities.includes(option.value) }"
                          aria-hidden="true"
                        ></span>
                        <span class="scan-template-library-menu-label">
                          <strong>{{ option.label }}</strong>
                          <small>{{ option.englishLabel }}</small>
                        </span>
                      </button>
                    </div>
                  </div>

                  <div class="scan-template-library-filter-wrap" :class="{ 'is-locked': isAutomaticScanEnabled }">
                    <span v-if="isAutomaticScanEnabled" class="scan-template-lock-mark" aria-hidden="true">AUTO</span>
                    <button
                      class="scan-template-library-filter-button"
                      :class="{ 'is-active': isTemplateMenuOpen('tags') || templateSelectedTags.length > 0 }"
                      type="button"
                      :disabled="isAutomaticScanEnabled"
                      @click.stop="toggleTemplateFilterMenu('tags')"
                    >
                      <span>{{ templateTagButtonLabel }}</span>
                      <svg class="scan-template-library-filter-caret" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                        <path d="M3.5 6 8 10.5 12.5 6" />
                      </svg>
                    </button>

                    <div v-if="isTemplateMenuOpen('tags')" class="scan-template-library-menu scan-template-library-tag-menu">
                      <div class="scan-template-library-menu-search">
                        <input
                          v-model="templateTagSearch"
                          type="text"
                          placeholder="搜索标签，例如：tomcat / xss / thinkphp"
                        />
                      </div>

                      <div v-if="templateSelectedTags.length > 0" class="scan-template-library-selected-tags">
                        <button
                          v-for="tag in templateSelectedTags"
                          :key="tag"
                          class="scan-template-library-selected-tag"
                          type="button"
                          @click.stop="toggleTemplateTag(tag)"
                        >
                          <span>#{{ tag }}</span>
                          <small>移除</small>
                        </button>
                      </div>

                      <div class="scan-template-library-menu-list">
                        <button
                          v-for="tag in filteredTagOptions"
                          :key="tag.value"
                          class="scan-template-library-menu-item"
                          type="button"
                          @click.stop="toggleTemplateTag(tag.value)"
                        >
                          <span
                            class="scan-template-library-menu-check"
                            :class="{ 'is-selected': templateSelectedTags.includes(tag.value) }"
                            aria-hidden="true"
                          ></span>
                          <span class="scan-template-library-menu-label">
                            <strong>#{{ tag.label }}</strong>
                            <small v-if="tag.count">{{ tag.count }}</small>
                          </span>
                        </button>

                        <p v-if="filteredTagOptions.length === 0" class="scan-template-library-empty-hint">
                          没有匹配到标签，请换个关键词试试。
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    class="scan-template-library-filter-wrap is-menu-align-right"
                    :class="{ 'is-locked': isAutomaticScanEnabled }"
                  >
                    <span v-if="isAutomaticScanEnabled" class="scan-template-lock-mark" aria-hidden="true">AUTO</span>
                    <button
                      class="scan-template-library-filter-button"
                      :class="{ 'is-active': isTemplateMenuOpen('protocol') || templateSelectedProtocols.length > 0 }"
                      type="button"
                      :disabled="isAutomaticScanEnabled"
                      @click.stop="toggleTemplateFilterMenu('protocol')"
                    >
                      <span>{{ templateProtocolButtonLabel }}</span>
                      <svg class="scan-template-library-filter-caret" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                        <path d="M3.5 6 8 10.5 12.5 6" />
                      </svg>
                    </button>

                    <div v-if="isTemplateMenuOpen('protocol')" class="scan-template-library-menu">
                      <button
                        v-for="option in templateProtocolOptions"
                        :key="option.value"
                        class="scan-template-library-menu-item"
                        type="button"
                        @click.stop="toggleTemplateProtocol(option.value)"
                      >
                        <span
                          class="scan-template-library-menu-check"
                          :class="{ 'is-selected': templateSelectedProtocols.includes(option.value) }"
                          aria-hidden="true"
                        ></span>
                        <span class="scan-template-library-menu-label">
                          <strong>{{ option.label }}</strong>
                          <small v-if="option.count">{{ option.count }}</small>
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <div class="scan-template-toolbar-actions scan-template-library-actions">
                  <div class="scan-template-selection-summary is-inline-bar">
                    <div>
                      <strong>{{ form.include_ids.length }}</strong>
                      <span>已选模板</span>
                    </div>
                  </div>

                  <div class="scan-template-inline-actions">
                    <button
                      class="scan-create-secondary-button scan-template-auto-toggle"
                      :class="{ 'is-active': isAutomaticScanEnabled }"
                      type="button"
                      @click="toggleAutomaticScanMode"
                    >
                      {{ isAutomaticScanEnabled ? '自动模板映射扫描 · 已开启' : '自动模板映射扫描' }}
                    </button>
                    <button
                      class="scan-create-secondary-button"
                      type="button"
                      :class="{ 'is-locked': isAutomaticScanEnabled }"
                      :disabled="isAutomaticScanEnabled || templateListLoading || currentPageTemplateIds.length === 0"
                      @click="toggleCurrentPageSelection"
                    >
                      <span v-if="isAutomaticScanEnabled" class="scan-template-lock-mark" aria-hidden="true">AUTO</span>
                      {{ isCurrentPageFullySelected ? '取消本页全选' : '本页全选' }}
                    </button>
                    <button
                      class="scan-create-secondary-button"
                      type="button"
                      :class="{ 'is-locked': isAutomaticScanEnabled }"
                      :disabled="isAutomaticScanEnabled || templateListLoading || selectAllTemplatesLoading || templateListState.total === 0"
                      @click="selectAllFilteredTemplates"
                    >
                      <span v-if="isAutomaticScanEnabled" class="scan-template-lock-mark" aria-hidden="true">AUTO</span>
                      {{ selectAllTemplatesLoading ? '全选中...' : `全部全选（${templateListState.total}）` }}
                    </button>
                    <button
                      class="scan-create-secondary-button"
                      type="button"
                      :class="{ 'is-locked': isAutomaticScanEnabled }"
                      :disabled="isAutomaticScanEnabled || !hasTemplateFilters"
                      @click="clearTemplateFilters"
                    >
                      <span v-if="isAutomaticScanEnabled" class="scan-template-lock-mark" aria-hidden="true">AUTO</span>
                      清空筛选
                    </button>
                    <button
                      class="scan-create-secondary-button"
                      type="button"
                      :class="{ 'is-locked': isAutomaticScanEnabled }"
                      :disabled="isAutomaticScanEnabled || form.include_ids.length === 0"
                      @click="clearSelectedTemplates"
                    >
                      <span v-if="isAutomaticScanEnabled" class="scan-template-lock-mark" aria-hidden="true">AUTO</span>
                      清空已选
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section class="scan-template-results">
              <header class="scan-template-results-header">
                <div class="scan-template-selection-summary">
                  <h3>模板结果</h3>
                </div>
                <div class="scan-template-results-meta">
                  <span>{{ templateResultsSummary }}</span>
                </div>
              </header>

              <div v-if="isAutomaticScanEnabled" class="scan-template-auto-lock-banner">
                <strong>自动模板映射扫描已开启</strong>
                <span>当前模板筛选、批量选择、分页与手动选择列表已禁用。</span>
              </div>

              <p v-if="templateListError" class="scan-create-status is-error">{{ templateListError }}</p>

              <div v-if="templateListLoading" class="scan-template-library-table">
                <article v-for="index in 6" :key="`template-skeleton-${index}`" class="scan-template-library-row is-skeleton">
                  <div class="scan-template-library-main-cell">
                    <div class="scan-template-library-skeleton title"></div>
                    <div class="scan-template-library-skeleton inline"></div>
                  </div>
                  <div class="scan-template-library-id-cell">
                    <div class="scan-template-library-skeleton pill"></div>
                  </div>
                  <div class="scan-template-library-state-cell">
                    <div class="scan-template-library-skeleton button"></div>
                  </div>
                </article>
              </div>

              <div v-else-if="normalizedTemplateRows.length > 0" class="scan-template-library-table">
                <article
                  v-for="template in normalizedTemplateRows"
                  :key="template.id"
                  class="scan-template-library-row"
                  :class="{
                    'is-selected': isTemplateSelected(template.id),
                    'is-disabled': isAutomaticScanEnabled
                  }"
                  role="button"
                  :tabindex="isAutomaticScanEnabled ? -1 : 0"
                  :aria-pressed="isTemplateSelected(template.id)"
                  :aria-disabled="isAutomaticScanEnabled ? 'true' : 'false'"
                  @click="toggleTemplateSelection(template)"
                  @keydown.enter.prevent="toggleTemplateSelection(template)"
                  @keydown.space.prevent="toggleTemplateSelection(template)"
                >
                  <span v-if="isAutomaticScanEnabled" class="scan-template-lock-mark" aria-hidden="true">AUTO</span>
                  <div class="scan-template-library-main-cell">
                    <h4>{{ template.name }}</h4>
                    <p>{{ template.id }}</p>
                  </div>

                  <div class="scan-template-library-id-cell">
                    <span class="scan-template-severity" :class="`is-${template.severityTone}`">{{ template.severity }}</span>
                  </div>

                  <div class="scan-template-library-state-cell">
                    <span class="scan-template-row-state" :class="{ 'is-selected': isTemplateSelected(template.id) }">
                      {{ isTemplateSelected(template.id) ? '已选择' : '点击选择' }}
                    </span>
                  </div>
                </article>
              </div>

              <div v-else class="scan-template-empty-state">
                <strong>{{ templateListLoading ? '正在为你检索模板…' : '没有匹配的模板' }}</strong>
                <span>{{ hasTemplateFilters ? '可以放宽筛选条件后再试。' : '先输入模板 ID 或选择标签、严重级别、协议来缩小范围。' }}</span>
              </div>

              <footer class="scan-template-pagination">
                <button
                  class="scan-create-secondary-button"
                  type="button"
                  :class="{ 'is-locked': isAutomaticScanEnabled }"
                  :disabled="isAutomaticScanEnabled || templateListLoading || templateListState.page <= 1"
                  @click="changeTemplatePage(templateListState.page - 1)"
                >
                  <span v-if="isAutomaticScanEnabled" class="scan-template-lock-mark" aria-hidden="true">AUTO</span>
                  上一页
                </button>

                <div class="scan-template-pagination-pages">
                  <button
                    v-for="page in visibleTemplatePages"
                    :key="page"
                    class="scan-template-page-button"
                    :class="{
                      'is-active': page === templateListState.page,
                      'is-locked': isAutomaticScanEnabled
                    }"
                    type="button"
                    :disabled="isAutomaticScanEnabled"
                    @click="changeTemplatePage(page)"
                  >
                    <span v-if="isAutomaticScanEnabled" class="scan-template-lock-mark" aria-hidden="true">AUTO</span>
                    {{ page }}
                  </button>
                </div>

                <button
                  class="scan-create-secondary-button"
                  type="button"
                  :class="{ 'is-locked': isAutomaticScanEnabled }"
                  :disabled="isAutomaticScanEnabled || templateListLoading || templateListState.page >= Math.max(1, templateListState.totalPages)"
                  @click="changeTemplatePage(templateListState.page + 1)"
                >
                  <span v-if="isAutomaticScanEnabled" class="scan-template-lock-mark" aria-hidden="true">AUTO</span>
                  下一页
                </button>
              </footer>
            </section>
          </section>
        </div>
        <div v-else class="scan-create-grid">
          <article
            v-for="field in currentFields"
            :key="field.key"
            class="scan-create-field"
            :class="{
              'is-boolean': field.type === 'boolean',
              'is-full': field.type === 'string[]' || field.textarea
            }"
          >
            <div class="scan-create-field-head">
              <div>
                <div class="scan-create-field-title-row">
                  <h3>{{ field.label }}</h3>
                  <span v-if="field.tooltip" class="scan-create-field-tooltip-anchor" tabindex="0" aria-label="查看字段说明">
                    <span class="scan-create-field-tooltip-icon">?</span>
                    <span class="scan-create-field-tooltip" role="tooltip">
                      {{ field.tooltip }}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <button
              v-if="field.type === 'boolean'"
              class="scan-create-switch"
              :class="{ 'is-on': form[field.key] }"
              type="button"
              @click="toggleBooleanField(field)"
            >
              <span class="scan-create-switch-track">
                <span class="scan-create-switch-thumb"></span>
              </span>
              <span class="scan-create-switch-text">{{ form[field.key] ? '已启用' : '未启用' }}</span>
            </button>

            <template v-else-if="isTextareaField(field)">
              <textarea
                :value="getFieldValue(field)"
                :placeholder="field.placeholder"
                rows="6"
                @input="updateFieldValue(field, $event)"
              ></textarea>
              <div v-if="field.type === 'string[]'" class="scan-create-field-note">
                <span>{{ getArrayFieldMeta(field)?.helper }}</span>
                <strong>{{ getArrayFieldMeta(field)?.summary }}</strong>
              </div>
            </template>

            <div
              v-else-if="isSelectField(field)"
              class="scan-create-select"
              :class="{ 'is-open': isCustomSelectOpen(field.key) }"
            >
              <button
                class="scan-create-select-button"
                type="button"
                @click.stop="toggleCustomSelect(field.key)"
              >
                <span>{{ getSelectOptionLabel(field) }}</span>
                <svg class="scan-create-select-caret" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                  <path d="M3.5 6 8 10.5 12.5 6" />
                </svg>
              </button>

              <div v-if="isCustomSelectOpen(field.key)" class="scan-create-select-menu">
                <button
                  v-for="option in field.options ?? []"
                  :key="option.value"
                  class="scan-create-select-option"
                  :class="{ 'is-selected': form[field.key] === option.value }"
                  type="button"
                  @click.stop="selectFieldOption(field, option.value)"
                >
                  <span class="scan-create-select-check" :class="{ 'is-selected': form[field.key] === option.value }" aria-hidden="true"></span>
                  <span>{{ option.label }}</span>
                </button>
              </div>
            </div>

            <input
              v-else
              :value="getFieldValue(field)"
              :type="field.type === 'number' ? 'number' : 'text'"
              :min="field.min"
              :step="field.step"
              :placeholder="field.placeholder"
              @input="updateFieldValue(field, $event)"
              @wheel="field.type === 'number' ? handleNumberFieldWheel($event) : undefined"
            />
          </article>
        </div>

        <footer class="scan-create-footer">
          <div class="scan-create-status-block">
            <p v-if="errorMessage" class="scan-create-status is-error">{{ errorMessage }}</p>
            <div v-else-if="successPayload" class="scan-create-status is-success">
              <strong>{{ successPayload.message || '扫描任务已创建' }}</strong>
              <span>
                任务号：{{ successPayload.task?.task_no || '--' }} · 状态：{{ successPayload.task?.status || '--' }}
              </span>
            </div>
<!--            <p v-else class="scan-create-status is-muted">-->
<!--              表单状态会保留在当前页面切换中；提交前会自动过滤空字段，只发送已填写内容。-->
<!--            </p>-->
          </div>

          <div class="scan-create-actions">
            <button class="scan-create-secondary-button" type="button" :disabled="activeStep === 0" @click="goPrev">
              上一步
            </button>
            <button
              v-if="activeStep < stepDefinitions.length - 1"
              class="scan-create-primary-button"
              type="button"
              @click="goNext"
            >
              下一步
            </button>
            <button
              v-else
              class="scan-create-primary-button is-launch"
              type="button"
              :disabled="isSubmitting"
              @click="submitTask"
            >
              <span>{{ isSubmitting ? '正在启动扫描...' : '开始扫描' }}</span>
            </button>
          </div>
        </footer>
      </section>
    </section>
  </main>
</template>
