<template>
  <article class="card dashboard-overview-card">
    <div class="dashboard-card-head"><div><h3>快捷操作</h3><p class="dashboard-card-description">发现资产，验证并处置风险</p></div></div>
    <div class="dashboard-quick-actions">
      <button v-for="item in actions" :key="item.route" type="button" @click="navigateTo(item.route)">
        <span class="dashboard-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path :d="item.icon" /></svg></span>
        <span><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span>
        <span class="dashboard-action-arrow" aria-hidden="true">↗</span>
      </button>
    </div>
  </article>
</template>

<script setup>
defineProps({ navigateTo: { type: Function, required: true } })
const actions = [
  { label: '创建扫描任务', description: '探测资产与验证漏洞', route: '/scans/create', icon: 'M12 5v14M5 12h14' },
  { label: '查看扫描任务', description: '跟进执行状态与结果', route: '/scans', icon: 'M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3M7 12h10' },
  { label: '浏览漏洞模板', description: '查找检测能力与规则', route: '/templates/all', icon: 'M6 3h9l3 3v15H6zM14 3v5h4M9 12h6M9 16h6' }
]
</script>
