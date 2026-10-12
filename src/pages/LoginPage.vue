<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { getAuthChallenge, loginUser } from '../api/auth'
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
const challengeState = reactive({
  id: '',
  type: '',
  scene: null,
  requirements: null,
  status: 'idle',
  error: ''
})
const sliderState = reactive({
  angle: 0,
  dragDurationMs: 0,
  isDragging: false,
  startTime: 0,
  touched: false,
  track: []
})
const loginFailure = reactive({
  remainingAttempts: null,
  locked: false
})
const captchaRef = ref(null)
const formError = ref('')
const isSubmitting = ref(false)

const ORBIT_SIZE = 148
const ORBIT_CENTER = ORBIT_SIZE / 2
const ORBIT_RADIUS = 52
const KNOB_SIZE = 34
const TRACK_SAMPLE_INTERVAL = 16

const isAccountLocked = computed(() => loginFailure.locked)
const challengeSceneType = computed(() => {
  const scene = challengeState.scene || {}
  return String(
    challengeState.type ||
    scene.type ||
    scene.scene ||
    scene.name ||
    ''
  ).trim()
})
const challengePrompt = computed(() => {
  const scene = challengeState.scene

  if (!scene || typeof scene === 'string') {
    return '拖动滑块完成安全验证'
  }

  return String(scene.prompt ?? scene.title ?? scene.instruction ?? '拖动滑块完成安全验证').trim()
})
const targetAngle = computed(() => {
  const scene = challengeState.scene

  if (!scene || typeof scene === 'string') {
    return null
  }

  const value = Number(scene.target_angle ?? scene.targetAngle ?? scene.target)
  return Number.isFinite(value) ? normalizeAngle(value) : null
})
const isChallengeLoading = computed(() => challengeState.status === 'loading')
const isChallengeReady = computed(() =>
  challengeState.status === 'success' &&
  challengeState.id &&
  challengeSceneType.value === 'orbital_slider'
)
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
const knobPoint = computed(() => resolveOrbitPoint(sliderState.angle))
const knobStyle = computed(() => ({
  transform: `translate(${knobPoint.value.x - KNOB_SIZE / 2}px, ${knobPoint.value.y - KNOB_SIZE / 2}px)`
}))
const targetPoint = computed(() => (targetAngle.value === null ? null : resolveOrbitPoint(targetAngle.value)))
const maxTrackPoints = computed(() => {
  const value = Number(challengeState.requirements?.max_track_points ?? challengeState.requirements?.maxTrackPoints)
  return Number.isFinite(value) && value > 0 ? value : 240
})
const canSubmit = computed(() =>
  formState.username.trim() &&
  formState.password &&
  !isAccountLocked.value &&
  isChallengeReady.value &&
  sliderState.touched
)

function resetLoginFailure() {
  loginFailure.remainingAttempts = null
  loginFailure.locked = false
}

function normalizeAngle(angle) {
  return ((Number(angle) % 360) + 360) % 360
}

function resolveOrbitPoint(angle) {
  const radian = normalizeAngle(angle) * Math.PI / 180

  return {
    x: ORBIT_CENTER + Math.cos(radian) * ORBIT_RADIUS,
    y: ORBIT_CENTER + Math.sin(radian) * ORBIT_RADIUS
  }
}

function resolveInitialAngle(scene) {
  if (!scene || typeof scene === 'string') {
    return 0
  }

  const value = Number(scene.start_angle ?? scene.startAngle ?? scene.initial_angle ?? scene.initialAngle)
  return Number.isFinite(value) ? normalizeAngle(value) : 0
}

function normalizeChallenge(payload) {
  const scene = payload?.scene ?? payload?.challenge?.scene ?? null

  return {
    id: String(
      payload?.challenge_id ??
      payload?.challengeId ??
      payload?.id ??
      payload?.challenge?.challenge_id ??
      payload?.challenge?.challengeId ??
      payload?.challenge?.id ??
      ''
    ).trim(),
    type: String(
      payload?.challenge_type ??
      payload?.challengeType ??
      payload?.type ??
      payload?.challenge?.challenge_type ??
      payload?.challenge?.challengeType ??
      payload?.challenge?.type ??
      scene?.type ??
      scene?.scene ??
      scene?.name ??
      ''
    ).trim(),
    scene,
    requirements: payload?.requirements ?? payload?.challenge?.requirements ?? null
  }
}

