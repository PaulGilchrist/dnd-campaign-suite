import { describe, it, expect, vi, beforeEach } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, BASE_FEATURE } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo – bardic_inspiration_defense', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'bardic_inspiration_defense' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'bardic_inspiration_defense',
            name: 'Test Feature',
            hasAutomation: true,
        })
    })
})

describe('buildAttackInfo – bardic_inspiration_offense', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'bardic_inspiration_offense' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'bardic_inspiration_offense',
            name: 'Test Feature',
            hasAutomation: true,
        })
    })
})

describe('buildAttackInfo – combat_stance', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'combat_stance' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'combat_stance',
            name: 'Test Feature',
            effect: '',
            damageBonusExpression: '',
            resistanceTypes: [],
            advantages: [],
            options: [],
            duration: '',
            resourceKey: 'ragePoints',
            uses: 0,
            flySpeed: null,
            reactionSave: null,
            blocksSpellcasting: false,
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'combat_stance',
                effect: 'rage',
                damageBonusExpression: '2d6',
                resistanceTypes: ['fire', 'cold'],
                advantages: ['perception'],
                options: ['option1'],
                duration: '1 minute',
                resourceKey: 'customKey',
                uses: 3,
                flySpeed: 30,
                reactionSave: 'DEX',
                blocksSpellcasting: true,
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.effect).toBe('rage')
        expect(result.damageBonusExpression).toBe('2d6')
        expect(result.resistanceTypes).toEqual(['fire', 'cold'])
        expect(result.advantages).toEqual(['perception'])
        expect(result.options).toEqual(['option1'])
        expect(result.duration).toBe('1 minute')
        expect(result.resourceKey).toBe('customKey')
        expect(result.uses).toBe(3)
        expect(result.flySpeed).toBe(30)
        expect(result.reactionSave).toBe('DEX')
        expect(result.blocksSpellcasting).toBe(true)
    })
})

describe('buildAttackInfo – conditional_advantage', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'conditional_advantage' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'conditional_advantage',
            name: 'Test Feature',
            target: 'saving_throw',
            condition: '',
            effect: 'advantage',
            abilities: [],
            uses: null,
            recharge: 'long_rest',
            casting_time: 'passive',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'conditional_advantage',
                target: 'attack_roll',
                condition: 'flanked',
                effect: 'advantage2',
                abilities: ['STR', 'DEX'],
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.target).toBe('attack_roll')
        expect(result.condition).toBe('flanked')
        expect(result.effect).toBe('advantage2')
        expect(result.abilities).toEqual(['STR', 'DEX'])
    })
})

describe('buildAttackInfo – conditional_disadvantage', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'conditional_disadvantage' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'conditional_disadvantage',
            name: 'Test Feature',
            target: 'attack_roll',
            condition: '',
            effect: 'disadvantage',
            abilities: [],
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'conditional_disadvantage',
                target: 'saving_throw',
                condition: 'blinded',
                effect: 'disadvantage2',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.target).toBe('saving_throw')
        expect(result.condition).toBe('blinded')
        expect(result.effect).toBe('disadvantage2')
    })
})

describe('buildAttackInfo – evasion', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'evasion' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'evasion',
            name: 'Test Feature',
            saveType: 'DEX',
            shareable: false,
            shareRange: 0,
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'evasion',
                saveType: 'CON',
                shareable: true,
                shareRange: 30,
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveType).toBe('CON')
        expect(result.shareable).toBe(true)
        expect(result.shareRange).toBe(30)
    })
})
