<template>
  <main class="vuln-page">
    <section class="vulnerabilities-hero">
      <div>
        <span class="vulnerabilities-kicker">VULNERABILITIES</span>
        <h1>漏洞查询</h1>
        <div class="vulnerabilities-hero-meta">
          <span class="vulnerabilities-hero-chip">总数 {{ formatVulnerabilityCount(total) }}</span>
        </div>
      </div>

      <div class="vulnerabilities-hero-actions">
        <button
          class="vulnerabilities-icon-button"
          type="button"
          :disabled="isLoading || isRefreshing"
          :aria-busy="isRefreshing ? 'true' : 'false'"
          aria-label="刷新漏洞列表"
          @click="handleRefresh"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M20 12a8 8 0 1 1-2.34-5.66" />
            <path d="M20 4v5h-5" />
          </svg>
        </button>
      </div>
    </section>

    <section class="vulnerabilities-content">
      <section ref="filtersRef" class="vulnerabilities-filter-panel" aria-label="漏洞筛选条件">
        <label class="vulnerabilities-search-field is-main">
          <input
            v-model="filterInput.searchQuery"
            type="text"
            placeholder="搜索漏洞名称或 Template ID..."
            aria-label="搜索漏洞名称或 Template ID"
            autocomplete="off"
          />
          <span class="vulnerabilities-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
          </span>
        </label>

        <label class="vulnerabilities-search-field is-host">
          <input
            v-model="filterInput.assetHost"
            type="text"
            placeholder="搜索 Asset Host..."
            aria-label="搜索 Asset Host"
            autocomplete="off"
          />
          <span class="vulnerabilities-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
          </span>
        </label>

        <div
          v-for="filter in filterMenus"
          :key="filter.key"
          class="vulnerabilities-filter-wrap"
        >
          <button
            class="vulnerabilities-filter-trigger"
            :class="{ active: isMenuOpen(filter.key) || getSelectedFilterCount(filter.key) > 0 }"
            type="button"
            @click.stop="toggleFilterMenu(filter.key)"
          >
            <span
              v-if="filter.icon"
              class="vulnerabilities-filter-trigger-icon"
              :class="`is-${filter.icon}`"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <template v-if="filter.icon === 'status'">
                  <path d="M12 4.5 18.5 7v5.2c0 4.1-2.7 6.5-6.5 7.3-3.8-.8-6.5-3.2-6.5-7.3V7L12 4.5Z" />
                  <path d="M9.2 12.2 11 14l3.8-4" />
                </template>
                <template v-else>
                  <path d="M12 4.5 19 18.5H5L12 4.5Z" />
                  <path d="M12 9.2v4.4" />
                  <path d="M12 16.4h.01" />
                </template>
              </svg>
            </span>
            <span>{{ getFilterButtonLabel(filter) }}</span>
            <span v-if="getSelectedFilterCount(filter.key) > 1" class="vulnerabilities-filter-count">
              {{ getSelectedFilterCount(filter.key) }}
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path :d="isMenuOpen(filter.key) ? 'm7 14 5-5 5 5' : 'm7 10 5 5 5-5'" />
            </svg>
          </button>

          <div
            v-if="isMenuOpen(filter.key)"
            class="vulnerabilities-filter-menu"
            :class="{
              'is-tag-menu': filter.key === 'tags' || filter.key === 'latestScanTaskName',
              'is-scan-task-menu': filter.key === 'latestScanTaskName'
            }"
          >
            <template v-if="filter.key === 'tags'">
              <div class="vulnerabilities-tag-menu-search">
                <input
                  v-model="tagKeyword"
                  type="text"
                  placeholder="搜索标签"
                  aria-label="搜索漏洞标签"
                  autocomplete="off"
                />
              </div>

              <div v-if="selectedTagOptions.length > 0" class="vulnerabilities-selected-tags">
                <button
                  v-for="tag in selectedTagOptions"
                  :key="tag.value"
                  class="vulnerabilities-selected-tag"
                  type="button"
                  @click.stop="removeTagFilter(tag.value)"
                >
                  <span>#{{ tag.label }}</span>
                  <small>移除</small>
                </button>
              </div>

              <button
                class="vulnerabilities-filter-option is-clear-option"
                :class="{ selected: isOptionSelected(filter.key, '') }"
                type="button"
                @click.stop="clearEnumFilter(filter.key)"
              >
                <span
                  class="vulnerabilities-filter-check"
                  :class="{ selected: isOptionSelected(filter.key, '') }"
                  aria-hidden="true"
                ></span>
                <span class="vulnerabilities-filter-option-label">全部标签</span>
              </button>

              <div class="vulnerabilities-tag-menu-list" @scroll="handleTagMenuScroll">
                <button
                  v-for="option in visibleTagOptions"
                  :key="option.value"
                  class="vulnerabilities-filter-option is-tag-option"
                  :class="{ selected: isOptionSelected(filter.key, option.value) }"
                  type="button"
                  @click.stop="toggleEnumFilter(filter.key, option.value)"
                >
                  <span
                    class="vulnerabilities-filter-check"
                    :class="{ selected: isOptionSelected(filter.key, option.value) }"
                    aria-hidden="true"
                  ></span>
                  <span class="vulnerabilities-filter-option-label">#{{ option.label }}</span>
                </button>

                <p v-if="matchedTagOptions.length === 0" class="vulnerabilities-tag-menu-empty">
                  没有匹配到标签，请换个关键词试试。
                </p>

                <div
                  v-else-if="hasMoreTagOptions"
                  class="vulnerabilities-tag-load-status"
                  aria-live="polite"
                >
                  已显示 {{ visibleTagOptions.length }} / {{ matchedTagOptions.length }}
                </div>
              </div>
            </template>

            <template v-else-if="filter.key === 'latestScanTaskName'">
              <div class="vulnerabilities-tag-menu-search">
                <input
                  v-model="scanTaskKeyword"
                  type="text"
                  placeholder="搜索扫描任务"
                  aria-label="搜索扫描任务"
                  autocomplete="off"
                />
              </div>

              <button
                class="vulnerabilities-filter-option is-clear-option"
                :class="{ selected: isOptionSelected(filter.key, '') }"
                type="button"
                @click.stop="clearEnumFilter(filter.key)"
              >
                <span
                  class="vulnerabilities-filter-check"
                  :class="{ selected: isOptionSelected(filter.key, '') }"
                  aria-hidden="true"
                ></span>
                <span class="vulnerabilities-filter-option-label">全部任务</span>
              </button>

              <div class="vulnerabilities-tag-menu-list" @scroll="handleScanTaskMenuScroll">
                <button
                  v-for="option in scanTaskOptions"
                  :key="option.value"
                  class="vulnerabilities-filter-option is-scan-task-option"
                  :class="{ selected: isOptionSelected(filter.key, option.value) }"
                  type="button"
                  @click.stop="toggleEnumFilter(filter.key, option.value)"
                >
                  <span
                    class="vulnerabilities-filter-check"
                    :class="{ selected: isOptionSelected(filter.key, option.value) }"
                    aria-hidden="true"
                  ></span>
                  <span class="vulnerabilities-filter-option-label">{{ option.label }}</span>
                </button>

                <p
                  v-if="!isScanTaskOptionsLoading && scanTaskOptions.length === 0 && !scanTaskOptionsError"
                  class="vulnerabilities-tag-menu-empty"
                >
                  没有匹配到扫描任务，请换个关键词试试。
                </p>

                <div
                  v-if="isScanTaskOptionsLoading"
                  class="vulnerabilities-tag-load-status"
                  aria-live="polite"
                >
                  正在加载扫描任务...
                </div>

                <div
                  v-else-if="scanTaskOptionsError"
                  class="vulnerabilities-tag-load-status"
                  aria-live="polite"
                >
                  <span>{{ scanTaskOptionsError }}</span>
                  <button type="button" @click.stop="retryScanTaskOptions">重试</button>
                </div>

                <div
                  v-else-if="hasMoreScanTaskOptions"
                  class="vulnerabilities-tag-load-status"
                  aria-live="polite"
                >
                  已显示 {{ scanTaskOptions.length }} / {{ scanTaskOptionTotal }}
                </div>
              </div>
            </template>

            <template v-else>
              <button
                v-for="option in filter.options"
                :key="option.value || `${filter.key}-all`"
                class="vulnerabilities-filter-option"
                :class="{ selected: isOptionSelected(filter.key, option.value) }"
                type="button"
                @click.stop="toggleEnumFilter(filter.key, option.value)"
              >
                <span
                  class="vulnerabilities-filter-check"
                  :class="{ selected: isOptionSelected(filter.key, option.value) }"
                  aria-hidden="true"
                ></span>
                <span
                  v-if="filter.key === 'severity'"
                  class="vulnerabilities-filter-option-icon"
                  :class="`is-${option.value || 'all'}`"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M12 4.8 18 7v4.8c0 3.8-2.5 6-6 6.8-3.5-.8-6-3-6-6.8V7l6-2.2Z" />
                  </svg>
                </span>
                <span
                  v-else-if="filter.key === 'status'"
                  class="vulnerabilities-filter-option-icon"
                  :class="`is-status-${option.value || 'all'}`"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <template v-if="!option.value">
                      <path d="M4 7.5h16" />
                      <path d="M7 12h10" />
                      <path d="M10 16.5h4" />
                    </template>
                    <template v-else-if="option.value === 'unreviewed'">
                      <circle cx="12" cy="12" r="7.2" />
                      <path d="M12 8.2v4.4l2.8 1.7" />
                      <path d="M17.5 5.7 19 4.2" />
                    </template>
                    <template v-else-if="option.value === 'confirmed'">
                      <path d="M12 4.8 18 7v4.8c0 3.8-2.5 6-6 6.8-3.5-.8-6-3-6-6.8V7l6-2.2Z" />
                      <path d="m9.2 12.1 1.8 1.8 3.9-4.1" />
                    </template>
                    <template v-else-if="option.value === 'ticketed'">
                      <path d="M5.2 7.4a2 2 0 0 1 2-2h9.6a2 2 0 0 1 2 2v2.1a2.2 2.2 0 0 0 0 5v2.1a2 2 0 0 1-2 2H7.2a2 2 0 0 1-2-2v-2.1a2.2 2.2 0 0 0 0-5V7.4Z" />
                      <path d="M10 8.5h4" />
                      <path d="M10 12h4" />
                      <path d="M10 15.5h2.6" />
                    </template>
                    <template v-else-if="option.value === 'fixed'">
                      <path d="M14.2 5.2a4.2 4.2 0 0 0 4.6 5.4l-7.9 7.9a2.4 2.4 0 0 1-3.4-3.4l7.9-7.9a4.2 4.2 0 0 0-1.2-2Z" />
                      <path d="m15.4 14.2 1.5 1.5 3-3" />
                    </template>
                    <template v-else-if="option.value === 'false_positive'">
                      <path d="M7.2 5.6h9.6l3.2 3.2v6.4l-3.2 3.2H7.2L4 15.2V8.8l3.2-3.2Z" />
                      <path d="m9.2 9.2 5.6 5.6" />
                      <path d="m14.8 9.2-5.6 5.6" />
                    </template>
                    <template v-else-if="option.value === 'ignored'">
                      <path d="M4.5 12s2.8-5.2 7.5-5.2S19.5 12 19.5 12s-2.8 5.2-7.5 5.2S4.5 12 4.5 12Z" />
                      <path d="M9.8 12a2.2 2.2 0 0 0 2.2 2.2" />
                      <path d="M3.8 4.2 20.2 20.6" />
                    </template>
                    <template v-else>
                      <circle cx="12" cy="12" r="7.2" />
                      <path d="M12 8.8v3.7" />
                      <path d="M12 15.6h.01" />
                    </template>
                  </svg>
                </span>
                <span class="vulnerabilities-filter-option-label">{{ option.label }}</span>
              </button>
            </template>
          </div>
        </div>

        <div
          v-if="selectedVulnerabilityCount > 0"
          class="vulnerabilities-bulk-action-wrap"
        >
          <button
            class="vulnerabilities-filter-trigger vulnerabilities-bulk-action-trigger"
            :class="{ active: isBulkActionMenuOpen }"
            type="button"
            @click.stop="toggleBulkActionMenu"
          >
            <span>批量操作</span>
            <span class="vulnerabilities-filter-count">{{ selectedVulnerabilityCount }}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path :d="isBulkActionMenuOpen ? 'm7 14 5-5 5 5' : 'm7 10 5 5 5-5'" />
            </svg>
          </button>

          <div
            v-if="isBulkActionMenuOpen"
            class="vulnerabilities-filter-menu vulnerabilities-bulk-action-menu"
          >
            <button
              class="vulnerabilities-bulk-action-option"
              type="button"
              @click.stop="openBatchStatusDialog"
            >
              <span class="vulnerabilities-bulk-action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M12 4.8 18 7v4.8c0 3.8-2.5 6-6 6.8-3.5-.8-6-3-6-6.8V7l6-2.2Z" />
                  <path d="m9.2 12.1 1.8 1.8 3.9-4.1" />
                </svg>
              </span>
              <span>批量修改漏洞状态</span>
            </button>
            <button
              class="vulnerabilities-bulk-action-option"
              type="button"
              disabled
            >
              <span class="vulnerabilities-bulk-action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M4 7h16" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M6 7l1 13h10l1-13" />
                  <path d="M9 7V4.8h6V7" />
                </svg>
              </span>
              <span>批量删除（预留）</span>
            </button>
          </div>
        </div>

        <div v-if="tableRows.length" class="vulnerabilities-selection-tools">
          <button
            class="vulnerabilities-selection-tool"
            type="button"
            :disabled="isLoading || isRefreshing || isCurrentPageFullySelected"
            @click="selectCurrentPageVulnerabilities"
          >
            选中当前页
          </button>
          <button
            class="vulnerabilities-selection-tool"
            type="button"
            :disabled="isLoading || isRefreshing || isSelectingAll || total === selectedVulnerabilityCount"
            :aria-busy="isSelectingAll ? 'true' : 'false'"
            @click="selectAllMatchingVulnerabilities"
          >
            {{ isSelectingAll ? '全选中...' : '全选' }}
          </button>
          <button
            v-if="selectedVulnerabilityCount"
            class="vulnerabilities-clear-button"
            type="button"
            :disabled="batchStatusSubmitting"
            aria-label="清除选择"
            title="清除选择"
            @click="clearVulnerabilitySelection"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path d="M15.8 8.2 8.2 15.8" />
              <path d="M8.2 8.2 15.8 15.8" />
              <path d="M7.5 5.5h6.9a2.6 2.6 0 0 1 1.84.76l2.5 2.5a2.6 2.6 0 0 1 0 3.68l-2.5 2.5a2.6 2.6 0 0 1-1.84.76H7.5a2.5 2.5 0 0 1-2.5-2.5V8a2.5 2.5 0 0 1 2.5-2.5Z" />
            </svg>
          </button>
        </div>

        <button
          v-if="hasFilters"
          class="vulnerabilities-clear-button"
          type="button"
          aria-label="清空筛选"
          @click="clearFilters"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M15.8 8.2 8.2 15.8" />
            <path d="M8.2 8.2 15.8 15.8" />
            <path d="M7.5 5.5h6.9a2.6 2.6 0 0 1 1.84.76l2.5 2.5a2.6 2.6 0 0 1 0 3.68l-2.5 2.5a2.6 2.6 0 0 1-1.84.76H7.5a2.5 2.5 0 0 1-2.5-2.5V8a2.5 2.5 0 0 1 2.5-2.5Z" />
          </svg>
        </button>
      </section>

      <div v-if="showInlineError" class="vulnerabilities-page-notice is-error" aria-live="polite">
        <span>{{ pageError }}</span>
        <button type="button" @click="handleRefresh">重试</button>
      </div>

      <div v-if="selectionError" class="vulnerabilities-page-notice is-error" aria-live="polite">
        <span>{{ selectionError }}</span>
        <button type="button" @click="clearSelectionNotice">关闭</button>
      </div>

      <section class="vulnerabilities-list-card">
        <div v-if="showInitialLoading" class="vulnerabilities-loading-list" aria-hidden="true">
          <div v-for="index in 6" :key="index" class="vulnerabilities-loading-row">
            <span class="vulnerabilities-loading-pill"></span>
            <div class="vulnerabilities-loading-main">
              <span class="vulnerabilities-loading-line is-title"></span>
              <span class="vulnerabilities-loading-line"></span>
            </div>
            <span class="vulnerabilities-loading-chip"></span>
          </div>
        </div>

        <div v-else-if="showBlockingError" class="vulnerabilities-state-panel is-error">
          <h2>漏洞列表加载失败</h2>
          <p>{{ pageError }}</p>
          <button class="vulnerabilities-state-button" type="button" @click="handleRefresh">重新加载</button>
        </div>

        <div v-else-if="showEmptyState" class="vulnerabilities-state-panel">
          <h2>{{ hasFilters ? '没有匹配的漏洞' : '暂未发现漏洞' }}</h2>
          <p>{{ hasFilters ? '可以调整筛选条件后重试。' : '完成扫描后，命中的漏洞会出现在这里。' }}</p>
          <button
            v-if="hasFilters"
            class="vulnerabilities-state-button is-secondary"
            type="button"
            @click="clearFilters"
          >
            清空筛选
          </button>
        </div>

        <div v-else class="vulnerabilities-list">
          <article
            v-for="row in tableRows"
            :key="row.id"
            v-memo="[row.memoKey, isVulnerabilitySelected(row.id)]"
            class="vulnerabilities-row"
            :class="{ selected: isVulnerabilitySelected(row.id) }"
            role="link"
            tabindex="0"
            :aria-label="`查看漏洞详情：${row.name}`"
            @click="openVulnerabilityDetail(row.id)"
            @keydown.enter.prevent="openVulnerabilityDetail(row.id)"
            @keydown.space.prevent="openVulnerabilityDetail(row.id)"
          >
            <div class="vulnerabilities-row-main">
              <button
                class="vulnerabilities-row-select"
                :class="{ selected: isVulnerabilitySelected(row.id) }"
                type="button"
                role="checkbox"
                :aria-checked="isVulnerabilitySelected(row.id)"
                :aria-label="`${isVulnerabilitySelected(row.id) ? '取消选择' : '选择'}漏洞：${row.name}`"
                @click.stop="toggleVulnerabilitySelection(row.id)"
                @keydown.enter.stop
                @keydown.space.stop
              >
                <span aria-hidden="true"></span>
              </button>

              <span
                class="vulnerabilities-severity-pill"
                :class="`is-${row.severityMeta.tone}`"
              >
                {{ row.severityMeta.label }}
              </span>

              <div class="vulnerabilities-title-block">
                <div class="vulnerabilities-title-line">
                  <h3>{{ row.name }}</h3>
                  <span v-if="row.protocol" class="vulnerabilities-protocol-tag">{{ row.protocol }}</span>
                  <span class="vulnerabilities-status-pill" :class="`is-${row.statusMeta.tone}`">
                    {{ row.statusMeta.label }}
                  </span>
                </div>

                <div class="vulnerabilities-asset-line">
                  <span class="vulnerabilities-asset-host">{{ row.assetHost }}</span>
                  <span class="vulnerabilities-muted-text">最近任务 {{ row.latestScanTaskName }}</span>
                  <span class="vulnerabilities-muted-text">最近发现时间 {{ row.lastFoundAtDisplay }}</span>
                </div>

                <div v-if="row.tags.length" class="vulnerabilities-tag-row">
                  <span v-for="tag in row.tags" :key="`${row.id}-${tag}`" class="vulnerabilities-tag">{{ tag }}</span>
                </div>
              </div>
            </div>

            <div class="vulnerabilities-template-id" :title="row.templateId">
              {{ row.templateId }}
            </div>
          </article>
        </div>

        <footer v-if="!showInitialLoading && !showBlockingError" class="vulnerabilities-pagination">
          <div class="vulnerabilities-page-size" @click.stop>
            <span>每页</span>
            <button
              class="vulnerabilities-page-size-trigger"
              :class="{ active: isPageSizeMenuOpen }"
              type="button"
              :disabled="isLoading || isRefreshing"
              aria-label="选择每页数量"
              @click="togglePageSizeMenu"
            >
              <span>{{ pageSize }}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path :d="isPageSizeMenuOpen ? 'm7 14 5-5 5 5' : 'm7 10 5 5 5-5'" />
              </svg>
            </button>

            <div v-if="isPageSizeMenuOpen" class="vulnerabilities-page-size-menu">
              <button
                v-for="item in VULNERABILITY_LIST_PAGE_SIZE_OPTIONS"
                :key="item"
                class="vulnerabilities-page-size-option"
                :class="{ selected: pageSize === item }"
                type="button"
                @click="selectPageSize(item)"
              >
                <span
                  class="vulnerabilities-page-size-check"
                  :class="{ selected: pageSize === item }"
                  aria-hidden="true"
                ></span>
                <span>{{ item }}</span>
              </button>
            </div>
          </div>

          <div class="vulnerabilities-pagination-meta">
            <span>显示 {{ pageStart }} - {{ pageEnd }}，共 {{ formatVulnerabilityCount(total) }} 条</span>
            <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
            <button
              class="vulnerabilities-pagination-arrow"
              type="button"
              :disabled="currentPage <= 1 || isLoading || isRefreshing"
              aria-label="上一页"
              @click="goToPreviousPage"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="m14.5 6.5-5 5 5 5" />
              </svg>
            </button>
            <button
              class="vulnerabilities-pagination-arrow"
              type="button"
              :disabled="currentPage >= totalPages || isLoading || isRefreshing"
              aria-label="下一页"
              @click="goToNextPage"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="m9.5 6.5 5 5-5 5" />
              </svg>
            </button>
          </div>
        </footer>
      </section>
    </section>

    <div
      v-if="isBatchStatusDialogOpen"
      class="vulnerability-status-dialog-overlay"
      role="presentation"
      @click.self="closeBatchStatusDialog"
    >
      <section
        ref="batchStatusDialogRef"
        class="vulnerability-status-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-vulnerability-status-dialog-title"
        tabindex="-1"
        @keydown.esc="closeBatchStatusDialog"
      >
        <header class="vulnerability-status-dialog-header">
          <div>
            <h2 id="batch-vulnerability-status-dialog-title">批量修改漏洞状态</h2>
            <p>已选择 {{ selectedVulnerabilityCount }} 个漏洞</p>
          </div>
          <button
            class="vulnerability-status-dialog-close"
            type="button"
            :disabled="batchStatusSubmitting"
            aria-label="关闭批量状态修改弹窗"
            @click="closeBatchStatusDialog"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
              <path d="M6 6l12 12" />
              <path d="M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div class="vulnerability-status-options" role="radiogroup" aria-label="选择批量漏洞状态">
          <button
            v-for="option in batchStatusOptions"
            :key="option.value"
            class="vulnerability-status-option"
            :class="{ selected: option.selected }"
            type="button"
            role="radio"
            :aria-checked="option.selected"
            :disabled="option.disabled"
            @click="selectBatchStatus(option.value)"
          >
            <span class="vulnerability-status-option-check" aria-hidden="true"></span>
            <span class="vulnerabilities-status-pill" :class="`is-${option.tone}`">
              {{ option.label }}
            </span>
          </button>
        </div>

        <p v-if="batchStatusProgressText" class="vulnerability-status-dialog-progress">
          {{ batchStatusProgressText }}
        </p>

        <p v-if="batchStatusError" class="vulnerability-status-dialog-error">
          {{ batchStatusError }}
        </p>

        <footer class="vulnerability-status-dialog-actions">
          <button
            class="template-detail-secondary-button"
            type="button"
            :disabled="batchStatusSubmitting"
            @click="closeBatchStatusDialog"
          >
            取消
          </button>
          <button
            class="template-detail-primary-button"
            type="button"
            :disabled="!canSubmitBatchStatusUpdate"
            @click="submitBatchStatusUpdate"
          >
            {{ batchStatusSubmitting ? '修改中...' : '确认修改' }}
          </button>
        </footer>
      </section>
    </div>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getScanTaskNameOptions } from '../api/scans'
