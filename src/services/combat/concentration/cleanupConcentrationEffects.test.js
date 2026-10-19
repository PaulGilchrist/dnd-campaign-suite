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
//  calm restore x2 .................................. -> T6  (restore + skip-existing + multi-suppressed defect)
//  calm buffs / protection from poison / faerie ..... -> T9  (aura+buff sweeps unified; name-only over-removals
//                                                             pinned honestly, #871 class)
//  holy aura 'in order' ............................. -> T9  (no-duration holy te proves the lane fires past the
//                                                             generic sweep; unconditional caster-key reset pinned)
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
//  byte-inert zero-cleanup .......................... -> T13
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

    it('calm_emotions immunity restores suppressed conditions with the te casing, never duplicating, and multi-suppressed restores overwrite (pinned defect)', async () => {
        // Falsifier leg: Bob already has 'poisoned' — only the missing condition is appended, once.
        const calmBob = { source: 'Alice', duration: 'concentration', effect: 'calm_emotions', mode: 'immunity', suppressedConditions: ['frightened', 'poisoned'], target: 'Bob' }
        // Defect leg (#871 class): the loop re-splices the ORIGINAL captured list each iteration, so with
        // two missing suppressed conditions the last write drops the earlier restore. Pinned honestly here —
        // concentrationService.js:213-217; update this pin when fixed.
        const calmCharlie = { source: 'Alice', duration: 'concentration', effect: 'calm_emotions', mode: 'immunity', suppressedConditions: ['frightened', 'paralyzed'], target: 'Charlie' }
        seedCampaign([calmBob, calmCharlie])
        setCs([{ name: 'Bob' }, { name: 'Charlie' }])
        seed('Bob', { activeConditions: ['poisoned'] })

        await cleanupConcentrationEffects('Alice', 'Calm Emotions', CAMPAIGN)

        expect(h.doc('Bob').activeConditions).toEqual(['poisoned', 'frightened'])
        expect(callsFor('Bob', 'activeConditions')).toHaveLength(1)
        expect(callsFor('Charlie', 'activeConditions').map(c => c[2])).toEqual([['frightened'], ['paralyzed']])
        expect(h.doc('Charlie').activeConditions).toEqual(['paralyzed'])
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

    it('buff sweeps strip the casters leftovers by name+source where checked — and by name-only where not (pinned defects)', async () => {
        const AoL_A = { name: 'Aura of Life', sourceCharacter: 'Alice' }
        const PFP_A = { name: 'Protection from Poison', sourceCharacter: 'Alice' }
        const FF_A = { name: 'Faerie Fire', source: 'Alice' }
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
            activeBuffs: [AoL_A, PFP_A, FF_A, HASTE_B],
            auraOfLifeHpMaxProtected: true,
            auraOfPuritySaveAdvantageConditions: ['frightened'],
        })
        seed('Charlie', { activeBuffs: [AoL_C, FF_C, CE_C, HASTE_C] })

        await cleanupConcentrationEffects('Alice', 'Faerie Fire', CAMPAIGN)

        expect(h.doc('Bob').activeBuffs).toEqual([HASTE_B])
        // Pinned defects (#871 over-removal class): Charlie's own buffs stripped by the name-only
        // sweeps — cleanupBuffsByName (concentrationService.js:483, no source check) and
        // removeCalmEmotionsBuffs (line 225, unconditional + no source check). Update when fixed.
        expect(h.doc('Charlie').activeBuffs).toEqual([AoL_C, HASTE_C])
        expect(h.doc('Bob').auraOfLifeHpMaxProtected).toBe(false)
        // Quirk: purity save-advantage conditions clear for every roster creature with a stored
        // list, even one carrying no Aura of Purity buff (line 306-309).
        expect(h.doc('Bob').auraOfPuritySaveAdvantageConditions).toEqual([])
        // Caster-owned auxiliary holy-aura keys reset; foreign tes byte-identical.
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
        expect(te()).toEqual([stoneZoe])
        expect(clearFleshToStonePrompt).toHaveBeenCalledWith(CAMPAIGN, 'Bob')
        expect(clearFleshToStonePrompt).toHaveBeenCalledTimes(1)
        expect(revertTruePolymorph).not.toHaveBeenCalled()
    })

    it('break without a spell name is byte-inert except the unconditional summon/heroism dispatch and holy-aura caster resets', async () => {
        // Honest zero-cleanup leg (#934): nothing matches, nothing is removed...
        const F_CON = { source: 'Charlie', effect: 'haste', target: 'Dave', duration: 'concentration' }
        seedCampaign([F_CON])

        await cleanupConcentrationEffects('Alice', undefined, CAMPAIGN)

        // ...except the guards/keys that fire unconditionally: break log is skipped (no spell name),
        // summons + heroism always dispatched, and holy-aura caster keys reset on EVERY break
        // regardless of spell (concentrationService.js:450-451 — harmless noise, pinned honestly).
        expect(addEntry).not.toHaveBeenCalled()
        expect(removeSummonedCreatures).toHaveBeenCalledWith('Alice', CAMPAIGN)
        expect(removeHeroismBuff).toHaveBeenCalledWith('Alice', CAMPAIGN)
        expect(te()).toEqual([F_CON])
        expect(callsFor('campaign', 'targetEffects')).toHaveLength(0)
        expect(callsFor('Alice', 'holyAuraTargets')).toEqual([['Alice', 'holyAuraTargets', [], CAMPAIGN]])
        expect(callsFor('Alice', 'holyAuraSaveDc')).toEqual([['Alice', 'holyAuraSaveDc', null, CAMPAIGN]])
    })
})
