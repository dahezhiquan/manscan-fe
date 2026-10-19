<template>
  <section class="dashboard-risk-panel" :aria-label="title">
    <div class="dashboard-section-head">
      <h4>{{ title }}</h4>
      <button type="button" class="dashboard-text-button" @click="navigateTo(listRoute)">查看清单 ↗</button>
    </div>
    <div class="dashboard-risk-total"><strong>{{ formatDashboardCount(data?.total) }}</strong><span>资产总数</span></div>
    <div class="dashboard-risk-rows">
      <div v-for="item in metrics" :key="item.key" class="dashboard-risk-row">
        <span :class="`tone-${item.tone}`">{{ item.label }}</span>
        <div class="dashboard-meter" :class="`is-${item.tone}`" aria-hidden="true">
          <span v-if="item.count !== null" :style="{ width: `${dashboardPercentage(item.count, data.total)}%` }"></span>
        </div>
        <strong>{{ formatDashboardCount(item.count) }}</strong>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { DASHBOARD_ASSET_RISKS } from '../../constants/dashboard'
import { dashboardPercentage, formatDashboardCount } from '../../utils/dashboard'

const props = defineProps({
  title: { type: String, required: true }, data: { type: Object, default: null },
  listRoute: { type: String, required: true }, navigateTo: { type: Function, required: true }
})
const metrics = computed(() => DASHBOARD_ASSET_RISKS
  .filter((item) => item.key !== 'unknown')
  .map((item) => ({ ...item, count: props.data?.counts[item.key] ?? null })))
</script>
