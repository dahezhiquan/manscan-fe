<template>
  <section class="api-key-manager" aria-label="第三方 API Key 管理">
    <header class="api-key-toolbar">
      <div>
        <p :aria-label="configuredServiceCountLabel">已配置 {{ configuredServiceCount }} 个第三方服务</p>
      </div>
      <div class="api-key-toolbar-actions">
        <button class="settings-button" type="button" :disabled="listState.loading" @click="fetchPage(listState.page)">刷新</button>
        <button class="settings-button settings-button--primary" type="button" @click="openCreate">新增 API Key</button>
      </div>
    </header>

    <div v-if="feedback" class="settings-alert is-success" role="status">{{ feedback }}</div>
    <div v-if="listState.error" class="settings-alert is-error" role="alert">
      <span>{{ listState.error }}</span>
      <button type="button" @click="fetchPage(listState.page)">重试</button>
    </div>

    <section class="api-key-table-card">
      <div class="api-key-table-wrap" :aria-busy="listState.loading">
        <table class="api-key-table">
          <caption class="api-key-visually-hidden">第三方服务 API Key 配置列表</caption>
          <thead>
            <tr><th scope="col">平台地址</th><th scope="col">描述</th><th scope="col">限流 / 分钟</th><th scope="col">密钥</th><th scope="col">更新时间</th><th scope="col">操作</th></tr>
          </thead>
          <tbody v-if="listState.loading"><tr><td colspan="6" class="api-key-table-state"><span role="status">正在加载配置…</span></td></tr></tbody>
          <tbody v-else-if="!listState.items.length"><tr><td colspan="6" class="api-key-table-state">{{ listState.error ? '配置暂不可用，请重试' : '暂无 API Key 配置，点击“新增 API Key”开始配置。' }}</td></tr></tbody>
          <tbody v-else>
            <tr v-for="item in listState.items" :key="item.id">
              <td><button class="settings-row-action api-key-platform" type="button" :aria-label="`查看 ${item.platformUrl} 的配置详情`" @click="openRecord('detail', item)">{{ item.platformUrl || '--' }}</button></td>
              <td class="api-key-description">{{ item.description || '--' }}</td>
              <td>{{ item.rateLimit === 0 ? '不限制' : item.rateLimit }}</td>
              <td>
                <button v-if="item.keyConfigured" class="settings-row-action" type="button" :aria-label="`查看 ${item.platformUrl} 的 API Key 明文`" @click="openPlaintext(item)">查看</button>
                <span v-else class="settings-status-pill is-disabled">未配置</span>
              </td>
              <td>{{ formatDate(item.updatedAt) }}</td>
              <td>
                <div class="settings-user-row-actions">
                  <button class="settings-row-action" type="button" :aria-label="`编辑 ${item.platformUrl} 的配置`" @click="openRecord('edit', item)">编辑</button>
                  <button class="settings-row-action is-danger" type="button" :aria-label="`删除 ${item.platformUrl} 的配置`" @click="openDelete(item)">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="api-key-pagination">
        <span>第 {{ listState.page }} / {{ listState.totalPages }} 页，{{ rangeStart }}-{{ rangeEnd }} / {{ listState.total }}</span>
        <div class="api-key-toolbar-actions">
          <button class="settings-button" type="button" :disabled="listState.page <= 1 || listState.loading" @click="fetchPage(listState.page - 1)">上一页</button>
          <button class="settings-button" type="button" :disabled="listState.page >= listState.totalPages || listState.loading" @click="fetchPage(listState.page + 1)">下一页</button>
        </div>
      </footer>
    </section>

    <dialog ref="dialogElement" class="settings-dialog api-key-dialog" aria-labelledby="api-key-dialog-title" @cancel.prevent="requestClose">
      <header class="settings-dialog-head">
        <h2 id="api-key-dialog-title">{{ dialogTitle }}</h2>
        <button class="settings-dialog-close" type="button" aria-label="关闭弹窗" :disabled="saving" @click="requestClose">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </header>

      <div v-if="detailLoading" class="settings-dialog-body" role="status">{{ mode === 'plaintext' ? '正在安全读取密钥…' : '正在加载配置详情…' }}</div>
      <div v-else-if="loadError" class="settings-dialog-body">
        <div class="settings-alert is-error" role="alert">{{ loadError }}</div>
        <button class="settings-button" type="button" @click="retryDialogLoad">重试</button>
      </div>

      <div v-else-if="mode === 'plaintext'" class="settings-dialog-body">
        <p class="api-key-plaintext-warning">此密钥会记录查看审计，仅在当前弹窗中临时显示。</p>
        <code class="api-key-plaintext-value">{{ plaintextKey }}</code>
        <div v-if="copyMessage" class="settings-alert" :class="copyError ? 'is-error' : 'is-success'" :role="copyError ? 'alert' : 'status'">{{ copyMessage }}</div>
        <div class="api-key-plaintext-actions">
          <button class="settings-button settings-button--primary" type="button" @click="copyPlaintext">复制密钥</button>
        </div>
      </div>

      <form v-else-if="isForm" @submit.prevent="submitForm">
        <fieldset class="api-key-fieldset settings-dialog-body" :disabled="saving">
          <label class="settings-field" for="api-key-platform-url">
            <span>平台 URL</span>
            <input id="api-key-platform-url" v-model="form.platformUrl" type="url" :maxlength="API_KEY_LIMITS.platformUrl" required autocomplete="off" placeholder="https://api.example.com" />
          </label>
          <label class="settings-field" for="api-key-secret">
            <span>{{ mode === 'create' ? 'API Key（必填）' : '新 API Key（留空保留已有密钥）' }}</span>
            <input id="api-key-secret" v-model="form.key" type="password" :required="mode === 'create'" autocomplete="new-password" :maxlength="API_KEY_LIMITS.key" placeholder="输入密钥，不会回显" />
          </label>
          <label class="settings-field" for="api-key-rate-limit">
            <span>每分钟限流</span>
            <input id="api-key-rate-limit" v-model="form.rateLimit" type="number" min="0" :max="API_KEY_LIMITS.rateLimit" step="1" required aria-describedby="api-key-rate-hint" />
            <small id="api-key-rate-hint">0 表示不限制</small>
          </label>
          <label class="settings-field" for="api-key-description">
            <span>描述（最多 512 字节）</span>
            <input id="api-key-description" v-model="form.description" :maxlength="API_KEY_LIMITS.description" placeholder="用途或服务说明" />
          </label>
          <div v-if="mutationError" class="settings-alert is-error" role="alert">{{ mutationError }}</div>
          <div v-if="discardPrompt" class="settings-alert" role="alert">有未保存的输入，确定放弃修改吗？</div>
        </fieldset>
        <footer class="settings-dialog-actions">
          <template v-if="discardPrompt">
            <button class="settings-button" type="button" @click="discardPrompt = false">继续编辑</button>
            <button class="settings-button settings-button--danger" type="button" @click="closeDialog">放弃修改</button>
          </template>
          <template v-else>
            <button class="settings-button" type="button" :disabled="saving" @click="requestClose">取消</button>
            <button class="settings-button settings-button--primary" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
          </template>
        </footer>
      </form>

      <template v-else-if="mode === 'delete'">
        <div class="settings-dialog-body settings-delete-copy">
          <strong>确定删除此 API Key 配置？</strong>
          <p><span>{{ selectedItem?.platformUrl }}</span></p>
          <p>删除后该平台密钥将不可恢复。</p>
          <div v-if="mutationError" class="settings-alert is-error" role="alert">{{ mutationError }}</div>
        </div>
        <footer class="settings-dialog-actions">
          <button class="settings-button" type="button" :disabled="saving" @click="requestClose">取消</button>
          <button class="settings-button settings-button--danger" type="button" :disabled="saving" @click="confirmDelete">{{ saving ? '删除中…' : '确认删除' }}</button>
        </footer>
      </template>

      <div v-else-if="selectedItem" class="settings-dialog-body">
        <dl class="api-key-detail-list">
          <dt>平台 URL</dt><dd>{{ selectedItem.platformUrl || '--' }}</dd>
          <dt>描述</dt><dd>{{ selectedItem.description || '--' }}</dd>
          <dt>每分钟限流</dt><dd>{{ selectedItem.rateLimit === 0 ? '不限制' : selectedItem.rateLimit }}</dd>
          <dt>密钥状态</dt><dd>{{ selectedItem.keyConfigured ? '已配置' : '未配置' }}</dd>
          <dt>创建时间</dt><dd>{{ formatDate(selectedItem.createdAt) }}</dd>
          <dt>更新时间</dt><dd>{{ formatDate(selectedItem.updatedAt) }}</dd>
        </dl>
      </div>
    </dialog>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { createThirdPartyApiKey, deleteThirdPartyApiKey, getThirdPartyApiKey, getThirdPartyApiKeyList, getThirdPartyApiKeyPlaintext, updateThirdPartyApiKey } from '../../api/thirdPartyApiKeys'
