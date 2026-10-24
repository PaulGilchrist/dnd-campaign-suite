// @maintained-by-ai
// LONG-REST BASE LANE: atomic batch reset (HP/slots/hit dice + the generic
// null-everything batch over every registered LONG_REST_RESOURCES key — this file's
// full-set proof subsumes all single-key echo lanes, #1301/#1306/#1311), exhaustion
// step-down, per-feature flag resets, Portent/Arcane Ward/Bastion/Stonecunning/
// Adrenaline/Overchannel, Signature Spells, Magic Initiate + FT-070 Shadow Magic
// per-spell bytes, Vow of Enmity, Spell Thief batch tracking + caster-null branch,
// campaign targetEffects stateful survivors, Wild Shape cleanup, regenerateActive
// clearing (cited owner: restRules-longRest-special.test.js:8-10), invisibility end,
// and Celestial Resilience self/allies/error paths.
// NOT re-run here (owned by gated special lanes): FT-035 Fey Magic latch bytes
// (restRules-constants.ft035-fey-touched.test.js), CLA-308 _Shadow_Arts_ per-spell
// (restRules-longRest.shadowArts.test.js), FT-068 quickRitual
// (restRules-longRest.ritualMaster.test.js), SP-091 prayerOfHealingAffected
// (restRules-longRest.sp091-prayer-latch.test.js), FT-015 boonOfRecovery latches
// (restRules-longRest.boonOfRecoveryFT015.test.js), CLA-388 _Wild_Companion_freeCast
// (restRules-longRest.wildCompanion.test.js), campaign-row full-residue + chef log
// lines + caster-block prune (restRules-longRest-special.test.js).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyLongRest } from './restRules.js'
import { getLongRestResources } from './restRules-constants.js'

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

function celestialStats(overrides = {}) {
  return makeStats({
    class: { name: 'Warlock', subclass: { name: 'Celestial Patron' }, major: { name: 'Celestial Patron' } },
    level: 6,
    abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Charisma', bonus: 4 }],
    specialActions: [{ name: 'Celestial Resilience' }],
    ...overrides,
  })
}

// The atomic batch for `name` — arity contract (name, charData, campaign) included.
function batchFor(name) {
  const call = vi.mocked(setRuntimeBatch).mock.calls.find(c => c[0] === name)
  expect(call, `${name} long rest must fire one atomic batch`).toBeTruthy()
  return call[1]
}

// Arity-safe writer-set: every standalone setRuntimeValue key written for `name`.
function writeKeys(filter) {
  return vi.mocked(setRuntimeValue).mock.calls.filter(filter).map(c => c[1]).sort()
}