function resetSliderAnswer(angle = 0) {
  sliderState.angle = normalizeAngle(angle)
  sliderState.dragDurationMs = 0
  sliderState.isDragging = false
  sliderState.startTime = 0
  sliderState.touched = false
  sliderState.track = []
}

function buildChallengeAnswer() {
  return {
    angle: Number(sliderState.angle.toFixed(2)),
    drag_duration_ms: Math.max(0, Math.round(sliderState.dragDurationMs)),
    track: sliderState.track.map((point) => ({
      x: point.x,
      y: point.y,
      t: point.t
    }))
  }
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
    locked: data.locked === true,
    refreshRequired: data.refresh_required === true
  }
}

function appendTrackPoint(x, y, elapsed) {
  const previousPoint = sliderState.track[sliderState.track.length - 1]
  const roundedPoint = {
    x: Math.round(x),
    y: Math.round(y),
    t: Math.max(0, Math.round(elapsed))
  }

  if (
    previousPoint &&
    roundedPoint.t - previousPoint.t < TRACK_SAMPLE_INTERVAL &&
    sliderState.track.length < maxTrackPoints.value
  ) {
    sliderState.track[sliderState.track.length - 1] = roundedPoint
    return
  }

  if (sliderState.track.length < maxTrackPoints.value) {
    sliderState.track.push(roundedPoint)
  }
}

function updateSliderFromPointer(event) {
  const rect = captchaRef.value?.getBoundingClientRect()

  if (!rect) {
    return
  }

  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const centerX = rect.width / 2
  const centerY = rect.height / 2
  const elapsed = sliderState.startTime ? performance.now() - sliderState.startTime : 0

  sliderState.angle = normalizeAngle(Math.atan2(y - centerY, x - centerX) * 180 / Math.PI)
  sliderState.dragDurationMs = elapsed
  sliderState.touched = true
  appendTrackPoint(x, y, elapsed)
}

function stopSliderDrag() {
  if (!sliderState.isDragging) {
    return
  }

  sliderState.isDragging = false
  window.removeEventListener('pointermove', handleSliderPointerMove)
  window.removeEventListener('pointerup', handleSliderPointerUp)
  window.removeEventListener('pointercancel', handleSliderPointerUp)
}

function handleSliderPointerMove(event) {
  if (!sliderState.isDragging) {
    return
  }

  event.preventDefault()
  updateSliderFromPointer(event)
}

function handleSliderPointerUp(event) {
  if (sliderState.isDragging) {
    updateSliderFromPointer(event)
  }

  stopSliderDrag()
}

function handleSliderPointerDown(event) {
  if (!isChallengeReady.value || isSubmitting.value) {
    return
  }

  event.preventDefault()
  sliderState.isDragging = true
  sliderState.startTime = performance.now()
  sliderState.dragDurationMs = 0
  sliderState.track = []
  updateSliderFromPointer(event)
  window.addEventListener('pointermove', handleSliderPointerMove)
  window.addEventListener('pointerup', handleSliderPointerUp)
  window.addEventListener('pointercancel', handleSliderPointerUp)
}

function handleSliderKeydown(event) {
  if (!isChallengeReady.value) {
    return
  }

  const keyDeltaMap = {
    ArrowLeft: -5,
    ArrowDown: -5,
    ArrowRight: 5,
    ArrowUp: 5
  }
  const delta = keyDeltaMap[event.key]

  if (!delta) {
    return
  }

  event.preventDefault()
  sliderState.angle = normalizeAngle(sliderState.angle + delta)
  sliderState.dragDurationMs = 0
  sliderState.touched = true
  const point = knobPoint.value
  sliderState.track = [{ x: Math.round(point.x), y: Math.round(point.y), t: 0 }]
}