import { API_KEY_LIMITS, buildApiKeyPayload, normalizeApiKey, normalizeApiKeyPage, validateApiKeyForm } from '../../utils/thirdPartyApiKeys'

const PAGE_SIZE = 10
const DIALOG_TITLES = { create: '新增 API Key', edit: '编辑 API Key', detail: 'API Key 配置详情', delete: '删除 API Key', plaintext: '查看 API Key 明文' }
const dialogElement = ref(null)
const mode = ref('')
const selectedItem = ref(null)
const detailLoading = ref(false)
const loadError = ref('')
const saving = ref(false)
const mutationError = ref('')
const discardPrompt = ref(false)
const feedback = ref('')
const plaintextKey = ref('')
const copyMessage = ref('')
const copyError = ref(false)
const form = reactive(emptyForm())
const initialForm = ref(JSON.stringify(form))
const listState = reactive({ items: [], page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1, loading: false, loaded: false, error: '' })
let listController = null
let detailController = null
let mutationController = null
let feedbackTimer = null
let listRequestId = 0
let detailRequestId = 0
let disposed = false

const dialogTitle = computed(() => DIALOG_TITLES[mode.value] || '')
const isForm = computed(() => ['create', 'edit'].includes(mode.value))
const configuredServiceCount = computed(() => listState.loaded ? listState.total : '—')
const configuredServiceCountLabel = computed(() => listState.loaded ? `已配置 ${listState.total} 个第三方服务` : '已配置的第三方服务数量正在加载')
const rangeStart = computed(() => listState.total ? (listState.page - 1) * listState.pageSize + 1 : 0)
const rangeEnd = computed(() => Math.min(listState.page * listState.pageSize, listState.total))

