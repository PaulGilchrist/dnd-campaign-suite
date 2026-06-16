import { describe, it, expect } from 'vitest'
import { getConditionImmunities, getConditionalImmunities, playerIsImmuneToCondition, hasSelfRestoration } from './automationImmunities.js'

// Mock the protectionFromEvilAndGoodHandler
vi.mock('../../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
    isProtectionFromEvilAndGoodActive: vi.fn(() => false),
    isCreatureWarded: vi.fn(() => false),
}))

describe('getConditionImmunities', () => {
    it('returns empty array when features is null', () => {
        expect(getConditionImmunities(null)).toEqual([])
    })

    it('returns empty array when features is undefined', () => {
        expect(getConditionImmunities(undefined)).toEqual([])
    })

    it('returns empty array when features is empty', () => {
        expect(getConditionImmunities([])).toEqual([])
    })

    it('returns empty array when features have no automation', () => {
        expect(getConditionImmunities([{ name: 'Test' }])).toEqual([])
    })

    it('collects passive_immunity conditionImmunity', () => {
        const features = [{
            name: 'Magic Resistance',
            automation: { type: 'passive_immunity', conditionImmunity: 'charmed frightened' }
        }]
        const result = getConditionImmunities(features)
        expect(result).toContain('charmed frightened')
    })

    it('collects passive_immunity damageResistance as damage: prefixed strings', () => {
        const features = [{
            name: 'Fire Resistance',
            automation: {
                type: 'passive_immunity',
                conditionImmunity: 'poisoned',
                damageResistance: ['fire', 'cold']
            }
        }]
        const result = getConditionImmunities(features)
        expect(result).toContain('poisoned')
        expect(result).toContain('damage:fire')
        expect(result).toContain('damage:cold')
    })

    it('collects condition_immunity_while_active immunities', () => {
        const features = [{
            name: 'Etherealness',
            automation: {
                type: 'condition_immunity_while_active',
                immunities: ['charmed', 'frightened', 'poisoned']
            }
        }]
        const result = getConditionImmunities(features)
        expect(result).toContain('charmed')
        expect(result).toContain('frightened')
        expect(result).toContain('poisoned')
    })

    it('collects land_resistance conditionImmunity', () => {
        const features = [{
            name: 'Forest Walker',
            automation: {
                type: 'land_resistance',
                conditionImmunity: 'charmed'
            }
        }]
        const result = getConditionImmunities(features)
        expect(result).toContain('charmed')
    })

    it('handles array automation', () => {
        const features = [{
            name: 'Mixed',
            automation: [
                { type: 'passive_immunity', conditionImmunity: 'charmed' },
                { type: 'other' }
            ]
        }]
        const result = getConditionImmunities(features)
        expect(result).toContain('charmed')
    })
})

describe('getConditionalImmunities', () => {
    it('returns empty array when features is null', () => {
        expect(getConditionalImmunities(null)).toEqual([])
    })

    it('returns empty array when features is empty', () => {
        expect(getConditionalImmunities([])).toEqual([])
    })

    it('returns empty array when features have no automation', () => {
        expect(getConditionalImmunities([{ name: 'Test' }])).toEqual([])
    })

    it('collects condition_immunity_while_active entries', () => {
        const features = [{
            name: 'Etherealness',
            automation: {
                type: 'condition_immunity_while_active',
                immunities: ['charmed', 'frightened'],
                requiresActive: 'aura_of_protection'
            }
        }]
        const result = getConditionalImmunities(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            name: 'Etherealness',
            immunities: ['charmed', 'frightened'],
            requiresActive: 'aura_of_protection'
        })
    })

    it('uses defaults for missing fields', () => {
        const features = [{
            name: 'Test',
            automation: { type: 'condition_immunity_while_active' }
        }]
        const result = getConditionalImmunities(features)
        expect(result[0].immunities).toEqual([])
        expect(result[0].requiresActive).toBe('')
    })

    it('handles array automation', () => {
        const features = [{
            name: 'Mixed',
            automation: [
                {
                    type: 'condition_immunity_while_active',
                    immunities: ['poisoned'],
                    requiresActive: 'blessing'
                },
                { type: 'other' }
            ]
        }]
        const result = getConditionalImmunities(features)
        expect(result).toHaveLength(1)
        expect(result[0].immunities).toEqual(['poisoned'])
    })
})

