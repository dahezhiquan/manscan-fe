<script setup>
import { computed, reactive, ref } from 'vue'
import manscanIcon from '../assets/manscan-icon.png'

const emit = defineEmits(['login-success'])

const LOGIN_USERNAME = 'admin'
const LOGIN_PASSWORD = 'admin'
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
const formError = ref('')
const isSubmitting = ref(false)

const canSubmit = computed(() => formState.username.trim() && formState.password)

function handleSubmit() {
  if (isSubmitting.value) {
    return
  }

  const username = formState.username.trim()
  const password = formState.password

  if (!username || !password) {
    formError.value = '请输入账户和密码。'
    return
  }

  isSubmitting.value = true
  formError.value = ''

  if (username === LOGIN_USERNAME && password === LOGIN_PASSWORD) {
    emit('login-success', {
      username,
      loggedInAt: Date.now()
    })
  } else {
    formError.value = '账户或密码不正确。'
  }

  isSubmitting.value = false
}
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
            placeholder="admin"
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
            placeholder="admin"
            :aria-invalid="Boolean(formError)"
          />
        </label>

        <p v-if="formError" class="login-error" aria-live="polite">{{ formError }}</p>

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
