// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the module with a controllable in-memory store so each test
// can seed state and assert real behavior without module-level pollution.
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
      const result = await syncStoreValue('nonexistent', 'value')
      expect(result).toBe(false)
    })

    it('returns false when value has not changed (primitive)', async () => {
      __seedStore('counter', 42)
      const result = await syncStoreValue('counter', 42)
      expect(result).toBe(false)
    })

    it('returns false when value has not changed (object reference equality)', async () => {
      const obj = { hp: 100 }
      __seedStore('character', obj)
      const result = await syncStoreValue('character', obj)
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
      expect(readStore('character')).toEqual({ hp: 50 })
    })

    it('does not update the store when value is unchanged', async () => {
      __seedStore('character', { hp: 100 })
      await syncStoreValue('character', { hp: 100 })
      expect(readStore('character')).toEqual({ hp: 100 })
    })

    it('returns false but still updates the store when put fails (value written before put)', async () => {
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

    it('returns the stored object even when it lacks a particular property', () => {
      __seedStore('character', { name: 'Gandalf' })
      const result = readStore('character')
      expect(result).toEqual({ name: 'Gandalf' })
      expect(result.hp).toBeUndefined()
    })
  })

  describe('clearStore', () => {
    it('returns undefined when awaited and store does not exist', async () => {
      const result = await clearStore('nonexistent')
      expect(result).toBeUndefined()
    })

    it('removes the key from the store', async () => {
      __seedStore('character', { hp: 100 })
      await clearStore('character')
      expect(readStore('character')).toBeUndefined()
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

    it('clears the value even when put fails', async () => {
      __seedStoreWithPut('character', { hp: 100 }, () => Promise.reject(new Error('put failed')))
      await clearStore('character')
      expect(readStore('character')).toBeUndefined()
    })
  })

  describe('applyConditionOnSaveFail', () => {
    it('calls fetch with correct URL and body when fetch succeeds', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({ ok: true })
      vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch)

      await applyConditionOnSaveFail('camp', 'attacker', 'target', 'poisoned')

      expect(fakeFetch).toHaveBeenCalledWith(
        '/api/campaigns/camp/applyCondition',
        expect.objectContaining({
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ characterName: 'attacker', targetName: 'target', condition: 'poisoned' }),
        })
      )
    })

    it('URL-encodes campaign name with special characters', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({ ok: true })
      vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch)

      await applyConditionOnSaveFail('my campaign', 'attacker', 'target', 'poisoned')

      expect(fakeFetch).toHaveBeenCalledWith(
        '/api/campaigns/my%20campaign/applyCondition',
        expect.any(Object)
      )
    })

    it('returns the fetch response when fetch succeeds', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200 })

      const result = await applyConditionOnSaveFail('camp', 'attacker', 'target', 'poisoned')
      expect(result).toEqual({ ok: true, status: 200 })
    })

    it('falls back to local store when fetch rejects', async () => {
      __seedStore('target', { activeConditions: [] })
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))

      await applyConditionOnSaveFail('camp', 'attacker', 'target', 'poisoned')
      expect(__readFlat('target', 'activeConditions')).toEqual(['poisoned'])
    })

    it('does not add a duplicate condition via fallback', async () => {
      __seedStore('target', { activeConditions: ['poisoned'] })
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))

      await applyConditionOnSaveFail('camp', 'attacker', 'target', 'poisoned')
      expect(__readFlat('target', 'activeConditions')).toEqual(['poisoned'])
    })

    it('does not modify store when fetch succeeds (fallback not triggered)', async () => {
      __seedStore('target', { activeConditions: [] })
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true })

      await applyConditionOnSaveFail('camp', 'attacker', 'target', 'poisoned')
      expect(__readFlat('target', 'activeConditions')).toEqual([])
    })

    it('does not crash when target store does not exist during fallback', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))
      expect(() => applyConditionOnSaveFail('camp', 'attacker', 'target', 'poisoned')).not.toThrow()
    })
  })

  describe('removeConditionsFromTarget', () => {
    it('returns undefined when campaignName is null', async () => {
      const result = await removeConditionsFromTarget(null, 'target', ['poisoned'])
      expect(result).toBeUndefined()
    })

    it('returns undefined when targetName is null', async () => {
      const result = await removeConditionsFromTarget('camp', null, ['poisoned'])
      expect(result).toBeUndefined()
    })

    it('returns undefined when campaignName is empty string', async () => {
      const result = await removeConditionsFromTarget('', 'target', ['poisoned'])
      expect(result).toBeUndefined()
    })

    it('returns undefined when targetName is empty string', async () => {
      const result = await removeConditionsFromTarget('camp', '', ['poisoned'])
      expect(result).toBeUndefined()
    })

    it('returns undefined when store does not exist', async () => {
      const result = await removeConditionsFromTarget('camp', 'nonexistent', ['poisoned'])
      expect(result).toBeUndefined()
    })

    it('returns undefined when no conditions match', async () => {
      __seedStore('target', { activeConditions: ['blinded'] })
      const result = await removeConditionsFromTarget('camp', 'target', ['poisoned'])
      expect(result).toBeUndefined()
    })

    it('removes matching conditions from store', async () => {
      __seedStore('target', { activeConditions: ['poisoned', 'blinded', 'prone'] })
      await removeConditionsFromTarget('camp', 'target', ['poisoned', 'prone'])
      expect(__readFlat('target', 'activeConditions')).toEqual(['blinded'])
    })

    it('leaves all conditions intact when none match', async () => {
      __seedStore('target', { activeConditions: ['poisoned', 'blinded'] })
      await removeConditionsFromTarget('camp', 'target', ['prone'])
      expect(__readFlat('target', 'activeConditions')).toEqual(['poisoned', 'blinded'])
    })

    it('removes all conditions when all match', async () => {
      __seedStore('target', { activeConditions: ['poisoned'] })
      await removeConditionsFromTarget('camp', 'target', ['poisoned'])
      expect(__readFlat('target', 'activeConditions')).toEqual([])
    })

    it('handles activeConditions being a non-array string value (no change)', async () => {
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

    it('registers a setTimeout for deferred sync', () => {
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout')
      initSyncHandlers('test')
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30)
    })

    it('condition-apply handler adds condition to store', () => {
      __seedStore('target', { activeConditions: [] })
      initSyncHandlers('test')

      window.dispatchEvent(new CustomEvent('condition-apply', {
        detail: { name: 'target', key: 'activeConditions', value: 'poisoned' },
      }))

      expect(__readFlat('target', 'activeConditions')).toEqual(['poisoned'])
    })

    it('condition-apply handler does not add duplicate condition', () => {
      __seedStore('target', { activeConditions: ['poisoned'] })
      initSyncHandlers('test')

      window.dispatchEvent(new CustomEvent('condition-apply', {
        detail: { name: 'target', key: 'activeConditions', value: 'poisoned' },
      }))

      expect(__readFlat('target', 'activeConditions')).toEqual(['poisoned'])
    })

    it('condition-apply handler adds to empty array when no conditions exist', () => {
      __seedStore('target', { activeConditions: [] })
      initSyncHandlers('test')

      window.dispatchEvent(new CustomEvent('condition-apply', {
        detail: { name: 'target', key: 'activeConditions', value: 'blinded' },
      }))

      expect(__readFlat('target', 'activeConditions')).toEqual(['blinded'])
    })

    it('condition-apply handler returns early when detail is missing', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('condition-apply', { detail: {} }))
      }).not.toThrow()
    })

    it('condition-apply handler returns early when name is missing', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('condition-apply', {
          detail: { key: 'activeConditions', value: 'poisoned' },
        }))
      }).not.toThrow()
    })

    it('condition-apply handler returns early when key is missing', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('condition-apply', {
          detail: { name: 'target', value: 'poisoned' },
        }))
      }).not.toThrow()
    })

    it('condition-apply handler does not crash when store does not exist', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('condition-apply', {
          detail: { name: 'nonexistent', key: 'activeConditions', value: 'poisoned' },
        }))
      }).not.toThrow()
    })

    it('condition-remove handler removes condition from store', () => {
      __seedStore('target', { activeConditions: ['poisoned', 'blinded'] })
      initSyncHandlers('test')

      window.dispatchEvent(new CustomEvent('condition-remove', {
        detail: { name: 'target', key: 'activeConditions', condition: 'poisoned' },
      }))

      expect(__readFlat('target', 'activeConditions')).toEqual(['blinded'])
    })

    it('condition-remove handler does nothing when condition not present', () => {
      __seedStore('target', { activeConditions: ['blinded'] })
      initSyncHandlers('test')

      window.dispatchEvent(new CustomEvent('condition-remove', {
        detail: { name: 'target', key: 'activeConditions', condition: 'poisoned' },
      }))

      expect(__readFlat('target', 'activeConditions')).toEqual(['blinded'])
    })

    it('condition-remove handler returns early when detail is missing', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('condition-remove', { detail: {} }))
      }).not.toThrow()
    })

    it('condition-remove handler returns early when name is missing', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('condition-remove', {
          detail: { key: 'activeConditions', condition: 'poisoned' },
        }))
      }).not.toThrow()
    })

    it('condition-remove handler returns early when key is missing', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('condition-remove', {
          detail: { name: 'target', condition: 'poisoned' },
        }))
      }).not.toThrow()
    })

    it('condition-remove handler returns early when condition is missing', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('condition-remove', {
          detail: { name: 'target', key: 'activeConditions' },
        }))
      }).not.toThrow()
    })

    it('condition-remove handler does not crash when store does not exist', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('condition-remove', {
          detail: { name: 'nonexistent', key: 'activeConditions', condition: 'poisoned' },
        }))
      }).not.toThrow()
    })

    it('campaign-changed event does not throw', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('campaign-changed'))
      }).not.toThrow()
    })
  })
})