import { getTemplateProtocols, getTemplateTags } from '../api/templates'
import { getVulnerabilityList, updateVulnerabilityStatuses } from '../api/vulnerabilities'
import {
  VULNERABILITY_LIST_PAGE_SIZE_OPTIONS,
  VULNERABILITY_LIST_SEARCH_DEBOUNCE,
  VULNERABILITY_PROTOCOL_OPTIONS,
  VULNERABILITY_SEVERITY_OPTIONS,
  VULNERABILITY_STATUS_OPTIONS,
  VULNERABILITY_STATUS_UPDATE_OPTIONS,
  VULNERABILITY_TAG_OPTIONS
} from '../constants/vulnerabilities'
import {
  formatVulnerabilityCount,
  normalizeVulnerabilityListResponse
} from '../utils/vulnerability'
import { normalizeScanTaskNameOptionsResponse } from '../utils/scanTask'
import { normalizeProtocolOptions, normalizeTagOptions } from '../utils/template'

const filtersRef = ref(null)
const filterInput = ref(createEmptyFilterInput())
const appliedFilters = ref(createEmptyAppliedFilters())
const activeFilterMenu = ref('')
const tagKeyword = ref('')
const tagOptionDefaultLimit = 12
const tagOptionSearchLimit = 18
const tagOptionBatchSize = 18
const tagOptionVisibleCount = ref(tagOptionDefaultLimit)
const scanTaskOptionPageSize = 20
const scanTaskKeyword = ref('')
const scanTaskOptions = ref([])
const scanTaskOptionPage = ref(1)
const scanTaskOptionTotal = ref(0)
const scanTaskOptionTotalPages = ref(1)
const isScanTaskOptionsLoading = ref(false)
const scanTaskOptionsError = ref('')
const hasLoadedScanTaskOptions = ref(false)
const isPageSizeMenuOpen = ref(false)
const tableRows = ref([])
const total = ref(null)
const currentPage = ref(1)
const pageSize = ref(VULNERABILITY_LIST_PAGE_SIZE_OPTIONS[0])
const totalPages = ref(1)
const pageError = ref('')
const isLoading = ref(true)
const isRefreshing = ref(false)
const protocolOptions = ref(VULNERABILITY_PROTOCOL_OPTIONS)
const tagOptions = ref(VULNERABILITY_TAG_OPTIONS)
const selectedVulnerabilityIds = ref([])
const isSelectingAll = ref(false)
const selectionError = ref('')
const isBulkActionMenuOpen = ref(false)
const isBatchStatusDialogOpen = ref(false)
const batchStatusDialogRef = ref(null)
const selectedBatchStatus = ref('')
const batchStatusSubmitting = ref(false)
const batchStatusError = ref('')
const batchStatusCompleted = ref(0)
const batchStatusTotal = ref(0)

