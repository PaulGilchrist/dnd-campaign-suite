// @maintained-by-ai
// Pass Without Trace SERVICE lane (lv2 abjuration group-stealth buff).
// Producer-vs-forwarder: triggerPassWithoutTraceSpell is a ZERO-PRODUCTION-CALLER
// forwarder (grep 'triggerPassWithoutTraceSpell' src => only this service's own
// definition; the live cast lane is gatePassWithoutTrace (spellGates.js:818/:411)
// -> pass_without_trace_target_selection popup (CreatureTargetPopups.jsx:61) ->
// handlePassWithoutTraceConfirm (useCustomHandlers.js:136) -> applyPassWithoutTraceEffect
// re-exported via automation/index.js:262/:646). Trigger tests are therefore
// drift-detector pins; apply tests own the numbers.
// Cited-by: useCustomHandlers.passWithoutTrace.test.js:8 delegates "+10 bonus build,
// dedupe/rollback" here — pinned in the producer fan-out test.
// Boundaries NOT re-pinned here: free-cast grants/stamp -> spellCalc2024-shadow-arts.test.js;
// free-cast authorization/consumption -> spellPreparationService.shadowArts.test.js (CLA-308);
// _Shadow_Arts_Pass_Without_Trace_freeCastCount re-arm -> restRules-longRest.shadowArts.test.js.
// This service contains ZERO free-cast bytes; the argument-keyed store fake below
// THROWS on any '_Shadow_Arts_' key, so any future free-cast touch here crashes the suite.
// Slot payment + concentration registration on confirm -> useCustomHandlers.passWithoutTrace.test.js (SP-085).
// Group-target selection (affiliation/range census) is upstream modal lane (#1345 boundary):
// this service fans out exactly one te per GIVEN name, order-preserving, duplicates coalesce.
// NO-CLOCK: disk duration 'Concentration, up to 1 hour' (>=1 min) is combat-scoped policy —
// te stores the flag duration:'concentration' only; clear owners: initiative wholesale wipe
// useInitiativeEffects.js:34 INITIATIVE_CLEARED_EFFECT_KEYS, rests restRules-shortRest.js:29 /
// restRules-longRest.js:28. Registry row 'pass_without_trace_bonus':
// targetEffectDefinitions.js:1104 (+10 Dexterity (Stealth)); consumer conditionEffects.js:645
// reads te.bonusExpression || '10' (consumer lane tested in conditionEffects.test.js).
import { readFileSync } from 'fs'
import { triggerPassWithoutTraceSpell, applyPassWithoutTraceEffect } from './passWithoutTraceService.js'
import { executeHandler } from '../../automation/index.js'
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { addEntry } from '../../ui/logService.js'

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}))

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}))

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}))

const CAMPAIGN = 'test-campaign'

// Disk canon, read programmatically (both rulesets).
const disk5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'))
const disk24 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'))
const list5e = Array.isArray(disk5e) ? disk5e : disk5e.spells
const list24 = Array.isArray(disk24) ? disk24 : disk24.spells
const SPELL_5E = list5e.find(s => s.name === 'Pass Without Trace')
const SPELL_2024 = list24.find(s => s.name === 'Pass Without Trace')

// Argument-keyed STATEFUL store fake: THROWS on unknown owner/key/campaign and on
// wrong read arity (production getRuntimeValue(characterKey, propertyName) is 2-arg,
// useRuntimeState.js:63). Records an op order for read-before-write auditing.
function makeStoreFake() {
    const data = new Map()
    const ops = []
    return {
        ops,
        seed(key, value) { data.set(key, value) },
        get(characterKey, propertyName) {
            if (arguments.length !== 2 || characterKey !== 'campaign' || propertyName !== 'targetEffects') {
                throw new Error(`passWithoutTraceService must only read campaign/targetEffects (2-arg), got ${characterKey}/${propertyName} (${arguments.length} args)`)
            }
            ops.push('read')
            return data.has(propertyName) ? data.get(propertyName) : null
        },
        set(characterKey, propertyName, value, campaignName) {
            if (characterKey !== 'campaign' || propertyName !== 'targetEffects' || campaignName !== CAMPAIGN) {
                throw new Error(`unexpected runtime write: ${characterKey}/${propertyName}/${campaignName}`)
            }
            ops.push('write')
            data.set(propertyName, value)
        },
    }
}

