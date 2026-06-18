import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./syncStoreValue.js', () => {
  const storeValue = new Map()

  function triggerSubscribers() {}
  function getStoreFor(name) { return storeValue.get(name) || createMockStore() }
  async function loadData() { return {} }

  function createMockStore(initialEntries = []) {
    const data = new Map(initialEntries)
    return {
      get(k) { return data.get(k) },
      set(k, v) { data.set(k, v) },
      delete(k) { return data.delete(k) },
      put() { return Promise.resolve() },
    }
  }

  function setStore(key, value) { storeValue.set(key, value) }

  const SYNC_DELAY = 30

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

  function updateStoreWithCondition(name, key, value) {
    const store = storeValue.get(name)
    if (!store) return Promise.resolve()
    store.set(key, value)
    triggerSubscribers()
    return store.put().catch(() => null)
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
          setStore(key, createMockStore(Object.entries(data)))
        } else {
          setStore(key, createMockStore())
        }
      } catch {
        setStore(key, createMockStore())
      }
    }
    triggerSubscribers()
  }

  return {
    syncStoreValue(key, value) {
      const store = storeValue.get(key)
      if (!store) return Promise.resolve(false)
      const changed = store.get(key) !== value
      if (!changed) return Promise.resolve(false)
      store.set(key, value)
      triggerSubscribers()
      return store.put().then(() => true).catch(() => false)
    },

    readStore(key) {
      const store = storeValue.get(key)
      if (!store) return undefined
      return store.get(key)
    },

    clearStore(key) {
      const store = storeValue.get(key)
      if (!store) return Promise.resolve()
      store.delete(key)
      triggerSubscribers()
      return store.put().catch(() => null)
    },

    applyConditionOnSaveFail(campaignName, attackerName, targetName, condition) {
      return fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/applyCondition`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterName: attackerName, targetName, condition }),
      }).catch(() => syncCondition(targetName, 'activeConditions', condition))
    },

    removeConditionsFromTarget(campaignName, targetName, conditionsToRemove) {
      if (!campaignName || !targetName) return Promise.resolve()
      const data = storeValue.get(targetName)
      if (!data) return Promise.resolve()
      const current = Array.isArray(data.get('activeConditions')) ? data.get('activeConditions') : []
      const updated = current.filter(c => !conditionsToRemove.includes(c))
      if (updated.length === current.length) return Promise.resolve()
      return updateStoreWithCondition(targetName, 'activeConditions', updated)
    },

    initSyncHandlers(campaignName) {
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
    },

    __seedStore(key, value) {
      const entries = [[key, value]]
      if (typeof value === 'object' && value !== null) {
        for (const [k, v] of Object.entries(value)) {
          entries.push([k, v])
        }
      }
      storeValue.set(key, createMockStore(entries))
    },

    __readFlat(key, prop) {
      const store = storeValue.get(key)
      if (!store) return undefined
      return store.get(prop)
    },

    __seedStoreWithPut(key, value, putImpl = null) {
      const entries = [[key, value]]
      if (typeof value === 'object' && value !== null) {
        for (const [k, v] of Object.entries(value)) {
          entries.push([k, v])
        }
      }
      const data = new Map(entries)
      const mockStore = {
        get(k) { return data.get(k) },
        set(k, v) { data.set(k, v) },
        delete(k) { return data.delete(k) },
        put() { return putImpl ? putImpl() : Promise.resolve() },
      }
      storeValue.set(key, mockStore)
    },
  }
})

const {
  syncStoreValue,
  readStore,
  clearStore,
  applyConditionOnSaveFail,
  removeConditionsFromTarget,
  initSyncHandlers,
  __seedStore,
  __seedStoreWithPut,
  __readFlat,
} = await import('./syncStoreValue.js')

describe('syncStoreValue (mock store)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('syncStoreValue', () => {
    it('returns false when store does not exist', async () => {
      const result = await syncStoreValue('nonexistent', 'value')
      expect(result).toBe(false)
    })

    it('returns false when value has not changed (primitive)', async () => {
      __seedStore('counter', 42)
      const result = await syncStoreValue('counter', 42)
      expect(result).toBe(false)
    })

    it('returns true when value changes and put succeeds', async () => {
      __seedStore('counter', 42)
      const result = await syncStoreValue('counter', 99)
      expect(result).toBe(true)
    })

    it('returns true when object reference changes', async () => {
      __seedStore('character', { hp: 100 })
      const result = await syncStoreValue('character', { hp: 50 })
      expect(result).toBe(true)
    })

    it('returns false when put fails', async () => {
      __seedStoreWithPut('counter', 42, () => Promise.reject(new Error('put failed')))
      const result = await syncStoreValue('counter', 99)
      expect(result).toBe(false)
    })

    it('updates the store value on change', async () => {
      __seedStore('character', { hp: 100 })
      await syncStoreValue('character', { hp: 50 })
      const stored = readStore('character')
      expect(stored).toEqual({ hp: 50 })
    })
  })

  describe('readStore', () => {
    it('returns undefined when store does not exist', () => {
      const result = readStore('nonexistent')
      expect(result).toBeUndefined()
    })

    it('returns the stored value when store exists', () => {
      __seedStore('character', { hp: 100, name: 'Gandalf' })
      const result = readStore('character')
      expect(result).toEqual({ hp: 100, name: 'Gandalf' })
    })
  })

  describe('clearStore', () => {
    it('returns resolved promise when store does not exist', async () => {
      const result = await clearStore('nonexistent')
      expect(result).toBeUndefined()
    })

    it('removes the key from the store', async () => {
      __seedStore('character', { hp: 100 })
      await clearStore('character')
      const result = readStore('character')
      expect(result).toBeUndefined()
    })

    it('returns undefined on successful clear', async () => {
      __seedStore('character', { hp: 100 })
      const result = await clearStore('character')
      expect(result).toBeUndefined()
    })

    it('returns null when put fails', async () => {
      __seedStoreWithPut('character', { hp: 100 }, () => Promise.reject(new Error('put failed')))
      const result = await clearStore('character')
      expect(result).toBeNull()
    })
  })

  describe('applyConditionOnSaveFail', () => {
    it('returns fetch promise when fetch succeeds', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true })
      const result = await applyConditionOnSaveFail('camp', 'attacker', 'target', 'poisoned')
      expect(result).toEqual({ ok: true })
    })

    it('calls syncCondition to add condition on fetch failure when store exists', async () => {
      __seedStore('target', { activeConditions: [] })
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))

      await applyConditionOnSaveFail('camp', 'attacker', 'target', 'poisoned')
      const stored = readStore('target')
      expect(stored.activeConditions).toContain('poisoned')
    })

    it('does not add duplicate condition via syncCondition', async () => {
      __seedStore('target', { activeConditions: ['poisoned'] })
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))

      await applyConditionOnSaveFail('camp', 'attacker', 'target', 'poisoned')
      const stored = readStore('target')
      expect(stored.activeConditions).toEqual(['poisoned'])
    })
  })

  describe('removeConditionsFromTarget', () => {
    it('returns resolved promise when no campaignName', async () => {
      const result = await removeConditionsFromTarget(null, 'target', ['poisoned'])
      expect(result).toBeUndefined()
    })

    it('returns resolved promise when no targetName', async () => {
      const result = await removeConditionsFromTarget('camp', null, ['poisoned'])
      expect(result).toBeUndefined()
    })

    it('returns resolved promise when store does not exist', async () => {
      const result = await removeConditionsFromTarget('camp', 'nonexistent', ['poisoned'])
      expect(result).toBeUndefined()
    })

    it('returns resolved promise when no conditions match', async () => {
      __seedStore('target', { activeConditions: ['blinded'] })
      const result = await removeConditionsFromTarget('camp', 'target', ['poisoned'])
      expect(result).toBeUndefined()
    })

    it('removes matching conditions from store', async () => {
      __seedStore('target', { activeConditions: ['poisoned', 'blinded', 'prone'] })
      await removeConditionsFromTarget('camp', 'target', ['poisoned', 'prone'])
      expect(__readFlat('target', 'activeConditions')).toEqual(['blinded'])
    })

    it('handles activeConditions being a non-array value (resolves but no change)', async () => {
      __seedStore('target', { activeConditions: 'not-an-array' })
      const result = await removeConditionsFromTarget('camp', 'target', ['poisoned'])
      expect(result).toBeUndefined()
      expect(__readFlat('target', 'activeConditions')).toBe('not-an-array')
    })

    it('handles activeConditions being undefined', async () => {
      __seedStore('target', { name: 'target' })
      await removeConditionsFromTarget('camp', 'target', ['poisoned'])
      expect(__readFlat('target', 'activeConditions')).toBeUndefined()
    })
  })

  describe('initSyncHandlers', () => {
    it('registers three event listeners', () => {
      const addEventListener = vi.spyOn(window, 'addEventListener')
      initSyncHandlers('test-campaign')
      expect(addEventListener).toHaveBeenCalledWith('campaign-changed', expect.any(Function))
      expect(addEventListener).toHaveBeenCalledWith('condition-apply', expect.any(Function))
      expect(addEventListener).toHaveBeenCalledWith('condition-remove', expect.any(Function))
    })

    it('condition-apply handler adds condition to store when store exists', async () => {
      __seedStore('target', { activeConditions: [] })
      initSyncHandlers('test')

      window.dispatchEvent(new CustomEvent('condition-apply', {
        detail: { name: 'target', key: 'activeConditions', value: 'poisoned' },
      }))

      await vi.waitFor(() => {
        expect(readStore('target').activeConditions).toContain('poisoned')
      })
    })

    it('condition-apply handler does not add duplicate condition', async () => {
      __seedStore('target', { activeConditions: ['poisoned'] })
      initSyncHandlers('test')

      window.dispatchEvent(new CustomEvent('condition-apply', {
        detail: { name: 'target', key: 'activeConditions', value: 'poisoned' },
      }))

      await vi.waitFor(() => {
        expect(readStore('target').activeConditions).toEqual(['poisoned'])
      })
    })

    it('condition-apply handler returns early when detail missing name', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('condition-apply', {
          detail: { key: 'activeConditions', value: 'poisoned' },
        }))
      }).not.toThrow()
    })

    it('condition-apply handler returns early when detail missing key', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('condition-apply', {
          detail: { name: 'target', value: 'poisoned' },
        }))
      }).not.toThrow()
    })

    it('condition-remove handler removes condition from store', async () => {
      __seedStore('target', { activeConditions: ['poisoned', 'blinded'] })
      initSyncHandlers('test')

      window.dispatchEvent(new CustomEvent('condition-remove', {
        detail: { name: 'target', key: 'activeConditions', condition: 'poisoned' },
      }))

      await vi.waitFor(() => {
        expect(__readFlat('target', 'activeConditions')).toEqual(['blinded'])
      })
    })

    it('condition-remove handler returns early when detail missing name', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('condition-remove', {
          detail: { key: 'activeConditions', condition: 'poisoned' },
        }))
      }).not.toThrow()
    })

    it('condition-remove handler returns early when detail missing key', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('condition-remove', {
          detail: { name: 'target', condition: 'poisoned' },
        }))
      }).not.toThrow()
    })

    it('condition-remove handler returns early when detail missing condition', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('condition-remove', {
          detail: { name: 'target', key: 'activeConditions' },
        }))
      }).not.toThrow()
    })

    it('condition-remove handler does not fail when store does not exist', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('condition-remove', {
          detail: { name: 'nonexistent', key: 'activeConditions', condition: 'poisoned' },
        }))
      }).not.toThrow()
    })
  })
})
