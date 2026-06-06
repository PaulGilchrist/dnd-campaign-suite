import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./diceRoller.js', () => ({
    rollD20: vi.fn(),
}))

vi.mock('./concentrationRules.js', () => ({
    rollConcentrationSave: vi.fn(() => ({ roll: 10, success: true })),
    breakConcentration: vi.fn(() => null),
}))

import { rollD20 } from './diceRoller.js'
import { rollConcentrationSave } from './concentrationRules.js'
import {
    rollConcentrationSave as rollConcentrationSaveSvc,
    breakConcentration as breakConcentrationSvc,
    addConcentration,
    buildConcentrationPopup,
} from './concentrationService.js'

function createCharacter(name) {
    return { name, computedStats: { abilities: [{ name: 'Constitution', bonus: 3 }] } }
}

function createCombatSummary(creatures = []) {
    return { round: 1, creatures }
}

describe('rollConcentrationSave', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        rollD20.mockReset()
    })

    it('rolls save for player creature', async () => {
        rollConcentrationSave.mockReturnValue({ roll: 12, success: true })
        const creature = { name: 'Alice', type: 'player' }
        const chars = [createCharacter('Alice')]
        const getName = (n) => n

        const result = await rollConcentrationSaveSvc(
            creature, { spell: 'Bless', dc: 10 }, chars, [], 'TestCampaign', null, getName
        )

        expect(result.roll).toBe(12)
        expect(result.success).toBe(true)
        expect(result.bonus).toBeGreaterThan(0)
    })

    it('rolls save for NPC creature', async () => {
        rollConcentrationSave.mockReturnValue({ roll: 8, success: false })
        const creature = { name: 'Goblin', type: 'npc' }
        const getName = (n) => n

        const result = await rollConcentrationSaveSvc(
            creature, { spell: 'Haste', dc: 13 }, [], [], 'TestCampaign', null, getName
        )

        expect(result.roll).toBe(8)
        expect(result.success).toBe(false)
    })
})

describe('breakConcentration', () => {
    it('sets concentration to null and returns spell name', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player', concentration: { spell: 'Bless', dc: 10 } },
        ])
        const spell = breakConcentrationSvc(cs, 'Alice')

        expect(spell).toBe('Bless')
        expect(cs.creatures[0].concentration).toBeNull()
    })

    it('returns null when creature not found', () => {
        const cs = createCombatSummary([])
        const spell = breakConcentrationSvc(cs, 'NonExistent')

        expect(spell).toBeNull()
    })

    it('returns null when creature has no concentration', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player', concentration: null },
        ])
        const spell = breakConcentrationSvc(cs, 'Alice')

        expect(spell).toBeNull()
    })
})

describe('addConcentration', () => {
    it('adds concentration to creature', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player', concentration: null },
        ])
        addConcentration(cs, 'Alice', 'Bless', 10)

        expect(cs.creatures[0].concentration).not.toBeNull()
        expect(cs.creatures[0].concentration.spell).toBe('Bless')
        expect(cs.creatures[0].concentration.dc).toBe(10)
        expect(cs.creatures[0].concentration.id).toBeDefined()
    })

    it('trims spell name', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player', concentration: null },
        ])
        addConcentration(cs, 'Alice', '  Bless  ', 10)

        expect(cs.creatures[0].concentration.spell).toBe('Bless')
    })

    it('does nothing if creature not found', () => {
        const cs = createCombatSummary([])
        addConcentration(cs, 'NonExistent', 'Bless', 10)
    })
})

describe('buildConcentrationPopup', () => {
    it('builds popup data structure', () => {
        const popup = buildConcentrationPopup(12, 5, undefined, 'Bless', 10, true)

        expect(popup.type).toBe('d20')
        expect(popup.rollType).toBe('condition-save')
        expect(popup.name).toBe('Concentration')
        expect(popup.rolls).toEqual([12])
        expect(popup.bonus).toBe(5)
        expect(popup.condition).toBe('Bless')
        expect(popup.dc).toBe(10)
        expect(popup.success).toBe(true)
        expect(popup.targetName).toBeNull()
        expect(popup.targetAc).toBeNull()
        expect(popup.hit).toBeUndefined()
    })

    it('includes bonusDetail when provided', () => {
        const popup = buildConcentrationPopup(12, 5, '+3 aura from Paladin', 'Bless', 10, true)

        expect(popup.bonusDetail).toBe('+3 aura from Paladin')
    })
})
