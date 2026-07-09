import { getCombatContext } from '../rules/combat/damageUtils.js'

// In-memory store for combat data (synced via SSE events), keyed by campaign name
const cachedCombatSummaries = new Map()

/**
 * Call this when combat summary is updated on the server.
 * Used by initiative.jsx to seed the cache from its SSE handler.
 */
export function setCombatSummaryCache(summary, campaignName) {
  if (campaignName) {
    if (summary === null) {
      cachedCombatSummaries.delete(campaignName)
    } else {
      cachedCombatSummaries.set(campaignName, summary)
    }
  }
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

export function getCombatSummary(campaignName) {
  if (!campaignName) return null
  return cachedCombatSummaries.get(campaignName) ?? null
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
  if (!cs) return null
  return cs.activeCreatureName || null
}

export async function loadCurrentCombatRound(campaignName) {
  const cs = await loadCombatSummary(campaignName)
  return cs?.round ?? 1
}

export function getCurrentCombatRound(campaignName) {
  const cs = getCombatSummary(campaignName)
  if (!cs) return 1
  return cs.round ?? 1
}
