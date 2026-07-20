// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getHitDieSize,
  getShortRestResourceLabels,
  computeHitDieRecovery,
  computeShortRestHpNewCurrent,
  applyShortRest,
  applyLongRest,
} from './restRules.js'

// Mock dependencies
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_name, key, _campaign) => {
    if (key === 'bastionOfLawWardTarget') return 'WardTarget';
    return undefined;
  }),
  setRuntimeBatch: vi.fn(),
  setRuntimeValue: vi.fn(),
}))

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 10),
}))

vi.mock('./expirations.js', () => ({
  clearAllExpirationEffects: vi.fn(),
}))

vi.mock('../../combat/conditions/exhaustionRules.js', () => ({
  getLevelAfterLongRest: vi.fn((level) => Math.max(0, level - 1)),
}))

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}))

// Import mocked functions for per-test customization
import { getRuntimeValue, setRuntimeBatch, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { clearAllExpirationEffects } from './expirations.js'
import { rollD20 } from '../../../services/dice/diceRoller.js'
import { addEntry } from '../../../services/ui/logService.js'

const CAMPAIGN = 'test-campaign'

function makeStats(overrides = {}) {
  return {
    name: 'Test Hero',
    hitPoints: 50,
    level: 5,
    proficiency: 3,
    class: { name: 'Fighter', hit_point_die: 'd10', class_levels: [{ level: 5, second_wind: 1 }] },
    abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Charisma', bonus: 2 }],
    ...overrides,
  }
}

function getBatchUpdates() {
  return vi.mocked(setRuntimeBatch).mock.calls[0][1]
}

describe('restRules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
      if (key === 'bastionOfLawWardTarget') return 'WardTarget';
      return undefined;
    })
  })

  describe('getHitDieSize', () => {
    it('returns the parsed die size from hit_point_die or hit_die', () => {
      expect(getHitDieSize({ class: { hit_point_die: 'd12' } })).toBe(12)
      expect(getHitDieSize({ class: { hit_die: 'd8' } })).toBe(8)
      expect(getHitDieSize({ class: { hit_point_die: 'd10-extra' } })).toBe(10)
    })

    it('returns 8 as default when playerStats, class, or hit_point_die is missing or falsy', () => {
      expect(getHitDieSize(null)).toBe(8)
      expect(getHitDieSize({})).toBe(8)
      expect(getHitDieSize({ class: { hit_point_die: null } })).toBe(8)
      expect(getHitDieSize({ class: { hit_point_die: '' } })).toBe(8)
    })
  })

  describe('getShortRestResourceLabels', () => {
    it('returns class-specific resource labels', () => {
      expect(getShortRestResourceLabels({ class: { name: 'Cleric' } })).toContain('Channel Divinity')
      expect(getShortRestResourceLabels({ class: { name: 'Druid' } })).toContain('Wild Shape')
      expect(getShortRestResourceLabels({ class: { name: 'Monk' } })).toContain('Focus Points')
      expect(getShortRestResourceLabels({ class: { name: 'Rogue' } })).toEqual([])
    })

    it('returns Fighter resources and respects subclass matching', () => {
      const fighterLabels = getShortRestResourceLabels({ class: { name: 'Fighter' } })
      expect(fighterLabels).toContain('Second Wind')
      expect(fighterLabels).toContain('Action Surge')
      expect(fighterLabels).not.toContain('Psionic Energy')
      expect(fighterLabels).not.toContain('Superiority Dice')

      const psiLabels = getShortRestResourceLabels({ class: { name: 'Fighter', subclass: { name: 'Psi Warrior' } } })
      expect(psiLabels).toContain('Psionic Energy')

      const battleLabels = getShortRestResourceLabels({ class: { name: 'Fighter', subclass: { name: 'Battle Master' } } })
      expect(battleLabels).toContain('Superiority Dice')
    })

    it('uses major.name as fallback for subclass matching', () => {
      const labels = getShortRestResourceLabels({
        class: { name: 'Druid', major: { name: 'Circle of the Land' } },
      })
      expect(labels).toContain('Natural Recovery (Spell Slots)')
    })

    it('returns empty array when class is missing', () => {
      expect(getShortRestResourceLabels({})).toEqual([])
    })
  })

  describe('computeHitDieRecovery', () => {
    it('returns roll + conBonus when positive, minimum 1', () => {
      expect(computeHitDieRecovery(5, 3)).toBe(8)
      expect(computeHitDieRecovery(1, -5)).toBe(1)
      expect(computeHitDieRecovery(0, 0)).toBe(1)
      expect(computeHitDieRecovery(5, -2)).toBe(3)
    })
  })

  describe('computeShortRestHpNewCurrent', () => {
    it('adds recovered amount to currentHp capped at maxHp', () => {
      expect(computeShortRestHpNewCurrent(10, 20, 5)).toBe(15)
      expect(computeShortRestHpNewCurrent(18, 20, 5)).toBe(20)
    })

    it('uses maxHp as base when currentHp is null or empty string', () => {
      expect(computeShortRestHpNewCurrent(null, 20, 5)).toBe(20)
      expect(computeShortRestHpNewCurrent('', 20, 5)).toBe(20)
    })

    it('handles zero recovery', () => {
      expect(computeShortRestHpNewCurrent(null, 20, 0)).toBe(20)
      expect(computeShortRestHpNewCurrent(10, 20, 0)).toBe(10)
    })
  })

  describe('applyShortRest', () => {
    it('resets HP to max, nulls short rest resources, and clears buffs/conditions', async () => {
      const stats = makeStats()
      await applyShortRest(stats, CAMPAIGN)

      expect(setRuntimeBatch).toHaveBeenCalledWith('Test Hero', expect.any(Object), CAMPAIGN)
      expect(clearAllExpirationEffects).toHaveBeenCalledWith('Test Hero', CAMPAIGN)

      const updates = getBatchUpdates()
      expect(updates.currentHitPoints).toBe(50)
      expect(updates.channelDivinityCharges).toBeNull()
      expect(updates.focusPoints).toBeNull()
      expect(updates.kiPoints).toBeNull()
      expect(updates.actionsurgeUses).toBeNull()
      expect(updates.actionSurgeUses).toBeNull()
      expect(updates.actionSurgeUsedThisRound).toBeNull()
      expect(updates.activeBuffs).toEqual([])
      expect(updates.activeConditions).toEqual([])
    })

    it('recovers class features and spells on short rest', async () => {
      // Fighter Second Wind recovery
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'secondWindUses') return 0
        return undefined
      })
      const fighterStats = makeStats()
      await applyShortRest(fighterStats, CAMPAIGN)
      expect(getBatchUpdates().secondWindUses).toBe(1)

      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'secondWindUses') return 1
        return undefined
      })
      await applyShortRest(makeStats(), CAMPAIGN)
      expect(getBatchUpdates().secondWindUses).toBeUndefined()

      // Bardic Inspiration from Font of Inspiration
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'bardicInspirationUses') return 0
        return undefined
      })
      const bardStats = makeStats({
        class: { name: 'Bard' },
        automation: { passives: [{ type: 'font_of_inspiration' }] },
      })
      await applyShortRest(bardStats, CAMPAIGN)
      expect(getBatchUpdates().bardicInspirationUses).toBe(2)

      // Arcane Recovery
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_1') return 0
        return undefined
      })
      const wizardStats = makeStats({
        class: { name: 'Wizard' },
        level: 4,
        spellAbilities: {
          spell_slots_level_1: 4,
          spell_slots_level_2: 3,
        },
        automation: { passives: [{ type: 'resource_restoration', resourceKey: 'arcaneRecoveryLevels' }] },
      })
      await applyShortRest(wizardStats, CAMPAIGN)
      const wizardUpdates = getBatchUpdates()
      expect(wizardUpdates.spell_slots_level_1).toBe(2)
      expect(wizardUpdates.spell_slots_level_2).toBeUndefined()

      // Warlock Pact Magic
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_2') return 1
        return undefined
      })
      const warlockStats = makeStats({
        class: { name: 'Warlock' },
        spellAbilities: { spell_slots_level_2: 2 },
      })
      await applyShortRest(warlockStats, CAMPAIGN)
      expect(getBatchUpdates().spell_slots_level_2).toBe(2)

      // Warlock all slots
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_1') return 0
        if (key === 'spell_slots_level_2') return 0
        return undefined
      })
      const warlockAllStats = makeStats({
        class: { name: 'Warlock' },
        level: 5,
        spellAbilities: { spell_slots_level_1: 2, spell_slots_level_2: 3 },
      })
      await applyShortRest(warlockAllStats, CAMPAIGN)
      const warlockUpdates = getBatchUpdates()
      expect(warlockUpdates.spell_slots_level_1).toBe(2)
      expect(warlockUpdates.spell_slots_level_2).toBe(3)
    })

    it('resets per-feature tracking on short rest', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'SignatureSpells_selection') return ['Fireball', 'Counterspell']
        if (key === '_Divination_Savant_selection') return ['Detect Magic', 'See Invisibility']
        if (key === '_Evocation_Savant_selection') return ['Fireball']
        if (key === '_Illusion_Savant_selection') return ['Major Image']
        return undefined
      })
      const stats = makeStats({
        automation: {
          specialActions: [{ type: 'signature_spells' }],
          passives: [
            { type: 'passive_rule', effect: 'divination_savant' },
            { type: 'passive_rule', effect: 'evocation_savant' },
            { type: 'passive_rule', effect: 'illusion_savant' },
          ],
        },
      })
      await applyShortRest(stats, CAMPAIGN)

      const updates = getBatchUpdates()
      expect(updates.SignatureSpells_Fireball_used).toBeNull()
      expect(updates.SignatureSpells_Counterspell_used).toBeNull()
      expect(updates._Divination_Savant_Detect_Magic_used).toBeNull()
      expect(updates._Divination_Savant_See_Invisibility_used).toBeNull()
      expect(updates._Evocation_Savant_Fireball_used).toBeNull()
      expect(updates._Illusion_Savant_Major_Image_used).toBeNull()
    })

    it('grants feature-specific benefits on short rest', async () => {
      // Bolstering Treats is now user-choice in modal (not auto-applied)

      // Celestial Resilience temp HP
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'tempHp') return 5
        return undefined
      })
      const celestialStats = makeStats({
        class: { name: 'Warlock', subclass: { name: 'Celestial Patron' }, major: { name: 'Celestial Patron' } },
        level: 6,
        abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Charisma', bonus: 4 }],
        specialActions: [{ name: 'Celestial Resilience' }],
      })
      await applyShortRest(celestialStats, CAMPAIGN)
      expect(getBatchUpdates().tempHp).toBe(10)

      // Celestial Resilience logs ability_use on short rest
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'tempHp') return 5
        return undefined
      })
      await applyShortRest(celestialStats, CAMPAIGN)
      expect(addEntry).toHaveBeenCalledWith(
        CAMPAIGN,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'Test Hero',
          abilityName: 'Celestial Resilience',
          description: expect.stringContaining('10 temporary hit points'),
        }),
      )

      // Improved Warding Flare
      vi.clearAllMocks()
      const flareStats = makeStats({ specialActions: [{ name: 'Improved Warding Flare' }] })
      await applyShortRest(flareStats, CAMPAIGN)
      expect(getBatchUpdates().wardingflareUses).toBeNull()
    })

    it('throws when level is missing for Celestial Resilience and Arcane Recovery', async () => {
      const missingLevelStats = (_automation) => makeStats({
        class: { name: 'Warlock', subclass: { name: 'Celestial Patron' } },
        level: null,
        specialActions: [{ name: 'Celestial Resilience' }],
      })

      await expect(applyShortRest(missingLevelStats({}), CAMPAIGN)).rejects.toThrow('playerStats.level is required')
      await expect(applyShortRest(missingLevelStats({ passives: [{ type: 'resource_restoration', resourceKey: 'arcaneRecoveryLevels' }] }), CAMPAIGN)).rejects.toThrow('playerStats.level is required')
    })
  })

  describe('applyLongRest', () => {
    it('fully restores HP, spell slots, hit dice, and clears long rest resources', async () => {
      const stats = makeStats({
        spellAbilities: {
          spell_slots_level_1: 4,
          spell_slots_level_2: 3,
          spell_slots_level_3: 3,
        },
      })
      await applyLongRest(stats, CAMPAIGN)

      expect(setRuntimeBatch).toHaveBeenCalledWith('Test Hero', expect.any(Object), CAMPAIGN)
      expect(clearAllExpirationEffects).toHaveBeenCalledWith('Test Hero', CAMPAIGN)

      const data = getBatchUpdates()
      expect(data.currentHitPoints).toBe(50)
      expect(data.tempHp).toBeNull()
      expect(data.shortRestHitDice).toBe(5)
      expect(data.spell_slots_level_1).toBe(4)
      expect(data.spell_slots_level_2).toBe(3)
      expect(data.spell_slots_level_3).toBe(3)
      expect(data.channelDivinityCharges).toBeNull()
      expect(data.focusPoints).toBeNull()
      expect(data.ragePoints).toBeNull()
      expect(data.sorceryPoints).toBeNull()
      expect(data.activeBuffs).toEqual([])
      expect(data.activeConditions).toEqual([])
    })

    it('restores hit dice equal to character level', async () => {
      const stats = makeStats({ level: 15 })
      await applyLongRest(stats, CAMPAIGN)
      expect(getBatchUpdates().shortRestHitDice).toBe(15)
    })

    it('reduces exhaustion level by 1 on long rest', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'exhaustionLevel') return 2
        return undefined
      })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)
      expect(getBatchUpdates().exhaustionLevel).toBe(1)
    })

    it('does not modify exhaustion when level is 0 or undefined', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'exhaustionLevel') return 0
        return undefined
      })
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(getBatchUpdates().exhaustionLevel).toBeUndefined()

      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, _key) => undefined)
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(getBatchUpdates().exhaustionLevel).toBeUndefined()
    })

    it('grants feature-specific benefits on long rest', async () => {
      // Heroic Inspiration from Resourceful
      const stats1 = makeStats({ specialActions: [{ name: 'Resourceful' }] })
      await applyLongRest(stats1, CAMPAIGN)
      expect(getBatchUpdates().hasInspiration).toBe(true)

      // Chef Bolstering Treats
      vi.clearAllMocks()
      const chefStats = makeStats({
        proficiency: 4,
        automation: { passives: [{ type: 'temp_hp_buff', name: 'Bolstering Treats' }] },
      })
      await applyLongRest(chefStats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'chefBolsteringTreats', 4, CAMPAIGN, true,
      )

      // Celestial Resilience temp HP
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'tempHp') return 3
        return undefined
      })
      const celestialStats = makeStats({
        class: { name: 'Warlock', subclass: { name: 'Celestial Patron' }, major: { name: 'Celestial Patron' } },
        level: 6,
        abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Charisma', bonus: 4 }],
        specialActions: [{ name: 'Celestial Resilience' }],
      })
      await applyLongRest(celestialStats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'tempHp', 10, CAMPAIGN, true,
      )

      // Celestial Resilience logs ability_use on long rest
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'tempHp') return 3
        return undefined
      })
      await applyLongRest(celestialStats, CAMPAIGN)
      expect(addEntry).toHaveBeenCalledWith(
        CAMPAIGN,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'Test Hero',
          abilityName: 'Celestial Resilience',
          description: expect.stringContaining('10 temporary hit points'),
        }),
      )

      // Improved Warding Flare
      vi.clearAllMocks()
      const flareStats = makeStats({ specialActions: [{ name: 'Improved Warding Flare' }] })
      await applyLongRest(flareStats, CAMPAIGN)
      expect(getBatchUpdates().wardingflareUses).toBeNull()
    })

    it('handles Divine Intervention Wish cooldown on long rest', async () => {
      // decrements cooldown and resets uses when cooldown > 1
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_divineInterventionWishCooldown') return 3
        return undefined
      })
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', '_divineInterventionWishCooldown', 2, CAMPAIGN, true,
      )
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'divineInterventionUses', -1, CAMPAIGN, true,
      )

      vi.clearAllMocks()

      // clears cooldown when it reaches 0
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_divineInterventionWishCooldown') return 1
        return undefined
      })
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', '_divineInterventionWishCooldown', 0, CAMPAIGN, true,
      )
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Test Hero', 'divineInterventionUses', expect.anything(), CAMPAIGN, true,
      )

      vi.clearAllMocks()

      // does not touch cooldown when it is 0 or null
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_divineInterventionWishCooldown') return 0
        return undefined
      })
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Test Hero', '_divineInterventionWishCooldown', expect.anything(), CAMPAIGN, true,
      )

      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_divineInterventionWishCooldown') return null
        return undefined
      })
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Test Hero', '_divineInterventionWishCooldown', expect.anything(), CAMPAIGN, true,
      )
    })

    it('resets per-spell and per-feature tracking on long rest', async () => {
      // Signature Spells
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'SignatureSpells_selection') return ['Fireball']
        return undefined
      })
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'SignatureSpells_Fireball_used', null, CAMPAIGN, true,
      )

      vi.clearAllMocks()

      // No selection — no changes
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Test Hero', expect.stringContaining('SignatureSpells'), expect.anything(), CAMPAIGN, true,
      )

      vi.clearAllMocks()

      // Natural Recovery free cast tracking
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'SignatureSpells_selection') return []
        return undefined
      })
      const nrStats = makeStats({
        automation: { passives: [{ type: 'natural_recovery' }] },
      })
      await applyLongRest(nrStats, CAMPAIGN)
      expect(getBatchUpdates().naturalRecoveryFreeCast).toBeNull()
      expect(getBatchUpdates().naturalRecoveryFreeCastUsed).toBeNull()
      expect(getBatchUpdates().naturalRecoverySlots).toBeNull()

      vi.clearAllMocks()

      // Phantasmal Creatures
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'SignatureSpells_selection') return []
        return undefined
      })
      const phantasmalStats = makeStats({ automation: { passives: [{ type: 'phantasmal_creatures' }] } })
      await applyLongRest(phantasmalStats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', '_Phantasmal_Creatures_freeCastCount', null, CAMPAIGN, true,
      )
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', '_phantasmalCreatures_list', [], CAMPAIGN, true,
      )
    })

    it('refreshes Portent dice (2 dice below level 14, 3 at level 14+)', async () => {
      const stats = makeStats({ automation: { specialActions: [{ type: 'portent' }] } })
      await applyLongRest(stats, CAMPAIGN)

      expect(rollD20).toHaveBeenCalledTimes(2)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'portentDice', JSON.stringify([10, 10]), CAMPAIGN, true,
      )

      vi.clearAllMocks()

      const stats14 = makeStats({
        level: 14,
        automation: { specialActions: [{ type: 'portent', name: 'Portent' }] },
      })
      await applyLongRest(stats14, CAMPAIGN)

      expect(rollD20).toHaveBeenCalledTimes(3)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'portentDice', JSON.stringify([10, 10, 10]), CAMPAIGN, true,
      )
    })

    it('does not refresh Portent dice when feature is absent', async () => {
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(rollD20).not.toHaveBeenCalled()
    })

    it('resets system features on long rest', async () => {
      await applyLongRest(makeStats(), CAMPAIGN)

      // Bastion of Law
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'bastionOfLawActive', false, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'bastionOfLawWardDice', [], CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'bastionOfLawWardTarget', null, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('WardTarget', 'bastionOfLawActive', false, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('WardTarget', 'bastionOfLawWardDice', [], CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('WardTarget', 'bastionOfLawWardSource', null, CAMPAIGN, true)

      // Arcane Ward
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'arcaneWardActive', false, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'arcaneWardHp', 0, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'arcaneWardMax', 0, CAMPAIGN, true)

      // Stonecunning
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'stonecunningUses', null, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'stonecunningRestTimestamp', null, CAMPAIGN, true)

      // Adrenaline Rush
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'adrenalineRushUses', null, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'adrenalineRushRestTimestamp', null, CAMPAIGN, true)

      // Overchannel
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'Overchannel_useCount', 0, CAMPAIGN, true)
    })
  })
})
