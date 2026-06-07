import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
}));

vi.mock('./encounterToInitiative.js', () => ({
    getMonsterSaveBonuses: vi.fn(() => ({ str: 1, dex: 2, con: 3, int: 0, wis: 1, cha: -1 })),
}));

import { rollD20 } from '../dice/diceRoller.js'
import {
    parseInitBonus,
    setupCreatures,
    addNpc,
    removeNpc,
    getNextCreatureName,
    getPreviousCreatureName,
    isPreviousDisabled,
    setInitiative,
    rollNpcInitiative,
    setTarget,
    clearCombat,
    mergeCombatSummaryWithCharacters,
} from './initiativeService.js'

function createCharacter(name) {
    return { name, computedStats: { hitPoints: 30, armorClass: 15 } }
}

function createCombatSummary(creatures = [], round = 1) {
    return { round, creatures }
}

describe('parseInitBonus', () => {
    it('parses positive bonus from initiative_details', () => {
        expect(parseInitBonus({ initiative_details: '+5' })).toBe(5)
    })

    it('parses negative bonus from initiative_details', () => {
        expect(parseInitBonus({ initiative_details: '-2' })).toBe(-2)
    })

    it('returns 0 when initiative_details is missing', () => {
        expect(parseInitBonus({})).toBe(0)
    })

    it('returns 0 when initiative_details is empty string', () => {
        expect(parseInitBonus({ initiative_details: '' })).toBe(0)
    })

    it('returns 0 when initiative_details has no leading number', () => {
        expect(parseInitBonus({ initiative_details: 'advantage' })).toBe(0)
    })
})

describe('setupCreatures', () => {
    const getName = (n) => n || 'Unknown'

    it('creates player creatures sorted alphabetically', () => {
        const chars = [createCharacter('Zara'), createCharacter('Alice')]
        const creatures = setupCreatures(chars, 0, getName)

        expect(creatures).toHaveLength(2)
        expect(creatures[0].name).toBe('Alice')
        expect(creatures[1].name).toBe('Zara')
    })

    it('creates player creatures with empty initiative', () => {
        const chars = [createCharacter('Alice')]
        const creatures = setupCreatures(chars, 0, getName)

        expect(creatures[0].initiative).toBe('')
        expect(creatures[0].type).toBe('player')
        expect(creatures[0].targetName).toBeNull()
        expect(creatures[0].concentration).toBeNull()
    })

    it('creates the specified number of NPCs', () => {
        const chars = [createCharacter('Alice')]
        const creatures = setupCreatures(chars, 3, getName)

        expect(creatures).toHaveLength(4)
        const npcs = creatures.filter(c => c.type === 'npc')
        expect(npcs).toHaveLength(3)
        expect(npcs[0].name).toBe('NPC 1')
        expect(npcs[1].name).toBe('NPC 2')
        expect(npcs[2].name).toBe('NPC 3')
    })

    it('NPCs have default stats', () => {
        const creatures = setupCreatures([], 1, getName)
        const npc = creatures[0]

        expect(npc.ac).toBe(10)
        expect(npc.maxHp).toBe(10)
        expect(npc.currentHp).toBe(10)
        expect(npc.resistances).toEqual([])
        expect(npc.immunities).toEqual([])
        expect(npc.conditions).toEqual([])
        expect(npc.saveBonuses).toEqual({})
    })
})

describe('addNpc', () => {
    it('adds NPC with next sequential number', () => {
        const cs = createCombatSummary([
            { name: 'NPC 1', type: 'npc' },
            { name: 'NPC 2', type: 'npc' },
        ])
        const nextNum = addNpc(cs)

        expect(nextNum).toBe(3)
        expect(cs.creatures).toHaveLength(3)
        expect(cs.creatures[2].name).toBe('NPC 3')
    })

    it('finds next number when NPCs are non-contiguous', () => {
        const cs = createCombatSummary([
            { name: 'NPC 1', type: 'npc' },
            { name: 'NPC 5', type: 'npc' },
        ])
        const nextNum = addNpc(cs)

        expect(nextNum).toBe(6)
    })

    it('starts at 1 when no NPCs exist', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player' },
        ])
        const nextNum = addNpc(cs)

        expect(nextNum).toBe(1)
    })
})

describe('removeNpc', () => {
    it('removes the named creature', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player' },
            { name: 'NPC 1', type: 'npc' },
        ])
        removeNpc(cs, 'NPC 1')

        expect(cs.creatures).toHaveLength(1)
        expect(cs.creatures[0].name).toBe('Alice')
    })

    it('does nothing if creature not found', () => {
        const cs = createCombatSummary([{ name: 'Alice', type: 'player' }])
        removeNpc(cs, 'NonExistent')

        expect(cs.creatures).toHaveLength(1)
    })
})

describe('getNextCreatureName', () => {
    it('returns next creature when not at end', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player' },
            { name: 'Bob', type: 'player' },
            { name: 'NPC 1', type: 'npc' },
        ])
        const result = getNextCreatureName(cs, 'Alice')

        expect(result.newActiveName).toBe('Bob')
        expect(result.roundIncrement).toBe(false)
    })

    it('wraps to first creature and increments round at end', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player' },
            { name: 'Bob', type: 'player' },
        ])
        const result = getNextCreatureName(cs, 'Bob')

        expect(result.newActiveName).toBe('Alice')
        expect(result.roundIncrement).toBe(true)
    })
})

describe('getPreviousCreatureName', () => {
    it('returns previous creature when not at start', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player' },
            { name: 'Bob', type: 'player' },
        ])
        const result = getPreviousCreatureName(cs, 'Bob')

        expect(result.newActiveName).toBe('Alice')
        expect(result.roundDecrement).toBe(false)
    })

    it('wraps to last creature and decrements round at start', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player' },
            { name: 'Bob', type: 'player' },
        ])
        const result = getPreviousCreatureName(cs, 'Alice')

        expect(result.newActiveName).toBe('Bob')
        expect(result.roundDecrement).toBe(true)
    })
})

