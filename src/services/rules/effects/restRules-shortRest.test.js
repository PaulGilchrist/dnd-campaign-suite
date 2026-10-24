// @maintained-by-ai
// SHORT-REST BASE LANE (mirror of restRules-longRest.test.js): the generic
// null-everything batch — every SHORT_REST_RESOURCES key -> null in the ONE atomic
// setRuntimeBatch, alongside the HP byte and buff/condition clears — is this file's
// SINGLE registration-membership proof. All claNN echo-less SR lanes rest on it
// (cla140/cla096/cla099/cla130/cla048 single-key twins add nothing to the batch
// byte itself). Gate semantics are owned here: the skipAutoRecovery gate at
// restRules-shortRest.js:453 wraps ONLY Arcane Recovery — one gate-discipline face
// with bait inside (slots stay spent) and outside (Font of Inspiration still writes).
// CLA-226 memorizeSpellUsedSinceRest and FT-046 inspiringLeaderUsedSinceRest are
// registered-generic null-flag twins folded INTO the full-set pattern's sibling lanes
// (restRules-shortRest.cla226-memorize-spell.test.js /
// restRules-shortRest.ft046-inspiring-leader.test.js — cited, not re-run). FS-010
// fighter numeric-overwrite of superiorityDice at :440 vs the generic :75 pre-set is
// owned by restRules-shortRest.superiorityFs010.test.js — not re-run here. The
// plain (non-modal) lane Font of Inspiration restore cited by
// restRules-shortRest.cla145-font-of-inspiration.test.js:14-15 lives in the crown
// it.each below (modal lane + honest-flag faces live there). Tireless SR exhaustion
// step-down is restRules-owned (exhaustionRules.test.js is the producer lane;
// tirelessHandler.test.js owns uses, not the rest seam).
// vitest-4 clearAllMocks RETAINS implementations — beforeEach re-seeds every store.
// No timers: applyShortRest advances state only when called.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyShortRest } from './restRules.js'
import { getShortRestResources } from './restRules-constants.js'

// Mock dependencies
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
  setRuntimeBatch: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
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
import { getCombatSummary, setCombatSummaryCache } from '../../../services/encounters/combatData.js'
import { clearAllConcentrations } from '../../../services/combat/concentration/concentrationService.js'
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

function stubRuntime(map) {
  vi.mocked(getRuntimeValue).mockImplementation((_name, key) => (key in map ? map[key] : undefined))
}

// The batch of the (single) atomic write for the rest that just ran.
function batchUpdates() {
  const call = vi.mocked(setRuntimeBatch).mock.calls.at(-1)
  expect(call, 'applyShortRest must fire one atomic setRuntimeBatch').toBeTruthy()
  return call[1]
}

function arcaneLogs() {
  return vi.mocked(addEntry).mock.calls
    .map(c => c[1])
    .filter(e => e && /^arcane_recovery_/.test(e.automationType || ''))
}

