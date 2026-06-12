import { describe, it, expect, vi, beforeEach } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, BASE_FEATURE } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo – initiative_action', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'initiative_action' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'initiative_action',
            name: 'Test Feature',
            effect: '',
            healExpression: '',
            trigger: 'roll_initiative',
            uses: 1,
            usesMax: 1,
            recharge: 'long_rest',
            resourceCost: '',
            resourceKey: 'testfeatureUses',
            hasAutomation: true,
        })
    })

    it('generates resourceKey from feature name', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'initiative_action' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.resourceKey).toBe('testfeatureUses')
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'initiative_action',
                effect: 'advantage',
                healExpression: '2d4',
                trigger: 'on_initiative',
                uses: 3,
                recharge: 'short_rest',
                resourceCost: 'spell_slot',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.effect).toBe('advantage')
        expect(result.healExpression).toBe('2d4')
        expect(result.trigger).toBe('on_initiative')
        expect(result.uses).toBe(3)
        expect(result.usesMax).toBe(3)
        expect(result.recharge).toBe('short_rest')
        expect(result.resourceCost).toBe('spell_slot')
    })
})

describe('buildAttackInfo – meta', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'meta' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'meta',
            name: 'Test Feature',
            effect: '',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'meta',
                effect: 'meta_effect',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.effect).toBe('meta_effect')
    })
})

describe('buildAttackInfo – passive_buff', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'passive_buff' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'passive_buff',
            name: 'Test Feature',
            target: 'allies_in_range',
            range_expression: '10_ft',
            effect: '',
            bonusExpression: '',
            condition: '',
            conditionImmunity: '',
            resistances: [],
            options: [],
            extraMastery: [],
            grantsFlySpeed: false,
            grantsSwimSpeed: false,
            hasAutomation: true,
        })
    })

    it('falls back bonus to bonusExpression when bonusExpression is empty', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'passive_buff',
                bonus: '+2',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.bonusExpression).toBe('+2')
    })

    it('prefers bonusExpression over bonus', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'passive_buff',
                bonusExpression: '+3',
                bonus: '+2',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.bonusExpression).toBe('+3')
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'passive_buff',
                target: 'self',
                range_expression: '30_ft',
                effect: 'buff',
                bonusExpression: '+2',
                condition: 'conditions',
                conditionImmunity: 'charmed',
                resistances: ['fire'],
                options: ['option1'],
                extraMastery: ['extra1'],
                grantsFlySpeed: true,
                grantsSwimSpeed: true,
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.target).toBe('self')
        expect(result.range_expression).toBe('30_ft')
        expect(result.effect).toBe('buff')
        expect(result.bonusExpression).toBe('+2')
        expect(result.condition).toBe('conditions')
        expect(result.conditionImmunity).toBe('charmed')
        expect(result.resistances).toEqual(['fire'])
        expect(result.options).toEqual(['option1'])
        expect(result.extraMastery).toEqual(['extra1'])
        expect(result.grantsFlySpeed).toBe(true)
        expect(result.grantsSwimSpeed).toBe(true)
    })
})

describe('buildAttackInfo – passive_immunity', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'passive_immunity' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'passive_immunity',
            name: 'Test Feature',
            target: 'self',
            conditionImmunity: '',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'passive_immunity',
                target: 'allies',
                conditionImmunity: 'charmed|frightened',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.target).toBe('allies')
        expect(result.conditionImmunity).toBe('charmed|frightened')
    })
})
