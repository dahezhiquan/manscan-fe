<script setup>
const props = defineProps({
  navigateTo: {
    type: Function,
    default: null
  }
})

function handleStartScan() {
  props.navigateTo?.('/scans')
}
</script>

<template>
  <section class="discover-card card">
    <div>
      <h2>漏洞扫描 / 资产探测</h2>
      <p>依托深度 AI 集成能力，完成全网资产测绘与漏洞深度探测</p>
    </div>
    <button class="dark-button" @click="handleStartScan">开始扫描</button>
  </section>
</template>
