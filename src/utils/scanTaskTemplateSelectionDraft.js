const TEMPLATE_SELECTION_DRAFT_TTL_MS = 30 * 60 * 1000

let pendingTemplateSelectionDraft = null

export function saveScanTaskTemplateSelectionDraft(templateRecord = {}) {
  const templateId = String(templateRecord?.id ?? '').trim()

  if (!templateId) {
    throw new Error('模板 ID 为空，无法带入创建扫描任务页面。')
  }

  const draft = {
    created_at: Date.now(),
    template_id: templateId,
    template_name: String(templateRecord?.name ?? '').trim()
  }

  pendingTemplateSelectionDraft = draft
  return draft
}

export function consumeScanTaskTemplateSelectionDraft() {
  const draft = pendingTemplateSelectionDraft
  pendingTemplateSelectionDraft = null

  if (!draft) {
    return null
  }

  const createdAt = Number(draft.created_at)

  if (!Number.isFinite(createdAt) || Date.now() - createdAt > TEMPLATE_SELECTION_DRAFT_TTL_MS) {
    return null
  }

  const templateId = String(draft.template_id ?? '').trim()

  if (!templateId) {
    return null
  }

  return {
    template_id: templateId,
    template_name: String(draft.template_name ?? '').trim()
  }
}
