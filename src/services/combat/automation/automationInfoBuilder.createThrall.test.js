// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { buildAttackInfo } from './automationInfoBuilder.js'
import { collectAutomationFromFeatures } from './automationCollector.js'
import { collectSaveModifiers } from './automationModifiers.js'

// ── Fixtures ─────────────────────────────────────────────────────────

const makeFeature = (automation, name = 'Create Thrall') => ({
    name,
    automation,
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
                { level: 14, features: [] },
            ],
        },
    },
    ...overrides,
})

// ── buildAttackInfo ──────────────────────────────────────────────────

describe('buildAttackInfo – create_thrall', () => {
    it('returns null when feature has no automation', () => {
        const feature = { name: 'Empty Feature', automation: null }
        const result = buildAttackInfo(feature, makePlayerStats())
        expect(result).toBeNull()
    })

    it('returns null for unknown automation types', () => {
        const feature = makeFeature({ type: 'unknown_type' })
        const result = buildAttackInfo(feature, makePlayerStats())
        expect(result).toBeNull()
    })

    it('returns create_thrall info with all expected fields', () => {
        const feature = makeFeature({
            type: 'create_thrall',
            spell: 'Summon Aberration',
            uses_expression: 'CHA modifier_min_1',
            recharge: 'long_rest',
            casting_time: '1 action',
            tempHpExpression: 'warlock level + CHA modifier',
        })
        const result = buildAttackInfo(feature, makePlayerStats())

        expect(result).not.toBeNull()
        expect(result.type).toBe('create_thrall')
        expect(result.name).toBe('Create Thrall')
        expect(result.spell).toBe('Summon Aberration')
        expect(result.uses_expression).toBe('CHA modifier_min_1')
        expect(result.hasAutomation).toBe(true)
    })

    it('resolves usesMax from expression using CHA modifier', () => {
        const feature = makeFeature({
            type: 'create_thrall',
            spell: 'Summon Aberration',
            uses_expression: 'CHA modifier_min_1',
        })
        const result = buildAttackInfo(feature, makePlayerStats())
        expect(result.usesMax).toBe(4)
    })

    it('resolves usesMax from CHA expression with negative modifier floors to 1', () => {
        const ps = makePlayerStats({
            abilities: [
                { name: 'Strength', bonus: 0 },
                { name: 'Dexterity', bonus: 0 },
                { name: 'Constitution', bonus: 0 },
                { name: 'Intelligence', bonus: 0 },
                { name: 'Wisdom', bonus: 0 },
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

    it('defaults usesMax to 1 when expression resolves to 0', () => {
        const ps = makePlayerStats({
            abilities: [
                { name: 'Strength', bonus: 0 },
                { name: 'Dexterity', bonus: 0 },
                { name: 'Constitution', bonus: 0 },
                { name: 'Intelligence', bonus: 0 },
                { name: 'Wisdom', bonus: 0 },
                { name: 'Charisma', bonus: -1 },
            ],
        })
        const feature = makeFeature({
            type: 'create_thrall',
            uses_expression: 'CHA modifier_min_1',
        })
        const result = buildAttackInfo(feature, ps)
        expect(result.usesMax).toBe(1)
    })

    it('defaults usesMax to 1 when no expression is provided', () => {
        const feature = makeFeature({
            type: 'create_thrall',
        })
        const result = buildAttackInfo(feature, makePlayerStats())
        expect(result.usesMax).toBe(1)
    })
})

// ── collectAutomationFromFeatures ────────────────────────────────────

describe('collectAutomationFromFeatures', () => {
    it('returns empty collections when given no features', () => {
        const result = collectAutomationFromFeatures(null, makePlayerStats())
        expect(result.actions).toHaveLength(0)
        expect(result.bonusActions).toHaveLength(0)
        expect(result.reactions).toHaveLength(0)
        expect(result.specialActions).toHaveLength(0)
        expect(result.passives).toHaveLength(0)
    })

    it('returns empty collections when given empty array', () => {
        const result = collectAutomationFromFeatures([], makePlayerStats())
        expect(result.actions).toHaveLength(0)
        expect(result.passives).toHaveLength(0)
    })

    it('routes create_thrall into actions', () => {
        const feature = makeFeature({
            type: 'create_thrall',
            spell: 'Summon Aberration',
        })
        const result = collectAutomationFromFeatures([feature], makePlayerStats())
        expect(result.actions).toHaveLength(1)
        expect(result.actions[0].type).toBe('create_thrall')
    })

    it('routes attack_rider with options into passives', () => {
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

// ── collectSaveModifiers ─────────────────────────────────────────────

describe('collectSaveModifiers', () => {
    it('returns empty array when given null', () => {
        const result = collectSaveModifiers(null)
        expect(result).toEqual([])
    })

    it('returns empty array for create_thrall feature', () => {
        const feature = makeFeature({
            type: 'create_thrall',
            spell: 'Summon Aberration',
        })
        const result = collectSaveModifiers([feature])
        expect(result).toEqual([])
    })
})
