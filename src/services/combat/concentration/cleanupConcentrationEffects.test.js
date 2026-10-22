// @maintained-by-ai
//
// CLEANUP lane — concentration family map (first map):
//  - concentrationRules.test.js ....................... pure dice rules (save total, dragon clamp, disadvantage, DC)
//  - concentrationService.test.js ..................... roll/save orchestration, breakConcentration, addConcentration,
//                                                       popup, removeTargetEffectsByEffect lanes (bane/blade/bless/ray)
//  - concentrationService.cla107-hex-purge.test.js .... hex disadvantage te purge + purge log
//  - concentrationService.sp128-er-purge.test.js ...... Expeditious Retreat Dash-grant purge (SPELL_RUNTIME_CLEANERS)
//  - THIS FILE ........................................ clearAllConcentrations (rest seam) + cleanupConcentrationEffects
//                                                       cleanup FILTER semantics: generic caster te sweep, beacon caster
//                                                       channel (SP-014), invisibility flags, calm_emotions restore,
//                                                       condition-gone-removal, aura/buff sweeps, per-spell cleaners,
//                                                       flesh-to-stone state, break-log emitter
//  - Break canon (#833-#835 user-driven trio + concentrationService.test.js) owns the *moment* concentration is set
//    null; this file owns only what is deleted afterwards. Expiry semantics live in the expirations lanes (#951) —
//    here only the break-seam drain hands work off. Calm-emotions producer/latch contract:
//    calmEmotionsHandler-effects.test.js; the restore-on-break CONSUMER is delegated to this lane.
//
// Cleanup filter canon (#948 exemplar): unmocked faithful store pre-seeded with falsifiers
// (same-effect-diff-source, same-source-diff-duration, foreign-caster te), survivors pinned byte-identical,
// one write per lane (#825), campaign pinned on every write (#934), zero-cleanup legs pinned honestly (#934),
// turn-based seams only — no wall-clock (#app).
//
// Old -> new map (27 -> 13):
//  rest clears / untouched / saves-event .......... -> T1  (rest-lane pin incl. exact single te write, storage.set,
//                                                             unconditional summon+heroism dispatch, SP-011 break-log
//                                                             naming of the actually-concentrated spell, no Flesh-to-
//                                                             Stone hardcode)
//  rest zero-te / null-combat-summary ............. -> T2 / T3 (te sweep is cs-independent — honest pin)
//  invisibility x2 (vacuous objectContaining({})) .. -> T5  (both flag prefixes + other-caster falsifier, byte pin)
//  calm restore x2 .................................. -> T6  (restore + skip-existing + ONE merged write per target
//                                                             — #990-fix(a) flipped, fix#27 §39 canon shape)
//  calm buffs / protection from poison / faerie ..... -> T9  (aura+buff sweeps unified; caster-attributed strips only
//                                                             — #990-fix(b)(c) flipped, foreign-stamped buffs survive)
//  holy aura 'in order' ............................. -> T9  (no-duration holy te proves the lane fires past the
//                                                             generic sweep; dirty-guarded caster-key reset pinned #990-fix(d))
//  condition field / conditions array / retained .... -> T7  (one full-semantics test on a tasha-shaped te — the
//                                                             real producer stamps conditions[] + duration
//                                                             'concentration', so the dedicated tasha lane is inert on
//                                                             a faithful store and its double log is pinned absent)
//  resistance / energy / stone skin ................. -> T10 (table-driven single test + no-stray-write falsifier)
//  beacon SP-014 .................................... -> T4  (caster-channel leg inside the generic-sweep test)
//  object transform x2 .............................. -> T11 (string + array targets, foreign caster untouched)
//  flesh to stone log / SP-011 / SP-012 twin ...... -> T1 emitter pin + T12 stone-specific state
//  resilient sphere te .............................. -> removed (producer stamps duration:'concentration'+source
//                                                             — generic sweep already drains; verified
//                                                             resilientSphereHandler.js:35-41, lane is a no-op re-scan)
//  byte-inert zero-cleanup .......................... -> T13 (+ :450-451/#990-fix(d) dirty-guard flipped)
//
// #990 filter audit — FIXED 2026-10-22 (this lane, concentrationService.js):
//  (a) :213-217 restoreSuppressedConditions spliced per-loop off one stale snapshot -> last write dropped earlier
//      restores (multi-missing). Now ONE merged write per target, mirroring fix#27's restored twin at
//      useInitiativeEffects.js:170-184 + producer canon calmEmotionsHandler.js:190-194. T6 flipped.
//  (b) :483 cleanupBuffsByName ignored the casterName its sole caller (:381) passes -> cross-caster strip.
//      Now name AND caster attribution (b.source || b.sourceCharacter), T9 flipped.
//  (c) :225-227 removeCalmEmotionsBuffs stripped ANY creature's Calm buff on ANY caster's break -> caster-scoped,
//      matching the calm buff's producer stamp (calmEmotionsHandler.js:182-188 sourceCharacter) and the expiration
//      consumer clearExpirationEffects.js:322. T9 flipped.
//  (d) minor :450-451/:469 unconditional writes -> dirty-guarded (zero writes when unchanged). T12/T13 flipped.
// Intentional wildcard STRIPS kept by census (never a bug): the roster-wide spell cleaners
// ('Protection from Energy' / 'Circle of Power' / INITIATIVE_CLEARED_EFFECT_KEYS live in
// useInitiativeEffects.js — different lane, untouched) and SPELL_RUNTIME_CLEANERS['Expeditious Retreat']
// :179-180, whose Dash-buff producer stamps NO source (sp128 lane pins that over-purge honestly, #993).
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Faithful two-tier runtime store: every read sees the result of prior writes,
// so lane ordering (generic sweep before effect-key lanes) is real, not mocked replay.
const h = vi.hoisted(() => {
    const stores = new Map()
    const doc = (storeKey) => {
        if (!stores.has(storeKey)) stores.set(storeKey, {})
        return stores.get(storeKey)
    }
    return {
        stores,
        doc,
        cs: null,
    }
})

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((storeKey, key) => {
        const d = h.doc(storeKey)
        return key === '' ? { ...d } : (d[key] ?? null)
    }),
    setRuntimeValue: vi.fn((storeKey, key, value) => {
        if (key === '') h.stores.set(storeKey, { ...value })
        else h.doc(storeKey)[key] = value
    }),
    getAllStoreKeys: vi.fn(() => Object.keys(h.doc('campaign'))),
}))

