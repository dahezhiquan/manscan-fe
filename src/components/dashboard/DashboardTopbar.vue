<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'

const props = defineProps({
  currentUserName: {
    type: String,
    default: 'admin'
  },
  currentUserRole: {
    type: String,
    default: 'user'
  }
})

const ROLE_LABELS = {
  admin: '系统管理员',
  user: '普通用户'
}

const CONFETTI_COLORS = [
  '#ff4d6d',
  '#ffb703',
  '#22c55e',
  '#38bdf8',
  '#a855f7',
  '#f97316',
  '#14b8a6',
  '#facc15'
]
const CONFETTI_SHAPES = ['is-ribbon', 'is-spark', 'is-streamer']
const CONFETTI_COUNT = 104
const REDUCED_MOTION_CONFETTI_COUNT = 24
const FIREWORK_COUNT = 14
const REDUCED_MOTION_FIREWORK_COUNT = 5
const CONFETTI_LIFETIME = 2100

const confettiPieces = ref([])
const fireworks = ref([])
let confettiCleanupTimer = null

const greetingUserName = computed(() => props.currentUserName.trim() || 'admin')
const roleLabel = computed(() => {
  const role = props.currentUserRole.trim()
  return ROLE_LABELS[role] || role || '普通用户'
})

function randomBetween(min, max) {
  return Math.random() * (max - min) + min
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function createConfettiPiece(index, count, isReducedMotion) {
  const lane = count > 1 ? index / (count - 1) : Math.random()
  const shape = CONFETTI_SHAPES[index % CONFETTI_SHAPES.length]
  const x = clamp(lane * 100 + randomBetween(-4, 4), 0, 100)
  const peak = isReducedMotion ? randomBetween(18, 34) : randomBetween(55, 98)
  const drift = randomBetween(-220, 220)
  const size = shape === 'is-spark' ? randomBetween(5, 9) : randomBetween(7, 13)
  const height = shape === 'is-streamer' ? randomBetween(26, 44) : randomBetween(10, 24)
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length]

  return {
    id: `${Date.now()}-${index}-${Math.round(Math.random() * 10000)}`,
    shape,
    style: {
      '--confetti-x': `${x}vw`,
      '--confetti-drift': `${drift}px`,
      '--confetti-drift-mid': `${drift * 0.45}px`,
      '--confetti-peak': `${peak}vh`,
      '--confetti-end': `${peak + randomBetween(8, 26)}vh`,
      '--confetti-width': `${size}px`,
      '--confetti-height': `${height}px`,
      '--confetti-color': color,
      '--confetti-spin': `${randomBetween(540, 1320)}deg`,
      '--confetti-spin-mid': `${randomBetween(320, 820)}deg`,
      '--confetti-delay': `${randomBetween(0, isReducedMotion ? 80 : 260)}ms`,
      '--confetti-duration': `${randomBetween(1500, 2350)}ms`
    }
  }
}

function createFireworkBurst(index, count, isReducedMotion) {
  const lane = count > 1 ? index / (count - 1) : Math.random()
  const x = clamp(lane * 100 + randomBetween(-7, 7), 7, 93)
  const y = randomBetween(10, 62)
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length]
  const accentColor = CONFETTI_COLORS[(index + 3) % CONFETTI_COLORS.length]
  const secondaryColor = CONFETTI_COLORS[(index + 5) % CONFETTI_COLORS.length]
  const size = isReducedMotion ? randomBetween(76, 118) : randomBetween(118, 210)

  return {
    id: `firework-${Date.now()}-${index}-${Math.round(Math.random() * 10000)}`,
    style: {
      '--firework-x': `${x}vw`,
      '--firework-y': `${y}vh`,
      '--firework-size': `${size}px`,
      '--firework-color': color,
      '--firework-accent': accentColor,
      '--firework-secondary': secondaryColor,
      '--firework-delay': `${randomBetween(0, isReducedMotion ? 120 : 620)}ms`,
      '--firework-duration': `${randomBetween(860, 1350)}ms`
    }
  }
}

