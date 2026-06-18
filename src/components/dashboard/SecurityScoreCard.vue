<script setup>
import { ref } from 'vue'

const rootEl = ref(null)

function getElement() {
  return rootEl.value
}

defineExpose({ getElement })
</script>

<template>
  <article ref="rootEl" class="card score-card">
    <div class="panel-head">
      <div class="card-header">
        <h3>安全评分</h3>
        <span class="info-icon">i</span>
      </div>
      <button class="ghost-icon" aria-label="打开详情">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M8 16 16 8" />
          <path d="M10 8h6v6" />
        </svg>
      </button>
    </div>

    <div class="score-row">
      <div class="score-value">100</div>
      <span class="score-badge">优秀</span>
    </div>

    <div class="score-track">
      <div class="score-dot"></div>
    </div>
  </article>
</template>