vi.mock('./concentrationRules.js', () => ({
    rollConcentrationSave: vi.fn(() => ({ roll: 10, success: true })),
    breakConcentration: vi.fn(() => null),
    computeConcentrationDc: vi.fn(),
}))

vi.mock('../auras/auraOfProtection.js', () => ({
    computeAuraBonus: vi.fn(),
}))

vi.mock('../conditions/conditionSaveService.js', () => ({
    getCreatureSaveBonus: vi.fn(),
}))

vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => h.cs),
}))

vi.mock('../../encounters/combatLoggingService.js', () => ({
    logConditionEvent: vi.fn(),
}))

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve({})),
}))

vi.mock('../../ui/storage.js', () => ({
    default: {
        set: vi.fn(),
    },
}))

vi.mock('../../rules/effects/expirations.js', () => ({
    clearExpirationEffects: vi.fn(),
}))

vi.mock('../../rules/features/heroismService.js', () => ({
    removeHeroismBuff: vi.fn(),
}))

vi.mock('../summons/summonedCreatureService.js', () => ({
    removeSummonedCreatures: vi.fn(),
}))

vi.mock('../../automation/handlers/spells/truePolymorphService.js', () => ({
    revertTruePolymorph: vi.fn(),
}))

vi.mock('../conditions/savePromptService.js', () => ({
    clearFleshToStonePrompt: vi.fn(),
}))

