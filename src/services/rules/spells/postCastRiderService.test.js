// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeHandler } from '../../automation/index.js'
import {
  getPostCastRiderSaves,
  getSpellThiefFeatures,

  getMultiTargetSpreads,
  getMultiTargetSpreadForSpell,

  triggerPostCastRiderSaves,
  getSoulstitchFeatures,

  triggerSoulstitchSpells,
  getEmpoweredEvocationFeatures,

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
  })

  describe('getSpellThiefFeatures', () => {
    it('returns spell_thief reactions', () => {
      const stats = {
        automation: {
          reactions: [
            { type: 'spell_thief', name: 'Thief' },
            { type: 'other', name: 'Other' },
          ],
        },
      }
      const result = getSpellThiefFeatures(stats)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Thief')
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

    it('throws when spread has no spellFilter', () => {
      const stats = {
        automation: {
          passives: [{ type: 'multi_target_spread', name: 'NoFilter' }],
        },
      }
      expect(() => getMultiTargetSpreadForSpell(stats, 'Fireball')).toThrow('Expected array')
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
      const result = await triggerPostCastRiderSaves(evocationSpell, { slotLevel: 1 }, stats, 'camp', 'map')
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
  })

  describe('triggerSpellThief', () => {
    const spell = { name: 'Fireball' }

    // CLA-325: the auto-path ran inside the caster's own cast context, forcing the
    // thief to save against their own DC and steal from themselves (self-misfire).
    // It is inert by design — the manual Reactions row drives the feature.
    it('never fires in the casters own cast context (self-misfire removed, CLA-325)', async () => {
      const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js')
      vi.mocked(getRuntimeValue).mockReturnValue(1)
      const stats = { name: 'Player', automation: { reactions: [{ type: 'spell_thief', name: 'Spell Thief' }] } }
      const result = await triggerSpellThief(spell, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(result).toBeNull()
      expect(executeHandler).not.toHaveBeenCalled()
      vi.mocked(getRuntimeValue).mockRestore()
    })

    it('returns null when caster has no spell thief features', async () => {
      const result = await triggerSpellThief(spell, { slotLevel: 1 }, { automation: { reactions: [] } }, 'camp', 'map')
      expect(result).toBeNull()
      expect(executeHandler).not.toHaveBeenCalled()
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
  })

  describe('triggerBewitchingMagic', () => {
    const enchantmentSpell = { name: 'Charm Person', school: 'enchantment', casting_time: '1 action' }

    it('returns null for non-enchantment/illusion spell', async () => {
      const stats = { automation: { passives: [{ type: 'bewitching_magic', name: 'Bewitch' }] } }
      const result = await triggerBewitchingMagic({ ...enchantmentSpell, school: 'evocation' }, {}, stats, 'camp', 'map')
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

    it('returns null when spell has no casting_time property', async () => {
      const stats = { automation: { passives: [{ type: 'bewitching_magic', name: 'Bewitch' }] } }
      const result = await triggerBewitchingMagic({ name: 'Unknown Spell' }, { slotLevel: 1 }, stats, 'camp', 'map')
      expect(result).toBeNull()
    })
  })

  describe('confirmSoulstitchSelection', () => {
    it('resolves the pending promise and the trigger returns the applied selection', () => {
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
            // CLA-321: trigger forwards the selection so savePath can flag the cast;
            // the modal is the single writer of the stamp (deduped apply).
            expect(result).toEqual(['A'])
            resolve(null)
          })
        })
      })
    })

    it('CLA-321: cancel (empty selection) resolves the trigger with no selection (no deadlock)', () => {
      return new Promise((resolve) => {
        executeHandler.mockReturnValue(Promise.resolve({ type: 'modal', payload: { options: ['A', 'B'] } }))
        const stats = { automation: { passives: [{ type: 'soulstitch_spells', name: 'Soulstitch' }] } }
        const evocationSpell = { name: 'Fireball', school: 'Evocation', dc: { dc_type: 'CON' } }

        const triggerPromise = triggerSoulstitchSpells(evocationSpell, {}, stats, 'camp', 'map')

        Promise.resolve().then(() => {
          confirmSoulstitchSelection([])

          triggerPromise.then((result) => {
            expect(result).toEqual([])
            resolve(null)
          })
        })
      })
    })

  })
})
