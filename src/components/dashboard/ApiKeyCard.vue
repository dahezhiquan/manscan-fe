<script setup>
import { ref } from 'vue'

const rootEl = ref(null)

function getElement() {
  return rootEl.value
}

defineExpose({ getElement })
</script>

<template>
  <article ref="rootEl" class="card api-card">
    <div class="panel-head">
      <h3>你的 API Key</h3>
      <div class="mini-actions">
        <button class="ghost-icon" aria-label="显示 API Key">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
            <circle cx="12" cy="12" r="2.8" />
          </svg>
        </button>
        <button class="ghost-icon" aria-label="复制 API Key">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
      </div>
    </div>

    <div class="api-key">••••••••••••••••••••</div>
    <button class="doc-button">查看文档</button>
  </article>
</template>
