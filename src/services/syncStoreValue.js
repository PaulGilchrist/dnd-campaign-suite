const storeValue = new Map()

function triggerSubscribers() {}
function setStore(key, value) { storeValue.set(key, value) }
function getStoreFor(name) { return storeValue.get(name) || new Map() }
async function loadData() { return {} }

const SYNC_DELAY = 30

export function syncStoreValue(key, value) {
  const store = storeValue.get(key)
  if (!store) return Promise.resolve(false)
  const changed = store.get(key) !== value
  if (!changed) return Promise.resolve(false)
  store.set(key, value)
  triggerSubscribers()
  return store.put().then(() => true).catch(() => false)
}

export function readStore(key) {
  const store = storeValue.get(key)
  if (!store) return undefined
  return store.get(key)
}

export function clearStore(key) {
  const store = storeValue.get(key)
  if (!store) return Promise.resolve()
  store.delete(key)
  triggerSubscribers()
  return store.put().catch(() => null)
}

function syncCondition(name, key, condition) {
  const current = readStore(name) || {}
  const conditions = Array.isArray(current[key]) ? current[key] : []
  if (conditions.includes(condition)) {
    return Promise.resolve()
  }
  const updated = [...conditions, condition]
  current[key] = updated
  return syncStoreValue(name, current)
}

export function applyConditionOnSaveFail(campaignName, attackerName, targetName, condition) {
  return fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/applyCondition`, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterName: attackerName, targetName, condition }),
  }).catch(() => syncCondition(targetName, 'activeConditions', condition))
}

function updateStoreWithCondition(name, key, value) {
  const store = storeValue.get(name)
  if (!store) return Promise.resolve()
  store.set(key, value)
  triggerSubscribers()
  return store.put().catch(() => null)
}

export function removeConditionsFromTarget(campaignName, targetName, conditionsToRemove) {
  if (!campaignName || !targetName) return Promise.resolve()
  const data = storeValue.get(targetName)
  if (!data) return Promise.resolve()
  const current = Array.isArray(data.get('activeConditions')) ? data.get('activeConditions') : []
  const updated = current.filter(c => !conditionsToRemove.includes(c))
  if (updated.length === current.length) return Promise.resolve()
  return updateStoreWithCondition(targetName, 'activeConditions', updated)
}

async function fetchAndSeedStores(campaignName) {
  for (const key of storeValue.keys()) {
    try {
      let data = null
      if (campaignName) {
        const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent(key)}`)
        if (response.ok) {
          const json = await response.json()
          if (json.value) data = json.value
        }
      }
      if (!data) {
        const stored = localStorage.getItem(key)
        if (stored) data = JSON.parse(stored)
      }
      if (data) {
        setStore(key, new Map(Object.entries(data)))
      } else {
        setStore(key, new Map())
      }
    } catch {
      setStore(key, new Map())
    }
  }
  triggerSubscribers()
}

export function initSyncHandlers(campaignName) {
  window.addEventListener('campaign-changed', async () => {
    await loadData()
    await fetchAndSeedStores(campaignName)
  })

  window.addEventListener('condition-apply', (e) => {
    const { name, key, value } = e.detail || {}
    if (!name || !key) return
    syncCondition(name, key, value)
  })

  window.addEventListener('condition-remove', (e) => {
    const { name, key, condition } = e.detail || {}
    if (!name || !key || !condition) return
    const store = getStoreFor(name)
    const current = Array.isArray(store.get(key)) ? store.get(key) : []
    const updated = current.filter(c => c !== condition)
    store.set(key, updated)
    triggerSubscribers()
    store.put().catch(() => null)
  })

  setTimeout(async () => {
    await fetchAndSeedStores(campaignName)
  }, SYNC_DELAY)
}