function clearConfettiTimer() {
  if (confettiCleanupTimer) {
    window.clearTimeout(confettiCleanupTimer)
    confettiCleanupTimer = null
  }
}

function launchConfetti() {
  clearConfettiTimer()

  const isReducedMotion = prefersReducedMotion()
  const count = isReducedMotion ? REDUCED_MOTION_CONFETTI_COUNT : CONFETTI_COUNT
  const fireworkCount = isReducedMotion ? REDUCED_MOTION_FIREWORK_COUNT : FIREWORK_COUNT
  fireworks.value = Array.from({ length: fireworkCount }, (_, index) =>
    createFireworkBurst(index, fireworkCount, isReducedMotion)
  )
  confettiPieces.value = Array.from({ length: count }, (_, index) =>
    createConfettiPiece(index, count, isReducedMotion)
  )

  confettiCleanupTimer = window.setTimeout(() => {
    fireworks.value = []
    confettiPieces.value = []
    confettiCleanupTimer = null
  }, CONFETTI_LIFETIME)
}

onBeforeUnmount(() => {
  clearConfettiTimer()
})
</script>

<template>
  <header class="topbar">
    <div class="hero-copy">
      <h1>你好，{{ greetingUserName }}！</h1>
      <span class="plan-pill">{{ roleLabel }}</span>
    </div>

    <div class="topbar-actions">
      <button
        class="easter-egg-button"
        type="button"
        aria-label="触发彩带彩蛋"
        @click="launchConfetti"
      >
        彩蛋
      </button>
    </div>
  </header>

  <div v-if="confettiPieces.length || fireworks.length" class="confetti-layer" aria-hidden="true">
    <div class="firework-field">
      <span
        v-for="firework in fireworks"
        :key="firework.id"
        class="firework-burst"
        :style="firework.style"
      ></span>
    </div>

    <span
      v-for="piece in confettiPieces"
      :key="piece.id"
      class="confetti-piece"
      :class="piece.shape"
      :style="piece.style"
    ></span>
  </div>
</template>

<style scoped>
.easter-egg-button {
  position: relative;
  min-width: 76px;
  height: 40px;
  padding: 0 18px;
  border: var(--border-strong);
  border-radius: var(--radius-md);
  background:
    linear-gradient(135deg, #fffdf7 0%, #ffe8a3 42%, #ffb6b9 100%);
  color: var(--line);
  font-size: 13px;
  font-weight: 900;
  box-shadow: var(--shadow-flat);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    filter 0.18s ease;
}

.easter-egg-button::after {
  content: '';
  position: absolute;
  inset: 5px 8px auto auto;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #38bdf8;
  box-shadow:
    -13px 12px 0 #22c55e,
    -26px 2px 0 #ff4d6d,
    -5px 21px 0 #a855f7;
  opacity: 0.85;
  pointer-events: none;
}

.easter-egg-button:hover {
  transform: translateY(-1px);
  filter: saturate(1.12);
  box-shadow: 3px 3px 0 rgba(31, 26, 23, 0.85);
}

.easter-egg-button:active {
  transform: translateY(1px);
  box-shadow: 1px 1px 0 rgba(31, 26, 23, 0.85);
}

.confetti-layer {
  position: fixed;
  inset: 0;
  z-index: 9999;
  overflow: hidden;
  pointer-events: none;
}

.firework-field {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(circle at 50% 100%, rgba(255, 183, 3, 0.16), transparent 30%),
    radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.12), transparent 24%),
    radial-gradient(circle at 80% 18%, rgba(255, 77, 109, 0.12), transparent 24%);
}

