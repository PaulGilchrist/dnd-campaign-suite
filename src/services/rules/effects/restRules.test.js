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

describe('restRules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRuntimeValue).mockImplementation((_name, _key) => undefined)
  })

  describe('getHitDieSize', () => {
    it('returns the parsed die number from hit_point_die', () => {
      const stats = { class: { hit_point_die: 'd12' } }
      expect(getHitDieSize(stats)).toBe(12)
    })

    it('returns the parsed die number from hit_die', () => {
      const stats = { class: { hit_die: 'd8' } }
      expect(getHitDieSize(stats)).toBe(8)
    })

    it('returns 8 as default when no hit die found', () => {
      expect(getHitDieSize({})).toBe(8)
    })

    it('returns 8 when playerStats is null', () => {
      expect(getHitDieSize(null)).toBe(8)
    })

    it('returns 8 when hitDieStr is null', () => {
      expect(getHitDieSize({ class: { hit_point_die: null } })).toBe(8)
    })
  })

  describe('getShortRestResourceLabels', () => {
    it('returns Channel Divinity for Cleric', () => {
      const stats = { class: { name: 'Cleric' } }
      const labels = getShortRestResourceLabels(stats)
      expect(labels).toContain('Channel Divinity')
    })

    it('returns Channel Divinity for Paladin', () => {
      const stats = { class: { name: 'Paladin' } }
      const labels = getShortRestResourceLabels(stats)
      expect(labels).toContain('Channel Divinity')
    })

    it('returns Wild Shape for Druid', () => {
      const stats = { class: { name: 'Druid' } }
      const labels = getShortRestResourceLabels(stats)
      expect(labels).toContain('Wild Shape')
    })

    it('returns Second Wind and Action Surge for Fighter', () => {
      const stats = { class: { name: 'Fighter' } }
      const labels = getShortRestResourceLabels(stats)
      expect(labels).toContain('Second Wind')
      expect(labels).toContain('Action Surge')
    })

    it('returns Focus Points for Monk', () => {
      const stats = { class: { name: 'Monk' } }
      const labels = getShortRestResourceLabels(stats)
      expect(labels).toContain('Focus Points')
    })

    it('filters subclasses correctly', () => {
      const stats = { class: { name: 'Fighter', subclass: { name: 'Psi Warrior' } } }
      const labels = getShortRestResourceLabels(stats)
      expect(labels).toContain('Psionic Energy')
    })

    it('excludes subclass when not matching', () => {
      const stats = { class: { name: 'Fighter', subclass: { name: 'Eldritch Knight' } } }
      const labels = getShortRestResourceLabels(stats)
      expect(labels).not.toContain('Psionic Energy')
    })

    it('uses major.name as fallback for subclass', () => {
      const stats = { class: { name: 'Druid', major: { name: 'Circle of the Land' } } }
      const labels = getShortRestResourceLabels(stats)
      expect(labels).toContain('Natural Recovery (Spell Slots)')
    })

    it('returns empty array for unknown class', () => {
      const stats = { class: { name: 'Rogue' } }
      const labels = getShortRestResourceLabels(stats)
      expect(labels).toEqual([])
    })
  })

  describe('computeHitDieRecovery', () => {
    it('adds roll value and conBonus', () => {
      expect(computeHitDieRecovery(5, 3)).toBe(8)
    })

    it('returns at least 1 even when sum is negative', () => {
      expect(computeHitDieRecovery(1, -5)).toBe(1)
    })

    it('handles zero values', () => {
      expect(computeHitDieRecovery(0, 0)).toBe(1)
    })
  })

  describe('computeShortRestHpNewCurrent', () => {
    it('adds recovered amount to currentHp capped at maxHp', () => {
      expect(computeShortRestHpNewCurrent(10, 20, 5)).toBe(15)
    })

    it('caps at maxHp when recovery would exceed', () => {
      expect(computeShortRestHpNewCurrent(18, 20, 5)).toBe(20)
    })

    it('uses maxHp as base when currentHp is null', () => {
      expect(computeShortRestHpNewCurrent(null, 20, 5)).toBe(20)
    })

    it('uses maxHp as base when currentHp is empty string', () => {
      expect(computeShortRestHpNewCurrent('', 20, 5)).toBe(20)
    })

    it('returns maxHp when recoveredAmount is 0', () => {
      expect(computeShortRestHpNewCurrent(10, 20, 0)).toBe(10)
    })

    it('returns currentHp when recoveredAmount is undefined', () => {
      expect(computeShortRestHpNewCurrent(10, 20, undefined)).toBe(10)
    })
  })

  describe('getShortRestResources', () => {
    it('returns a copy of SHORT_REST_RESOURCES', () => {
      const resources = getShortRestResources()
      expect(Array.isArray(resources)).toBe(true)
      expect(resources.length).toBeGreaterThan(0)
    })

    it('returns a new array each call', () => {
      const a = getShortRestResources()
      const b = getShortRestResources()
      expect(a).not.toBe(b)
    })
  })

  describe('getLongRestResources', () => {
    it('returns a copy of LONG_REST_RESOURCES', () => {
      const resources = getLongRestResources()
      expect(Array.isArray(resources)).toBe(true)
      expect(resources.length).toBeGreaterThan(0)
    })

    it('returns a new array each call', () => {
      const a = getLongRestResources()
      const b = getLongRestResources()
      expect(a).not.toBe(b)
    })
  })

  describe('spellSlotLevels', () => {
    it('returns levels 1 through 9', () => {
      const levels = spellSlotLevels()
      expect(levels).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    })
  })

  describe('applyShortRest', () => {
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

    function getUpdates() {
      return vi.mocked(setRuntimeBatch).mock.calls[0][1]
    }

    it('resets HP to max and clears short rest resources', async () => {
      const stats = makeStats()
      await applyShortRest(stats, CAMPAIGN)

      expect(setRuntimeBatch).toHaveBeenCalledWith('Test Hero', expect.any(Object), CAMPAIGN)
      expect(clearAllExpirationEffects).toHaveBeenCalledWith('Test Hero', CAMPAIGN)
      const updates = getUpdates()
      expect(updates.currentHitPoints).toBe(50)
      expect(updates.channelDivinityCharges).toBeNull()
      expect(updates.focusPoints).toBeNull()
      expect(updates.kiPoints).toBeNull()
      expect(updates.actionsurgeUses).toBeNull()
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

      const updates = getUpdates()
      expect(updates.secondWindUses).toBe(1)
    })

    it('does not recover Fighter Second Wind when already at max', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'secondWindUses') return 1
        return undefined
      })
      const stats = makeStats()
      await applyShortRest(stats, CAMPAIGN)

      const updates = getUpdates()
      expect(updates.secondWindUses).toBeUndefined()
    })

    it('handles Improved Warding Flare reset', async () => {
      const stats = makeStats({
        characterAdvancement: [{ name: 'Improved Warding Flare' }],
      })
      await applyShortRest(stats, CAMPAIGN)

      const updates = getUpdates()
      expect(updates.wardingflareUses).toBeNull()
    })

    it('recovers Bardic Inspiration from Font of Inspiration', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'bardicInspirationUses') return 0
        return undefined
      })
      const stats = makeStats({
        class: { name: 'Bard' },
        automation: { passives: [{ type: 'font_of_inspiration' }] },
      })
      await applyShortRest(stats, CAMPAIGN)

      const updates = getUpdates()
      expect(updates.bardicInspirationUses).toBe(2)
    })

    it('does not override Font of Inspiration when at max', async () => {
      const stats = makeStats({
        class: { name: 'Bard' },
        automation: { passives: [{ type: 'font_of_inspiration' }] },
      })
      await applyShortRest(stats, CAMPAIGN)

      const updates = getUpdates()
      expect(updates.bardicInspirationUses).toBeUndefined()
    })

    it('handles Natural Recovery for Druid Circle of the Land', async () => {
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

      const updates = getUpdates()
      // Level 6: floor(6/2) = 3 slots max, recovers slots 1 and 2
      expect(updates.spell_slots_level_1).toBe(4)
      expect(updates.spell_slots_level_2).toBe(1)
      expect(updates.spell_slots_level_3).toBeUndefined()
    })

    it('handles Natural Recovery when no slots need recovery', async () => {
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

      const updates = getUpdates()
      expect(updates.spell_slots_level_1).toBeUndefined()
      expect(updates.spell_slots_level_2).toBeUndefined()
      expect(updates.spell_slots_level_3).toBeUndefined()
    })

    it('handles Arcane Recovery for Wizard', async () => {
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

      const updates = getUpdates()
      // Level 4: ceil(4/2) = 2 slots total, level 1 has 4 available slots (current=0, max=4)
      // Recover min(4, 2) = 2 -> updates[slotKey] = 0 + 2 = 2
      expect(updates.spell_slots_level_1).toBe(2)
      expect(updates.spell_slots_level_2).toBeUndefined()
    })

    it('resets Signature Spells per-spell used flags on short rest', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'SignatureSpells_selection') return ['Fireball', 'Counterspell']
        return undefined
      })
      const stats = makeStats({
        automation: { specialActions: [{ type: 'signature_spells' }] },
      })
      await applyShortRest(stats, CAMPAIGN)

      const updates = getUpdates()
      expect(updates.SignatureSpells_Fireball_used).toBeNull()
      expect(updates.SignatureSpells_Counterspell_used).toBeNull()
    })

    it('resets Divination Savant selections', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Divination_Savant_selection') return ['Detect Magic', 'See Invisibility']
        return undefined
      })
      const stats = makeStats({
        automation: { passives: [{ type: 'passive_rule', effect: 'divination_savant' }] },
      })
      await applyShortRest(stats, CAMPAIGN)

      const updates = getUpdates()
      expect(updates._Divination_Savant_Detect_Magic_used).toBeNull()
      expect(updates._Divination_Savant_See_Invisibility_used).toBeNull()
    })

    it('resets Evocation Savant selections', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Evocation_Savant_selection') return ['Fireball']
        return undefined
      })
      const stats = makeStats({
        automation: { passives: [{ type: 'passive_rule', effect: 'evocation_savant' }] },
      })
      await applyShortRest(stats, CAMPAIGN)

      const updates = getUpdates()
      expect(updates._Evocation_Savant_Fireball_used).toBeNull()
    })

    it('resets Illusion Savant selections', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Illusion_Savant_selection') return ['Major Image']
        return undefined
      })
      const stats = makeStats({
        automation: { passives: [{ type: 'passive_rule', effect: 'illusion_savant' }] },
      })
      await applyShortRest(stats, CAMPAIGN)

      const updates = getUpdates()
      expect(updates._Illusion_Savant_Major_Image_used).toBeNull()
    })

    it('restores Warlock Pact Magic slots', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_2') return 1
        return undefined
      })
      const stats = makeStats({
        class: { name: 'Warlock' },
        spellAbilities: {
          spell_slots_level_2: 2,
        },
      })
      await applyShortRest(stats, CAMPAIGN)

      const updates = getUpdates()
      expect(updates.spell_slots_level_2).toBe(2)
    })

    it('handles Chef Bolstering Treats on short rest', async () => {
      const stats = makeStats({
        proficiency: 4,
        automation: { passives: [{ type: 'temp_hp_buff', name: 'Bolstering Treats' }] },
      })
      await applyShortRest(stats, CAMPAIGN)

      const updates = getUpdates()
      expect(updates.chefBolsteringTreats).toBe(4)
    })

    it('handles Celestial Resilience temp HP on short rest', async () => {
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

      const updates = getUpdates()
      // warlockLevel(6) + chaMod(4) = 10, existing tempHp = 5
      expect(updates.tempHp).toBe(15)
    })
  })

  describe('applyLongRest', () => {
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

    function getCharData() {
      return vi.mocked(setRuntimeBatch).mock.calls[0][1]
    }

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
      const data = getCharData()
      expect(data.currentHitPoints).toBe(50)
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

    it('handles Improved Warding Flare on long rest', async () => {
      const stats = makeStats({
        characterAdvancement: [{ name: 'Improved Warding Flare' }],
      })
      await applyLongRest(stats, CAMPAIGN)

      const data = getCharData()
      expect(data.wardingflareUses).toBeNull()
    })

    it('reduces exhaustion level on long rest', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'exhaustionLevel') return 2
        return undefined
      })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)

      const data = getCharData()
      expect(data.exhaustionLevel).toBe(1)
    })

    it('does not modify exhaustion when level is 0', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'exhaustionLevel') return 0
        return undefined
      })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)

      const data = getCharData()
      expect(data.exhaustionLevel).toBeUndefined()
    })

    it('grants Heroic Inspiration from Resourceful trait', async () => {
      const stats = makeStats({
        characterAdvancement: [{ name: 'Resourceful' }],
      })
      await applyLongRest(stats, CAMPAIGN)

      const data = getCharData()
      expect(data.hasInspiration).toBe(true)
    })

    it('resets Natural Recovery free cast tracking on long rest', async () => {
      const stats = makeStats({
        automation: { passives: [{ type: 'resource_restoration', resourceKey: 'naturalRecoverySlots' }] },
      })
      await applyLongRest(stats, CAMPAIGN)

      const data = getCharData()
      expect(data.naturalRecoveryFreeCast).toBeNull()
      expect(data.naturalRecoverySlots).toBeNull()
    })

    it('handles Divine Intervention Wish cooldown decrement and restores use', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_divineInterventionWishCooldown') return 3
        return undefined
      })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', '_divineInterventionWishCooldown', 2, CAMPAIGN, true
      )
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'divineInterventionUses', -1, CAMPAIGN, true
      )
    })

    it('clears Divine Intervention Wish cooldown when it reaches 0', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_divineInterventionWishCooldown') return 1
        return undefined
      })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', '_divineInterventionWishCooldown', 0, CAMPAIGN, true
      )
    })

    it('resets Uncanny Metabolism tracking on long rest', async () => {
      await applyLongRest(makeStats(), CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'uncannyMetabolismUsed', false, CAMPAIGN, true
      )
    })

    it('resets Undying Sentinel on long rest', async () => {
      await applyLongRest(makeStats(), CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'undyingSentinelUsed', false, CAMPAIGN, true
      )
    })

    it('resets Relentless Endurance on long rest', async () => {
      await applyLongRest(makeStats(), CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'relentlessEnduranceUsed', false, CAMPAIGN, true
      )
    })

    it('resets Signature Spells per-spell used flags on long rest', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'SignatureSpells_selection') return ['Fireball']
        return undefined
      })
      await applyLongRest(makeStats(), CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'SignatureSpells_Fireball_used', null, CAMPAIGN, true
      )
    })

    it('handles Celestial Resilience temp HP on long rest', async () => {
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

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'tempHp', 13, CAMPAIGN, true
      )
    })

    it('resets Bastion of Law ward on long rest', async () => {
      await applyLongRest(makeStats(), CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'bastionOfLawActive', false, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'bastionOfLawWardDice', [], CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'bastionOfLawWardTarget', null, CAMPAIGN, true)
    })

    it('resets Arcane Ward on long rest', async () => {
      await applyLongRest(makeStats(), CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'arcaneWardActive', false, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'arcaneWardHp', 0, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'arcaneWardMax', 0, CAMPAIGN, true)
    })

    it('refreshes Portent dice (2 dice below level 14)', async () => {
      const stats = makeStats({
        automation: { specialActions: [{ type: 'portent' }] },
      })
      await applyLongRest(stats, CAMPAIGN)

      expect(rollD20).toHaveBeenCalledTimes(2)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'portentDice', JSON.stringify([10, 10]), CAMPAIGN, true
      )
    })

    it('refreshes Portent dice (3 dice at level 14+)', async () => {
      const stats = makeStats({
        level: 14,
        automation: { specialActions: [{ type: 'portent', name: 'Portent' }] },
      })
      await applyLongRest(stats, CAMPAIGN)

      expect(rollD20).toHaveBeenCalledTimes(3)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'portentDice', JSON.stringify([10, 10, 10]), CAMPAIGN, true
      )
    })

    it('resets Phantasmal Creatures free cast on long rest', async () => {
      const stats = makeStats({
        automation: { passives: [{ type: 'phantasmal_creatures' }] },
      })
      await applyLongRest(stats, CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', '_Phantasmal_Creatures_freeCastCount', null, CAMPAIGN, true
      )
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', '_phantasmalCreatures_list', [], CAMPAIGN, true
      )
    })

    it('resets Stonecunning on long rest', async () => {
      await applyLongRest(makeStats(), CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'stonecunningUses', null, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'stonecunningRestTimestamp', null, CAMPAIGN, true)
    })

    it('resets Adrenaline Rush on long rest', async () => {
      await applyLongRest(makeStats(), CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'adrenalineRushUses', null, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'adrenalineRushRestTimestamp', null, CAMPAIGN, true)
    })

    it('handles Chef Bolstering Treats on long rest', async () => {
      const stats = makeStats({
        proficiency: 4,
        automation: { passives: [{ type: 'temp_hp_buff', name: 'Bolstering Treats' }] },
      })
      await applyLongRest(stats, CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'chefBolsteringTreats', 4, CAMPAIGN, true
      )
    })
  })
})