const vulnerabilityBulkStatusBatchSize = 1000
const vulnerabilitySelectAllPageSize = 100

let fetchController = null
let protocolOptionsController = null
let tagOptionsController = null
let scanTaskOptionsController = null
let selectAllController = null
let batchStatusController = null
let currentRequestId = 0
let scanTaskOptionRequestId = 0
let filterTimer = null
let scanTaskKeywordTimer = null
let isSyncingFilters = false

const hasData = computed(() => tableRows.value.length > 0)
const hasFilters = computed(() => {
  const filters = appliedFilters.value

  return Boolean(
    filters.searchQuery ||
      filters.assetHost ||
      filters.statuses.length ||
      filters.tags.length ||
      filters.severities.length ||
      filters.latestScanTaskName ||
      filters.protocols.length
  )
})
const latestScanTaskOptions = computed(() => [
  { value: '', label: '全部任务' },
  ...getScanTaskOptionsWithSelected()
])
const matchedTagOptions = computed(() => {
  const keyword = tagKeyword.value.trim().toLowerCase()
  const selectedSet = new Set(filterInput.value.tags)
  const options = tagOptions.value.filter((item) => item.value)
  const matched = options.filter((item) => {
    if (!keyword) {
      return true
    }

    return item.label.toLowerCase().includes(keyword) || item.value.toLowerCase().includes(keyword)
  })

  matched.sort((left, right) => {
    const leftSelected = selectedSet.has(left.value) ? 1 : 0
    const rightSelected = selectedSet.has(right.value) ? 1 : 0

    if (leftSelected !== rightSelected) {
      return rightSelected - leftSelected
    }

    return left.label.localeCompare(right.label, 'zh-CN')
  })

  return matched
})
const selectedTagOptions = computed(() =>
  filterInput.value.tags.map((tag) => ({
    value: tag,
    label: tagOptions.value.find((item) => item.value === tag)?.label ?? tag
  }))
)
const visibleTagOptions = computed(() =>
  matchedTagOptions.value.slice(0, tagOptionVisibleCount.value)
)
const hasMoreTagOptions = computed(() => visibleTagOptions.value.length < matchedTagOptions.value.length)
const hasMoreScanTaskOptions = computed(() => scanTaskOptionPage.value < scanTaskOptionTotalPages.value)
const filterMenus = computed(() => [
  {
    key: 'severity',
    label: '风险等级',
    icon: 'severity',
    options: VULNERABILITY_SEVERITY_OPTIONS,
    multi: true
  },
  {
    key: 'status',
    label: '状态',
    icon: 'status',
    options: VULNERABILITY_STATUS_OPTIONS,
    multi: true
  },
  {
    key: 'tags',
    label: '标签',
    options: tagOptions.value,
    multi: true
  },
  {
    key: 'protocol',
    label: '协议',
    options: protocolOptions.value,
    multi: true
  },
  {
    key: 'latestScanTaskName',
    label: '扫描任务',
    options: latestScanTaskOptions.value,
    multi: false
  }
])
const showInitialLoading = computed(() => isLoading.value && !hasData.value)
const showBlockingError = computed(() => Boolean(pageError.value) && !hasData.value && !isLoading.value)
const showInlineError = computed(() => Boolean(pageError.value) && hasData.value)
const showEmptyState = computed(() => !showInitialLoading.value && !showBlockingError.value && !hasData.value)
const pageStart = computed(() => {
  if (!total.value || !tableRows.value.length) {
    return 0
  }

  return (currentPage.value - 1) * pageSize.value + 1
})
const pageEnd = computed(() => {
  if (!total.value || !tableRows.value.length) {
    return 0
  }

  return Math.min(total.value, pageStart.value + tableRows.value.length - 1)
})
const selectedVulnerabilityIdSet = computed(() => new Set(selectedVulnerabilityIds.value))
const selectedVulnerabilityCount = computed(() => selectedVulnerabilityIds.value.length)
const currentPageSelectableIds = computed(() => tableRows.value.map((row) => row.id).filter(Boolean))
const isCurrentPageFullySelected = computed(
  () =>
    currentPageSelectableIds.value.length > 0 &&
    currentPageSelectableIds.value.every((id) => selectedVulnerabilityIdSet.value.has(id))
)
const batchStatusOptions = computed(() =>
  VULNERABILITY_STATUS_UPDATE_OPTIONS.map((option) => ({
    ...option,
    selected: selectedBatchStatus.value === option.value,
    disabled: batchStatusSubmitting.value
  }))
)
const canSubmitBatchStatusUpdate = computed(
  () =>
    selectedVulnerabilityCount.value > 0 &&
    Boolean(selectedBatchStatus.value) &&
    !batchStatusSubmitting.value
)
const batchStatusProgressText = computed(() => {
  if (!batchStatusSubmitting.value || !batchStatusTotal.value) {
    return ''
  }

  return `已提交 ${batchStatusCompleted.value} / ${batchStatusTotal.value} 个漏洞`
})