describe('playerIsImmuneToCondition', () => {
    it('returns false when conditionKey is null', () => {
        expect(playerIsImmuneToCondition({ conditionKey: null, playerStats: {} })).toBe(false)
    })

    it('returns false when playerStats is null', () => {
        expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats: null })).toBe(false)
    })

    it('checks playerStats.immunities array', () => {
        const playerStats = {
            name: 'Test',
            immunities: ['charmed', 'frightened']
        }
        expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats })).toBe(true)
        expect(playerIsImmuneToCondition({ conditionKey: 'frightened', playerStats })).toBe(true)
        expect(playerIsImmuneToCondition({ conditionKey: 'poisoned', playerStats })).toBe(false)
    })

    it('checks case-insensitively for immunities', () => {
        const playerStats = {
            name: 'Test',
            immunities: ['Charmed', 'Frightened']
        }
        expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats })).toBe(true)
        expect(playerIsImmuneToCondition({ conditionKey: 'FRIGHTENED', playerStats })).toBe(true)
    })

    it('checks passive_immunity from allFeatures', () => {
        const playerStats = {
            name: 'Test',
            allFeatures: [{
                name: 'Magic Resistance',
                automation: {
                    type: 'passive_immunity',
                    conditionImmunity: 'charmed frightened'
                }
            }]
        }
        expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats })).toBe(true)
        expect(playerIsImmuneToCondition({ conditionKey: 'frightened', playerStats })).toBe(true)
    })

    it('checks passive_immunity damageResistance', () => {
        const playerStats = {
            name: 'Test',
            allFeatures: [{
                name: 'Fire Resistance',
                automation: {
                    type: 'passive_immunity',
                    damageResistance: ['fire', 'cold']
                }
            }]
        }
        expect(playerIsImmuneToCondition({ conditionKey: 'damage:fire', playerStats })).toBe(true)
        expect(playerIsImmuneToCondition({ conditionKey: 'damage:cold', playerStats })).toBe(true)
        expect(playerIsImmuneToCondition({ conditionKey: 'damage:lightning', playerStats })).toBe(false)
    })

    it('checks land_resistance conditionImmunity', () => {
        const playerStats = {
            name: 'Test',
            allFeatures: [{
                name: 'Forest Walker',
                automation: {
                    type: 'land_resistance',
                    conditionImmunity: 'charmed'
                }
            }]
        }
        expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats })).toBe(true)
    })

    it('checks condition_immunity_while_active without requiresActive', () => {
        const playerStats = {
            name: 'Test',
            allFeatures: [{
                name: 'Etherealness',
                automation: {
                    type: 'condition_immunity_while_active',
                    immunities: ['poisoned']
                }
            }]
        }
        expect(playerIsImmuneToCondition({ conditionKey: 'poisoned', playerStats })).toBe(true)
    })

    it('checks condition_immunity_while_active with requiresActive', () => {
        const getRuntimeValue = vi.fn((name, key, campaign) => [
            { name: 'aura_of_protection' }
        ])
        const playerStats = {
            name: 'Test',
            allFeatures: [{
                name: 'Etherealness',
                automation: {
                    type: 'condition_immunity_while_active',
                    immunities: ['charmed'],
                    requiresActive: 'aura_of_protection'
                }
            }]
        }
        expect(playerIsImmuneToCondition({
            conditionKey: 'charmed',
            playerStats,
            getRuntimeValue,
            campaignName: 'test-campaign'
        })).toBe(true)
    })

    it('returns false when requiresActive buff is not active', () => {
        const getRuntimeValue = vi.fn((name, key, campaign) => [
            { name: 'other_buff' }
        ])
        const playerStats = {
            name: 'Test',
            allFeatures: [{
                name: 'Etherealness',
                automation: {
                    type: 'condition_immunity_while_active',
                    immunities: ['charmed'],
                    requiresActive: 'aura_of_protection'
                }
            }]
        }
        expect(playerIsImmuneToCondition({
            conditionKey: 'charmed',
            playerStats,
            getRuntimeValue,
            campaignName: 'test-campaign'
        })).toBe(false)
    })

    it('checks activeBuffs for temporary condition immunity', () => {
        const getRuntimeValue = vi.fn((name, key, campaign) => [
            {
                name: 'feign_death',
                conditionImmunity: ['dead', 'poisoned']
            }
        ])
        const playerStats = {
            name: 'Test',
            allFeatures: []
        }
        expect(playerIsImmuneToCondition({
            conditionKey: 'poisoned',
            playerStats,
            getRuntimeValue,
            campaignName: 'test-campaign'
        })).toBe(true)
    })

    it('returns false when no immunity found', () => {
        const playerStats = {
            name: 'Test',
            allFeatures: []
        }
        expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats })).toBe(false)
    })
})

describe('hasSelfRestoration', () => {
    it('returns false when playerStats is null', () => {
        expect(hasSelfRestoration(null)).toBe(false)
    })

    it('returns false when playerStats has no allFeatures', () => {
        expect(hasSelfRestoration({ name: 'Test' })).toBe(false)
    })

    it('returns false when allFeatures is empty', () => {
        expect(hasSelfRestoration({ name: 'Test', allFeatures: [] })).toBe(false)
    })

    it('returns false when features have no matching automation', () => {
        const playerStats = {
            name: 'Test',
            allFeatures: [{
                name: 'Magic Resistance',
                automation: { type: 'passive_immunity', conditionImmunity: 'charmed' }
            }]
        }
        expect(hasSelfRestoration(playerStats)).toBe(false)
    })

    it('returns true when end_of_turn_condition_removal is found', () => {
        const playerStats = {
            name: 'Test',
            allFeatures: [{
                name: 'Self-Restoration',
                automation: {
                    type: 'passive_rule',
                    effect: 'end_of_turn_condition_removal',
                    conditions: ['charmed']
                }
            }]
        }
        expect(hasSelfRestoration(playerStats)).toBe(true)
    })

    it('handles array automation', () => {
        const playerStats = {
            name: 'Test',
            allFeatures: [{
                name: 'Mixed',
                automation: [
                    { type: 'passive_immunity', conditionImmunity: 'charmed' },
                    {
                        type: 'passive_rule',
                        effect: 'end_of_turn_condition_removal',
                        conditions: ['frightened']
                    }
                ]
            }]
        }
        expect(hasSelfRestoration(playerStats)).toBe(true)
    })

    it('returns true when any feature has end_of_turn_condition_removal', () => {
        const playerStats = {
            name: 'Test',
            allFeatures: [
                {
                    name: 'Magic Resistance',
                    automation: { type: 'passive_immunity', conditionImmunity: 'charmed' }
                },
                {
                    name: 'Self-Restoration',
                    automation: {
                        type: 'passive_rule',
                        effect: 'end_of_turn_condition_removal',
                        conditions: ['charmed']
                    }
                }
            ]
        }
        expect(hasSelfRestoration(playerStats)).toBe(true)
    })
})
