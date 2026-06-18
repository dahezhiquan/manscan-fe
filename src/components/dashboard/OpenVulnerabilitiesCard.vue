<script setup>
defineProps({
  stats: {
    type: Array,
    default: () => []
  },
  navigateTo: {
    type: Function,
    default: null
  }
})
</script>

<template>
  <article
    class="card stats-card"
    :class="{ 'stats-card-link': Boolean(navigateTo) }"
    @click="navigateTo && navigateTo('/vulnerabilities')"
  >
    <div class="card-header">
      <h3>待处理漏洞</h3>
      <span class="info-icon">i</span>
    </div>

    <div class="stats-row">
      <div v-for="item in stats" :key="item.label" class="stat-box">
        <div class="stat-value" :class="`tone-${item.tone}`">{{ item.value }}</div>
        <div class="stat-label">{{ item.label }}</div>
      </div>
    </div>

    <div class="category-panel">
      <h3>按类别查看漏洞</h3>
      <p>暂未发现漏洞</p>
    </div>
  </article>
</template>