// A Wizard holding BOTH gated Arcane Recovery and the UNGATED CLA-145 special —
// the gate-discipline bait fixture for the crown test.
function arcaneBard(overrides = {}) {
  return makeStats({
    class: { name: 'Wizard' },
    level: 4,
    spellAbilities: { spell_slots_level_1: 4 },
    abilities: [{ name: 'Charisma', bonus: 3 }],
    automation: {
      passives: [
        { type: 'font_of_inspiration' },
        { type: 'resource_restoration', resourceKey: 'arcaneRecoveryLevels' },
      ],
    },
    ...overrides,
  })
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

// Mirrors SHORT_REST_TARGET_EFFECT_CLEAR_KEYS (restRules-shortRest.js:27-37) —
// membership proof: every registered key must be swept, each in its own
// skipSync=true read/filter/write cycle after the batch.
const SR_TARGET_EFFECT_KEYS = [
  'clairvoyant_combatant', 'pass_without_trace_bonus', 'blur', 'regenerate',
  'beacon_of_hope', 'resistance_damage_reduction', 'barkskin', 'enhance_ability',
  'circle_of_power',
]

describe('applyShortRest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // vitest-4 re-seed: clearAllMocks retains implementations — restore the
    // undefined/empty baseline every lane relies on.
    stubRuntime({})
    vi.mocked(getCombatSummary).mockReturnValue(null)
    vi.mocked(getAllStoreKeys).mockReturnValue([])
    vi.mocked(addEntry).mockReturnValue(Promise.resolve({}))
    vi.mocked(grantCelestialResilience).mockReturnValue(null)
  })

  describe('atomic batch + skipAutoRecovery gate discipline', () => {
    it.each([
      ['plain lane: gate open — Arcane Recovery recovers and consumes budget; stored HP survives unhealed', undefined, 30, 2, 0, 1],
      ['modal lane (skipAutoRecovery:true): Arcane Recovery stays behind the gate; ungated Font of Inspiration still writes', { skipAutoRecovery: true }, 50, undefined, undefined, 0],
    ])('%s', async (_desc, options, storedHp, wantSlot, wantBudget, wantArcaneLogs) => {
      stubRuntime({
        bardicInspirationUses: 0,
        spell_slots_level_1: 0,
        ...(storedHp != null ? { currentHitPoints: storedHp } : {}),
      })
      const result = await applyShortRest(arcaneBard(), CAMPAIGN, options)

      // ONE atomic write for the whole rest — a second batch would SSE-echo.
      expect(setRuntimeBatch).toHaveBeenCalledTimes(1)
      const updates = batchUpdates()
      // No free HP at a short rest: stored HP is carried through; unset defaults to max.
      expect(updates.currentHitPoints).toBe(storedHp ?? 50)

      // Registration-membership proof: every SHORT_REST_RESOURCES key null-re-armed
      // in this batch (all claNN echo-less SR lanes rest on this loop).
      for (const key of getShortRestResources()) {
        expect(updates, `${key} must be null-re-armed in the batch`).toHaveProperty(key, null)
      }
      // Buffs/conditions cleared in the SAME atomic write (SSE echo correctness).
      expect(updates.activeBuffs).toEqual([])
      expect(updates.activeConditions).toEqual([])
      expect(updates.activeConditionMeta).toEqual({})

      // Bait OUTSIDE the gate (CLA-145): CHA max restore rides every lane, and
      // the honest label reports the actual below-max write.
      expect(updates.bardicInspirationUses).toBe(3)
      expect(result.fontOfInspirationRestored).toBe(true)

      // Bait INSIDE the gate (CLA-011): slots/budget/logs only move when gate open.
      expect(updates.spell_slots_level_1).toBe(wantSlot)
      if (wantBudget === undefined) {
        expect(updates).not.toHaveProperty('arcaneRecoveryLevels')
      } else {
        expect(updates.arcaneRecoveryLevels).toBe(wantBudget)
      }
      expect(arcaneLogs()).toHaveLength(wantArcaneLogs)

      // Standalone post-batch housekeeping.
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'resistanceUsedThisTurn', null, CAMPAIGN)
      expect(clearAllExpirationEffects).toHaveBeenCalledWith('Test Hero', CAMPAIGN)
      expect(clearAllConcentrations).toHaveBeenCalledWith(CAMPAIGN, 'Test Hero')
      expect(endInvisibility).not.toHaveBeenCalled()
      expect(endGreaterInvisibility).not.toHaveBeenCalled()
      expect(result.celestialResilienceAllies).toBeNull()
    })
  })

  describe('class numeric pool recharge (Fighter Second Wind / Barbarian 2024 Rage)', () => {
    function barbarian(rules) {
      return makeStats({
        class: { name: 'Barbarian', class_levels: [{ level: 5, rages: 2 }] },
        ...(rules ? { rules } : {}),
      })
    }

    it.each([
      ['Second Wind spent recharges exactly one use', makeStats(), 'secondWindUses', 0, 'secondWindUses', 1],
      ['Second Wind at max writes nothing', makeStats(), 'secondWindUses', 1, 'secondWindUses', undefined],
      ['no class_levels table means no max — nothing to recharge', makeStats({ class: { name: 'Fighter' } }), 'secondWindUses', 0, 'secondWindUses', undefined],
      ['Barbarian 2024 Rage recharges one use on a short rest', barbarian('2024'), 'ragePoints', 1, 'ragePoints', 2],
      ['Barbarian 2024 Rage at max writes nothing', barbarian('2024'), 'ragePoints', 2, 'ragePoints', undefined],
      ['5e Barbarian has no short-rest rage recharge', barbarian('5e'), 'ragePoints', 1, 'ragePoints', undefined],
    ])('%s', async (_desc, stats, stubKey, stubVal, byteKey, want) => {
      stubRuntime({ [stubKey]: stubVal })
      await applyShortRest(stats, CAMPAIGN)
      expect(batchUpdates()[byteKey]).toBe(want)
    })
  })

  describe('CLA-011 Arcane Recovery budget model', () => {
    // lv4 wizard: full budget = ceil(4/2) = spell-slot LEVELS, not slot count.
    const wizard = (spellAbilities) => arcaneBard({ automation: { passives: [{ type: 'resource_restoration', resourceKey: 'arcaneRecoveryLevels' }] }, spellAbilities })

    it.each([
      ['fresh budget spends on consumed lv1 slots (2x lv1, budget -> 0, applied log)', { spell_slots_level_1: 0 }, { spell_slots_level_1: 4 }, 2, 0, 'arcane_recovery_applied'],
      ['manual partial budget (1) caps recovery at one lv1 slot', { spell_slots_level_1: 0, arcaneRecoveryLevels: 1 }, { spell_slots_level_1: 4 }, 1, 0, 'arcane_recovery_applied'],
      ['consumed budget (0) refuses — zero slot writes + refusal log', { spell_slots_level_1: 0, arcaneRecoveryLevels: 0 }, { spell_slots_level_1: 4 }, undefined, undefined, 'arcane_recovery_refused'],
      ['level cost, not slot count: 1 consumed lv2 slot spends the whole 2-level budget', { spell_slots_level_2: 1 }, { spell_slots_level_2: 3 }, 2, 0, 'arcane_recovery_applied'],
      ['all slots full — nothing recovered, budget NOT consumed, no logs', { spell_slots_level_1: 4 }, { spell_slots_level_1: 4 }, undefined, undefined, null],
    ])('%s', async (_desc, stored, spellAbilities, wantLv1or2, wantBudget, wantLogType) => {
      stubRuntime(stored)
      await applyShortRest(wizard(spellAbilities), CAMPAIGN)

      const updates = batchUpdates()
      const slotByte = stored.spell_slots_level_2 != null ? updates.spell_slots_level_2 : updates.spell_slots_level_1
      expect(slotByte).toBe(wantLv1or2)
      if (wantBudget === undefined) {
        expect(updates).not.toHaveProperty('arcaneRecoveryLevels')
      } else {
        expect(updates.arcaneRecoveryLevels).toBe(wantBudget)
      }
      const logs = arcaneLogs()
      expect(logs).toHaveLength(wantLogType ? 1 : 0)
      if (wantLogType) {
        expect(logs[0].automationType).toBe(wantLogType)
        if (wantLogType === 'arcane_recovery_applied') {
          expect(logs[0].description).toContain(`level ${stored.spell_slots_level_2 != null ? 2 : 1}`)
        }
      }
    })
  })

  describe('Warlock Pact Magic', () => {
    it.each([
      ['restores every spell slot level to max when all spent', { spell_slots_level_1: 0, spell_slots_level_2: 0 }, 2, 3],
      ['refreshes only the spent level — full levels stay untouched', { spell_slots_level_1: 2, spell_slots_level_2: 0 }, undefined, 3],
      ['branch bait: non-Warlock spends slots but Pact Magic never writes', { spell_slots_level_1: 0 }, undefined, undefined],
    ])('%s', async (_desc, stored, wantLv1, wantLv2) => {
      stubRuntime(stored)
      const isWarlock = wantLv1 !== undefined || wantLv2 !== undefined
      const stats = makeStats({
        class: { name: isWarlock ? 'Warlock' : 'Fighter' },
        level: 5,
        spellAbilities: { spell_slots_level_1: 2, spell_slots_level_2: 3 },
      })
      await applyShortRest(stats, CAMPAIGN)

      const updates = batchUpdates()
      expect(updates.spell_slots_level_1).toBe(wantLv1)
      expect(updates.spell_slots_level_2).toBe(wantLv2)
    })
  })

  describe('per-feature tracking reset', () => {
    it('nulls Signature Spell / Savant per-spell used flags and Improved Warding Flare uses', async () => {
      stubRuntime({
        SignatureSpells_selection: ['Fireball', 'Counterspell'],
        _Divination_Savant_selection: ['Detect Magic', 'See Invisibility'],
        _Evocation_Savant_selection: ['Fireball'],
        _Illusion_Savant_selection: ['Major Image'],
      })
      await applyShortRest(makeStats({
        // Improved Warding Flare is read from TOP-level specialActions (:442).
        specialActions: [{ name: 'Improved Warding Flare' }],
        automation: {
          specialActions: [{ type: 'signature_spells' }],
          passives: [
            { type: 'passive_rule', effect: 'divination_savant' },
            { type: 'passive_rule', effect: 'evocation_savant' },
            { type: 'passive_rule', effect: 'illusion_savant' },
          ],
        },
      }), CAMPAIGN)

      const updates = batchUpdates()
      expect(updates.SignatureSpells_Fireball_used).toBeNull()
      expect(updates.SignatureSpells_Counterspell_used).toBeNull()
      expect(updates._Divination_Savant_Detect_Magic_used).toBeNull()
      expect(updates._Divination_Savant_See_Invisibility_used).toBeNull()
      expect(updates._Evocation_Savant_Fireball_used).toBeNull()
      expect(updates._Illusion_Savant_Major_Image_used).toBeNull()
      expect(updates.wardingflareUses).toBeNull()

      // Branch bait: holder WITHOUT a stored selection fabricates no used-flag bytes.
      stubRuntime({})
      await applyShortRest(makeStats({
        automation: {
          specialActions: [{ type: 'signature_spells' }],
          passives: [{ type: 'passive_rule', effect: 'divination_savant' }],
        },
      }), CAMPAIGN)
      const emptyUpdates = batchUpdates()
      expect(Object.keys(emptyUpdates).filter(k => k.includes('SignatureSpells') || k.includes('Savant'))).toEqual([])
    })
  })

  describe('buff/condition handling', () => {
    it('preserves Mage Armor and Wild Shape (CLA-391: SR re-arms uses, does not end the form), clears the rest', async () => {
      const mageArmor = { name: 'Mage Armor' }
      const wildShape = { name: 'Wild Shape', effect: 'shape_shift' }
      stubRuntime({ activeBuffs: [mageArmor, wildShape, { name: 'Shield' }] })
      await applyShortRest(makeStats({ class: { name: 'Druid' } }), CAMPAIGN)

      expect(batchUpdates().activeBuffs).toEqual([mageArmor, wildShape])
    })

    it('clears Vow of Enmity state and strips the vow buff from its target only when a target exists', async () => {
      stubRuntime({
        vowOfEnmityTarget: 'Enemy1',
        activeBuffs: [{ effect: 'vow_of_enmity' }, { effect: 'haste' }],
      })
      await applyShortRest(makeStats(), CAMPAIGN)

      // Target-side write is arity-4 (no skipSync) and keeps the other buffs.
      // fix#354(b) site 1/4 valid-arm: validate-first keeps filter+write VERBATIM.
      expect(setRuntimeValue).toHaveBeenCalledWith('Enemy1', 'activeBuffs', [{ effect: 'haste' }], CAMPAIGN)
      // Self-side latches null in the batch.
      const updates = batchUpdates()
      expect(updates.vowOfEnmityTarget).toBeNull()
      expect(updates.vowOfEnmityCostPaid).toBeNull()

      // Branch bait: no vow target — latches still null, no NEW target writes.
      const enemyWritesBefore = vi.mocked(setRuntimeValue).mock.calls.filter(c => c[0] === 'Enemy1').length
      stubRuntime({})
      await applyShortRest(makeStats(), CAMPAIGN)
      expect(vi.mocked(setRuntimeValue).mock.calls.filter(c => c[0] === 'Enemy1')).toHaveLength(enemyWritesBefore)
      expect(batchUpdates().vowOfEnmityTarget).toBeNull()
    })

    // fix#354(b) site 1/4 non-array-store arms (unguarded-filtered-activeBuffs-
    // rewrite class, fix#337S stamp ledger :1817): invalid store -> LOUD
    // console.error + ZERO activeBuffs writes to the target; the self-side
    // batch latches stay nulled (unrelated key, unchanged behavior). Pre-fix
    // `|| []` wrote [] over a missing store and TypeError'd mid-rewrite on
    // non-array truthy.
    it.each([
      ['missing (undefined) store', undefined],
      ['non-array truthy store', { nope: true }],
    ])('vow target with %s: LOUD console.error + ZERO Enemy1 writes, self latches still null', async (_desc, stored) => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(getRuntimeValue).mockImplementation((n, key) => {
        if (key === 'vowOfEnmityTarget') return 'Enemy1'
        if (key === 'activeBuffs') return n === 'Enemy1' ? stored : []
        return undefined
      })
      await applyShortRest(makeStats(), CAMPAIGN)
      expect(consoleSpy).toHaveBeenCalledWith(
        '[restRules] Refusing vow_of_enmity activeBuffs rewrite — stored activeBuffs is not an array:',
        'Enemy1', stored,
      )
      expect(vi.mocked(setRuntimeValue).mock.calls.filter(c => c[0] === 'Enemy1')).toHaveLength(0)
      const updates = batchUpdates()
      expect(updates.vowOfEnmityTarget).toBeNull()
      expect(updates.vowOfEnmityCostPaid).toBeNull()
      consoleSpy.mockRestore()
    })
  })

  describe('campaign targetEffects clearing', () => {
    it('runs both clear lanes: the summon-field lane (no skipSync) and the per-key lane (skipSync=true), sparing survivors', async () => {
      const globe = { effect: 'globe_barrier' }
      const clairvoyant = { effect: 'clairvoyant_combatant' }
      const haste = { effect: 'haste' }
      stubRuntime({ targetEffects: [globe, clairvoyant, haste] })
      await applyShortRest(makeStats(), CAMPAIGN)

      // Summon-field lane (:334) filters globe_barrier out and writes WITHOUT skipSync.
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects', [clairvoyant, haste], CAMPAIGN,
      )
      // Per-key lane (:378) clears clairvoyant_combatant WITH skipSync=true —
      // re-posting the SSE-echoed row would loop.
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects', [globe, haste], CAMPAIGN, true,
      )
    })

    it.each(SR_TARGET_EFFECT_KEYS)('clears registered key %s and keeps survivors', async (effectKey) => {
      const target = { effect: effectKey }
      const haste = { effect: 'haste' }
      stubRuntime({ targetEffects: [target, haste] })
      await applyShortRest(makeStats(), CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects', [haste], CAMPAIGN, true,
      )
    })
  })

  describe('regenerateActive clearing', () => {
    it('clears regenerateActive and restores full HP for every string-keyed regenerator, touching nobody else', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'regenerateActive') return name === 'Char1'
        if (key === 'hitPoints') return name === 'Char1' ? 50 : 77
        return undefined
      })
      vi.mocked(getAllStoreKeys).mockReturnValue([123, 'Char1', 'Char2', null])
      await applyShortRest(makeStats(), CAMPAIGN)

      expect(setRuntimeValue).toHaveBeenCalledWith('Char1', 'regenerateActive', false, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith('Char1', 'currentHitPoints', 50, CAMPAIGN)
      // Numeric keys skipped; only the true-flagged character is written.
      expect(vi.mocked(setRuntimeValue).mock.calls.filter(c => c[1] === 'regenerateActive')).toEqual([
        ['Char1', 'regenerateActive', false, CAMPAIGN],
      ])
      expect(setRuntimeValue).not.toHaveBeenCalledWith('Char2', 'currentHitPoints', 77, CAMPAIGN)
    })
  })

  describe('invisibility clearing', () => {
    it.each([
      ['Invisibility', '_activeInvisibility_Test Hero', endInvisibility, endGreaterInvisibility],
      ['Greater Invisibility', '_activeGreaterInvisibility_Test Hero', endGreaterInvisibility, endInvisibility],
    ])('ends %s on the resting target and clears the campaign caster key', async (_desc, key, endFn, otherEndFn) => {
      stubRuntime({ [key]: 'Caster1' })
      await applyShortRest(makeStats(), CAMPAIGN)

      expect(endFn).toHaveBeenCalledWith('Test Hero', CAMPAIGN, 'target finished a rest')
      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', key, null, CAMPAIGN)
      expect(otherEndFn).not.toHaveBeenCalled()
    })
  })

  describe('Celestial Resilience', () => {
    it('grants self temp HP (level + CHA) as batch byte with ability_use log, and a failed log never aborts the rest', async () => {
      stubRuntime({ tempHp: 5 })
      const result = await applyShortRest(celestialStats(), CAMPAIGN)

      // 6 + 4 = 10; replace-if-larger lives in tempHpService, this pins the rest byte.
      expect(batchUpdates().tempHp).toBe(10)
      expect(addEntry).toHaveBeenCalledWith(
        CAMPAIGN,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'Test Hero',
          abilityName: 'Celestial Resilience',
          description: expect.stringContaining('10 temporary hit points'),
        }),
      )
      expect(result.celestialResilienceAllies).toBeNull()
      // No combat summary (:295 early return) — the ally grant handler never runs.
      expect(grantCelestialResilience).not.toHaveBeenCalled()

      // Log rejection is swallowed by the .catch — the rest must still complete.
      vi.mocked(addEntry).mockRejectedValue(new Error('Log failed'))
      const resilient = await applyShortRest(celestialStats(), CAMPAIGN)
      expect(batchUpdates().tempHp).toBe(10)
      expect(clearAllExpirationEffects).toHaveBeenCalledWith('Test Hero', CAMPAIGN)
      expect(resilient.celestialResilienceAllies).toBeNull()
    })

    it.each([
      ['allies granted: payload reshaped to modal contract (maxAllies -> maxTargets)',
        { allyTempHp: 5, allies: [{ name: 'Ally1', type: 'player' }], selfTempHp: 10, maxAllies: 5 },
        { creatureTargets: [{ name: 'Ally1', type: 'player' }], allyTempHp: 5, selfTempHp: 10, maxTargets: 5 }],
      ['no allies: null payload, self batch byte still lands',
        null, null],
    ])('%s', async (_desc, grantReturn, wantAllies) => {
      stubRuntime({ tempHp: 5 })
      vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] })
      vi.mocked(grantCelestialResilience).mockResolvedValue(grantReturn)
      const stats = celestialStats()
      const result = await applyShortRest(stats, CAMPAIGN)

      expect(grantCelestialResilience).toHaveBeenCalledWith(stats, CAMPAIGN, 'short_rest')
      expect(result.celestialResilienceAllies).toEqual(wantAllies)
      expect(batchUpdates().tempHp).toBe(10)
    })

    it('throws before any write when level is missing, and aborts without a partial batch', async () => {
      await expect(applyShortRest(celestialStats({ level: null }), CAMPAIGN))
        .rejects.toThrow('playerStats.level is required')
      await expect(applyShortRest(arcaneBard({ level: null }), CAMPAIGN))
        .rejects.toThrow('playerStats.level is required')

      // Both throws precede setRuntimeBatch (:453/:476 vs :487) — no partial state.
      expect(setRuntimeBatch).not.toHaveBeenCalled()
    })
  })

  describe('polymorph/transform cleanup', () => {
    it('removes True Polymorph summons and reverts object transforms in the stored combat summary', async () => {
      // Lane 1: summoned creatures drop out of the summary entirely.
      const cs = {
        creatures: [
          { name: 'Summon1', summonSource: 'true_polymorph', currentHp: 10, maxHp: 20 },
          { name: 'Normal1', currentHp: 15, maxHp: 30 },
        ],
      }
      vi.mocked(getCombatSummary).mockReturnValue(cs)
      await applyShortRest(makeStats(), CAMPAIGN)
      expect(cs.creatures.map(c => c.name)).toEqual(['Normal1'])
      expect(storageService.default.set).toHaveBeenCalledWith('combatSummary', cs, CAMPAIGN)
      expect(setCombatSummaryCache).toHaveBeenCalledWith(cs, CAMPAIGN)

      // Lane 2: object transforms revert to their original block, and the
      // object-only incapacitated condition is stripped from the creature.
      stubRuntime({ activeConditions: ['incapacitated', 'blinded'] })
      const cs2 = {
        creatures: [{
          name: 'Transformed1',
          maxHp: 10,
          ac: 15,
          speed: 30,
          polymorphObject: { maxHp: 10, ac: 15, speed: 30 },
          polymorphOriginal: { maxHp: 50, ac: 13, speed: 30 },
        }],
      }
      vi.mocked(getCombatSummary).mockReturnValue(cs2)
      await applyShortRest(makeStats(), CAMPAIGN)

      const transformed = cs2.creatures[0]
      expect(transformed.maxHp).toBe(50)
      expect(transformed.ac).toBe(13)
      expect(transformed).not.toHaveProperty('polymorphObject')
      expect(storageService.default.set).toHaveBeenCalledWith('combatSummary', cs2, CAMPAIGN)
      expect(setRuntimeValue).toHaveBeenCalledWith('Transformed1', 'activeConditions', ['blinded'], CAMPAIGN)
    })
  })

  describe('Chef Replenishing Meal', () => {
    const mealPassive = (name) => ({ automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', name }] } })

    it.each([
      ['holder resets meals to 4 + proficiency (skipSync)', 'Replenishing Meal', 7],
      ['bonus_healing under a different feature name is not the Chef meal', 'Sizzling Surprise', undefined],
      ['no passives at all', undefined, undefined],
    ])('%s', async (_desc, passiveName, want) => {
      await applyShortRest(makeStats(mealPassive(passiveName ?? 'Other')), CAMPAIGN)
      if (want === undefined) {
        expect(vi.mocked(setRuntimeValue).mock.calls.filter(c => c[1] === 'replenishingMeals')).toHaveLength(0)
      } else {
        expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'replenishingMeals', want, CAMPAIGN, true)
      }
    })

    // fix#354(a) REFUTED-VERIFIED preservation arm (fix#337S stamp ledger :1813
    // adjudicated by disk law): public/data/2024/feats.json:832 — "As part of a
    // Short Rest, you can cook special food ... 4 plus your Proficiency Bonus."
    // The refill rides EVERY short rest; skipAutoRecovery (:453) gates ONLY the
    // automatic pool recovery (Arcane Recovery). Gating the :447-era call would
    // violate the disk text — this pin fails if the call is ever moved behind
    // the gate, while the same rest keeps its gated slots spent.
    it('modal lane (skipAutoRecovery:true) STILL replenishes meals — disk ties the refill to the REST, not auto-recovery (fix#354(a) refute-preservation)', async () => {
      const chefWizard = arcaneBard({
        automation: {
          passives: [
            { type: 'font_of_inspiration' },
            { type: 'resource_restoration', resourceKey: 'arcaneRecoveryLevels' },
            { type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' },
          ],
        },
      })
      stubRuntime({ spell_slots_level_1: 0, replenishingMeals: 0 })
      await applyShortRest(chefWizard, CAMPAIGN, { skipAutoRecovery: true })
      // Ungated meal pool re-armed: 4 + proficiency 3 = 7, fresh post-rest batch
      // for the modal sole spender (fix#165).
      expect(setRuntimeValue).toHaveBeenCalledWith('Test Hero', 'replenishingMeals', 7, CAMPAIGN, true)
      // Gate discipline intact on the SAME rest: gated auto-recovery stays spent.
      expect(batchUpdates()).not.toHaveProperty('spell_slots_level_1')
      expect(arcaneLogs()).toHaveLength(0)
    })
  })

  describe('Tireless Ranger exhaustion', () => {
    function ranger(level) {
      return makeStats({ class: { name: 'Ranger' }, level })
    }

    it.each([
      ['lv10 Ranger steps exhaustion 3 down to exactly 1-less', ranger(10), 3, 2],
      ['lv10 Ranger at exhaustion 0 writes nothing', ranger(10), 0, undefined],
      ['lv9 Ranger is below the feature gate', ranger(9), 3, undefined],
      ['non-Ranger never steps down at a short rest', makeStats({ level: 10 }), 3, undefined],
    ])('%s', async (_desc, stats, stored, want) => {
      stubRuntime({ exhaustionLevel: stored })
      await applyShortRest(stats, CAMPAIGN)
      expect(batchUpdates().exhaustionLevel).toBe(want)
    })
  })
})