import storage from '../../ui/storage.js'
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { logConditionEvent } from '../../encounters/combatLoggingService.js'
import { addEntry } from '../../ui/logService.js'
import { clearExpirationEffects } from '../../rules/effects/expirations.js'
import { removeHeroismBuff } from '../../rules/features/heroismService.js'
import { removeSummonedCreatures } from '../summons/summonedCreatureService.js'
import { revertTruePolymorph } from '../../automation/handlers/spells/truePolymorphService.js'
import { clearFleshToStonePrompt } from '../conditions/savePromptService.js'
import {
    clearAllConcentrations,
    cleanupConcentrationEffects,
} from './concentrationService.js'

const CAMPAIGN = 'test-campaign'

function seedCampaign(teOrDoc, extras = {}) {
    const doc = Array.isArray(teOrDoc) ? { targetEffects: teOrDoc } : teOrDoc
    h.stores.set('campaign', { ...extras, ...doc })
}

function seed(storeKey, values) {
    h.stores.set(storeKey, { ...values })
}

function setCs(creatures) {
    h.cs = creatures === null ? null : { round: 1, creatures }
}

function te() {
    return h.doc('campaign').targetEffects || []
}

function teWrites() {
    return vi.mocked(setRuntimeValue).mock.calls.filter(c => c[0] === 'campaign' && c[1] === 'targetEffects')
}

function callsFor(storeKey, key) {
    return vi.mocked(setRuntimeValue).mock.calls.filter(c => c[0] === storeKey && c[1] === key)
}

function expectAllWritesCampaignPinned() {
    const writes = vi.mocked(setRuntimeValue).mock.calls
    expect(writes.every(w => w[3] === CAMPAIGN)).toBe(true)
}

describe('clearAllConcentrations — rest seam', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        h.stores.clear()
        h.cs = null
    })

    it('rest clears only the resting creature, saves the summary, and sweeps exactly its concentration tes once', () => {
        const cs = {
            round: 1,
            creatures: [
                { name: 'Alice', concentration: { spell: 'Bless', dc: 10 } },
                { name: 'Bob', concentration: { spell: 'Haste', dc: 13 } },
            ],
        }
        setCs(cs.creatures)
        const OWN = { source: 'Alice', effect: 'bless_bonus', target: 'Bob', duration: 'concentration' }
        const F_SRC = { source: 'Charlie', effect: 'bless_bonus', target: 'Dave', duration: 'concentration' }
        const F_TIME = { source: 'Alice', effect: 'aid', target: 'Bob', duration: '1 hour' }
        seedCampaign([OWN, F_SRC, F_TIME])

        clearAllConcentrations(CAMPAIGN, 'Alice')

        expect(cs.creatures[0].concentration).toBeNull()
        expect(cs.creatures[1].concentration).toEqual({ spell: 'Haste', dc: 13 })
        expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, CAMPAIGN)
        // Exactly one te write, exact survivors: the cleanup lane already drained the store,
        // so clearAllConcentrations' own sweep is byte-inert (#825 write-once, #948 falsifiers).
        expect(teWrites()).toEqual([['campaign', 'targetEffects', [F_SRC, F_TIME], CAMPAIGN, true]])
        // Cleanup lane dispatched for the resting creature only, and the break log names
        // the actually-concentrated spell (SP-011) — never hardcoded Flesh to Stone.
        expect(removeSummonedCreatures).toHaveBeenCalledWith('Alice', CAMPAIGN)
        expect(removeHeroismBuff).toHaveBeenCalledWith('Alice', CAMPAIGN)
        expect(removeSummonedCreatures).toHaveBeenCalledTimes(1)
        expect(addEntry).toHaveBeenCalledTimes(1)
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
            type: 'ability_use',
            characterName: 'Alice',
            abilityName: 'Bless',
            description: 'Concentration broken; Bless ends.',
        })
        expectAllWritesCampaignPinned()
    })

    it('resting with no concentration and no matching tes changes no byte anywhere', () => {
        const cs = {
            round: 1,
            creatures: [
                { name: 'Alice' },
                { name: 'Bob', concentration: { spell: 'Haste', dc: 13 } },
            ],
        }
        setCs(cs.creatures)
        const F_CON = { source: 'Charlie', effect: 'haste', target: 'Dave', duration: 'concentration' }
        const F_TIME = { source: 'Alice', effect: 'aid', target: 'Bob', duration: '1 hour' }
        seedCampaign([F_CON, F_TIME])

        clearAllConcentrations(CAMPAIGN, 'Alice')

        expect(cs.creatures[0]).toEqual({ name: 'Alice' })
        expect(cs.creatures[1].concentration).toEqual({ spell: 'Haste', dc: 13 })
        expect(te()).toEqual([F_CON, F_TIME])
        expect(setRuntimeValue).not.toHaveBeenCalled()
        expect(storage.set).not.toHaveBeenCalled()
        expect(removeSummonedCreatures).not.toHaveBeenCalled()
        expect(addEntry).not.toHaveBeenCalled()
    })

    it('still sweeps the resting creature tes when the combat summary is absent', () => {
        // The te sweep is deliberately independent of the combat summary (source guard) —
        // stale caster tes must not outlive the rest even when no summary exists to clear.
        setCs(null)
        const OWN = { source: 'Alice', effect: 'bless_bonus', target: 'Bob', duration: 'concentration' }
        const F_CON = { source: 'Charlie', effect: 'haste', target: 'Dave', duration: 'concentration' }
        seedCampaign([OWN, F_CON])

        clearAllConcentrations(CAMPAIGN, 'Alice')

        expect(teWrites()).toEqual([['campaign', 'targetEffects', [F_CON], CAMPAIGN, true]])
        expect(storage.set).not.toHaveBeenCalled()
        expect(setRuntimeValue).toHaveBeenCalledTimes(1)
        expect(addEntry).not.toHaveBeenCalled()
    })
})

