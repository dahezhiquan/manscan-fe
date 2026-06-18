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
    <div class="card-header info-card-header">
      <h3>我的资产</h3>
      <span class="info-icon">i</span>
    </div>

    <div class="summary-row four-cols">
      <div v-for="item in stats" :key="item.label" class="summary-box">
        <div class="summary-value">{{ item.value }}</div>
        <div class="summary-label">
          <span class="summary-info">i</span>
          <span>{{ item.label }}</span>
        </div>
      </div>
    </div>

    <div class="empty-panel">
      <h3>资产分类</h3>
      <p>暂未发现资产</p>
    </div>

    <div class="panel-footer">
      <button class="panel-footer-button">查看全部</button>
    </div>
  </article>
</template>