async function loadChallenge(message = '') {
  challengeState.status = 'loading'
  challengeState.error = ''
  challengeState.id = ''
  challengeState.type = ''
  challengeState.scene = null
  challengeState.requirements = null
  resetSliderAnswer()

  try {
    const data = await getAuthChallenge()
    const challenge = normalizeChallenge(data)

    if (!challenge.id) {
      throw new Error('验证码响应缺少 challenge_id。')
    }

    challengeState.id = challenge.id
    challengeState.type = challenge.type
    challengeState.scene = challenge.scene
    challengeState.requirements = challenge.requirements

    if (challengeSceneType.value !== 'orbital_slider') {
      throw new Error('当前验证码场景暂不支持。')
    }

    resetSliderAnswer(resolveInitialAngle(challenge.scene))
    challengeState.status = 'success'

    if (message) {
      formError.value = message
    }
  } catch (error) {
    challengeState.status = 'error'
    challengeState.error = error instanceof Error ? error.message : '验证码加载失败。'
  }
}

function refreshChallenge() {
  void loadChallenge()
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

  if (!isChallengeReady.value || !sliderState.touched) {
    formError.value = isChallengeLoading.value ? '验证码加载中，请稍候。' : '请先完成安全验证。'
    resetLoginFailure()
    return
  }

  isSubmitting.value = true
  formError.value = ''
  resetLoginFailure()

  try {
    const session = await loginUser({
      username,
      password,
      challengeId: challengeState.id,
      challengeAnswer: buildChallengeAnswer()
    })
    emit('login-success', session)
  } catch (error) {
    const failure = resolveLoginFailure(error)

    formError.value = failure.message
    loginFailure.remainingAttempts = failure.remainingAttempts
    loginFailure.locked = failure.locked

    if (failure.refreshRequired) {
      await loadChallenge('验证码已刷新，请重新完成验证后重试。')
    }

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

onMounted(() => {
  void loadChallenge()
})

onBeforeUnmount(() => {
  stopSliderDrag()
})
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

        <div class="login-challenge">
          <div class="login-challenge-head">
            <span>安全验证</span>
            <button
              class="login-challenge-refresh"
              type="button"
              aria-label="刷新验证码"
              :disabled="isChallengeLoading || isSubmitting"
              @click="refreshChallenge"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path d="M20 6v5h-5" />
                <path d="M4 18v-5h5" />
                <path d="M18.6 9A7 7 0 0 0 6.2 6.7L4 9" />
                <path d="M5.4 15A7 7 0 0 0 17.8 17.3L20 15" />
              </svg>
            </button>
          </div>

          <div v-if="isChallengeLoading" class="login-challenge-status" aria-live="polite">
            正在加载验证
          </div>

          <div v-else-if="challengeState.status === 'error'" class="login-challenge-status is-error" aria-live="polite">
            <span>{{ challengeState.error }}</span>
            <button type="button" @click="refreshChallenge">重试</button>
          </div>

          <div
            v-else
            ref="captchaRef"
            class="login-orbit"
            :class="{ 'is-done': sliderState.touched, 'is-dragging': sliderState.isDragging }"
          >
            <svg class="login-orbit-svg" viewBox="0 0 148 148" aria-hidden="true">
              <circle cx="74" cy="74" r="52" />
              <path v-if="targetPoint" :d="`M74 74 L${targetPoint.x} ${targetPoint.y}`" />
              <circle v-if="targetPoint" class="login-orbit-target" :cx="targetPoint.x" :cy="targetPoint.y" r="6" />
            </svg>
            <button
              class="login-orbit-knob"
              type="button"
              :style="knobStyle"
              :aria-label="`拖动验证滑块，当前角度 ${Math.round(sliderState.angle)} 度`"
              :aria-valuenow="Math.round(sliderState.angle)"
              aria-valuemin="0"
              aria-valuemax="359"
              role="slider"
              @pointerdown="handleSliderPointerDown"
              @keydown="handleSliderKeydown"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <circle cx="12" cy="12" r="3.5" />
                <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
              </svg>
            </button>
            <div class="login-orbit-copy">
              <strong>{{ Math.round(sliderState.angle) }}°</strong>
              <span>{{ sliderState.touched ? '验证轨迹已记录' : challengePrompt }}</span>
            </div>
          </div>
        </div>

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