function emptyForm() {
  return { platformUrl: '', key: '', rateLimit: '0', description: '' }
}

function formatDate(value) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('zh-CN', { hour12: false }) : '--'
}

function errorMessage(error, fallback) {
  if (Number(error?.code) === 40301 || error?.status === 403) return '当前账号没有管理 API Key 的权限，请联系管理员。'
  if (Number(error?.code) === 40401 && mode.value === 'plaintext') return '该配置未配置密钥或已不存在。'
  if (Number(error?.code) === 40401 || error?.status === 404) return '该配置已不存在，请关闭弹窗并刷新列表。'
  return error instanceof Error ? error.message : fallback
}

async function fetchPage(page = listState.page) {
  listController?.abort()
  const controller = new AbortController()
  listController = controller
  const requestId = ++listRequestId
  listState.loading = true
  listState.error = ''
  try {
    const data = await getThirdPartyApiKeyList({ page, pageSize: PAGE_SIZE }, controller.signal)
    if (disposed || requestId !== listRequestId) return
    Object.assign(listState, normalizeApiKeyPage(data), { loaded: true })
    if (listState.page > listState.totalPages) await fetchPage(listState.totalPages)
  } catch (error) {
    if (!disposed && !controller.signal.aborted && requestId === listRequestId) {
      listState.error = errorMessage(error, 'API Key 列表加载失败，请稍后重试。')
    }
  } finally {
    if (!disposed && requestId === listRequestId) {
      listState.loading = false
      listController = null
    }
  }
}

