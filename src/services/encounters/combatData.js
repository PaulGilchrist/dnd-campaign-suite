import { getCombatContext } from '../rules/combat/damageUtils.js'

// Global in-memory store for combat data (synced via SSE events)
let cachedCombatSummary = null

/**
 * Call this when combat summary is updated on the server.
 * Used by initiative.jsx to seed the cache from its SSE handler.
 */
export function setCombatSummaryCache(summary) {
  cachedCombatSummary = summary
}

export async function loadCombatSummary(campaignName) {
  if (campaignName) {
    try {
      const fromApi = await getCombatContext(campaignName)
      if (fromApi) {
        setCombatSummaryCache(fromApi)
        return fromApi
      }
    } catch { /* fall through */ }
    return null
  }
  return null
}

export function getCombatSummary() {
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

export function getActiveCreatureName() {
  return cachedCombatSummary?.activeCreatureName ?? null
}

export async function loadCurrentCombatRound(campaignName) {
  const cs = await loadCombatSummary(campaignName)
  return cs?.round ?? 1
}

export function getCurrentCombatRound() {
  return cachedCombatSummary?.round ?? 1
}
