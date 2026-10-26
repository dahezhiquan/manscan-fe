<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import AppShell from '../components/layout/AppShell.vue'
import { deleteScheduledJob, downloadScheduledJobRunOutput, getScheduledJob, getScheduledJobList, getScheduledJobRun, getScheduledJobRuns, stopScheduledJob, triggerScheduledJob, updateScheduledJob } from '../api/scheduledJobs'
import { getThirdPartyApiKeyList } from '../api/thirdPartyApiKeys'
import { iconPath } from '../utils/icons'
import { normalizeApiKeyPage } from '../utils/thirdPartyApiKeys'

const props = defineProps({ navigateTo: { type: Function, required: true }, currentPath: { type: String, default: '/scheduled-jobs' }, isSidebarCollapsed: { type: Boolean, default: false }, currentUserName: { type: String, default: 'admin' }, currentUserRole: { type: String, default: 'user' } })
const emit = defineEmits(['toggle-sidebar', 'logout'])
const isAdmin = computed(() => props.currentUserRole === 'admin')
const jobs = ref([]); const selectedJob = ref(null); const runs = ref([]); const runDetail = ref(null)
const listState = reactive({ page: 1, pageSize: 10, total: 0, totalPages: 1, loading: false, error: '' })
const detailState = reactive({ loading: false, error: '' }); const runsState = reactive({ loading: false, error: '', page: 1, pageSize: 8, total: 0, totalPages: 1 })
const feedback = ref(''); const isEditorOpen = ref(false); const editorSaving = ref(false); const editorError = ref(''); const deleteTarget = ref(null); const deleting = ref(false); const runDetailLoading = ref(false); const cancelTarget = ref(null); const cancelling = ref(false); const failureLogTarget = ref(null); const downloadingOutput = ref(false); const latestRun = ref(null)
const form = reactive(emptyForm()); let listController; let detailController; let runsController; let runController; let pollTimer; let feedbackTimer
const statusMeta = { queued: ['排队中', 'queued'], running: ['执行中', 'running'], success: ['成功', 'success'], failed: ['失败', 'failed'], timeout: ['超时', 'failed'], skipped: ['已跳过', 'skipped'], cancelled: ['已取消', 'skipped'] }
const timezoneOptions = [
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai', description: '中国大陆，北京时间 · UTC+8' },
  { value: 'UTC', label: 'UTC', description: '协调世界时' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo', description: '日本标准时间 · UTC+9' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore', description: '新加坡时间 · UTC+8' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata', description: '印度时间 · UTC+5:30' },
  { value: 'Europe/London', label: 'Europe/London', description: '英国时间，存在夏令时' },
  { value: 'Europe/Paris', label: 'Europe/Paris', description: '欧洲中部时间，存在夏令时' },
  { value: 'America/New_York', label: 'America/New_York', description: '美国东部时间，存在夏令时' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles', description: '美国太平洋时间，存在夏令时' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney', description: '澳大利亚悉尼时间，存在夏令时' }
]
const timezoneValues = new Set(timezoneOptions.map((option) => option.value))
const concurrencyOptions = [
  { value: 'forbid', label: '禁止并发', description: '上一次运行未结束时跳过新的触发' },
  { value: 'allow', label: '允许并发', description: '允许多个运行实例同时执行' }
]
const editorSelectOptions = { timezone: timezoneOptions, concurrency_policy: concurrencyOptions }
const editorSelectOpen = ref('')
const apiKeyOptions = ref([])
const apiKeySearch = ref('')
const apiKeyOptionsLoading = ref(false)
const apiKeyOptionsError = ref('')
const apiKeyOptionsLoaded = ref(false)
let apiKeyOptionsController
const normalizedRuns = computed(() => runs.value.map(normalizeRun))
const filteredApiKeyOptions = computed(() => {
  const keyword = apiKeySearch.value.trim().toLocaleLowerCase()
  if (!keyword) return apiKeyOptions.value
  return apiKeyOptions.value.filter((option) => option.platformUrl.toLocaleLowerCase().includes(keyword))
})
const selectedApiKeyOption = computed(() => apiKeyOptions.value.find((option) => option.id === Number(form.api_key_id)))
const progressPercent = computed(() => { const value = Number(runDetail.value?.progress_percent); if (Number.isFinite(value) && value >= 0) return Math.round(Math.min(100, Math.max(0, value))); const current = Number(runDetail.value?.progress_current); const total = Number(runDetail.value?.progress_total); return total > 0 ? Math.round(Math.min(100, Math.max(0, (current / total) * 100))) : null })
const selectedStatus = computed(() => statusMeta[selectedJob.value?.last_status]?.[0] || '暂无执行')
const hasActiveRun = computed(() => ['queued', 'running'].includes(runDetail.value?.status))
const latestSuccessfulRun = computed(() => latestRun.value?.status === 'success' ? latestRun.value : null)
const pageSummary = computed(() => `第 ${listState.page} / ${Math.max(1, listState.totalPages)} 页 · 共 ${listState.total} 个任务`)
function emptyForm() { return { name: '', description: '', job_type: '', cron_expr: '0 0 * * *', timezone: 'Asia/Shanghai', enabled: true, api_key_id: '', config_json: '{}', concurrency_policy: 'forbid', timeout_seconds: 0 } }
function normalizeJob(item) { return { ...item, id: item?.id, name: String(item?.name || '未命名任务'), enabled: item?.enabled !== false && item?.enabled !== 0 } }
function normalizeRun(item) { const status = String(item?.status || 'queued'); return { ...item, id: item?.id ?? item?.run_id, status, label: statusMeta[status]?.[0] || status, tone: statusMeta[status]?.[1] || 'queued' } }
function formatDate(value) { if (!value) return '--'; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false }) }
function formatProgressPercent(value) { const parsed = Number(value); return Number.isFinite(parsed) ? `${Math.round(Math.min(100, Math.max(0, parsed)))}%` : '--' }
function openFailureLog(run) { if (run?.status === 'failed') failureLogTarget.value = run }
function formatConfig(value) { if (!value) return '{}'; if (typeof value === 'string') return value; try { return JSON.stringify(value, null, 2) } catch { return String(value) } }
function normalizePage(payload, fallbackSize) { const items = Array.isArray(payload?.items) ? payload.items : []; const total = Number(payload?.total ?? items.length) || 0; const pageSize = Number(payload?.page_size ?? payload?.pageSize ?? fallbackSize) || fallbackSize; const totalPages = Number(payload?.total_pages ?? payload?.totalPages) || Math.max(1, Math.ceil(total / pageSize)); return { items, total, pageSize, totalPages } }
function showFeedback(message) { feedback.value = message; if (feedbackTimer) window.clearTimeout(feedbackTimer); feedbackTimer = window.setTimeout(() => { feedback.value = ''; feedbackTimer = null }, 3000) }
async function loadJobs() { listController?.abort(); listController = new AbortController(); listState.loading = true; listState.error = ''; try { const normalized = normalizePage(await getScheduledJobList({ page: listState.page, page_size: listState.pageSize }, listController.signal), listState.pageSize); jobs.value = normalized.items.map(normalizeJob); listState.total = normalized.total; listState.pageSize = normalized.pageSize; listState.totalPages = normalized.totalPages; if (jobs.value.length && (!selectedJob.value || !jobs.value.some((job) => job.id === selectedJob.value.id))) await selectJob(jobs.value[0]); if (!jobs.value.length) { selectedJob.value = null; runs.value = [] } } catch (error) { if (error?.name !== 'AbortError') listState.error = error?.message || '任务列表加载失败' } finally { listState.loading = false } }
async function selectJob(job) { selectedJob.value = normalizeJob(job); runDetail.value = null; latestRun.value = null; stopPolling(); detailController?.abort(); detailController = new AbortController(); detailState.loading = true; detailState.error = ''; try { selectedJob.value = normalizeJob(await getScheduledJob(job.id, detailController.signal)); runsState.page = 1; await loadRuns() } catch (error) { if (error?.name !== 'AbortError') detailState.error = error?.message || '任务详情加载失败' } finally { detailState.loading = false } }
async function loadRuns() { if (!selectedJob.value) return; runsController?.abort(); runsController = new AbortController(); runsState.loading = true; runsState.error = ''; try { const normalized = normalizePage(await getScheduledJobRuns(selectedJob.value.id, { page: runsState.page, page_size: runsState.pageSize }, runsController.signal), runsState.pageSize); runs.value = normalized.items; runsState.total = normalized.total; runsState.totalPages = normalized.totalPages; if (runsState.page === 1) latestRun.value = normalizedRuns.value[0] || null; const active = normalizedRuns.value.find((run) => ['queued', 'running'].includes(run.status)); if (active) await inspectRun(active) } catch (error) { if (error?.name !== 'AbortError') runsState.error = error?.message || '执行记录加载失败' } finally { runsState.loading = false } }
async function inspectRun(run) { if (!run?.id) return; runController?.abort(); runController = new AbortController(); runDetailLoading.value = true; try { runDetail.value = normalizeRun(await getScheduledJobRun(run.id, runController.signal)); if (['queued', 'running'].includes(runDetail.value.status)) startPolling(run.id); else stopPolling() } catch (error) { if (error?.name !== 'AbortError') showFeedback(error?.message || '执行进度加载失败') } finally { runDetailLoading.value = false } }
function startPolling(runId) { stopPolling(); pollTimer = window.setInterval(async () => { try { const current = normalizeRun(await getScheduledJobRun(runId)); runDetail.value = current; if (!['queued', 'running'].includes(current.status)) { stopPolling(); await loadRuns() } } catch { /* retain the last known progress */ } }, 3000) }
function stopPolling() { if (pollTimer) { window.clearInterval(pollTimer); pollTimer = null } }
function openEdit() { if (!selectedJob.value || !isAdmin.value) return; const timezone = String(selectedJob.value.timezone || '').trim(); const apiKeyId = Number(selectedJob.value.api_key_id); Object.assign(form, { ...emptyForm(), ...selectedJob.value, timezone: timezoneValues.has(timezone) ? timezone : 'Asia/Shanghai', config_json: formatConfig(selectedJob.value.config_json), api_key_id: Number.isSafeInteger(apiKeyId) && apiKeyId > 0 ? apiKeyId : '' }); editorError.value = ''; apiKeySearch.value = ''; editorSelectOpen.value = ''; isEditorOpen.value = true; void loadApiKeyOptions(true) }
function closeEditor() { if (!editorSaving.value) { editorSelectOpen.value = ''; apiKeySearch.value = ''; isEditorOpen.value = false } }
function toggleEditorSelect(field) { editorSelectOpen.value = editorSelectOpen.value === field ? '' : field; if (field === 'api_key_id' && editorSelectOpen.value === field) apiKeySearch.value = '' }
function selectEditorOption(field, value) { form[field] = value; editorSelectOpen.value = '' }
function getEditorSelectOption(field) { return editorSelectOptions[field]?.find((option) => option.value === form[field]) || editorSelectOptions[field]?.[0] }
function getApiKeySelectLabel() { return selectedApiKeyOption.value?.platformUrl || (form.api_key_id ? `API Key #${form.api_key_id}` : '不使用 API Key') }
function selectApiKeyOption(value) { form.api_key_id = value ? Number(value) : ''; apiKeySearch.value = ''; editorSelectOpen.value = '' }
async function loadApiKeyOptions(force = false) {
  if (!isAdmin.value || (apiKeyOptionsLoading.value && !force) || (apiKeyOptionsLoaded.value && !force)) return
  apiKeyOptionsController?.abort()
  apiKeyOptionsController = new AbortController()
  const signal = apiKeyOptionsController.signal
  apiKeyOptionsLoading.value = true
  apiKeyOptionsError.value = ''
  try {
    const items = []
    let totalPages = 1
    for (let page = 1; page <= totalPages; page += 1) {
      const normalized = normalizeApiKeyPage(await getThirdPartyApiKeyList({ page, pageSize: 100 }, signal))
      items.push(...normalized.items)
      totalPages = normalized.totalPages
    }
    apiKeyOptions.value = items
    apiKeyOptionsLoaded.value = true
  } catch (error) {
    if (error?.name !== 'AbortError') {
      apiKeyOptionsError.value = error?.message || 'API Key 列表加载失败，请重试。'
      apiKeyOptionsLoaded.value = false
    }
  } finally {
    if (apiKeyOptionsController?.signal === signal) {
      apiKeyOptionsLoading.value = false
      apiKeyOptionsController = null
    }
  }
}
function validateForm() { if (!form.name.trim() || !form.cron_expr.trim()) return '请填写名称和 Cron 表达式'; if (!String(selectedJob.value?.job_type || '').trim()) return '当前任务缺少任务类型，请刷新后重试'; try { JSON.parse(form.config_json || '{}') } catch { return '任务配置必须是合法 JSON' } return '' }
async function saveJob() { editorError.value = validateForm(); if (editorError.value || editorSaving.value || !selectedJob.value) return; editorSaving.value = true; try { const payload = { ...form, name: form.name.trim(), description: form.description.trim(), job_type: String(selectedJob.value.job_type).trim(), cron_expr: form.cron_expr.trim(), timezone: form.timezone.trim() || 'Asia/Shanghai', config_json: form.config_json, api_key_id: form.api_key_id ? Number(form.api_key_id) : null, timeout_seconds: Number(form.timeout_seconds) || 0 }; await updateScheduledJob(selectedJob.value.id, payload); isEditorOpen.value = false; showFeedback('定时任务已更新'); await loadJobs(); if (selectedJob.value) await selectJob(selectedJob.value) } catch (error) { editorError.value = error?.message || '保存失败' } finally { editorSaving.value = false } }
function askDelete() { if (isAdmin.value && selectedJob.value) deleteTarget.value = selectedJob.value }
async function confirmDelete() { if (!deleteTarget.value || deleting.value) return; deleting.value = true; try { await deleteScheduledJob(deleteTarget.value.id); deleteTarget.value = null; showFeedback('定时任务已删除'); await loadJobs() } catch (error) { showFeedback(error?.message || '删除失败') } finally { deleting.value = false } }
async function triggerJob() { if (!selectedJob.value || !isAdmin.value) return; try { const result = await triggerScheduledJob(selectedJob.value.id); showFeedback('任务已触发，正在获取执行进度'); await loadRuns(); if (result?.run) await inspectRun(result.run) } catch (error) { showFeedback(error?.message || '触发失败') } }
async function downloadLatestOutput() {
  if (!latestSuccessfulRun.value || downloadingOutput.value) return
  downloadingOutput.value = true
  try {
    await downloadScheduledJobRunOutput(latestSuccessfulRun.value.id)
    showFeedback('任务产出已开始下载')
  } catch (error) {
    showFeedback(error?.message || '下载任务产出失败')
  } finally {
    downloadingOutput.value = false
  }
}
function askCancelRun() { if (isAdmin.value && selectedJob.value && hasActiveRun.value) cancelTarget.value = selectedJob.value }
async function confirmCancelRun() {
  if (!cancelTarget.value || cancelling.value) return
  cancelling.value = true
  try {
    const result = await stopScheduledJob(cancelTarget.value.id)
    const count = Number(result?.cancel_requested_runs) || 0
    cancelTarget.value = null
    runDetail.value = null
    stopPolling()
    showFeedback(count ? `已请求取消 ${count} 个运行实例` : '当前没有正在运行的实例')
    await loadRuns()
  } catch (error) {
    showFeedback(error?.message || '取消运行失败')
  } finally {
    cancelling.value = false
  }
}
function changePage(offset) { if (listState.loading) return; listState.page = Math.min(Math.max(1, listState.page + offset), listState.totalPages); void loadJobs() }
function changeRunsPage(offset) { if (runsState.loading) return; runsState.page = Math.min(Math.max(1, runsState.page + offset), runsState.totalPages); void loadRuns() }
onMounted(() => { void loadJobs() }); onBeforeUnmount(() => { stopPolling(); if (feedbackTimer) window.clearTimeout(feedbackTimer); listController?.abort(); detailController?.abort(); runsController?.abort(); runController?.abort(); apiKeyOptionsController?.abort() })
</script>
<template>
  <AppShell :current-path="props.currentPath" :is-sidebar-collapsed="props.isSidebarCollapsed" :current-user-name="props.currentUserName" main-class="scheduled-jobs-shell-main" @toggle-sidebar="emit('toggle-sidebar')" @navigate="props.navigateTo" @logout="emit('logout')">
    <main class="scheduled-jobs-page">
      <nav class="scheduled-jobs-breadcrumb" aria-label="当前位置"><span class="scheduled-jobs-breadcrumb-separator">/</span><span class="scheduled-jobs-breadcrumb-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" v-html="iconPath('clock')" /></span><span>定时任务</span></nav>
      <Transition name="scheduled-feedback">
        <p v-if="feedback" class="scheduled-jobs-feedback" role="status">{{ feedback }}</p>
      </Transition>
      <section class="scheduled-jobs-layout"><div class="scheduled-jobs-list-panel"><div class="scheduled-jobs-panel-head"><div><span class="scheduled-jobs-kicker">任务目录</span><h2>全部任务</h2></div></div><div v-if="listState.loading && !jobs.length" class="scheduled-jobs-state">正在加载任务...</div><div v-else-if="listState.error && !jobs.length" class="scheduled-jobs-state is-error">{{ listState.error }}<button type="button" @click="loadJobs">重试</button></div><div v-else-if="!jobs.length" class="scheduled-jobs-state">暂无定时任务</div><div v-else class="scheduled-jobs-list"><button v-for="job in jobs" :key="job.id" class="scheduled-job-row" :class="{ active: selectedJob?.id === job.id }" type="button" @click="selectJob(job)"><span class="scheduled-job-status-dot" :class="{ enabled: job.enabled }"></span><span class="scheduled-job-row-copy"><strong>{{ job.name }}</strong><small>{{ job.job_type }}</small></span><span class="scheduled-job-row-status">{{ job.enabled ? '启用' : '停用' }}</span></button></div><footer class="scheduled-jobs-pagination"><span>{{ pageSummary }}</span><span><button type="button" aria-label="上一页" :disabled="listState.page <= 1" @click="changePage(-1)">‹</button><button type="button" aria-label="下一页" :disabled="listState.page >= listState.totalPages" @click="changePage(1)">›</button></span></footer></div>
        <div class="scheduled-jobs-detail-panel"><div v-if="!selectedJob" class="scheduled-jobs-state">选择一个任务查看详情</div><template v-else><header class="scheduled-jobs-detail-head"><div><p class="scheduled-jobs-eyebrow">JOB #{{ selectedJob.id }}</p><h2>{{ selectedJob.name }}</h2><p>{{ selectedJob.description || '暂无描述' }}</p></div><div class="scheduled-jobs-actions"><button v-if="latestSuccessfulRun" type="button" class="scheduled-jobs-secondary" :disabled="downloadingOutput" @click="downloadLatestOutput">{{ downloadingOutput ? '下载中...' : '下载产出' }}</button><button v-if="isAdmin" type="button" class="scheduled-jobs-secondary" @click="openEdit">编辑</button><button v-if="isAdmin" type="button" class="scheduled-jobs-danger" @click="askDelete">删除</button><button v-if="isAdmin" type="button" class="scheduled-jobs-primary" @click="triggerJob">立即触发</button></div></header><p v-if="detailState.error" class="scheduled-jobs-inline-error">{{ detailState.error }}</p><div class="scheduled-jobs-meta-grid"><div><span>状态</span><strong class="scheduled-job-status-badge" :class="selectedJob.enabled ? 'is-enabled' : 'is-disabled'">{{ selectedJob.enabled ? '已启用' : '已停用' }}</strong></div><div><span>Cron</span><strong class="mono">{{ selectedJob.cron_expr || '--' }}</strong></div><div><span>时区</span><strong>{{ selectedJob.timezone || '--' }}</strong></div><div><span>并发策略</span><strong>{{ selectedJob.concurrency_policy === 'allow' ? '允许并发' : '禁止并发' }}</strong></div><div><span>下次执行</span><strong>{{ formatDate(selectedJob.next_run_at) }}</strong></div><div><span>上次状态</span><strong>{{ selectedStatus }}</strong></div></div><section v-if="runDetail" class="scheduled-jobs-progress-card"><div class="scheduled-jobs-section-head"><div><span class="scheduled-jobs-kicker">实时执行</span><h3>运行 #{{ runDetail.id }}</h3></div><div class="scheduled-jobs-progress-actions"><span class="scheduled-run-status" :class="`is-${statusMeta[runDetail.status]?.[1] || 'queued'}`">{{ statusMeta[runDetail.status]?.[0] || runDetail.status }}</span><button v-if="isAdmin && hasActiveRun" type="button" class="scheduled-jobs-danger scheduled-jobs-cancel-button" :disabled="cancelling" @click="askCancelRun">{{ cancelling ? '取消中...' : '取消运行' }}</button></div></div><div class="scheduled-jobs-progress-track"><span :style="{ width: `${progressPercent ?? 0}%` }"></span></div><div class="scheduled-jobs-progress-copy"><strong>{{ progressPercent === null ? '进度暂不可计算' : `${progressPercent}%` }}</strong><span>{{ runDetail.progress_phase || '处理中' }} · {{ runDetail.progress_message || '等待任务报告进度' }}</span></div></section><section class="scheduled-jobs-runs"><div class="scheduled-jobs-section-head"><div><span class="scheduled-jobs-kicker">执行历史</span><h3>最近运行记录</h3></div><button class="scheduled-jobs-icon-button" type="button" aria-label="刷新执行记录" @click="loadRuns">↻</button></div><p v-if="runsState.error" class="scheduled-jobs-inline-error">{{ runsState.error }}</p><div v-if="runsState.loading && !runs.length" class="scheduled-jobs-state">正在加载执行记录...</div><div v-else-if="!normalizedRuns.length" class="scheduled-jobs-state">暂无执行记录</div><div v-else class="scheduled-runs-table"><div class="scheduled-runs-head"><span>状态</span><span>开始时间</span><span>进度</span><span>操作</span></div><div v-for="run in normalizedRuns" :key="run.id" class="scheduled-run-row"><button class="scheduled-run-row-main" type="button" @click="inspectRun(run)"><span class="scheduled-run-status" :class="`is-${run.tone}`">{{ run.label }}</span><span>{{ formatDate(run.started_at || run.created_at) }}</span><span>{{ formatProgressPercent(run.progress_percent) }}</span></button><button v-if="run.status === 'failed'" class="scheduled-jobs-secondary scheduled-run-log-button" type="button" @click="openFailureLog(run)">查看失败日志</button></div></div><footer class="scheduled-jobs-pagination"><span>第 {{ runsState.page }} / {{ Math.max(1, runsState.totalPages) }} 页 · 共 {{ runsState.total }} 条</span><span><button type="button" aria-label="上一页" :disabled="runsState.page <= 1" @click="changeRunsPage(-1)">‹</button><button type="button" aria-label="下一页" :disabled="runsState.page >= runsState.totalPages" @click="changeRunsPage(1)">›</button></span></footer></section><section class="scheduled-jobs-config"><div class="scheduled-jobs-section-head"><div><span class="scheduled-jobs-kicker">任务配置</span><h3>执行参数</h3></div></div><pre>{{ formatConfig(selectedJob.config_json) }}</pre></section></template></div></section>
      <div v-if="isEditorOpen" class="scheduled-jobs-overlay" role="presentation" @click.self="closeEditor"><form class="scheduled-jobs-dialog" role="dialog" aria-modal="true" @keydown.esc="editorSelectOpen = ''" @submit.prevent="saveJob"><header><div><span class="scheduled-jobs-kicker">编辑</span><h2>编辑定时任务</h2></div><button type="button" aria-label="关闭" @click="closeEditor">×</button></header><div class="scheduled-jobs-form-grid"><label>任务名称<input v-model.trim="form.name" maxlength="120" required /></label><label>Cron 表达式<input v-model.trim="form.cron_expr" placeholder="*/5 * * * *" required /></label><label>时区<div class="scheduled-jobs-form-select" :class="{ 'is-open': editorSelectOpen === 'timezone' }"><button class="scheduled-jobs-form-select-button" type="button" aria-haspopup="listbox" :aria-expanded="editorSelectOpen === 'timezone'" @click.stop="toggleEditorSelect('timezone')"><span>{{ getEditorSelectOption('timezone')?.label }}</span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><path d="m3.5 6 4.5 4.5L12.5 6" /></svg></button><div v-if="editorSelectOpen === 'timezone'" class="scheduled-jobs-form-select-menu" role="listbox" aria-label="选择任务时区" @click.stop><button v-for="option in timezoneOptions" :key="option.value" class="scheduled-jobs-form-select-option" :class="{ 'is-selected': form.timezone === option.value }" type="button" role="option" :aria-selected="form.timezone === option.value" @click="selectEditorOption('timezone', option.value)"><span class="scheduled-jobs-form-select-check" aria-hidden="true"></span><span class="scheduled-jobs-form-select-copy"><strong>{{ option.label }}</strong><small>{{ option.description }}</small></span></button></div></div></label><label>API Key ID<div class="scheduled-jobs-form-select" :class="{ 'is-open': editorSelectOpen === 'api_key_id' }"><button class="scheduled-jobs-form-select-button" type="button" aria-haspopup="listbox" :aria-expanded="editorSelectOpen === 'api_key_id'" @click.stop="toggleEditorSelect('api_key_id')"><span>{{ getApiKeySelectLabel() }}</span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><path d="m3.5 6 4.5 4.5L12.5 6" /></svg></button><div v-if="editorSelectOpen === 'api_key_id'" class="scheduled-jobs-form-select-menu scheduled-jobs-api-key-menu" role="listbox" aria-label="按平台地址选择 API Key" @click.stop><input v-model="apiKeySearch" class="scheduled-jobs-form-select-search" type="search" placeholder="筛选平台地址" aria-label="筛选平台地址" autocomplete="off" @click.stop /><p v-if="apiKeyOptionsLoading" class="scheduled-jobs-form-select-state">正在加载 API Key 列表...</p><p v-else-if="apiKeyOptionsError" class="scheduled-jobs-form-select-state is-error">{{ apiKeyOptionsError }}<button class="scheduled-jobs-form-select-retry" type="button" @click="loadApiKeyOptions(true)">重试</button></p><p v-else-if="!filteredApiKeyOptions.length" class="scheduled-jobs-form-select-state">未找到匹配的平台地址</p><template v-else><button class="scheduled-jobs-form-select-option" :class="{ 'is-selected': !form.api_key_id }" type="button" role="option" :aria-selected="!form.api_key_id" @click="selectApiKeyOption('')"><span class="scheduled-jobs-form-select-check" aria-hidden="true"></span><span class="scheduled-jobs-form-select-copy"><strong>不使用 API Key</strong><small>不关联第三方服务</small></span></button><button v-for="option in filteredApiKeyOptions" :key="option.id" class="scheduled-jobs-form-select-option" :class="{ 'is-selected': Number(form.api_key_id) === option.id }" type="button" role="option" :aria-selected="Number(form.api_key_id) === option.id" @click="selectApiKeyOption(option.id)"><span class="scheduled-jobs-form-select-check" aria-hidden="true"></span><span class="scheduled-jobs-form-select-copy"><strong>{{ option.platformUrl }}</strong><small>{{ option.description || '已配置 API Key' }}</small></span></button></template></div></div></label><label>超时秒数<input v-model.number="form.timeout_seconds" type="number" min="0" max="86400" /></label><label class="is-wide">描述<textarea v-model.trim="form.description" rows="2" maxlength="500"></textarea></label><label class="is-wide">任务配置 JSON<textarea v-model="form.config_json" rows="6" spellcheck="false" required></textarea></label><label class="scheduled-jobs-checkbox"><input v-model="form.enabled" type="checkbox" />启用调度</label><label>并发策略<div class="scheduled-jobs-form-select" :class="{ 'is-open': editorSelectOpen === 'concurrency_policy' }"><button class="scheduled-jobs-form-select-button" type="button" aria-haspopup="listbox" :aria-expanded="editorSelectOpen === 'concurrency_policy'" @click.stop="toggleEditorSelect('concurrency_policy')"><span>{{ getEditorSelectOption('concurrency_policy')?.label }}</span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><path d="m3.5 6 4.5 4.5L12.5 6" /></svg></button><div v-if="editorSelectOpen === 'concurrency_policy'" class="scheduled-jobs-form-select-menu" role="listbox" aria-label="选择并发策略" @click.stop><button v-for="option in concurrencyOptions" :key="option.value" class="scheduled-jobs-form-select-option" :class="{ 'is-selected': form.concurrency_policy === option.value }" type="button" role="option" :aria-selected="form.concurrency_policy === option.value" @click="selectEditorOption('concurrency_policy', option.value)"><span class="scheduled-jobs-form-select-check" aria-hidden="true"></span><span class="scheduled-jobs-form-select-copy"><strong>{{ option.label }}</strong><small>{{ option.description }}</small></span></button></div></div></label></div><p v-if="editorError" class="scheduled-jobs-inline-error">{{ editorError }}</p><footer><button type="button" class="scheduled-jobs-secondary" @click="closeEditor">取消</button><button type="submit" class="scheduled-jobs-primary" :disabled="editorSaving">{{ editorSaving ? '保存中...' : '保存修改' }}</button></footer></form></div>
      <div v-if="deleteTarget" class="scheduled-jobs-overlay" role="presentation" @click.self="deleteTarget = null"><section class="scheduled-jobs-dialog scheduled-jobs-dialog--compact" role="dialog" aria-modal="true"><header><div><span class="scheduled-jobs-kicker">危险操作</span><h2>删除定时任务？</h2></div><button type="button" aria-label="关闭" @click="deleteTarget = null">×</button></header><p>将删除“{{ deleteTarget.name }}”及其调度配置。</p><footer><button type="button" class="scheduled-jobs-secondary" @click="deleteTarget = null">取消</button><button type="button" class="scheduled-jobs-danger" :disabled="deleting" @click="confirmDelete">{{ deleting ? '删除中...' : '确认删除' }}</button></footer></section></div>
      <div v-if="cancelTarget" class="scheduled-jobs-overlay" role="presentation" @click.self="cancelTarget = null"><section class="scheduled-jobs-dialog scheduled-jobs-dialog--compact" role="dialog" aria-modal="true"><header><div><span class="scheduled-jobs-kicker">危险操作</span><h2>取消当前运行？</h2></div><button type="button" aria-label="关闭" @click="cancelTarget = null">×</button></header><p>只取消运行中的实例，取消后不可恢复。</p><footer><button type="button" class="scheduled-jobs-secondary" @click="cancelTarget = null">返回</button><button type="button" class="scheduled-jobs-danger" :disabled="cancelling" @click="confirmCancelRun">{{ cancelling ? '取消中...' : '确认取消运行' }}</button></footer></section></div>
      <div v-if="failureLogTarget" class="scheduled-jobs-overlay" role="presentation" @click.self="failureLogTarget = null"><section class="scheduled-jobs-dialog scheduled-jobs-dialog--compact scheduled-jobs-failure-dialog" role="dialog" aria-modal="true" aria-labelledby="scheduled-failure-log-title"><header><div><span class="scheduled-jobs-kicker">执行失败</span><h2 id="scheduled-failure-log-title">失败日志</h2></div><button type="button" aria-label="关闭失败日志" @click="failureLogTarget = null">×</button></header><p class="scheduled-failure-log-meta">运行 #{{ failureLogTarget.id }} · {{ formatDate(failureLogTarget.finished_at || failureLogTarget.updated_at) }}</p><pre class="scheduled-failure-log">{{ failureLogTarget.error_message || '后端未返回失败原因。' }}</pre><footer><button type="button" class="scheduled-jobs-secondary" @click="failureLogTarget = null">关闭</button></footer></section></div>
    </main>
  </AppShell>
</template>
