import { describe, it, expect } from 'vitest'
import { buildAttackInfo } from './automationInfoBuilder.js'
import { collectAutomationFromFeatures } from './automationCollector.js'
import { collectSaveModifiers } from './automationModifiers.js'

const makeFeature = (auto, name = 'Create Thrall') => ({
    name,
    automation: auto,
})

const makePlayerStats = (overrides = {}) => ({
    name: 'Test Warlock',
    level: 14,
    proficiency: 6,
    abilities: [
        { name: 'Strength', bonus: 0 },
        { name: 'Dexterity', bonus: 0 },
        { name: 'Constitution', bonus: 0 },
        { name: 'Intelligence', bonus: 0 },
        { name: 'Wisdom', bonus: 0 },
        { name: 'Charisma', bonus: 4 },
    ],
    class: {
        class_levels: [
            { level: 14, features: [] },
        ],
        subclass: {
            class_levels: [
                { level: 14, features: [makeFeature({
                    type: 'create_thrall',
                    spell: 'Summon Aberration',
                    uses_expression: 'CHA modifier_min_1',
                    recharge: 'long_rest',
                    casting_time: '1 action',
                    tempHpExpression: 'warlock level + CHA modifier',
                })] },
            ],
        },
    },
    ...overrides,
})

describe('create_thrall automation', () => {
    describe('buildAttackInfo', () => {
        it('builds create_thrall info', () => {
            const feature = makeFeature({
                type: 'create_thrall',
                spell: 'Summon Aberration',
                uses_expression: 'CHA modifier_min_1',
                recharge: 'long_rest',
                casting_time: '1 action',
            })
            const result = buildAttackInfo(feature, makePlayerStats())
            expect(result).not.toBeNull()
            expect(result.type).toBe('create_thrall')
            expect(result.name).toBe('Create Thrall')
            expect(result.spell).toBe('Summon Aberration')
            expect(result.uses_expression).toBe('CHA modifier_min_1')
            expect(result.hasAutomation).toBe(true)
        })

        it('resolves usesMax from expression', () => {
            const feature = makeFeature({
                type: 'create_thrall',
                spell: 'Summon Aberration',
                uses_expression: 'CHA modifier_min_1',
            })
            const result = buildAttackInfo(feature, makePlayerStats())
            expect(result.usesMax).toBe(4)
        })

        it('defaults to 1 when expression evaluates to 0', () => {
            const ps = makePlayerStats({
                abilities: [
                    { name: 'Charisma', bonus: -3 },
                ],
            })
            const feature = makeFeature({
                type: 'create_thrall',
                uses_expression: 'CHA modifier_min_1',
            })
            const result = buildAttackInfo(feature, ps)
            expect(result.usesMax).toBe(1)
        })
    })

    describe('collectAutomationFromFeatures', () => {
        it('collects create_thrall as an action', () => {
            const feature = makeFeature({
                type: 'create_thrall',
                spell: 'Summon Aberration',
            })
            const result = collectAutomationFromFeatures([feature], makePlayerStats())
            expect(result.actions).toHaveLength(1)
            expect(result.actions[0].type).toBe('create_thrall')
        })

        it('collects attack_rider with options as passive', () => {
            const feature = makeFeature({
                type: 'attack_rider',
                trigger: 'companion_aberration_hit',
                options: ['Hex damage bonus'],
                chooseOne: true,
                damageExpression: '1d6',
                damageType: 'Psychic',
                oncePerTurn: true,
            })
            const result = collectAutomationFromFeatures([feature], makePlayerStats())
            expect(result.passives).toHaveLength(1)
            expect(result.passives[0].type).toBe('attack_rider')
            expect(result.passives[0].trigger).toBe('companion_aberration_hit')
        })
    })

    describe('collectSaveModifiers', () => {
        it('returns empty array for create_thrall feature', () => {
            const feature = makeFeature({
                type: 'create_thrall',
                spell: 'Summon Aberration',
            })
            const result = collectSaveModifiers([feature])
            expect(result).toEqual([])
        })
    })
})
