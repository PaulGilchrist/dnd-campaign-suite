// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isDivineSmite,
  getInspiringSmitePassives,
  hasInspiringSmite,
  triggerInspiringSmite,
} from './inspiringSmiteService.js'
import { executeHandler } from '../../automation/index.js'

vi.mock('../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}))

describe('inspiringSmiteService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('isDivineSmite', () => {
    it('returns true for exact case match', () => {
      expect(isDivineSmite({ name: 'Divine Smite' })).toBe(true)
    })

    it('returns true for lowercase variant', () => {
      expect(isDivineSmite({ name: 'divine smite' })).toBe(true)
    })

    it('returns true for mixed case variant', () => {
      expect(isDivineSmite({ name: 'DIVINE SMITE' })).toBe(true)
    })

    it('returns false for similar but different spell name', () => {
      expect(isDivineSmite({ name: 'Divine Fire' })).toBe(false)
    })

    it('returns false for unrelated spell', () => {
      expect(isDivineSmite({ name: 'Fireball' })).toBe(false)
    })

    it('returns false for empty string name', () => {
      expect(isDivineSmite({ name: '' })).toBe(false)
    })

    it('returns false when name is missing', () => {
      expect(isDivineSmite({})).toBe(false)
    })

    it('returns false when spell is null', () => {
      expect(() => isDivineSmite(null)).toThrow()
    })
  })

  describe('getInspiringSmitePassives', () => {
    it('returns only post_cast_inspiring_smite passives', () => {
      const stats = {
        automation: {
          passives: [
            { type: 'post_cast_inspiring_smite', name: 'Inspire 1' },
            { type: 'other_type', name: 'Other' },
            { type: 'post_cast_inspiring_smite', name: 'Inspire 2' },
          ],
        },
      }
      const result = getInspiringSmitePassives(stats)
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Inspire 1')
      expect(result[1].name).toBe('Inspire 2')
    })

    it('returns empty array when no matching passives exist', () => {
      const stats = {
        automation: {
          passives: [{ type: 'other_type', name: 'Other' }],
        },
      }
      expect(getInspiringSmitePassives(stats)).toEqual([])
    })

    it('throws when automation.passives is undefined', () => {
      expect(() => getInspiringSmitePassives({})).toThrow('Expected array, got undefined')
    })

    it('throws when automation is missing', () => {
      expect(() => getInspiringSmitePassives({})).toThrow('Expected array, got undefined')
    })

    it('throws when automation.passives is null', () => {
      expect(() => getInspiringSmitePassives({ automation: { passives: null } })).toThrow('Expected array, got null')
    })
  })

  describe('hasInspiringSmite', () => {
    it('returns true when inspiring smite passives exist', () => {
      const stats = { automation: { passives: [{ type: 'post_cast_inspiring_smite' }] } }
      expect(hasInspiringSmite(stats)).toBe(true)
    })

    it('returns false when only non-matching passives exist', () => {
      const stats = { automation: { passives: [{ type: 'other' }] } }
      expect(hasInspiringSmite(stats)).toBe(false)
    })

    it('returns false when passives array is empty', () => {
      const stats = { automation: { passives: [] } }
      expect(hasInspiringSmite(stats)).toBe(false)
    })

    it('throws when passives array is missing', () => {
      expect(() => hasInspiringSmite({})).toThrow('Expected array, got undefined')
    })
  })

  describe('triggerInspiringSmite', () => {
    const campaignName = 'TestCampaign'
    const mapName = 'testMap'

    const createStats = (overrides = {}) => ({
      automation: {
        passives: [{ type: 'post_cast_inspiring_smite', name: 'Inspire Smite', ...overrides }],
      },
      ...overrides,
    })

    it('returns null for non-divine smite spell', async () => {
      const result = await triggerInspiringSmite({ name: 'Fireball' }, {}, createStats(), campaignName, mapName)
      expect(result).toBeNull()
      expect(executeHandler).not.toHaveBeenCalled()
    })

    it('returns null when slotLevel is 0 and spell.level is 0', async () => {
      const spell = { name: 'Divine Smite', level: 0 }
      const metaCtx = { slotLevel: 0 }
      const result = await triggerInspiringSmite(spell, metaCtx, createStats(), campaignName, mapName)
      expect(result).toBeNull()
      expect(executeHandler).not.toHaveBeenCalled()
    })

    it('returns null when metaCtx has no slotLevel and spell.level is 0', async () => {
      const spell = { name: 'Divine Smite', level: 0 }
      const result = await triggerInspiringSmite(spell, {}, createStats(), campaignName, mapName)
      expect(result).toBeNull()
      expect(executeHandler).not.toHaveBeenCalled()
    })

    it('returns null when spell has no level property and metaCtx has no slotLevel', async () => {
      const spell = { name: 'Divine Smite' }
      const result = await triggerInspiringSmite(spell, {}, createStats(), campaignName, mapName)
      expect(result).toBeNull()
      expect(executeHandler).not.toHaveBeenCalled()
    })

    it('returns null when no inspiring smite passives exist', async () => {
      const stats = { automation: { passives: [] } }
      const result = await triggerInspiringSmite({ name: 'Divine Smite' }, { slotLevel: 2 }, stats, campaignName, mapName)
      expect(result).toBeNull()
      expect(executeHandler).not.toHaveBeenCalled()
    })

    it('calls executeHandler for each inspiring smite passive with correct action shape', async () => {
      executeHandler.mockResolvedValue({ success: true })
      const stats = { automation: { passives: [{ type: 'post_cast_inspiring_smite', name: 'Inspire Smite' }] } }
      const spell = { name: 'Divine Smite' }

      const result = await triggerInspiringSmite(spell, { slotLevel: 2 }, stats, campaignName, mapName)

      expect(executeHandler).toHaveBeenCalledTimes(1)
      const [action] = vi.mocked(executeHandler).mock.calls[0]
      expect(action).toEqual({
        name: 'Inspire Smite',
        automation: {
          type: 'post_cast_inspiring_smite',
          casting_time: 'passive',
        },
      })
      expect(result).toEqual([{ success: true }])
    })

    it('passes campaignName and mapName to executeHandler', async () => {
      executeHandler.mockResolvedValue({ success: true })
      const stats = { automation: { passives: [{ type: 'post_cast_inspiring_smite', name: 'Inspire' }] } }

      await triggerInspiringSmite({ name: 'Divine Smite' }, { slotLevel: 1 }, stats, campaignName, mapName)

      expect(executeHandler).toHaveBeenCalledWith(
        expect.any(Object),
        stats,
        campaignName,
        mapName,
      )
    })

    it('uses spell.level when metaCtx has no slotLevel', async () => {
      executeHandler.mockResolvedValue({ success: true })
      const stats = { automation: { passives: [{ type: 'post_cast_inspiring_smite', name: 'Inspire' }] } }

      await triggerInspiringSmite({ name: 'Divine Smite', level: 1 }, {}, stats, campaignName, mapName)

      expect(executeHandler).toHaveBeenCalled()
    })

    it('returns null when executeHandler returns falsy result', async () => {
      executeHandler.mockResolvedValue(null)
      const stats = { automation: { passives: [{ type: 'post_cast_inspiring_smite', name: 'Inspire' }] } }

      const result = await triggerInspiringSmite({ name: 'Divine Smite' }, { slotLevel: 2 }, stats, campaignName, mapName)

      expect(result).toBeNull()
    })

    it('executes multiple inspiring smite passives sequentially', async () => {
      executeHandler.mockResolvedValueOnce({ result: 1 })
      executeHandler.mockResolvedValueOnce({ result: 2 })

      const stats = {
        automation: {
          passives: [
            { type: 'post_cast_inspiring_smite', name: 'Inspire 1' },
            { type: 'post_cast_inspiring_smite', name: 'Inspire 2' },
          ],
        },
      }

      const result = await triggerInspiringSmite({ name: 'Divine Smite' }, { slotLevel: 1 }, stats, campaignName, mapName)

      expect(executeHandler).toHaveBeenCalledTimes(2)
      expect(result).toEqual([{ result: 1 }, { result: 2 }])
    })

    it('skips falsy results from executeHandler', async () => {
      executeHandler.mockResolvedValueOnce({ result: 1 })
      executeHandler.mockResolvedValueOnce(null)
      executeHandler.mockResolvedValueOnce({ result: 3 })

      const stats = {
        automation: {
          passives: [
            { type: 'post_cast_inspiring_smite', name: 'Inspire 1' },
            { type: 'post_cast_inspiring_smite', name: 'Inspire 2' },
            { type: 'post_cast_inspiring_smite', name: 'Inspire 3' },
          ],
        },
      }

      const result = await triggerInspiringSmite({ name: 'Divine Smite' }, { slotLevel: 1 }, stats, campaignName, mapName)

      expect(result).toEqual([{ result: 1 }, { result: 3 }])
    })

    it('passes custom casting_time from passive when defined', async () => {
      executeHandler.mockResolvedValue({ success: true })
      const stats = {
        automation: {
          passives: [{ type: 'post_cast_inspiring_smite', name: 'Inspire', casting_time: '1 action' }],
        },
      }

      await triggerInspiringSmite({ name: 'Divine Smite' }, { slotLevel: 1 }, stats, campaignName, mapName)

      const [action] = vi.mocked(executeHandler).mock.calls[0]
      expect(action.automation.casting_time).toBe('1 action')
    })

    it('defaults casting_time to passive when not defined', async () => {
      executeHandler.mockResolvedValue({ success: true })
      const stats = { automation: { passives: [{ type: 'post_cast_inspiring_smite', name: 'Inspire' }] } }

      await triggerInspiringSmite({ name: 'Divine Smite' }, { slotLevel: 1 }, stats, campaignName, mapName)

      const [action] = vi.mocked(executeHandler).mock.calls[0]
      expect(action.automation.casting_time).toBe('passive')
    })

    it('throws when executeHandler throws an error', async () => {
      executeHandler.mockRejectedValue(new Error('handler failed'))
      const stats = { automation: { passives: [{ type: 'post_cast_inspiring_smite', name: 'Inspire' }] } }

      await expect(
        triggerInspiringSmite({ name: 'Divine Smite' }, { slotLevel: 2 }, stats, campaignName, mapName)
      ).rejects.toThrow('handler failed')
    })

    it('throws on first handler failure and stops processing remaining passives', async () => {
      executeHandler.mockRejectedValueOnce(new Error('fail'))
      executeHandler.mockResolvedValueOnce({ result: 2 })

      const stats = {
        automation: {
          passives: [
            { type: 'post_cast_inspiring_smite', name: 'Inspire 1' },
            { type: 'post_cast_inspiring_smite', name: 'Inspire 2' },
          ],
        },
      }

      await expect(
        triggerInspiringSmite({ name: 'Divine Smite' }, { slotLevel: 1 }, stats, campaignName, mapName)
      ).rejects.toThrow('fail')

      expect(executeHandler).toHaveBeenCalledTimes(1)
    })

    it('returns null when no inspiring smite passives are defined', async () => {
      const stats = { automation: { passives: [] } }
      const result = await triggerInspiringSmite({ name: 'Divine Smite' }, { slotLevel: 1 }, stats, campaignName, mapName)
      expect(result).toBeNull()
      expect(executeHandler).not.toHaveBeenCalled()
    })

    it('handles metaCtx as undefined when spell has no level', async () => {
      const spell = { name: 'Divine Smite' }
      const result = await triggerInspiringSmite(spell, undefined, createStats(), campaignName, mapName)
      expect(result).toBeNull()
      expect(executeHandler).not.toHaveBeenCalled()
    })

    it('handles spell as undefined gracefully', async () => {
      const stats = createStats()
      await expect(
        triggerInspiringSmite(undefined, { slotLevel: 1 }, stats, campaignName, mapName)
      ).rejects.toThrow()
    })
  })
})