describe('isPreviousDisabled', () => {
    it('returns true when active is first creature in round 1', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player' },
            { name: 'Bob', type: 'player' },
        ], 1)
        expect(isPreviousDisabled(cs, 'Alice')).toBe(true)
    })

    it('returns false when not in round 1', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player' },
        ], 2)
        expect(isPreviousDisabled(cs, 'Alice')).toBe(false)
    })

    it('returns false when active is not first creature', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player' },
            { name: 'Bob', type: 'player' },
        ], 1)
        expect(isPreviousDisabled(cs, 'Bob')).toBe(false)
    })

    it('returns false when combatSummary is null', () => {
        expect(isPreviousDisabled(null, 'Alice')).toBe(false)
    })
})

describe('setInitiative', () => {
    it('sets initiative and sorts descending', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player', initiative: '10' },
            { name: 'Bob', type: 'player', initiative: '5' },
        ])
        setInitiative(cs, 'Bob', '15')

        expect(cs.creatures[0].name).toBe('Bob')
        expect(cs.creatures[1].name).toBe('Alice')
    })

    it('does nothing if creature not found', () => {
        const cs = createCombatSummary([{ name: 'Alice', type: 'player', initiative: '10' }])
        setInitiative(cs, 'NonExistent', '15')

        expect(cs.creatures[0].initiative).toBe('10')
    })
})

describe('rollNpcInitiative', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        rollD20.mockReset()
    })

    it('rolls d20 + bonus and sets initiative', () => {
        rollD20.mockReturnValue(15)
        const cs = createCombatSummary([
            { name: 'Goblin', type: 'npc', initiative: '', initiativeBonus: 2 },
        ])
        const result = rollNpcInitiative(cs, 'Goblin')

        expect(result.roll).toBe(15)
        expect(result.bonus).toBe(2)
        expect(result.total).toBe(17)
        expect(cs.creatures[0].initiative).toBe('17')
    })

    it('returns null for non-npc creature', () => {
        const cs = createCombatSummary([{ name: 'Alice', type: 'player' }])
        const result = rollNpcInitiative(cs, 'Alice')

        expect(result).toBeNull()
    })

    it('returns null for nonexistent creature', () => {
        const cs = createCombatSummary([])
        const result = rollNpcInitiative(cs, 'Nobody')

        expect(result).toBeNull()
    })

    it('sorts creatures by initiative after rolling', () => {
        rollD20.mockReturnValue(20)
        const cs = createCombatSummary([
            { name: 'Goblin', type: 'npc', initiative: '5', initiativeBonus: 0 },
            { name: 'Orc', type: 'npc', initiative: '10', initiativeBonus: 0 },
        ])
        rollNpcInitiative(cs, 'Goblin')

        expect(cs.creatures[0].name).toBe('Goblin')
        expect(cs.creatures[1].name).toBe('Orc')
    })
})

describe('setTarget', () => {
    it('sets target on creature', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player', targetName: null },
            { name: 'Bob', type: 'player', targetName: null },
        ])
        setTarget(cs, 'Alice', 'Bob')

        expect(cs.creatures[0].targetName).toBe('Bob')
    })

    it('clears target when set to null', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player', targetName: 'Bob' },
        ])
        setTarget(cs, 'Alice', null)

        expect(cs.creatures[0].targetName).toBeNull()
    })

    it('does nothing if creature not found', () => {
        const cs = createCombatSummary([])
        setTarget(cs, 'NonExistent', 'Bob')
    })
})

describe('clearCombat', () => {
    const getName = (n) => n || 'Unknown'

    it('creates fresh combat with round 1', () => {
        const chars = [createCharacter('Alice')]
        const result = clearCombat(chars, 2, getName)

        expect(result.round).toBe(1)
        expect(result.creatures).toHaveLength(3)
    })
})

describe('mergeCombatSummaryWithCharacters', () => {
    const getName = (n) => n || 'Unknown'

    it('merges player creatures with defaults', () => {
        const initial = {
            round: 2,
            creatures: [
                { name: 'Alice', type: 'player' },
                { name: 'Goblin', type: 'npc' },
            ],
        }
        const chars = [createCharacter('Alice')]
        const result = mergeCombatSummaryWithCharacters(initial, chars, getName)

        expect(result.round).toBe(2)
        const player = result.creatures.find(c => c.name === 'Alice')
        expect(player.initiative).toBe('')
        expect(player.targetName).toBeNull()
        expect(player.concentration).toBeNull()
    })

    it('merges NPC creatures with defaults', () => {
        const initial = {
            round: 1,
            creatures: [
                { name: 'Goblin', type: 'npc' },
            ],
        }
        const result = mergeCombatSummaryWithCharacters(initial, [], getName)

        const npc = result.creatures[0]
        expect(npc.conditions).toEqual([])
        expect(npc.concentration).toBeNull()
        expect(npc.currentHp).toBe(10)
        expect(npc.maxHp).toBe(10)
        expect(npc.saveBonuses).toEqual({})
    })

    it('preserves existing NPC values when present', () => {
        const initial = {
            round: 1,
            creatures: [
                { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 10, conditions: [{ id: '1', key: 'poisoned' }] },
            ],
        }
        const result = mergeCombatSummaryWithCharacters(initial, [], getName)

        const npc = result.creatures[0]
        expect(npc.currentHp).toBe(5)
        expect(npc.maxHp).toBe(10)
        expect(npc.conditions).toHaveLength(1)
    })
})
