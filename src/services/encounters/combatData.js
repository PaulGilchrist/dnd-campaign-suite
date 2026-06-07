import { getCombatContext } from '../rules/damageUtils.js'

const CS_KEY = 'combatSummary'
const ACTIVE_KEY = 'activeCreatureName'

function readLocal(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* ignore */ }
}

export async function loadCombatSummary(campaignName) {
  if (campaignName) {
    try {
      const fromApi = await getCombatContext(campaignName)
      if (fromApi) {
        writeLocal(CS_KEY, fromApi)
        return fromApi
      }
    } catch { /* fall through */ }
    return null
  }
  return readLocal(CS_KEY)
}

export function getCombatSummary() {
  return readLocal(CS_KEY)
}

export async function loadActiveCreatureName(campaignName) {
  if (campaignName) {
    try {
      const fromApi = await getCombatContext(campaignName)
      if (fromApi?.activeCreatureName) {
        writeLocal(ACTIVE_KEY, fromApi.activeCreatureName)
        return fromApi.activeCreatureName
      }
    } catch { /* fall through */ }
  }
  return readLocal(ACTIVE_KEY)
}

export function getActiveCreatureName() {
  return readLocal(ACTIVE_KEY)
}

export async function loadCurrentCombatRound(campaignName) {
  const cs = await loadCombatSummary(campaignName)
  return cs?.round ?? 1
}

export function getCurrentCombatRound() {
  const cs = getCombatSummary()
  return cs?.round ?? 1
}
