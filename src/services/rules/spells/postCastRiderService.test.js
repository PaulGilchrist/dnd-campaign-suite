import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeHandler } from '../../automation/index.js'
import {
  getPostCastRiderSaves,
  getSpellThiefFeatures,
  hasSpellThief,
  getMultiTargetSpreads,
  getMultiTargetSpreadForSpell,
  hasPostCastRiderSave,
  triggerPostCastRiderSaves,
  getSoulstitchFeatures,
  hasSoulstitchSpells,
  triggerSoulstitchSpells,
  getEmpoweredEvocationFeatures,
  hasEmpoweredEvocation,
  getEmpoweredEvocationIntModifier,
  triggerSpellThief,
  getBewitchingMagicFeatures,
  triggerBewitchingMagic,
} from './postCastRiderService.js'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 1),
}))

vi.mock('../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}))

vi.mock('../../automation/handlers/class-fighter-rogue/spellThiefHandler.js', () => ({
  isBlockedBySpellThief: vi.fn(() => false),
}))

describe('postCastRiderService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getPostCastRiderSaves', () => {
    it('returns rider save passives', () => {
      const stats = {
        automation: {
          passives: [
            { type: 'post_cast_rider', name: 'Rider 1' },
            { type: 'passive_rule', riderSave: true, name: 'Rider 2' },
            { type: 'other', name: 'Other' },
          ],
        },
      }
      const result = getPostCastRiderSaves(stats)
      expect(result).toHaveLength(2)
    })

    it('throws when automation.passives is missing', () => {
      expect(() => getPostCastRiderSaves({})).toThrow('Expected array')
    })
  })

  describe('getSpellThiefFeatures', () => {
    it('returns spell_thief passives', () => {
      const stats = {
        automation: { passives: [{ type: 'spell_thief', name: 'Thief' }] },
      }
      expect(getSpellThiefFeatures(stats)).toHaveLength(1)
    })

    it('throws when automation.passives is missing', () => {
      expect(() => getSpellThiefFeatures({})).toThrow('Expected array')
    })
  })

  describe('hasSpellThief', () => {
    it('returns true when spell_thief features exist', () => {
      const stats = { automation: { passives: [{ type: 'spell_thief' }] } }
      expect(hasSpellThief(stats)).toBe(true)
    })

    it('throws when automation.passives is missing', () => {
      expect(() => hasSpellThief({})).toThrow('Expected array')
    })
  })

  describe('getMultiTargetSpreads', () => {
    it('returns multi_target_spread passives', () => {
      const stats = {
        automation: { passives: [{ type: 'multi_target_spread', spellFilter: ['Fireball'] }] },
      }
      expect(getMultiTargetSpreads(stats)).toHaveLength(1)
    })

    it('throws when automation.passives is missing', () => {
      expect(() => getMultiTargetSpreads({})).toThrow('Expected array')
    })
  })

  describe('getMultiTargetSpreadForSpell', () => {
    it('returns spread when spell matches filter', () => {
      const stats = {
        automation: {
          passives: [{ type: 'multi_target_spread', spellFilter: ['Fireball'], name: 'Spread 1' }],
        },
      }
      expect(getMultiTargetSpreadForSpell(stats, 'Fireball')).toBeDefined()
    })

    it('returns null when no matching spread', () => {
      const stats = {
        automation: {
          passives: [{ type: 'multi_target_spread', spellFilter: ['Fireball'] }],
        },
      }
      expect(getMultiTargetSpreadForSpell(stats, 'Iceball')).toBeNull()
    })

    it('throws when automation.passives is missing', () => {
      expect(() => getMultiTargetSpreadForSpell({}, 'Fireball')).toThrow('Expected array')
    })
  })

  describe('hasPostCastRiderSave', () => {
    it('returns true when rider saves exist', () => {
      const stats = { automation: { passives: [{ type: 'post_cast_rider' }] } }
      expect(hasPostCastRiderSave(stats)).toBe(true)
    })

    it('throws when automation.passives is missing', () => {
      expect(() => hasPostCastRiderSave({})).toThrow('Expected array')
    })
  })

  describe('triggerPostCastRiderSaves', () => {
    const enchantmentSpell = { name: 'Charm Person', school: 'enchantment' }
    const evocationSpell = { name: 'Fireball', school: 'evocation' }

    it('returns null for non-enchantment/illusion spell', async () => {
      const stats = {
        name: 'Player',
        automation: { passives: [{ type: 'post_cast_rider', name: 'Rider' }] },
      }
      const result = await triggerPostCastRiderSaves(evocationSpell, {}, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('returns null when no spell slot used', async () => {
      const stats = {
        name: 'Player',
        automation: { passives: [{ type: 'post_cast_rider', name: 'Rider' }] },
      }
      const result = await triggerPostCastRiderSaves(enchantmentSpell, { slotLevel: 0 }, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('returns null when no rider saves', async () => {
      const result = await triggerPostCastRiderSaves(enchantmentSpell, { slotLevel: 1 }, { automation: { passives: [] } }, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('returns null when uses are exhausted', async () => {
      const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js')
      vi.mocked(getRuntimeValue).mockReturnValue(0)
      const stats = {
        name: 'Player',
        automation: { passives: [{ type: 'post_cast_rider', name: 'Rider' }] },
      }
      const result = await triggerPostCastRiderSaves(enchantmentSpell, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(result).toBeNull()
      vi.mocked(getRuntimeValue).mockRestore()
    })

    it('calls executeHandler for each rider save', async () => {
      executeHandler.mockResolvedValue({ success: true })
      const stats = {
        name: 'Player',
        automation: { passives: [{ type: 'post_cast_rider', name: 'Rider', saveType: 'CON', saveDc: 15 }] },
      }
      const result = await triggerPostCastRiderSaves(enchantmentSpell, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(executeHandler).toHaveBeenCalled()
      expect(result).toEqual([{ success: true }])
    })

    it('handles riderSave format passives', async () => {
      executeHandler.mockResolvedValue({ success: true })
      const stats = {
        name: 'Player',
        automation: {
          passives: [{ type: 'passive_rule', name: 'RiderSave', riderSave: { type: 'WIS', condition: 'charmed' } }],
        },
      }
      await triggerPostCastRiderSaves(enchantmentSpell, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(executeHandler).toHaveBeenCalled()
    })

    it('throws when executeHandler errors', async () => {
      executeHandler.mockRejectedValue(new Error('fail'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const stats = {
        name: 'Player',
        automation: { passives: [{ type: 'post_cast_rider', name: 'Rider' }] },
      }
      await expect(
        triggerPostCastRiderSaves(enchantmentSpell, { slotLevel: 1 }, stats, 'camp', 'map')
      ).rejects.toThrow('fail')
      consoleSpy.mockRestore()
    })
  })

  describe('getSoulstitchFeatures', () => {
    it('returns soulstitch_spells passives', () => {
      const stats = { automation: { passives: [{ type: 'soulstitch_spells' }] } }
      expect(getSoulstitchFeatures(stats)).toHaveLength(1)
    })

    it('throws when automation.passives is missing', () => {
      expect(() => getSoulstitchFeatures({})).toThrow('Expected array')
    })
  })

  describe('hasSoulstitchSpells', () => {
    it('returns true when soulstitch features exist', () => {
      const stats = { automation: { passives: [{ type: 'soulstitch_spells' }] } }
      expect(hasSoulstitchSpells(stats)).toBe(true)
    })

    it('throws when automation.passives is missing', () => {
      expect(() => hasSoulstitchSpells({})).toThrow('Expected array')
    })
  })

  describe('triggerSoulstitchSpells', () => {
    const evocationSpell = { name: 'Fireball', school: 'Evocation', dc: { dc_type: 'CON' } }
    const nonEvocationSpell = { name: 'Charm Person', school: 'Enchantment', dc: { dc_type: 'WIS' } }

    it('throws when no soulstitch features', async () => {
      const result = await triggerSoulstitchSpells(evocationSpell, {}, { automation: { passives: [] } }, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('returns null for non-evocation spell', async () => {
      const stats = { automation: { passives: [{ type: 'soulstitch_spells', name: 'Soulstitch' }] } }
      const result = await triggerSoulstitchSpells(nonEvocationSpell, {}, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('returns null when spell has no dc', async () => {
      const stats = { automation: { passives: [{ type: 'soulstitch_spells', name: 'Soulstitch' }] } }
      const noDcSpell = { name: 'Fireball', school: 'Evocation' }
      const result = await triggerSoulstitchSpells(noDcSpell, {}, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('should accept evocation school regardless of case', async () => {
      executeHandler.mockResolvedValue({ success: true })
      const stats = { automation: { passives: [{ type: 'soulstitch_spells', name: 'Soulstitch' }] } }
      const lowercaseSpell = { name: 'Fireball', school: 'evocation', dc: { dc_type: 'CON' } }
      const result = await triggerSoulstitchSpells(lowercaseSpell, {}, stats, 'camp', 'map')
      expect(result).not.toBeNull()
    })
  })

  describe('getEmpoweredEvocationFeatures', () => {
    it('returns empowered_evocation passives', () => {
      const stats = { automation: { passives: [{ type: 'empowered_evocation' }] } }
      expect(getEmpoweredEvocationFeatures(stats)).toHaveLength(1)
    })

    it('throws when automation.passives is missing', () => {
      expect(() => getEmpoweredEvocationFeatures({})).toThrow('Expected array')
    })
  })

  describe('hasEmpoweredEvocation', () => {
    it('returns true when powered evocation features exist', () => {
      const stats = { automation: { passives: [{ type: 'empowered_evocation' }] } }
      expect(hasEmpoweredEvocation(stats)).toBe(true)
    })

    it('throws when automation.passives is missing', () => {
      expect(() => hasEmpoweredEvocation({})).toThrow('Expected array')
    })
  })

  describe('getEmpoweredEvocationIntModifier', () => {
    it('returns Intelligence bonus', () => {
      const stats = { abilities: [{ name: 'Intelligence', bonus: 3 }] }
      expect(getEmpoweredEvocationIntModifier(stats)).toBe(3)
    })

    it('returns 0 when Intelligence ability missing', () => {
      const stats = { abilities: [{ name: 'Strength', bonus: 3 }] }
      expect(getEmpoweredEvocationIntModifier(stats)).toBe(0)
    })

    it('returns 0 when abilities missing', () => {
      expect(getEmpoweredEvocationIntModifier({ abilities: [] })).toBe(0)
    })
  })

  describe('triggerSpellThief', () => {
    const spell = { name: 'Fireball' }

    it('returns null when no spell slot used', async () => {
      const stats = { name: 'Player', automation: { passives: [{ type: 'spell_thief', name: 'Thief' }] } }
      const result = await triggerSpellThief(spell, { slotLevel: 0 }, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('returns null when blocked by spell thief', async () => {
      const { isBlockedBySpellThief } = await import('../../automation/handlers/class-fighter-rogue/spellThiefHandler.js')
      vi.mocked(isBlockedBySpellThief).mockReturnValue(true)
      const stats = { name: 'Player', automation: { passives: [{ type: 'spell_thief', name: 'Thief' }] } }
      const result = await triggerSpellThief(spell, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(result).toBeNull()
      vi.mocked(isBlockedBySpellThief).mockReturnValue(false)
    })

    it('returns null when no spell thief features', async () => {
      const result = await triggerSpellThief(spell, { slotLevel: 1 }, { automation: { passives: [] } }, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('returns null when uses exhausted', async () => {
      const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js')
      vi.mocked(getRuntimeValue).mockReturnValue(false)
      const result = await triggerSpellThief(spell, { slotLevel: 1 }, { automation: { passives: [] } }, 'camp', 'map')
      expect(result).toBeNull()
      vi.mocked(getRuntimeValue).mockRestore()
    })

    it('calls executeHandler for each thief feature', async () => {
      const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js')
      executeHandler.mockResolvedValue({ success: true })
      // Return 1 for uses (the handler calls getRuntimeValue(playerStats.name, usesKey) with no campaignName)
      vi.mocked(getRuntimeValue).mockReturnValue(1)
      const stats = {
        name: 'Player',
        automation: { passives: [{ type: 'spell_thief', name: 'Thief', saveType: 'INT' }] },
      }
      const result = await triggerSpellThief(spell, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(executeHandler).toHaveBeenCalled()
      expect(result).toEqual([{ success: true }])
      vi.mocked(getRuntimeValue).mockRestore()
    })
  })

  describe('getBewitchingMagicFeatures', () => {
    it('returns bewitching_magic passives', () => {
      const stats = { automation: { passives: [{ type: 'bewitching_magic' }] } }
      expect(getBewitchingMagicFeatures(stats)).toHaveLength(1)
    })

    it('throws when automation.passives is missing', () => {
      expect(() => getBewitchingMagicFeatures({})).toThrow('Expected array')
    })
  })

  describe('triggerBewitchingMagic', () => {
    const enchantmentSpell = { name: 'Charm Person', school: 'enchantment', casting_time: '1 action' }
    const actionSpell = { name: 'Fireball', school: 'evocation', casting_time: '1 action' }

    it('returns null for non-enchantment/illusion spell', async () => {
      const stats = { automation: { passives: [{ type: 'bewitching_magic', name: 'Bewitch' }] } }
      const result = await triggerBewitchingMagic(actionSpell, {}, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('returns null when no spell slot used', async () => {
      const stats = { automation: { passives: [{ type: 'bewitching_magic', name: 'Bewitch' }] } }
      const result = await triggerBewitchingMagic({ ...enchantmentSpell, level: 0 }, {}, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('returns null when casting time is not 1 action', async () => {
      const stats = { automation: { passives: [{ type: 'bewitching_magic', name: 'Bewitch' }] } }
      const result = await triggerBewitchingMagic({ ...enchantmentSpell, casting_time: '1 bonus action' }, {}, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('returns null when no bewitching features', async () => {
      const result = await triggerBewitchingMagic(enchantmentSpell, { slotLevel: 1 }, { automation: { passives: [] } }, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('calls executeHandler for each bewitching feature', async () => {
      executeHandler.mockResolvedValue({ success: true })
      const stats = { automation: { passives: [{ type: 'bewitching_magic', name: 'Bewitch' }] } }
      const result = await triggerBewitchingMagic(enchantmentSpell, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(executeHandler).toHaveBeenCalled()
      expect(result).toEqual([{ success: true }])
    })
  })
})
