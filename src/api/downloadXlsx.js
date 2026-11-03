import { notifyAuthSessionExpired } from '../utils/authSession'
import { HttpRequestError, createAuthorizedRequestOptions } from '../utils/http'

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export async function downloadXlsx(requestUrl, filenamePrefix, signal) {
  const response = await fetch(requestUrl, createAuthorizedRequestOptions({ method: 'GET', signal }))
  const contentType = response.headers.get('content-type') || ''

  if (!response.ok || !contentType.includes(XLSX_CONTENT_TYPE)) {
    const payload = contentType.includes('json') ? await response.json().catch(() => null) : null
    if (response.status === 401 || Number(payload?.code) === 40101) {
      notifyAuthSessionExpired()
    }

    throw new HttpRequestError(
      payload?.message || (response.ok ? '导出响应格式异常，请稍后重试。' : `导出失败：${response.status}`),
      { status: response.status, code: payload?.code, payload }
    )
  }

  const blob = await response.blob()
  const filename = response.headers.get('content-disposition')?.match(/[a-z-]+-\d{8}-\d{6}\.xlsx/)?.[0]
  const safeFilename = filename?.startsWith(`${filenamePrefix}-`) ? filename : `${filenamePrefix}.xlsx`
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = safeFilename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}
