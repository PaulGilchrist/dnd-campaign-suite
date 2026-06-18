import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isDivineSmite,
  getInspiringSmitePassives,
  hasInspiringSmite,
  triggerInspiringSmite,
} from './inspiringSmiteService.js'

vi.mock('../../automation/index.js', () => ({
  executeHandler: vi.fn(async () => null),
}))

describe('inspiringSmiteService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isDivineSmite', () => {
    it('returns true for "Divine Smite"', () => {
      expect(isDivineSmite({ name: 'Divine Smite' })).toBe(true)
    })

    it('returns true for lowercase', () => {
      expect(isDivineSmite({ name: 'divine smite' })).toBe(true)
    })

    it('returns false for other spells', () => {
      expect(isDivineSmite({ name: 'Fireball' })).toBe(false)
    })

    it('returns false for empty name', () => {
      expect(isDivineSmite({ name: '' })).toBe(false)
    })

    it('returns false for undefined name', () => {
      expect(isDivineSmite({})).toBe(false)
    })
  })

  describe('getInspiringSmitePassives', () => {
    it('returns passives with type post_cast_inspiring_smite', () => {
      const stats = {
        automation: {
          passives: [
            { type: 'post_cast_inspiring_smite', name: 'Inspiring Smite 1' },
            { type: 'other_type', name: 'Other' },
            { type: 'post_cast_inspiring_smite', name: 'Inspiring Smite 2' },
          ],
        },
      }
      const result = getInspiringSmitePassives(stats)
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Inspiring Smite 1')
    })

    it('throws when no passives exist', () => {
      expect(() => getInspiringSmitePassives({})).toThrow('Expected array, got undefined')
    })

    it('throws when passives is undefined', () => {
      expect(() => getInspiringSmitePassives({ automation: {} })).toThrow('Expected array, got undefined')
    })
  })

  describe('hasInspiringSmite', () => {
    it('returns true when inspiring smite passives exist', () => {
      const stats = { automation: { passives: [{ type: 'post_cast_inspiring_smite' }] } }
      expect(hasInspiringSmite(stats)).toBe(true)
    })

    it('returns false when no inspiring smite passives exist', () => {
      const stats = { automation: { passives: [{ type: 'other' }] } }
      expect(hasInspiringSmite(stats)).toBe(false)
    })

    it('throws when no passives', () => {
      expect(() => hasInspiringSmite({})).toThrow('Expected array, got undefined')
    })
  })

  describe('triggerInspiringSmite', () => {
    it('returns null for non-divine smite spell', async () => {
      const result = await triggerInspiringSmite({ name: 'Fireball' }, {}, {}, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('returns null when no slot level used', async () => {
      const stats = { automation: { passives: [{ type: 'post_cast_inspiring_smite', name: 'Inspire' }] } }
      const result = await triggerInspiringSmite({ name: 'Divine Smite', level: 0 }, { slotLevel: 0 }, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('returns null when no inspiring smite passives', async () => {
      const stats = { automation: { passives: [] } }
      const result = await triggerInspiringSmite({ name: 'Divine Smite' }, { slotLevel: 2 }, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('calls executeHandler for each inspiring smite passive', async () => {
      const { executeHandler } = await import('../../automation/index.js')
      vi.mocked(executeHandler).mockResolvedValue({ success: true })

      const stats = { automation: { passives: [{ type: 'post_cast_inspiring_smite', name: 'Inspire' }] } }
      const result = await triggerInspiringSmite({ name: 'Divine Smite' }, { slotLevel: 2 }, stats, 'camp', 'map')
      expect(executeHandler).toHaveBeenCalled()
      expect(result).toEqual([{ success: true }])
    })

    it('returns null when executeHandler returns falsy results', async () => {
      const { executeHandler } = await import('../../automation/index.js')
      vi.mocked(executeHandler).mockResolvedValue(null)
      const stats = { automation: { passives: [{ type: 'post_cast_inspiring_smite', name: 'Inspire' }] } }
      const result = await triggerInspiringSmite({ name: 'Divine Smite' }, { slotLevel: 2 }, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('handles executeHandler errors gracefully', async () => {
      const { executeHandler } = await import('../../automation/index.js')
      vi.mocked(executeHandler).mockRejectedValue(new Error('fail'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const stats = { automation: { passives: [{ type: 'post_cast_inspiring_smite', name: 'Inspire' }] } }
      const result = await triggerInspiringSmite({ name: 'Divine Smite' }, { slotLevel: 2 }, stats, 'camp', 'map')
      expect(consoleSpy).toHaveBeenCalled()
      expect(result).toBeNull()
      consoleSpy.mockRestore()
    })

    it('passes spell level when metaCtx has no slotLevel', async () => {
      const { executeHandler } = await import('../../automation/index.js')
      vi.mocked(executeHandler).mockResolvedValue({ success: true })

      const stats = { automation: { passives: [{ type: 'post_cast_inspiring_smite', name: 'Inspire' }] } }
      await triggerInspiringSmite({ name: 'Divine Smite', level: 1 }, {}, stats, 'camp', 'map')
      expect(executeHandler).toHaveBeenCalled()
    })
  })
})
