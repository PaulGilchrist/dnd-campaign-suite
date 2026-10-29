import { getCombatContext } from '../rules/combat/damageUtils.js'
// #1074 fix: retired fallback was getRuntimeValue('campaign','activeCreatureName',campaignName) — arity-2 read (useRuntimeState.js:63), campaignName ignored, cross-context bleed.

export { getCombatContext }

// In-memory store for combat data (synced via SSE events), keyed by campaign name
const cachedCombatSummaries = new Map()

/**
 * Call this when combat summary is updated on the server.
 * Used by Initiative.jsx to seed the cache from its SSE handler.
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

function resolveActiveCreatureName(fromApi, campaignName) {
  if (fromApi.activeCreatureName) return
  if (fromApi.creatures?.length > 0) {
    fromApi.activeCreatureName = fromApi.creatures[0].name
  }
  if (fromApi.activeCreatureName) return
  const cached = getActiveCreatureName(campaignName) // #1074-fix: campaign-keyed cache, was current-context runtime read
  if (cached) {
    fromApi.activeCreatureName = cached
  }
}

export async function loadCombatSummary(campaignName, { strict = false } = {}) {
  if (!campaignName) return null
  try {
    const fromApi = await getCombatContext(campaignName, { strict })
    if (!fromApi) return null
    resolveActiveCreatureName(fromApi, campaignName)
    setCombatSummaryCache(fromApi, campaignName)
    return fromApi
  } catch (error) {
    // strict (EB Join lane): a transport failure must reach the caller —
    // returning null here would normalize a possibly-live board away.
    // Lenient loads keep the null-as-"no combat" degradation (default).
    if (strict) throw error
    console.warn('[combatData] Combat context unavailable from API:', error)
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
      const cached = getActiveCreatureName(campaignName) // #1074-fix: campaign-keyed cache, was current-context runtime read
      if (cached) {
        return cached
      }
    } catch (error) { console.warn('[combatData] Active creature name unavailable from API:', error) }
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
