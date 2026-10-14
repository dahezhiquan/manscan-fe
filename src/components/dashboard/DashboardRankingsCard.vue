<template>
  <article class="card dashboard-overview-card" :aria-busy="section.status === 'loading'">
    <div class="dashboard-card-head"><div><h3>{{ title }}</h3><p class="dashboard-card-description">{{ description }}</p></div><span class="dashboard-top-badge">TOP 10</span></div>
    <DashboardDataNotice :states="[section]" @retry="emit('retry')" />
    <div class="dashboard-paired-panels">
      <DashboardRankingList v-for="group in groups" :key="group.key" :title="group.title" :unit="group.unit" :tone="group.tone" :items="section.data?.[group.key] ?? null" :status="section.status" :navigate-to="navigateTo" />
    </div>
    <p class="dashboard-footnote">{{ footnote }}</p>
  </article>
</template>

<script setup>
import DashboardDataNotice from './DashboardDataNotice.vue'
import DashboardRankingList from './DashboardRankingList.vue'

defineProps({
  title: { type: String, required: true }, description: { type: String, default: '' },
  section: { type: Object, required: true }, groups: { type: Array, required: true },
  footnote: { type: String, default: '' }, navigateTo: { type: Function, required: true }
})
const emit = defineEmits(['retry'])
</script>
