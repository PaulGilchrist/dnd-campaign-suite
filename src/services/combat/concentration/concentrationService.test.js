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

    it('returns roll result with bonus and bonusDetail for player creature', async () => {
        rollConcentrationRules.mockReturnValue({ roll: 12, success: true })
        getCreatureSaveBonus.mockResolvedValue(3)
        computeAuraBonus.mockResolvedValue({ bonus: 2, sourceName: 'Paladin' })

        const creature = { name: 'Alice', type: 'player' }
        const chars = [createCharacter('Alice')]
        const getName = (n) => n

        const result = await rollConcentrationSaveSvc(
            creature, { spell: 'Bless', dc: 10 }, chars, [], 'TestCampaign', null, getName
        )

        expect(result.roll).toBe(12)
        expect(result.success).toBe(true)
        expect(result.bonus).toBe(5)
        expect(result.bonusDetail).toBe('(+2 aura from Paladin)')
    })

    it('returns bonusDetail without sourceName when aura has no source', async () => {
        rollConcentrationRules.mockReturnValue({ roll: 12, success: true })
        getCreatureSaveBonus.mockResolvedValue(3)
        computeAuraBonus.mockResolvedValue({ bonus: 2, sourceName: undefined })

        const creature = { name: 'Alice', type: 'player' }
        const chars = [createCharacter('Alice')]

        const result = await rollConcentrationSaveSvc(
            creature, { spell: 'Bless', dc: 10 }, chars, [], 'TestCampaign', null, (n) => n
        )

        expect(result.bonusDetail).toBe('(+2 aura)')
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

    it('passes creature name and campaign data to getCreatureSaveBonus', async () => {
        rollConcentrationRules.mockReturnValue({ roll: 10, success: true })
        getCreatureSaveBonus.mockResolvedValue(0)
        computeAuraBonus.mockResolvedValue({ bonus: 0 })

        const creature = { name: 'Goblin', type: 'npc' }
        const getName = (n) => n

        await rollConcentrationSaveSvc(
            creature, { spell: 'Haste', dc: 13 }, [], [], 'TestCampaign', 'Map1', getName
        )

        expect(getCreatureSaveBonus).toHaveBeenCalledWith(creature, 'con', [], [], getName)
    })

    it('passes correct parameters to computeAuraBonus', async () => {
        rollConcentrationRules.mockReturnValue({ roll: 10, success: true })
        getCreatureSaveBonus.mockResolvedValue(0)
        computeAuraBonus.mockResolvedValue({ bonus: 0 })

        const creature = { name: 'Ally', type: 'player' }
        const chars = [{ name: 'Group' }]
        const getName = (n) => n

        await rollConcentrationSaveSvc(
            creature, { spell: 'Shield', dc: 15 }, chars, [], 'MyCampaign', 'DungeonMap', getName
        )

        expect(computeAuraBonus).toHaveBeenCalledWith({
            targetName: 'Ally',
            characters: chars,
            campaignName: 'MyCampaign',
            activeMapName: 'DungeonMap',
        })
    })

    it('uses getName to resolve character for player creatures', async () => {
        rollConcentrationRules.mockReturnValue({ roll: 10, success: true })
        getCreatureSaveBonus.mockResolvedValue(3)
        computeAuraBonus.mockResolvedValue({ bonus: 0 })

        const creature = { name: 'hero_name', type: 'player' }
        const chars = [{ name: 'hero_name', computedStats: { abilities: [] } }]
        const getName = (n) => n

        await rollConcentrationSaveSvc(
            creature, { spell: 'Armor', dc: 10 }, chars, [], '', null, getName
        )

        expect(getCreatureSaveBonus).toHaveBeenCalledWith(creature, 'con', chars, [], getName)
    })

    it('calls hasDragonConstellation and passes result to concentrationRules', async () => {
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

    it('passes false for dragonConstellation when no matching buff exists', async () => {
        rollConcentrationRules.mockReturnValue({ roll: 10, success: true })
        getCreatureSaveBonus.mockResolvedValue(2)
        computeAuraBonus.mockResolvedValue({ bonus: 0 })

        const creature = { name: 'Rogue', type: 'player' }
        const chars = [createCharacter('Rogue', { activeBuffs: [{ name: 'Starry Form', constellation: 'Wolf' }] })]

        await rollConcentrationSaveSvc(
            creature, { spell: 'Shield', dc: 12 }, chars, [], '', null, (n) => n
        )

        expect(rollConcentrationRules).toHaveBeenCalledWith(2, 12, false)
    })

    it('passes false when creature has no name', async () => {
        rollConcentrationRules.mockReturnValue({ roll: 10, success: true })
        getCreatureSaveBonus.mockResolvedValue(0)
        computeAuraBonus.mockResolvedValue({ bonus: 0 })

        const creature = { type: 'npc' }

        await rollConcentrationSaveSvc(
            creature, { spell: 'Shield', dc: 10 }, [], [], '', null, (n) => n
        )

        expect(rollConcentrationRules).toHaveBeenCalledWith(0, 10, false)
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

    it('returns null result for npc creature when concentration rules fail', async () => {
        rollConcentrationRules.mockReturnValue({ roll: 8, success: false })
        getCreatureSaveBonus.mockResolvedValue(0)
        computeAuraBonus.mockResolvedValue({ bonus: 0 })

        const creature = { name: 'Goblin', type: 'npc' }

        const result = await rollConcentrationSaveSvc(
            creature, { spell: 'Haste', dc: 13 }, [], [], 'TestCampaign', null, (n) => n
        )

        expect(result.roll).toBe(8)
        expect(result.success).toBe(false)
        expect(result.bonus).toBe(0)
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

    it('returns the spell name when creature is found with concentration', () => {
        const cs = createCombatSummary([
            { name: 'Bob', type: 'npc', concentration: { spell: 'Haste', dc: 13, id: 'abc' } },
        ])

        const spell = breakConcentrationSvc(cs, 'Bob')

        expect(spell).toBe('Haste')
    })

    it('returns null when creature is not found', () => {
        const cs = createCombatSummary([])
        const spell = breakConcentrationSvc(cs, 'NonExistent')

        expect(spell).toBeNull()
    })

    it('returns null when creature has no concentration property', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player' },
        ])
        const spell = breakConcentrationSvc(cs, 'Alice')

        expect(spell).toBeNull()
    })

    it('returns null when creature has concentration set to null', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player', concentration: null },
        ])
        const spell = breakConcentrationSvc(cs, 'Alice')

        expect(spell).toBeNull()
    })

    it('does not modify other creatures in the combat summary', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player', concentration: { spell: 'Bless', dc: 10 } },
            { name: 'Bob', type: 'npc', concentration: { spell: 'Haste', dc: 13 } },
            { name: 'Carol', type: 'player', concentration: null },
        ])
        breakConcentrationSvc(cs, 'Alice')

        expect(cs.creatures[1].concentration).toEqual({ spell: 'Haste', dc: 13 })
        expect(cs.creatures[2].concentration).toBeNull()
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
    it('adds concentration to creature with trimmed spell name', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player', concentration: null },
        ])
        addConcentration(cs, 'Alice', '  Bless  ', 10)

        expect(cs.creatures[0].concentration.spell).toBe('Bless')
        expect(cs.creatures[0].concentration.dc).toBe(10)
        expect(cs.creatures[0].concentration.id).toBeDefined()
    })

    it('generates a string id for concentration', () => {
        const cs = createCombatSummary([
            { name: 'Alice', type: 'player', concentration: null },
        ])
        addConcentration(cs, 'Alice', 'Shield', 15)

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

    it('does nothing and returns undefined when creature is not found', () => {
        const cs = createCombatSummary([])
        const result = addConcentration(cs, 'NonExistent', 'Bless', 10)

        expect(result).toBeUndefined()
    })

    it('works with npc creatures', () => {
        const cs = createCombatSummary([
            { name: 'Goblin', type: 'npc', concentration: null },
        ])
        addConcentration(cs, 'Goblin', 'Haste', 13)

        expect(cs.creatures[0].concentration.spell).toBe('Haste')
        expect(cs.creatures[0].concentration.dc).toBe(13)
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

    it('omits bonusDetail when undefined', () => {
        const popup = buildConcentrationPopup(12, 5, undefined, 'Shield', 12, true)

        expect(popup.bonusDetail).toBeUndefined()
    })

    it('reflects failure when success is false', () => {
        const popup = buildConcentrationPopup(5, 3, undefined, 'Armor', 14, false)

        expect(popup.success).toBe(false)
        expect(popup.rollType).toBe('condition-save')
    })

    it('wraps the roll value in a rolls array', () => {
        const popup = buildConcentrationPopup(7, 0, undefined, 'Haste', 10, true)

        expect(Array.isArray(popup.rolls)).toBe(true)
        expect(popup.rolls).toEqual([7])
    })

    it('handles zero bonus', () => {
        const popup = buildConcentrationPopup(10, 0, undefined, 'Shield', 10, true)

        expect(popup.bonus).toBe(0)
    })

    it('handles negative bonus', () => {
        const popup = buildConcentrationPopup(10, -2, undefined, 'Shield', 8, true)

        expect(popup.bonus).toBe(-2)
    })

    it('sets targetName and targetAc to null', () => {
        const popup = buildConcentrationPopup(1, -3, 'detail', 'Bless', 5, false)

        expect(popup.targetName).toBeNull()
        expect(popup.targetAc).toBeNull()
    })

    it('sets hit to undefined', () => {
        const popup = buildConcentrationPopup(10, 5, undefined, 'Bless', 15, true)

        expect(popup.hit).toBeUndefined()
    })

    it('uses the spell name as the condition field', () => {
        const popup = buildConcentrationPopup(10, 3, undefined, 'Major Image', 11, true)

        expect(popup.condition).toBe('Major Image')
    })

    it('includes bonusDetail when null is explicitly passed', () => {
        const popup = buildConcentrationPopup(10, 5, null, 'Shield', 12, true)

        expect(popup.bonusDetail).toBeNull()
    })
})
