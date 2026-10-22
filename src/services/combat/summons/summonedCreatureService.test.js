// @maintained-by-ai
// Lane: summonedCreatureService — summoned-creature roster/effects store utilities (SP-114).
// Family map: sole owner lane — concentrationService, createCreatureHandlers,
// createConcentrationHandlers, useLoggedDiceRollEventHandlers, applyDamage and the
// expirations lanes all vi.mock() this module. stripSummonedFromCombatSummary's spell
// happy-path payload is exercised in createConcentrationHandlers-2.test.jsx; only the
// true_polymorph / guard / orphan-te branches live here (no duplication).
// Concentration lifecycle bytes belong to concentrationService (#994) — not verified here.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}))

vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
    setCombatSummaryCache: vi.fn(),
}))

vi.mock('../../ui/storage.js', () => ({
    default: {
        set: vi.fn().mockResolvedValue(undefined),
    },
}))

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({}),
}))

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { getCombatSummary, setCombatSummaryCache } from '../../encounters/combatData.js'
import storage from '../../ui/storage.js'
import { addEntry } from '../../ui/logService.js'
import {
    removeSummonedCreatures,
    stripSummonedFromCombatSummary,
    vanishSummonAtZeroHp,
} from './summonedCreatureService.js'

const realDispatchEvent = window.dispatchEvent

beforeEach(() => {
    vi.clearAllMocks()
    window.dispatchEvent = vi.fn()
})

afterEach(() => {
    window.dispatchEvent = realDispatchEvent
})

const expectNoWrites = (label = '') => {
    expect(storage.set, `${label}: storage`).not.toHaveBeenCalled()
    expect(setCombatSummaryCache, `${label}: cache`).not.toHaveBeenCalled()
    expect(setRuntimeValue, `${label}: runtime`).not.toHaveBeenCalled()
    expect(window.dispatchEvent, `${label}: dispatch`).not.toHaveBeenCalled()
}

