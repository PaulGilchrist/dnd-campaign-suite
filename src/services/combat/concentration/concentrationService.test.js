// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
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

import { rollD20 } from '../../dice/diceRoller.js'
import { rollConcentrationSave as rollConcentrationRules, breakConcentration as breakConcentrationRules } from './concentrationRules.js'
import { computeAuraBonus } from '../auras/auraOfProtection.js'
import { getCreatureSaveBonus } from '../conditions/conditionSaveService.js'
import {
    rollConcentrationSave as rollConcentrationSaveSvc,
    breakConcentration as breakConcentrationSvc,
    addConcentration,
    buildConcentrationPopup,
} from './concentrationService.js'

function createCharacter(name, opts = {}) {
    const { conBonus = 3, activeBuffs = [] } = opts
    return {
        name,
        computedStats: { abilities: [{ name: 'Constitution', bonus: conBonus }] },
        activeBuffs,
    }
}

function createCombatSummary(creatures = []) {
    return { round: 1, creatures }
}

describe('rollConcentrationSave', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        rollD20.mockReset()
    })

    it('returns roll result with combined bonus from ability and aura for player creature', async () => {
        rollConcentrationRules.mockReturnValue({ roll: 12, success: true })
        getCreatureSaveBonus.mockResolvedValue(3)
        computeAuraBonus.mockResolvedValue({ bonus: 2, sourceName: 'Paladin' })

        const creature = { name: 'Alice', type: 'player' }
        const chars = [createCharacter('Alice')]

        const result = await rollConcentrationSaveSvc(
            creature, { spell: 'Bless', dc: 10 }, chars, [], 'TestCampaign', null, (n) => n
        )

        expect(result.roll).toBe(12)
        expect(result.success).toBe(true)
        expect(result.bonus).toBe(5)
        expect(result.bonusDetail).toBe('(+2 aura from Paladin)')
    })

    it('omits bonusDetail when aura bonus is zero', async () => {
        rollConcentrationRules.mockReturnValue({ roll: 12, success: true })
        getCreatureSaveBonus.mockResolvedValue(3)
        computeAuraBonus.mockResolvedValue({ bonus: 0 })

        const creature = { name: 'Alice', type: 'player' }
        const chars = [createCharacter('Alice')]

        const result = await rollConcentrationSaveSvc(
            creature, { spell: 'Bless', dc: 10 }, chars, [], 'TestCampaign', null, (n) => n
        )

        expect(result.bonusDetail).toBeUndefined()
    })

    it('passes creature name and campaign data to getCreatureSaveBonus and computeAuraBonus', async () => {
        rollConcentrationRules.mockReturnValue({ roll: 10, success: true })
        getCreatureSaveBonus.mockResolvedValue(0)
        computeAuraBonus.mockResolvedValue({ bonus: 0 })

        const creature = { name: 'Ally', type: 'player' }
        const chars = [{ name: 'Group' }]
        const getName = (n) => n

        await rollConcentrationSaveSvc(
            creature, { spell: 'Shield', dc: 15 }, chars, [], 'MyCampaign', 'DungeonMap', getName
        )

        expect(getCreatureSaveBonus).toHaveBeenCalledWith(creature, 'con', chars, [], getName)
        expect(computeAuraBonus).toHaveBeenCalledWith({
            targetName: 'Ally',
            characters: chars,
            campaignName: 'MyCampaign',
            activeMapName: 'DungeonMap',
        })
    })

    it('passes dragon constellation result to concentrationRules when buff exists', async () => {
        rollConcentrationRules.mockReturnValue({ roll: 10, success: true })
        getCreatureSaveBonus.mockResolvedValue(3)
        computeAuraBonus.mockResolvedValue({ bonus: 0 })

        const creature = { name: 'Sorcerer', type: 'player' }
        const chars = [createCharacter('Sorcerer', { activeBuffs: [{ name: 'Starry Form', constellation: 'Dragon' }] })]

        await rollConcentrationSaveSvc(
            creature, { spell: 'Shield', dc: 13 }, chars, [], '', null, (n) => n
        )

        expect(rollConcentrationRules).toHaveBeenCalledWith(3, 13, true)
    })

    it('handles negative save bonus combined with aura bonus', async () => {
        rollConcentrationRules.mockReturnValue({ roll: 10, success: true })
        getCreatureSaveBonus.mockResolvedValue(-2)
        computeAuraBonus.mockResolvedValue({ bonus: 3, sourceName: 'Paladin' })

        const creature = { name: 'Alice', type: 'player' }
        const chars = [createCharacter('Alice')]

        const result = await rollConcentrationSaveSvc(
            creature, { spell: 'Shield', dc: 11 }, chars, [], '', null, (n) => n
        )

        expect(result.bonus).toBe(1)
        expect(result.bonusDetail).toBe('(+3 aura from Paladin)')
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

    it('returns null when creature is not found or has no concentration', () => {
        expect(breakConcentrationSvc(createCombatSummary([]), 'NonExistent')).toBeNull()
        expect(breakConcentrationSvc(createCombatSummary([{ name: 'Alice', type: 'player' }]), 'Alice')).toBeNull()
        expect(breakConcentrationSvc(createCombatSummary([{ name: 'Alice', type: 'player', concentration: null }]), 'Alice')).toBeNull()
    })

    it('does not modify other creatures in the combat summary', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player', concentration: { spell: 'Bless', dc: 10 } },
            { name: 'Bob', type: 'npc', concentration: { spell: 'Haste', dc: 13 } },
        ])
        breakConcentrationSvc(cs, 'Alice')

        expect(cs.creatures[1].concentration).toEqual({ spell: 'Haste', dc: 13 })
    })

    it('calls concentrationRules.breakConcentration with the concentration object', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player', concentration: { spell: 'Bless', dc: 10 } },
        ])

        breakConcentrationSvc(cs, 'Alice')

        expect(breakConcentrationRules).toHaveBeenCalledWith({ spell: 'Bless', dc: 10 })
    })
})