describe('cleanupConcentrationEffects — break cleanup filter semantics', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        h.stores.clear()
        h.cs = null
    })

    it('generic sweep drains every concentration te by caster — foreign source, non-concentration duration and the caster-channel beacon survive/drain exactly', async () => {
        const OWN = { source: 'Alice', effect: 'haste', target: 'Bob', duration: 'concentration' }
        const F_SRC = { source: 'Charlie', effect: 'haste', target: 'Dave', duration: 'concentration' }
        const F_TIME = { source: 'Alice', effect: 'aid', target: 'Bob', duration: '1 hour' }
        // SP-014: beaconOfHopeHandler stamps te.caster (no te.source) — survives the
        // generic source-keyed sweep and is drained by the beacon lane matching either channel.
        const BEACON = { target: 'Eve', effect: 'beacon_of_hope', caster: 'Alice', duration: 'concentration' }
        seedCampaign([OWN, BEACON, F_SRC, F_TIME])
        setCs([])

        // Spell name deliberately differs from the drained tes: cleanup keys on CASTER, not spell name.
        await cleanupConcentrationEffects('Alice', 'Invisibility', CAMPAIGN)

        expect(te()).toEqual([F_SRC, F_TIME])
        expect(te()).not.toContainEqual(expect.objectContaining({ source: 'Alice', duration: 'concentration' }))
        expect(revertTruePolymorph).not.toHaveBeenCalled()
        expectAllWritesCampaignPinned()
    })

    it('invisibility break clears both active-invisibility flags of this caster only, rewriting the campaign doc exactly', async () => {
        const ALICE_VIS = { source: 'Alice', duration: 'concentration', effect: 'invisibility', target: 'Bob' }
        const ALICE_GREAT = { source: 'Alice', duration: 'concentration', effect: 'greater_invisibility', target: 'Bob' }
        const CHARLIE_VIS = { source: 'Charlie', duration: 'concentration', effect: 'invisibility', target: 'Eve' }
        seedCampaign([ALICE_VIS, ALICE_GREAT, CHARLIE_VIS], {
            _activeInvisibility_Bob: 'Alice',
            _activeGreaterInvisibility_Bob: 'Alice',
            _activeInvisibility_Eve: 'Charlie',
        })

        await cleanupConcentrationEffects('Alice', 'Invisibility', CAMPAIGN)

        // Both prefixes cleared for the matching caster; the other caster's flag and te untouched, byte-identical.
        expect(h.doc('campaign')).toEqual({
            targetEffects: [CHARLIE_VIS],
            _activeInvisibility_Eve: 'Charlie',
        })
        expect(teWrites()).toEqual([['campaign', 'targetEffects', [CHARLIE_VIS], CAMPAIGN, true]])
    })

    it('calm_emotions immunity restores suppressed conditions — ONE merged write per target, exact final bytes, never duplicating (#990-fix(a) flipped)', async () => {
        // Falsifier leg: Bob already has 'poisoned' — only the missing condition is appended, once, one write.
        const calmBob = { source: 'Alice', duration: 'concentration', effect: 'calm_emotions', mode: 'immunity', suppressedConditions: ['frightened', 'poisoned'], target: 'Bob' }
        // Multi-missing leg (former pinned defect #990 T6, concentrationService.js:213-217): pre-fix every loop
        // iteration re-spliced the ORIGINAL snapshot and wrote per condition, so the LAST write dropped the earlier
        // restore — captured via spies pre-fix as two writes [['frightened'],['paralyzed']], final byte
        // ['paralyzed']. #990-fix(a): fix#27 §39 shape (useInitiativeEffects.js:178-184) — accumulate into ONE
        // merged write per target; final bytes ['frightened','paralyzed'], exactly one write.
        const calmCharlie = { source: 'Alice', duration: 'concentration', effect: 'calm_emotions', mode: 'immunity', suppressedConditions: ['frightened', 'paralyzed'], target: 'Charlie' }
        // No-change arm (#1512-restore-arms parity): Dave holds both suppressed conditions (one opposite-cased) —
        // case-insensitive skip-existing means restored === conditions, ZERO writes; falsifies an
        // unguarded always-write.
        const calmDave = { source: 'Alice', duration: 'concentration', effect: 'calm_emotions', mode: 'immunity', suppressedConditions: ['frightened', 'paralyzed'], target: 'Dave' }
        seedCampaign([calmBob, calmCharlie, calmDave])
        setCs([{ name: 'Bob' }, { name: 'Charlie' }])
        seed('Bob', { activeConditions: ['poisoned'] })
        seed('Dave', { activeConditions: ['Frightened', 'paralyzed'] })

        await cleanupConcentrationEffects('Alice', 'Calm Emotions', CAMPAIGN)

        expect(h.doc('Bob').activeConditions).toEqual(['poisoned', 'frightened'])
        expect(callsFor('Bob', 'activeConditions')).toEqual([['Bob', 'activeConditions', ['poisoned', 'frightened'], CAMPAIGN]])
        // #990-fix(a): exact final bytes + exactly ONE merged write (te casing preserved).
        expect(callsFor('Charlie', 'activeConditions')).toEqual([['Charlie', 'activeConditions', ['frightened', 'paralyzed'], CAMPAIGN]])
        expect(h.doc('Charlie').activeConditions).toEqual(['frightened', 'paralyzed'])
        // No-change arm — zero writes, store byte-identical.
        expect(callsFor('Dave', 'activeConditions')).toHaveLength(0)
        expect(h.doc('Dave').activeConditions).toEqual(['Frightened', 'paralyzed'])
        expect(te()).toEqual([])
    })

    it('conditions granted by the broken caster are removed only when no other te still grants them, each removal logged', async () => {
        // tasha-shaped te (real producer stamps conditions[] + duration 'concentration', lowercase):
        // the generic sweep drains it and its conditions — the dedicated tasha lane is inert on a
        // faithful store, so exactly two condition removals must be logged (no duplicate removal).
        const hold = { source: 'Alice', duration: 'concentration', effect: 'hold_person', target: 'Bob', condition: 'paralyzed' }
        const tasha = { source: 'Alice', duration: 'concentration', effect: 'tashas_hideous_laughter', target: 'Bob', conditions: ['prone', 'incapacitated'] }
        const otherFreeze = { source: 'Charlie', duration: 'concentration', effect: 'freeze', target: 'Bob', condition: 'paralyzed' }
        seedCampaign([hold, tasha, otherFreeze])
        setCs([{ name: 'Bob' }])
        seed('Bob', { activeConditions: ['paralyzed', 'prone', 'incapacitated', 'poisoned'] })

        await cleanupConcentrationEffects('Alice', 'Hold Person', CAMPAIGN)

        // 'paralyzed' survives — Charlie's te still grants it; prone/incapacitated go, poisoned untouched.
        expect(h.doc('Bob').activeConditions).toEqual(['paralyzed', 'poisoned'])
        expect(te()).toEqual([otherFreeze])
        expect(logConditionEvent).toHaveBeenCalledTimes(2)
        expect(logConditionEvent).toHaveBeenNthCalledWith(1, {
            campaignName: CAMPAIGN, action: 'removed', creatureName: 'Bob',
            conditionLabel: 'prone', dc: 'Concentration lost by Alice',
        })
        expect(logConditionEvent).toHaveBeenNthCalledWith(2, {
            campaignName: CAMPAIGN, action: 'removed', creatureName: 'Bob',
            conditionLabel: 'incapacitated', dc: 'Concentration lost by Alice',
        })
    })

    it('break drains the caster pendingExpirations through the expiration lane once per entry and empties the list', async () => {
        const exp1 = { effects: ['exp1'], target: 'Bob' }
        const exp2 = { effects: ['exp2'], target: 'Eve' }
        seedCampaign([])
        seed('Alice', { pendingExpirations: [exp1, exp2] })

        await cleanupConcentrationEffects('Alice', 'Witch Bolt', CAMPAIGN)

        expect(clearExpirationEffects).toHaveBeenCalledTimes(2)
        expect(clearExpirationEffects).toHaveBeenNthCalledWith(1, ['exp1'], 'Bob', 'Alice', CAMPAIGN)
        expect(clearExpirationEffects).toHaveBeenNthCalledWith(2, ['exp2'], 'Eve', 'Alice', CAMPAIGN)
        expect(h.doc('Alice').pendingExpirations).toEqual([])
        expect(teWrites()).toHaveLength(0)
    })

    it('buff sweeps strip caster-attributed leftovers only — foreign caster\'s stamped buffs survive byte-intact (#990-fix(b)(c) flipped)', async () => {
        const AoL_A = { name: 'Aura of Life', sourceCharacter: 'Alice' }
        const PFP_A = { name: 'Protection from Poison', sourceCharacter: 'Alice' }
        const FF_A = { name: 'Faerie Fire', source: 'Alice' }
        const CE_A = { name: 'Calm Emotions', sourceCharacter: 'Alice' }
        const HASTE_B = { name: 'Haste' }
        const AoL_C = { name: 'Aura of Life', sourceCharacter: 'Charlie' }
        const FF_C = { name: 'Faerie Fire', source: 'Charlie' }
        const CE_C = { name: 'Calm Emotions', sourceCharacter: 'Charlie' }
        const HASTE_C = { name: 'Haste' }
        seedCampaign([
            { target: 'Bob', effect: 'faerie_fire', source: 'Alice', duration: 'concentration' },
            // No-duration holy te: misses the generic duration sweep, dies only to the holy lane.
            { target: 'Bob', effect: 'holy_aura', source: 'Alice' },
            { target: 'Dave', effect: 'haste', source: 'Charlie', duration: 'concentration' },
        ])
        setCs([{ name: 'Bob' }, { name: 'Charlie' }])
        seed('Bob', {
            activeBuffs: [AoL_A, PFP_A, FF_A, CE_A, HASTE_B],
            auraOfLifeHpMaxProtected: true,
            auraOfPuritySaveAdvantageConditions: ['frightened'],
        })
        seed('Charlie', { activeBuffs: [AoL_C, FF_C, CE_C, HASTE_C] })
        // Dirty arms (#990-fix(d)): Alice HOLDS holy-aura keys — the reset must fire (clean arm pinned
        // zero-write in T13).
        seed('Alice', { holyAuraTargets: ['Bob'], holyAuraSaveDc: 15 })

        await cleanupConcentrationEffects('Alice', 'Faerie Fire', CAMPAIGN)

        // Caster-match strips (every attribution channel): calm lane (:225 sourceCharacter, matches the
        // calmEmotionsHandler.js:186 stamp), cleanupBuffsByName (:483 name+attribution — FF_A's producer stamps
        // b.source, faerieFireHandler.js:56), aura/PFP/holy lanes unchanged.
        expect(h.doc('Bob').activeBuffs).toEqual([HASTE_B])
        // #990-fix(b)(c): former pinned over-removals (#871 class) flipped — Charlie's own buffs all survive
        // byte-identical with ZERO writes to its store (pre-fix capture: CE_C stripped by the calm lane and
        // FF_C stripped by cleanupBuffsByName — two over-removal writes ending at ['AoL_C','HASTE_C']).
        expect(h.doc('Charlie').activeBuffs).toEqual([AoL_C, FF_C, CE_C, HASTE_C])
        expect(callsFor('Charlie', 'activeBuffs')).toHaveLength(0)
        expect(h.doc('Bob').auraOfLifeHpMaxProtected).toBe(false)
        // Quirk: purity save-advantage conditions clear for every roster creature with a stored
        // list, even one carrying no Aura of Purity buff (line 306-309).
        expect(h.doc('Bob').auraOfPuritySaveAdvantageConditions).toEqual([])
        // Caster-owned auxiliary holy-aura keys reset (dirty leg, #990-fix(d)).
        expect(h.doc('Alice').holyAuraTargets).toEqual([])
        expect(h.doc('Alice').holyAuraSaveDc).toBe(null)
        expect(te()).toEqual([{ target: 'Dave', effect: 'haste', source: 'Charlie', duration: 'concentration' }])
        expect(logConditionEvent).not.toHaveBeenCalled()
        expectAllWritesCampaignPinned()
    })

    it('spell-keyed cleaners null the chosen-damage and latch values for the named spell only', async () => {
        setCs([{ name: 'Bob' }, { name: 'Charlie' }])

        // Resistance: chosen type + used-this-turn latch both cleared...
        seed('Bob', { resistanceChosenDamageType: 'fire', resistanceUsedThisTurn: true })
        await cleanupConcentrationEffects('Alice', 'Resistance', CAMPAIGN)
        expect(h.doc('Bob').resistanceChosenDamageType).toBe(null)
        expect(h.doc('Bob').resistanceUsedThisTurn).toBe(false)
        // ...and no stray writes for creatures that never chose (full roster loop guard).
        expect(callsFor('Charlie', 'resistanceChosenDamageType')).toHaveLength(0)
        expect(callsFor('Charlie', 'resistanceUsedThisTurn')).toHaveLength(0)

        h.stores.clear()
        seed('Bob', { protectionFromEnergyDamageType: 'cold' })
        await cleanupConcentrationEffects('Alice', 'Protection from Energy', CAMPAIGN)
        expect(h.doc('Bob').protectionFromEnergyDamageType).toBe(null)
        expect(callsFor('Charlie', 'protectionFromEnergyDamageType')).toHaveLength(0)

        h.stores.clear()
        seed('Bob', { stoneSkinDamageTypes: ['bludgeoning'] })
        await cleanupConcentrationEffects('Alice', 'Stone Skin', CAMPAIGN)
        expect(h.doc('Bob').stoneSkinDamageTypes).toBe(null)
        expect(callsFor('Charlie', 'stoneSkinDamageTypes')).toHaveLength(0)
    })

    it('break reverts object transforms once per transform te — string and array targets, foreign caster untouched', async () => {
        const tfString = { source: 'Alice', duration: 'concentration', effect: 'object_transform', target: 'Bob' }
        const tfArray = { source: 'Alice', duration: 'concentration', effect: 'object_transform', target: ['Eve', 'vase'] }
        const tfForeign = { source: 'Charlie', duration: 'concentration', effect: 'object_transform', target: 'Zoe' }
        seedCampaign([tfString, tfArray, tfForeign])

        await cleanupConcentrationEffects('Alice', 'True Polymorph', CAMPAIGN)

        expect(revertTruePolymorph.mock.calls).toEqual([['Bob', CAMPAIGN], ['Eve', CAMPAIGN]])
        expect(te()).toEqual([tfForeign])
    })

    it('flesh to stone break frees the restrained target, nulls the stamp and clears the prompt — other casters untouched', async () => {
        const stoneBob = { target: 'Bob', effect: 'flesh_to_stone', source: 'Alice' }
        const stoneZoe = { target: 'Zoe', effect: 'flesh_to_stone', source: 'Charlie' }
        seedCampaign([stoneBob, stoneZoe], {
            _fleshToStone_Bob: { casterName: 'Alice' },
            _fleshToStone_Zoe: { casterName: 'Charlie' },
        })
        seed('Bob', { activeConditions: ['restrained', 'poisoned'] })

        await cleanupConcentrationEffects('Alice', 'Flesh to Stone', CAMPAIGN)

        expect(h.doc('Bob').activeConditions).toEqual(['poisoned'])
        expect(h.doc('campaign')._fleshToStone_Bob).toBe(null)
        expect(h.doc('campaign')._fleshToStone_Zoe).toEqual({ casterName: 'Charlie' })
        // Dirty leg of the :469 write-guard pair (#1348): the lane's ONE real removal write.
        expect(teWrites()).toEqual([['campaign', 'targetEffects', [stoneZoe], CAMPAIGN]])
        expect(te()).toEqual([stoneZoe])
        expect(clearFleshToStonePrompt).toHaveBeenCalledWith(CAMPAIGN, 'Bob')
        expect(clearFleshToStonePrompt).toHaveBeenCalledTimes(1)
        expect(revertTruePolymorph).not.toHaveBeenCalled()
    })

    it('flesh to stone lane on an already-drained te store still nulls the stamp and clears the prompt with ZERO targetEffects churn (#990-fix(d))', async () => {
        // te carries duration:'concentration' so the generic sweep drains it BEFORE cleanupFleshToStoneEffects
        // re-reads. Pre-fix :469 wrote unconditionally — captured as two te writes (the second an unchanged-array
        // re-write). #990-fix(d): length-guard keeps the dirty leg (test above) and silences this churn arm.
        const conStone = { target: 'Bob', effect: 'flesh_to_stone', source: 'Alice', duration: 'concentration' }
        seedCampaign([conStone], { _fleshToStone_Bob: { casterName: 'Alice' } })
        setCs([{ name: 'Bob' }])
        seed('Bob', { activeConditions: ['restrained', 'poisoned'] })

        await cleanupConcentrationEffects('Alice', 'Flesh to Stone', CAMPAIGN)

        // Exactly ONE te write — the generic sweep (5-arg skipSync store shape); flesh lane contributes zero.
        expect(teWrites()).toEqual([['campaign', 'targetEffects', [], CAMPAIGN, true]])
        expect(h.doc('Bob').activeConditions).toEqual(['poisoned'])
        expect(h.doc('campaign')._fleshToStone_Bob).toBe(null)
        expect(clearFleshToStonePrompt).toHaveBeenCalledWith(CAMPAIGN, 'Bob')
    })

    it('break without a spell name is byte-inert — zero store writes, dispatch-only collaborators (#990-fix(d) flipped)', async () => {
        // Honest zero-cleanup leg (#934): nothing matches, nothing is removed...
        const F_CON = { source: 'Charlie', effect: 'haste', target: 'Dave', duration: 'concentration' }
        seedCampaign([F_CON])

        await cleanupConcentrationEffects('Alice', undefined, CAMPAIGN)

        // ...and post-#990-fix(d) FULLY inert: the break log is skipped (no spell name), summons + heroism
        // are collaborator dispatches (no store writes), and the holy-aura caster keys are dirty-guarded —
        // Alice holds neither key, so pre-fix's two unconditional reset writes (concentrationService.js:450-451,
        // pinned honestly as harmless churn) are gone: ZERO setRuntimeValue calls. Dirty arm pinned in T9.
        expect(addEntry).not.toHaveBeenCalled()
        expect(removeSummonedCreatures).toHaveBeenCalledWith('Alice', CAMPAIGN)
        expect(removeHeroismBuff).toHaveBeenCalledWith('Alice', CAMPAIGN)
        expect(te()).toEqual([F_CON])
        expect(setRuntimeValue).not.toHaveBeenCalled()
    })
})
