// @maintained-by-ai
// SP-128 lane: SPELL_RUNTIME_CLEANERS['Expeditious Retreat'] concentration-break
// purge ONLY (concentrationService.js:166-182). On every break of the ER
// concentration the Dash grant dies: sheet-row flag, per-turn Dash latch,
// turn-start re-offer entry, residual Dash speed_boost buff — each guarded so
// a non-holder gets zero writes; break logged once per app logging mandate.
// Twin-split: hex twin #992 (concentrationService.cla107-hex-purge.test.js)
// owns clearHexEffects — verified DIFFERENT shape here: the hex purge is
// spell-name-irrelevant, this lane is spell-KEYED via
// SPELL_RUNTIME_CLEANERS[spellName] (:314), so wrong-spell survival is
// pinned instead of a Charm Person fold-in. Generic break machinery:
// concentrationService.test.js + user-driven trio #833-#835; REST seam and
// the cleanupBuffsByName:483 filter semantics (caster-attributed since #990-fix): #990
// cleanupConcentrationEffects.test.js. ER family (#949): cast lane
// expeditiousRetreatService, latch turnStartEffects.er-dash-offer, buff
// consumption charSummaryCalc.ft105, Dash execution expeditiousRetreatDashHandler.
// #990 filter audit of THIS purge (pinned honestly, NOT a new report): the
// cleaner dispatches roster-wide (clearChosenDamageTypesForSpell :313-319)
// and its buff filter (:179-180) is name-only — the producer never stamps a
// source on the Dash buff (expeditiousRetreatDashHandler.js:102), so a
// second ER holder's grant is purged when this caster breaks. Pinned below.
// Old->new: 3 tests -> 2. Former "clears flag/latch/offer/buff" + "leaves
// non-holders untouched" fold into the armed leg (exact whole-lane ordered
// write array, byte-exact survivors, break-log exact bytes, second-holder
// over-purge pin); former "byte-inert never granted" folds into the inert
// control + wrong-spell leg + survivors-only falsifiers so guard-clause
// removal fails the control (#921). Turn-based seam — no wall-clock (#app).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const store = new Map()
  const writes = []
  return {
    store,
    writes,
    storeKey: (name, key) => `${name}|${key}`,
    csRef: { creatures: [] },
  }
})

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => h.store.get(h.storeKey(name, key)) ?? null),
  setRuntimeValue: vi.fn((name, key, value, campaignName) => {
    h.writes.push([name, key, value, campaignName])
    h.store.set(h.storeKey(name, key), value)
  }),
  getAllStoreKeys: vi.fn(() => []),
}))

vi.mock('./concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(() => ({ roll: 10, success: true })),
  breakConcentration: vi.fn(() => null),
  computeConcentrationDc: vi.fn(),
}))