async function showDialog(nextMode, item = null) {
  mode.value = nextMode
  selectedItem.value = item
  loadError.value = ''
  mutationError.value = ''
  discardPrompt.value = false
  Object.assign(form, emptyForm())
  initialForm.value = JSON.stringify(form)
  await nextTick()
  if (!disposed) dialogElement.value?.showModal()
}

function openCreate() {
  void showDialog('create')
}

async function openRecord(nextMode, item) {
  detailLoading.value = true
  await showDialog(nextMode, item)
  if (!disposed) await loadRecord()
}

async function openPlaintext(item) {
  await showDialog('plaintext', item)
  if (!disposed) await loadPlaintext()
}

async function loadPlaintext() {
  detailController?.abort()
  const controller = new AbortController()
  detailController = controller
  const requestId = ++detailRequestId
  detailLoading.value = true
  loadError.value = ''
  plaintextKey.value = ''
  copyMessage.value = ''
  try {
    const key = await getThirdPartyApiKeyPlaintext(selectedItem.value.id, controller.signal)
    if (disposed || requestId !== detailRequestId) return
    plaintextKey.value = key
  } catch (error) {
    if (!disposed && !controller.signal.aborted && requestId === detailRequestId) loadError.value = errorMessage(error, '读取 API Key 明文失败，请重试。')
  } finally {
    if (!disposed && requestId === detailRequestId) {
      detailLoading.value = false
      detailController = null
    }
  }
}

function retryDialogLoad() {
  if (mode.value === 'plaintext') void loadPlaintext()
  else void loadRecord()
}

async function copyPlaintext() {
  if (!plaintextKey.value) return
  try {
    await navigator.clipboard.writeText(plaintextKey.value)
    copyError.value = false
    copyMessage.value = '已复制到剪贴板'
  } catch {
    copyError.value = true
    copyMessage.value = '复制失败，请检查浏览器剪贴板权限。'
  }
}

async function loadRecord() {
  detailController?.abort()
  const controller = new AbortController()
  detailController = controller
  const requestId = ++detailRequestId
  detailLoading.value = true
  loadError.value = ''
  try {
    const data = await getThirdPartyApiKey(selectedItem.value.id, controller.signal)
    if (disposed || requestId !== detailRequestId) return
    const item = normalizeApiKey(data)
    selectedItem.value = item
    Object.assign(form, { platformUrl: item.platformUrl, rateLimit: String(item.rateLimit), description: item.description, key: '' })
    initialForm.value = JSON.stringify(form)
  } catch (error) {
    if (!disposed && !controller.signal.aborted && requestId === detailRequestId) loadError.value = errorMessage(error, 'API Key 详情加载失败，请重试。')
  } finally {
    if (!disposed && requestId === detailRequestId) {
      detailLoading.value = false
      detailController = null
    }
  }
}

function requestClose() {
  if (saving.value) return
  if (isForm.value && JSON.stringify(form) !== initialForm.value) {
    discardPrompt.value = true
    return
  }
  closeDialog()
}

function closeDialog() {
  detailController?.abort()
  detailRequestId += 1
  detailLoading.value = false
  dialogElement.value?.close()
  Object.assign(form, emptyForm())
  selectedItem.value = null
  mode.value = ''
  loadError.value = ''
  mutationError.value = ''
  discardPrompt.value = false
  plaintextKey.value = ''
  copyMessage.value = ''
  copyError.value = false
}

async function submitForm() {
  if (saving.value || detailLoading.value || loadError.value) return
  mutationError.value = validateApiKeyForm(form, mode.value === 'create')
  if (mutationError.value) return
  const isCreate = mode.value === 'create'
  const payload = buildApiKeyPayload(form, isCreate)
  const controller = new AbortController()
  mutationController = controller
  saving.value = true
  try {
    if (isCreate) await createThirdPartyApiKey(payload, controller.signal)
    else await updateThirdPartyApiKey(selectedItem.value.id, payload, controller.signal)
    if (disposed) return
    closeDialog()
    showFeedback(isCreate ? 'API Key 已新增' : 'API Key 已更新')
    void fetchPage(isCreate ? 1 : listState.page)
  } catch (error) {
    if (!disposed && !controller.signal.aborted) mutationError.value = errorMessage(error, '保存 API Key 失败，请稍后重试。')
  } finally {
    saving.value = false
    mutationController = null
  }
}

