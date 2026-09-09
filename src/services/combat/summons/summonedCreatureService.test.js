// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

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
import { isSpellSummon, removeSummonedCreatures, vanishSummonAtZeroHp } from './summonedCreatureService.js'

describe('isSpellSummon', () => {
    it('returns true when creature has summonSource === "spell"', () => {
        expect(isSpellSummon({ name: 'Imp', summonSource: 'spell' })).toBe(true)
    })

    it('returns false when creature has summonSource === "true_polymorph"', () => {
        expect(isSpellSummon({ name: 'Dragon', summonSource: 'true_polymorph' })).toBe(false)
    })

    it('returns false when creature has no summonSource', () => {
        expect(isSpellSummon({ name: 'Goblin' })).toBe(false)
    })

    it('returns false when creature is null', () => {
        expect(isSpellSummon(null)).toBe(false)
    })

    it('returns false when creature is undefined', () => {
        expect(isSpellSummon(undefined)).toBe(false)
    })

    it('returns false when creature is an empty object', () => {
        expect(isSpellSummon({})).toBe(false)
    })
})

describe('removeSummonedCreatures', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Reset the CustomEvent mock so we can track dispatches
        delete window.CustomEvent
        window.CustomEvent = class {
            constructor(type, opts) {
                this.type = type
                this.bubbles = opts?.bubbles || false
            }
        }
        window.dispatchEvent = vi.fn()
    })

    it('returns early without side effects when sourceName is missing', () => {
        removeSummonedCreatures(null, 'test-campaign')
        expect(getCombatSummary).not.toHaveBeenCalled()
        expect(getRuntimeValue).not.toHaveBeenCalled()
        expect(storage.set).not.toHaveBeenCalled()
    })

    it('returns early without side effects when campaignName is missing', () => {
        removeSummonedCreatures('Summoner', null)
        expect(getCombatSummary).not.toHaveBeenCalled()
        expect(getRuntimeValue).not.toHaveBeenCalled()
        expect(storage.set).not.toHaveBeenCalled()
    })

    it('returns early when both sourceName and campaignName are missing', () => {
        removeSummonedCreatures(null, null)
        expect(getCombatSummary).not.toHaveBeenCalled()
    })

    it('removes creatures from combatSummary when they match sourceName and summonSource spell', () => {
        const cs = {
            round: 2,
            creatures: [
                { name: 'Goblin', type: 'npc' },
                { name: 'Imp', summonSource: 'spell', summonedBy: 'Summoner' },
                { name: 'Skeleton', summonSource: 'true_polymorph', summonedBy: 'Summoner' },
                { name: 'Wraith', type: 'npc', summonedBy: 'Other' },
            ],
        }
        getCombatSummary.mockReturnValue(cs)
        getRuntimeValue.mockReturnValue([])

        removeSummonedCreatures('Summoner', 'test-campaign')

        expect(storage.set).toHaveBeenCalledWith(
            'combatSummary',
            expect.objectContaining({
                round: 2,
                creatures: expect.arrayContaining([
                    expect.objectContaining({ name: 'Goblin' }),
                    expect.objectContaining({ name: 'Wraith' }),
                ]),
            }),
            'test-campaign'
        )
        expect(setCombatSummaryCache).toHaveBeenCalledWith(
            expect.objectContaining({
                creatures: expect.arrayContaining([
                    expect.objectContaining({ name: 'Goblin' }),
                    expect.objectContaining({ name: 'Wraith' }),
                ]),
            }),
            'test-campaign'
        )
        expect(window.dispatchEvent).toHaveBeenCalledWith(expect.any(CustomEvent))
    })

    it('removes creatures with summonSource true_polymorph as well as spell', () => {
        const cs = {
            round: 1,
            creatures: [
                { name: 'Dragon', summonSource: 'true_polymorph', summonedBy: 'Wizard' },
            ],
        }
        getCombatSummary.mockReturnValue(cs)
        getRuntimeValue.mockReturnValue([])

        removeSummonedCreatures('Wizard', 'test-campaign')

        expect(storage.set).toHaveBeenCalledWith(
            'combatSummary',
            expect.objectContaining({ creatures: [] }),
            'test-campaign'
        )
    })

    it('does not update storage when no creatures match', () => {
        const cs = {
            round: 1,
            creatures: [
                { name: 'Goblin', type: 'npc' },
                { name: 'Wraith', type: 'npc', summonedBy: 'Other' },
            ],
        }
        getCombatSummary.mockReturnValue(cs)
        getRuntimeValue.mockReturnValue([])

        removeSummonedCreatures('Summoner', 'test-campaign')

        expect(storage.set).not.toHaveBeenCalled()
        expect(setCombatSummaryCache).not.toHaveBeenCalled()
        expect(window.dispatchEvent).not.toHaveBeenCalled()
    })

    it('handles combatSummary with no creatures array', () => {
        getCombatSummary.mockReturnValue({ round: 1 })
        getRuntimeValue.mockReturnValue([])

        removeSummonedCreatures('Summoner', 'test-campaign')

        expect(storage.set).not.toHaveBeenCalled()
    })

    it('handles combatSummary being null', () => {
        getCombatSummary.mockReturnValue(null)
        getRuntimeValue.mockReturnValue([])

        removeSummonedCreatures('Summoner', 'test-campaign')

        expect(storage.set).not.toHaveBeenCalled()
    })

    it('removes matching targetEffects and calls setRuntimeValue when filtered differs', () => {
        const targetEffects = [
            { effect: 'summoned', source: 'Summoner', summonSource: 'spell' },
            { effect: 'summoned', source: 'Summoner', summonSource: 'true_polymorph' },
            { effect: 'summoned', source: 'Other', summonSource: 'spell' },
            { effect: 'buff', source: 'Summoner' },
        ]
        getCombatSummary.mockReturnValue(null)
        getRuntimeValue.mockReturnValue(targetEffects)

        removeSummonedCreatures('Summoner', 'test-campaign')

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({ effect: 'summoned', source: 'Other' }),
                expect.objectContaining({ effect: 'buff', source: 'Summoner' }),
            ]),
            'test-campaign',
            true
        )
    })

    it('does not call setRuntimeValue when no targetEffects match', () => {
        getCombatSummary.mockReturnValue(null)
        getRuntimeValue.mockReturnValue([
            { effect: 'buff', source: 'Summoner' },
            { effect: 'debuff', source: 'Other' },
        ])

        removeSummonedCreatures('Summoner', 'test-campaign')

        expect(setRuntimeValue).not.toHaveBeenCalled()
    })

    it('does not remove targetEffects from different sources', () => {
        getCombatSummary.mockReturnValue(null)
        getRuntimeValue.mockReturnValue([
            { effect: 'summoned', source: 'Other', summonSource: 'spell' },
        ])

        removeSummonedCreatures('Summoner', 'test-campaign')

        expect(setRuntimeValue).not.toHaveBeenCalled()
    })

    it('does not remove targetEffects without matching summonSource', () => {
        getCombatSummary.mockReturnValue(null)
        getRuntimeValue.mockReturnValue([
            { effect: 'summoned', source: 'Summoner', summonSource: 'other' },
        ])

        removeSummonedCreatures('Summoner', 'test-campaign')

        expect(setRuntimeValue).not.toHaveBeenCalled()
    })

    it('handles targetEffects being null', () => {
        getCombatSummary.mockReturnValue(null)
        getRuntimeValue.mockReturnValue(null)

        removeSummonedCreatures('Summoner', 'test-campaign')

        expect(setRuntimeValue).not.toHaveBeenCalled()
    })

    it('handles targetEffects being undefined', () => {
        getCombatSummary.mockReturnValue(null)
        getRuntimeValue.mockReturnValue(undefined)

        removeSummonedCreatures('Summoner', 'test-campaign')

        expect(setRuntimeValue).not.toHaveBeenCalled()
    })

    it('handles both combatSummary creatures and targetEffects removal together', () => {
        const cs = {
            round: 3,
            creatures: [
                { name: 'Imp', summonSource: 'spell', summonedBy: 'Summoner' },
            ],
        }
        const targetEffects = [
            { effect: 'summoned', source: 'Summoner', summonSource: 'spell' },
        ]
        getCombatSummary.mockReturnValue(cs)
        getRuntimeValue.mockReturnValue(targetEffects)

        removeSummonedCreatures('Summoner', 'test-campaign')

        expect(storage.set).toHaveBeenCalled()
        expect(setCombatSummaryCache).toHaveBeenCalled()
        expect(setRuntimeValue).toHaveBeenCalled()
        expect(window.dispatchEvent).toHaveBeenCalled()
    })

    it('does not dispatch event when combatSummary unchanged and targetEffects unchanged', () => {
        const cs = {
            round: 1,
            creatures: [{ name: 'Goblin' }],
        }
        getCombatSummary.mockReturnValue(cs)
        getRuntimeValue.mockReturnValue([{ effect: 'buff', source: 'Other' }])

        removeSummonedCreatures('Summoner', 'test-campaign')

        expect(window.dispatchEvent).not.toHaveBeenCalled()
    })
})