describe('applyLongRest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Canonical baseline: every lane re-seeds what it needs, nothing leaks between runs.
    vi.mocked(getRuntimeValue).mockImplementation(() => undefined)
    vi.mocked(getCombatSummary).mockReturnValue(null)
    vi.mocked(rollD20).mockReturnValue(10)
    vi.mocked(addEntry).mockReturnValue(Promise.resolve({}))
    vi.mocked(grantCelestialResilience).mockReturnValue(null)
  })

  describe('atomic batch reset', () => {
    it('fully restores HP, spell slots and hit dice and null-re-arms every registered LONG_REST_RESOURCES key in one batch', async () => {
      // CLA-050 _circleOfTheLandType, CLA-293 _RendMind_Used, psychicveilUses,
      // wardingflareUses, naturalRecovery*, channelDivinityCharges, focusPoints,
      // ragePoints, sorceryPoints, illusorySelfUses... all rest on this one
      // registration-membership proof: buildLongRestCharData nulls EVERY
      // LONG_REST_RESOURCES key, so single-key echo tests add nothing (#1301).
      const stats = makeStats({
        specialActions: [{ name: 'Resourceful' }],
        spellAbilities: {
          spell_slots_level_1: 4,
          spell_slots_level_2: 3,
          spell_slots_level_3: 3,
        },
      })
      const result = await applyLongRest(stats, CAMPAIGN)
      expect(result).toEqual({ celestialResilienceAllies: null })
      expect(clearAllExpirationEffects).toHaveBeenCalledWith('Test Hero', CAMPAIGN)

      const data = batchFor('Test Hero')
      expect(data.currentHitPoints).toBe(50)
      expect(data.tempHp).toBeNull()
      expect(data.shortRestHitDice).toBe(5)
      expect(data.spell_slots_level_1).toBe(4)
      expect(data.spell_slots_level_2).toBe(3)
      expect(data.spell_slots_level_3).toBe(3)
      // Unset slot levels are skipped, not fabricated
      expect(data).not.toHaveProperty('spell_slots_level_4')
      // Full-set registration membership: every LONG_REST_RESOURCES key -> null
      for (const key of getLongRestResources()) {
        expect(data, `${key} must be null-re-armed in the batch`).toHaveProperty(key, null)
      }
      // Badges/conditions cleared inside the SAME atomic write (SSE echo correctness)
      expect(data.activeBuffs).toEqual([])
      expect(data.activeConditions).toEqual([])
      expect(data.activeConditionMeta).toEqual({})
      // Resourceful (Human 2024) re-grants Heroic Inspiration via the batch
      expect(data.hasInspiration).toBe(true)
      // Not exhausted (undefined) -> exhaustion key absent
      expect(data).not.toHaveProperty('exhaustionLevel')

      // Level-scaled hit dice (guards a hardcoded count) without Resourceful
      await applyLongRest(makeStats({ name: 'Veteran', level: 15, specialActions: [] }), CAMPAIGN)
      const vet = batchFor('Veteran')
      expect(vet.shortRestHitDice).toBe(15)
      expect(vet.currentHitPoints).toBe(50)
      expect(vet).not.toHaveProperty('hasInspiration')
      expect(vet).not.toHaveProperty('spell_slots_level_1')
    })
  })

  describe('exhaustion handling', () => {
    it('steps exhaustion down by 1 when exhausted and leaves level 0 untouched', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
        key === 'exhaustionLevel' ? 2 : undefined)
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(batchFor('Test Hero').exhaustionLevel).toBe(1)

      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
        key === 'exhaustionLevel' ? 0 : undefined)
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(batchFor('Test Hero')).not.toHaveProperty('exhaustionLevel')
    })
  })

  describe('Chef Bolstering Treats (cited by restRules-longRest-special.test.js)', () => {
    it('re-arms the craft count to proficiency for holders only', async () => {
      await applyLongRest(makeStats({
        proficiency: 4,
        automation: { specialActions: [{ type: 'temp_hp_buff', name: 'Bolstering Treats' }] },
      }), CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'chefBolsteringTreats', 4, CAMPAIGN, true)

      vi.clearAllMocks()
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Test Hero', 'chefBolsteringTreats', expect.anything(), CAMPAIGN, expect.anything(),
      )
    })
  })

  describe('Divine Intervention Wish cooldown', () => {
    it('decrements a live cooldown, refunds uses only while cooldown remains, and never touches inactive cooldowns', async () => {
      // cooldown 3 -> 2, and the once-per-cooldown divineInterventionUses refund (-1)
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
        key === '_divineInterventionWishCooldown' ? 3 : undefined)
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', '_divineInterventionWishCooldown', 2, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'divineInterventionUses', -1, CAMPAIGN, true)

      vi.clearAllMocks()
      // final rest: cooldown 1 -> 0, NO uses refund
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
        key === '_divineInterventionWishCooldown' ? 1 : undefined)
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', '_divineInterventionWishCooldown', 0, CAMPAIGN, true)
      expect(writeKeys(c => c[1] === 'divineInterventionUses')).toHaveLength(0)

      vi.clearAllMocks()
      // inactive cooldown 0 -> no writes at all (null/undefined baseline covered by every other run)
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
        key === '_divineInterventionWishCooldown' ? 0 : undefined)
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(writeKeys(c => c[1] === '_divineInterventionWishCooldown')).toHaveLength(0)
    })
  })

  describe('per-spell and per-feature free-cast reset', () => {
    it('resets Signature Spells only when a selection exists', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
        key === 'SignatureSpells_selection' ? ['Fireball'] : undefined)
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'SignatureSpells_Fireball_used', null, CAMPAIGN, true)

      vi.clearAllMocks()
      // clearAllMocks keeps mockImplementation — re-seed the empty-store baseline
      vi.mocked(getRuntimeValue).mockImplementation(() => undefined)
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(writeKeys(c => String(c[1]).includes('SignatureSpells'))).toHaveLength(0)
    })

    it('re-arms Magic Initiate, CLA-252 Phantasmal Creatures and FT-070 Shadow Magic counters with no surplus writes', async () => {
      // FT-035 Fey Magic latch bytes are owned by restRules-constants.ft035-fey-touched
      // .test.js (#1306); _Shadow_Arts_ per-spell by the shadowArts lane (#1310).
      // This run pins the remaining consumer keys of resetPerSpellFreeCastCounters and
      // resetMagicInitiateFreeCasts, incl. the _phantasmalCreatures_list clear.
      const stats = makeStats({
        automation: {
          specialActions: [{
            type: 'free_spell',
            name: 'Shadow Magic',
            spell: ['Shadow of Moil', 'Invisibility'],
            uses: 1,
            recharge: 'long_rest',
            perSpellTracking: true,
          }],
          passives: [
            {
              type: 'phantasmal_creatures',
              name: 'Phantasmal Creatures',
              freeCastSpells: ['Summon Beast', 'Summon Fey'],
              usesMax: 1,
              recharge: 'long_rest',
              halvesHp: true,
            },
            { type: 'natural_recovery' },
          ],
        },
      })
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_magicInitiateInstances') return [{ spellName: 'Firebolt' }, { spellName: 'Light' }]
        return undefined
      })
      await applyLongRest(stats, CAMPAIGN)

      // CLA-252 / #1311 pins: per-spell free-cast counters re-arm to null (available)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', '_Phantasmal_Creatures_Summon_Beast_freeCastCount', null, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', '_Phantasmal_Creatures_Summon_Fey_freeCastCount', null, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', '_phantasmalCreatures_list', [], CAMPAIGN, true)
      // FT-070 pins (cited by restRules-longRest.shadowArts.test.js bait fixture)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', '_Shadow_Magic_Shadow_of_Moil_freeCastCount', null, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', '_Shadow_Magic_Invisibility_freeCastCount', null, CAMPAIGN, true)
      // Magic Initiate: one latch per instance, keyed by synthesized feature name
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', '_Level_1_Spell_[Instance_1]_freeCastCount', null, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', '_Level_1_Spell_[Instance_2]_freeCastCount', null, CAMPAIGN, true)
      // Full writer-set: the free-cast keys above + the unconditional Favored Enemy
      // and FT-035 shared-latch writes (:689 fires every rest; its byte contract is
      // owned by the ft035 lane) — proves no spell-name drift, no surplus writes.
      expect(writeKeys(c =>
        c[0] === 'Test Hero' && String(c[1]).endsWith('_freeCastCount') && c[2] === null && c[4] === true,
      )).toEqual([
        '_Favored_Enemy_freeCastCount',
        '_Fey_Magic_freeCastCount',
        '_Level_1_Spell_[Instance_1]_freeCastCount',
        '_Level_1_Spell_[Instance_2]_freeCastCount',
        '_Phantasmal_Creatures_Summon_Beast_freeCastCount',
        '_Phantasmal_Creatures_Summon_Fey_freeCastCount',
        '_Shadow_Magic_Invisibility_freeCastCount',
        '_Shadow_Magic_Shadow_of_Moil_freeCastCount',
      ])
      // Natural Recovery's only LR observable at this seam is its log line
      // (the batch keys come from registration, covered by the base batch test)
      expect(addEntry).toHaveBeenCalledWith(
        CAMPAIGN,
        expect.objectContaining({
          type: 'long_rest',
          message: expect.stringContaining('Natural Recovery (spell slots)'),
        }),
      )
    })
  })

  describe('Natural Recovery tracking reset (#1312 — batch-carried, post-batch dead call removed)', () => {
    // The reset keys naturalRecoveryFreeCast/naturalRecoveryFreeCastUsed/
    // naturalRecoverySlots are registered in LONG_REST_RESOURCES
    // (restRules-constants.js:179-181) and buildLongRestCharData nulls every
    // registered key (:65-67) BEFORE setRuntimeBatch fires (:623). The old
    // resetNaturalRecoveryTracking(charData) at :648-654 mutated the ALREADY
    // flushed payload object after the batch — it reached no server/SSE carrier
    // (charData is never re-batched) and wrote byte-identical nulls to what the
    // registration already carried: a dead call. The hasNaturalRecovery flag it
    // shared stays live — it drives the 'Natural Recovery (spell slots)' log line.
    const NR_KEYS = ['naturalRecoveryFreeCast', 'naturalRecoveryFreeCastUsed', 'naturalRecoverySlots']

    function nrDruidStats(overrides = {}) {
      return makeStats({
        class: { name: 'Druid', subclass: { name: 'Circle of the Land' }, major: { name: 'Circle of the Land' } },
        automation: { passives: [{ type: 'natural_recovery' }] },
        ...overrides,
      })
    }

    it('#1348 form: spent pre-rest tracking lands as exact null reset bytes inside the flushed payload, batch fired once BEFORE the log', async () => {
      // Pre-rest non-null spent state on the store (registration path must overwrite it).
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'naturalRecoveryFreeCast') return ['Fireball']
        if (key === 'naturalRecoveryFreeCastUsed') return true
        if (key === 'naturalRecoverySlots') return 2
        return undefined
      })
      // Flush-time ledger: deep-snapshot charData at the setRuntimeBatch call seam —
      // whatever is in this snapshot is exactly what reaches server/SSE.
      let flushed
      vi.mocked(setRuntimeBatch).mockImplementation((_name, data) => {
        flushed = JSON.parse(JSON.stringify(data))
      })
      await applyLongRest(nrDruidStats(), CAMPAIGN)

      // Reset bytes present AT FLUSH TIME (mutation-before-flush): builder nulls
      // ride the payload; no post-flush mutation is required for correctness.
      for (const key of NR_KEYS) {
        expect(flushed, `${key} must be null-re-armed in the flushed batch`).toHaveProperty(key, null)
      }
      // Order ledger: ONE atomic flush, and it precedes the long_rest log entry.
      expect(setRuntimeBatch).toHaveBeenCalledTimes(1)
      expect(setRuntimeBatch.mock.invocationCallOrder[0])
        .toBeLessThan(addEntry.mock.invocationCallOrder[0])
      // No-double-write guard: the batch is the SOLE carrier for these keys —
      // no standalone setRuntimeValue re-writes anywhere, before or after flush.
      expect(vi.mocked(setRuntimeValue).mock.calls.filter(c => NR_KEYS.includes(c[1]))).toHaveLength(0)
      // Dead-call regression guard (#1312): the flushed payload object is byte-stable
      // after applyLongRest resolves — nothing mutates charData post-flush anymore.
      expect(setRuntimeBatch.mock.calls[0][1]).toEqual(flushed)
    })

    it('log flag stays live for holders and is absent for non-holders, with no NR key writes either way', async () => {
      await applyLongRest(nrDruidStats(), CAMPAIGN)
      expect(addEntry).toHaveBeenCalledWith(
        CAMPAIGN,
        expect.objectContaining({
          type: 'long_rest',
          message: expect.stringContaining('Natural Recovery (spell slots)'),
        }),
      )

      vi.clearAllMocks()
      // clearAllMocks keeps implementations — re-seed the empty-store baseline
      vi.mocked(getRuntimeValue).mockImplementation(() => undefined)
      vi.mocked(addEntry).mockReturnValue(Promise.resolve({}))
      await applyLongRest(makeStats(), CAMPAIGN)
      const msg = addEntry.mock.calls.find(c => c[1]?.type === 'long_rest')?.[1]?.message ?? ''
      expect(msg).not.toContain('Natural Recovery (spell slots)')
      // Non-holder: registration nulls still re-arm the keys in the batch, but no
      // stray standalone writes ever existed for these keys (dead call confirmed).
      for (const key of NR_KEYS) {
        expect(batchFor('Test Hero')).toHaveProperty(key, null)
      }
      expect(vi.mocked(setRuntimeValue).mock.calls.filter(c => NR_KEYS.includes(c[1]))).toHaveLength(0)
    })
  })

  describe('Portent dice', () => {
    it('refreshes 2 dice below level 14 and 3 at 14+ for specialActions holders', async () => {
      const stats = makeStats({ automation: { specialActions: [{ type: 'portent' }] } })
      await applyLongRest(stats, CAMPAIGN)
      expect(rollD20).toHaveBeenCalledTimes(2)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'portentDice', JSON.stringify([10, 10]), CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'portentUsedThisTurn', null, CAMPAIGN, true)

      vi.clearAllMocks()
      await applyLongRest(makeStats({
        level: 14,
        automation: { specialActions: [{ type: 'portent', name: 'Portent' }] },
      }), CAMPAIGN)
      expect(rollD20).toHaveBeenCalledTimes(3)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'portentDice', JSON.stringify([10, 10, 10]), CAMPAIGN, true)
    })

    it('detects Portent via 5e passives and never rolls for non-holders', async () => {
      await applyLongRest(makeStats({
        automation: { passives: [{ type: 'passive_buff', name: 'Portent', effect: 'portent_d20_pool' }] },
      }), CAMPAIGN)
      expect(rollD20).toHaveBeenCalledTimes(2)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'portentDice', JSON.stringify([10, 10]), CAMPAIGN, true)

      vi.clearAllMocks()
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(rollD20).not.toHaveBeenCalled()
      expect(writeKeys(c => c[1] === 'portentDice')).toHaveLength(0)
    })
  })

  describe('Arcane Ward', () => {
    it('restores the ward to full (2*level + INT) for Abjurers and writes nothing for other wizards', async () => {
      await applyLongRest(makeStats({
        class: { name: 'Wizard', subclass: { name: 'Abjuration' }, class_levels: [{ level: 5 }] },
        abilities: [{ name: 'Intelligence', bonus: 3 }],
        automation: { passives: [{ type: 'arcane_ward', name: 'Arcane Ward' }] },
      }), CAMPAIGN)
      const wardMax = 13
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'arcaneWardActive', false, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'arcaneWardHp', wardMax, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'arcaneWardMax', wardMax, CAMPAIGN, true)

      vi.clearAllMocks()
      await applyLongRest(makeStats({
        class: { name: 'Wizard', subclass: { name: 'Evocation' }, class_levels: [{ level: 5 }] },
        abilities: [{ name: 'Intelligence', bonus: 3 }],
      }), CAMPAIGN)
      expect(writeKeys(c => String(c[1]).startsWith('arcaneWard'))).toHaveLength(0)
    })
  })

  describe('system features reset', () => {
    it('resets Bastion of Law (caster and ward target), Stonecunning, Adrenaline Rush and Overchannel', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
        key === 'bastionOfLawWardTarget' ? 'WardTarget' : undefined)
      await applyLongRest(makeStats(), CAMPAIGN)

      // Bastion of Law — caster side
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'bastionOfLawActive', false, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'bastionOfLawWardDice', [], CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'bastionOfLawWardTarget', null, CAMPAIGN, true)
      // Bastion of Law — ward target side
      expect(setRuntimeValue).toHaveBeenCalledWith('WardTarget', 'bastionOfLawActive', false, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('WardTarget', 'bastionOfLawWardDice', [], CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('WardTarget', 'bastionOfLawWardSource', null, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('WardTarget', 'bastionOfLawWardUsed', null, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('WardTarget', 'bastionOfLawLastAttackDamage', null, CAMPAIGN, true)

      // Stonecunning / Adrenaline Rush / Overchannel
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'stonecunningUses', null, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'stonecunningRestTimestamp', null, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'adrenalineRushUses', null, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'adrenalineRushRestTimestamp', null, CAMPAIGN, true)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'Overchannel_useCount', 0, CAMPAIGN, true)

      // No ward target -> no WardTarget writes, caster reset still fires
      vi.clearAllMocks()
      vi.mocked(getRuntimeValue).mockImplementation(() => undefined)
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'bastionOfLawActive', false, CAMPAIGN, true)
      expect(vi.mocked(setRuntimeValue).mock.calls.filter(c => c[0] === 'WardTarget')).toHaveLength(0)
    })

    it('nulls long-rest post-cast rider keys and leaves short-rest/unsaved riders out of the batch', async () => {
      await applyLongRest(makeStats({
        automation: {
          passives: [
            { type: 'post_cast_rider', riderSave: { recharge: 'long_rest' }, name: 'Beguiling Magic' },
            { type: 'passive_rule', riderSave: { recharge: 'long_rest' }, name: 'SomeRider' },
            // bait negatives: wrong recharge and missing riderSave
            { type: 'post_cast_rider', riderSave: { recharge: 'short_rest' }, name: 'Shorty' },
            { type: 'passive_rule', name: 'NoSave' },
          ],
        },
      }), CAMPAIGN)
      const updates = batchFor('Test Hero')
      expect(updates.postCastRider_Beguiling_Magic).toBeNull()
      expect(updates.postCastRider_SomeRider).toBeNull()
      expect(updates).not.toHaveProperty('postCastRider_Shorty')
      expect(updates).not.toHaveProperty('postCastRider_NoSave')
    })
  })

  describe('Vow of Enmity', () => {
    it('strips the vow buff from the marked enemy — nothing else written to it', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'vowOfEnmityTarget') return 'Enemy2'
        if (key === 'activeBuffs') return [{ effect: 'vow_of_enmity' }, { effect: 'haste' }]
        return undefined
      })
      await applyLongRest(makeStats(), CAMPAIGN)
      // Exact full writer-set for the marked enemy: only the filtered buff list.
      // fix#354(b) site 2/4 valid-arm: validate-first keeps filter+write VERBATIM.
      expect(vi.mocked(setRuntimeValue).mock.calls.filter(c => c[0] === 'Enemy2'))
        .toEqual([['Enemy2', 'activeBuffs', [{ effect: 'haste' }], CAMPAIGN]])
    })

    // fix#354(b) site 2/4 non-array-store arms (fix#337S stamp ledger :1817):
    // invalid store -> LOUD console.error + ZERO writes to the enemy; pre-fix
    // `|| []` clobbered a missing store with [] / TypeError'd mid-rewrite on
    // non-array truthy.
    it.each([
      ['missing (null) store', null],
      ['non-array truthy store', 'corrupt'],
    ])('vow target %s: LOUD console.error + ZERO Enemy2 writes', async (_desc, stored) => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(getRuntimeValue).mockImplementation((n, key) => {
        if (key === 'vowOfEnmityTarget') return 'Enemy2'
        if (key === 'activeBuffs') return n === 'Enemy2' ? stored : []
        return undefined
      })
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(consoleSpy).toHaveBeenCalledWith(
        '[restRules] Refusing vow_of_enmity activeBuffs rewrite — stored activeBuffs is not an array:',
        'Enemy2', stored,
      )
      expect(vi.mocked(setRuntimeValue).mock.calls.filter(c => c[0] === 'Enemy2')).toHaveLength(0)
      consoleSpy.mockRestore()
    })
  })

  describe('Spell Thief (cited by restRules-longRest-special.test.js)', () => {
    it('re-arms uses to 1, clears blocked/stolen tracking in the batch, and nulls the caster block', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_spellThiefBlockedList') return JSON.stringify([{ casterName: 'Caster1', spellName: 'Fireball' }])
        if (key === '_spellThiefStolenList') return JSON.stringify([{ casterName: 'Caster2', spellName: 'Witch Bolt' }])
        if (key === '_spellThiefCasterBlock') return JSON.stringify([{ thiefName: 'Test Hero', spellName: 'Fireball' }])
        return undefined
      })
      await applyLongRest(makeStats({ automation: { reactions: [{ type: 'spell_thief' }] } }), CAMPAIGN)
      const updates = batchFor('Test Hero')
      // Override beats the generic registration null: thief starts fresh at 1 use.
      expect(updates.spellthiefUses).toBe(1)
      expect(updates.spellThiefBlocked_Caster1_Fireball).toBeNull()
      expect(updates['spellThiefStolen_Caster2_Witch Bolt']).toBeNull()
      expect(updates._spellThiefBlockedList).toBeNull()
      expect(updates._spellThiefStolenList).toBeNull()
      // Last thief entry pruned -> caster block goes fully null
      expect(setRuntimeValue).toHaveBeenCalledWith('Caster1', '_spellThiefCasterBlock', null, CAMPAIGN)
    })
  })

  describe('campaign targetEffects survivors', () => {
    it('drops every summon and long-rest row down to only unrelated effects', async () => {
      // Stateful campaign store (longRest-special precedent): each read/filter/write
      // advances the store, so final residue proves BOTH the unconditional
      // summon-row filter (:90-93, unique to this lane) and the row-clear loop.
      let tes = [
        { effect: 'globe_barrier' },
        { effect: 'antimagic_field' },
        { effect: 'protection_from_evil_and_good' },
        { effect: 'forcecage' },
        { effect: 'polymorph' },
        { effect: 'animal_shapes' },
        { effect: 'true_polymorph' },
        { effect: 'object_transform' },
        { effect: 'shapechange' },
        { effect: 'clairvoyant_combatant' },
        { effect: 'bless' },
      ]
      vi.mocked(getRuntimeValue).mockImplementation((name, key) =>
        (name === 'campaign' && key === 'targetEffects') ? tes : undefined)
      vi.mocked(setRuntimeValue).mockImplementation((name, key, value) => {
        if (name === 'campaign' && key === 'targetEffects') tes = value
      })
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(tes).toEqual([{ effect: 'bless' }])
    })
  })

  describe('Wild Shape cleanup', () => {
    it('de-transforms the druid, keeps unrelated creatures, and re-arms its latches with exact payloads', async () => {
      let tes = [{ effect: 'wild_shape', source: 'Druid1' }]
      const cs = {
        creatures: [
          { name: 'Druid1', type: 'player', wildShapeSource: 'Druid1', beastIndex: 2, beastName: 'Bear' },
          { name: 'Normal1', type: 'npc' },
          // bait: another druid's beast form must survive this rest
          { name: 'OtherBear', type: 'npc', wildShapeSource: 'OtherDruid' },
        ],
      }
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (name === 'campaign' && key === 'targetEffects') return tes
        if (name === 'Druid1' && key === 'activeBuffs') return [{ effect: 'shape_shift' }, { effect: 'bless' }]
        return undefined
      })
      vi.mocked(setRuntimeValue).mockImplementation((name, key, value) => {
        if (name === 'campaign' && key === 'targetEffects') tes = value
      })
      vi.mocked(getCombatSummary).mockReturnValue(cs)
      // Cleanup is driven by the campaign wild_shape rows, not the resting hero's class
      await applyLongRest(makeStats(), CAMPAIGN)

      // Exact persisted combat summary: druid flags stripped, own beasts removed,
      // unrelated creatures (and another druid's bear) untouched
      expect(storageService.default.set).toHaveBeenCalledWith(
        'combatSummary',
        { creatures: [
          { name: 'Druid1', type: 'player' },
          { name: 'Normal1', type: 'npc' },
          { name: 'OtherBear', type: 'npc', wildShapeSource: 'OtherDruid' },
        ] },
        CAMPAIGN,
      )
      expect(tes).toEqual([])
      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], CAMPAIGN, true)
      // shape_shift stripped, unrelated bless buff preserved
      expect(setRuntimeValue).toHaveBeenCalledWith('Druid1', 'activeBuffs', [{ effect: 'bless' }], CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith('Druid1', 'circleFormsAC', null, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith('Druid1', 'tempHp', 0, CAMPAIGN)
    })
  })

  describe('regenerateActive clearing (cited by restRules-longRest-special.test.js)', () => {
    it('clears regen and refills HP only for regenerating string-keyed stores', async () => {
      vi.mocked(getAllStoreKeys).mockReturnValue(['Char1', 'Char2', 'Char3', 42])
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (name === 'Char1' && key === 'regenerateActive') return true
        if (name === 'Char1' && key === 'hitPoints') return 60
        if (name === 'Char3' && key === 'regenerateActive') return true
        return undefined
      })
      await applyLongRest(makeStats(), CAMPAIGN)
      // Char1: regen off + HP refilled to stored max
      expect(setRuntimeValue).toHaveBeenCalledWith('Char1', 'regenerateActive', false, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith('Char1', 'currentHitPoints', 60, CAMPAIGN)
      // Char3: regen cleared but no HP write without a stored maximum
      expect(setRuntimeValue).toHaveBeenCalledWith('Char3', 'regenerateActive', false, CAMPAIGN)
      expect(vi.mocked(setRuntimeValue).mock.calls.filter(c => c[0] === 'Char3' && c[1] === 'currentHitPoints')).toHaveLength(0)
      // Char2 (not regenerating) is never written
      expect(vi.mocked(setRuntimeValue).mock.calls.filter(c => c[0] === 'Char2')).toHaveLength(0)
    })
  })

  describe('invisibility clearing', () => {
    it('ends active Invisibility and Greater Invisibility and clears their campaign keys', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_activeInvisibility_Test Hero') return 'Caster1'
        if (key === '_activeGreaterInvisibility_Test Hero') return 'Caster1'
        return undefined
      })
      await applyLongRest(makeStats(), CAMPAIGN)
      expect(endInvisibility).toHaveBeenCalledWith('Test Hero', CAMPAIGN, 'target finished a rest')
      expect(endGreaterInvisibility).toHaveBeenCalledWith('Test Hero', CAMPAIGN, 'target finished a rest')
      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', '_activeInvisibility_Test Hero', null, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', '_activeGreaterInvisibility_Test Hero', null, CAMPAIGN)
    })
  })

  describe('Celestial Resilience', () => {
    it('grants self temp HP and logs the ability use without combat, and returns the ally modal payload when granted with allies', async () => {
      const stats = celestialStats()
      // Self-only: combat summary absent -> no ally grant round trip
      await applyLongRest(stats, CAMPAIGN)
      expect(setTempHp).toHaveBeenCalledWith('Test Hero', 10, CAMPAIGN)
      expect(addEntry).toHaveBeenCalledWith(
        CAMPAIGN,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'Test Hero',
          abilityName: 'Celestial Resilience',
          description: 'Test Hero gains 10 temporary hit points from Celestial Resilience (long rest).',
        }),
      )
      expect(grantCelestialResilience).not.toHaveBeenCalled()

      vi.clearAllMocks()
      vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] })
      vi.mocked(grantCelestialResilience).mockResolvedValue({
        allyTempHp: 5,
        allies: [{ name: 'Ally2', type: 'player' }],
        selfTempHp: 10,
        maxAllies: 5,
      })
      const result = await applyLongRest(stats, CAMPAIGN)
      expect(setTempHp).toHaveBeenCalledWith('Test Hero', 10, CAMPAIGN)
      expect(grantCelestialResilience).toHaveBeenCalledWith(stats, CAMPAIGN, 'long_rest')
      // Modal payload mapped exactly for the ally-target picker
      expect(result).toEqual({
        celestialResilienceAllies: {
          creatureTargets: [{ name: 'Ally2', type: 'player' }],
          allyTempHp: 5,
          selfTempHp: 10,
          maxTargets: 5,
        },
      })
    })

    it('survives a rejected log write and refuses a patron rest with missing level', async () => {
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const err = new Error('Log failed')
      vi.mocked(addEntry).mockReturnValue(Promise.reject(err))
      await expect(applyLongRest(celestialStats(), CAMPAIGN))
        .resolves.toEqual({ celestialResilienceAllies: null })
      expect(mockConsoleError).toHaveBeenCalledWith('[celestialResilience] Error:', err)
      mockConsoleError.mockRestore()

      vi.clearAllMocks()
      // clearAllMocks keeps implementations — restore the resolving-log baseline
      vi.mocked(addEntry).mockReturnValue(Promise.resolve({}))
      // Level is required for the warlock level + CHA temp HP math — honest throw
      await expect(applyLongRest(celestialStats({ level: null }), CAMPAIGN))
        .rejects.toThrow('playerStats.level is required')
    })
  })
})