function openDelete(item) {
  void showDialog('delete', item)
}

async function confirmDelete() {
  if (saving.value || !selectedItem.value) return
  const controller = new AbortController()
  mutationController = controller
  saving.value = true
  mutationError.value = ''
  try {
    await deleteThirdPartyApiKey(selectedItem.value.id, controller.signal)
    if (disposed) return
    const nextPage = listState.items.length === 1 && listState.page > 1 ? listState.page - 1 : listState.page
    closeDialog()
    showFeedback('API Key 已删除')
    void fetchPage(nextPage)
  } catch (error) {
    if (!disposed && !controller.signal.aborted) mutationError.value = errorMessage(error, '删除 API Key 失败，请稍后重试。')
  } finally {
    saving.value = false
    mutationController = null
  }
}

function showFeedback(message) {
  feedback.value = message
  window.clearTimeout(feedbackTimer)
  feedbackTimer = window.setTimeout(() => { feedback.value = '' }, 3000)
}

onMounted(() => { void fetchPage() })
onBeforeUnmount(() => {
  disposed = true
  listController?.abort()
  detailController?.abort()
  mutationController?.abort()
  dialogElement.value?.close()
  form.key = ''
  plaintextKey.value = ''
  window.clearTimeout(feedbackTimer)
})
</script>

<style scoped>
.api-key-manager {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.api-key-toolbar,
.api-key-pagination,
.api-key-toolbar-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.api-key-toolbar p {
  margin: 0;
  color: var(--line);
  font-size: 14px;
  font-weight: 900;
}

.api-key-toolbar span,
.api-key-pagination,
.settings-field small {
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.5;
}

.api-key-table-wrap {
  overflow-x: auto;
  border: var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.api-key-table-card {
  min-width: 0;
}

.api-key-table {
  width: 100%;
  min-width: 780px;
  border-collapse: collapse;
  text-align: center;
}

.api-key-table th,
.api-key-table td {
  padding: 12px;
  border-bottom: 1px solid var(--line-soft);
  font-size: 12px;
  line-height: 1.5;
  vertical-align: middle;
}

.api-key-table th {
  background: var(--surface-2);
  color: var(--line);
  white-space: nowrap;
}

.api-key-table tbody tr:last-child td {
  border-bottom: 0;
}

.api-key-table tbody tr:hover {
  background: var(--surface-2);
}

.api-key-table-state {
  height: 120px;
  text-align: center;
  color: var(--ink-soft);
}

.api-key-platform,
.api-key-description {
  max-width: 240px;
  white-space: normal;
  overflow-wrap: anywhere;
}

.api-key-platform {
  text-align: center;
}

.api-key-dialog {
  padding: 0;
  max-height: calc(100dvh - 36px);
  overflow-y: auto;
  color: var(--ink);
}

.api-key-dialog::backdrop {
  background: rgb(0 0 0 / 45%);
}

.api-key-fieldset {
  margin: 0;
  border: 0;
  min-width: 0;
}

.api-key-detail-list {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  gap: 12px;
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}

.api-key-detail-list dt {
  color: var(--ink-soft);
}

.api-key-detail-list dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.api-key-plaintext-warning {
  margin: 0 0 12px;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.5;
}

.api-key-plaintext-value {
  display: block;
  max-height: min(36dvh, 240px);
  overflow: auto;
  padding: 12px;
  border: var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface-2);
  color: var(--ink);
  font: 600 13px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
  overflow-wrap: anywhere;
  user-select: text;
}

.api-key-plaintext-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

.api-key-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

.api-key-manager :is(button, input):focus-visible {
  outline: 3px solid var(--accent-orange);
  outline-offset: 3px;
}

@media (max-width: 760px) {
  .api-key-toolbar,
  .api-key-pagination {
    align-items: stretch;
    flex-direction: column;
  }

  .api-key-toolbar-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
  }
}
</style>
