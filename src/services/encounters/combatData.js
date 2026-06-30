import { getCombatContext } from '../rules/combat/damageUtils.js'

// In-memory store for combat data (synced via SSE events)
let cachedCombatSummary = null

/**
 * Call this when combat summary is updated on the server.
 * Used by initiative.jsx to seed the cache from its SSE handler.
 */
export function setCombatSummaryCache(summary, _campaignName) {
  cachedCombatSummary = summary
}

export async function loadCombatSummary(campaignName) {
  if (campaignName) {
    try {
      const fromApi = await getCombatContext(campaignName)
      if (fromApi) {
        setCombatSummaryCache(fromApi, campaignName)
        return fromApi
      }
    } catch { /* fall through */ }
    return null
  }
  return null
}

export function getCombatSummary(_campaignName) {
  return cachedCombatSummary
}

export async function loadActiveCreatureName(campaignName) {
  if (campaignName) {
    try {
      const fromApi = await getCombatContext(campaignName)
      if (fromApi?.activeCreatureName) {
        return fromApi.activeCreatureName
      }
    } catch { /* fall through */ }
  }
  return null
}

export function getActiveCreatureName(campaignName) {
  const cs = getCombatSummary(campaignName)
  if (cs?.activeCreatureName) return cs.activeCreatureName
  return null
}

export async function loadCurrentCombatRound(campaignName) {
  const cs = await loadCombatSummary(campaignName)
  return cs?.round ?? 1
}

export function getCurrentCombatRound(campaignName) {
  const cs = getCombatSummary(campaignName)
  return cs?.round ?? 1
}
