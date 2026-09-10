// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyShortRest } from './restRules.js'

// Mock dependencies
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_name, key, _campaign) => {
    if (key === 'bastionOfLawWardTarget') return 'WardTarget';
    return undefined;
  }),
  setRuntimeBatch: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
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

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  setCombatSummaryCache: vi.fn(),
}))

vi.mock('../../../services/combat/concentration/concentrationService.js', () => ({
  clearAllConcentrations: vi.fn(),
}))

vi.mock('../../../services/automation/handlers/class-warlock/celestialResilienceHandler.js', () => ({
  grantCelestialResilience: vi.fn(() => null),
}))

vi.mock('../features/invisibilityService.js', () => ({
  endInvisibility: vi.fn(),
  endGreaterInvisibility: vi.fn(),
}))

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}))

// Import mocked functions for per-test customization
import { getRuntimeValue, setRuntimeBatch, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js'
import { clearAllExpirationEffects } from './expirations.js'
import { addEntry } from '../../../services/ui/logService.js'
import { getCombatSummary } from '../../../services/encounters/combatData.js'
import { grantCelestialResilience } from '../../../services/automation/handlers/class-warlock/celestialResilienceHandler.js'
import { endInvisibility, endGreaterInvisibility } from '../features/invisibilityService.js'
import * as storageService from '../../../services/ui/storage.js'

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

describe('applyShortRest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
      if (key === 'bastionOfLawWardTarget') return 'WardTarget';
      return undefined;
    })
  })

  describe('basic reset', () => {
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
      expect(updates.illusorySelfUses).toBeNull()
      expect(updates.relentlessrageUses).toBeNull()
      expect(updates.activeBuffs).toEqual([])
      expect(updates.activeConditions).toEqual([])
    })
  })

  describe('class feature recovery', () => {
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

      // Arcane Recovery enforces combined level cost (not slot count)
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_2') return 1
        return undefined
      })
      const wizardLevel2Stats = makeStats({
        class: { name: 'Wizard' },
        level: 4,
        spellAbilities: {
          spell_slots_level_2: 3,
        },
        automation: { passives: [{ type: 'resource_restoration', resourceKey: 'arcaneRecoveryLevels' }] },
      })
      await applyShortRest(wizardLevel2Stats, CAMPAIGN)
      const level2Updates = getBatchUpdates()
      expect(level2Updates.spell_slots_level_2).toBe(2)

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
  })

  describe('per-feature tracking reset', () => {
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
  })

  describe('feature-specific benefits', () => {
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

      // Arcane Recovery error path - Wizard with level null and no Celestial Patron
      const wizardMissingLevel = makeStats({
        class: { name: 'Wizard' },
        level: null,
        automation: { passives: [{ type: 'resource_restoration', resourceKey: 'arcaneRecoveryLevels' }] },
      })
      await expect(applyShortRest(wizardMissingLevel, CAMPAIGN)).rejects.toThrow('playerStats.level is required')
    })

    it('handles Barbarian 2024 rage recharges on short rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'ragePoints') return 1
        return undefined
      })
      const barbarianStats = makeStats({
        class: { name: 'Barbarian', class_levels: [{ level: 5, rages: 2 }] },
        rules: '2024',
        _trackedResources: { ragePoints: { current: 1 } },
      })
      await applyShortRest(barbarianStats, CAMPAIGN)
      expect(getBatchUpdates().ragePoints).toBe(2)
    })

    it('handles Replenishing Meal on short rest', async () => {
      vi.clearAllMocks()
      const chefStats = makeStats({
        proficiency: 3,
        automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' }] },
      })
      await applyShortRest(chefStats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'replenishingMeals', 7, CAMPAIGN, true)
    })

    it('handles Tireless Ranger exhaustion reduction on short rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'exhaustionLevel') return 3
        return undefined
      })
      const rangerStats = makeStats({
        class: { name: 'Ranger' },
        level: 10,
      })
      await applyShortRest(rangerStats, CAMPAIGN)
      expect(getBatchUpdates().exhaustionLevel).toBe(2)
    })
  })

  describe('buff/condition handling', () => {
    it('preserves Mage Armor buffs on short rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Mage Armor' }, { name: 'Shield' }]
        return undefined
      })
      const stats = makeStats()
      await applyShortRest(stats, CAMPAIGN)
      expect(getBatchUpdates().activeBuffs).toEqual([{ name: 'Mage Armor' }])
    })

    it('preserves shape_shift buff on short rest (CLA-391: SR re-arms uses, does not end the form)', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Wild Shape', effect: 'shape_shift' }, { name: 'Shield' }]
        return undefined
      })
      const stats = makeStats({ class: { name: 'Druid' }, level: 20 })
      await applyShortRest(stats, CAMPAIGN)
      expect(getBatchUpdates().activeBuffs).toEqual([{ name: 'Wild Shape', effect: 'shape_shift' }])
    })

    it('handles Vow of Enmity target buff filtering on short rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'vowOfEnmityTarget') return 'Enemy1'
        if (key === 'activeBuffs') return [{ effect: 'vow_of_enmity' }, { effect: 'haste' }]
        return undefined
      })
      const stats = makeStats()
      await applyShortRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Enemy1', 'activeBuffs', [{ effect: 'haste' }], CAMPAIGN,
      )
    })
  })

  describe('targetEffects clearing on short rest', () => {
    it('handles targetEffects clearing on short rest when effects exist', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'targetEffects') return [{ effect: 'globe_barrier' }, { effect: 'blur' }, { effect: 'barkskin' }]
        return undefined
      })
      const stats = makeStats()
      await applyShortRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects',
        expect.arrayContaining([]),
        CAMPAIGN,
      )
    })

    it('handles clairvoyant_combatant targetEffects clearing on short rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'targetEffects') return [{ effect: 'clairvoyant_combatant' }, { effect: 'haste' }]
        return undefined
      })
      const stats = makeStats()
      await applyShortRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects',
        [{ effect: 'haste' }],
        CAMPAIGN, true,
      )
    })

    it('handles pass_without_trace_bonus targetEffects clearing on short rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'targetEffects') return [{ effect: 'pass_without_trace_bonus' }]
        return undefined
      })
      const stats = makeStats()
      await applyShortRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects', [], CAMPAIGN, true,
      )
    })

    it('handles blur targetEffects clearing on short rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'targetEffects') return [{ effect: 'blur' }]
        return undefined
      })
      const stats = makeStats()
      await applyShortRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects', [], CAMPAIGN, true,
      )
    })

    it('handles regenerate targetEffects clearing on short rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'targetEffects') return [{ effect: 'regenerate' }]
        return undefined
      })
      const stats = makeStats()
      await applyShortRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects', [], CAMPAIGN, true,
      )
    })

    it('handles beacon_of_hope targetEffects clearing on short rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'targetEffects') return [{ effect: 'beacon_of_hope' }]
        return undefined
      })
      const stats = makeStats()
      await applyShortRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects', [], CAMPAIGN, true,
      )
    })

    it('handles resistance_damage_reduction targetEffects clearing on short rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'targetEffects') return [{ effect: 'resistance_damage_reduction' }]
        return undefined
      })
      const stats = makeStats()
      await applyShortRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects', [], CAMPAIGN, true,
      )
    })

    it('handles enhance_ability targetEffects clearing on short rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'targetEffects') return [{ effect: 'enhance_ability' }]
        return undefined
      })
      const stats = makeStats()
      await applyShortRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects', [], CAMPAIGN, true,
      )
    })

    it('handles circle_of_power targetEffects clearing on short rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'targetEffects') return [{ effect: 'circle_of_power' }]
        return undefined
      })
      const stats = makeStats()
      await applyShortRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects', [], CAMPAIGN, true,
      )
    })
  })

  describe('regenerateActive clearing', () => {
    it('handles regenerateActive clearing on short rest with store keys', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'regenerateActive') return true
        if (key === 'hitPoints') return 50
        return undefined
      })
      vi.mocked(getAllStoreKeys).mockReturnValue([123, 'Char1', 'Char2', null])
      const stats = makeStats()
      await applyShortRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith('Char1', 'regenerateActive', false, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith('Char1', 'currentHitPoints', 50, CAMPAIGN)
    })
  })

  describe('invisibility clearing', () => {
    it('clears Invisibility on short rest when active', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_activeInvisibility_Test Hero') return 'Caster1'
        return undefined
      })
      const stats = makeStats()
      await applyShortRest(stats, CAMPAIGN)
      expect(endInvisibility).toHaveBeenCalledWith('Test Hero', CAMPAIGN, 'target finished a rest')
      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', '_activeInvisibility_Test Hero', null, CAMPAIGN)
    })

    it('clears Greater Invisibility on short rest when active', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_activeGreaterInvisibility_Test Hero') return 'Caster1'
        return undefined
      })
      const stats = makeStats()
      await applyShortRest(stats, CAMPAIGN)
      expect(endGreaterInvisibility).toHaveBeenCalledWith('Test Hero', CAMPAIGN, 'target finished a rest')
      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', '_activeGreaterInvisibility_Test Hero', null, CAMPAIGN)
    })
  })

  describe('Celestial Resilience with allies', () => {
    it('handles Celestial Resilience with combatSummary and allies', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'tempHp') return 5
        return undefined
      })
      vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] })
      vi.mocked(grantCelestialResilience).mockResolvedValue({
        allyTempHp: 5,
        allies: [{ name: 'Ally1', type: 'player' }],
        selfTempHp: 10,
        maxAllies: 5,
      })
      const celestialStats = makeStats({
        class: { name: 'Warlock', subclass: { name: 'Celestial Patron' }, major: { name: 'Celestial Patron' } },
        level: 6,
        abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Charisma', bonus: 4 }],
        specialActions: [{ name: 'Celestial Resilience' }],
      })
      const result = await applyShortRest(celestialStats, CAMPAIGN)
      expect(grantCelestialResilience).toHaveBeenCalledWith(celestialStats, CAMPAIGN, 'short_rest')
      expect(result.celestialResilienceAllies).toEqual({
        creatureTargets: [{ name: 'Ally1', type: 'player' }],
        allyTempHp: 5,
        selfTempHp: 10,
        maxTargets: 5,
      })
    })

    it('handles addEntry catch on short rest celestial resilience', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'tempHp') return 5
        return undefined
      })
      vi.mocked(addEntry).mockReturnValue(Promise.reject(new Error('Log failed')))
      const celestialStats = makeStats({
        class: { name: 'Warlock', subclass: { name: 'Celestial Patron' }, major: { name: 'Celestial Patron' } },
        level: 6,
        abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Charisma', bonus: 4 }],
        specialActions: [{ name: 'Celestial Resilience' }],
      })
      await applyShortRest(celestialStats, CAMPAIGN)
    })
  })

  describe('polymorph/transform handling', () => {
    it('handles True Polymorph summoned creature removal on short rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getCombatSummary).mockReturnValue({
        creatures: [
          { name: 'Summon1', summonSource: 'true_polymorph', currentHp: 10, maxHp: 20 },
          { name: 'Normal1', currentHp: 15, maxHp: 30 },
        ],
      })
      const stats = makeStats()
      await applyShortRest(stats, CAMPAIGN)
      expect(storageService.default.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), CAMPAIGN)
    })

    it('handles object transforms on short rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'activeConditions') return ['incapacitated', 'blinded']
        return undefined
      })
      vi.mocked(getCombatSummary).mockReturnValue({
        creatures: [
          {
            name: 'Transformed1',
            polymorphObject: { maxHp: 50, ac: 15, speed: 30 },
            polymorphOriginal: { maxHp: 50, ac: 15, speed: 30 },
          },
        ],
      })
      const stats = makeStats()
      await applyShortRest(stats, CAMPAIGN)
      const updates = getBatchUpdates()
      expect(updates.activeConditions).toEqual([])
    })
  })
})
