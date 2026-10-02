// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyLongRest } from './restRules.js'

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

vi.mock('../../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn((name, amount) => amount),
}))

vi.mock('../features/invisibilityService.js', () => ({
  endInvisibility: vi.fn(),
  endGreaterInvisibility: vi.fn(),
}))

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}))

// Import mocked functions for per-test customization
import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js'
import { clearAllExpirationEffects } from './expirations.js'
import { rollD20 } from '../../../services/dice/diceRoller.js'
import { addEntry } from '../../../services/ui/logService.js'
import { getCombatSummary } from '../../../services/encounters/combatData.js'
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

describe('restRules - long rest special features', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
      if (key === 'bastionOfLawWardTarget') return 'WardTarget';
      return undefined;
    })
  })

  describe('Circle of the Stars', () => {
    it('sets Star Map free cast count on long rest for Druid level 3+', async () => {
      const druidStats = makeStats({
        class: { name: 'Druid', major: { name: 'Circle of the Stars' } },
        level: 3,
        abilities: [{ name: 'Wisdom', bonus: 4 }],
      })
      await applyLongRest(druidStats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', '_Star_Map_freeCastCount', 4, CAMPAIGN, true,
      )
    })

    it('sets Star Map free cast count to minimum 1 when WIS mod is 0', async () => {
      const druidStats = makeStats({
        class: { name: 'Druid', major: { name: 'Circle of the Stars' } },
        level: 3,
        abilities: [{ name: 'Wisdom', bonus: 0 }],
      })
      await applyLongRest(druidStats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', '_Star_Map_freeCastCount', 1, CAMPAIGN, true,
      )
    })

    it('does not set Star Map for Druid below level 3', async () => {
      const druidStats = makeStats({
        class: { name: 'Druid', major: { name: 'Circle of the Stars' } },
        level: 2,
        abilities: [{ name: 'Wisdom', bonus: 4 }],
      })
      await applyLongRest(druidStats, CAMPAIGN)
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Test Hero', '_Star_Map_freeCastCount', expect.anything(), CAMPAIGN, true,
      )
    })

    it('does not set Star Map for non-Circle of the Stars Druid', async () => {
      const druidStats = makeStats({
        class: { name: 'Druid', major: { name: 'Circle of the Land' } },
        level: 5,
        abilities: [{ name: 'Wisdom', bonus: 4 }],
      })
      await applyLongRest(druidStats, CAMPAIGN)
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Test Hero', '_Star_Map_freeCastCount', expect.anything(), CAMPAIGN, true,
      )
    })

    it('rolls Cosmic Omen on long rest for Druid level 6+', async () => {
      vi.clearAllMocks()
      vi.mocked(rollD20).mockReturnValue(7)
      const druidStats = makeStats({
        class: { name: 'Druid', major: { name: 'Circle of the Stars' } },
        level: 6,
        abilities: [{ name: 'Wisdom', bonus: 4 }],
      })
      await applyLongRest(druidStats, CAMPAIGN)
      expect(rollD20).toHaveBeenCalled()
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'cosmicOmenEffect',
        JSON.stringify({ type: 'Woe', isEven: false, starMapRoll: 7 }),
        CAMPAIGN, true,
      )
      expect(clearAllExpirationEffects).toHaveBeenCalledWith('Test Hero', CAMPAIGN)
    })

    it('rolls Weal for even Cosmic Omen number', async () => {
      vi.clearAllMocks()
      vi.mocked(rollD20).mockReturnValue(12)
      const druidStats = makeStats({
        class: { name: 'Druid', major: { name: 'Circle of the Stars' } },
        level: 6,
        abilities: [{ name: 'Wisdom', bonus: 4 }],
      })
      await applyLongRest(druidStats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'cosmicOmenEffect',
        JSON.stringify({ type: 'Weal', isEven: true, starMapRoll: 12 }),
        CAMPAIGN, true,
      )
    })

    it('CLA-065: clears unspent cosmicOmenPendingBonus from the global cosmicOmen store', async () => {
      vi.clearAllMocks()
      vi.mocked(rollD20).mockReturnValue(4)
      const druidStats = makeStats({
        class: { name: 'Druid', major: { name: 'Circle of the Stars' } },
        level: 6,
        abilities: [{ name: 'Wisdom', bonus: 4 }],
      })
      await applyLongRest(druidStats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'cosmicOmen', 'cosmicOmenPendingBonus', null, CAMPAIGN, true,
      )
    })

    it('CLA-065: does not clear the pending store for Druid below level 6', async () => {
      vi.clearAllMocks()
      const druidStats = makeStats({
        class: { name: 'Druid', major: { name: 'Circle of the Stars' } },
        level: 5,
        abilities: [{ name: 'Wisdom', bonus: 4 }],
      })
      await applyLongRest(druidStats, CAMPAIGN)
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'cosmicOmen', 'cosmicOmenPendingBonus', expect.anything(), CAMPAIGN, expect.anything(),
      )
    })

    it('does not roll Cosmic Omen for Druid below level 6', async () => {
      vi.clearAllMocks()
      const druidStats = makeStats({
        class: { name: 'Druid', major: { name: 'Circle of the Stars' } },
        level: 5,
        abilities: [{ name: 'Wisdom', bonus: 4 }],
      })
      await applyLongRest(druidStats, CAMPAIGN)
      expect(rollD20).not.toHaveBeenCalled()
    })
  })

  describe('Replenishing Meal on long rest', () => {
    it('resets replenishingMeals on long rest when feature exists', async () => {
      const chefStats = makeStats({
        proficiency: 5,
        automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' }] },
      })
      await applyLongRest(chefStats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'replenishingMeals', 9, CAMPAIGN, true)
    })

    it('does not reset replenishingMeals when feature is absent', async () => {
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Test Hero', 'replenishingMeals', expect.anything(), CAMPAIGN, true,
      )
    })
  })

  describe('Bolstering Treats on long rest', () => {
    it('crafts Bolstering Treats on long rest when feature exists', async () => {
      const chefStats = makeStats({
        proficiency: 4,
        automation: { specialActions: [{ type: 'temp_hp_buff', name: 'Bolstering Treats' }] },
      })
      await applyLongRest(chefStats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'chefBolsteringTreats', 4, CAMPAIGN, true)
    })

    it('uses 0 when proficiency is missing for Bolstering Treats', async () => {
      const chefStats = makeStats({
        proficiency: 0,
        automation: { specialActions: [{ type: 'temp_hp_buff', name: 'Bolstering Treats' }] },
      })
      await applyLongRest(chefStats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'chefBolsteringTreats', 0, CAMPAIGN, true)
    })

    it('clears bolsteringTreat on long rest', async () => {
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'bolsteringTreat', null, CAMPAIGN, true)
    })
  })

  describe('targetEffects clearing on long rest when effects exist', () => {
    it('clears clairvoyant_combatant effects on long rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'targetEffects') return [{ effect: 'clairvoyant_combatant' }]
        return undefined
      })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects', [], CAMPAIGN, true,
      )
    })

    it('clears pass_without_trace_bonus on long rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'targetEffects') return [{ effect: 'pass_without_trace_bonus' }]
        return undefined
      })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects', [], CAMPAIGN, true,
      )
    })

    it('clears blur on long rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'targetEffects') return [{ effect: 'blur' }]
        return undefined
      })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects', [], CAMPAIGN, true,
      )
    })

    it('clears regenerate on long rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'targetEffects') return [{ effect: 'regenerate' }]
        return undefined
      })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects', [], CAMPAIGN, true,
      )
    })

    it('clears beacon_of_hope on long rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'targetEffects') return [{ effect: 'beacon_of_hope' }]
        return undefined
      })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects', [], CAMPAIGN, true,
      )
    })

    it('clears resistance_damage_reduction on long rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'targetEffects') return [{ effect: 'resistance_damage_reduction' }]
        return undefined
      })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects', [], CAMPAIGN, true,
      )
    })

    it('clears barkskin on long rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'targetEffects') return [{ effect: 'barkskin' }]
        return undefined
      })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects', [], CAMPAIGN, true,
      )
    })

    it('clears enhance_ability on long rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'targetEffects') return [{ effect: 'enhance_ability' }]
        return undefined
      })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects', [], CAMPAIGN, true,
      )
    })

    it('clears circle_of_power on long rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'targetEffects') return [{ effect: 'circle_of_power' }]
        return undefined
      })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects', [], CAMPAIGN, true,
      )
    })

    it('clears foresight on long rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'targetEffects') return [{ effect: 'foresight' }, { effect: 'advantage_attacks' }]
        return undefined
      })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects', [], CAMPAIGN, true,
      )
    })

    it('clears starry_form on long rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'targetEffects') return [{ effect: 'starry_form' }]
        return undefined
      })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects', [], CAMPAIGN, true,
      )
    })
  })

  describe('regenerateActive clearing on long rest', () => {
    it('clears regenerateActive from all store keys on long rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'regenerateActive') return true
        if (key === 'hitPoints') return 50
        return undefined
      })
      vi.mocked(getAllStoreKeys).mockReturnValue(['Char1', 'Char2'])
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith('Char1', 'regenerateActive', false, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith('Char1', 'currentHitPoints', 50, CAMPAIGN)
    })
  })

  describe('True Polymorph on long rest', () => {
    it('removes true_polymorph summoned creatures on long rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getCombatSummary).mockReturnValue({
        creatures: [
          { name: 'Summon1', summonSource: 'true_polymorph' },
          { name: 'Normal1' },
        ],
      })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)
      expect(storageService.default.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), CAMPAIGN)
    })

    it('handles object transforms on long rest', async () => {
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
      await applyLongRest(stats, CAMPAIGN)
      expect(storageService.default.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), CAMPAIGN)
    })
  })

  describe('Spell Thief caster block on long rest', () => {
    it('updates caster block lists on long rest when entries remain', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_spellThiefBlockedList') return JSON.stringify([
          { casterName: 'Caster1', spellName: 'Fireball' },
          { casterName: 'Caster2', spellName: 'Witch Bolt' },
        ])
        if (key === '_spellThiefStolenList') return '[]'
        if (key === '_spellThiefCasterBlock') return JSON.stringify([
          { thiefName: 'Test Hero', spellName: 'Fireball' },
          { thiefName: 'OtherThief', spellName: 'Lightning Bolt' },
        ])
        return undefined
      })
      const stats = makeStats({
        automation: { reactions: [{ type: 'spell_thief' }] },
      })
      await applyLongRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Caster1', '_spellThiefCasterBlock',
        JSON.stringify([{ thiefName: 'OtherThief', spellName: 'Lightning Bolt' }]),
        CAMPAIGN,
      )
    })
  })

  describe('long rest logging', () => {
    it('logs Replenishing Meals in long rest log when feature exists', async () => {
      vi.clearAllMocks()
      const chefStats = makeStats({
        proficiency: 3,
        automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' }] },
      })
      await applyLongRest(chefStats, CAMPAIGN)
      expect(addEntry).toHaveBeenCalledWith(
        CAMPAIGN,
        expect.objectContaining({
          type: 'long_rest',
          message: expect.stringContaining('Replenishing Meals'),
        }),
      )
    })

    it('logs long rest with basic message when no special features', async () => {
      vi.clearAllMocks()
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)
      expect(addEntry).toHaveBeenCalledWith(
        CAMPAIGN,
        expect.objectContaining({
          type: 'long_rest',
          message: expect.stringContaining('takes a long rest'),
        }),
      )
    })
  })

  describe('long rest error handling', () => {
    it('catches and logs addEntry errors on long rest', async () => {
      vi.clearAllMocks()
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(addEntry).mockImplementation(() => { throw new Error('Log failed') })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)
      expect(mockConsoleError).toHaveBeenCalledWith(
        '[restRules] Failed to log long rest:',
        'Log failed',
      )
      mockConsoleError.mockRestore()
    })
  })
})
