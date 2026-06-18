import { getTemplateProtocols, getTemplateTags } from './templates'

export async function getTemplateFilterOptions({ tagsSignal, protocolsSignal } = {}) {
  const [tagsResult, protocolsResult] = await Promise.allSettled([
    getTemplateTags(tagsSignal),
    getTemplateProtocols(protocolsSignal)
  ])

  return {
    tags: tagsResult.status === 'fulfilled' ? tagsResult.value : [],
    protocols: protocolsResult.status === 'fulfilled' ? protocolsResult.value : []
  }
}