function createEmptyFilterInput() {
  return {
    searchQuery: '',
    assetHost: '',
    statuses: [],
    tags: [],
    severities: [],
    latestScanTaskName: '',
    protocols: []
  }
}

function createEmptyAppliedFilters() {
  return {
    searchQuery: '',
    assetHost: '',
    statuses: [],
    tags: [],
    severities: [],
    latestScanTaskName: '',
    protocols: []
  }
}

function buildAppliedFilters() {
  return {
    searchQuery: filterInput.value.searchQuery.trim(),
    assetHost: filterInput.value.assetHost.trim(),
    statuses: [...filterInput.value.statuses],
    tags: [...filterInput.value.tags],
    severities: [...filterInput.value.severities],
    latestScanTaskName: filterInput.value.latestScanTaskName.trim(),
    protocols: [...filterInput.value.protocols]
  }
}

function buildVulnerabilityListParams(filters, page, nextPageSize) {
  return {
    page,
    page_size: nextPageSize,
    keyword: filters.searchQuery,
    asset_host: filters.assetHost,
    status: filters.statuses,
    tags: filters.tags,
    severity: filters.severities,
    latest_scan_task_name: filters.latestScanTaskName,
    protocol: filters.protocols
  }
}

function scheduleFilterCommit() {
  if (isSyncingFilters) {
    return
  }

  window.clearTimeout(filterTimer)

  filterTimer = window.setTimeout(() => {
    commitFilters()
  }, VULNERABILITY_LIST_SEARCH_DEBOUNCE)
}

