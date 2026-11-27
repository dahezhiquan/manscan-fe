<template>
  <dialog ref="dialogElement" class="settings-dialog notification-dialog" aria-labelledby="notification-dialog-title" @cancel.prevent="requestClose">
    <form @submit.prevent="save">
      <header class="settings-dialog-head">
        <h2 id="notification-dialog-title">编辑通知策略</h2>
        <button class="settings-dialog-close" type="button" aria-label="关闭弹窗" :disabled="saving" @click="requestClose">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </header>
      <div class="notification-dialog-scroll">
        <fieldset class="settings-dialog-body notification-fieldset" :disabled="saving">
          <label class="settings-field">
            <span>名称（name）</span>
            <input v-model="form.name" autofocus required :maxlength="NOTIFICATION_LIMITS.name" autocomplete="off" />
          </label>
          <label class="settings-field">
            <span>描述（description）</span>
            <input v-model="form.description" :maxlength="NOTIFICATION_LIMITS.description" placeholder="选填，最多 500 个字符" />
          </label>
          <label class="settings-toggle-row">
            <span><strong>启用通知（enabled）</strong><small>{{ form.enabled ? '已开启' : '已关闭' }}</small></span>
            <input v-model="form.enabled" type="checkbox" class="settings-switch-input" />
            <span class="settings-switch" aria-hidden="true"></span>
          </label>
          <label class="settings-field">
            <span>Webhook</span>
            <input v-model="form.webhook" type="password" autocomplete="new-password" :maxlength="NOTIFICATION_LIMITS.webhook" placeholder="留空保留原地址" aria-describedby="notification-webhook-hint" />
            <small id="notification-webhook-hint">更换时请填写完整的飞书机器人地址。</small>
          </label>
          <section class="notification-style-field" aria-labelledby="notification-style-label">
            <span id="notification-style-label" class="notification-style-label">卡片样式（style）</span>
            <div class="notification-style-options" role="radiogroup" aria-labelledby="notification-style-label" aria-describedby="notification-style-hint" :aria-busy="stylesState.loading">
              <label v-for="style in stylesState.items" :key="style.id" class="notification-style-option">
                <input v-model="form.style" type="radio" name="notification-style" :value="style.id" :disabled="stylesState.loading || !!stylesState.error" required />
                <span class="notification-style-tile">
                  <span class="notification-style-swatch" :data-style="style.id" aria-hidden="true"></span>
                  <span class="notification-style-name">{{ style.name }}</span>
                  <svg class="notification-style-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
                </span>
              </label>
            </div>
            <small id="notification-style-hint">样式仅影响通知卡片的标题栏颜色。</small>
            <small v-if="!stylesState.loading && !stylesState.error && !hasSelectedStyle">请选择可用样式。</small>
          </section>
          <div v-if="stylesState.loading" role="status">正在加载通知样式…</div>
          <div v-if="stylesState.error" class="settings-alert is-error" role="alert">
            <span>{{ stylesState.error }}</span><button type="button" @click="loadStyles">重试</button>
          </div>
        </fieldset>
      </div>
      <footer class="settings-dialog-actions">
        <div v-if="error" class="settings-alert is-error notification-dialog-feedback" role="alert" tabindex="0">{{ error }}</div>
        <div v-if="discardPrompt" class="settings-alert notification-dialog-feedback" role="alert" tabindex="0">有未保存的修改，确定放弃吗？</div>
        <div class="notification-dialog-buttons">
          <template v-if="discardPrompt">
            <button class="settings-button" type="button" @click="discardPrompt = false">继续编辑</button>
            <button class="settings-button settings-button--danger" type="button" @click="close">放弃修改</button>
          </template>
          <template v-else>
            <button class="settings-button" type="button" :disabled="saving" @click="requestClose">取消</button>
            <button class="settings-button settings-button--primary" type="submit" :disabled="saving || stylesState.loading || !!stylesState.error || !hasSelectedStyle">{{ saving ? '保存中…' : '保存' }}</button>
          </template>
        </div>
      </footer>
    </form>
  </dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { getNotificationStyles, updateNotification } from '../../api/settings'
import { NOTIFICATION_LIMITS, normalizeNotification, normalizeNotificationStyles, validateNotificationForm } from '../../utils/notificationManagement'

const props = defineProps({ policy: { type: Object, required: true } })
const emit = defineEmits(['close', 'saved'])
const dialogElement = ref(null)
const form = reactive({ name: props.policy.name, description: props.policy.description, enabled: props.policy.enabled, webhook: '', style: props.policy.style })
const initialForm = JSON.stringify(form)
const stylesState = reactive({ items: [], loading: false, error: '' })
const hasSelectedStyle = computed(() => stylesState.items.some((item) => item.id === form.style))
const saving = ref(false)
const error = ref('')
const discardPrompt = ref(false)
let stylesController = null
let saveController = null
let disposed = false

