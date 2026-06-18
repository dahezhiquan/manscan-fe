<script setup>
defineProps({
  stats: {
    type: Array,
    default: () => []
  }
})
</script>

<template>
  <article class="card info-card">
    <div class="card-header info-card-header with-leading-icon">
      <span class="section-leading-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </span>
      <h3>修复效率（近 30 天）</h3>
      <span class="info-icon">i</span>
    </div>

    <div class="summary-row four-cols">
      <div v-for="item in stats" :key="item.label" class="summary-box">
        <div class="summary-value" :class="{ 'summary-value-muted': item.value === '--' }">
          {{ item.value }}
        </div>
        <div class="summary-label plain-label">{{ item.label }}</div>
      </div>
    </div>

    <div class="remediation-panel">
      <div class="remediation-legend">
        <span class="legend-item">
          <span class="legend-dot critical-dot"></span>
          <span>严重</span>
        </span>
        <span class="legend-item">
          <span class="legend-dot high-dot"></span>
          <span>高危</span>
        </span>
        <span class="legend-item">
          <span class="legend-dot medium-dot"></span>
          <span>中危</span>
        </span>
      </div>

      <div class="remediation-chart">
        <div class="chart-line top-line"></div>
        <div class="chart-line bottom-line"></div>
      </div>
    </div>
  </article>
</template>
