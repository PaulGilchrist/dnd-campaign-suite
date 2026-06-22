import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  METAMAGIC_EFFECTS,
  METAMAGIC_OPTIONS,
  getMetamagicCost,
  getPreCastOptions,
  getChaModifier,
  getMaxMetamagicPerSpell,
  isPreCastOption,
  hasArcaneApotheosis,
  computeMetamagicCost,
  getPsionicSpellsList,
  isPsionicSpell,
  hasPsionicSorcery,
} from './metamagicRules.js'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
}))

vi.mock('../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn((abilities, name) => {
    const ability = abilities?.find((a) => a.name === name)
    return ability?.bonus || 0
  }),
}))

describe('metamagicRules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('METAMAGIC_EFFECTS', () => {
    it('defines all expected effect keys', () => {
      expect(METAMAGIC_EFFECTS.CAREFUL).toBe('ally_auto_succeed_save')
      expect(METAMAGIC_EFFECTS.DISTANT).toBe('double_range')
      expect(METAMAGIC_EFFECTS.EMPOWERED).toBe('reroll_damage_dice')
      expect(METAMAGIC_EFFECTS.EXTENDED).toBe('double_duration')
      expect(METAMAGIC_EFFECTS.HEIGHTENED).toBe('disadvantage_on_save')
      expect(METAMAGIC_EFFECTS.QUICKENED).toBe('cast_spell_as_bonus_action')
      expect(METAMAGIC_EFFECTS.SUBTLE).toBe('no_verbal_somatic')
      expect(METAMAGIC_EFFECTS.TWINNED).toBe('target_two_creatures')
    })
  })

  describe('METAMAGIC_OPTIONS', () => {
    it('has 8 metamagic options', () => {
      expect(METAMAGIC_OPTIONS).toHaveLength(8)
    })

    it('has correct cost for Twinned Spell', () => {
      const twinned = METAMAGIC_OPTIONS.find((o) => o.name === 'Twinned Spell')
      expect(twinned.cost).toBe('spell_level')
    })

    it('has correct cost for Heightened Spell', () => {
      const heightened = METAMAGIC_OPTIONS.find((o) => o.name === 'Heightened Spell')
      expect(heightened.cost).toBe(3)
    })

    it('has correct cost for Quickened Spell', () => {
      const quickened = METAMAGIC_OPTIONS.find((o) => o.name === 'Quickened Spell')
      expect(quickened.cost).toBe(2)
    })
  })

  describe('getMetamagicCost', () => {
    it('returns fixed cost for non-spell_level options', () => {
      const option = { cost: 1 }
      expect(getMetamagicCost(option, 5)).toBe(1)
    })

    it('returns spell level for spell_level cost', () => {
      const option = { cost: 'spell_level' }
      expect(getMetamagicCost(option, 3)).toBe(3)
    })

    it('returns max(1, spellLevel) for spell_level cost when spellLevel is 0', () => {
      const option = { cost: 'spell_level' }
      expect(getMetamagicCost(option, 0)).toBe(1)
    })
  })

  describe('getPreCastOptions', () => {
    it('returns empty array for non-Sorcerer', () => {
      expect(getPreCastOptions({ class: { name: 'Wizard' } }, 10, 1)).toEqual([])
    })

    it('returns empty array when stats is null', () => {
      expect(getPreCastOptions(null, 10, 1)).toEqual([])
    })

    it('returns pre-cast options for Sorcerer', () => {
      const stats = { class: { name: 'Sorcerer' } }
      const result = getPreCastOptions(stats, 10, 1)
      expect(result.length).toBeGreaterThan(0)
      expect(result[0].affordable).toBe(true)
    })

    it('marks options as unaffordable when not enough SP', () => {
      const stats = { class: { name: 'Sorcerer' } }
      const result = getPreCastOptions(stats, 0, 1)
      result.forEach((opt) => {
        expect(opt.affordable).toBe(false)
      })
    })

    it('includes resolvedCost in each option', () => {
      const stats = { class: { name: 'Sorcerer' } }
      const result = getPreCastOptions(stats, 10, 3)
      result.forEach((opt) => {
        expect(opt).toHaveProperty('resolvedCost')
      })
    })
  })

  describe('getChaModifier', () => {
    it('returns 0 when abilities is missing', () => {
      expect(getChaModifier({})).toBe(0)
    })

    it('returns 0 when Charisma ability is missing', () => {
      expect(getChaModifier({ abilities: [{ name: 'Strength', bonus: 3 }] })).toBe(0)
    })

    it('returns the Charisma modifier', () => {
      const stats = { abilities: [{ name: 'Charisma', bonus: 3 }] }
      expect(getChaModifier(stats)).toBe(3)
    })

    it('returns 0 when Charisma bonus is negative (clamped by Math.max)', () => {
      const stats = { abilities: [{ name: 'Charisma', bonus: -3 }] }
      expect(getChaModifier(stats)).toBe(0)
    })
  })

  describe('getMaxMetamagicPerSpell', () => {
    it('returns 1 for 5e ruleset', () => {
      expect(getMaxMetamagicPerSpell({ rules: '5e', level: 10 }, 'player')).toBe(1)
    })

    it('returns 1 for 2024 ruleset below level 6', () => {
      expect(getMaxMetamagicPerSpell({ rules: '2024', level: 5 }, 'player')).toBe(1)
    })

    it('returns 1 for 2024 ruleset at level 6 with no Innate Sorcery buff', async () => {
      const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js')
      vi.mocked(getRuntimeValue).mockReturnValue([])
      expect(getMaxMetamagicPerSpell({ rules: '2024', level: 6 }, 'player')).toBe(1)
      vi.mocked(getRuntimeValue).mockRestore()
    })

    it('returns 2 for 2024 ruleset at level 6 with Innate Sorcery buff', async () => {
      const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js')
      vi.mocked(getRuntimeValue).mockReturnValue([{ name: 'Innate Sorcery' }])
      expect(getMaxMetamagicPerSpell({ rules: '2024', level: 6 }, 'player')).toBe(2)
      vi.mocked(getRuntimeValue).mockRestore()
    })
  })

  describe('isPreCastOption', () => {
    it('returns true for non-empowered options', () => {
      expect(isPreCastOption({ effect: 'double_range' })).toBe(true)
    })

    it('returns false for empowered option', () => {
      expect(isPreCastOption({ effect: 'reroll_damage_dice' })).toBe(false)
    })
  })

  describe('hasArcaneApotheosis', () => {
    it('returns false when no passives', () => {
      expect(hasArcaneApotheosis({}, 'player')).toBe(false)
    })

    it('returns false when Arcane Apotheosis not present', () => {
      const stats = { automation: { passives: [{ name: 'Other' }] } }
      expect(hasArcaneApotheosis(stats, 'player')).toBe(false)
    })

    it('returns false when Arcane Apotheosis present but no Innate Sorcery buff', async () => {
      const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js')
      vi.mocked(getRuntimeValue).mockReturnValue([])
      const stats = { automation: { passives: [{ name: 'Arcane Apotheosis' }] } }
      expect(hasArcaneApotheosis(stats, 'player')).toBe(false)
      vi.mocked(getRuntimeValue).mockRestore()
    })

    it('returns true when Arcane Apotheosis and Innate Sorcery buff present', async () => {
      const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js')
      vi.mocked(getRuntimeValue).mockReturnValue([{ name: 'Innate Sorcery' }])
      const stats = { automation: { passives: [{ name: 'Arcane Apotheosis' }] } }
      expect(hasArcaneApotheosis(stats, 'player')).toBe(true)
      vi.mocked(getRuntimeValue).mockRestore()
    })
  })

  describe('computeMetamagicCost', () => {
    it('returns zero cost for empty selection', () => {
      expect(computeMetamagicCost([], [], {}, 'player')).toEqual({ totalCost: 0, waivedName: null })
    })

    it('returns total cost without waiver when no Arcane Apotheosis', () => {
      const options = [{ name: 'Careful Spell', resolvedCost: 1 }, { name: 'Distant Spell', resolvedCost: 1 }]
      expect(computeMetamagicCost(['Careful Spell', 'Distant Spell'], options, {}, 'player')).toEqual({
        totalCost: 2,
        waivedName: null,
      })
    })

    it('waives highest cost option when Arcane Apotheosis active', async () => {
      const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js')
      vi.mocked(getRuntimeValue).mockReturnValue([{ name: 'Innate Sorcery' }])
      const options = [{ name: 'Careful Spell', resolvedCost: 1 }, { name: 'Heightened Spell', resolvedCost: 3 }]
      const stats = { automation: { passives: [{ name: 'Arcane Apotheosis' }] } }
      const result = computeMetamagicCost(['Careful Spell', 'Heightened Spell'], options, stats, 'player')
      expect(result.totalCost).toBe(1)
      expect(result.waivedName).toBe('Heightened Spell')
      vi.mocked(getRuntimeValue).mockRestore()
    })
  })

  describe('getPsionicSpellsList', () => {
    it('returns psionic spells list when found', () => {
      const stats = {
        automation: {
          passives: [{ type: 'psionic_spells_list', psionicSpells: ['Bolt', 'Shield'] }],
        },
      }
      expect(getPsionicSpellsList(stats)).toEqual(['Bolt', 'Shield'])
    })

    it('returns empty array when not found', () => {
      const stats = { automation: { passives: [] } }
      expect(getPsionicSpellsList(stats)).toEqual([])
    })
  })

  describe('isPsionicSpell', () => {
    it('returns false for null spell name', () => {
      expect(isPsionicSpell({}, null)).toBe(false)
    })

    it('returns true when spell is in psionic list', () => {
      const stats = {
        automation: {
          passives: [{ type: 'psionic_spells_list', psionicSpells: ['Bolt'] }],
        },
      }
      expect(isPsionicSpell(stats, 'Bolt')).toBe(true)
    })

    it('returns false when spell is not in psionic list', () => {
      const stats = {
        automation: {
          passives: [{ type: 'psionic_spells_list', psionicSpells: ['Bolt'] }],
        },
      }
      expect(isPsionicSpell(stats, 'Fireball')).toBe(false)
    })
  })

  describe('hasPsionicSorcery', () => {
    it('returns true when psionic_sorcery passive exists', () => {
      const stats = { automation: { passives: [{ type: 'psionic_sorcery' }] } }
      expect(hasPsionicSorcery(stats)).toBe(true)
    })

    it('returns false when no psionic_sorcery passive', () => {
      const stats = { automation: { passives: [{ type: 'other' }] } }
      expect(hasPsionicSorcery(stats)).toBe(false)
    })

    it('returns false when no passives', () => {
      const stats = { automation: { passives: [] } }
      expect(hasPsionicSorcery(stats)).toBe(false)
    })
  })
})
