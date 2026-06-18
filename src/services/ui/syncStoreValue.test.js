import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { syncStoreValue, readStore, clearStore, applyConditionOnSaveFail, removeConditionsFromTarget, initSyncHandlers } from './syncStoreValue.js'

describe('syncStoreValue (real module)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('syncStoreValue', () => {
    it('returns false when store does not exist', async () => {
      const result = await syncStoreValue('nonexistent', 'value')
      expect(result).toBe(false)
    })
  })

  describe('readStore', () => {
    it('returns undefined when key does not exist', () => {
      const result = readStore('nonexistent')
      expect(result).toBeUndefined()
    })
  })

  describe('clearStore', () => {
    it('returns resolved promise when store does not exist', async () => {
      const result = await clearStore('nonexistent')
      expect(result).toBeUndefined()
    })
  })

  describe('applyConditionOnSaveFail', () => {
    it('returns a promise', () => {
      const result = applyConditionOnSaveFail('camp', 'attacker', 'target', 'poisoned')
      expect(result).toBeInstanceOf(Promise)
    })

    it('POSTs to the applyCondition endpoint', async () => {
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

    it('encodes campaignName in the URL', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({ ok: true })
      vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch)

      await applyConditionOnSaveFail('my campaign', 'attacker', 'target', 'blinded')
      expect(fakeFetch).toHaveBeenCalledWith(
        '/api/campaigns/my%20campaign/applyCondition',
        expect.any(Object)
      )
    })

    it('resolves with response when fetch succeeds', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true })

      const result = await applyConditionOnSaveFail('camp', 'attacker', 'target', 'poisoned')
      expect(result).toEqual({ ok: true })
    })

    it('returns false when fetch rejects', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))

      const result = await applyConditionOnSaveFail('camp', 'attacker', 'target', 'poisoned')
      expect(result).toBe(false)
    })

    it('returns the response object when fetch returns non-ok (not caught by catch)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false })

      const result = await applyConditionOnSaveFail('camp', 'attacker', 'target', 'poisoned')
      expect(result).toEqual({ ok: false })
    })
  })

  describe('removeConditionsFromTarget', () => {
    it('returns resolved promise when campaignName is null', async () => {
      const result = await removeConditionsFromTarget(null, 'target', ['poisoned'])
      expect(result).toBeUndefined()
    })

    it('returns resolved promise when targetName is null', async () => {
      const result = await removeConditionsFromTarget('camp', null, ['poisoned'])
      expect(result).toBeUndefined()
    })

    it('returns resolved promise when campaignName is empty string', async () => {
      const result = await removeConditionsFromTarget('', 'target', ['poisoned'])
      expect(result).toBeUndefined()
    })

    it('returns resolved promise when targetName is empty string', async () => {
      const result = await removeConditionsFromTarget('camp', '', ['poisoned'])
      expect(result).toBeUndefined()
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

    it('sets up a setTimeout with SYNC_DELAY', () => {
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout')
      initSyncHandlers('test')
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30)
    })

    it('campaign-changed event does not throw when dispatched', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('campaign-changed'))
      }).not.toThrow()
    })

    it('condition-apply event does not throw when dispatched with valid detail', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('condition-apply', {
          detail: { name: 'target', key: 'activeConditions', value: 'poisoned' },
        }))
      }).not.toThrow()
    })

    it('condition-apply event does not throw when dispatched with no detail', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('condition-apply'))
      }).not.toThrow()
    })

    it('condition-apply event returns early when detail missing name', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('condition-apply', {
          detail: { key: 'activeConditions', value: 'poisoned' },
        }))
      }).not.toThrow()
    })

    it('condition-apply event returns early when detail missing key', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('condition-apply', {
          detail: { name: 'target', value: 'poisoned' },
        }))
      }).not.toThrow()
    })

    it('condition-remove event returns early when detail missing name', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('condition-remove', {
          detail: { key: 'activeConditions', condition: 'poisoned' },
        }))
      }).not.toThrow()
    })

    it('condition-remove event returns early when detail missing key', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('condition-remove', {
          detail: { name: 'target', condition: 'poisoned' },
        }))
      }).not.toThrow()
    })

    it('condition-remove event returns early when detail missing condition', () => {
      initSyncHandlers('test')
      expect(() => {
        window.dispatchEvent(new CustomEvent('condition-remove', {
          detail: { name: 'target', key: 'activeConditions' },
        }))
      }).not.toThrow()
    })
  })
})