async function loadStyles() {
  stylesController?.abort()
  const controller = new AbortController()
  stylesController = controller
  stylesState.loading = true
  stylesState.error = ''
  try {
    const data = await getNotificationStyles(controller.signal)
    if (disposed || controller.signal.aborted) return
    stylesState.items = normalizeNotificationStyles(data)
    if (!stylesState.items.length) stylesState.error = '暂无可用通知样式，请重试。'
  } catch (cause) {
    if (!disposed && !controller.signal.aborted) stylesState.error = cause instanceof Error ? cause.message : '通知样式加载失败，请重试。'
  } finally {
    if (!disposed && stylesController === controller) stylesState.loading = false
  }
}

function requestClose() {
  if (saving.value) return
  if (JSON.stringify(form) !== initialForm) discardPrompt.value = true
  else close()
}

function close() {
  form.webhook = ''
  dialogElement.value?.close()
  emit('close')
}

async function save() {
  if (saving.value || stylesState.loading || stylesState.error) return
  error.value = validateNotificationForm(form, stylesState.items)
  if (error.value) return
  saving.value = true
  const controller = new AbortController()
  saveController = controller
  const payload = { ...form, name: form.name.trim(), description: form.description.trim(), event: props.policy.event }
  try {
    const data = await updateNotification(props.policy.id, payload, controller.signal)
    if (disposed || controller.signal.aborted) return
    const updated = normalizeNotification(data)
    // Keep the saved values visible if a successful response omits the record.
    emit('saved', updated.id === props.policy.id ? updated : normalizeNotification({ ...payload, id: props.policy.id }))
    close()
  } catch (cause) {
    if (!disposed && !controller.signal.aborted) error.value = cause instanceof Error ? cause.message : '通知策略保存失败，请重试。'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  dialogElement.value.showModal()
  void loadStyles()
})
onBeforeUnmount(() => {
  disposed = true
  stylesController?.abort()
  saveController?.abort()
  form.webhook = ''
  dialogElement.value?.close()
})
</script>

<style scoped>
.notification-dialog {
  padding: 0;
  width: min(560px, calc(100% - 32px));
  max-height: calc(100dvh - 32px);
  overflow: hidden;
  color: var(--ink);
}

.notification-dialog::backdrop {
  background: rgb(0 0 0 / 45%);
}

.notification-dialog form {
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 40px);
}

.notification-dialog :is(.settings-dialog-head, .settings-dialog-actions) {
  flex-shrink: 0;
}

.notification-dialog-scroll {
  min-height: 0;
  overflow-y: auto;
}

.notification-dialog .settings-dialog-actions {
  display: grid;
  justify-content: stretch;
}

.notification-dialog-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.notification-dialog-feedback {
  max-height: 24dvh;
  overflow-y: auto;
  overflow-wrap: anywhere;
}

.notification-fieldset {
  margin: 0;
  border: 0;
  min-width: 0;
}

.settings-field small,
.notification-style-field small {
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.5;
}

.notification-dialog :is(button, input):focus-visible,
.notification-dialog .settings-switch-input:focus-visible + .settings-switch {
  outline: 2px solid var(--line-soft);
  outline-offset: 2px;
}

.notification-style-field {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.notification-style-label {
  color: var(--line);
  font-size: 13px;
  font-weight: 900;
}

.notification-style-options {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.notification-style-option {
  position: relative;
  min-width: 0;
  cursor: pointer;
}

.notification-style-option input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: inherit;
}

.notification-style-tile {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  height: 100%;
  padding: 10px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--ink);
  transition: background-color 150ms ease, border-color 150ms ease;
}

.notification-style-name {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 13px;
  font-weight: 700;
}

.notification-style-swatch {
  flex: 0 0 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--ink-soft);
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 12%);
}

.notification-style-swatch[data-style='blue'] { background: #3b82f6; }
.notification-style-swatch[data-style='orange'] { background: #f59e0b; }
.notification-style-swatch[data-style='purple'] { background: #a855f7; }
.notification-style-swatch[data-style='red'] { background: #ef4444; }
.notification-style-swatch[data-style='green'] { background: #22c55e; }
.notification-style-swatch[data-style='yellow'] { background: #facc15; }
.notification-style-swatch[data-style='grey'] { background: #94a3b8; }

.notification-style-check {
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
  visibility: hidden;
}

.notification-style-option input:checked + .notification-style-tile {
  border-color: var(--line);
  background: var(--surface-2);
}

.notification-style-option input:checked + .notification-style-tile .notification-style-check {
  visibility: visible;
}

.notification-style-option input:hover:not(:disabled) + .notification-style-tile {
  background: var(--surface-2);
  border-color: var(--line);
}

.notification-style-option input:focus-visible + .notification-style-tile {
  outline: 2px solid var(--line-soft);
  outline-offset: 2px;
}

.notification-style-option input:disabled {
  cursor: not-allowed;
}

.notification-style-option input:disabled + .notification-style-tile {
  opacity: 0.55;
}

@media (max-width: 480px) {
  .notification-style-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
