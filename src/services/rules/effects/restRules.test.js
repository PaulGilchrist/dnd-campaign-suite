// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getHitDieSize,
  getShortRestResourceLabels,
  computeHitDieRecovery,
  computeShortRestHpNewCurrent,
  getShortRestResources,
  getLongRestResources,
  spellSlotLevels,
  applyShortRest,
  applyLongRest,
} from './restRules.js'

// Mock dependencies
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_name, _key, _campaign) => undefined),
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

// Import mocked functions for per-test customization
import { getRuntimeValue, setRuntimeBatch, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { clearAllExpirationEffects } from './expirations.js'
import { rollD20 } from '../../../services/dice/diceRoller.js'

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
    vi.mocked(getRuntimeValue).mockImplementation((_name, _key) => undefined)
  })

  describe('getHitDieSize', () => {
    it('returns 12 for hit_point_die "d12"', () => {
      expect(getHitDieSize({ class: { hit_point_die: 'd12' } })).toBe(12)
    })

    it('returns 8 for hit_die "d8"', () => {
      expect(getHitDieSize({ class: { hit_die: 'd8' } })).toBe(8)
    })

    it('returns 8 when playerStats or class is missing or hit_point_die is falsy', () => {
      expect(getHitDieSize(null)).toBe(8)
      expect(getHitDieSize({})).toBe(8)
      expect(getHitDieSize({ class: { hit_point_die: null } })).toBe(8)
      expect(getHitDieSize({ class: { hit_point_die: '' } })).toBe(8)
    })

    it('parses hit_point_die with non-numeric characters', () => {
      expect(getHitDieSize({ class: { hit_point_die: 'd10-extra' } })).toBe(10)
    })
  })

  describe('getShortRestResourceLabels', () => {
    it('includes Channel Divinity for Cleric and Paladin', () => {
      expect(getShortRestResourceLabels({ class: { name: 'Cleric' } })).toContain('Channel Divinity')
      expect(getShortRestResourceLabels({ class: { name: 'Paladin' } })).toContain('Channel Divinity')
    })

    it('includes Wild Shape for Druid', () => {
      expect(getShortRestResourceLabels({ class: { name: 'Druid' } })).toContain('Wild Shape')
    })

    it('includes Second Wind and Action Surge for Fighter', () => {
      const labels = getShortRestResourceLabels({ class: { name: 'Fighter' } })
      expect(labels).toContain('Second Wind')
      expect(labels).toContain('Action Surge')
    })

    it('includes Focus Points for Monk', () => {
      expect(getShortRestResourceLabels({ class: { name: 'Monk' } })).toContain('Focus Points')
    })

    it('includes Psionic Energy for Psi Warrior Fighter and Soulknife Rogue', () => {
      expect(getShortRestResourceLabels({ class: { name: 'Fighter', subclass: { name: 'Psi Warrior' } } })).toContain('Psionic Energy')
      expect(getShortRestResourceLabels({ class: { name: 'Rogue', subclass: { name: 'Soulknife' } } })).toContain('Psionic Energy')
    })

    it('includes Superiority Dice for Battle Master Fighter', () => {
      const labels = getShortRestResourceLabels({
        class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
      })
      expect(labels).toContain('Superiority Dice')
    })

    it('excludes Psionic Energy for non-Psi Warrior Fighter', () => {
      const labels = getShortRestResourceLabels({
        class: { name: 'Fighter', subclass: { name: 'Eldritch Knight' } },
      })
      expect(labels).not.toContain('Psionic Energy')
    })

    it('uses major.name as fallback for subclass matching', () => {
      const labels = getShortRestResourceLabels({
        class: { name: 'Druid', major: { name: 'Circle of the Land' } },
      })
      expect(labels).toContain('Natural Recovery (Spell Slots)')
    })

    it('returns empty array for Rogue and when class is missing', () => {
      expect(getShortRestResourceLabels({ class: { name: 'Rogue' } })).toEqual([])
      expect(getShortRestResourceLabels({})).toEqual([])
    })
  })

  describe('computeHitDieRecovery', () => {
    it('returns roll + conBonus when positive', () => {
      expect(computeHitDieRecovery(5, 3)).toBe(8)
    })

    it('returns 1 when roll + conBonus is less than 1', () => {
      expect(computeHitDieRecovery(1, -5)).toBe(1)
      expect(computeHitDieRecovery(0, 0)).toBe(1)
    })

    it('handles negative conBonus that still yields positive sum', () => {
      expect(computeHitDieRecovery(5, -2)).toBe(3)
    })
  })

  describe('computeShortRestHpNewCurrent', () => {
    it('adds recovered amount to currentHp capped at maxHp', () => {
      expect(computeShortRestHpNewCurrent(10, 20, 5)).toBe(15)
    })

    it('caps at maxHp when recovery would exceed', () => {
      expect(computeShortRestHpNewCurrent(18, 20, 5)).toBe(20)
    })

    it('uses maxHp as base when currentHp is null or empty string', () => {
      expect(computeShortRestHpNewCurrent(null, 20, 5)).toBe(20)
      expect(computeShortRestHpNewCurrent('', 20, 5)).toBe(20)
    })

    it('returns maxHp when recoveredAmount is 0 and currentHp is null', () => {
      expect(computeShortRestHpNewCurrent(null, 20, 0)).toBe(20)
    })

    it('returns currentHp when recoveredAmount is 0 and currentHp is valid', () => {
      expect(computeShortRestHpNewCurrent(10, 20, 0)).toBe(10)
    })
  })

  describe('getShortRestResources', () => {
    it('returns a non-empty array of resource keys', () => {
      const resources = getShortRestResources()
      expect(Array.isArray(resources)).toBe(true)
      expect(resources.length).toBeGreaterThan(0)
    })
  })

  describe('getLongRestResources', () => {
    it('returns a non-empty array of resource keys', () => {
      const resources = getLongRestResources()
      expect(Array.isArray(resources)).toBe(true)
      expect(resources.length).toBeGreaterThan(0)
    })
  })

  describe('spellSlotLevels', () => {
    it('returns levels 1 through 9', () => {
      expect(spellSlotLevels()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    })
  })

  describe('applyShortRest', () => {
    it('resets HP to max and nulls all short rest resources', async () => {
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

    it('recovers Fighter Second Wind when below max', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'secondWindUses') return 0
        return undefined
      })
      const stats = makeStats()
      await applyShortRest(stats, CAMPAIGN)

      expect(getBatchUpdates().secondWindUses).toBe(1)
    })

    it('does not recover Second Wind when already at max', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'secondWindUses') return 1
        return undefined
      })
      const stats = makeStats()
      await applyShortRest(stats, CAMPAIGN)

      expect(getBatchUpdates().secondWindUses).toBeUndefined()
    })

    it('resets Improved Warding Flare charges', async () => {
      const stats = makeStats({ characterAdvancement: [{ name: 'Improved Warding Flare' }] })
      await applyShortRest(stats, CAMPAIGN)

      expect(getBatchUpdates().wardingflareUses).toBeNull()
    })

    it('restores Bardic Inspiration from Font of Inspiration', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'bardicInspirationUses') return 0
        return undefined
      })
      const stats = makeStats({
        class: { name: 'Bard' },
        automation: { passives: [{ type: 'font_of_inspiration' }] },
      })
      await applyShortRest(stats, CAMPAIGN)

      expect(getBatchUpdates().bardicInspirationUses).toBe(2)
    })

    it('does not override Bardic Inspiration when already at max', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'bardicInspirationUses') return 2
        return undefined
      })
      const stats = makeStats({
        class: { name: 'Bard' },
        automation: { passives: [{ type: 'font_of_inspiration' }] },
      })
      await applyShortRest(stats, CAMPAIGN)

      expect(getBatchUpdates().bardicInspirationUses).toBeUndefined()
    })

    it('recovers Natural Recovery spell slots for Druid Circle of the Land', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_1') return 2
        if (key === 'spell_slots_level_2') return 0
        if (key === 'spell_slots_level_3') return 2
        return undefined
      })
      const stats = makeStats({
        class: { name: 'Druid' },
        level: 6,
        spellAbilities: {
          spell_slots_level_1: 4,
          spell_slots_level_2: 3,
          spell_slots_level_3: 3,
          spell_slots_level_4: 0,
        },
        automation: { passives: [{ type: 'resource_restoration', resourceKey: 'naturalRecoverySlots' }] },
      })
      await applyShortRest(stats, CAMPAIGN)

      const updates = getBatchUpdates()
      expect(updates.spell_slots_level_1).toBe(4)
      expect(updates.spell_slots_level_2).toBe(1)
      expect(updates.spell_slots_level_3).toBeUndefined()
    })

    it('does not restore Natural Recovery when all slots are full', async () => {
      const stats = makeStats({
        class: { name: 'Druid' },
        level: 6,
        spellAbilities: {
          spell_slots_level_1: 4,
          spell_slots_level_2: 3,
          spell_slots_level_3: 3,
        },
        automation: { passives: [{ type: 'resource_restoration', resourceKey: 'naturalRecoverySlots' }] },
      })
      await applyShortRest(stats, CAMPAIGN)

      const updates = getBatchUpdates()
      expect(updates.spell_slots_level_1).toBeUndefined()
      expect(updates.spell_slots_level_2).toBeUndefined()
      expect(updates.spell_slots_level_3).toBeUndefined()
    })

    it('recovers Arcane Recovery spell slots for Wizard', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_1') return 0
        return undefined
      })
      const stats = makeStats({
        class: { name: 'Wizard' },
        level: 4,
        spellAbilities: {
          spell_slots_level_1: 4,
          spell_slots_level_2: 3,
        },
        automation: { passives: [{ type: 'resource_restoration', resourceKey: 'arcaneRecoveryLevels' }] },
      })
      await applyShortRest(stats, CAMPAIGN)

      const updates = getBatchUpdates()
      expect(updates.spell_slots_level_1).toBe(2)
      expect(updates.spell_slots_level_2).toBeUndefined()
    })

    it('resets per-spell used flags for Signature Spells, Divination Savant, Evocation Savant, and Illusion Savant', async () => {
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

    it('restores Warlock Pact Magic slots', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_2') return 1
        return undefined
      })
      const stats = makeStats({
        class: { name: 'Warlock' },
        spellAbilities: { spell_slots_level_2: 2 },
      })
      await applyShortRest(stats, CAMPAIGN)

      expect(getBatchUpdates().spell_slots_level_2).toBe(2)
    })

    it('restores all Warlock Pact Magic slots up to max', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_1') return 0
        if (key === 'spell_slots_level_2') return 0
        return undefined
      })
      const stats = makeStats({
        class: { name: 'Warlock' },
        level: 5,
        spellAbilities: { spell_slots_level_1: 2, spell_slots_level_2: 3 },
      })
      await applyShortRest(stats, CAMPAIGN)

      const updates = getBatchUpdates()
      expect(updates.spell_slots_level_1).toBe(2)
      expect(updates.spell_slots_level_2).toBe(3)
    })

    it('does not restore Warlock slots that are already full', async () => {
      const stats = makeStats({
        class: { name: 'Warlock' },
        spellAbilities: { spell_slots_level_2: 2 },
      })
      await applyShortRest(stats, CAMPAIGN)

      expect(getBatchUpdates().spell_slots_level_2).toBeUndefined()
    })

    it('sets Chef Bolstering Treats count', async () => {
      const stats = makeStats({
        proficiency: 4,
        automation: { passives: [{ type: 'temp_hp_buff', name: 'Bolstering Treats' }] },
      })
      await applyShortRest(stats, CAMPAIGN)

      expect(getBatchUpdates().chefBolsteringTreats).toBe(4)
    })

    it('grants Celestial Resilience temp HP on short rest', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'tempHp') return 5
        return undefined
      })
      const stats = makeStats({
        class: { name: 'Warlock', subclass: { name: 'Celestial Patron' }, major: { name: 'Celestial Patron' } },
        level: 6,
        abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Charisma', bonus: 4 }],
        characterAdvancement: [{ name: 'Celestial Resilience' }],
      })
      await applyShortRest(stats, CAMPAIGN)

      // existing 5 + (warlockLevel 6 + chaMod 4) = 15
      expect(getBatchUpdates().tempHp).toBe(15)
    })

    it('throws when level is missing for Celestial Resilience, Natural Recovery, and Arcane Recovery', async () => {
      const missingLevelStats = (automation) => makeStats({
        class: { name: 'Warlock', subclass: { name: 'Celestial Patron' } },
        level: null,
        characterAdvancement: [{ name: 'Celestial Resilience' }],
        automation,
      })

      await expect(applyShortRest(missingLevelStats({}), CAMPAIGN)).rejects.toThrow('playerStats.level is required')
      await expect(applyShortRest(missingLevelStats({ passives: [{ type: 'resource_restoration', resourceKey: 'naturalRecoverySlots' }] }), CAMPAIGN)).rejects.toThrow('playerStats.level is required')
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

    it('resets Improved Warding Flare on long rest', async () => {
      const stats = makeStats({ characterAdvancement: [{ name: 'Improved Warding Flare' }] })
      await applyLongRest(stats, CAMPAIGN)

      expect(getBatchUpdates().wardingflareUses).toBeNull()
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
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)
      expect(getBatchUpdates().exhaustionLevel).toBeUndefined()

      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, _key) => undefined)
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(getBatchUpdates().exhaustionLevel).toBeUndefined()
    })

    it('grants Heroic Inspiration from Resourceful trait', async () => {
      const stats = makeStats({ characterAdvancement: [{ name: 'Resourceful' }] })
      await applyLongRest(stats, CAMPAIGN)

      expect(getBatchUpdates().hasInspiration).toBe(true)
    })

    it('resets Natural Recovery free cast tracking on long rest', async () => {
      const stats = makeStats({
        automation: { passives: [{ type: 'resource_restoration', resourceKey: 'naturalRecoverySlots' }] },
      })
      await applyLongRest(stats, CAMPAIGN)

      expect(getBatchUpdates().naturalRecoveryFreeCast).toBeNull()
      expect(getBatchUpdates().naturalRecoverySlots).toBeNull()
    })

    it('handles Divine Intervention Wish cooldown on long rest', async () => {
      // decrements cooldown and resets uses when cooldown > 1
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_divineInterventionWishCooldown') return 3
        return undefined
      })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)

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



    it('resets per-spell used flags for Signature Spells on long rest', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'SignatureSpells_selection') return ['Fireball']
        return undefined
      })
      await applyLongRest(makeStats(), CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'SignatureSpells_Fireball_used', null, CAMPAIGN, true,
      )
    })

    it('does not touch Signature Spells when no selection exists', async () => {
      await applyLongRest(makeStats(), CAMPAIGN)

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Test Hero', expect.stringContaining('SignatureSpells'), expect.anything(), CAMPAIGN, true,
      )
    })

    it('grants Celestial Resilience temp HP on long rest', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'tempHp') return 3
        return undefined
      })
      const stats = makeStats({
        class: { name: 'Warlock', subclass: { name: 'Celestial Patron' }, major: { name: 'Celestial Patron' } },
        level: 6,
        abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Charisma', bonus: 4 }],
        characterAdvancement: [{ name: 'Celestial Resilience' }],
      })
      await applyLongRest(stats, CAMPAIGN)

      // existing 3 + (warlockLevel 6 + chaMod 4) = 13
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'tempHp', 13, CAMPAIGN, true,
      )
    })

    it('resets Bastion of Law and Arcane Ward on long rest', async () => {
      await applyLongRest(makeStats(), CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'bastionOfLawActive', false, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'bastionOfLawWardDice', [], CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'bastionOfLawWardTarget', null, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'arcaneWardActive', false, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'arcaneWardHp', 0, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'arcaneWardMax', 0, CAMPAIGN, true)
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

    it('resets Phantasmal Creatures free cast on long rest', async () => {
      const stats = makeStats({ automation: { passives: [{ type: 'phantasmal_creatures' }] } })
      await applyLongRest(stats, CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', '_Phantasmal_Creatures_freeCastCount', null, CAMPAIGN, true,
      )
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', '_phantasmalCreatures_list', [], CAMPAIGN, true,
      )
    })

    it('resets Stonecunning and Adrenaline Rush on long rest', async () => {
      await applyLongRest(makeStats(), CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'stonecunningUses', null, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'stonecunningRestTimestamp', null, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'adrenalineRushUses', null, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'adrenalineRushRestTimestamp', null, CAMPAIGN, true)
    })

    it('resets Overchannel use count on long rest', async () => {
      await applyLongRest(makeStats(), CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'Overchannel_useCount', 0, CAMPAIGN, true)
    })

    it('sets Chef Bolstering Treats count on long rest', async () => {
      const stats = makeStats({
        proficiency: 4,
        automation: { passives: [{ type: 'temp_hp_buff', name: 'Bolstering Treats' }] },
      })
      await applyLongRest(stats, CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'chefBolsteringTreats', 4, CAMPAIGN, true,
      )
    })

    it('restores hit dice equal to character level', async () => {
      const stats = makeStats({ level: 15 })
      await applyLongRest(stats, CAMPAIGN)

      expect(getBatchUpdates().shortRestHitDice).toBe(15)
    })
  })
})