describe('addConcentration', () => {
    it('adds concentration with trimmed spell name and generates an id', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player', concentration: null },
        ])
        addConcentration(cs, 'Alice', '  Bless  ', 10)

        expect(cs.creatures[0].concentration.spell).toBe('Bless')
        expect(cs.creatures[0].concentration.dc).toBe(10)
        expect(typeof cs.creatures[0].concentration.id).toBe('string')
    })

    it('replaces existing concentration on the creature', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player', concentration: { spell: 'OldSpell', dc: 10, id: 'old' } },
        ])
        addConcentration(cs, 'Alice', 'NewSpell', 15)

        expect(cs.creatures[0].concentration.spell).toBe('NewSpell')
        expect(cs.creatures[0].concentration.dc).toBe(15)
    })

    it('does nothing when creature is not found', () => {
        const cs = createCombatSummary([])
        expect(addConcentration(cs, 'NonExistent', 'Bless', 10)).toBeUndefined()
    })

    it('preserves other creature properties when adding concentration', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player', concentration: null, hp: 25, maxHp: 30 },
        ])
        addConcentration(cs, 'Alice', 'Bless', 10)

        expect(cs.creatures[0].hp).toBe(25)
        expect(cs.creatures[0].maxHp).toBe(30)
        expect(cs.creatures[0].concentration.spell).toBe('Bless')
    })
})

describe('buildConcentrationPopup', () => {
    it('builds popup data structure with all expected fields', () => {
        const popup = buildConcentrationPopup(12, 5, undefined, 'Bless', 10, true)

        expect(popup).toEqual({
            type: 'd20',
            rollType: 'condition-save',
            name: 'Concentration',
            rolls: [12],
            bonus: 5,
            condition: 'Bless',
            dc: 10,
            success: true,
            targetName: null,
            targetAc: null,
            hit: undefined,
        })
    })

    it('includes bonusDetail when provided', () => {
        const popup = buildConcentrationPopup(12, 5, '+3 aura from Paladin', 'Bless', 10, true)
        expect(popup.bonusDetail).toBe('+3 aura from Paladin')
    })

    it('reflects failure when success is false', () => {
        const popup = buildConcentrationPopup(5, 3, undefined, 'Armor', 14, false)
        expect(popup.success).toBe(false)
        expect(popup.rollType).toBe('condition-save')
    })

    it('handles zero and negative bonus', () => {
        expect(buildConcentrationPopup(10, 0, undefined, 'Shield', 10, true).bonus).toBe(0)
        expect(buildConcentrationPopup(10, -2, undefined, 'Shield', 8, true).bonus).toBe(-2)
    })

    it('wraps the roll value in a rolls array', () => {
        const popup = buildConcentrationPopup(7, 0, undefined, 'Haste', 10, true)
        expect(popup.rolls).toEqual([7])
    })
})