let store
let order
let failSpec // { type: 'spell' | 'automation', err } — per-test log-failure injection

describe('passWithoutTraceService', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        store = makeStoreFake()
        order = store.ops // single ledger: store.ops IS order (op order audited)
        failSpec = null
        getRuntimeValue.mockImplementation((...args) => store.get(...args))
        setRuntimeValue.mockImplementation((...args) => store.set(...args))
        addEntry.mockImplementation((campaign, entry) => {
            order.push('log')
            if (failSpec && failSpec.type === entry.type) return Promise.reject(failSpec.err)
            return Promise.resolve(entry)
        })
        executeHandler.mockResolvedValue({ type: 'popup' })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    describe('triggerPassWithoutTraceSpell (zero-production-caller forwarder — drift pins)', () => {
        it('name-gates strict lowercase match: real disk near-misses return null, case variants pass with canonical name override', async () => {
            // REAL disk rows (spells.json) that share stealth/concentration adjacency:
            for (const name of ['Bless', 'Sanctuary', 'Misty Step', 'Silence', 'Invisibility', '']) {
                const result = await triggerPassWithoutTraceSpell({ name }, {}, { name: 'Druid' }, CAMPAIGN, null)
                expect(result).toBeNull()
            }
            expect(executeHandler).not.toHaveBeenCalled()

            // lowercase + uppercase pass the case-insensitive gate; envelope name is canonical.
            executeHandler.mockResolvedValue('sentinel-lower')
            const lower = await triggerPassWithoutTraceSpell(
                { name: 'pass without trace' }, {}, { name: 'Druid' }, CAMPAIGN, null)
            expect(lower).toBe('sentinel-lower')
            await triggerPassWithoutTraceSpell(
                { name: 'PASS WITHOUT TRACE' }, {}, { name: 'Druid' }, CAMPAIGN, null)
            expect(executeHandler).toHaveBeenCalledTimes(2)
            expect(executeHandler.mock.calls[0][0].name).toBe('Pass Without Trace')
            expect(order).toEqual([]) // trigger never touches the runtime store
        })

        it('forwards the canonical disk action envelope for BOTH rulesets and returns the handler result by identity', async () => {
            const expectedAutomation = { type: 'pass_without_trace', range: 'Self', auraRange: 30 }

            // Disk canon parity: both rulesets lv2, concentration, no save (RAW), auraRange 30.
            for (const spell of [SPELL_5E, SPELL_2024]) {
                expect(spell.level).toBe(2)
                expect(spell.concentration).toBe(true)
                expect('save' in spell).toBe(false)
                expect(spell.automation).toEqual({ type: 'pass_without_trace', duration: 'Concentration, up to 1 hour', auraRange: 30 })
            }
            // Honest divergence: duration/casting_time bytes differ on disk, range identical.
            expect(SPELL_5E.duration).toBe('Up to 1 hour')
            expect(SPELL_2024.duration).toBe('Concentration, up to 1 hour')
            expect(SPELL_5E.casting_time).toBe('1 action')
            expect(SPELL_2024.casting_time).toBe('Action')
            expect(SPELL_5E.range).toBe(SPELL_2024.range)

            for (const spell of [SPELL_5E, SPELL_2024]) {
                const handlerResult = { type: 'popup', payload: { type: 'pass_without_trace_target_selection' } }
                executeHandler.mockResolvedValue(handlerResult)
                order.length = 0

                const result = await triggerPassWithoutTraceSpell(spell, { slotLevel: 2 }, { name: 'Druid' }, CAMPAIGN, 'map-1')

                // Full-set envelope, exact key sets — disk automation.duration is DROPPED (no clock in the action).
                const action = executeHandler.mock.calls.at(-1)[0]
                expect(Object.keys(action)).toEqual(['name', 'automation', 'spell', 'spellSlotLevel'])
                expect(Object.keys(action.automation)).toEqual(['type', 'range', 'auraRange'])
                expect(action.name).toBe('Pass Without Trace')
                expect(action.automation).toEqual(expectedAutomation)
                expect(action.spellSlotLevel).toBe(2)
                expect(action.spell).toBe(spell) // pass-through by identity
                // Forwarder: result returned by identity, store/logs untouched.
                expect(result).toBe(handlerResult)
                expect(order).toEqual([])
                // 4-positional handoff to executeHandler
                expect(executeHandler.mock.calls.at(-1).slice(1)).toEqual([{ name: 'Druid' }, CAMPAIGN, 'map-1'])
            }
        })

        it('drift-pins fallback defaults that have ZERO disk producers (disk always ships level/range/automation)', async () => {
            // synthetic minimal spell — unreachable from disk rows above
            await triggerPassWithoutTraceSpell({ name: 'Pass Without Trace' }, {}, { name: 'Druid' }, CAMPAIGN, null)
            const action = executeHandler.mock.calls[0][0]
            expect(action.spellSlotLevel).toBe(1)
            expect(action.automation).toEqual({ type: 'pass_without_trace', range: 'Self', auraRange: 30 })

            // :0-swallow: metaCtx.slotLevel 0 is falsy and falls through to spell.level.
            await triggerPassWithoutTraceSpell(SPELL_5E, { slotLevel: 0 }, { name: 'Druid' }, CAMPAIGN, null)
            expect(executeHandler.mock.calls[1][0].spellSlotLevel).toBe(2)
        })

        it('rejects null spell with a golden TypeError (name-deref outside try) and swallows handler rejection to null with exact console bytes', async () => {
            // #1360 class: spell.name deref on line 6 sits OUTSIDE the try — null spell is a golden TypeError.
            await expect(triggerPassWithoutTraceSpell(null, {}, { name: 'Druid' }, CAMPAIGN, null))
                .rejects.toThrow(TypeError)

            const err = new Error('Handler failed')
            executeHandler.mockRejectedValue(err)
            const consoleSpy = vi.spyOn(console, 'error')
            const result = await triggerPassWithoutTraceSpell(SPELL_5E, {}, { name: 'Druid' }, CAMPAIGN, null)
            expect(result).toBeNull()
            expect(consoleSpy).toHaveBeenCalledWith('[passWithoutTrace] Failed to execute handler:', err)
            consoleSpy.mockRestore()
        })
    })

    describe('applyPassWithoutTraceEffect (production producer, called from useCustomHandlers.js:158)', () => {
        it('target gate: null, non-array and empty targetNames return null with zero store/log touches (false path triples)', async () => {
            for (const bad of [null, undefined, 'Druid', {}, 0, []]) {
                const result = await applyPassWithoutTraceEffect(SPELL_5E, { name: 'Druid' }, CAMPAIGN, null, bad)
                expect(result).toBeNull()
            }
            expect(order).toEqual([])
        })

        it('writes exact full-byte te fan-out: order-preserving, duplicates coalesce, same-key refreshes in place, unrelated rows untouched, no clock keys', async () => {
            const staleSameKey = { target: 'Druid', effect: 'pass_without_trace_bonus', source: 'Druid', slotLevel: 1, duration: 'concentration', bonusExpression: '+10', stale: true }
            const unrelatedOtherEffect = { target: 'Rogue', effect: 'beacon_of_hope', source: 'Cleric' }
            const sameEffectOtherSource = { target: 'Druid', effect: 'pass_without_trace_bonus', source: 'Cleric', slotLevel: 2, duration: 'concentration', bonusExpression: '+10' }
            const seedArray = [staleSameKey, unrelatedOtherEffect, sameEffectOtherSource]
            store.seed('targetEffects', seedArray)

            const result = await applyPassWithoutTraceEffect(SPELL_5E, { name: 'Druid' }, CAMPAIGN, null, ['Druid', 'Barbarian', 'Druid'])

            const expectedDruid = { target: 'Druid', effect: 'pass_without_trace_bonus', source: 'Druid', slotLevel: 2, duration: 'concentration', bonusExpression: '+10' }
            const expectedBarbarian = { target: 'Barbarian', effect: 'pass_without_trace_bonus', source: 'Druid', slotLevel: 2, duration: 'concentration', bonusExpression: '+10' }

            expect(setRuntimeValue).toHaveBeenCalledTimes(1)
            const [wOwner, wKey, written, wCampaign] = setRuntimeValue.mock.calls[0]
            expect([wOwner, wKey, wCampaign]).toEqual(['campaign', 'targetEffects', CAMPAIGN])
            // exact full array: stale replaced IN PLACE (index 0), duplicate collapsed,
            // unrelated rows preserved BY IDENTITY — same effect from a DIFFERENT source
            // is NOT collapsed (dedupe key is target+effect+source)
            expect(written).toHaveLength(4)
            expect(written[0]).toEqual(expectedDruid)
            expect(Object.keys(written[0])).toEqual(['target', 'effect', 'source', 'slotLevel', 'duration', 'bonusExpression']) // no clock/timestamp keys
            expect(written[1]).toBe(unrelatedOtherEffect)
            expect(written[2]).toBe(sameEffectOtherSource)
            expect(written[3]).toEqual(expectedBarbarian)
            // input stored array not mutated (copy-on-write)
            expect(seedArray).toHaveLength(3)
            expect(seedArray[0]).toBe(staleSameKey)
            expect(result.type).toBe('popup')
            expect(order).toEqual(['read', 'write', 'log', 'log']) // read-before-write, logs after store
        })

        it('stateful re-cast dedupes across invocations and refreshes slotLevel without duplicating targets', async () => {
            await applyPassWithoutTraceEffect(SPELL_5E, { name: 'Druid' }, CAMPAIGN, null, ['Druid', 'Barbarian'])
            const upcast = { ...SPELL_2024, level: 3 }
            await applyPassWithoutTraceEffect(upcast, { name: 'Druid' }, CAMPAIGN, null, ['Druid'])

            const second = setRuntimeValue.mock.calls[1][2]
            expect(second).toHaveLength(2)
            expect(second[0]).toEqual({ target: 'Druid', effect: 'pass_without_trace_bonus', source: 'Druid', slotLevel: 3, duration: 'concentration', bonusExpression: '+10' })
            expect(second[1]).toEqual({ target: 'Barbarian', effect: 'pass_without_trace_bonus', source: 'Druid', slotLevel: 2, duration: 'concentration', bonusExpression: '+10' })
            expect(setRuntimeValue).toHaveBeenCalledTimes(2)
        })

        it('logs spell + automation entries full-set with frozen timestamps for both rulesets, and returns the exact popup envelope', async () => {
            vi.useFakeTimers()
            vi.setSystemTime(1760000000000)
            const TS = Date.now()

            const result = await applyPassWithoutTraceEffect(SPELL_5E, { name: 'Druid' }, CAMPAIGN, null, ['Druid', 'Barbarian'])

            expect(addEntry).toHaveBeenCalledTimes(2)
            expect(addEntry.mock.calls[0]).toEqual([CAMPAIGN, {
                type: 'spell',
                characterName: 'Druid',
                targetName: 'Druid',
                targets: ['Druid', 'Barbarian'],
                spellName: 'Pass Without Trace',
                spellLevel: 2,
                castingTime: '1 action',
                description: 'Druid casts Pass Without Trace on Druid, Barbarian.',
                timestamp: TS,
            }])
            expect(addEntry.mock.calls[1]).toEqual([CAMPAIGN, {
                type: 'automation',
                characterName: 'Druid',
                automationType: 'pass_without_trace',
                name: 'Pass Without Trace',
                description: 'Pass Without Trace cast: 2 creature(s) affected — Druid, Barbarian. Each has +10 to Dexterity (Stealth) checks and leaves no tracks.',
                timestamp: TS,
            }])
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Pass Without Trace',
                    description: 'Pass Without Trace cast: 2 creature(s) affected — Druid, Barbarian. Each has +10 to Dexterity (Stealth) checks and leaves no tracks.',
                },
            })

            // 2024 disk spell: castingTime byte comes from disk ('Action'); te bytes parity with 5e,
            // and Barbarian persists from invocation 1 through the STATEFUL store (cross-call continuity).
            order.length = 0
            addEntry.mockClear()
            await applyPassWithoutTraceEffect(SPELL_2024, { name: 'Druid' }, CAMPAIGN, null, ['Druid'])
            expect(addEntry.mock.calls[0][1].castingTime).toBe('Action')
            expect(addEntry.mock.calls[0][1].spellLevel).toBe(2)
            expect(setRuntimeValue.mock.calls.at(-1)[2]).toEqual([
                { target: 'Druid', effect: 'pass_without_trace_bonus', source: 'Druid', slotLevel: 2, duration: 'concentration', bonusExpression: '+10' },
                { target: 'Barbarian', effect: 'pass_without_trace_bonus', source: 'Druid', slotLevel: 2, duration: 'concentration', bonusExpression: '+10' },
            ])
        })

        it('isolates each log rejection in its own catch without breaking the cast outcome', async () => {
            const consoleSpy = vi.spyOn(console, 'error')

            // invocation 1: SPELL log rejects -> only cast-catch fires; automation log still written.
            const errCast = new Error('DB error')
            failSpec = { type: 'spell', err: errCast }
            const r1 = await applyPassWithoutTraceEffect(SPELL_5E, { name: 'Druid' }, CAMPAIGN, null, ['Druid'])
            await new Promise(resolve => setTimeout(resolve, 0)) // flush rejection microtasks
            expect(consoleSpy).toHaveBeenCalledTimes(1)
            expect(consoleSpy).toHaveBeenCalledWith('[passWithoutTrace] Error logging cast:', errCast)
            expect(order).toEqual(['read', 'write', 'log', 'log']) // both entries still attempted

            // invocation 2: AUTOMATION log rejects -> only automation-catch fires.
            order.length = 0
            consoleSpy.mockClear()
            const errAuto = new Error('DB error 2')
            failSpec = { type: 'automation', err: errAuto }
            const r2 = await applyPassWithoutTraceEffect(SPELL_5E, { name: 'Druid' }, CAMPAIGN, null, ['Druid'])
            await new Promise(resolve => setTimeout(resolve, 0))
            expect(consoleSpy).toHaveBeenCalledTimes(1)
            expect(consoleSpy).toHaveBeenCalledWith('[passWithoutTrace] Error logging automation:', errAuto)
            expect(order).toEqual(['read', 'write', 'log', 'log'])

            const popup = {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Pass Without Trace',
                    description: 'Pass Without Trace cast: 1 creature(s) affected — Druid. Each has +10 to Dexterity (Stealth) checks and leaves no tracks.',
                },
            }
            expect(r1).toEqual(popup)
            expect(r2).toEqual(popup)
            expect(setRuntimeValue).toHaveBeenCalledTimes(2) // store writes unaffected by log failures
            consoleSpy.mockRestore()
        })

        it('silently replaces falsy/non-array stored effects and pins the name-agnostic apply contract (gate lives upstream)', async () => {
            // empty store: fake reads return null -> fresh array written back
            await applyPassWithoutTraceEffect(SPELL_5E, { name: 'Druid' }, CAMPAIGN, null, ['Druid'])
            expect(setRuntimeValue.mock.calls[0][2]).toEqual([{ target: 'Druid', effect: 'pass_without_trace_bonus', source: 'Druid', slotLevel: 2, duration: 'concentration', bonusExpression: '+10' }])

            // :0-swallow census member: non-array stored value discarded silently (Array.isArray ternary, line 41)
            store.seed('targetEffects', 'not-an-array')
            await applyPassWithoutTraceEffect(SPELL_5E, { name: 'Druid' }, CAMPAIGN, null, ['Barbarian'])
            expect(setRuntimeValue.mock.calls[1][2]).toEqual([{ target: 'Barbarian', effect: 'pass_without_trace_bonus', source: 'Druid', slotLevel: 2, duration: 'concentration', bonusExpression: '+10' }])

            // minimal spell (no level/casting_time): slotLevel 1 fallback, casting_time '1 action' fallback;
            // name-agnostic: apply has NO name gate — dispatched by automation type from the confirm lane only.
            await applyPassWithoutTraceEffect({ name: 'Sanctuary' }, { name: 'Druid' }, CAMPAIGN, null, ['Druid'])
            expect(setRuntimeValue.mock.calls[2][2]).toEqual([
                { target: 'Barbarian', effect: 'pass_without_trace_bonus', source: 'Druid', slotLevel: 2, duration: 'concentration', bonusExpression: '+10' },
                { target: 'Druid', effect: 'pass_without_trace_bonus', source: 'Druid', slotLevel: 1, duration: 'concentration', bonusExpression: '+10' },
            ]) // Barbarian survives; Sanctuary-named spell still produced pass_without_trace_bonus
            const spellLogs = addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'spell')
            expect(spellLogs.map(e => e.castingTime)).toEqual(['1 action', '1 action', '1 action']) // disk bytes then fallbacks
            expect(spellLogs.map(e => e.spellLevel)).toEqual([2, 2, 1])
            expect(spellLogs.map(e => e.spellName)).toEqual(['Pass Without Trace', 'Pass Without Trace', 'Pass Without Trace']) // hardcoded, not spell.name
        })
    })
})