function commitFilters() {
  const nextFilters = buildAppliedFilters()
  if (JSON.stringify(nextFilters) === JSON.stringify(appliedFilters.value)) {
    return
  }

  appliedFilters.value = nextFilters
  currentPage.value = 1
  clearVulnerabilitySelection()
  void loadVulnerabilities()
}

function handleSelectFilterChange() {
  window.clearTimeout(filterTimer)
  commitFilters()
}

function isMenuOpen(name) {
  return activeFilterMenu.value === name
}

function toggleFilterMenu(name) {
  isPageSizeMenuOpen.value = false
  closeBatchActionMenu()
  const nextMenu = activeFilterMenu.value === name ? '' : name
  activeFilterMenu.value = nextMenu

  if (nextMenu === 'latestScanTaskName' && !hasLoadedScanTaskOptions.value) {
    void fetchScanTaskOptions()
  }
}

function closeFilterMenus() {
  activeFilterMenu.value = ''
}

function closePageSizeMenu() {
  isPageSizeMenuOpen.value = false
}

function handleDocumentClick(event) {
  if (!filtersRef.value?.contains(event.target)) {
    closeFilterMenus()
    closeBatchActionMenu()
  }

  closePageSizeMenu()
}

function toggleEnumFilter(key, value) {
  if (!value) {
    clearEnumFilter(key)
    return
  }

  if (key === 'latestScanTaskName') {
    filterInput.value.latestScanTaskName = value
    closeFilterMenus()
    handleSelectFilterChange()
    return
  }

  const fieldName = resolveMultiFilterFieldName(key)
  const currentValues = filterInput.value[fieldName]
  const nextValues = currentValues.includes(value)
    ? currentValues.filter((item) => item !== value)
    : [...currentValues, value]

  filterInput.value[fieldName] = nextValues
  handleSelectFilterChange()
}

