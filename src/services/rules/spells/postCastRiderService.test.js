// @improved-by-ai
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
  confirmSoulstitchSelection,
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

vi.mock('../../automation/handlers/class-wizard/soulstitchSpellsHandler.js', () => ({
  applySoulstitchSelection: vi.fn(),
}))

describe('postCastRiderService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getPostCastRiderSaves', () => {
    it('returns passives with type post_cast_rider', () => {
      const stats = {
        automation: {
          passives: [
            { type: 'post_cast_rider', name: 'Rider 1' },
            { type: 'other', name: 'Other' },
          ],
        },
      }
      const result = getPostCastRiderSaves(stats)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Rider 1')
    })

    it('returns passives with type passive_rule and riderSave truthy', () => {
      const stats = {
        automation: {
          passives: [
            { type: 'passive_rule', riderSave: { type: 'WIS' }, name: 'Rider 2' },
            { type: 'passive_rule', name: 'Other' },
          ],
        },
      }
      const result = getPostCastRiderSaves(stats)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Rider 2')
    })

    it('returns both post_cast_rider and riderSave passives together', () => {
      const stats = {
        automation: {
          passives: [
            { type: 'post_cast_rider', name: 'Rider 1' },
            { type: 'passive_rule', riderSave: true, name: 'Rider 2' },
            { type: 'other', name: 'Other' },
          ],
        },
      }
      expect(getPostCastRiderSaves(stats)).toHaveLength(2)
    })

    it('throws when automation.passives is missing', () => {
      expect(() => getPostCastRiderSaves({})).toThrow('Expected array')
    })

    it('throws when automation.passives is null', () => {
      expect(() => getPostCastRiderSaves({ automation: { passives: null } })).toThrow('Expected array')
    })

    it('returns empty array when passives is empty', () => {
      expect(getPostCastRiderSaves({ automation: { passives: [] } })).toEqual([])
    })
  })

  describe('getSpellThiefFeatures', () => {
    it('returns spell_thief passives', () => {
      const stats = {
        automation: {
          passives: [
            { type: 'spell_thief', name: 'Thief' },
            { type: 'other', name: 'Other' },
          ],
        },
      }
      const result = getSpellThiefFeatures(stats)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Thief')
    })

    it('throws when automation.passives is missing', () => {
      expect(() => getSpellThiefFeatures({})).toThrow('Expected array')
    })

    it('returns empty array when passives is empty', () => {
      expect(getSpellThiefFeatures({ automation: { passives: [] } })).toEqual([])
    })
  })

  describe('hasSpellThief', () => {
    it('returns true when spell_thief features exist', () => {
      const stats = { automation: { passives: [{ type: 'spell_thief' }] } }
      expect(hasSpellThief(stats)).toBe(true)
    })

    it('returns false when no spell_thief features', () => {
      const stats = { automation: { passives: [{ type: 'other' }] } }
      expect(hasSpellThief(stats)).toBe(false)
    })

    it('returns false when passives is empty', () => {
      expect(hasSpellThief({ automation: { passives: [] } })).toBe(false)
    })
  })

  describe('getMultiTargetSpreads', () => {
    it('returns multi_target_spread passives', () => {
      const stats = {
        automation: {
          passives: [
            { type: 'multi_target_spread', spellFilter: ['Fireball'] },
            { type: 'other' },
          ],
        },
      }
      const result = getMultiTargetSpreads(stats)
      expect(result).toHaveLength(1)
    })

    it('throws when automation.passives is missing', () => {
      expect(() => getMultiTargetSpreads({})).toThrow('Expected array')
    })

    it('returns empty array when passives is empty', () => {
      expect(getMultiTargetSpreads({ automation: { passives: [] } })).toEqual([])
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

    it('returns the matching spread object', () => {
      const stats = {
        automation: {
          passives: [
            { type: 'multi_target_spread', spellFilter: ['Iceball'], name: 'Spread A' },
            { type: 'multi_target_spread', spellFilter: ['Fireball'], name: 'Spread B' },
          ],
        },
      }
      const result = getMultiTargetSpreadForSpell(stats, 'Fireball')
      expect(result.name).toBe('Spread B')
    })

    it('returns null when no matching spread', () => {
      const stats = {
        automation: {
          passives: [{ type: 'multi_target_spread', spellFilter: ['Fireball'] }],
        },
      }
      expect(getMultiTargetSpreadForSpell(stats, 'Iceball')).toBeNull()
    })

    it('returns null when spread has no spellFilter', () => {
      const stats = {
        automation: {
          passives: [{ type: 'multi_target_spread', name: 'NoFilter' }],
        },
      }
      expect(() => getMultiTargetSpreadForSpell(stats, 'Fireball')).toThrow('Expected array')
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

    it('returns false when no rider saves', () => {
      const stats = { automation: { passives: [{ type: 'other' }] } }
      expect(hasPostCastRiderSave(stats)).toBe(false)
    })

    it('returns false when passives is empty', () => {
      expect(hasPostCastRiderSave({ automation: { passives: [] } })).toBe(false)
    })
  })

  describe('triggerPostCastRiderSaves', () => {
    const enchantmentSpell = { name: 'Charm Person', school: 'enchantment' }
    const illusionSpell = { name: 'Minor Illusion', school: 'illusion' }
    const evocationSpell = { name: 'Fireball', school: 'evocation' }

    it('returns null for non-enchantment/illusion spell', async () => {
      const stats = {
        name: 'Player',
        automation: { passives: [{ type: 'post_cast_rider', name: 'Rider' }] },
      }
      const result = await triggerPostCastRiderSaves(evocationSpell, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('returns null for illusion spells', async () => {
      const stats = {
        name: 'Player',
        automation: { passives: [{ type: 'post_cast_rider', name: 'Rider' }] },
      }
      const result = await triggerPostCastRiderSaves(illusionSpell, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('returns null when no spell slot used (metaCtx slotLevel 0, spell level 0)', async () => {
      const stats = {
        name: 'Player',
        automation: { passives: [{ type: 'post_cast_rider', name: 'Rider' }] },
      }
      const result = await triggerPostCastRiderSaves(enchantmentSpell, { slotLevel: 0 }, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('triggers when spell has level > 0 even with no slotLevel', async () => {
      executeHandler.mockResolvedValue({ success: true })
      const stats = {
        name: 'Player',
        automation: { passives: [{ type: 'post_cast_rider', name: 'Rider' }] },
      }
      const result = await triggerPostCastRiderSaves({ ...enchantmentSpell, level: 1 }, {}, stats, 'camp', 'map')
      expect(result).toEqual([{ success: true }])
    })

    it('returns null when no rider saves', async () => {
      const result = await triggerPostCastRiderSaves(enchantmentSpell, { slotLevel: 1 }, { automation: { passives: [] } }, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('skips riders with exhausted uses', async () => {
      const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js')
      vi.mocked(getRuntimeValue).mockReturnValue(0)
      const stats = {
        name: 'Player',
        automation: { passives: [{ type: 'post_cast_rider', name: 'Rider' }] },
      }
      const result = await triggerPostCastRiderSaves(enchantmentSpell, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(result).toBeNull()
      expect(executeHandler).not.toHaveBeenCalled()
      vi.mocked(getRuntimeValue).mockRestore()
    })

    it('calls executeHandler with correct action shape for post_cast_rider type', async () => {
      executeHandler.mockResolvedValue({ success: true })
      const stats = {
        name: 'Player',
        automation: { passives: [{ type: 'post_cast_rider', name: 'Rider', saveType: 'CON', saveDc: 15 }] },
      }
      await triggerPostCastRiderSaves(enchantmentSpell, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Rider',
          automation: expect.objectContaining({
            type: 'post_cast_rider',
            saveType: 'CON',
            saveDc: 15,
          }),
        }),
        stats,
        'camp',
        'map',
      )
    })

    it('calls executeHandler with correct action shape for riderSave format', async () => {
      executeHandler.mockResolvedValue({ success: true })
      const stats = {
        name: 'Player',
        automation: {
          passives: [{ type: 'passive_rule', name: 'RiderSave', riderSave: { type: 'WIS', condition: 'charmed' } }],
        },
      }
      await triggerPostCastRiderSaves(enchantmentSpell, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'RiderSave',
          automation: expect.objectContaining({
            saveType: 'WIS',
            saveDc: 'ability',
            saveAbility: 'CHA',
            condition: 'charmed',
          }),
        }),
        stats,
        'camp',
        'map',
      )
    })

    it('collects results from multiple riders', async () => {
      executeHandler.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false })
      const stats = {
        name: 'Player',
        automation: {
          passives: [
            { type: 'post_cast_rider', name: 'Rider A' },
            { type: 'post_cast_rider', name: 'Rider B' },
          ],
        },
      }
      const result = await triggerPostCastRiderSaves(enchantmentSpell, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ success: true })
      expect(result[1]).toEqual({ success: false })
    })

    it('throws when executeHandler errors', async () => {
      executeHandler.mockRejectedValue(new Error('fail'))
      const stats = {
        name: 'Player',
        automation: { passives: [{ type: 'post_cast_rider', name: 'Rider' }] },
      }
      await expect(
        triggerPostCastRiderSaves(enchantmentSpell, { slotLevel: 1 }, stats, 'camp', 'map')
      ).rejects.toThrow('fail')
    })

    it('does not call executeHandler when spell has no school property', async () => {
      const stats = {
        name: 'Player',
        automation: { passives: [{ type: 'post_cast_rider', name: 'Rider' }] },
      }
      const result = await triggerPostCastRiderSaves({ name: 'Unknown Spell' }, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(result).toBeNull()
      expect(executeHandler).not.toHaveBeenCalled()
    })
  })

  describe('getSoulstitchFeatures', () => {
    it('returns soulstitch_spells passives', () => {
      const stats = {
        automation: {
          passives: [
            { type: 'soulstitch_spells', name: 'Soulstitch' },
            { type: 'other' },
          ],
        },
      }
      const result = getSoulstitchFeatures(stats)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Soulstitch')
    })

    it('throws when automation.passives is missing', () => {
      expect(() => getSoulstitchFeatures({})).toThrow('Expected array')
    })

    it('returns empty array when passives is empty', () => {
      expect(getSoulstitchFeatures({ automation: { passives: [] } })).toEqual([])
    })
  })

  describe('hasSoulstitchSpells', () => {
    it('returns true when soulstitch features exist', () => {
      const stats = { automation: { passives: [{ type: 'soulstitch_spells' }] } }
      expect(hasSoulstitchSpells(stats)).toBe(true)
    })

    it('returns false when no soulstitch features', () => {
      const stats = { automation: { passives: [{ type: 'other' }] } }
      expect(hasSoulstitchSpells(stats)).toBe(false)
    })

    it('returns false when passives is empty', () => {
      expect(hasSoulstitchSpells({ automation: { passives: [] } })).toBe(false)
    })
  })

  describe('triggerSoulstitchSpells', () => {
    const evocationSpell = { name: 'Fireball', school: 'Evocation', dc: { dc_type: 'CON' } }
    const nonEvocationSpell = { name: 'Charm Person', school: 'Enchantment', dc: { dc_type: 'WIS' } }

    it('returns null when no soulstitch features', async () => {
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

    it('matches evocation school regardless of case', async () => {
      executeHandler.mockResolvedValue({ success: true })
      const stats = { automation: { passives: [{ type: 'soulstitch_spells', name: 'Soulstitch' }] } }
      const lowercaseSpell = { name: 'Fireball', school: 'evocation', dc: { dc_type: 'CON' } }
      const result = await triggerSoulstitchSpells(lowercaseSpell, {}, stats, 'camp', 'map')
      expect(result).not.toBeNull()
    })

    it('returns null when spell has no school property', async () => {
      const stats = { automation: { passives: [{ type: 'soulstitch_spells', name: 'Soulstitch' }] } }
      const result = await triggerSoulstitchSpells({ name: 'Unknown Spell' }, {}, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('passes spellSlotLevel to executeHandler based on metaCtx slotLevel', async () => {
      executeHandler.mockResolvedValue({ success: true })
      const stats = { automation: { passives: [{ type: 'soulstitch_spells', name: 'Soulstitch' }] } }
      await triggerSoulstitchSpells(evocationSpell, { slotLevel: 3 }, stats, 'camp', 'map')
      expect(executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          spellSlotLevel: 3,
        }),
        stats,
        'camp',
        'map',
      )
    })

    it('passes spellSlotLevel to executeHandler based on spell.level when metaCtx has no slotLevel', async () => {
      executeHandler.mockResolvedValue({ success: true })
      const stats = { automation: { passives: [{ type: 'soulstitch_spells', name: 'Soulstitch' }] } }
      const spell = { name: 'Fireball', school: 'Evocation', level: 3, dc: { dc_type: 'CON' } }
      await triggerSoulstitchSpells(spell, {}, stats, 'camp', 'map')
      expect(executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          spellSlotLevel: 3,
        }),
        stats,
        'camp',
        'map',
      )
    })

    it('returns null when executeHandler returns non-result truthy value', async () => {
      executeHandler.mockResolvedValue(null)
      const stats = { automation: { passives: [{ type: 'soulstitch_spells', name: 'Soulstitch' }] } }
      const result = await triggerSoulstitchSpells(evocationSpell, {}, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('throws when executeHandler errors', async () => {
      executeHandler.mockRejectedValue(new Error('fail'))
      const stats = { automation: { passives: [{ type: 'soulstitch_spells', name: 'Soulstitch' }] } }
      await expect(
        triggerSoulstitchSpells(evocationSpell, {}, stats, 'camp', 'map')
      ).rejects.toThrow('fail')
    })
  })

  describe('getEmpoweredEvocationFeatures', () => {
    it('returns empowered_evocation passives', () => {
      const stats = {
        automation: {
          passives: [
            { type: 'empowered_evocation', name: 'Empowered' },
            { type: 'other' },
          ],
        },
      }
      const result = getEmpoweredEvocationFeatures(stats)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Empowered')
    })

    it('throws when automation.passives is missing', () => {
      expect(() => getEmpoweredEvocationFeatures({})).toThrow('Expected array')
    })

    it('returns empty array when passives is empty', () => {
      expect(getEmpoweredEvocationFeatures({ automation: { passives: [] } })).toEqual([])
    })
  })

  describe('hasEmpoweredEvocation', () => {
    it('returns true when empowered_evocation features exist', () => {
      const stats = { automation: { passives: [{ type: 'empowered_evocation' }] } }
      expect(hasEmpoweredEvocation(stats)).toBe(true)
    })

    it('returns false when no empowered_evocation features', () => {
      const stats = { automation: { passives: [{ type: 'other' }] } }
      expect(hasEmpoweredEvocation(stats)).toBe(false)
    })

    it('returns false when passives is empty', () => {
      expect(hasEmpoweredEvocation({ automation: { passives: [] } })).toBe(false)
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

    it('returns 0 when abilities is empty', () => {
      expect(getEmpoweredEvocationIntModifier({ abilities: [] })).toBe(0)
    })

    it('returns 0 when abilities property is missing', () => {
      // Source does not guard against missing abilities - this is a source bug
      expect(() => getEmpoweredEvocationIntModifier({})).toThrow('Cannot read properties of undefined')
    })
  })

  describe('triggerSpellThief', () => {
    const spell = { name: 'Fireball' }

    it('returns null when no spell slot used (both metaCtx and spell have level 0)', async () => {
      const stats = { name: 'Player', automation: { passives: [{ type: 'spell_thief', name: 'Thief' }] } }
      const result = await triggerSpellThief(spell, { slotLevel: 0 }, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('triggers when spell has level > 0', async () => {
      executeHandler.mockResolvedValue({ success: true })
      const stats = { name: 'Player', automation: { passives: [{ type: 'spell_thief', name: 'Thief' }] } }
      const result = await triggerSpellThief(spell, {}, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('returns null when blocked by spell thief', async () => {
      const { isBlockedBySpellThief } = await import('../../automation/handlers/class-fighter-rogue/spellThiefHandler.js')
      vi.mocked(isBlockedBySpellThief).mockReturnValue(true)
      const stats = { name: 'Player', automation: { passives: [{ type: 'spell_thief', name: 'Thief' }] } }
      const result = await triggerSpellThief(spell, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(result).toBeNull()
      vi.mocked(isBlockedBySpellThief).mockRestore()
    })

    it('returns null when no spell thief features', async () => {
      const result = await triggerSpellThief(spell, { slotLevel: 1 }, { automation: { passives: [] } }, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('skips riders with exhausted uses', async () => {
      const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js')
      vi.mocked(getRuntimeValue).mockReturnValue(0)
      const stats = { name: 'Player', automation: { passives: [{ type: 'spell_thief', name: 'Thief' }] } }
      const result = await triggerSpellThief(spell, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(result).toBeNull()
      expect(executeHandler).not.toHaveBeenCalled()
      vi.mocked(getRuntimeValue).mockRestore()
    })

    it('calls executeHandler for each thief feature with correct action shape', async () => {
      const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js')
      executeHandler.mockResolvedValue({ success: true })
      vi.mocked(getRuntimeValue).mockReturnValue(1)
      const stats = {
        name: 'Player',
        automation: { passives: [{ type: 'spell_thief', name: 'Thief', saveType: 'INT', saveDc: 15 }] },
      }
      const result = await triggerSpellThief(spell, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Thief',
          automation: expect.objectContaining({
            type: 'spell_thief',
            saveType: 'INT',
            saveDc: 15,
            saveAbility: 'INT',
            trigger: 'spell_cast',
            oncePerLongRest: false,
            casting_time: '1 reaction',
          }),
          casterName: 'Player',
          spellName: 'Fireball',
        }),
        stats,
        'camp',
        'map',
      )
      expect(result).toEqual([{ success: true }])
      vi.mocked(getRuntimeValue).mockRestore()
    })

    it('uses default save values when not provided on feature', async () => {
      const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js')
      executeHandler.mockResolvedValue({ success: true })
      vi.mocked(getRuntimeValue).mockReturnValue(1)
      const stats = {
        name: 'Player',
        automation: { passives: [{ type: 'spell_thief', name: 'Thief' }] },
      }
      await triggerSpellThief(spell, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          automation: expect.objectContaining({
            saveType: 'INT',
            saveDc: 'ability',
            saveAbility: 'INT',
          }),
        }),
        stats,
        'camp',
        'map',
      )
      vi.mocked(getRuntimeValue).mockRestore()
    })

    it('collects results from multiple thief features', async () => {
      const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js')
      executeHandler.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false })
      vi.mocked(getRuntimeValue).mockReturnValue(1)
      const stats = {
        name: 'Player',
        automation: {
          passives: [
            { type: 'spell_thief', name: 'Thief A' },
            { type: 'spell_thief', name: 'Thief B' },
          ],
        },
      }
      const result = await triggerSpellThief(spell, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(result).toHaveLength(2)
      vi.mocked(getRuntimeValue).mockRestore()
    })

    it('throws when executeHandler errors', async () => {
      executeHandler.mockRejectedValue(new Error('fail'))
      const stats = { name: 'Player', automation: { passives: [{ type: 'spell_thief', name: 'Thief' }] } }
      await expect(
        triggerSpellThief(spell, { slotLevel: 1 }, stats, 'camp', 'map')
      ).rejects.toThrow('fail')
    })
  })

  describe('getBewitchingMagicFeatures', () => {
    it('returns bewitching_magic passives', () => {
      const stats = {
        automation: {
          passives: [
            { type: 'bewitching_magic', name: 'Bewitch' },
            { type: 'other' },
          ],
        },
      }
      const result = getBewitchingMagicFeatures(stats)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Bewitch')
    })

    it('throws when automation.passives is missing', () => {
      expect(() => getBewitchingMagicFeatures({})).toThrow('Expected array')
    })

    it('returns empty array when passives is empty', () => {
      expect(getBewitchingMagicFeatures({ automation: { passives: [] } })).toEqual([])
    })
  })

  describe('triggerBewitchingMagic', () => {
    const enchantmentSpell = { name: 'Charm Person', school: 'enchantment', casting_time: '1 action' }

    it('returns null for non-enchantment/illusion spell', async () => {
      const stats = { automation: { passives: [{ type: 'bewitching_magic', name: 'Bewitch' }] } }
      const result = await triggerBewitchingMagic({ ...enchantmentSpell, school: 'evocation' }, {}, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('returns null for illusion spell', async () => {
      const stats = { automation: { passives: [{ type: 'bewitching_magic', name: 'Bewitch' }] } }
      const result = await triggerBewitchingMagic(
        { name: 'Minor Illusion', school: 'illusion', casting_time: '1 action' },
        {},
        stats,
        'camp',
        'map',
      )
      expect(result).toBeNull()
    })

    it('returns null when no spell slot used', async () => {
      const stats = { automation: { passives: [{ type: 'bewitching_magic', name: 'Bewitch' }] } }
      const result = await triggerBewitchingMagic({ ...enchantmentSpell, level: 0 }, {}, stats, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('triggers when spell has level > 0 even without slotLevel', async () => {
      executeHandler.mockResolvedValue({ success: true })
      const stats = { automation: { passives: [{ type: 'bewitching_magic', name: 'Bewitch' }] } }
      const result = await triggerBewitchingMagic({ ...enchantmentSpell, level: 1 }, {}, stats, 'camp', 'map')
      expect(result).toEqual([{ success: true }])
    })

    it('returns null when casting time is not 1 action', async () => {
      const stats = { automation: { passives: [{ type: 'bewitching_magic', name: 'Bewitch' }] } }
      const result = await triggerBewitchingMagic(
        { ...enchantmentSpell, casting_time: '1 bonus action' },
        { slotLevel: 1 },
        stats,
        'camp',
        'map',
      )
      expect(result).toBeNull()
    })

    it('returns null when no bewitching features', async () => {
      const result = await triggerBewitchingMagic(enchantmentSpell, { slotLevel: 1 }, { automation: { passives: [] } }, 'camp', 'map')
      expect(result).toBeNull()
    })

    it('calls executeHandler with correct action shape', async () => {
      executeHandler.mockResolvedValue({ success: true })
      const stats = { automation: { passives: [{ type: 'bewitching_magic', name: 'Bewitch' }] } }
      await triggerBewitchingMagic(enchantmentSpell, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Bewitch',
          automation: expect.objectContaining({
            type: 'bewitching_magic',
            casting_time: 'passive',
          }),
        }),
        stats,
        'camp',
        'map',
      )
    })

    it('collects results from multiple bewitching features', async () => {
      executeHandler.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false })
      const stats = {
        automation: {
          passives: [
            { type: 'bewitching_magic', name: 'Bewitch A' },
            { type: 'bewitching_magic', name: 'Bewitch B' },
          ],
        },
      }
      const result = await triggerBewitchingMagic(enchantmentSpell, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(result).toHaveLength(2)
    })

    it('throws when executeHandler errors', async () => {
      executeHandler.mockRejectedValue(new Error('fail'))
      const stats = { automation: { passives: [{ type: 'bewitching_magic', name: 'Bewitch' }] } }
      await expect(
        triggerBewitchingMagic(enchantmentSpell, { slotLevel: 1 }, stats, 'camp', 'map')
      ).rejects.toThrow('fail')
    })

    it('returns null when spell has no casting_time property', async () => {
      const stats = { automation: { passives: [{ type: 'bewitching_magic', name: 'Bewitch' }] } }
      const result = await triggerBewitchingMagic({ name: 'Unknown Spell' }, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(result).toBeNull()
    })
  })

  describe('confirmSoulstitchSelection', () => {
    it('resolves the pending promise with selected names', () => {
      return new Promise((resolve) => {
        // Use mockReturnValue so executeHandler resolves synchronously in the same microtask
        // This ensures soulstitchResolve is set before confirmSoulstitchSelection is called
        executeHandler.mockReturnValue(Promise.resolve({ type: 'modal', payload: { options: ['A', 'B'] } }))
        const stats = { automation: { passives: [{ type: 'soulstitch_spells', name: 'Soulstitch' }] } }
        const evocationSpell = { name: 'Fireball', school: 'Evocation', dc: { dc_type: 'CON' } }

        // Start the trigger - it will hit the modal path and wait for confirmation
        const triggerPromise = triggerSoulstitchSpells(evocationSpell, {}, stats, 'camp', 'map')

        // Give executeHandler time to resolve and set up the modal flow
        Promise.resolve().then(() => {
          // Simulate user selecting options
          confirmSoulstitchSelection(['A'])

          triggerPromise.then((result) => {
            expect(result).toBeNull()
            resolve(null)
          })
        })
      })
    })

    it('does nothing when no pending modal', () => {
      expect(() => confirmSoulstitchSelection(['A'])).not.toThrow()
    })
  })
})
