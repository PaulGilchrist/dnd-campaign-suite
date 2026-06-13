import { describe, it, expect, vi, beforeEach } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, BASE_FEATURE } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo – countercharm', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'countercharm' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'countercharm',
            name: 'Test Feature',
            trigger: '',
            range: '',
            conditions: [],
            effect: '',
            uses: 1,
            recharge: 'long_rest',
            casting_time: '1 reaction',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'countercharm',
                trigger: 'on_charm',
                range: '30 ft',
                conditions: ['charmed', 'frightened'],
                effect: 'remove_conditions',
                uses: 3,
                recharge: 'short_rest',
                casting_time: '1 action',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.trigger).toBe('on_charm')
        expect(result.range).toBe('30 ft')
        expect(result.conditions).toEqual(['charmed', 'frightened'])
        expect(result.effect).toBe('remove_conditions')
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('short_rest')
        expect(result.casting_time).toBe('1 action')
    })
})

describe('buildAttackInfo – damage_aura', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'damage_aura' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'damage_aura',
            name: 'Test Feature',
            damageType: '',
            damageExpression: '',
            range: '10_ft',
            duration: '1_minute',
            recharge: 'long_rest',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'damage_aura',
                damageType: 'fire',
                damageExpression: '2d6',
                range: '15_ft',
                duration: 'concentration',
                recharge: 'short_rest',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageType).toBe('fire')
        expect(result.damageExpression).toBe('2d6')
        expect(result.range).toBe('15_ft')
        expect(result.duration).toBe('concentration')
        expect(result.recharge).toBe('short_rest')
    })
})

describe('buildAttackInfo – damage_bonus', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'damage_bonus' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'damage_bonus',
            name: 'Test Feature',
            trigger: '',
            damageExpression: '',
            damageType: '',
            maxDamage: '',
            extraVs: null,
            extraDamage: '',
            resourceType: 'spell_slot',
            oncePerTurn: false,
            options: [],
            tempHpExpression: '',
            upgrades: '',
            rangeBonusCantrip: '',
            uses_expression: '',
            usesMax: 0,
            recharge: '',
            hasAutomation: true,
        })
    })

    it('applies scaling based on player level', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'damage_bonus',
                damageExpression: '1d6',
                scaling: {
                    3: '2d6',
                    5: '3d6',
                },
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageExpression).toBe('3d6')
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'damage_bonus',
                trigger: 'on_hit',
                damageExpression: '2d6',
                damageType: 'fire',
                maxDamage: 20,
                extraVs: 'giant',
                extraDamage: '1d8',
                resourceType: 'warlock_slot',
                oncePerTurn: true,
                options: ['option1'],
                tempHpExpression: '2d4',
                upgrades: 'upgrade_expr',
                rangeBonusCantrip: '120_ft',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.trigger).toBe('on_hit')
        expect(result.damageExpression).toBe('2d6')
        expect(result.damageType).toBe('fire')
        expect(result.maxDamage).toBe(20)
        expect(result.extraVs).toBe('giant')
        expect(result.extraDamage).toBe('1d8')
        expect(result.resourceType).toBe('warlock_slot')
        expect(result.oncePerTurn).toBe(true)
        expect(result.options).toEqual(['option1'])
        expect(result.tempHpExpression).toBe('2d4')
        expect(result.upgrades).toBe('upgrade_expr')
        expect(result.rangeBonusCantrip).toBe('120_ft')
    })
})

describe('buildAttackInfo – damage_modifier', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'damage_modifier' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'damage_modifier',
            name: 'Test Feature',
            trigger: '',
            modifierExpression: '',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'damage_modifier',
                trigger: 'on_hit',
                modifierExpression: '+2d6',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.trigger).toBe('on_hit')
        expect(result.modifierExpression).toBe('+2d6')
    })
})

describe('buildAttackInfo – damage_reduction', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'damage_reduction' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'damage_reduction',
            name: 'Test Feature',
            reductionExpression: '',
            trigger: '',
            reaction: false,
            redirect: false,
            redirectCost: null,
            redirectDamage: '',
            redirectSave: 'DEX',
            cost: null,
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'damage_reduction',
                reductionExpression: '1d10',
                trigger: 'on_hit',
                reaction: true,
                redirect: true,
                redirectCost: 'resource',
                redirectDamage: '1d6',
                redirectSave: 'CON',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.reductionExpression).toBe('1d10')
        expect(result.trigger).toBe('on_hit')
        expect(result.reaction).toBe(true)
        expect(result.redirect).toBe(true)
        expect(result.redirectCost).toBe('resource')
        expect(result.redirectDamage).toBe('1d6')
        expect(result.redirectSave).toBe('CON')
    })
})