function clearEnumFilter(key) {
  if (key === 'latestScanTaskName') {
    filterInput.value.latestScanTaskName = ''
  } else {
    filterInput.value[resolveMultiFilterFieldName(key)] = []
  }

  closeFilterMenus()
  handleSelectFilterChange()
}

function removeTagFilter(tag) {
  filterInput.value.tags = filterInput.value.tags.filter((item) => item !== tag)
  handleSelectFilterChange()
}

function getTagOptionInitialLimit() {
  return tagKeyword.value.trim() ? tagOptionSearchLimit : tagOptionDefaultLimit
}

function resetTagOptionVisibleCount() {
  tagOptionVisibleCount.value = getTagOptionInitialLimit()
}

function loadMoreTagOptions() {
  if (!hasMoreTagOptions.value) {
    return
  }

  tagOptionVisibleCount.value = Math.min(
    tagOptionVisibleCount.value + tagOptionBatchSize,
    matchedTagOptions.value.length
  )
}

function handleTagMenuScroll(event) {
  const target = event.currentTarget
  const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight

  if (distanceToBottom <= 24) {
    loadMoreTagOptions()
  }
}

function handleScanTaskMenuScroll(event) {
  const target = event.currentTarget
  const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight

  if (distanceToBottom <= 24) {
    void loadMoreScanTaskOptions()
  }
}

function isOptionSelected(key, value) {
  if (!value) {
    return getSelectedFilterCount(key) === 0
  }

  if (key === 'latestScanTaskName') {
    return filterInput.value.latestScanTaskName === value
  }

  return filterInput.value[resolveMultiFilterFieldName(key)].includes(value)
}

function getSelectedFilterCount(key) {
  if (key === 'latestScanTaskName') {
    return filterInput.value.latestScanTaskName ? 1 : 0
  }

  return filterInput.value[resolveMultiFilterFieldName(key)].length
}

function getFilterButtonLabel(filter) {
  const selectedValues = getSelectedFilterValues(filter.key)

  if (!selectedValues.length) {
    return filter.label
  }

  if (selectedValues.length === 1) {
    const selectedLabel = filter.options.find((item) => item.value === selectedValues[0])?.label ?? selectedValues[0]

    if (filter.key === 'tags') {
      return `${filter.label} · ${selectedLabel}`
    }

    return selectedLabel
  }

  return filter.label
}

function getSelectedFilterValues(key) {
  if (key === 'latestScanTaskName') {
    return filterInput.value.latestScanTaskName ? [filterInput.value.latestScanTaskName] : []
  }

  return filterInput.value[resolveMultiFilterFieldName(key)]
}

function getScanTaskOptionsWithSelected() {
  const selectedName = filterInput.value.latestScanTaskName.trim()
  const options = [...scanTaskOptions.value]

  if (selectedName && !options.some((item) => item.value === selectedName)) {
    options.unshift({
      value: selectedName,
      label: selectedName
    })
  }

  return options
}

function resolveMultiFilterFieldName(key) {
  switch (key) {
    case 'severity':
      return 'severities'
    case 'status':
      return 'statuses'
    case 'protocol':
      return 'protocols'
    default:
      return key
  }
}

async function fetchProtocolOptions() {
  protocolOptionsController?.abort()
  protocolOptionsController = new AbortController()

  try {
    const data = await getTemplateProtocols(protocolOptionsController.signal)
    const normalized = normalizeProtocolOptions(data)

    if (normalized.length) {
      protocolOptions.value = [
        { value: '', label: '全部协议' },
        ...normalized
      ]
    }
  } catch (error) {
    if (error?.name !== 'AbortError') {
      protocolOptions.value = VULNERABILITY_PROTOCOL_OPTIONS
    }
  }
}