.firework-burst {
  position: absolute;
  left: var(--firework-x);
  top: var(--firework-y);
  width: var(--firework-size);
  height: var(--firework-size);
  border-radius: 999px;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.18);
  background:
    radial-gradient(circle, #fffdf7 0 2px, transparent 3px 100%),
    repeating-conic-gradient(
      from 10deg,
      transparent 0 9deg,
      var(--firework-color) 9deg 13deg,
      transparent 13deg 23deg,
      var(--firework-accent) 23deg 28deg,
      transparent 28deg 40deg,
      var(--firework-secondary) 40deg 43deg,
      transparent 43deg 58deg
    );
  mask-image: radial-gradient(circle, transparent 0 12%, #000 14% 62%, transparent 66% 100%);
  animation: firework-bloom var(--firework-duration) ease-out var(--firework-delay) forwards;
}

.firework-burst::before,
.firework-burst::after {
  content: '';
  position: absolute;
  inset: 8%;
  border-radius: inherit;
  background: radial-gradient(circle, transparent 0 42%, var(--firework-color) 44% 47%, transparent 50% 100%);
  mask-image: radial-gradient(circle, transparent 0 18%, #000 20% 58%, transparent 61% 100%);
  opacity: 0.95;
  animation: firework-ring var(--firework-duration) ease-out var(--firework-delay) forwards;
}

.firework-burst::after {
  inset: 22%;
  transform: rotate(18deg);
  opacity: 0.72;
  animation-delay: calc(var(--firework-delay) + 90ms);
}

.confetti-piece {
  position: absolute;
  z-index: 1;
  left: var(--confetti-x);
  bottom: -48px;
  width: var(--confetti-width);
  height: var(--confetti-height);
  border-radius: 3px;
  background: var(--confetti-color);
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.42);
  opacity: 0;
  transform: translate3d(0, 0, 0) rotate(0deg);
  animation: confetti-launch var(--confetti-duration) cubic-bezier(0.14, 0.9, 0.18, 1) var(--confetti-delay) forwards;
  will-change: transform, opacity;
}

.confetti-piece.is-spark {
  border-radius: 999px;
  aspect-ratio: 1;
  height: var(--confetti-width);
}

.confetti-piece.is-streamer {
  border-radius: 999px;
  background:
    repeating-linear-gradient(
      135deg,
      var(--confetti-color) 0 7px,
      rgba(255, 255, 255, 0.86) 7px 12px
    );
}

@keyframes confetti-launch {
  0% {
    opacity: 0;
    transform: translate3d(0, 0, 0) rotate(0deg) scale(0.7);
  }

  9% {
    opacity: 1;
  }

  58% {
    opacity: 1;
    transform:
      translate3d(var(--confetti-drift-mid), calc(var(--confetti-peak) * -1), 0)
      rotate(var(--confetti-spin-mid))
      scale(1.08);
  }

  100% {
    opacity: 0;
    transform:
      translate3d(var(--confetti-drift), calc(var(--confetti-end) * -1), 0)
      rotate(var(--confetti-spin))
      scale(0.86);
  }
}

@keyframes firework-bloom {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.12);
  }

  12% {
    opacity: 1;
  }

  68% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.18);
  }
}

@keyframes firework-ring {
  0% {
    opacity: 0;
    transform: scale(0.08) rotate(0deg);
  }

  22% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    transform: scale(1.08) rotate(35deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .easter-egg-button,
  .firework-burst,
  .firework-burst::before,
  .firework-burst::after,
  .confetti-piece {
    transition: none;
  }

  .firework-field {
    background: radial-gradient(circle at 50% 52%, rgba(56, 189, 248, 0.14), transparent 42%);
  }

  .firework-burst,
  .firework-burst::before,
  .firework-burst::after {
    animation-duration: 900ms;
  }

  .confetti-piece {
    animation-name: confetti-rise-reduced;
    animation-duration: 900ms;
  }
}

@keyframes confetti-rise-reduced {
  0% {
    opacity: 0;
    transform: translate3d(0, 0, 0) scale(0.9);
  }

  30%,
  70% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    transform: translate3d(0, calc(var(--confetti-peak) * -1), 0) scale(1);
  }
}
</style>