describe('removeSummonedCreatures', () => {
    it('guards invalid args before touching any store, and survives degenerate store shapes', () => {
        // Stores primed with MATCHING data so a skipped guard is loud (#1035).
        getCombatSummary.mockReturnValue({
            round: 1,
            creatures: [{ name: 'Imp', summonSource: 'spell', summonedBy: 'Summoner' }],
        })
        getRuntimeValue.mockReturnValue([
            { effect: 'summoned', source: 'Summoner', summonSource: 'spell' },
        ])

        for (const [label, sourceName, campaignName] of [
            ['missing sourceName', null, 'test-campaign'],
            ['missing campaignName', 'Summoner', null],
            ['both missing', null, null],
        ]) {
            removeSummonedCreatures(sourceName, campaignName)
            expect(getCombatSummary, `${label}: no store read`).not.toHaveBeenCalled()
            expect(getRuntimeValue, `${label}: no store read`).not.toHaveBeenCalled()
            expectNoWrites(label)
        }

        // Degenerate store shapes with valid args (#945): reads happen, writes must not.
        for (const [cs, te] of [
            [null, []],
            [{ round: 1 }, []],
            [{ round: 1, creatures: [] }, null],
            [{ round: 1, creatures: [] }, undefined],
        ]) {
            vi.clearAllMocks()
            getCombatSummary.mockReturnValue(cs)
            getRuntimeValue.mockReturnValue(te)
            removeSummonedCreatures('Summoner', 'test-campaign')
            expectNoWrites(JSON.stringify(cs ?? 'null-cs'))
        }
    })

    it('persists the exact surviving roster (spell + true_polymorph removed, co-tenants survive) and broadcasts', () => {
        const goblin = { name: 'Goblin', type: 'npc' }
        const wraith = { name: 'Wraith', type: 'npc', summonedBy: 'Other' } // other summoner survives (#948)
        const untagged = { name: 'Mimic', summonedBy: 'Summoner' } // no summonSource — near-miss survives (#1051)
        const cs = {
            round: 2,
            creatures: [
                goblin,
                { name: 'Imp', summonSource: 'spell', summonedBy: 'Summoner' },
                { name: 'Dragon', summonSource: 'true_polymorph', summonedBy: 'Summoner' },
                wraith,
                untagged,
            ],
        }
        getCombatSummary.mockReturnValue(cs)
        getRuntimeValue.mockReturnValue([])

        removeSummonedCreatures('Summoner', 'test-campaign')

        expect(getCombatSummary).toHaveBeenCalledWith('test-campaign') // campaign-pinned read (#1019)
        expect(storage.set).toHaveBeenCalledTimes(1)
        expect(storage.set).toHaveBeenCalledWith(
            'combatSummary',
            { round: 2, creatures: [goblin, wraith, untagged] }, // exact full array (#932)
            'test-campaign'
        )
        const updated = storage.set.mock.calls[0][1]
        expect(updated.creatures[0]).toBe(goblin) // survivors carry original references (#993)
        expect(setCombatSummaryCache).toHaveBeenCalledWith(updated, 'test-campaign') // cache mirrors the write
        expect(cs.creatures).toHaveLength(5) // copy-out contract: caller's summary untouched
        expect(window.dispatchEvent).toHaveBeenCalledTimes(1)
        expect(window.dispatchEvent.mock.calls[0][0].type).toBe('combat-summary-updated')
    })

    it('strips the source\'s summoned targetEffects as the exact surviving array with skipSync=true', () => {
        const otherSummon = { effect: 'summoned', source: 'Other', summonSource: 'spell' }
        const buff = { effect: 'buff', source: 'Summoner' }
        const rogueSource = { effect: 'summoned', source: 'Summoner', summonSource: 'other' } // invalid summonSource survives (#1051)
        getCombatSummary.mockReturnValue(null)
        getRuntimeValue.mockReturnValue([
            { effect: 'summoned', source: 'Summoner', summonSource: 'spell' },
            { effect: 'summoned', source: 'Summoner', summonSource: 'true_polymorph' },
            otherSummon,
            buff,
            rogueSource,
        ])

        removeSummonedCreatures('Summoner', 'test-campaign')

        expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects')
        expect(setRuntimeValue).toHaveBeenCalledTimes(1)
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            [otherSummon, buff, rogueSource], // exact survivors, order preserved (#932)
            'test-campaign',
            true // skipSync — SSE-echo guard
        )
        expect(storage.set).not.toHaveBeenCalled() // cs store untouched when nothing matched
    })

    it('writes nothing when no summons match (owner and summonSource near-misses)', () => {
        getCombatSummary.mockReturnValue({
            round: 1,
            creatures: [
                { name: 'Goblin' },
                { name: 'Wraith', summonedBy: 'Other', summonSource: 'spell' }, // wrong owner
            ],
        })
        getRuntimeValue.mockReturnValue([
            { effect: 'summoned', source: 'Other', summonSource: 'spell' }, // wrong owner
            { effect: 'summoned', source: 'Summoner', summonSource: 'other' }, // wrong summonSource
            { effect: 'buff', source: 'Summoner' },
        ])

        removeSummonedCreatures('Summoner', 'test-campaign')

        expectNoWrites('no-match')
    })
})

describe('stripSummonedFromCombatSummary', () => {
    it('mutates the caller\'s roster in place, removing only the source\'s spell + true_polymorph creatures', () => {
        const goblin = { name: 'Goblin' }
        const otherBeast = { name: 'Other Beast', summonedBy: 'Bob', summonSource: 'spell' } // wrong owner survives
        const untagged = { name: 'Alice', summonedBy: 'Alice' } // no summonSource survives (#1051)
        const cs = {
            round: 4,
            creatures: [
                goblin,
                { name: 'Familiar', summonedBy: 'Alice', summonSource: 'spell' },
                { name: 'Doppelganger', summonedBy: 'Alice', summonSource: 'true_polymorph' },
                otherBeast,
                untagged,
            ],
        }

        expect(stripSummonedFromCombatSummary(cs, 'Alice')).toBe(true)
        expect(cs.creatures).toEqual([goblin, otherBeast, untagged]) // exact survivors (#932)
        expect(cs.creatures[0]).toBe(goblin) // in-place, original references carried (#993)
        expect(cs.round).toBe(4) // only creatures replaced
    })

    it('returns false without mutating anything on invalid input or no match', () => {
        expect(stripSummonedFromCombatSummary(null, 'Alice')).toBe(false)
        expect(stripSummonedFromCombatSummary({ round: 1 }, 'Alice')).toBe(false) // no creatures array (#945)
        expect(stripSummonedFromCombatSummary({ creatures: [] }, null)).toBe(false) // no sourceName

        const cs = { creatures: [{ name: 'Goblin' }, { name: 'Familiar', summonedBy: 'Bob', summonSource: 'spell' }] }
        const before = cs.creatures
        expect(stripSummonedFromCombatSummary(cs, 'Alice')).toBe(false)
        expect(cs.creatures).toBe(before) // unchanged array, no replacement write-back
    })
})

