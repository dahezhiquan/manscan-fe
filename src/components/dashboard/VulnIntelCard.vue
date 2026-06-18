<script setup>
import { computed, ref } from 'vue'
import globeAsset from '../../assets/earth.png'

const props = defineProps({
  latestDetections: {
    type: Array,
    default: () => []
  },
  vulnerabilityDetections: {
    type: Array,
    default: () => []
  },
  minHeight: {
    type: Number,
    default: null
  }
})

const vulnerabilityQuery = ref('')

const filteredDetections = computed(() => {
  const keyword = vulnerabilityQuery.value.trim().toLowerCase()

  if (!keyword) {
    return props.vulnerabilityDetections
  }

  return props.vulnerabilityDetections.filter((item) =>
    [item.severity, item.tag, item.title, item.time].some((field) =>
      field.toLowerCase().includes(keyword)
    )
  )
})

const cardStyle = computed(() =>
  props.minHeight ? { minHeight: `${props.minHeight}px` } : null
)

function severityClass(tone) {
  return `severity-${tone}`
}
</script>

<template>
  <article class="card newest-card" :style="cardStyle">
    <div class="newest-header">
      <div class="card-header">
        <h3>最新漏洞情报</h3>
        <span class="info-icon">i</span>
      </div>

      <div class="detection-grid">
        <div v-for="item in latestDetections" :key="item.label" class="detection-box">
          <div class="detection-value">{{ item.value }}</div>
          <div class="detection-label">{{ item.label }}</div>
        </div>
      </div>
    </div>

    <div class="globe-section">
      <div class="globe-shell" aria-hidden="true">
        <img class="globe-image" :src="globeAsset" alt="" />
      </div>
    </div>

    <div class="search-section">
      <input
        v-model="vulnerabilityQuery"
        class="vulnerability-search"
        type="text"
        placeholder="搜索漏洞情报..."
      />
    </div>

    <div class="detection-list">
      <article
        v-for="item in filteredDetections"
        :key="`${item.severity}-${item.tag}`"
        class="detection-item"
      >
        <div class="detection-item-top">
          <div class="detection-tags">
            <span class="severity-pill" :class="severityClass(item.severityTone)">
              {{ item.severity }}
            </span>
            <span class="detection-chip">{{ item.tag }}</span>
          </div>
          <span class="detection-time">{{ item.time }}</span>
        </div>

        <div class="detection-item-title">{{ item.title }}</div>
      </article>

      <div v-if="filteredDetections.length === 0" class="detection-empty">
        没有匹配的漏洞结果
      </div>
    </div>

    <div class="panel-footer">
      <button class="panel-footer-button">查看全部</button>
    </div>
  </article>
</template>
