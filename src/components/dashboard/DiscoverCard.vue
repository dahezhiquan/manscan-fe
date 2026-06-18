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
      <h2>发现资产</h2>
      <p>你的免费账户支持资产发现。使用工作邮箱注册后可进一步发现漏洞。</p>
    </div>
    <button class="dark-button" @click="handleStartScan">开始扫描</button>
  </section>
</template>
