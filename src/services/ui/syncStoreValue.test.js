import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncStoreValue, readStore, clearStore, applyConditionOnSaveFail, removeConditionsFromTarget, initSyncHandlers } from './syncStoreValue.js'

describe('syncStoreValue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
  })

  describe('initSyncHandlers', () => {
    it('registers event listeners', () => {
      const addEventListener = vi.spyOn(window, 'addEventListener')
      initSyncHandlers('test-campaign')
      expect(addEventListener).toHaveBeenCalledWith('campaign-changed', expect.any(Function))
      expect(addEventListener).toHaveBeenCalledWith('condition-apply', expect.any(Function))
      expect(addEventListener).toHaveBeenCalledWith('condition-remove', expect.any(Function))
      addEventListener.mockRestore()
    })
  })
})
