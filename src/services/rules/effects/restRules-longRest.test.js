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
import { getRuntimeValue, setRuntimeBatch, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js'
import { clearAllExpirationEffects } from './expirations.js'
import { rollD20 } from '../../../services/dice/diceRoller.js'
import { addEntry } from '../../../services/ui/logService.js'
import { getCombatSummary } from '../../../services/encounters/combatData.js'
import { grantCelestialResilience } from '../../../services/automation/handlers/class-warlock/celestialResilienceHandler.js'
import { setTempHp } from '../../../services/automation/handlers/buffs/tempHpService.js'
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

describe('applyLongRest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
      if (key === 'bastionOfLawWardTarget') return 'WardTarget';
      return undefined;
    })
  })

  describe('basic reset', () => {
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
      expect(data.illusorySelfUses).toBeNull()
      // CLA-293: Rend Mind latch re-arms via LONG_REST_RESOURCES
      expect(data._RendMind_Used).toBeNull()
      expect(data.activeBuffs).toEqual([])
      expect(data.activeConditions).toEqual([])
    })

    it('restores hit dice equal to character level', async () => {
      const stats = makeStats({ level: 15 })
      await applyLongRest(stats, CAMPAIGN)
      expect(getBatchUpdates().shortRestHitDice).toBe(15)
    })
  })

  describe('exhaustion handling', () => {
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
  })

  describe('feature-specific benefits', () => {
    it('grants feature-specific benefits on long rest', async () => {
      // Heroic Inspiration from Resourceful
      const stats1 = makeStats({ specialActions: [{ name: 'Resourceful' }] })
      await applyLongRest(stats1, CAMPAIGN)
      expect(getBatchUpdates().hasInspiration).toBe(true)

      // Chef Bolstering Treats
      vi.clearAllMocks()
      const chefStats = makeStats({
        proficiency: 4,
        automation: { specialActions: [{ type: 'temp_hp_buff', name: 'Bolstering Treats' }] },
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
      expect(setTempHp).toHaveBeenCalledWith('Test Hero', 10, CAMPAIGN)

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

    it('resets psychicveilUses (Psychic Veil once-per-long-rest) to null on long rest', async () => {
      vi.clearAllMocks()
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(getBatchUpdates().psychicveilUses).toBeNull()
    })
  })

  describe('Divine Intervention Wish cooldown', () => {
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
  })

  describe('per-spell and per-feature tracking reset', () => {
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
      // CLA-252: per-spell free-cast counters re-arm (null = available) on long rest
      const phantasmalStats = makeStats({
        automation: {
          passives: [{
            type: 'phantasmal_creatures',
            name: 'Phantasmal Creatures',
            freeCastSpells: ['Summon Beast', 'Summon Fey'],
            usesMax: 1,
            recharge: 'long_rest',
            halvesHp: true,
          }],
        },
      })
      await applyLongRest(phantasmalStats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', '_Phantasmal_Creatures_Summon_Beast_freeCastCount', null, CAMPAIGN, true,
      )
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', '_Phantasmal_Creatures_Summon_Fey_freeCastCount', null, CAMPAIGN, true,
      )
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', '_phantasmalCreatures_list', [], CAMPAIGN, true,
      )
    })
  })

  describe('Portent dice', () => {
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

    it('refreshes Portent dice when feature is in passives (5e ruleset)', async () => {
      const stats = makeStats({ automation: { passives: [{ type: 'passive_buff', name: 'Portent', effect: 'portent_d20_pool' }] } })
      await applyLongRest(stats, CAMPAIGN)

      expect(rollD20).toHaveBeenCalledTimes(2)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'portentDice', JSON.stringify([10, 10]), CAMPAIGN, true,
      )
    })

    it('refreshes 3 Portent dice at level 14+ when feature is in passives (5e ruleset)', async () => {
      const stats14 = makeStats({
        level: 14,
        automation: { passives: [{ type: 'passive_buff', name: 'Portent', effect: 'portent_d20_pool' }] },
      })
      await applyLongRest(stats14, CAMPAIGN)

      expect(rollD20).toHaveBeenCalledTimes(3)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'portentDice', JSON.stringify([10, 10, 10]), CAMPAIGN, true,
      )
    })
  })

  describe('Arcane Ward', () => {
    it('restores Arcane Ward HP to full for Abjurer on long rest', async () => {
      const abjurerStats = makeStats({
        class: { name: 'Wizard', subclass: { name: 'Abjuration' }, class_levels: [{ level: 5 }] },
        abilities: [{ name: 'Intelligence', bonus: 3 }],
        automation: { passives: [{ type: 'arcane_ward', name: 'Arcane Ward' }] },
      })
      await applyLongRest(abjurerStats, CAMPAIGN)

      const wardMax = (2 * 5) + 3
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'arcaneWardActive', false, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'arcaneWardHp', wardMax, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'arcaneWardMax', wardMax, CAMPAIGN, true)
    })

    it('does not reset Arcane Ward for non-Abjurer wizard', async () => {
      const evokerStats = makeStats({
        class: { name: 'Wizard', subclass: { name: 'Evocation' }, class_levels: [{ level: 5 }] },
        abilities: [{ name: 'Intelligence', bonus: 3 }],
      })
      await applyLongRest(evokerStats, CAMPAIGN)

      expect(setRuntimeValue).not.toHaveBeenCalledWith('Test Hero', 'arcaneWardActive', false, CAMPAIGN, true)
    })
  })

  describe('system features reset', () => {
    it('resets system features on long rest', async () => {
      await applyLongRest(makeStats(), CAMPAIGN)

      // Bastion of Law
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'bastionOfLawActive', false, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'bastionOfLawWardDice', [], CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'bastionOfLawWardTarget', null, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('WardTarget', 'bastionOfLawActive', false, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('WardTarget', 'bastionOfLawWardDice', [], CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('WardTarget', 'bastionOfLawWardSource', null, CAMPAIGN, true)

      // Arcane Ward - should NOT be called for non-Abjurer
      expect(setRuntimeValue).not.toHaveBeenCalledWith('Test Hero', 'arcaneWardActive', false, CAMPAIGN, true)

      // Stonecunning
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'stonecunningUses', null, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'stonecunningRestTimestamp', null, CAMPAIGN, true)

      // Adrenaline Rush
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'adrenalineRushUses', null, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'adrenalineRushRestTimestamp', null, CAMPAIGN, true)

      // Overchannel
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'Overchannel_useCount', 0, CAMPAIGN, true)
    })

    it('handles post-cast rider uses on long rest', async () => {
      vi.clearAllMocks()
      const stats = makeStats({
        automation: {
          passives: [
            { type: 'post_cast_rider', riderSave: { recharge: 'long_rest' }, name: 'Beguiling Magic' },
            { type: 'passive_rule', riderSave: { recharge: 'long_rest' }, name: 'SomeRider' },
          ],
        },
      })
      await applyLongRest(stats, CAMPAIGN)
      const updates = getBatchUpdates()
      expect(updates.postCastRider_Beguiling_Magic).toBeNull()
      expect(updates.postCastRider_SomeRider).toBeNull()
    })
  })

  describe('Vow of Enmity', () => {
    it('handles Vow of Enmity target buff filtering on long rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'vowOfEnmityTarget') return 'Enemy2'
        if (key === 'activeBuffs') return [{ effect: 'vow_of_enmity' }, { effect: 'haste' }]
        return undefined
      })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Enemy2', 'activeBuffs', [{ effect: 'haste' }], CAMPAIGN,
      )
    })
  })

  describe('Spell Thief', () => {
    it('handles Spell Thief on long rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_spellThiefBlockedList') return JSON.stringify([{ casterName: 'Caster1', spellName: 'Fireball' }])
        if (key === '_spellThiefStolenList') return JSON.stringify([{ casterName: 'Caster2', spellName: 'Witch Bolt' }])
        if (key === '_spellThiefCasterBlock') return JSON.stringify([{ thiefName: 'Test Hero', spellName: 'Fireball' }])
        return undefined
      })
      const stats = makeStats({
        automation: { reactions: [{ type: 'spell_thief' }] },
      })
      await applyLongRest(stats, CAMPAIGN)
      const updates = getBatchUpdates()
      expect(updates.spellthiefUses).toBe(1)
      expect(updates.spellThiefBlocked_Caster1_Fireball).toBeNull()
      expect(updates['spellThiefStolen_Caster2_Witch Bolt']).toBeNull()
      expect(updates._spellThiefBlockedList).toBeNull()
      expect(updates._spellThiefStolenList).toBeNull()
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Caster1', '_spellThiefCasterBlock', null, CAMPAIGN,
      )
    })
  })

  describe('targetEffects clearing on long rest', () => {
    it('handles targetEffects clearing on long rest when effects exist', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'targetEffects') return [{ effect: 'clairvoyant_combatant' }, { effect: 'blur' }, { effect: 'foresight' }]
        return undefined
      })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalled()
    })
  })

  describe('Wild Shape cleanup', () => {
    it('handles Wild Shape cleanup on long rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'targetEffects') return [{ effect: 'wild_shape', source: 'Druid1' }]
        if (key === 'activeBuffs') return [{ effect: 'shape_shift' }]
        return undefined
      })
      vi.mocked(getCombatSummary).mockReturnValue({
        creatures: [
          { name: 'Druid1', type: 'player', wildShapeSource: 'Druid1', beastName: 'Bear' },
          { name: 'Normal1', type: 'npc' },
        ],
      })
      const stats = makeStats({ class: { name: 'Druid' } })
      await applyLongRest(stats, CAMPAIGN)
      expect(storageService.default.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), CAMPAIGN)
    })
  })

  describe('regenerateActive clearing', () => {
    it('handles regenerateActive clearing on long rest with store keys', async () => {
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

  describe('invisibility clearing', () => {
    it('clears Invisibility on long rest when active', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_activeInvisibility_Test Hero') return 'Caster1'
        return undefined
      })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)
      expect(endInvisibility).toHaveBeenCalledWith('Test Hero', CAMPAIGN, 'target finished a rest')
    })

    it('clears Greater Invisibility on long rest when active', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_activeGreaterInvisibility_Test Hero') return 'Caster1'
        return undefined
      })
      const stats = makeStats()
      await applyLongRest(stats, CAMPAIGN)
      expect(endGreaterInvisibility).toHaveBeenCalledWith('Test Hero', CAMPAIGN, 'target finished a rest')
    })
  })

  describe('Magic Initiate/Fey Touched/Shadow Touched', () => {
    it('handles Magic Initiate/Fey Touched/Shadow Touched on long rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_magicInitiateInstances') return [{ spellName: 'Firebolt' }, { spellName: 'Light' }]
        return undefined
      })
      const stats = makeStats({
        feyTouchedSpell: 'Misty Step',
        shadowTouchedSpell: 'Shadow of Moil',
        automation: {
          actions: [],
          bonusActions: [],
          specialActions: [{
            type: 'free_spell',
            name: 'Shadow Magic',
            spell: ['Shadow of Moil', 'Invisibility'],
            uses: 1,
            recharge: 'long_rest',
            perSpellTracking: true,
          }],
          passives: [],
        },
      })
      await applyLongRest(stats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', '_Level_1_Spell_[Instance_1]_freeCastCount', null, CAMPAIGN, true,
      )
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', '_feyTouchedSpell_freeCastCount', null, CAMPAIGN, true,
      )
      // FT-070: per-spell Shadow Magic counters reset to null (fresh) on long rest
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', '_Shadow_Magic_Shadow_of_Moil_freeCastCount', null, CAMPAIGN, true,
      )
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', '_Shadow_Magic_Invisibility_freeCastCount', null, CAMPAIGN, true,
      )
    })
  })

  describe('Celestial Resilience with allies', () => {
    it('handles Celestial Resilience with combatSummary and allies on long rest', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'tempHp') return 3
        return undefined
      })
      vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] })
      vi.mocked(grantCelestialResilience).mockResolvedValue({
        allyTempHp: 5,
        allies: [{ name: 'Ally2', type: 'player' }],
        selfTempHp: 10,
        maxAllies: 5,
      })
      const celestialStats = makeStats({
        class: { name: 'Warlock', subclass: { name: 'Celestial Patron' }, major: { name: 'Celestial Patron' } },
        level: 6,
        abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Charisma', bonus: 4 }],
        specialActions: [{ name: 'Celestial Resilience' }],
      })
      await applyLongRest(celestialStats, CAMPAIGN)
      expect(setTempHp).toHaveBeenCalledWith('Test Hero', 10, CAMPAIGN)
      expect(grantCelestialResilience).toHaveBeenCalledWith(celestialStats, CAMPAIGN, 'long_rest')
      expect(addEntry).toHaveBeenCalledWith(
        CAMPAIGN,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'Test Hero',
          abilityName: 'Celestial Resilience',
          description: expect.stringContaining('10 temporary hit points'),
        }),
      )
    })

    it('handles addEntry catch on long rest celestial resilience', async () => {
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'tempHp') return 3
        return undefined
      })
      vi.mocked(addEntry).mockReturnValue(Promise.reject(new Error('Log failed')))
      const celestialStats = makeStats({
        class: { name: 'Warlock', subclass: { name: 'Celestial Patron' }, major: { name: 'Celestial Patron' } },
        level: 6,
        abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Charisma', bonus: 4 }],
        specialActions: [{ name: 'Celestial Resilience' }],
      })
      await applyLongRest(celestialStats, CAMPAIGN)
    })

    it('throws when level is missing for Celestial Resilience on long rest', async () => {
      const celestialStats = makeStats({
        class: { name: 'Warlock', subclass: { name: 'Celestial Patron' }, major: { name: 'Celestial Patron' } },
        level: null,
        specialActions: [{ name: 'Celestial Resilience' }],
      })
      await expect(applyLongRest(celestialStats, CAMPAIGN)).rejects.toThrow('playerStats.level is required')
    })
  })

  describe('CLA-050 Circle of the Land rechoice cadence', () => {
    it('clears _circleOfTheLandType in the atomic long-rest batch so the land must be re-chosen', async () => {
      vi.clearAllMocks()
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(setRuntimeBatch).toHaveBeenCalled()
      expect(getBatchUpdates()).toHaveProperty('_circleOfTheLandType')
      expect(getBatchUpdates()._circleOfTheLandType).toBeNull()
    })
  })
})