async function fetchTagOptions() {
  tagOptionsController?.abort()
  tagOptionsController = new AbortController()

  try {
    const data = await getTemplateTags(tagOptionsController.signal)
    const normalized = normalizeTagOptions(data)

    if (normalized.length) {
      tagOptions.value = [
        { value: '', label: '全部标签' },
        ...normalized
      ]
    }
  } catch (error) {
    if (error?.name !== 'AbortError') {
      tagOptions.value = VULNERABILITY_TAG_OPTIONS
    }
  }
}

function mergeScanTaskOptions(currentOptions, nextOptions) {
  const seen = new Set()

  return [...currentOptions, ...nextOptions].filter((item) => {
    if (!item.value || seen.has(item.value)) {
      return false
    }

    seen.add(item.value)
    return true
  })
}

function scheduleScanTaskOptionsSearch() {
  window.clearTimeout(scanTaskKeywordTimer)
  scanTaskKeywordTimer = window.setTimeout(() => {
    void fetchScanTaskOptions({ page: 1, append: false })
  }, VULNERABILITY_LIST_SEARCH_DEBOUNCE)
}

async function fetchScanTaskOptions(options = {}) {
  const { page = 1, append = false } = options

  if (append && (isScanTaskOptionsLoading.value || !hasMoreScanTaskOptions.value)) {
    return
  }

  scanTaskOptionsController?.abort()
  scanTaskOptionsController = new AbortController()

  const requestId = ++scanTaskOptionRequestId
  isScanTaskOptionsLoading.value = true
  scanTaskOptionsError.value = ''
  if (!append) {
    scanTaskOptions.value = []
    scanTaskOptionPage.value = 1
    scanTaskOptionTotal.value = 0
    scanTaskOptionTotalPages.value = 1
  }

  try {
    const data = await getScanTaskNameOptions(
      {
        page,
        page_size: scanTaskOptionPageSize,
        keyword: scanTaskKeyword.value.trim()
      },
      scanTaskOptionsController.signal
    )

    if (requestId !== scanTaskOptionRequestId) {
      return
    }

    const normalized = normalizeScanTaskNameOptionsResponse(data, page, scanTaskOptionPageSize)
    scanTaskOptions.value = append
      ? mergeScanTaskOptions(scanTaskOptions.value, normalized.items)
      : normalized.items
    scanTaskOptionPage.value = normalized.page
    scanTaskOptionTotal.value = normalized.total
    scanTaskOptionTotalPages.value = normalized.totalPages
    hasLoadedScanTaskOptions.value = true
  } catch (error) {
    if (error?.name === 'AbortError') {
      return
    }

    scanTaskOptionsError.value = error instanceof Error ? error.message : '扫描任务名称加载失败，请稍后重试。'
  } finally {
    if (requestId === scanTaskOptionRequestId) {
      isScanTaskOptionsLoading.value = false
      scanTaskOptionsController = null
    }
  }
}

async function loadMoreScanTaskOptions() {
  await fetchScanTaskOptions({
    page: scanTaskOptionPage.value + 1,
    append: true
  })
}

function retryScanTaskOptions() {
  void fetchScanTaskOptions({
    page: scanTaskOptions.value.length ? scanTaskOptionPage.value + 1 : 1,
    append: scanTaskOptions.value.length > 0
  })
}

function clearFilters() {
  isSyncingFilters = true
  window.clearTimeout(filterTimer)
  filterInput.value = createEmptyFilterInput()
  tagKeyword.value = ''
  scanTaskKeyword.value = ''
  appliedFilters.value = createEmptyAppliedFilters()
  currentPage.value = 1
  clearVulnerabilitySelection()
  void loadVulnerabilities()
  window.setTimeout(() => {
    isSyncingFilters = false
  }, 0)
}

function handleRefresh() {
  void loadVulnerabilities({ forceLoading: !hasData.value })
}

function handlePageSizeChange() {
  currentPage.value = 1
  void loadVulnerabilities()
}

function togglePageSizeMenu() {
  if (isLoading.value || isRefreshing.value) {
    return
  }

  closeFilterMenus()
  closeBatchActionMenu()
  isPageSizeMenuOpen.value = !isPageSizeMenuOpen.value
}

function selectPageSize(nextPageSize) {
  if (pageSize.value === nextPageSize) {
    closePageSizeMenu()
    return
  }

  pageSize.value = nextPageSize
  closePageSizeMenu()
  handlePageSizeChange()
}

function goToPreviousPage() {
  if (currentPage.value <= 1 || isLoading.value || isRefreshing.value) {
    return
  }

  currentPage.value -= 1
  void loadVulnerabilities()
}

function goToNextPage() {
  if (currentPage.value >= totalPages.value || isLoading.value || isRefreshing.value) {
    return
  }

  currentPage.value += 1
  void loadVulnerabilities()
}

function isVulnerabilitySelected(vulnerabilityId) {
  return selectedVulnerabilityIdSet.value.has(vulnerabilityId)
}

function toggleVulnerabilitySelection(vulnerabilityId) {
  if (!vulnerabilityId || batchStatusSubmitting.value) {
    return
  }

  selectionError.value = ''
  const selectedSet = new Set(selectedVulnerabilityIds.value)

  if (selectedSet.has(vulnerabilityId)) {
    selectedSet.delete(vulnerabilityId)
  } else {
    selectedSet.add(vulnerabilityId)
  }

  selectedVulnerabilityIds.value = [...selectedSet]
}

function selectCurrentPageVulnerabilities() {
  if (!currentPageSelectableIds.value.length || batchStatusSubmitting.value) {
    return
  }

  selectionError.value = ''
  selectedVulnerabilityIds.value = mergeUniqueIds(
    selectedVulnerabilityIds.value,
    currentPageSelectableIds.value
  )
}

