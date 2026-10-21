// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyLongRest } from './restRules.js'

// This file owns the SPECIAL long-rest seams: named consumers inside applyLongRest
// that do more than null resource keys (Star Map/Cosmic Omen, Chef, campaign
// targetEffects rows, True Polymorph persistence, Spell Thief cross-store prune,
// log lines). Base batch/exhaustion-reset, regenerateActive clearing (:547),
// bolsteringTreats craft count (:171), Bastion of Law ward reset (:430-439) and
// Spell Thief batch tracking + null-branch (:489-511) live in restRules-longRest.test.js.

// Mock dependencies
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
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

// restRules-constants re-exports this; drives both the batch reset (base lane)
// and the 'Exhaustion: n → m' log line (this lane).
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
  // automation/index.js imports handle + confirm/skip statically — mock full surface
  handle: vi.fn(() => null),
  confirmCelestialResilience: vi.fn(() => null),
  skipCelestialResilience: vi.fn(() => null),
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
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { clearAllExpirationEffects } from './expirations.js'
import { rollD20 } from '../../../services/dice/diceRoller.js'
import { addEntry } from '../../../services/ui/logService.js'
import { getCombatSummary, setCombatSummaryCache } from '../../../services/encounters/combatData.js'
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

function starsDruid(level, wisBonus) {
  return makeStats({
    class: { name: 'Druid', major: { name: 'Circle of the Stars' } },
    level,
    abilities: [{ name: 'Wisdom', bonus: wisBonus }],
  })
}