vi.mock('../auras/auraOfProtection.js', () => ({ computeAuraBonus: vi.fn() }))
vi.mock('../conditions/conditionSaveService.js', () => ({ getCreatureSaveBonus: vi.fn() }))
vi.mock('../starryFormConstellation.js', () => ({ hasStarryDragonConstellation: vi.fn(() => false) }))
vi.mock('../../../services/ui/storage.js', () => ({ default: { set: vi.fn() } }))
vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => h.csRef),
}))
vi.mock('../../rules/effects/expirations.js', () => ({ clearExpirationEffects: vi.fn() }))
vi.mock('../../ui/utils.js', () => ({ default: { getName: vi.fn((v) => String(v)) } }))
vi.mock('../../encounters/combatLoggingService.js', () => ({ logConditionEvent: vi.fn() }))
vi.mock('../../ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }))
vi.mock('../conditions/savePromptService.js', () => ({ clearFleshToStonePrompt: vi.fn() }))
vi.mock('../../rules/features/heroismService.js', () => ({ removeHeroismBuff: vi.fn() }))
vi.mock('../summons/summonedCreatureService.js', () => ({ removeSummonedCreatures: vi.fn() }))
vi.mock('../../automation/handlers/spells/truePolymorphService.js', () => ({ revertTruePolymorph: vi.fn() }))

import { cleanupConcentrationEffects } from './concentrationService.js'
import { addEntry } from '../../ui/logService.js'

const CAMPAIGN = 'test-campaign'
const CASTER = 'AberrantSorcerer'
const OTHER = 'Bandit 1'

const ER_OFFER = { type: 'expeditious_retreat_dash_offer' }
const SURVIVOR_OFFER = { type: 'something_else' }
// Byte-exact producer shape (expeditiousRetreatDashHandler.js:102-104) — no source stamp.
const DASH_BUFF = { name: 'Dash (Expeditious Retreat)', effect: 'speed_boost', speedBonus: 30, duration: 'until_end_of_turn' }
// Same effect key, different name — must survive the name-only buff filter.
const HASTE_BUFF = { name: 'Haste', effect: 'speed_boost', speedBonus: 15 }

const ER_KEYS = ['expeditiousRetreatActive', '_Expeditious_Retreat_dash_usedRound', 'turnStartEffects', 'activeBuffs']

function seedGrant(name, usedRound) {
  h.store.set(h.storeKey(name, 'expeditiousRetreatActive'), true)
  h.store.set(h.storeKey(name, '_Expeditious_Retreat_dash_usedRound'), usedRound)
  h.store.set(h.storeKey(name, 'turnStartEffects'), [ER_OFFER, SURVIVOR_OFFER])
  h.store.set(h.storeKey(name, 'activeBuffs'), [DASH_BUFF, HASTE_BUFF])
}

function erWrites() {
  return h.writes.filter(w => ER_KEYS.includes(w[1]))
}

describe('SP-128 Expeditious Retreat concentration-break purge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.store.clear()
    h.writes.length = 0
    h.csRef.creatures = [{ name: CASTER }, { name: OTHER }]
  })

  it('armed: purges both holders roster-wide with one ordered write per key and logs the break once', async () => {
    seedGrant(CASTER, 3)
    // Second ER holder — pinned over-purge (#990 name-only class, cited):
    // roster-wide dispatch + source-less Dash buff mean CASTER's break also
    // kills OTHER's live grant. Honest pin, not new report.
    seedGrant(OTHER, 5)

    await cleanupConcentrationEffects(CASTER, 'Expeditious Retreat', CAMPAIGN)

    // Whole ER lane, exact: 8 writes in dispatch order, every one campaign-pinned (#825/#934).
    expect(erWrites()).toEqual([
      [CASTER, 'expeditiousRetreatActive', null, CAMPAIGN],
      [CASTER, '_Expeditious_Retreat_dash_usedRound', null, CAMPAIGN],
      [CASTER, 'turnStartEffects', [SURVIVOR_OFFER], CAMPAIGN],
      [CASTER, 'activeBuffs', [HASTE_BUFF], CAMPAIGN],
      [OTHER, 'expeditiousRetreatActive', null, CAMPAIGN],
      [OTHER, '_Expeditious_Retreat_dash_usedRound', null, CAMPAIGN],
      [OTHER, 'turnStartEffects', [SURVIVOR_OFFER], CAMPAIGN],
      [OTHER, 'activeBuffs', [HASTE_BUFF], CAMPAIGN],
    ])

    // Final store byte-exact: grants dead, unrelated offer + Haste survive (#829).
    expect(h.store.get(h.storeKey(CASTER, 'expeditiousRetreatActive'))).toBeNull()
    expect(h.store.get(h.storeKey(CASTER, '_Expeditious_Retreat_dash_usedRound'))).toBeNull()
    expect(h.store.get(h.storeKey(CASTER, 'turnStartEffects'))).toEqual([SURVIVOR_OFFER])
    expect(h.store.get(h.storeKey(CASTER, 'activeBuffs'))).toEqual([HASTE_BUFF])
    expect(h.store.get(h.storeKey(OTHER, 'turnStartEffects'))).toEqual([SURVIVOR_OFFER])
    expect(h.store.get(h.storeKey(OTHER, 'activeBuffs'))).toEqual([HASTE_BUFF])

    // App logging mandate: the generic break log fires once, exact bytes (:423-429).
    expect(addEntry.mock.calls).toHaveLength(1)
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'ability_use',
      characterName: CASTER,
      abilityName: 'Expeditious Retreat',
      description: 'Concentration broken; Expeditious Retreat ends.',
    })
  })

  it('inert: wrong spell key and unheld grant produce zero ER-lane writes', async () => {
    // Leg A — this lane is spell-KEYED (:314), unlike spell-irrelevant hex #992:
    // breaking a different concentration must leave a live ER grant byte-identical.
    seedGrant(CASTER, 3)

    await cleanupConcentrationEffects(CASTER, 'Hex', CAMPAIGN)

    expect(erWrites()).toHaveLength(0)
    expect(h.store.get(h.storeKey(CASTER, 'expeditiousRetreatActive'))).toBe(true)
    expect(h.store.get(h.storeKey(CASTER, '_Expeditious_Retreat_dash_usedRound'))).toBe(3)
    expect(h.store.get(h.storeKey(CASTER, 'turnStartEffects'))).toEqual([ER_OFFER, SURVIVOR_OFFER])
    expect(h.store.get(h.storeKey(CASTER, 'activeBuffs'))).toEqual([DASH_BUFF, HASTE_BUFF])

    // Leg B — near-miss survivors, grant keys absent: dropping any some()/length
    // guard writes nulls or filtered arrays here and fails this control (#921).
    h.store.clear()
    h.writes.length = 0
    h.store.set(h.storeKey(CASTER, 'turnStartEffects'), [SURVIVOR_OFFER])
    h.store.set(h.storeKey(CASTER, 'activeBuffs'), [HASTE_BUFF])

    await cleanupConcentrationEffects(CASTER, 'Expeditious Retreat', CAMPAIGN)

    expect(erWrites()).toHaveLength(0)
    expect(h.store.get(h.storeKey(CASTER, 'turnStartEffects'))).toEqual([SURVIVOR_OFFER])
    expect(h.store.get(h.storeKey(CASTER, 'activeBuffs'))).toEqual([HASTE_BUFF])
  })
})
