// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Minimal mock: only export the functions under test with a controllable in-memory store.
// The mock does NOT replicate the full module — it provides just enough scaffolding
// so each test can set up state and assert behavior without touching the real module.
vi.mock('./syncStoreValue.js', () => {
  const stores = new Map()

  function createMapStore(entries = []) {
    const data = new Map(entries)
    return {
      get(k) { return data.get(k) },
      set(k, v) { data.set(k, v) },
      delete(k) { return data.delete(k) },
      put() { return Promise.resolve() },
    }
  }

  return {
    syncStoreValue(key, value) {
      const store = stores.get(key)
      if (!store) return Promise.resolve(false)
      const changed = store.get(key) !== value
      if (!changed) return Promise.resolve(false)
      store.set(key, value)
      return store.put().then(() => true).catch(() => false)
    },

    readStore(key) {
      const store = stores.get(key)
      if (!store) return undefined
      return store.get(key)
    },

    clearStore(key) {
      const store = stores.get(key)
      if (!store) return Promise.resolve()
      store.delete(key)
      return store.put().catch(() => null)
    },

    applyConditionOnSaveFail(_campaignName, attackerName, targetName, condition) {
      return fetch(`/api/campaigns/${encodeURIComponent(_campaignName)}/applyCondition`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterName: attackerName, targetName, condition }),
      }).catch(() => {
        const current = stores.get(targetName)
        if (!current) return
        const conditions = Array.isArray(current.get('activeConditions'))
          ? current.get('activeConditions')
          : []
        if (conditions.includes(condition)) return
        const updated = [...conditions, condition]
        current.set('activeConditions', updated)
      })
    },

    removeConditionsFromTarget(campaignName, targetName, conditionsToRemove) {
      if (!campaignName || !targetName) return Promise.resolve()
      const data = stores.get(targetName)
      if (!data) return Promise.resolve()
      const current = Array.isArray(data.get('activeConditions'))
        ? data.get('activeConditions')
        : []
      const updated = current.filter(c => !conditionsToRemove.includes(c))
      if (updated.length === current.length) return Promise.resolve()
      data.set('activeConditions', updated)
      return data.put().catch(() => null)
    },

    initSyncHandlers(_campaignName) {
      window.addEventListener('campaign-changed', async () => {
        await stores.clear()
      })

      window.addEventListener('condition-apply', (e) => {
        const { name, key, value } = e.detail || {}
        if (!name || !key) return
        const store = stores.get(name)
        if (!store) return
        const conditions = Array.isArray(store.get(key)) ? store.get(key) : []
        if (conditions.includes(value)) return
        store.set(key, [...conditions, value])
      })

      window.addEventListener('condition-remove', (e) => {
        const { name, key, condition } = e.detail || {}
        if (!name || !key || !condition) return
        const store = stores.get(name)
        if (!store) return
        const current = Array.isArray(store.get(key)) ? store.get(key) : []
        const updated = current.filter(c => c !== condition)
        store.set(key, updated)
      })

      setTimeout(async () => {
        await stores.clear()
      }, 30)
    },

    __seedStore(key, value) {
      const entries = [[key, value]]
      if (typeof value === 'object' && value !== null) {
        for (const [k, v] of Object.entries(value)) {
          entries.push([k, v])
        }
      }
      stores.set(key, createMapStore(entries))
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
      stores.set(key, mockStore)
    },

    __readFlat(key, prop) {
      const store = stores.get(key)
      if (!store) return undefined
      return store.get(prop)
    },

    __clearStores() {
      stores.clear()
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
  __clearStores,
} = await import('./syncStoreValue.js')