describe('vanishSummonAtZeroHp (SP-114)', () => {
    it('removes the summoned combatant in place, strips its te, persists the same object, and logs exactly', () => {
        const spirit = { name: 'Aberrant Spirit (Mind Flayer)', summonedBy: 'Wizard', summonSource: 'spell', currentHp: 0 }
        const cs = { round: 1, creatures: [{ name: 'Thug 1' }, spirit] }
        getRuntimeValue.mockReturnValue([
            { effect: 'summoned', target: 'Aberrant Spirit (Mind Flayer)', source: 'Wizard', summonSource: 'spell' },
            { effect: 'bless_bonus', target: 'Thug 1', source: 'Cleric' },
        ])

        expect(vanishSummonAtZeroHp(spirit, cs, 'test-campaign')).toBe(true)
        expect(cs.creatures).toEqual([{ name: 'Thug 1' }]) // mutated in place — caller's persist carries it
        expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, 'test-campaign')
        expect(storage.set.mock.calls[0][1]).toBe(cs) // same reference, not a copy (#993)
        expect(setCombatSummaryCache).toHaveBeenCalledWith(cs, 'test-campaign')
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            [{ effect: 'bless_bonus', target: 'Thug 1', source: 'Cleric' }], // exact survivors (#932)
            'test-campaign'
        )
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'summons',
            characterName: 'Wizard',
            summonName: spirit.name,
            description: `${spirit.name} disappears at 0 Hit Points — Summon ends.`, // exact log text (#app)
            summonedCreatures: [spirit.name],
            timestamp: expect.any(Number),
        })
        expect(window.dispatchEvent).toHaveBeenCalledTimes(1)
        expect(window.dispatchEvent.mock.calls[0][0].type).toBe('combat-summary-updated')
    })

    it('returns false, short-circuiting before any store touch, for non-summons or missing context', () => {
        // Stores primed with MATCHING data so a skipped guard is loud (#1035).
        const cs = { round: 1, creatures: [{ name: 'X', summonedBy: 'Wizard', summonSource: 'spell' }] }
        getRuntimeValue.mockReturnValue([
            { effect: 'summoned', target: 'X', source: 'Wizard', summonSource: 'spell' },
        ])

        for (const [label, creature, campaignName] of [
            ['null creature', null, 'test-campaign'],
            ['no summonedBy', { name: 'X', summonSource: 'spell' }, 'test-campaign'],
            ['non-spell source', { name: 'X', summonedBy: 'Wizard', summonSource: 'true_polymorph' }, 'test-campaign'],
            ['no campaignName', { name: 'X', summonedBy: 'Wizard', summonSource: 'spell' }, null],
        ]) {
            expect(vanishSummonAtZeroHp(creature, cs, campaignName), label).toBe(false)
        }

        expect(getRuntimeValue, 'guards run before te read').not.toHaveBeenCalled()
        expect(cs.creatures).toHaveLength(1) // roster untouched
        expectNoWrites('guards')
        expect(addEntry).not.toHaveBeenCalled()
    })

    it('does not strike a same-named creature under a different owner, yet still cleans orphaned te', () => {
        const otherImp = { name: 'Imp', summonedBy: 'Other', summonSource: 'spell' }
        const cs = { round: 2, creatures: [otherImp] }
        getRuntimeValue.mockReturnValue([
            { effect: 'summoned', target: 'Imp', source: 'Wizard', summonSource: 'spell' }, // orphan te — cleaned anyway
            { effect: 'summoned', target: 'Imp', source: 'Other', summonSource: 'spell' },
        ])

        const wizardImp = { name: 'Imp', summonedBy: 'Wizard', summonSource: 'spell' }
        expect(vanishSummonAtZeroHp(wizardImp, cs, 'test-campaign')).toBe(false)
        expect(cs.creatures).toEqual([otherImp]) // owner pinned alongside name (#1051)
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            [{ effect: 'summoned', target: 'Imp', source: 'Other', summonSource: 'spell' }], // te cleanup independent of roster
            'test-campaign'
        )
        expect(storage.set).not.toHaveBeenCalled() // no roster change, no persist
        expect(addEntry).not.toHaveBeenCalled()
    })
})
