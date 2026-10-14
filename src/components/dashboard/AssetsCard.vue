<template>
  <article class="card dashboard-overview-card" :aria-busy="section.status === 'loading'">
    <div class="dashboard-card-head">
      <div><h3>资产风险分布</h3></div>
    </div>
    <DashboardDataNotice :states="[section]" @retry="emit('retry')" />
    <div class="dashboard-paired-panels">
      <AssetOverviewCard title="主机资产" :data="section.data?.hosts" list-route="/assets/hosts" :navigate-to="navigateTo" />
      <AssetOverviewCard title="域名资产" :data="section.data?.domains" list-route="/assets/domains" :navigate-to="navigateTo" />
    </div>
  </article>
</template>

<script setup>
import AssetOverviewCard from './AssetOverviewCard.vue'
import DashboardDataNotice from './DashboardDataNotice.vue'

defineProps({ section: { type: Object, required: true }, navigateTo: { type: Function, required: true } })
const emit = defineEmits(['retry'])
</script>