describe('vanishSummonAtZeroHp (SP-114)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        delete window.CustomEvent
        window.CustomEvent = class {
            constructor(type, opts) {
                this.type = type
                this.bubbles = opts?.bubbles || false
            }
        }
        window.dispatchEvent = vi.fn()
    })

    it('removes the summoned combatant from combatSummary in place, strips its te, and logs', () => {
        const spirit = { name: 'Aberrant Spirit (Mind Flayer)', summonedBy: 'Wizard', summonSource: 'spell', currentHp: 0 }
        const cs = { round: 1, creatures: [{ name: 'Thug 1' }, spirit] }
        getRuntimeValue.mockReturnValue([
            { effect: 'summoned', target: 'Aberrant Spirit (Mind Flayer)', source: 'Wizard', summonSource: 'spell' },
            { effect: 'bless_bonus', target: 'Thug 1', source: 'Cleric' },
        ])

        const removed = vanishSummonAtZeroHp(spirit, cs, 'test-campaign')

        expect(removed).toBe(true)
        expect(cs.creatures.map(c => c.name)).toEqual(['Thug 1'])
        expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, 'test-campaign')
        expect(setCombatSummaryCache).toHaveBeenCalledWith(cs, 'test-campaign')
        const teWrite = setRuntimeValue.mock.calls.find(c => c[1] === 'targetEffects')
        expect(teWrite[2]).toEqual([{ effect: 'bless_bonus', target: 'Thug 1', source: 'Cleric' }])
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'summons',
            characterName: 'Wizard',
            description: expect.stringContaining('disappears at 0 Hit Points'),
        }))
        expect(window.dispatchEvent).toHaveBeenCalled()
    })

    it('does nothing for non-summoned creatures', () => {
        const thug = { name: 'Thug 1', currentHp: 0 }
        const cs = { round: 1, creatures: [thug] }
        getRuntimeValue.mockReturnValue([])

        expect(vanishSummonAtZeroHp(thug, cs, 'test-campaign')).toBe(false)
        expect(cs.creatures).toHaveLength(1)
        expect(addEntry).not.toHaveBeenCalled()
    })

    it('does nothing without summonedBy or campaignName', () => {
        expect(vanishSummonAtZeroHp({ name: 'X', summonSource: 'spell' }, { creatures: [] }, null)).toBe(false)
        expect(vanishSummonAtZeroHp({ name: 'X', summonSource: 'spell' }, { creatures: [] }, 'test-campaign')).toBe(false)
    })
})
