<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { loginUser } from '../api/auth'
import manscanIcon from '../assets/manscan-icon.png'

const emit = defineEmits(['login-success'])

const securityPioneers = [
  'Ada Lovelace',
  'Alan Turing',
  'Grace Hopper',
  'Claude Shannon',
  'Margaret Hamilton',
  'Donald Knuth',
  'Ken Thompson',
  'Dennis Ritchie',
  'Tim Berners-Lee',
  'Vint Cerf',
  'Bob Kahn',
  'Radia Perlman',
  'Whitfield Diffie',
  'Martin Hellman',
  'Ralph Merkle',
  'Ron Rivest',
  'Adi Shamir',
  'Leonard Adleman',
  'Dorothy Denning',
  'Elizabeth Feinler'
]

const formState = reactive({
  username: '',
  password: ''
})
const loginFailure = reactive({
  remainingAttempts: null,
  locked: false
})
const formError = ref('')
const isSubmitting = ref(false)

const isAccountLocked = computed(() => loginFailure.locked)
const loginErrorClass = computed(() => ({
  'is-warning': Number.isFinite(loginFailure.remainingAttempts) && !loginFailure.locked,
  'is-locked': loginFailure.locked
}))
const loginFailureHint = computed(() => {
  if (loginFailure.locked) {
    return '账户已锁定，请联系管理员处理。'
  }

  if (Number.isFinite(loginFailure.remainingAttempts)) {
    return `剩余尝试次数：${loginFailure.remainingAttempts}`
  }

  return ''
})
const canSubmit = computed(() => formState.username.trim() && formState.password && !isAccountLocked.value)

function resetLoginFailure() {
  loginFailure.remainingAttempts = null
  loginFailure.locked = false
}

function resolveLoginFailure(error) {
  const payload = error?.payload
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : {}
  const remainingAttempts = Number(data.remaining_attempts)

  return {
    message:
      error instanceof Error && error.name === 'HttpRequestError'
        ? error.message
        : '登录失败，请检查网络后重试。',
    remainingAttempts: Number.isFinite(remainingAttempts) ? remainingAttempts : null,
    locked: data.locked === true
  }
}

async function handleSubmit() {
  if (isSubmitting.value) {
    return
  }

  const username = formState.username.trim()
  const password = formState.password

  if (!username || !password) {
    formError.value = '请输入账户和密码。'
    resetLoginFailure()
    return
  }

  isSubmitting.value = true
  formError.value = ''
  resetLoginFailure()

  try {
    const session = await loginUser({ username, password })
    emit('login-success', session)
  } catch (error) {
    const failure = resolveLoginFailure(error)

    formError.value = failure.message
    loginFailure.remainingAttempts = failure.remainingAttempts
    loginFailure.locked = failure.locked

    if (failure.locked) {
      formState.password = ''
    }
  } finally {
    isSubmitting.value = false
  }
}

watch(
  () => formState.username,
  () => {
    if (formError.value || loginFailure.locked || Number.isFinite(loginFailure.remainingAttempts)) {
      formError.value = ''
      resetLoginFailure()
    }
  }
)

watch(
  () => formState.password,
  () => {
    if (!loginFailure.locked && (formError.value || Number.isFinite(loginFailure.remainingAttempts))) {
      formError.value = ''
      resetLoginFailure()
    }
  }
)
</script>

<template>
  <main class="login-page">
    <div class="login-matrix" aria-hidden="true">
      <span v-for="name in securityPioneers" :key="name">{{ name }}</span>
    </div>

    <section class="login-shell" aria-label="登录 ManScan">
      <div class="login-hero">
        <div class="login-brand-lockup">
          <span class="login-brand-mark">
            <img :src="manscanIcon" alt="" />
          </span>
          <span class="login-brand-text">ManScan</span>
        </div>

        <div class="login-hero-copy">
          <span class="login-kicker">下一代 AI & DAST</span>
          <h1>进入扫描控制台</h1>
        </div>

        <div class="login-terminal" aria-hidden="true">
          <div class="login-terminal-head">
            <span></span>
            <span></span>
            <span></span>
            <strong>trace://manscan/auth</strong>
          </div>
          <div class="login-terminal-body">
            <p><span>$</span> handshake --target console</p>
            <p><span>&gt;</span> identity: admin</p>
            <p><span>&gt;</span> waf-bypass: simulated</p>
            <p><span>&gt;</span> status: ready</p>
          </div>
        </div>
      </div>

      <form class="login-card" @submit.prevent="handleSubmit">
        <div class="login-card-head">
          <span class="login-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="5" y="10.5" width="14" height="9" rx="2" />
              <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
              <path d="M12 14v2" />
            </svg>
          </span>
          <div>
            <h2>身份验证</h2>
          </div>
        </div>

        <label class="login-field">
          <span>账户</span>
          <input
            v-model="formState.username"
            type="text"
            name="username"
            autocomplete="username"
            maxlength="64"
            placeholder="请输入账户"
            :aria-invalid="Boolean(formError)"
          />
        </label>

        <label class="login-field">
          <span>密码</span>
          <input
            v-model="formState.password"
            type="password"
            name="password"
            autocomplete="current-password"
            maxlength="256"
            placeholder="请输入密码"
            :aria-invalid="Boolean(formError)"
            :disabled="isAccountLocked"
          />
        </label>

        <div v-if="formError" class="login-error" :class="loginErrorClass" aria-live="polite">
          <p>{{ formError }}</p>
          <span v-if="loginFailureHint">{{ loginFailureHint }}</span>
        </div>

        <button class="login-submit" type="submit" :disabled="!canSubmit || isSubmitting">
          <span>{{ isSubmitting ? '校验中' : '登录' }}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M5 12h13" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </button>
      </form>
    </section>
  </main>
</template>