describe('restRules - long rest special features', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRuntimeValue).mockImplementation(() => undefined)
  })

  describe('Circle of the Stars (Star Map + Cosmic Omen)', () => {
    it('arms Star Map free casts to the WIS modifier at level 3 and defers Cosmic Omen until level 6', async () => {
      await applyLongRest(starsDruid(3, 4), CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', '_Star_Map_freeCastCount', 4, CAMPAIGN, true,
      )
      // Omen guard is level 6+ — no roll, no omen ledger at level 3
      expect(rollD20).not.toHaveBeenCalled()
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Test Hero', 'cosmicOmenEffect', expect.anything(), CAMPAIGN, expect.anything(),
      )
    })

    it('clamps Star Map free casts to a minimum of 1 when WIS modifier is 0', async () => {
      await applyLongRest(starsDruid(3, 0), CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', '_Star_Map_freeCastCount', 1, CAMPAIGN, true,
      )
    })

    it('rolls Cosmic Omen at level 6+: odd Woe, even Weal, superseding the pending global bonus', async () => {
      vi.mocked(rollD20).mockReturnValue(7)
      await applyLongRest(starsDruid(6, 4), CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'cosmicOmenEffect',
        JSON.stringify({ type: 'Woe', isEven: false, starMapRoll: 7 }),
        CAMPAIGN, true,
      )
      // CLA-065: an armed-but-unspent ±1d6 pending bonus lives under the canonical
      // global 'cosmicOmen' store — a fresh Star Map supersedes it at the seam.
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'cosmicOmen', 'cosmicOmenPendingBonus', null, CAMPAIGN, true,
      )
      expect(clearAllExpirationEffects).toHaveBeenCalledWith('Test Hero', CAMPAIGN)

      vi.mocked(rollD20).mockReturnValue(12)
      await applyLongRest(starsDruid(6, 4), CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Hero', 'cosmicOmenEffect',
        JSON.stringify({ type: 'Weal', isEven: true, starMapRoll: 12 }),
        CAMPAIGN, true,
      )
      // exactly one Star Map roll per long rest
      expect(rollD20).toHaveBeenCalledTimes(2)
    })

    it('leaves no Star Map or Cosmic Omen state for ineligible characters', async () => {
      // level-2 Stars (level guard) and level-5 Land (subclass guard) —
      // the level-6 omen guard's negative is covered level 3+ above
      await applyLongRest(starsDruid(2, 4), CAMPAIGN)
      await applyLongRest(makeStats({
        class: { name: 'Druid', major: { name: 'Circle of the Land' } },
        level: 5,
        abilities: [{ name: 'Wisdom', bonus: 4 }],
      }), CAMPAIGN)
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Test Hero', '_Star_Map_freeCastCount', expect.anything(), CAMPAIGN, expect.anything(),
      )
      expect(rollD20).not.toHaveBeenCalled()
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'cosmicOmen', 'cosmicOmenPendingBonus', expect.anything(), CAMPAIGN, expect.anything(),
      )
    })
  })

  describe('Chef features on long rest', () => {
    it('resets Replenishing Meals to 4+proficiency, clears the recipient treat, and logs both chef lines', async () => {
      const chefStats = makeStats({
        proficiency: 5,
        automation: {
          passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' }],
          specialActions: [{ type: 'temp_hp_buff', name: 'Bolstering Treats' }],
        },
      })
      await applyLongRest(chefStats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'replenishingMeals', 9, CAMPAIGN, true)
      // craft-count write (chefBolsteringTreats) is owned by restRules-longRest.test.js:171
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'bolsteringTreat', null, CAMPAIGN, true)
      expect(addEntry).toHaveBeenCalledWith(
        CAMPAIGN,
        expect.objectContaining({
          type: 'long_rest',
          message: expect.stringContaining('Replenishing Meals'),
        }),
      )
      expect(addEntry).toHaveBeenCalledWith(
        CAMPAIGN,
        expect.objectContaining({
          message: expect.stringContaining('Bolstering Treats'),
        }),
      )
    })

    it('skips chef resets but still clears bolsteringTreat for characters without chef features', async () => {
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Test Hero', 'replenishingMeals', expect.anything(), CAMPAIGN, expect.anything(),
      )
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Test Hero', 'chefBolsteringTreats', expect.anything(), CAMPAIGN, expect.anything(),
      )
      // unconditionally re-armed even without the crafting feature
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'bolsteringTreat', null, CAMPAIGN, true)
    })
  })

  describe('campaign targetEffects rows', () => {
    it('clears every long-rest row down to only unrelated effects', async () => {
      // Stateful campaign store: each row read/filter/write advances the store,
      // so final residue proves a row was skipped. One entry per source row,
      // incl. the foresight multi-key row, plus hp_max_reduce without baseMax
      // (restore skipped honestly — ledger cleared with the row).
      let tes = [
        { effect: 'ability_score_drain' },
        { effect: 'hp_max_reduce' },
        { effect: 'clairvoyant_combatant' },
        { effect: 'pass_without_trace_bonus' },
        { effect: 'blur' },
        { effect: 'regenerate' },
        { effect: 'beacon_of_hope' },
        { effect: 'resistance_damage_reduction' },
        { effect: 'barkskin' },
        { effect: 'enhance_ability' },
        { effect: 'circle_of_power' },
        { effect: 'foresight' },
        { effect: 'advantage_attacks' },
        { effect: 'starry_form' },
        { effect: 'bless' },
      ]
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => (key === 'targetEffects' ? tes : undefined))
      vi.mocked(setRuntimeValue).mockImplementation((name, key, value) => {
        if (name === 'campaign' && key === 'targetEffects') tes = value
      })
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(tes).toEqual([{ effect: 'bless' }])
    })

    it('does not write skipSync targetEffects clears when no campaign effect matches a row', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
        key === 'targetEffects' ? [{ effect: 'bless' }] : undefined)
      await applyLongRest(makeStats(), CAMPAIGN)
      // row filter is arity-safe (writes only when the list actually shrinks);
      // clearLongRestSummonEffects' unconditional write is 4-arg and does not match
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'campaign', 'targetEffects', expect.any(Array), CAMPAIGN, true,
      )
    })
  })

  describe('True Polymorph summons and object transforms', () => {
    it('removes true_polymorph summons and restores object transforms in the persisted combat summary', async () => {
      const cs = {
        creatures: [
          { name: 'Summon1', summonSource: 'true_polymorph' },
          {
            name: 'Transformed1',
            maxHp: 50, ac: 15, speed: 30,
            polymorphObject: { maxHp: 50, ac: 15, speed: 30 },
            polymorphOriginal: { maxHp: 90, ac: 12, speed: 30 },
            objectType: 'chest',
          },
          { name: 'Normal1' },
        ],
      }
      vi.mocked(getCombatSummary).mockReturnValue(cs)
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
        key === 'activeConditions' ? ['incapacitated', 'blinded'] : undefined)
      await applyLongRest(makeStats(), CAMPAIGN)
      const persisted = storageService.default.set.mock.calls.at(-1)[1]
      expect(persisted.creatures.map(c => c.name)).toEqual(['Transformed1', 'Normal1'])
      const restored = persisted.creatures[0]
      expect({ maxHp: restored.maxHp, ac: restored.ac, speed: restored.speed })
        .toEqual({ maxHp: 90, ac: 12, speed: 30 })
      expect(restored.polymorphObject).toBeUndefined()
      expect(restored.objectType).toBeUndefined()
      // object-form incapacitation ends with the transform; other conditions stay
      expect(setRuntimeValue).toHaveBeenCalledWith('Transformed1', 'activeConditions', ['blinded'], CAMPAIGN)
      expect(setCombatSummaryCache).toHaveBeenCalledWith(persisted, CAMPAIGN)
    })
  })

  describe('Spell Thief caster block prune', () => {
    it('removes the resting thief entries from caster block lists — filtered JSON when others remain, null when empty', async () => {
      const blockedLists = {
        Caster1: JSON.stringify([
          { thiefName: 'Test Hero', spellName: 'Fireball' },
          { thiefName: 'OtherThief', spellName: 'Lightning Bolt' },
        ]),
        Caster2: JSON.stringify([{ thiefName: 'Test Hero', spellName: 'Lightning Bolt' }]),
      }
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (name === 'Test Hero' && key === '_spellThiefBlockedList') {
          return JSON.stringify([
            { casterName: 'Caster1', spellName: 'Fireball' },
            { casterName: 'Caster2', spellName: 'Lightning Bolt' },
          ])
        }
        if (name === 'Test Hero' && key === '_spellThiefStolenList') return '[]'
        if (key === '_spellThiefCasterBlock') return blockedLists[name]
        return undefined
      })
      const thiefStats = makeStats({ automation: { reactions: [{ type: 'spell_thief' }] } })
      await applyLongRest(thiefStats, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Caster1', '_spellThiefCasterBlock',
        JSON.stringify([{ thiefName: 'OtherThief', spellName: 'Lightning Bolt' }]),
        CAMPAIGN,
      )
      expect(setRuntimeValue).toHaveBeenCalledWith('Caster2', '_spellThiefCasterBlock', null, CAMPAIGN)

      // a character without the Spell Thief reaction never touches caster lists
      vi.clearAllMocks()
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Caster1', '_spellThiefCasterBlock', expect.anything(), CAMPAIGN,
      )
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Caster2', '_spellThiefCasterBlock', expect.anything(), CAMPAIGN,
      )
    })
  })

  describe('long rest log', () => {
    it('logs the basic long rest message and reports exhaustion reduction at the seam', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
        key === 'exhaustionLevel' ? 2 : undefined)
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(addEntry).toHaveBeenCalledWith(
        CAMPAIGN,
        expect.objectContaining({
          type: 'long_rest',
          message: expect.stringContaining('Test Hero takes a long rest.'),
        }),
      )
      // getLevelAfterLongRest mock: 2 → 1 (batch reset itself is base-lane)
      expect(addEntry.mock.calls.at(-1)[1].message).toContain('Exhaustion: 2 → 1')

      // no exhaustion line when the hero is not exhausted
      vi.mocked(getRuntimeValue).mockImplementation(() => undefined)
      await applyLongRest(makeStats(), CAMPAIGN)
      const second = addEntry.mock.calls.at(-1)[1]
      expect(second.message).toContain('takes a long rest')
      expect(second.message).not.toContain('Exhaustion:')
    })
  })

  describe('long rest error handling', () => {
    it('catches and logs addEntry errors so the completed rest never throws', async () => {
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(addEntry).mockImplementation(() => { throw new Error('Log failed') })
      await expect(applyLongRest(makeStats(), CAMPAIGN)).resolves.toBeDefined()
      expect(mockConsoleError).toHaveBeenCalledWith(
        '[restRules] Failed to log long rest:',
        'Log failed',
      )
      mockConsoleError.mockRestore()
    })
  })
})