async function selectAllMatchingVulnerabilities() {
  if (isSelectingAll.value || batchStatusSubmitting.value) {
    return
  }

  selectAllController?.abort()
  selectAllController = new AbortController()
  isSelectingAll.value = true
  selectionError.value = ''

  try {
    const filters = appliedFilters.value
    const allIds = []
    let nextPage = 1
    let nextTotalPages = 1

    do {
      const data = await getVulnerabilityList(
        buildVulnerabilityListParams(filters, nextPage, vulnerabilitySelectAllPageSize),
        selectAllController.signal
      )
      const normalized = normalizeVulnerabilityListResponse(
        data,
        nextPage,
        vulnerabilitySelectAllPageSize
      )
      allIds.push(...normalized.items.map((item) => item.id).filter(Boolean))
      nextTotalPages = normalized.totalPages
      nextPage += 1
    } while (nextPage <= nextTotalPages)

    selectedVulnerabilityIds.value = mergeUniqueIds(selectedVulnerabilityIds.value, allIds)
  } catch (error) {
    if (error?.name !== 'AbortError') {
      selectionError.value = error instanceof Error ? error.message : '全选漏洞失败，请稍后重试。'
    }
  } finally {
    isSelectingAll.value = false
    selectAllController = null
  }
}

function clearVulnerabilitySelection() {
  selectAllController?.abort()
  selectedVulnerabilityIds.value = []
  selectionError.value = ''
  closeBatchActionMenu()
  closeBatchStatusDialog()
}

function clearSelectionNotice() {
  selectionError.value = ''
}

function mergeUniqueIds(currentIds, nextIds) {
  return [...new Set([...currentIds, ...nextIds].map((id) => String(id ?? '').trim()).filter(Boolean))]
}

function toggleBulkActionMenu() {
  closeFilterMenus()
  closePageSizeMenu()
  isBulkActionMenuOpen.value = !isBulkActionMenuOpen.value
}

function closeBatchActionMenu() {
  isBulkActionMenuOpen.value = false
}

function openBatchStatusDialog() {
  if (!selectedVulnerabilityCount.value || batchStatusSubmitting.value) {
    return
  }

  closeBatchActionMenu()
  selectedBatchStatus.value = ''
  batchStatusError.value = ''
  batchStatusCompleted.value = 0
  batchStatusTotal.value = selectedVulnerabilityCount.value
  isBatchStatusDialogOpen.value = true
  void nextTick(() => {
    batchStatusDialogRef.value?.focus()
  })
}

function closeBatchStatusDialog() {
  if (batchStatusSubmitting.value) {
    return
  }

  isBatchStatusDialogOpen.value = false
  batchStatusError.value = ''
  batchStatusCompleted.value = 0
  batchStatusTotal.value = 0
}

function selectBatchStatus(status) {
  if (batchStatusSubmitting.value) {
    return
  }

  selectedBatchStatus.value = status
  batchStatusError.value = ''
}

async function submitBatchStatusUpdate() {
  if (!canSubmitBatchStatusUpdate.value) {
    return
  }

  const vulnerabilityIds = normalizeSelectedVulnerabilityIds(selectedVulnerabilityIds.value)
  if (!vulnerabilityIds.length) {
    batchStatusError.value = '选中的漏洞 ID 无效，请刷新列表后重试。'
    return
  }

  if (vulnerabilityIds.length !== selectedVulnerabilityIds.value.length) {
    batchStatusError.value = '选中的漏洞包含无效 ID，请刷新列表后重新选择。'
    return
  }

  const batches = chunkArray(vulnerabilityIds, vulnerabilityBulkStatusBatchSize)
  batchStatusController?.abort()
  batchStatusController = new AbortController()
  batchStatusSubmitting.value = true
  batchStatusError.value = ''
  batchStatusCompleted.value = 0
  batchStatusTotal.value = vulnerabilityIds.length

  try {
    for (const batch of batches) {
      await updateVulnerabilityStatuses(
        batch,
        selectedBatchStatus.value,
        batchStatusController.signal
      )
      batchStatusCompleted.value += batch.length
    }

    isBatchStatusDialogOpen.value = false
    clearVulnerabilitySelection()
    await loadVulnerabilities()
  } catch (error) {
    if (error?.name !== 'AbortError') {
      batchStatusError.value = error instanceof Error ? error.message : '批量修改漏洞状态失败，请稍后重试。'
    }
  } finally {
    batchStatusSubmitting.value = false
    batchStatusController = null
  }
}

function normalizeSelectedVulnerabilityIds(vulnerabilityIds) {
  return [
    ...new Set(
      vulnerabilityIds
        .map((id) => Number.parseInt(id, 10))
        .filter((id) => Number.isSafeInteger(id) && id > 0)
    )
  ]
}

function chunkArray(items, size) {
  const chunks = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function openVulnerabilityDetail(vulnerabilityId) {
  if (!vulnerabilityId) {
    return
  }

  window.open(`/vulnerabilities/${encodeURIComponent(vulnerabilityId)}`, '_blank', 'noopener,noreferrer')
}

function stopRequest() {
  if (fetchController) {
    fetchController.abort()
    fetchController = null
  }
}

async function loadVulnerabilities(options = {}) {
  const { forceLoading = false } = options

  stopRequest()

  const requestId = ++currentRequestId
  const controller = new AbortController()
  fetchController = controller

  if (forceLoading || !tableRows.value.length) {
    isLoading.value = true
  } else {
    isRefreshing.value = true
  }

  pageError.value = ''

  try {
    const filters = appliedFilters.value
    const data = await getVulnerabilityList(
      buildVulnerabilityListParams(filters, currentPage.value, pageSize.value),
      controller.signal
    )

    if (requestId !== currentRequestId) {
      return
    }

    const normalized = normalizeVulnerabilityListResponse(data, currentPage.value, pageSize.value)
    tableRows.value = normalized.items
    total.value = normalized.total
    currentPage.value = normalized.page
    pageSize.value = normalized.pageSize
    totalPages.value = normalized.totalPages
  } catch (error) {
    if (error?.name === 'AbortError') {
      return
    }

    pageError.value = error instanceof Error ? error.message : '漏洞列表加载失败，请稍后重试。'
  } finally {
    if (requestId === currentRequestId) {
      isLoading.value = false
      isRefreshing.value = false
      fetchController = null
    }
  }
}

watch(filterInput, scheduleFilterCommit, { deep: true })

watch([tagKeyword, tagOptions], () => {
  resetTagOptionVisibleCount()
})

watch(scanTaskKeyword, () => {
  scheduleScanTaskOptionsSearch()
})

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  void fetchScanTaskOptions()
  void fetchTagOptions()
  void fetchProtocolOptions()
  void loadVulnerabilities({ forceLoading: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  protocolOptionsController?.abort()
  tagOptionsController?.abort()
  scanTaskOptionsController?.abort()
  selectAllController?.abort()
  batchStatusController?.abort()
  stopRequest()
  window.clearTimeout(filterTimer)
  window.clearTimeout(scanTaskKeywordTimer)
})
</script>