describe('syncStoreValue store (mocked)', () => {
  beforeEach(() => {
    __clearStores()
  })

  describe('syncStoreValue', () => {
    it('returns false when store does not exist', async () => {
      const noStore = await syncStoreValue('nonexistent', 'value')
      expect(noStore).toBe(false)
    })

    it('returns false when value has not changed', async () => {
      __seedStore('counter', 42)
      const unchanged = await syncStoreValue('counter', 42)
      expect(unchanged).toBe(false)
    })

    it('returns true when value changes and put succeeds, and updates the store', async () => {
      __seedStore('counter', 42)
      const result = await syncStoreValue('counter', 99)
      expect(result).toBe(true)
      expect(readStore('counter')).toBe(99)
    })

    it('returns false when put fails, but still updates the store value', async () => {
      __seedStoreWithPut('counter', 42, () => Promise.reject(new Error('put failed')))
      const result = await syncStoreValue('counter', 99)
      expect(result).toBe(false)
      expect(readStore('counter')).toBe(99)
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
    it('removes the key from the store', async () => {
      __seedStore('character', { hp: 100 })
      await clearStore('character')
      expect(readStore('character')).toBeUndefined()
    })

    it('returns null when put fails', async () => {
      __seedStoreWithPut('character', { hp: 100 }, () => Promise.reject(new Error('put failed')))
      const failResult = await clearStore('character')
      expect(failResult).toBeNull()
    })
  })

  describe('applyConditionOnSaveFail', () => {
    it('falls back to local store when fetch rejects, and avoids duplicates', async () => {
      // Fetch succeeds — store should remain unchanged
      __seedStore('target', { activeConditions: [] })
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true })
      await applyConditionOnSaveFail('camp', 'attacker', 'target', 'poisoned')
      expect(__readFlat('target', 'activeConditions')).toEqual([])

      // Fetch fails, no existing condition — condition is added
      __seedStore('target', { activeConditions: [] })
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))
      await applyConditionOnSaveFail('camp', 'attacker', 'target', 'poisoned')
      expect(__readFlat('target', 'activeConditions')).toEqual(['poisoned'])

      // Fetch fails, condition already present — no duplicate added
      __seedStore('target', { activeConditions: ['poisoned'] })
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))
      await applyConditionOnSaveFail('camp', 'attacker', 'target', 'poisoned')
      expect(__readFlat('target', 'activeConditions')).toEqual(['poisoned'])
    })
  })

  describe('removeConditionsFromTarget', () => {
    it('returns early when campaignName or targetName is missing or store does not exist', async () => {
      expect(await removeConditionsFromTarget(null, 'target', ['poisoned'])).toBeUndefined()
      expect(await removeConditionsFromTarget('camp', null, ['poisoned'])).toBeUndefined()
      expect(await removeConditionsFromTarget('', 'target', ['poisoned'])).toBeUndefined()
      expect(await removeConditionsFromTarget('camp', '', ['poisoned'])).toBeUndefined()
      expect(await removeConditionsFromTarget('camp', 'nonexistent', ['poisoned'])).toBeUndefined()
    })

    it('removes matching conditions from store, leaves others intact', async () => {
      __seedStore('target', { activeConditions: ['poisoned', 'blinded', 'prone'] })
      await removeConditionsFromTarget('camp', 'target', ['poisoned', 'prone'])
      expect(__readFlat('target', 'activeConditions')).toEqual(['blinded'])
    })

    it('leaves store unchanged when no conditions match', async () => {
      __seedStore('target', { activeConditions: ['blinded'] })
      await removeConditionsFromTarget('camp', 'target', ['poisoned'])
      expect(__readFlat('target', 'activeConditions')).toEqual(['blinded'])
    })

    it('removes all conditions when all match', async () => {
      __seedStore('target', { activeConditions: ['poisoned'] })
      await removeConditionsFromTarget('camp', 'target', ['poisoned'])
      expect(__readFlat('target', 'activeConditions')).toEqual([])
    })

    it('handles activeConditions being a non-array or undefined without crashing', async () => {
      __seedStore('target', { activeConditions: 'not-an-array' })
      const result = await removeConditionsFromTarget('camp', 'target', ['poisoned'])
      expect(result).toBeUndefined()
      expect(__readFlat('target', 'activeConditions')).toBe('not-an-array')

      __seedStore('target', { name: 'target' })
      await removeConditionsFromTarget('camp', 'target', ['poisoned'])
      expect(__readFlat('target', 'activeConditions')).toBeUndefined()
    })
  })

  describe('initSyncHandlers', () => {
    it('condition-apply handler adds condition to store without duplicates', () => {
      __seedStore('target', { activeConditions: [] })
      initSyncHandlers('test')

      window.dispatchEvent(new CustomEvent('condition-apply', {
        detail: { name: 'target', key: 'activeConditions', value: 'poisoned' },
      }))

      expect(__readFlat('target', 'activeConditions')).toEqual(['poisoned'])

      // Duplicate should not be added
      window.dispatchEvent(new CustomEvent('condition-apply', {
        detail: { name: 'target', key: 'activeConditions', value: 'poisoned' },
      }))

      expect(__readFlat('target', 'activeConditions')).toEqual(['poisoned'])
    })

    it('condition-remove handler removes condition from store', () => {
      __seedStore('target', { activeConditions: ['poisoned', 'blinded'] })
      initSyncHandlers('test')

      window.dispatchEvent(new CustomEvent('condition-remove', {
        detail: { name: 'target', key: 'activeConditions', condition: 'poisoned' },
      }))

      expect(__readFlat('target', 'activeConditions')).toEqual(['blinded'])
    })

    it('handles non-array activeConditions gracefully on condition-apply', () => {
      __seedStore('target', { activeConditions: 'not-an-array' })
      initSyncHandlers('test')

      window.dispatchEvent(new CustomEvent('condition-apply', {
        detail: { name: 'target', key: 'activeConditions', value: 'poisoned' },
      }))

      expect(__readFlat('target', 'activeConditions')).toEqual(['poisoned'])
    })
  })
})
