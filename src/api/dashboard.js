import {
  DASHBOARD_OVERVIEW_API,
  DASHBOARD_ASSET_RISKS_API,
  DASHBOARD_HOST_RANKINGS_API,
  DASHBOARD_SERVICE_FINGERPRINTS_API
} from '../constants/api'
import { requestJson } from '../utils/http'
import {
  normalizeDashboardOverview,
  normalizeDashboardAssetRisks,
  normalizeDashboardHostRankings,
  normalizeDashboardServiceFingerprints
} from '../utils/dashboard'

export async function getDashboardOverview(signal) {
  return normalizeDashboardOverview(await requestJson(DASHBOARD_OVERVIEW_API, { method: 'GET', signal }))
}

export async function getDashboardAssetRisks(signal) {
  return normalizeDashboardAssetRisks(await requestJson(DASHBOARD_ASSET_RISKS_API, { method: 'GET', signal }))
}

export async function getDashboardHostRankings(signal) {
  return normalizeDashboardHostRankings(await requestJson(DASHBOARD_HOST_RANKINGS_API, { method: 'GET', signal }))
}

export async function getDashboardServiceFingerprints(signal) {
  return normalizeDashboardServiceFingerprints(await requestJson(DASHBOARD_SERVICE_FINGERPRINTS_API, { method: 'GET', signal }))
}
